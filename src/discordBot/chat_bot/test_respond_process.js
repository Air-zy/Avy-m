// node --env-file=.env src/discordBot/chat_bot/test_respond_process.js
// Drives real turns through respond_process with a stubbed llama-server stream.
const assert = require('assert');
const { respond_process } = require('./respond_process.js');
const { recall, forget } = require('./tool_memory.js');

const frame = (o) => `data: ${JSON.stringify(o)}\n\n`;
const say = (t) => frame({ choices: [{ delta: { content: t } }] });
const think = (t) => frame({ choices: [{ delta: { reasoning_content: t } }] });
const call = (name) => frame({ choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name, arguments: "{}" } }] } }] });
const DONE = "data: [DONE]\n\n";

// Each round is one canned response; returns what was POSTed and what reached the channel.
async function turn(rounds) {
    const requests = [];
    let n = 0;

    global.fetch = async (_url, opts) => {
        requests.push(JSON.parse(opts.body));
        const bytes = new TextEncoder().encode(rounds[n++].join(""));
        let i = 0;
        return {
            ok: true, status: 200,
            body: { getReader: () => ({ read: async () => i >= bytes.length ? { done: true } : { done: false, value: bytes.slice(i, (i += 9)) } }) }
        };
    };

    const sent = [];
    const message = {
        id: "m1",
        channel: { id: "chan1", send: async (p) => sent.push(p.content), sendTyping: async () => {} },
        author: { username: "airzy", globalName: "airzy", bot: false },
        createdTimestamp: Date.now()
    };

    await respond_process(message, [{ role: "system", content: "sys" }], {});
    return { requests, sent };
}

(async () => {
    // what she says before reaching for a tool has to survive into the next round, or she
    // re-announces it every time -- and the `avy:` prefix must not survive with it
    let { requests, sent } = await turn([
        [think("they want the channel"), say("avy: lemme check"), call("nope"), DONE],
        [say("avy: nothing there"), DONE]
    ]);

    const assistant = requests[1].messages.find((m) => m.role === "assistant");
    assert.strictEqual(assistant.content, "lemme check");
    // the thinking behind the call rides along, or the next round cannot see why it ran
    assert.strictEqual(assistant.reasoning_content, "they want the channel");
    assert.strictEqual(assistant.tool_calls[0].function.name, "nope");
    assert.strictEqual(requests[1].messages.at(-1).role, "tool");
    assert.deepStrictEqual(sent, ["lemme check", "nothing there"]);

    // the same tool with the same args twice in a turn is a loop, not a question: the
    // second call is answered from the first result, with a nudge to stop
    ({ requests } = await turn([
        [call("nope"), DONE],
        [call("nope"), DONE],
        [say("avy: fine"), DONE]
    ]));

    const [first, second] = requests[2].messages.filter((m) => m.role === "tool");
    assert.strictEqual(first.content, "there is no tool called nope");
    assert.ok(second.content.startsWith(first.content), "repeat must return the cached result");
    assert.ok(second.content.includes("already called nope"), "repeat must carry the nudge");
    // a tool call has to outlive its turn: Discord never saw it, so tool_memory is the
    // only thing standing between avy and forgetting she ran anything at all
    forget("chan1");
    await turn([
        [think("check who is asking"), call("nope"), DONE],
        [think("nothing came back"), say("avy: nothing there"), DONE]
    ]);

    const kept = recall("chan1", new Set(["m1"]));
    const { entries, finalReasoning } = kept.get("m1");
    const [storedCall, storedResult] = entries;
    assert.strictEqual(storedCall.tool_calls[0].function.name, "nope");
    // thinking is kept: this template renders prior turns' reasoning, it does not drop it
    assert.strictEqual(storedCall.reasoning_content, "check who is asking");
    assert.strictEqual(finalReasoning, "nothing came back");
    assert.strictEqual(storedCall.content, "", "her words are already in Discord, do not store them twice");
    assert.strictEqual(storedResult.role, "tool");
    assert.ok(storedResult.content.length <= 400);

    // and it goes when the message that caused it drops out of the window
    assert.strictEqual(recall("chan1", new Set(["something-else"])).size, 0);
    assert.strictEqual(recall("chan1", new Set(["m1"])), null, "pruned to nothing means the channel is dropped");

    console.log("ok");
    process.exit(0);
})();
