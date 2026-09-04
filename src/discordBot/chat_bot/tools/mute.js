const { findMember } = require('../helpers.js');
const { mute, MAX_MINUTES } = require('../mutes.js');

module.exports = {
    schema: {
        description: "mute someone for yourself",
        parameters: {
            type: "object",
            properties: {
                username: { type: "string", description: "who to stop reading" },
                minutes: { type: "number", description: `how long, up to ${MAX_MINUTES}` }
            },
            required: ["username", "minutes"]
        }
    },

    run: async ({ username, minutes }, ctx) => {
        const guild = ctx.message?.guild;
        if (!guild) return "there is no server here, this is a dm";

        try {
            const member = await findMember(guild, username);
            if (!member) return `nobody here goes by ${username}`;

            // Muting herself would erase her own side of the history she reads next turn.
            if (member.id === ctx.message.client?.user?.id) return "cannot stop reading myself";

            const mins = mute(member.id, minutes);
            return `not reading ${member.user.username} for ${mins} minutes`;
        } catch (err) {
            return `could not do that: ${err.message}`;
        }
    }
};
