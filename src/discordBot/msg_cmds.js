let client;
let discordjs;
let Permissions;

///

function toText(value) {
  function circularReplacer() {
    const seen = new WeakSet();
    return (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return undefined; // Ignore circular references
        }
        seen.add(value);
      }
      return value;
    };
  }

  if (typeof value === 'string') {
    return value;
  } else if (typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) {
    return value.toString();
  } else if (Array.isArray(value)) {
    return value.join(', ');
  } else if (typeof value === 'object' && value !== null) {
    if (Buffer.isBuffer(value)) {
      const bufferString = value.toString("utf8");
      return bufferString;
    } else {
      return JSON.stringify(value, circularReplacer(), 2);
    }
  } else {
    return String(value);
  }
}

function reverseLines(originalString) {
  const lines = originalString.split("\n");
  const reversedLines = lines.reverse();
  const reversedString = reversedLines.join("\n");
  return reversedString;
}

///

const fs = require('fs');
const cmdprefix = JSON.parse(fs.readFileSync("src/discordBot/json_storage/configs.json"))[0]
  .prefix;
const authorized_users = JSON.parse(
  fs.readFileSync("src/discordBot/json_storage/configs.json")
)[0].authorized_users;


function pass_exports(p_client, p_discordjs, p_Permissions) {
  client = p_client;
  discordjs = p_discordjs;
  Permissions = p_Permissions
}

