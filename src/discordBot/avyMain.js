const envDecrypt = require('../envDecrypt.js');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
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
      state: "🔧 under maintenance",
    }],
    status: 'dnd'
    // online
    // dnd
    // idle
  });

  const registeredCmds = await client.application.commands.fetch();
  for (const registeredCmd of registeredCmds.values()) {
    console.log(`[DISCORD BOT] {removed ${registeredCmd.name}} command`);
      await registeredCmd.delete();
  }
})

client.on('error', error => {
    console.log('[DISCORD BOT] api error:', error);
});

client.on('warn', info => {
    console.log('[DISCORD BOT] api warn:', info);
});

const { setup } = require('./mobilePresence.js')
async function loginAvy() {
    console.log("[STARTED] avy login")
    await setup();
    client.login(envDecrypt(process.env.avyKey, process.env.dToken));
}

module.exports = { loginAvy };
