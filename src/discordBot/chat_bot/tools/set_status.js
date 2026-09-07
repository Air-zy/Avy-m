const { ActivityType } = require('discord.js');

// Discord truncates past this anyway, and a status is a line, not a paragraph.
const MAX_STATUS = 128;

module.exports = {
    schema: {
        description: "set your own discord status text (everyone can see this). empty text clears it. use this randomly for fun",
        parameters: {
            type: "object",
            properties: { text: { type: "string", description: "use a short but silly message" } },
            required: ["text"]
        }
    },

    // ActivityType.Custom is the only one that shows a bare line rather than "Playing X",
    // and for Custom it is `state` that renders -- `name` is required by the API and then
    // ignored. Presence lives on the gateway session, so this is gone on the next restart.
    run: async ({ text }, ctx) => {
        const user = ctx.message?.client?.user;
        if (!user) return "cannot reach discord right now";

        const status = String(text || "").replace(/\s+/g, " ").trim().slice(0, MAX_STATUS);

        try {
            if (!status) {
                user.setActivity(null);
                return "status cleared";
            }

            user.setActivity({ name: "Custom Status", type: ActivityType.Custom, state: status });
            return `status is now: ${status}`;
        } catch (e) {
            return `could not set status: ${e.message}`;
        }
    }
};
