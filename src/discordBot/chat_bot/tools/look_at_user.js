const { findMember } = require('../helpers.js');

const DAY_MS = 86400000;

module.exports = {
    schema: {
        description: "look up someone in this server: their roles, how long they have been here, and what they are doing right now.",
        parameters: {
            type: "object",
            properties: { name: { type: "string", description: "their username or nickname" } },
            required: ["name"]
        }
    },

    // Presence and the member list are both privileged intents, and this bot has them, so
    // "what are they playing right now" is answerable here when it usually is not.
    run: async ({ name }, ctx) => {
        const guild = ctx.message?.guild;
        if (!guild) return "there is no server here, this is a dm";

        if (!String(name || "").trim()) return "who am i looking up?";

        try {
            const member = await findMember(guild, name);
            if (!member) return `nobody here goes by ${name}`;

            const activities = member.presence?.activities || [];
            const info = {
                user: member.user.username,
                nickname: member.nickname,
                bot: member.user.bot || undefined,
                top_role: member.roles.highest.name !== "@everyone" ? member.roles.highest.name : undefined,
                roles: member.roles.cache.filter((r) => r.name !== "@everyone").map((r) => r.name).slice(0, 8),
                status: member.presence?.status || "offline or invisible",
                doing: activities.length
                    ? activities.map((a) => [a.name, a.details, a.state].filter(Boolean).join(" - ")).join(" | ")
                    : undefined,
                member_for_days: member.joinedTimestamp
                    ? Math.floor((Date.now() - member.joinedTimestamp) / DAY_MS)
                    : undefined,
                account_age_days: Math.floor((Date.now() - member.user.createdTimestamp) / DAY_MS)
            };

            for (const k of Object.keys(info)) {
                if (info[k] === undefined || (Array.isArray(info[k]) && !info[k].length)) delete info[k];
            }
            return JSON.stringify(info);
        } catch (err) {
            return `could not look them up: ${err.message}`;
        }
    }
};
