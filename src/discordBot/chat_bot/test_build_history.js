// node --env-file=.env src/discordBot/chat_bot/test_build_history.js
// A remembered tool call has to come back between the message that caused it and the
// reply written from it, or the model reads the answer before the question.
const assert = require('assert');
const { build_history } = require('./build_history.js');
const { remember, forget } = require('./tool_memory.js');

const BOT = "bot-id";
const client = { user: { id: BOT } };

const msg = (id, authorId, content, ts) => ({
    id,
    content,
    createdTimestamp: ts,
    embeds: [],
    attachments: { size: 0, forEach() {} },
    author: { id: authorId, username: authorId, globalName: authorId, bot: authorId === BOT },
    mentions: { users: { size: 0, forEach() {} }, repliedUser: null }
});

(async () => {
    const now = Date.now();
    // newest-first, the order Discord hands them back
    const messages = [
        msg("m3", "airzy", "and now?", now),
        msg("m2", BOT, "peregrine falcon", now - 1000),
        msg("m1", "airzy", "whats the fastest bird", now - 2000)
    ];

    const channel = {
        id: "chanB",
        messages: { fetch: async (opts) => opts.after ? new Map() : new Map(messages.map((m) => [m.id, m])) }
    };

    forget("chanB");
    remember("chanB", "m1", [
        { role: "assistant", content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "web_search", arguments: '{"query":"fastest bird"}' } }] },
        { role: "tool", tool_call_id: "c1", name: "web_search", content: "the peregrine falcon dives at 240mph" }
    ], "they asked for the fastest, the falcon is it");

    const history = await build_history({ channel, createdTimestamp: now }, client);
    const shape = history.map((m) => `${m.role}:${m.tool_calls ? m.tool_calls[0].function.name : (m.content || "").slice(0, 24)}`);

    assert.deepStrictEqual(shape.slice(1), [
        "user:airzy: whats the fastest",
        "assistant:web_search",
        "tool:the peregrine falcon div",
        "assistant:peregrine falcon",
        "user:airzy: and now?"
    ]);

    // the call must not be merged into the message before it, nor the reply after it
    assert.strictEqual(history.filter((m) => m.role === "assistant").length, 2);

    // the thinking behind the reply hangs on the reply, not on a message of its own
    const reply = history.find((m) => m.content === "peregrine falcon");
    assert.strictEqual(reply.reasoning_content, "they asked for the fastest, the falcon is it");
    assert.ok(!history.some((m) => m.reasoning_content && !m.content && !m.tool_calls),
        "a reasoning-only message renders a stray empty turn");
    // The window has to keep the same oldest message from turn to turn, or every token
    // after it moves and llama-server re-evaluates the whole prompt on every message.
    let seq = 5000;
    const store = [];   // newest-first, the shape Discord returns
    const add = (author, text) => { store.unshift(msg(String(seq), author, text, now + seq)); seq++; };
    for (let i = 0; i < 100; i++) add(i % 2 ? BOT : "airzy", `filler ${i}`);

    const busy = {
        id: "chanC",
        messages: {
            fetch: async (opts) => new Map(
                (opts.after ? store.filter((m) => BigInt(m.id) > BigInt(opts.after)) : store.slice(0, 100))
                    .map((m) => [m.id, m])
            )
        }
    };

    const oldest = async () => (await build_history({ channel: busy, createdTimestamp: now }, client))[1].content;

    const first = await oldest();
    add("airzy", "next question");
    add(BOT, "next answer");
    assert.strictEqual(await oldest(), first, "two more messages must not move the window");

    for (let i = 0; i < 20; i++) add("airzy", `chatter ${i}`);
    assert.notStrictEqual(await oldest(), first, "past the slack it snaps forward, once");

    console.log("ok");
})();
