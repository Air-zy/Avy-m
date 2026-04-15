const fs = require('fs');
const { getLogs } = require('../../consolehook.js');

const authorized_users = JSON.parse(
    fs.readFileSync("src/discordBot/json_storage/configs.json")
)[0].authorized_users;

module.exports = async (interaction, client) => {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.user;
    const authorid = user.id
    if (!authorized_users.includes(authorid)) {
        await interaction.editReply("```js\nUnauthorized```")
        return
    }

    const logs = getLogs();
    await interaction.editReply({
        embeds: [{
            title: 'logs',
            description: logs
        }]
    });
};
