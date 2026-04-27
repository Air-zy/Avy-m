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

    //console.log(msg)

    return msgcontent
}

function filterSentText(text) {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        // remove one or more leading "avy:" prefixes (case-insensitive), including any following spaces
        .replace(/^(?:avy:\s*)+/i, "")
}

const TWENTY_FOUR_HOURS_MS = 86400000;
const { generate, buildInputData, sysprompt, isCurrentlyGenerating } = require('./avyai.js');

async function respond_process(message, history) {
    if (isCurrentlyGenerating()) {
        return
    }

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

const { imgUrlToText } = require('./imgURLToTxt.js');

async function build_history(message) {
    const msgChannel = message.channel;
    const msgGuild = message.guild;
    const msgMember = message.member;
    const msgAuthor = message.author;

    let systemMessage = {
        role: "system",
        content: sysprompt
    };

    const now = new Date();
    const envParts = [
        `channel: #${msgChannel.name ?? "dm"}`,
        msgGuild ? `server: "${msgGuild.name}"` : null,
        msgGuild ? `members: ${msgGuild.memberCount}` : null,
        `user: ${msgAuthor.username}`,
        msgMember?.nickname ? `nickname: "${msgMember.nickname}"` : null,
        msgMember && msgMember.roles.highest.name !== "@everyone"
            ? `top role: ${msgMember.roles.highest.name}`
            : null,
        msgMember?.presence
            ? `presence: ${msgMember.presence.status}${msgMember.presence.activities?.length
                ? `; activities=${msgMember.presence.activities.map(a => a.name).join("|")}`
                : ""
            }`
            : null,
        msgChannel.isThread() ? `thread: "${msgChannel.name}"` : null,
        message.reference ? `is_reply: true` : null,
        message.mentions.has(client.user) ? `was_pinged: true` : null,
        `date: ${now.toUTCString()}`,
    ].filter(Boolean).join(", ");

    const msgEnvData = {
        role: "user",
        content: `[SYSTEM]: ${envParts}`
    };

    console.log(msgEnvData)

    const history = [
        systemMessage,
        msgEnvData
    ];

    let prevmessagesALL = await msgChannel.messages.fetch({ limit: 100, cache: true });
    let prevmessages = Array.from(prevmessagesALL.values()).slice(0, 80);

    let msgCount = 0;
    let totalMsgs = 0;
    let previousTimeStamp = message.createdTimestamp;

    let spamCount = 0;
    let prevMsgIsDayOld = false;
    let drawPrompt = false;

    prevmessages.forEach((msg) => {
        const spamdelta_ms = previousTimeStamp - msg.createdTimestamp;
        previousTimeStamp = msg.createdTimestamp;
        totalMsgs += 1;

        if (totalMsgs == 2 && spamdelta_ms > TWENTY_FOUR_HOURS_MS) {
            prevMsgIsDayOld = true;
        }

        if (spamdelta_ms < 1000 && msg.author.id != client.user.id) {
            spamCount += (1000 - spamdelta_ms) / (1 + totalMsgs / 2);
        }

        if (msg.embeds.length > 0) {
            msg.embeds.forEach((embed) => {
                const data = embed.data;
                if (!data) return;
                const thumb = data.thumbnail;
                if (!thumb) return;
                const url = thumb.proxy_url || thumb.url;
                imgUrlToText(url);
            });
        }
    });

    prevmessages = prevmessages.reverse();

    let lastHistoryItem = null;
    let lastRole = null;
    let lastSpeaker = null;

    const pushMergedHistory = (role, speaker, text) => {
        if (lastHistoryItem && lastRole === role && lastSpeaker === speaker) {
            lastHistoryItem.content += `\n${text}`;
            return;
        }

        lastHistoryItem = { role, content: `${speaker}: ${text}` };
        history.push(lastHistoryItem);
        lastRole = role;
        lastSpeaker = speaker;
    };

    prevmessages.forEach((msg) => {
        msgCount += 1;

        const speakerName = filterOPENAINAME(msg.author);
        let msgv = messageContentFilter(msg)
            .substring(0, 512)
            .replace(/ {2,}/g, ' ');

        const lmsgv = msgv.toLowerCase();

        if (msg.author.id === client.user.id) {
            if (msg.attachments.size > 0) {
                msg.attachments.forEach((mattach) => {
                    msgv += ` draw{${mattach.name.replace(/_/gi, " ")}}`;
                });
            }

            pushMergedHistory("assistant", "avy", msgv.replace(/\p{RGI_Emoji}/gv, ""));
        } else {
            if (msg.attachments.size > 0) {
                msg.attachments.forEach((mattach) => {
                    msgv += `(file){${mattach.name}}\n`;
                });
            }

            if (msg.editedTimestamp) {
                msgv += " (edited)";
            }

            pushMergedHistory("user", speakerName, msgv);

            if (
                (lmsgv.includes("who") || lmsgv.includes("which") || lmsgv.includes("did") ||
                    lmsgv.includes("he") || lmsgv.includes("she") || lmsgv.includes("what")) &&
                (lmsgv.includes("creator") || lmsgv.includes("made you") || lmsgv.includes("created you") ||
                    lmsgv.includes("made u") || lmsgv.includes("created u") || lmsgv.includes("made avy") ||
                    lmsgv.includes("created avy") || lmsgv.includes("is air")) &&
                msgCount > 13
            ) {
                if (systemMessage.content === sysprompt) {
                    systemMessage.content += ". airzy1 is my real creator";
                }
            }

            if (
                (lmsgv.includes("draw") || lmsgv.match(/\bshow\b/i)) &&
                (totalMsgs - msgCount < 4)
            ) {
                drawPrompt = true;
            }
        }
    });

    let allCount = 0;
    let countRemembered = 0;
    let rememberNext = false;

    prevmessagesALL = prevmessagesALL.reverse();
    prevmessagesALL.forEach((msg) => {
        allCount++;
        if (allCount < 20 && countRemembered < 6) {
            const lmsgc = msg.content.toLowerCase();

            if (msg.author.id == client.user.id) {
                if (
                    rememberNext ||
                    lmsgc.includes("remember") || lmsgc.includes("gotchu") ||
                    lmsgc.includes("will do") || lmsgc.includes("yes") ||
                    lmsgc.includes("never") || lmsgc.includes("u like") ||
                    lmsgc.includes("alright")
                ) {
                    countRemembered++;
                    rememberNext = !rememberNext;
                    history.splice(1, 0, {
                        role: 'assistant',
                        content: "[old msg] " + messageContentFilter(msg).substring(0, 512).replace(/ {2,}/g, ' ')
                    });
                }
            } else {
                if (
                    rememberNext ||
                    lmsgc.includes("remember") || lmsgc.includes("avy will") ||
                    lmsgc.includes("my name") || lmsgc.includes("my friend") ||
                    lmsgc.includes("i like") || lmsgc.includes("avy please") ||
                    lmsgc.includes("can you")
                ) {
                    countRemembered++;
                    rememberNext = !rememberNext;
                    history.splice(1, 0, {
                        role: 'user',
                        content: "[old msg] " + filterOPENAINAME(msg.author) + ": " + messageContentFilter(msg).substring(0, 512).replace(/ {2,}/g, ' ')
                    });
                }
            }
        }
    });

    if (spamCount > 2000) {
        systemMessage.content += ", user spams. annoyed say bye";
    }

    if (prevMsgIsDayOld) {
        systemMessage.content += ". its been days since user has talked with you. send a weird re-connection text";
    }

    if (drawPrompt) {
        systemMessage.content += ". use draw{tags, describe drawing here} to show images";
    }

    if (systemMessage.content !== sysprompt) {
        console.log("[DIFF SYS PROMPT]: ", systemMessage.content);
    }

    return history;
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
        await respond_process(message, history)
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