async function handle_cmds(message) {
  const words = message.content.split(" ");
  const mchannel = message.channel;
  const authorid = toText(message.author.id); // tostring cuz json handle number weirdly

  if (words[0] == cmdprefix + "send" || words[0] == cmdprefix + "dm") {
    const recipient_id = words[1].replace(/\D/g, "");
    const recipient = await client.users.fetch(recipient_id);
    const found_channel = await recipient.createDM();
    const txt = words.slice(2).join(" ");

    if (found_channel.permissionsFor) {
      const botPermissions = found_channel.permissionsFor(client.user);
      if (botPermissions.has(Permissions.Flags.SendMessages)) {
        await found_channel.send(txt);
      } else {
        console.log("[Chatbot Err 2] cannot sent msg in channel ", found_channel.name)
        return
      }
    }
    if (mchannel.permissionsFor) {
      const botPermissions = mchannel.permissionsFor(client.user);
      if (botPermissions.has(Permissions.Flags.SendMessages)) {
        await mchannel.send("sent to <@" + recipient_id + ">");
      } else {
        console.log("[Chatbot Err 3] cannot sent msg in channel ", mchannel.name)
        return
      }
    }
    //
  } else if (message.content == cmdprefix + "ping") {
    const start = Date.now();
    const rmsg = await mchannel.send({
      content: "A",
    });
    const latency = Date.now() - start;
    const wsPing = client.ws.ping;
    const newEmbed = new discordjs.EmbedBuilder()
      .setColor("#DC143C")
      .addFields(
        { name: "websocket", value: toText(wsPing), inline: true },
        { name: "latency", value: toText(latency), inline: true }
      );
    rmsg.edit({
      content: "",
      embeds: [newEmbed],
    });
    //
  } else if (
    (words[0] == cmdprefix + "viewc" ||
      words[0] == cmdprefix + "view_channel") &&
    authorized_users.includes(authorid)
  ) {
    let channelid = words[1];
    if (channelid) {
      channelid = toText(channelid).substring(0, 1024).replace(/\D/g, "");
    } else {
      mchannel.send(
        `channel ${toText(channelid).substring(0, 1024)} not found`
      );
      return;
    }

    var found_channel;
    try {
      const user = await client.users.fetch(channelid);
      if (user && user.id) {
        const dmChannel = await user.createDM();
        found_channel = dmChannel;
      }
    } catch (err) {
      found_channel = await client.channels.fetch(channelid);
    }

    if (found_channel) {
      let prevmessages = await found_channel.messages.fetch({ limit: 100 });
      let desctxt = "";
      prevmessages.forEach((msg) => {
        if (msg.attachments.size > 0) {
          msg.attachments.forEach((mattach) => {
            desctxt =
              desctxt +
              "(file){" +
              mattach.url +
              ", " +
              mattach.name +
              "}\n";
          });
        }
        desctxt = desctxt + `${msg.author.username}: ${msg.content.substring(0, 512)}`;
        desctxt = desctxt + "\n";
      });

      if (desctxt.length <= 0) {
        desctxt = "{empty}";
      }
      desctxt = reverseLines(desctxt.substring(0, 4096));
      let embedTitle = found_channel.name;
      if (found_channel.recipient) {
        embedTitle = found_channel.recipientId + " | " + found_channel.recipient.username;
      }
      if (found_channel.guild) {
        embedTitle = found_channel.name + " | guild: (" + found_channel.guild.name + ")(" +  found_channel.guild.id + ")";
      }
      if (embedTitle == null) {
        embedTitle = "null channel title"
      }
      const newEmbed = new discordjs.EmbedBuilder()
        .setTitle(embedTitle)
        .setColor("#DC143C")
        .setDescription(desctxt);

      mchannel.send({
        content: "",
        embeds: [newEmbed],
      });
    } else {
      mchannel.send(`${channelid} not found`);
    }
    //
  } else if (
    words[0] == cmdprefix + "delete_msgs" &&
    authorized_users.includes(authorid)
  ) {
    let channelid = words[1];
    let ammount = words[2];
    if (channelid) {
      channelid = toText(channelid).substring(0, 1024).replace(/\D/g, "");
    } else {
      mchannel.send(
        `channel ${toText(channelid).substring(0, 1024)} not found`
      );
      return;
    }

    var found_channel;
    try {
      const user = await client.users.fetch(channelid);
      if (user && user.id) {
        const dmChannel = await user.createDM();
        found_channel = dmChannel;
      }
    } catch (err) {
      found_channel = await client.channels.fetch(channelid);
    }

    if (found_channel) {
      const originalMsg = await mchannel.send({
        content: "starting delete_msgs",
      });
      let messages = await found_channel.messages.fetch({ limit: ammount });
      let desctxt = "";
      
      let msgDelete = 0;
      // Delete messages
      for (const message of messages.values()) {
        try {
            await message.delete();
            msgDelete += 1;
            if ((msgDelete % 4) == 0) {
              await originalMsg.edit(`- deleting [${msgDelete}] ${message.author.tag}:` + message.content.substring(0, 1024));
            }
            desctxt += `\nDeleted message from ${message.author.tag}: ${message.content}`;
        } catch (error) {
            desctxt += `\nFailed to delete message from ${message.author.tag}: ${error.message}`;
        }
      }
      
      desctxt = reverseLines(desctxt.substring(0, 4096));
      
      const newEmbed = new discordjs.EmbedBuilder()
        .setTitle(`Deleted ${msgDelete} messages`)
        .setColor("#DC143C")
        .setDescription(desctxt);

      await originalMsg.edit({
        content: "",
        embeds: [newEmbed],
      });
      
    }
    //
  } else if (
    words[0] == cmdprefix + "inviteme" &&
    authorized_users.includes(authorid)
  ) {
    const search_id = words[1].replace(/\D/g, "");
    const found_channel = await client.channels.fetch(search_id);
    if (found_channel) {
      const invite = await found_channel.createInvite({
          maxAge: 86400, // Invite link valid for 24 hours (in seconds)
          maxUses: 1,    // Invite link can be used only once
          temporary: false, // Users get permanent membership
          unique: true   // Each user gets a unique invite
      });
      mchannel.send(`Invite link: ${invite.url}`);
    } else {
      mchannel.send(`channel not found`);
    }
    //
  } else if (
    words[0] == cmdprefix + "lserver" &&
    authorized_users.includes(authorid)
  ) {
    const search_id = words[1].replace(/\D/g, "");
    const guilds = await client.guilds.fetch();
    let foundguild;

    guilds.forEach((guild) => {
      if (toText(guild.id) == toText(search_id)) {
        foundguild = guild;
      }
    });

    if (foundguild) {
      const fetchedguild = await client.guilds.fetch(search_id);
      fetchedguild.leave();
      mchannel.send(`successfully left the server`);
    } else {
      mchannel.send(`guild not found`);
    }
    //
  } else if (
    words[0] == cmdprefix + "vserver" &&
    authorized_users.includes(authorid)
  ) {
    const search_id = words[1].replace(/\D/g, "");
    const guilds = await client.guilds.fetch();
    let foundguild;

    guilds.forEach((guild) => {
      if (toText(guild.id) == toText(search_id)) {
        foundguild = guild;
      }
    });

    if (foundguild) {
      let guild_info = "";
      const fetchedguild = await client.guilds.fetch(search_id);
      if (fetchedguild) {
        guild_info = guild_info + `owner_id: ${fetchedguild.ownerId}\n`;
        guild_info = guild_info + `features: [${toText(foundguild.features)}]\n\n`
        guild_info = guild_info + "[CHANNELS]: \n";
        let fguild_channels = await fetchedguild.channels.fetch();
        let channelsArray = Array.from(fguild_channels.values());
        channelsArray.sort((a, b) => {
          // If both channels have the same parentId, sort based on rawPosition
          if (a.parentId === b.parentId) {
            return a.rawPosition - b.rawPosition;
          }

          // If b has a parentId and it matches a's id, put b after a
          if (b.parentId === a.id) {
            return -1;
          }

          // If a has a parentId and it matches b's id, put a after b
          if (a.parentId === b.id) {
            return 1;
          }

          // Otherwise, sort based on rawPosition
          return a.rawPosition - b.rawPosition;
        });
        channelsArray.forEach((channel) => {
          if (channel.type == 4) {
            guild_info = guild_info + "\n\n" + `${channel.name}`;
          } else if (channel.type == 2) {
            guild_info =
              guild_info +
              "\n 𝄞 " +
              `${channel.name}` +
              `, ${channel.type}` +
              `   *${channel.id}*`;
          } else {
            guild_info =
              guild_info +
              "\n ◦ " +
              `${channel.name}` +
              `, ${channel.type}` +
              `   *${channel.id}*`;
          }
        });
      }

      const newEmbed = new discordjs.EmbedBuilder()
        .setColor("#DC143C")
        .setTitle(foundguild.name)
        .setDescription(guild_info.substring(0, 4096));

      mchannel.send({
        content: "",
        embeds: [newEmbed],
      });
    } else {
      mchannel.send({
        content: "```js\nguild not found\n```",
      });
    }
    //
  } else if (message.content == cmdprefix + "servers") {
    const guilds = await client.guilds.fetch();
    let desctxt = "";
    let count = 0;
    guilds.forEach((guild) => {
      count += 1;
      desctxt = desctxt + `[${guild.features.length}] ${guild.name} ` + "`" + guild.id + "`\n";
    });
    const newEmbed = new discordjs.EmbedBuilder()
      .setColor("#DC143C")
      .setTitle(`[feature count] ${count} guilds`)
      .setDescription(desctxt.substring(0, 4096));
    
    mchannel.send({
      content: "",
      embeds: [newEmbed],
    });
    //
  } else if (words[0] == cmdprefix + "replyc" && words[2]) {
    const channel = await client.channels.fetch(words[1].replace(/\D/g, ""));
    if (channel) {
      const messages = await channel.messages.fetch({ limit: 2 });
      const latestMessage = messages.last();
      const txt = words.slice(2).join(" ");
      channel.sendTyping();
      setTimeout(async () => {
        await latestMessage.reply(txt);
      }, 4 * 1000);
    } else {
      await message.reply(`no channel found`);
    }
  }
}

module.exports = {
  handle_cmds,
  pass_exports,
};
