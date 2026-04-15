const MAX = 4000;
let logBuf = '';

const stripAnsi = (str) => str.replace(/\x1B\[[0-9;]*m/g, '');
function append(chunk) {
  const s = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
  const clean = stripAnsi(s);
  logBuf = (logBuf + clean).slice(-MAX);
}

// hook stdout
const stdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, enc, cb) => {
  append(chunk);
  return stdoutWrite(chunk, enc, cb);
};

// hook stderr (THIS captures errors/warnings)
const stderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = (chunk, enc, cb) => {
  append(chunk);
  return stderrWrite(chunk, enc, cb);
};

// catch crashes
process.on('uncaughtException', (err) => {
  append(`[uncaughtException] ${err.stack || err}\n`);
});

process.on('unhandledRejection', (reason) => {
  append(`[unhandledRejection] ${reason}\n`);
});

function getLogs() {
  return logBuf;
}

module.exports = { getLogs };