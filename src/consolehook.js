const MAX = 4000;
let logBuf = '';

const write = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, enc, cb) => {
  const s = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
  logBuf = (logBuf + s).slice(-MAX);
  return write(chunk, enc, cb);
};

function getLogs() {
  return logBuf;
}

module.exports = {
    getLogs
}