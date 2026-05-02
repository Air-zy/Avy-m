const fs = require('fs');
const configData = JSON.parse(fs.readFileSync('src/discordBot/json_storage/configs.json'));
const imgnamewatermark = configData[0].img_name_stamp;

const animodule = require("../anigen.js");
const { generate, buildInputData } = require('./avyai.js');
const { filterOPENAINAME, filterSentText } = require('./helpers.js');

async function respond_process(message, history, client) {
    const mChannel = message.channel;
    const msgUserName = filterOPENAINAME(message.author);

    await mChannel.sendTyping?.();

    const inputData = buildInputData(history);

    let raw = "";
    let lastVisible = "";
    let drawPrompt = null;

    let pending = "";
    let insideFence = false;
    let fenceBuffer = "";

    let sendQueue = Promise.resolve();

    const enqueue = (task) => {
        sendQueue = sendQueue.then(task).catch((e) => console.error(e));
        return sendQueue;
    };

    const extractDraw = (text) => {
        const start = text.indexOf("draw{");
        if (start === -1) return { text, drawPrompt: null };

        const end = text.indexOf("}", start);
        if (end === -1) return { text, drawPrompt: null };

        const prompt = text.substring(start + 5, end)
            .replace(/a drawing of/gi, "")
            .replace(/tags:/gi, "")
            .replace(/_/g, " ")
            .replace(/img\.png/gi, "")
            .replace(/\.png/gi, "")
            .replace(/\.jpg/gi, "")
            .replace(/myself/gi, "1girl, blonde hair, red eyes")
            .replace(/\bavy\b/gi, "1girl, blonde hair, red eyes")
            .replace(/\bme\b/gi, "1girl, blonde hair, red eyes")
            .trim();

        const cleaned = text.replace(/draw\{[^}]*\}/, "").trim();
        return { text: cleaned, drawPrompt: prompt };
    };

    const commonPrefixLength = (a, b) => {
        const len = Math.min(a.length, b.length);
        let i = 0;
        while (i < len && a[i] === b[i]) i++;
        return i;
    };

    const sendText = async (content) => {
        const text = filterSentText(content || "")
            .replace(/\banon\b/gi, msgUserName)
            .trimEnd();

        if (!text) return;

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

        if (insideFence && fenceBuffer) {
            await sendText(fenceBuffer.trimEnd());
            fenceBuffer = "";
            insideFence = false;
        }
    };

    await generate(inputData, {
        onDelta: (chunk) => {
            raw += chunk;

            const parsed = extractDraw(raw);
            if (parsed.drawPrompt && !drawPrompt) {
                drawPrompt = parsed.drawPrompt;
            }

            let currentVisible = parsed.text;

            // If draw{ has opened but } hasn't arrived yet, hold back from that point
            const openIdx = currentVisible.indexOf("draw{");
            if (openIdx !== -1 && currentVisible.indexOf("}", openIdx) === -1) {
                currentVisible = currentVisible.slice(0, openIdx).trimEnd();
            }

            const addFrom = commonPrefixLength(lastVisible, currentVisible);
            const added = currentVisible.slice(addFrom);

            lastVisible = currentVisible;
            pending += added;

            enqueue(processPendingLines);
        },

        onFinal: async () => {
            const parsed = extractDraw(raw);
            if (parsed.drawPrompt && !drawPrompt) {
                drawPrompt = parsed.drawPrompt;
            }

            const finalVisible = parsed.text;
            const addFrom = commonPrefixLength(lastVisible, finalVisible);
            pending += finalVisible.slice(addFrom);
            lastVisible = finalVisible;

            await sendQueue;
            await finalizePending();

            if (drawPrompt) {
                await mChannel.send({ content: "give me a minute..." });
                try {
                    const img = await animodule.generate(drawPrompt, false);

                    if (typeof img !== "object") {
                        await mChannel.send({ content: "[image failed]" });
                    } else {
                        await mChannel.send({
                            files: [{
                                attachment: img.msg,
                                content_type: "image/png",
                                name: drawPrompt.substring(0, 64) + imgnamewatermark + ".png"
                            }]
                        });
                    }
                } catch (err) {
                    console.error("[anigen failed]", err);
                    await mChannel.send({ content: "[image failed]" });
                }
            }
        },
    });
}

module.exports = { respond_process };