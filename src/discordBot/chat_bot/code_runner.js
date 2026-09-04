const { spawn } = require('node:child_process');
const path = require('node:path');

const CHILD = path.join(__dirname, 'sandbox_child.js');

const TIMEOUT_MS = 15000;      // covers pyodide's ~2s cold start plus real work
const MAX_HEAP_MB = 128;       // v8's own heap in the child, not the wasm memory
const MAX_OUTPUT = 1500;       // Discord messages are 2000

// Pyodide cannot be memory-capped from inside Node -- WASM memory is outside the V8 heap,
// so worker resourceLimits do nothing and an RSS watchdog loses to a single synchronous
// allocation (measured: bytearray(1.5GB) completed in one step, peaking at 1.5GB RSS).
//
// `ulimit -v` was the answer to that and it cannot work: V8 reserves a multi-GB virtual
// cage before it executes a line, whatever the box's physical memory, so the child died
// at startup with "Failed to reserve virtual memory for CodeRange" and no python ever
// ran. Capping V8's heap is the part that works from in here.
//
// ponytail: that leaves no hard ceiling on the wasm side. cgroups is the only thing that
// really caps a Node child -- `systemd-run --scope -p MemoryMax=200M` -- so wire that in
// if the deploy box has systemd. Until then the timeout is the guard.
function spawnSandbox() {
    return spawn(process.execPath, [`--max-old-space-size=${MAX_HEAP_MB}`, CHILD], { stdio: ['pipe', 'pipe', 'pipe'] });
}

// There used to be a pre-warmed spare here holding a booted Pyodide, so a run skipped the
// ~2s cold start. It also held ~150MB of RSS forever, which is a sixth of the deploy box.
// Under a gig of RAM, two seconds is far cheaper than a permanently idle interpreter.
function takeSandbox() {
    return spawnSandbox();
}

// Kept so callers need not care whether anything is being held onto. Nothing is.
function shutdown() {}

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
    if (r.output) parts.push(r.output);
    if (r.error) parts.push(`error: ${r.error}`);
    if (!parts.length) parts.push(r.ok ? 'ran fine, printed nothing' : 'no output');
    return parts.join('\n').slice(0, MAX_OUTPUT);
}

module.exports = { runCode, formatResult, shutdown };
