const fs = require('node:fs');

const animodule = require('../../anigen.js');
const { getWindow } = require('../message_cache.js');

const configData = JSON.parse(fs.readFileSync('src/discordBot/json_storage/configs.json'));
const imgnamewatermark = configData[0].img_name_stamp;

// The space downloads the url itself, so whatever we hand it has to still be reachable.
// Discord attachment links are signed and expire, which is why this only ever looks at
// the recent window rather than reaching further back for an older picture.
function imageUrlFrom(msg) {
    const attachment = msg.attachments?.find?.((a) => a.contentType?.startsWith("image/"));
    if (attachment) return attachment.url;

    for (const embed of msg.embeds || []) {
        const img = embed.data?.image || embed.data?.thumbnail;
        if (img) return img.proxy_url || img.url;
    }
    return null;
}

module.exports = {
    schema: {
        description: "change an image someone already posted, or one you already drew. describe the change, not the whole picture.",
        parameters: {
            type: "object",
            properties: {
                instruction: {
                    type: "string",
                    description: "the change to make, e.g. 'recolor the jacket to matte black'"
                }
            },
            required: ["instruction"]
        }
    },

    run: async ({ instruction }, ctx) => {
        const change = String(instruction || "").trim();
        if (!change) return "nothing edited, no instruction was given";

        // the triggering message first: someone attaching a picture and asking for a
        // change is the common case, and it may not be in the cached window yet.
        let url = ctx.message ? imageUrlFrom(ctx.message) : null;

        if (!url && ctx.message?.channel) {
            const recent = await getWindow(ctx.message.channel);   // newest first
            for (const msg of recent) {
                url = imageUrlFrom(msg);
                if (url) break;
            }
        }

        if (!url) return "there is no recent image here to edit";

        // same reasoning as draw: this takes seconds, so it runs alongside the turn.
        ctx.defer((async () => {
            try {
                const img = await animodule.editImg(url, change);
                await ctx.send({
                    files: [{
                        attachment: img.msg,
                        content_type: "image/png",
                        name: change.substring(0, 64) + imgnamewatermark + ".png"
                    }]
                });
            } catch (err) {
                console.error("[edit_img failed]", err);
                await ctx.send({ content: `[edit failed: ${String(err.message).slice(0, 180)}]` });
            }
        })());

        return "the edit is rendering and will appear in the channel in a moment";
    }
};
