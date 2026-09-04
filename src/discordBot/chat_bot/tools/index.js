const fs = require('node:fs');
const path = require('node:path');

// One file per tool, filename = tool name, exporting { schema, run }. Sorted because
// readdir order is not guaranteed and these are rendered into the cached system prefix:
// a reshuffle would invalidate it and cost a full prompt-eval. See avyai's TOOLS comment.
const tools = Object.fromEntries(
    fs.readdirSync(__dirname)
        .filter((f) => f.endsWith('.js') && f !== 'index.js')
        .sort()
        .map((f) => [path.basename(f, '.js'), require(path.join(__dirname, f))])
);

const TOOLS = Object.entries(tools).map(([name, t]) => ({
    type: 'function',
    function: { name, ...t.schema }
}));

// ctx is what a tool gets besides its args: { message, send, defer }. send() marks the
// channel as having heard something; defer() hands back a promise the turn waits on.
function runTool(name, args, ctx) {
    const tool = tools[name];
    if (!tool) return `there is no tool called ${name}`;
    return tool.run(args, ctx);
}

module.exports = { TOOLS, runTool };
