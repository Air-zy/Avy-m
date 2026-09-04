module.exports = {
    schema: {
        description: "get info about and the current channel/server, users nickname, and data and time.",
        parameters: { type: "object", properties: {}, required: [] }
    },

    // Required inside run, not at the top: build_history reads sysprompt from avyai, and
    // avyai loads this registry, so a load-time require here leaves one of the two with a
    // half-built module. By first call everything is loaded and the cache makes it free.
    run: (_args, ctx) => JSON.stringify(require('../build_history.js').buildEnvInfo(ctx.message))
};
