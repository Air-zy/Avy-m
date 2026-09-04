const fs = require('node:fs');

const animodule = require('../../anigen.js');

const configData = JSON.parse(fs.readFileSync('src/discordBot/json_storage/configs.json'));
const imgnamewatermark = configData[0].img_name_stamp;

// avy's appearance, so "draw me"/"draw avy" produces her rather than a random girl.
const AVY_TAGS = "1girl, blonde hair, red eyes";

module.exports = {
    schema: {
        description: "only to draw image. comma separated tags.",
        parameters: {
            type: "object",
            properties: { tags: { type: "string", description: "comma separated danbooru tags" } },
            required: ["tags"]
        }
    },

    run: async ({ tags }, ctx) => {
        const prompt = String(tags || "")
            .replace(/_/g, " ")
            .replace(/\bmyself\b/gi, AVY_TAGS)
            .replace(/\bavy\b/gi, AVY_TAGS)
            .replace(/\bme\b/gi, AVY_TAGS)
            .trim();

        if (!prompt) return "nothing drawn, no tags were given";

        // anigen takes seconds. Awaiting it here would stall the follow-up turn behind
        // it, so it runs alongside and the turn collects it before returning. The model is
        // told the image is on its way rather than that it landed, because at this point
        // that is the only true statement.
        ctx.defer((async () => {
            try {
                const img = await animodule.generate(prompt, false);

                if (typeof img !== "object") {
                    await ctx.send({ content: "[image failed]" });
                    return;
                }

                await ctx.send({
                    files: [{
                        attachment: img.msg,
                        content_type: "image/png",
                        name: prompt.substring(0, 64) + imgnamewatermark + ".png"
                    }]
                });
            } catch (err) {
                console.error("[anigen failed]", err);
                await ctx.send({ content: "[image failed]" });
            }
        })());

        return "the image is rendering and will appear in the channel in a moment";
    }
};
