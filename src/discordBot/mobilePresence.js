const fs = require('fs')
async function setupMobileP() {
    const filePath = 'node_modules/@discordjs/ws/dist/index.js'
    fs.readFile(
        filePath,
        'utf8',
    (err, data) => {
        if (err) {
            console.log('[Mobile Presence ERROR] reading file:', err);
            return;
        }

        // check if the browser is already set to "Discord iOS"
        if (data.includes('browser: "Discord iOS",')) {
            console.log('[Mobile Presence] File already modified. No action needed.');
            return;
        }

        const modifiedData = data.replace(
            'browser: DefaultDeviceProperty,',
            'browser: "Discord iOS",'
        );

        fs.writeFile(filePath, modifiedData, 'utf8', (err) => {
            if (err) {
                console.error('[Mobile Presence ERROR] writing file:', err);
                return;
            }
            console.log('[Mobile Presence] File modified successfully.');
        });
    });
};

module.exports = setupMobileP;