const { generate, buildInputData, beginTurn, endTurn } = require('./avyai.js');
const { runTool } = require('./tools');
const { remember } = require('./tool_memory.js');
const { filterDiscordName, stripAvyPrefix } = require('./helpers.js');

// Room for a real chain: search, read, run something on the result, retry a tool that
// errored. The turn holds the channel for all of it, so this is also the worst-case time
// avy ignores everyone else -- 10 rounds of generate + a 15s run_code is a few minutes.
const MAX_TOOL_ROUNDS = 10;

async function respond_process(message, history, client) {
    const mChannel = message.channel;
    const msgUserName = filterDiscordName(message.author);

    let pending = "";
    let didSend = false;
    let insideFence = false;
    let fenceBuffer = "";

    let sendQueue = Promise.resolve();
    const artwork = [];      // in-flight anigen jobs, collected before returning

    const enqueue = (task) => {
        sendQueue = sendQueue.then(task).catch((e) => console.error(e));
        return sendQueue;
    };

    const sendText = async (content) => {
        const text = stripAvyPrefix(content)
            .replace(/\banon\b/gi, msgUserName)
            .trimEnd();

        if (!text) return;
        didSend = true;

        if (text.length <= 2000) {
            await mChannel.send({ content: text });
            return;
        }

        for (let i = 0; i < text.length; i += 1900) {
            await mChannel.send({ content: text.slice(i, i + 1900) });
        }
    };

    const MIN_LINE_SEND = 40;
    let currentLineBuffer = "";

    const processPendingLines = async () => {
        while (true) {
            const nl = pending.indexOf("\n");
            if (nl === -1) break;

            const line = pending.slice(0, nl);
            pending = pending.slice(nl + 1);

            if (!insideFence) {
                if (/^\s*```/.test(line)) {
                    if (currentLineBuffer.trim().length > 0) {
                        await sendText(currentLineBuffer);
                        currentLineBuffer = "";
                    }
                    insideFence = true;
                    fenceBuffer = line + "\n";
                    continue;
                }

                currentLineBuffer += (currentLineBuffer ? "\n" : "") + line;

                if (currentLineBuffer.length >= MIN_LINE_SEND || line.trim() === "") {
                    await sendText(currentLineBuffer);
                    currentLineBuffer = "";
                }
            } else {
                fenceBuffer += line + "\n";

                if (/^\s*```/.test(line)) {
                    insideFence = false;
                    await sendText(fenceBuffer.trimEnd());
                    fenceBuffer = "";
                }
            }
        }
    };

    const finalizePending = async () => {
        if (pending.length > 0) {
            if (!insideFence) {
                if (/^\s*```/.test(pending)) {
                    insideFence = true;
                    fenceBuffer = pending + "\n";
                } else {
                    await sendText(pending);
                }
            } else {
                fenceBuffer += pending;
            }
            pending = "";
        }

        if (currentLineBuffer.trim().length > 0) {
            await sendText(currentLineBuffer);
            currentLineBuffer = "";
        }

        if (insideFence && fenceBuffer) {
            await sendText(fenceBuffer.trimEnd());
            fenceBuffer = "";
            insideFence = false;
        }
    };

    // Typing starts immediately rather than on the first text delta: a turn that opens
    // with a tool call emits no content at all, and the model reasons for ~10s when it
    // decides to, so waiting for a delta left the channel looking dead. Discord's
    // indicator lapses after ~10s, hence the repeat.
    const showTyping = () => mChannel.sendTyping?.().catch(() => {});
    showTyping();
    const typingTimer = setInterval(showTyping, 8000);

    // generate() gates the ATEM markup out of onDelta, so whatever arrives here is
    // already user-safe text and can go straight into the line buffer.
    const streamTurn = async (messages) => {
        let toolCalls = [];
        let finalText = "";
        let reasoning = "";

        await generate(buildInputData(messages), {
            onDelta: (chunk) => {
                pending += chunk;
                enqueue(processPendingLines);
            },

            onFinal: (text, calls, thoughts) => {
                finalText = text;
                toolCalls = calls || [];
                reasoning = thoughts || "";
            },

            onError: async (err) => {
                const status =
                    err?.status ||
                    err?.statusCode ||
                    err?.response?.status ||
                    "???";

                await mChannel.send({ content: `error :( (${status})` });
            }
        });

        await sendQueue;
        await finalizePending();
        return { finalText, toolCalls, reasoning };
    };

    // What a tool gets besides its args. send() goes through didSend so a turn that
    // only posted an image is not followed by the "that broke" fallback; defer() hands
    // back work the turn waits on before returning (anigen takes seconds).
    const toolCtx = {
        message,
        send: async (payload) => { didSend = true; await mChannel.send(payload); },
        defer: (p) => artwork.push(p)
    };

    beginTurn();
    try {
        const messages = [...history];
        const alreadyCalled = new Map();   // tool+args seen this turn, see the loop below
        const turnTrace = [];              // the same calls, kept for the turns after this
        let finalReasoning = "";           // the thinking behind the reply she ended on

        for (let round = 0; ; round++) {
            const { finalText, toolCalls, reasoning } = await streamTurn(messages);
            if (!toolCalls.length) {
                finalReasoning = reasoning;
                break;
            }

            // Out of rounds but it still wants a tool: stop here rather than let a
            // confused model loop on the channel.
            if (round >= MAX_TOOL_ROUNDS) {
                console.warn("[tool rounds exhausted]", toolCalls.map((c) => c.function?.name).join(","));
                break;
            }

            // Whatever she said before reaching for the tool goes in with the call, and so
            // does the thinking behind it. Dropping either left the next round looking at
            // an empty assistant turn with no idea why the tool was called -- she just
            // called it again. Reasoning stays inside the turn: the next turn rebuilds
            // history from Discord, which is where it should end.
            messages.push({
                role: "assistant",
                content: stripAvyPrefix(finalText),
                ...(reasoning ? { reasoning_content: reasoning } : {}),
                tool_calls: toolCalls
            });
            turnTrace.push({
                role: "assistant",
                content: "",
                ...(reasoning ? { reasoning_content: reasoning } : {}),
                tool_calls: toolCalls
            });

            for (const call of toolCalls) {
                const name = call.function?.name;
                let args = {};
                try {
                    args = JSON.parse(call.function?.arguments || "{}");
                } catch (e) {
                    console.warn("[tool args unparseable]", name, call.function?.arguments);
                }

                // A model that learns nothing new from a tool will keep calling it with
                // the same args until the round cap -- the transcript by then is
                // call/result/call/result with no prose, which is a pattern it just
                // continues. The result cannot differ, so hand back the one it already
                // has with a nudge rather than burning a round re-running the tool.
                const key = `${name}(${call.function?.arguments || "{}"})`;
                const repeat = alreadyCalled.has(key);
                const result = repeat
                    ? `${alreadyCalled.get(key)}\n\n(you already called ${name} this turn. this is the same result. answer ${msgUserName} now.)`
                    : await runTool(name, args, toolCtx);

                if (!repeat) alreadyCalled.set(key, String(result));

                console.log(`toolcall_${name}(${call.function?.arguments || "{}"}):`, String(result).slice(0, 500));
                const toolMsg = { role: "tool", tool_call_id: call.id, name, content: result };
                messages.push(toolMsg);
                turnTrace.push(toolMsg);
            }
        }

        // Anchored to the message that started the turn, so it lands back in the right
        // place next time and ages out with it. See tool_memory.
        remember(mChannel.id, message.id, turnTrace, finalReasoning);

        // A turn that only ever produced tool calls would leave the channel silent.
        // the model's reply lands first; the image follows when anigen is done
        await Promise.allSettled(artwork);
        if (!didSend) await sendText("that broke, try again");
    } finally {
        clearInterval(typingTimer);
        endTurn();
    }
}

module.exports = { respond_process };
