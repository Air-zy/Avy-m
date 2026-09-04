// node --env-file=.env src/discordBot/chat_bot/test_code_runner.js
// Runs real Python in the sandbox, so it is slow (~2s cold start each) and needs network.
// These assertions are the sandbox's reason to exist: if one fails, do not ship it.
const assert = require('assert');
const http = require('node:http');
const { runCode, formatResult, shutdown } = require('./code_runner.js');

process.env.SANDBOX_CANARY = 'this-would-be-avyKey';

(async () => {
    const out = async (src) => formatResult(await runCode(src));

    // it has to actually be useful
    assert.match(await out('print(sum(range(10)))'), /^45$/m);
    assert.match(await out('import json; print(json.dumps({"a": 1}))'), /\{"a": 1\}/);

    // the whole point: Pyodide's default jsglobals expose Node's globalThis, and
    // `js.process.env` then hands a Discord user every secret this bot holds
    const secrets = await out('import js; print(js.process.env.SANDBOX_CANARY)');
    assert.ok(!secrets.includes('this-would-be-avyKey'), 'SECRETS LEAKED FROM SANDBOX');
    assert.match(secrets, /AttributeError/);

    // host filesystem is not reachable; Pyodide only sees its in-memory MEMFS
    assert.ok(!(await out("print(open('.env').read())")).includes('avyKey='), 'HOST FS READABLE');

    // no processes
    assert.match(await out("import subprocess; subprocess.run(['ls'])"), /Error/);

    // the sanctioned network path works, but refuses anything that resolves private:
    // this bot runs an express server on localhost and cloud metadata is on 169.254
    const srv = http.createServer((_q, r) => r.end('LOCAL')).listen(38121, '127.0.0.1');
    try {
        assert.match(await out("print((await http_get('https://example.com'))[:15])"), /<!doctype html>/i);
        assert.match(await out("print(await http_get('http://127.0.0.1:38121/'))"), /private address/);
        assert.match(await out("print(await http_get('http://169.254.169.254/'))"), /private address/);
        assert.match(await out("print(await http_get('file:///etc/passwd'))"), /not allowed/);
    } finally {
        srv.close();
    }

    // a runaway loop must be killed, not hang the bot forever
    const t0 = Date.now();
    assert.match(await out('while True: pass'), /timed out/);
    assert.ok(Date.now() - t0 < 30000, 'timeout did not fire');

    console.log('ok');
    shutdown();   // the pre-warmed spare is a live child; without this we never exit
})();
