const AIName = "Avy";
const envDecrypt = require('../../envDecrypt.js');
const sysPrompt = envDecrypt(process.env.avyKey, process.env.SystemPrompt).replace(/CHAR/g, AIName)

module.exports = sysPrompt