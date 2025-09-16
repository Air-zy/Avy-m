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
      name: "under maintenance", // The name of the activity
      type: 4, // 0playing 1streaming 2listening 3watching 4custom 5competing
      state: "reconstruction",
    }],
    status: 'online'
    // online
    // dnd
    // idle
  });

  const registeredCmds = await client.application.commands.fetch();
  const commands = JSON.parse(fs.readFileSync('src/discordBot/json_storage/discordCmds.json'));

  for (const cmd of commands) {
    const exists = registeredCmds.some(registeredCmd => registeredCmd.name === cmd.name);
    if (!exists) {
      console.log(`[DISCORD BOT] {registered ${cmd.name}} command`);
      await client.application.commands.create(cmd);
    }
  }
  
  for (const registeredCmd of registeredCmds.values()) {
    console.log(`[DISCORD BOT] {removed ${registeredCmd.name}} command`);
    await registeredCmd.delete();
  }

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
  console.log("interaction:", interaction);

  require("./commandName.js")
  if (interaction.commandName == 'ping') {
    await interaction.reply('Pong! 🏓');
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  const commandName = interaction.commandName;

  try {
    const command = require(`./interactions/${commandName}.js`);
    if (command && typeof command === 'function') {
      await command(interaction);
    } else {
      await interaction.reply({
        content: 'cmd exists but (air) is stupid and format it wrong. dm him',
        ephemeral: true
      });
    }
  } catch (err) {
    console.warn(`Command handler for "${commandName}" not found.`);
    await interaction.reply({
      content: 'cmd does not exist',
      ephemeral: true
    });
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

const chatbot_mod = require("./chatbot_module.js");
chatbot_mod.pass_exports(client, PermissionsBitField);

const cmd_funcs = require("./msg_cmds.js");
cmd_funcs.pass_exports(client, discordjs, PermissionsBitField)

const { setup } = require('./mobilePresence.js')
async function loginAvy() {
    console.log("[STARTED] avy login")
    await setup();
    client.login(envDecrypt(process.env.avyKey, process.env.dToken));
}

module.exports = { loginAvy };
