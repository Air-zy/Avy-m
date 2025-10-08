const AIName = "Avy";
const envDecrypt = require('../../envDecrypt.js');
let sysPrompt = envDecrypt(process.env.avyKey, process.env.SystemPrompt).replace(/CHAR/g, AIName)

function get() {
    return sysPrompt;
}
function set(newSysPrompt) {
    sysPrompt = newSysPrompt;
}


module.exports = sysPrompt