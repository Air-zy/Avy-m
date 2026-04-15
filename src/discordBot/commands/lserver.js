module.exports = {
  name: 'lserver',
  aliases: [],
  adminOnly: true,

  execute: async ({ message, client }) => {
    const mchannel = message.channel;
    const words = message.content.trim().split(/\s+/);
    const searchId = words[1]?.replace(/\D/g, '');

    if (!searchId) {
      await mchannel.send(`guild not found`);
      return;
    }

    const guilds = await client.guilds.fetch();
    let foundGuild;

    guilds.forEach((guild) => {
      if (String(guild.id) === String(searchId)) {
        foundGuild = guild;
      }
    });

    if (foundGuild) {
      const fetchedGuild = await client.guilds.fetch(searchId);
      await fetchedGuild.leave();
      await mchannel.send(`successfully left the server`);
    } else {
      await mchannel.send(`guild not found`);
    }
  },
};
