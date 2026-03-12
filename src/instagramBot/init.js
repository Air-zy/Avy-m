const envDecrypt = require('../envDecrypt.js');

async function getCredentials() {
    const IG_username = envDecrypt(process.env.avyKey, process.env.IG_USERNAME);
    const IG_password = envDecrypt(process.env.avyKey, process.env.IG_PASSWORD);
    return {
      username: IG_username,
      password: IG_password,
    };
}

async function initIG() {
    try {
        return await main();
    } catch (err) {
        console.error("[Instagram] Initialize FAILED:", err);
        //throw err;
    }
};

module.exports = { initIG };