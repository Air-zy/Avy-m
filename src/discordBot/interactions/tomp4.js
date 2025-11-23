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

const downloadAny = require("../modules/downloadAny.js");
module.exports = async (interaction, client) => {
    const url = interaction.options.getString('url');
    if (url == null) { return; }
    
    await interaction.reply({ content: "downloading..." });
    const mp4videoUrl = await downloadAny(url);

    if (mp4videoUrl) {
      await interaction.editReply({ content: "sending..." });
      interaction.editReply({
        content: "",
        files: [{
          attachment: mp4videoUrl,
          content_type: 'video/mp4',
          name: `${Date.now()}.mp4`
        }]
      })
    } else {
      interaction.editReply({
        content: "url not found sorry!" + toText(mp4videoUrl),
      })
    }
};
