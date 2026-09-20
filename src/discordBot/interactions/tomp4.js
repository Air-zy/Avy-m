const { AttachmentBuilder } = require("discord.js");
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

const MAX_BYTES = 10 * 1024 * 1024; // discord's floor upload cap (non-boosted guild / DM)

// the CDN 403s intermittently with a 30-byte "An error occurred (code: 1-4)." body,
// and AttachmentBuilder(url) makes discord.js upload those 30 bytes named .mp4.
// so fetch it here, check the status, and only then hand over the bytes.
async function fetchVideo(url) {
  let err = 'no response';
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await new Promise(r => setTimeout(r, 1500));

    const res = await fetch(url).catch((e) => { err = String(e); return null; });
    if (!res) continue;
    if (!res.ok) {
      err = res.status + ' ' + (await res.text().catch(() => '')).slice(0, 200);
      continue;
    }

    const len = Number(res.headers.get('content-length'));
    if (len > MAX_BYTES) return [null, len];

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return [null, buf.length];
    return [buf, null];
  }
  return [null, err];
}

module.exports = async (interaction, client) => {
  const url = interaction.options.getString('url');
  if (url == null) { return; }

  await interaction.reply({ content: "downloading..." });
  const [mp4videoUrl, errMsg] = await downloadAny(url);
  if (!mp4videoUrl) {
    await interaction.editReply({ content: "url not found sorry!\n" + toText(errMsg) });
    return;
  }

  const [video, failed] = await fetchVideo(mp4videoUrl);
  if (!video) {
    // too big to buffer on a 1GB box, so hand over the link instead of dying
    await interaction.editReply({
      content: typeof failed === 'number'
        ? `too big for discord (${(failed / 1048576).toFixed(1)}MB), here:\n` + mp4videoUrl
        : "download failed sorry!\n" + toText(failed)
    });
    return;
  }

  await interaction.editReply({ content: "sending..." });
  await interaction.editReply({
    content: "",
    files: [new AttachmentBuilder(video, { name: `${Date.now()}.mp4` })]
  });
};

module.exports.fetchVideo = fetchVideo;
