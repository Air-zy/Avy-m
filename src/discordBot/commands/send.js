module.exports = {
  name: 'send',
  aliases: ['dm'],
  adminOnly: false,

  execute: async ({ message, client, Permissions }) => {
    const words = message.content.trim().split(/\s+/);
    const mchannel = message.channel;

    const recipientId = words[1]?.replace(/\D/g, '');
    const txt = words.slice(2).join(' ');

    if (!recipientId || !txt) {
      await mchannel.send(`usage: ${words[0]} <user> <text>`);
      return;
    }

    let recipient;
    try {
      recipient = await client.users.fetch(recipientId);
    } catch (error) {
      await mchannel.send(`user not found`);
      return;
    }

    const foundChannel = await recipient.createDM();

    if (foundChannel?.permissionsFor) {
      const botPermissions = foundChannel.permissionsFor(client.user);
      if (!botPermissions?.has(Permissions.Flags.SendMessages)) {
        console.log('[Chatbot Err 2] cannot sent msg in channel ', foundChannel.name);
        return;
      }
    }

    await foundChannel.send(txt);
    if (mchannel?.permissionsFor) {
      const botPermissions = mchannel.permissionsFor(client.user);
      if (botPermissions?.has(Permissions.Flags.SendMessages)) {
        await mchannel.send(`sent to <@${recipientId}>`);
      } else {
        console.log('[Chatbot Err 3] cannot sent msg in channel ', mchannel.name);
      }
    }
  },
};
