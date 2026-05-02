let client;
let Permissions;

const { build_history } = require('./build_history.js');
const { respond_process } = require('./respond_process.js');
const { isCurrentlyGenerating } = require('./avyai.js');

async function handle_chat(message) {
    if (isCurrentlyGenerating()) return;
    if (message.author.bot) return;

    if (message.channel.permissionsFor) {
        const botPermissions = message.channel.permissionsFor(client.user);
        if (botPermissions.has(Permissions.Flags.SendMessages) &&
            botPermissions.has(Permissions.Flags.ReadMessageHistory)) {
        } else {
            console.log("[Chatbot Err] cannot sent msg in channel ", message.channel.name);
            return;
        }
    }

    try {
        const history = await build_history(message, client);
        //console.log(history)
        await respond_process(message, history, client);
    } catch (err) {
        console.log("[CHAT ERROR] ", err);
    }
}

function pass_exports(p_client, p_Permissions) {
    client = p_client;
    Permissions = p_Permissions;
}

module.exports = {
    handle_chat,
    pass_exports,
};