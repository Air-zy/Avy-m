const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'help',
    aliases: ['cmds', 'commands'],
    adminOnly: false,

    execute: async ({ message, discordjs, config, utils }) => {
        const commandsDir = __dirname;
        const files = fs.readdirSync(commandsDir)
            .filter(f => f.endsWith('.js') && f !== 'index.js');

        let publicCmds = [];
        let adminCmds = [];

        for (const file of files) {
            const filePath = path.join(commandsDir, file);

            let cmd;
            try {
                cmd = require(filePath);
            } catch {
                continue;
            }

            const name = cmd?.name || file.replace('.js', '');
            const aliases = cmd?.aliases?.length
                ? ` [${cmd.aliases.join(', ')}]`
                : '';

            // detect admin
            let isAdmin = false;

            if (cmd?.adminOnly === true) {
                isAdmin = true;
            } else {
                try {
                    const raw = fs.readFileSync(filePath, 'utf8');
                    if (raw.includes('authorized_users')) {
                        isAdmin = true;
                    }
                } catch { }
            }

            const line = `- ${name}${aliases}`;

            if (isAdmin) {
                adminCmds.push(line);
            } else {
                publicCmds.push(line);
            }
        }

        const { EmbedBuilder } = discordjs;

        const embed = new EmbedBuilder()
            .setTitle('Commands')
            .setColor('#DC143C');

        if (publicCmds.length) {
            embed.addFields({
                name: 'public',
                value: publicCmds.join('\n').substring(0, 1024),
                inline: true
            });
        }

        if (adminCmds.length) {
            embed.addFields({
                name: '🔒 admin',
                value: adminCmds.join('\n').substring(0, 1024),
                inline: true
            });
        }

        await message.channel.send({ embeds: [embed] });
    },
};