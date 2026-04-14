// forgive me....

let client;
let Permissions;

const fs = require('fs');
const configData = JSON.parse(fs.readFileSync('src/discordBot/json_storage/configs.json'));
const imgnamewatermark = configData[0].img_name_stamp
const animodule = require("../anigen.js");

function getAutherName(author) {
    let auther_name = "anon";
    if (author.globalName) {
        auther_name = author.globalName
    } else {
        auther_name = author.username
    }
    if (auther_name.length < 1) {
        auther_name = "anon"
    }
    if (author.bot) {
        auther_name += " [bot]"
    }
    return auther_name;
}

const openAiPattern = /[^a-zA-Z0-9_-]/g;
function filterOPENAINAME(author) {
    let strName = getAutherName(author)
    let newName = strName.replace(openAiPattern, '');
    if (!/[a-zA-Z]/.test(newName)) {
        newName = "anon";
    }
    return newName;
}

const pingRegex = /<@(\d+)>/g;
function messageContentFilter(msg) {
    let msgcontent = msg.content

    // replace ping with name
    if (msg.mentions.users.size > 0) {
        let mentionuser;
        msg.mentions.users.forEach((mentionedMember) => {
            mentionuser = mentionedMember;
        });
        msgcontent = msgcontent.replace(pingRegex, `@${getAutherName(mentionuser)}`);
    }

    if (msg.mentions.repliedUser && client.user.id != msg.mentions.repliedUser.id && client.user.id != msg.author.id) {
        msgcontent = "@" + getAutherName(msg.mentions.repliedUser) + " " + msgcontent
    }

    return msgcontent
}


const TWENTY_FOUR_HOURS_MS = 86400000;
const { generate, buildInputData, sysprompt } = require('./avyai.js');

async function respond_process(mChannel, history) {
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
        const text = (content || "").trimEnd();
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
                    // flush any buffered text before entering code block
                    if (currentLineBuffer.trim().length > 0) {
                        await sendText(currentLineBuffer);
                        currentLineBuffer = "";
                    }

                    insideFence = true;
                    fenceBuffer = line + "\n";
                    continue;
                }

                // accumulate line
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

            const currentVisible = parsed.text;
            const addFrom = commonPrefixLength(lastVisible, currentVisible);
            const added = currentVisible.slice(addFrom);

            lastVisible = currentVisible;
            pending += added;

            enqueue(processPendingLines);

            //process.stdout.write(chunk);
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

