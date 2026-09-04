const { findMember } = require('../helpers.js');
const { mute } = require('../mutes.js');

module.exports = {
    schema: {
        description: "mute someone for yourself",
        parameters: {
            type: "object",
            properties: {
                username: { type: "string", description: "who to stop reading" },
                minutes: { type: "number", description: `how long` }
            },
            required: ["username", "minutes"]
        }
    },

    run: async ({ username, minutes }, ctx) => {
        const guild = ctx.message?.guild;

        try {
            // In a dm there is exactly one person she could stop reading, and it is
            // whoever is talking, so the name is not worth matching against anything.
            const target = guild
                ? (await findMember(guild, username))?.user
                : ctx.message?.author;

            if (!target) return `nobody here goes by ${username}`;
            if (target.id === ctx.message.client?.user?.id) return "cannot stop reading myself";

            const mins = mute(target.id, minutes);
            return `not reading ${target.username} for ${mins} minutes`;
        } catch (err) {
            return `could not do that: ${err.message}`;
        }
    }
};
