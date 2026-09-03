const fs = require('fs');
const configData = JSON.parse(fs.readFileSync('src/discordBot/json_storage/configs.json'));
const imgnamewatermark = configData[0].img_name_stamp;

const animodule = require("../anigen.js");
const { generate, buildInputData, beginTurn, endTurn } = require('./avyai.js');
const { buildEnvInfo } = require('./build_history.js');
const { runCode, formatResult } = require('./code_runner.js');
const { filterDiscordName, filterSentText } = require('./helpers.js');

// avy's appearance, so "draw me"/"draw avy" produces her rather than a random girl.
const AVY_TAGS = "1girl, blonde hair, red eyes";

// Enough for the model to recover when a tool errors -- it usually retries run_code with
// http_get after urllib fails -- without letting it grind the channel.
const MAX_TOOL_ROUNDS = 3;

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
        const text = filterSentText(content || "")
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

        await generate(buildInputData(messages), {
            onDelta: (chunk) => {
                pending += chunk;
                enqueue(processPendingLines);
            },

            onFinal: (_text, calls) => {
                toolCalls = calls || [];
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
        return toolCalls;
    };

    const runDraw = async (tags) => {
        const prompt = String(tags || "")
            .replace(/_/g, " ")
            .replace(/\bmyself\b/gi, AVY_TAGS)
            .replace(/\bavy\b/gi, AVY_TAGS)
            .replace(/\bme\b/gi, AVY_TAGS)
            .trim();

        if (!prompt) return "nothing drawn, no tags were given";

        // anigen takes seconds. Awaiting it here would stall the follow-up turn behind
        // it, so it runs alongside and is collected before respond_process returns. The
        // model is told the image is on its way rather than that it landed, because at
        // this point that is the only true statement.
        artwork.push((async () => {
            try {
                const img = await animodule.generate(prompt, false);

                if (typeof img !== "object") {
                    await mChannel.send({ content: "[image failed]" });
                    return;
                }

                await mChannel.send({
                    files: [{
                        attachment: img.msg,
                        content_type: "image/png",
                        name: prompt.substring(0, 64) + imgnamewatermark + ".png"
                    }]
                });
                didSend = true;
            } catch (err) {
                console.error("[anigen failed]", err);
                await mChannel.send({ content: "[image failed]" });
            }
        })());

        return "the image is rendering and will appear in the channel in a moment";
    };

    beginTurn();
    try {
        const messages = [...history];

        for (let round = 0; ; round++) {
            const toolCalls = await streamTurn(messages);
            if (!toolCalls.length) break;

            // Out of rounds but it still wants a tool: stop here rather than let a
            // confused model loop on the channel.
            if (round >= MAX_TOOL_ROUNDS) {
                console.warn("[tool rounds exhausted]", toolCalls.map((c) => c.function?.name).join(","));
                break;
            }

            messages.push({ role: "assistant", content: "", tool_calls: toolCalls });

            for (const call of toolCalls) {
                const name = call.function?.name;
                let args = {};
                try {
                    args = JSON.parse(call.function?.arguments || "{}");
                } catch (e) {
                    console.warn("[tool args unparseable]", name, call.function?.arguments);
                }

                let result;
                if (name === "self_info") {
                    result = JSON.stringify(buildEnvInfo(message));
                } else if (name === "draw") {
                    result = await runDraw(args.tags);
                } else if (name === "run_code") {
                    result = formatResult(await runCode(String(args.code || "")));
                } else {
                    result = `there is no tool called ${name}`;
                }

                messages.push({ role: "tool", tool_call_id: call.id, name, content: result });
            }
        }

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
