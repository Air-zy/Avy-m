function msgChance() {
    return Math.random() < 0.05;
}

function lowChance() {
    return Math.random() < 0.02;
}

const avyPattern = /(?<!w)avy/; // "avy" is present but not preceded by "w"

async function isTalkingToBot(client, msg) {
  const msgtxt = msg.content.toLowerCase();
  if (
    msg.channel.type === 1 ||
    msgtxt.includes(client.user.id) ||
    msgChance() && msgtxt.includes("everyone") ||
    msgChance() && msgtxt.includes("i hate") ||
    msgChance() && msgtxt.includes("i love") ||
    msgChance() && msgtxt.includes("is so stupid") ||
    msgChance() && msgtxt.includes("i heard") ||
    msgChance() && msgtxt.includes("damn") ||
    msgChance() && msgtxt.includes("dang") ||
    msgChance() && msgtxt.includes("im so") ||
    msgChance() && msgtxt.includes("gyat") ||
    //lowChance() && msgtxt.includes("the") ||
    lowChance() && msgtxt.includes("this") ||
    lowChance() && msgtxt.includes("that") ||
    lowChance() && msgtxt.includes("should") ||
    lowChance() && msgtxt.includes("fuck") ||
    avyPattern.test(msgtxt) ||
    msg.mentions.repliedUser == client.user
  ) {
    return true;
  } else {
    return false;
  }
}


//
const fs = require('fs');

const cmdprefix = JSON.parse(fs.readFileSync('src/discordBot/json_storage/configs.json'))[0].prefix;
const chatbot_mod = require("./chat_bot/chatbot_module.js");
const cmd_funcs = require("./msg_cmds.js");

const userTimeouts = new Map();
const delay = 1000;
const { sendToRowa } = require("./rowa/sendMsgToRowa.js")
module.exports = async (client, message) => {
  if (userTimeouts.has(message.author.id)) {
    return;
  }
  userTimeouts.set(message.author.id, true);

  if (message.channel.type === 1){
    console.log(`(${message.channel.id})(dm) ${message.author.username}: ${message.content}`); 
  }

  if (message.channel.id === "1404212337426042910") { // whooks channel
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
    setTimeout(() => {
      userTimeouts.delete(message.author.id);
    }, delay);
  } else {
    const chk = await isTalkingToBot(client, message);
    if (chk == true) {
      if (message.channel.type != 1) { // not in DM
        console.log(`(${message.channel.id})(${message.channel.name}) ${message.author.username}: ${message.content}`);
      }
      await chatbot_mod.handle_chat(message);
    }
    setTimeout(() => {
      userTimeouts.delete(message.author.id);
    }, delay);
  }
}