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
        Partials.Channel
    ]
});

client.on('ready', async () => {
  console.log(`[SUCCESS login] ${client.user.tag}!`);

  await client.user.setPresence({ 
    activities: [{ 
      name: "hi", // The name of the activity
      type: 1, // 0playing 1streaming 2listening 3watching 4custom 5competing
      state: "hi",
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
      if (error && error.stack && error.message){
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply("```js\nCMD err: " + err + '```');
        } else {
          await interaction.reply("```js\nCMD err: " + err + '```');
        }
      } else {
        await interaction.reply("```js\nCMD err: " + err + '```')
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

const onMsgCreate = require('./onMsgCreate.js')
client.on("messageCreate", (message) => onMsgCreate(client, message));

const chatbot_mod = require("./chat_bot/chatbot_module.js");
chatbot_mod.pass_exports(client, PermissionsBitField);

const cmd_funcs = require("./msg_cmds.js");
cmd_funcs.pass_exports(client, discordjs, PermissionsBitField)

async function loginAvy() {
    console.log("[STARTED] avy login")
    client.login(envDecrypt(process.env.avyKey, process.env.dToken));
}

module.exports = { loginAvy };
