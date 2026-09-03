// node --env-file=.env src/discordBot/chat_bot/test_avyai.js
// Feeds a canned llama-server SSE stream through generate() with a stubbed fetch.
const assert = require('assert');

const sse = (...frames) => ({
    ok: true,
    status: 200,
    body: {
        getReader() {
            // deliberately splits mid-frame to exercise the partial-line buffer
            const bytes = new TextEncoder().encode(frames.join(""));
            let i = 0;
            return {
                read: async () => i >= bytes.length
                    ? { done: true }
                    : { done: false, value: bytes.slice(i, (i += 7)) }
            };
        }
    }
});

const d = (o) => `data: ${JSON.stringify(o)}\n\n`;
const text = (s) => d({ choices: [{ delta: { content: s } }] });

let stub;
global.fetch = async () => stub;

const { generate, buildInputData, sysprompt } = require('./avyai.js');

(async () => {
    // happy path: reasoning + keep-alives + [DONE] are all filtered out
    stub = sse(
        ": keep-alive\n\n",
        d({ choices: [{ delta: { reasoning_content: "should never surface" } }] }),
        text("yo "), text("anon"),
        d({ choices: [{ delta: {}, finish_reason: "stop" }] }),
        "data: [DONE]\n\n"
    );
    const deltas = [];
    assert.strictEqual(await generate({}, { onDelta: (c) => deltas.push(c) }), "yo anon");
    assert.deepStrictEqual(deltas, ["yo ", "anon"]);

    // an error frame must surface, not silently yield an empty reply
    stub = sse(text("partial"), d({ error: { message: "context shift disabled", code: 500 } }));
    await assert.rejects(generate({}), /context shift disabled/);

    // the lock must release after a failure
    stub = sse(text("ok"), "data: [DONE]\n\n");
    assert.strictEqual(await generate({}), "ok");

    // non-2xx carries the status through to respond_process's `error :( (404)`
    stub = { ok: false, status: 404, text: async () => "<!DOCTYPE html>" };
    await assert.rejects(generate({}), (e) => e.status === 404);

    // without this kwarg the template defaults to `high` and replies come back empty
    assert.strictEqual(buildInputData([]).chat_template_kwargs.reasoning_strength, "low");
    // the directive belongs in the kwarg, not smuggled into the persona text
    assert.ok(!sysprompt.toLowerCase().includes("reasoning strength"));
    assert.strictEqual(buildInputData([]).stream, true);

    // DRY replaced the hand-rolled n-gram penalty; this build rejects a negative window,
    // and the 64-token default is too short to reach back into the chat history
    const p = buildInputData([]);
    assert.ok(p.dry_multiplier > 0);
    assert.ok(p.dry_penalty_last_n >= 0 && p.dry_penalty_last_n > 64);
    assert.ok(!("presence_penalty" in p) && !("repeat_penalty" in p));

    // structured tool_calls arrive fragmented: name+id on the first delta only,
    // arguments as string pieces keyed by index
    stub = sse(
        text("avy: bet\n"),
        d({ choices: [{ delta: { tool_calls: [{ index: 0, id: "abc", type: "function", function: { name: "draw", arguments: "{" } }] } }] }),
        d({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"tags":"' } }] } }] }),
        d({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: "cat" } }] } }] }),
        d({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"}' } }] } }] }),
        d({ choices: [{ delta: {}, finish_reason: "tool_calls" }] }),
        "data: [DONE]\n\n"
    );
    let calls;
    assert.strictEqual(await generate({}, { onFinal: (_t, tc) => (calls = tc) }), "avy: bet");
    assert.deepStrictEqual(calls, [{ id: "abc", type: "function", function: { name: "draw", arguments: '{"tags":"cat"}' } }]);

    // the model sometimes emits the call on the user channel, so it arrives as content.
    // It must be recovered as a call, and the markup must never be streamed to Discord.
    const leaked = '<atem:function_calls>\n<atem:invoke name="draw">\n<atem:parameter name="tags">cat, fluffy</atem:parameter>\n</atem:invoke>\n</atem:function_calls>';
    stub = sse(text("avy: here ya go\n"), text(leaked), "data: [DONE]\n\n");
    const seen = [];
    const out = await generate({}, { onDelta: (c) => seen.push(c), onFinal: (_t, tc) => (calls = tc) });
    assert.strictEqual(out, "avy: here ya go");
    assert.ok(!seen.join("").includes("<atem:"), "raw markup reached the channel");
    assert.deepStrictEqual(calls, [{ id: "atem_0", type: "function",
        function: { name: "draw", arguments: '{"tags":"cat, fluffy"}' } }]);

    // a marker split across chunks must not be emitted as half a tag
    stub = sse(text("hi <ate"), text('m:function_calls>\n<atem:invoke name="draw">\n<atem:parameter name="tags">x</atem:parameter>\n</atem:invoke>\n</atem:function_calls>'), "data: [DONE]\n\n");
    const seen2 = [];
    assert.strictEqual(await generate({}, { onDelta: (c) => seen2.push(c) }), "hi");
    assert.ok(!seen2.join("").includes("<ate"), "partial marker reached the channel");

    console.log("ok");
})();
