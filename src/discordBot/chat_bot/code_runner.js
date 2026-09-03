const { spawn } = require('node:child_process');
const path = require('node:path');

const CHILD = path.join(__dirname, 'sandbox_child.js');

const TIMEOUT_MS = 15000;      // covers pyodide's ~2s cold start plus real work
const MEM_KB = 512 * 1024;     // address space, not RSS: pyodide idles ~150MB
const MAX_OUTPUT = 1500;       // Discord messages are 2000
const SPARE_DELAY_MS = 2000;   // idle gap before booting the next sandbox

// Pyodide cannot be memory-capped from inside Node -- WASM memory is outside the V8 heap,
// so worker resourceLimits do nothing and an RSS watchdog loses to a single synchronous
// allocation (measured: bytearray(1.5GB) completed in one step, peaking at 1.5GB RSS).
// An OS address-space limit is the only thing that actually stops it, hence a child
// process under `ulimit -v`.
//
// ponytail: ulimit is Linux-only, so on a Windows dev box the child runs uncapped. The
// deploy target is Linux; if that ever changes, this needs a job object or a container.
function spawnSandbox() {
    if (process.platform === 'linux') {
        return spawn('sh', ['-c', `ulimit -v ${MEM_KB}; exec node ${JSON.stringify(CHILD)}`], { stdio: ['pipe', 'pipe', 'pipe'] });
    }
    return spawn(process.execPath, [CHILD], { stdio: ['pipe', 'pipe', 'pipe'] });
}

// Pyodide takes ~2s to boot, which is most of a short run. The child now starts loading
// it before it reads stdin, so keeping one idle spare hides that entirely. The spare is
// only created *after* a first run, so a bot that never runs code pays nothing for it.
// Each run still gets its own interpreter, so nothing leaks between users.
let spare = null;

function takeSandbox() {
    const child = spare || spawnSandbox();
    spare = null;
    return child;
}

function warmSpare() {
    if (spare) return;
    try {
        const child = spawnSandbox();
        const drop = () => { if (spare === child) spare = null; };   // only clear itself
        child.on('error', drop);
        child.on('exit', drop);
        child.unref();
        // unref() covers the process handle but not its stdio pipes, and those alone keep
        // the event loop alive -- a script would print its result and then hang forever.
        for (const s of [child.stdin, child.stdout, child.stderr]) s?._handle?.unref?.();
        child.stdout.resume();
        child.stderr.resume();
        spare = child;
    } catch {
        spare = null;
    }
}

// For scripts and tests: a long-running bot never needs this, but anything that expects
// to exit does, because the idle spare is a live child process.
function shutdown() {
    if (!spare) return;
    try { spare.kill('SIGKILL'); } catch { /* already gone */ }
    spare = null;
}

function runCode(source) {
    return new Promise((resolve) => {
        const child = takeSandbox();

        let stdout = '';
        let stderr = '';
        let settled = false;

        const finish = (result) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { child.kill('SIGKILL'); } catch { /* already gone */ }
            resolve(result);
            // Deferred, not immediate: two Pyodide instances competing for CPU made a
            // cold run 7.4s instead of ~2.5s, and back-to-back runs would have every
            // spare boot landing on top of the next run. A idle gap is the point --
            // in a real channel the next message is seconds away, so it is ready by then.
            setTimeout(warmSpare, SPARE_DELAY_MS).unref();
        };

        const timer = setTimeout(
            () => finish({ ok: false, error: `timed out after ${TIMEOUT_MS / 1000}s` }),
            TIMEOUT_MS
        );

        child.stdout.on('data', (d) => { stdout += d; });
        child.stderr.on('data', (d) => { stderr += d; });
        child.on('error', (e) => finish({ ok: false, error: `sandbox failed to start: ${e.message}` }));

        child.on('close', () => {
            try {
                finish(JSON.parse(stdout));
            } catch {
                // no JSON means the child died before reporting: OOM under ulimit, or a crash
                finish({ ok: false, error: stderr.trim().slice(0, 300) || 'sandbox died (out of memory?)' });
            }
        });

        child.stdin.end(source);
    });
}

// What the model gets back. Kept short on purpose: this lands in a Discord message.
function formatResult(r) {
    const parts = [];
    if (r.output) parts.push(r.output.slice(0, MAX_OUTPUT));
    if (r.error) parts.push(`error: ${r.error}`);
    if (!parts.length) parts.push(r.ok ? 'ran fine, printed nothing' : 'no output');
    return parts.join('\n').slice(0, MAX_OUTPUT);
}

module.exports = { runCode, formatResult, shutdown };
