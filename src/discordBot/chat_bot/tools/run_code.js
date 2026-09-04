const { runCode, formatResult } = require('../code_runner.js');

module.exports = {
    schema: {
        description: "run python3",
        parameters: {
            type: "object",
            properties: { code: { type: "string", description: "python source" } },
            required: ["code"]
        }
    },

    run: async ({ code }) => formatResult(await runCode(String(code || "")))
};
