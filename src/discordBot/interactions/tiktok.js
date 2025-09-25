const downloadAny = require("../modules/downloadAny.js");
const {TikTokSearch, Base62} = require("../modules/tiktokSearch.js");

module.exports = async (interaction, client) => {
    const search = interaction.options.getString('search');
    if (search == null) { return; }
    
    const channel = await client.channels.fetch(interaction.channelId);
    if (channel) {
      console.log("channel found")
      await interaction.deferReply();

      let maNames = [];
      
      let prevmessages = await channel.messages.fetch({ limit: 100 });
      prevmessages.forEach((msg) => {
        if (msg.author.id == client.user.id) {
          if (msg.attachments.size > 0) {
            msg.attachments.forEach((mattach) => {
              let maName =  mattach.name.split('.')[0]
              maNames.push(maName);
            })
          }
        }
      })
      
      let contentmsg = "downloading...";
      
      const base62 = new Base62();
      const results = await TikTokSearch(search, 1)
      if (results) {
        for (const elm of results) {
            const item = elm.item
            if (item) {
            const formedUrl = `https://www.tiktok.com/@${item.author.uniqueId}/video/${item.video.id}`
            const encodedId = base62.encode(Number(item.video.id));
            if (maNames.includes(encodedId)) {
                continue;
            }

            console.log("using:", formedUrl)
            
            await interaction.editReply({ content: contentmsg });
            const mp4videoUrl = await downloadAny(formedUrl);
            if (mp4videoUrl) {
                await interaction.editReply({ content: "sending..." });
                const response = await fetch(mp4videoUrl);
                return await interaction.editReply({
                    content: "",
                    files: [{
                    attachment: response.url,
                    content_type: 'video/mp4',
                    name: `${encodedId}.mp4`
                    }]
                });
            }
            }
        }
      } else {
        interaction.editReply({
          content: "no results sorry!",
        })
      }
    } else {
      interaction.editReply({
        content: "could not find our interaction channel sorry!",
      })
    }
};
