module.exports = {
  name: 'replyc',
  aliases: [],
  adminOnly: false,

  execute: async ({ message, client }) => {
    const words = message.content.trim().split(/\s+/);
    const channel = await client.channels.fetch(words[1]?.replace(/\D/g, '') || '');
    const txt = words.slice(2).join(' ');

    if (channel && txt) {
      const messages = await channel.messages.fetch({ limit: 2 });
      const latestMessage = messages.last();
      await channel.sendTyping();
      setTimeout(async () => {
        try {
          await latestMessage.reply(txt);
        } catch (error) {
          console.error('[replyc] failed:', error);
        }
      }, 4 * 1000);
    } else {
      await message.reply(`no channel found`);
    }
  },
};
