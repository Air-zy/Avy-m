const fs = require('fs').promises
async function setup() {
    const filePath = 'node_modules/@discordjs/ws/dist/index.js'
    
    try {
        let data = await fs.readFile(filePath, 'utf8');
        if (data.includes('browser: "Discord iOS",')) {
            console.log('[Mobile Presence] File already modified. No action needed.');
            return;
        }
        const modifiedData = data.replace(
            'browser: DefaultDeviceProperty,',
            'browser: "Discord iOS",'
        );
        await fs.writeFile(filePath, modifiedData, 'utf8');
        console.log('[Mobile Presence] File modified successfully.');
    } catch (err) {
        console.error('[Mobile Presence ERROR]', err);
    }
};

module.exports = { setup };