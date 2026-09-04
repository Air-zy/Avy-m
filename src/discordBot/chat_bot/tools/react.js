module.exports = {
    schema: {
        description: "react to what was just said with an emoji.",
        parameters: {
            type: "object",
            properties: { emoji: { type: "string", description: "one emoji, or a server one as <:name:id>" } },
            required: ["emoji"]
        }
    },

    // Always the message that started this turn -- the last thing she read, never her own
    // reply. Adding a reaction needs the permission but no intent; only receiving them
    // would need GuildMessageReactions.
    run: async ({ emoji }, ctx) => {
        const target = ctx.message;
        if (!target?.react) return "nothing to react to";

        const e = String(emoji || "").trim();
        if (!e) return "no emoji given";

        try {
            await target.react(e);
            return `reacted ${e}`;
        } catch (err) {
            // Unknown Emoji means it is not one this server can use, which is worth
            // saying: a server emoji from somewhere else looks fine and never works.
            return `could not react with that: ${err.message}`;
        }
    }
};
