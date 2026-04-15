module.exports = {
  name: 'inviteme',
  aliases: [],
  adminOnly: true,

  execute: async ({ message, client }) => {
    const mchannel = message.channel;
    const words = message.content.trim().split(/\s+/);
    const searchId = words[1]?.replace(/\D/g, '');

    if (!searchId) {
      await mchannel.send(`channel not found`);
      return;
    }

    const foundChannel = await client.channels.fetch(searchId);
    if (foundChannel) {
      const invite = await foundChannel.createInvite({
        maxAge: 86400,
        maxUses: 1,
        temporary: false,
        unique: true,
      });
      await mchannel.send(`Invite link: ${invite.url}`);
    } else {
      await mchannel.send(`channel not found`);
    }
  },
};
