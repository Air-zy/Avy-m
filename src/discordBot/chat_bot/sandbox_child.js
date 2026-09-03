// Runs untrusted Python inside Pyodide (CPython compiled to WASM). WASM issues no
// syscalls, so the filesystem it sees is an in-memory MEMFS and the only way out is the
// `js` FFI bridge. That bridge is the whole ballgame: with Pyodide's default jsglobals,
// `import js; js.process.env.avyKey` hands a Discord user every secret this bot holds.
// Replacing jsglobals with the object below makes `js.process` an AttributeError.
//
// Spawned as a child process (not a worker thread) because WASM memory sits outside V8's
// heap: worker resourceLimits do not cap it, and an RSS watchdog cannot win a race with a
// single synchronous allocation. Only an OS address-space limit stops it. See code_runner.
const { loadPyodide } = require('pyodide');
const dns = require('node:dns').promises;
const net = require('node:net');

const MAX_BODY = 200000;
const FETCH_TIMEOUT_MS = 5000;
const MAX_REQUESTS = 8;

// Blocking private space is not optional here: this bot runs an express server on
// localhost, and cloud metadata lives on 169.254.169.254. Without this, "some network
// access" means anyone in a Discord guild can read the instance's own internals.
function isPublicIp(ip) {
    if (net.isIPv6(ip)) {
        const s = ip.toLowerCase();
        return !(s === '::1' || s === '::' || s.startsWith('fe80') || s.startsWith('fc') || s.startsWith('fd'));
    }
    const p = ip.split('.').map(Number);
    if (p[0] === 10 || p[0] === 127 || p[0] === 0) return false;
    if (p[0] === 169 && p[1] === 254) return false;
    if (p[0] === 192 && p[1] === 168) return false;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return false;
    if (p[0] >= 224) return false;
    return true;
}

let requestsUsed = 0;

async function guardedFetch(rawUrl, options) {
    if (requestsUsed++ >= MAX_REQUESTS) throw new Error(`network: limit of ${MAX_REQUESTS} requests reached`);

    let url;
    try {
        url = new URL(String(rawUrl));
    } catch {
        throw new Error('network: bad url');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error(`network: ${url.protocol} is not allowed`);
    }

    // ponytail: resolve-then-fetch leaves a DNS-rebinding window. Closing it means
    // pinning the connection to the checked IP via a custom agent; do that if this
    // ever guards something that matters more than a chat bot's egress.
    const addrs = await dns.lookup(url.hostname, { all: true });
    for (const a of addrs) {
        if (!isPublicIp(a.address)) throw new Error(`network: ${url.hostname} resolves to a private address`);
    }

    const res = await fetch(url, {
        method: options?.method || 'GET',
        headers: options?.headers,
        body: options?.body,
        redirect: 'error',                 // a redirect would skip the check above
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });

    const text = (await res.text()).slice(0, MAX_BODY);
    return { status: res.status, ok: res.ok, text };
}

async function main() {
    // Started before stdin is read, not after, so a pre-warmed spare spends its idle
    // time loading the ~2s runtime instead of blocking on the pipe. See code_runner.
    const pyPromise = loadPyodide({ jsglobals: { http: guardedFetch } });

    const source = await new Promise((resolve) => {
        let s = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (d) => (s += d));
        process.stdin.on('end', () => resolve(s));
    });

    const out = [];
    const push = (s) => { if (out.join('\n').length < 4000) out.push(s); };

    const py = await pyPromise;
    py.setStdout({ batched: push });
    py.setStderr({ batched: push });

    // Emscripten's socket layer is not inert in Node: connect() on any host:port makes
    // the process attempt a WebSocket handshake, which lands on the target as a bare
    // `GET /`. send()/recv() never work, so nothing can be read back, but it is still a
    // blind request generator and a port prober aimed at localhost and the LAN.
    //
    // ponytail: this is a speed bump, NOT a boundary. `_socket` is a builtin compiled
    // into the wasm, so it cannot be deleted, and user code can pop this finder off
    // sys.meta_path. The real fix is at the OS level on deploy -- see code_runner.
    py.runPython(`
import sys

_BLOCKED = {"socket", "_socket", "ssl"}

class _NoRawSockets:
    def find_spec(self, name, path=None, target=None):
        if name.split(".")[0] in _BLOCKED:
            raise ImportError("raw sockets are disabled here, use http_get(url) or http_json(url)")
        return None

for _m in [m for m in sys.modules if m.split(".")[0] in _BLOCKED]:
    del sys.modules[_m]
sys.meta_path.insert(0, _NoRawSockets())
`);

    // Sugar so model-written code has an obvious way out. `requests` and `urllib` cannot
    // work here regardless: Pyodide has no real sockets and no TLS.
    py.runPython(`
import js
async def http_get(url):
    r = await js.http(url)
    return r.text
async def http_json(url):
    import json
    r = await js.http(url)
    return json.loads(r.text)
`);

    try {
        await py.runPythonAsync(source);
        process.stdout.write(JSON.stringify({ ok: true, output: out.join('\n').slice(0, 4000) }));
    } catch (e) {
        // Keep the last real `SomeError: detail` line; the frames above it are Pyodide's
        // own eval machinery and mean nothing to whoever is reading this in Discord.
        const lines = String(e.message || e).split('\n').map((l) => l.trim()).filter(Boolean);
        const msg = [...lines].reverse().find((l) => /^[A-Za-z_.]*(Error|Exception|Exit)\b/.test(l)) || lines.pop() || 'failed';
        process.stdout.write(JSON.stringify({ ok: false, output: out.join('\n').slice(0, 2000), error: msg.slice(0, 300) }));
    }
}

main().catch((e) => {
    process.stdout.write(JSON.stringify({ ok: false, error: String(e.message || e).slice(0, 300) }));
    process.exit(1);
});