async function build_history(message) {
    let systemMessage = {
        role: "system",
        content: sysprompt
    }
    const history = [
        systemMessage
    ];

    let prevmessagesALL = await message.channel.messages.fetch({ limit: 100, cache: true });
    //let prevmessages = Array.from(prevmessagesALL.values()).reverse().slice(-15).reverse();
    let prevmessages = Array.from(prevmessagesALL.values()).slice(0, 40);

    //let prevmessages = await message.channel.messages.fetch({ limit: 15 });

    let msgCount = 0;
    let totalMsgs = 0;
    let previousTimeStamp = message.createdTimestamp

    let spamCount = 0
    let prevMsgIsDayOld = false
    let drawPrompt = false

    prevmessages.forEach((msg) => {

        const spamdelta_ms = previousTimeStamp - msg.createdTimestamp;
        previousTimeStamp = msg.createdTimestamp
        totalMsgs += 1;
        if (totalMsgs == 2 && spamdelta_ms > TWENTY_FOUR_HOURS_MS) { // 12 hours
            prevMsgIsDayOld = true
        }

        if (spamdelta_ms < 1000 && msg.author.id != client.user.id) {
            spamCount += (1000 - spamdelta_ms) / (1 + totalMsgs / 2)
        }
    })

    prevmessages = prevmessages.reverse();
    prevmessages.forEach((msg) => {
        msgCount += 1;
        //let msg_content = messageContentFilter(msg).substring(0, 256);
        let msgv = messageContentFilter(msg).substring(0, 128).replace(/ {2,}/g, ' ') // remove double or ore spaces
        const lmsgv = msgv.toLowerCase();
        if (msg.author.id == client.user.id) {
            if (msg.attachments.size > 0) { // drawing
                msg.attachments.forEach((mattach) => {
                    let maName = mattach.name.replace(/_/gi, " ");
                    msgv += " draw{" + maName + "}\n";
                });
            }

            history.push(
                {
                    role: 'assistant',
                    content: msgv
                }
            );

        } else {

            if (msg.attachments.size > 0) {
                msg.attachments.forEach((mattach) => {
                    msgv +=
                        "(file){" + mattach.name + "}\n";
                });
            }

            if (msg.editedTimestamp) {
                //console.log(msg, "EDITED")
                msgv += " (edited)";
            }

            history.push(
                {
                    role: 'user',
                    content: filterOPENAINAME(msg.author) + ": " + msgv
                }
            );
            if ( // fight back
                lmsgv.includes("fuck you") ||
                lmsgv.includes("fuck u") ||
                lmsgv.includes("ur bad") ||
                lmsgv.includes("ur ugly") ||
                lmsgv.includes("stfu") ||
                lmsgv.includes("nigg") ||
                lmsgv.includes("bitch")
            ) {
                if (systemMessage.content == sysprompt) {
                    systemMessage.content = "You are a girl named Avy who replies like an complacent explicit 4chan use. reply in innuendo. make shit up to insult back use few word"
                }
            }
            if ( // me
                (
                    lmsgv.includes("who") ||
                    lmsgv.includes("which") ||
                    lmsgv.includes("did") ||
                    lmsgv.includes("he") ||
                    lmsgv.includes("she") ||
                    lmsgv.includes("what")
                )
                && (
                    lmsgv.includes("creator") ||
                    lmsgv.includes("made you") ||
                    lmsgv.includes("created you") ||
                    lmsgv.includes("made u") ||
                    lmsgv.includes("created u") ||
                    lmsgv.includes("made avy") ||
                    lmsgv.includes("created avy") ||
                    lmsgv.includes("is air")
                ) && msgCount > 13
            ) {
                if (systemMessage.content == sysprompt) {
                    systemMessage.content += ". airzy1 made me.";
                }
            }

            if ( // draw
                (
                    lmsgv.includes("draw") ||
                    lmsgv.match(/\bshow\b/i)
                ) && (totalMsgs - msgCount < 4)
            ) {
                drawPrompt = true;
            }

        }
    })

    let allCount = 0
    let countRemembered = 0
    let rememberNext = false;
    prevmessagesALL = prevmessagesALL.reverse()
    prevmessagesALL.forEach((msg) => {
        allCount++;
        if (allCount < 85 && countRemembered < 6) {
            const lmsgc = msg.content.toLowerCase();
            if (msg.author.id == client.user.id) {
                if (
                    rememberNext == true ||
                    lmsgc.includes("remember") ||
                    lmsgc.includes("gotchu") ||
                    lmsgc.includes("will do") ||
                    lmsgc.includes("yes") ||
                    lmsgc.includes("never") ||
                    lmsgc.includes("u like") ||
                    lmsgc.includes("alright")
                ) {
                    countRemembered++;
                    rememberNext = !rememberNext;
                    //console.log(allCount, lmsgc)

                    let msgv = messageContentFilter(msg).substring(0, 128).replace(/ {2,}/g, ' ') // remove double or ore spaces
                    history.splice(1, 0, {
                        role: 'assistant',
                        content: "[old msg] " + msgv
                    })

                }
            } else {
                if (
                    rememberNext == true ||
                    lmsgc.includes("remember") ||
                    lmsgc.includes("avy will") ||
                    lmsgc.includes("my name") ||
                    lmsgc.includes("my friend") ||
                    lmsgc.includes("i like") ||
                    lmsgc.includes("avy please") ||
                    lmsgc.includes("can you")
                ) {
                    countRemembered++;
                    rememberNext = !rememberNext;
                    //console.log(allCount, lmsgc)

                    let msgv = messageContentFilter(msg).substring(0, 128).replace(/ {2,}/g, ' ') // remove double or ore spaces
                    history.splice(1, 0, {
                        role: 'user',
                        content: "[old msg] " + filterOPENAINAME(msg.author) + ": " + msgv
                    });
                }
            }
        }
    })

    if (spamCount > 2000) {
        systemMessage.content = systemMessage.content + ", user spams. annoyed say bye"
    }

    if (prevMsgIsDayOld == true) {
        systemMessage.content = systemMessage.content + ". its been days since user has talked with you. send a weird re-connection text"
    }

    if (drawPrompt == true) {
        systemMessage.content = systemMessage.content + ". use draw{tags, describe drawing here} to show images";
    }

    if (systemMessage.content != sysprompt) {
        console.log("[DIFF SYS PROMPT]: ", systemMessage.content)
    }

    return history
}



// Main
async function handle_chat(message) {
    //console.log(Permissions.Flags)
    if (message.channel.permissionsFor) {
        const botPermissions = message.channel.permissionsFor(client.user);
        if (botPermissions.has(Permissions.Flags.SendMessages) &&
            botPermissions.has(Permissions.Flags.ReadMessageHistory)) {
        } else {
            console.log("[Chatbot Err] cannot sent msg in channel ", message.channel.name)
            return
        }
    }
    if (message.author.bot) return;

    try {
        const history = await build_history(message)
        await respond_process(message.channel, history)
    } catch (err) {
        console.log("[CHAT ERROR] ", err)//, err)
    }
}

function pass_exports(p_client, p_Permissions) {
    client = p_client;
    Permissions = p_Permissions;
}

module.exports = {
    handle_chat,
    pass_exports,
};
