const MAX_DISCORD = 2000;

module.exports = {
    schema: {
        description: "rewrite your own last message. replaces it entirely.",
        parameters: {
            type: "object",
            properties: { text: { type: "string", description: "the new message text" } },
            required: ["text"]
        }
    },

    // Fetched fresh rather than read from message_cache: the cache is filled at the top of
    // a turn, so a message she sent moments ago during this same turn is not in it yet.
    run: async ({ text }, ctx) => {
        const channel = ctx.message?.channel;
        const me = ctx.message?.client?.user;
        if (!channel?.messages || !me) return "cannot reach discord right now";

        const body = String(text || "").trim().slice(0, MAX_DISCORD);
        if (!body) return "nothing to say, give me the new text";

        try {
            const recent = await channel.messages.fetch({ limit: 25 });
            const mine = recent.find((m) => m.author?.id === me.id && m.editable);
            if (!mine) return "nothing of mine to edit here";

            await mine.edit(body);
            return `edited it to: ${body}`;
        } catch (err) {
            return `could not edit that: ${err.message}`;
        }
    }
};
