const fs = require('fs');
const envDecrypt = require('../envDecrypt.js');
const discordjs = require("discord.js");
const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  REST,
  Routes
} = discordjs;
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [
    Partials.Channel,
    Partials.GuildMember
  ]
});

client.on('ready', async () => {
  console.log(`[SUCCESS login] ${client.user.tag}!`);

  await client.user.setPresence({
    activities: [{
      name: "new engine c test", // The name of the activity
      type: 4, // https://discord.js.org/docs/packages/discord-api-types/0.38.43/v10/ActivityType:Enum
      state: "new engine c test",
    }],
    //status: 'online'
    // online
    // dnd
    // idle
  });

  const commands = JSON.parse(fs.readFileSync('src/discordBot/json_storage/discordCmds.json'));
  const rest = new REST({ version: '10' }).setToken(
    envDecrypt(process.env.avyKey, process.env.dToken)
  );
  console.log('[DISCORD BOT] syncing global commands...');
  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );
})

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  const commandName = interaction.commandName;
  try {
    const command = require(`./interactions/${commandName}.js`);
    if (command && typeof command === 'function') {
      await command(interaction, client);
    } else {
      await interaction.reply({
        content: 'cmd exists but (air) is stupid and format it wrong. dm him',
        ephemeral: true
      });
    }
  } catch (error) {
    console.warn(`Command handler for "${commandName}" not found.`, error);

    try {
      if (error && error.stack && error.message) {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply("```js\nCMD err: " + error + '```');
        } else {
          await interaction.reply("```js\nCMD err: " + error + '```');
        }
      } else {
        await interaction.reply("```js\nCMD err: " + error + '```')
      }
    } catch (err2) {
      console.log('\n[DISCORD INTER ERROR] ', error)
    }
  }
});

client.on('error', error => {
  console.log('[DISCORD BOT] api error:', error);
});

client.on('warn', info => {
  console.log('[DISCORD BOT] api warn:', info);
});

const statusTracker = require('./modules/statusTracker.js')
const ownerId = envDecrypt(process.env.avyKey, process.env.ownerId)
client.on('presenceUpdate', async (oldPresence, newPresence) => {
  let member = newPresence.member;
  //let status = newPresence.clientStatus
  let normal_status = newPresence.status
  if (member.user.bot == false && member.user.id == ownerId) {
    statusTracker.statusUpd(normal_status)
  }
});

const authorized_users = JSON.parse(
  fs.readFileSync("src/discordBot/json_storage/configs.json")
)[0].authorized_users;

client.on('guildCreate', async (guild) => {
  console.log(`[Discord Bot] added/joined to ${guild.name}`);
  for (const userId of authorized_users) {
    const recipient = await client.users.fetch(userId);
    const found_channel = await recipient.createDM();
    found_channel.send("[SYSTEM] avy added to guild: " + guild.id + "\n" + guild.name)
  }
});

//

const onMsgCreate = require('./onMsgCreate.js')
client.on("messageCreate", (message) => onMsgCreate(client, message));

const chatbot_mod = require("./chat_bot/chatbot_module.js");
chatbot_mod.pass_exports(client, PermissionsBitField);

const cmd_funcs = require("./msg_cmds.js");
cmd_funcs.pass_exports(client, discordjs, PermissionsBitField)

async function initStatusTracker() {
  console.log("starting Status Tracker")
  const rowaGuildID = '1359998909384228864';

  const rowaGuild = await client.guilds.fetch(rowaGuildID).catch(() => null);
  if (!rowaGuild) {
    warn("could not find rowaGuild", rowaGuild)
    return
  }

  const member = await rowaGuild.members.fetch(ownerId).catch(() => null);
  const status = member?.presence?.status;

  if (status) {
    statusTracker.statusUpd(status);
  }

  statusTracker.initTracker();
}

const { startRowaTracker } = require("./rowa/rowaTrack.js"); // load ts
const { warn } = require('console');
async function loginAvy() {
  console.log("[STARTED] avy login")
  startRowaTracker(client)
  client.login(envDecrypt(process.env.avyKey, process.env.dToken));
  initStatusTracker();
}

module.exports = { loginAvy };
