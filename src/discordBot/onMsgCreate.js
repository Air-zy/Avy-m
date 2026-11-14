const fs = require('fs');

const cmdprefix = JSON.parse(fs.readFileSync('src/discordBot/json_storage/configs.json'))[0].prefix;
const cmd_funcs = require("./msg_cmds.js");

const userTimeouts = new Map();
const delay = 1000;
const { sendToRowa } = require("./rowa/sendMsgToRowa.js")

module.exports = async (client, message) => {
  if (userTimeouts.has(message.author.id)) {
    return;
  }
  userTimeouts.set(message.author.id, true);

  if (message.channel.id === "1404212337426042910" && !message.webhookId) { // whooks channel
    const msgContent = message.content
    const userName = message.author.username
    sendToRowa(userName, msgContent);
  }

  const msg_channel = message.channel
  if (message.content.startsWith(cmdprefix)) { // if command
    try {
      await cmd_funcs.handle_cmds(message);
    } catch (err) {
      console.log("[MSG CMDS ERROR]", err);
      if (err.rawError) {
        msg_channel.send("```js\n" + `${err.rawError.message}` + "```");
      } else {
        msg_channel.send("```js\n" + `${err.message}` + "```")
      }
    }
  }
  setTimeout(() => {
    userTimeouts.delete(message.author.id);
  }, delay);
}
