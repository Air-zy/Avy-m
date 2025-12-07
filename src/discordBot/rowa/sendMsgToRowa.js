const envDecrypt = require('../../envDecrypt.js');
const rbxApiKey = envDecrypt(process.env.avyKey, process.env.rowaCloudApi);

async function sendToRowa(userName, msgContent) {
    if (typeof userName !== "string" || userName.length < 2) {
        return
    }

    if (typeof msgContent !== "string" || msgContent.trim().length === 0) {
        return
    }

    msgContent = msgContent.slice(0, 128);
    
    const msg = userName + ": " + msgContent
    const topic = "dsMsg";
    const universeId = '8502229770';
    const url = `https://apis.roblox.com/messaging-service/v1/universes/${universeId}/topics/${topic}`;

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": rbxApiKey,
        },
        body: JSON.stringify({ message: msg })
    });

    if (!res.ok) {
        console.error("err:", res.status, await res.text());
        return;
    }

    console.log("msg sent to rowa");
}

module.exports = { sendToRowa };