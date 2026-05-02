const { sysprompt } = require('./avyai.js');
const { imgUrlToText } = require('./imgURLToTxt.js');
const { filterOPENAINAME, messageContentFilter } = require('./helpers.js');
const { getMessages } = require('./message_cache.js');

const TWENTY_FOUR_HOURS_MS = 86400000;

async function build_history(message, client) {
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
        msgMember?.joinedTimestamp
            ? `^ user was server member for: ${Math.floor((now - msgMember.joinedTimestamp) / 86400000)}d`
            : null,
        msgChannel.isThread() ? `thread: "${msgChannel.name}"` : null,
        `date: ${now.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" })}`
    ].filter(Boolean).join(", ");

    const msgEnvData = {
        role: "user",
        content: `[SYSTEM]: ${envParts}`
    };

    console.log(msgEnvData);

    const history = [
        systemMessage,
        msgEnvData
    ];

    let prevmessagesALL = await getMessages(msgChannel); // newest first, up to 100
    let prevmessages = prevmessagesALL.slice(0, 80);

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
        let msgv = messageContentFilter(msg, client)
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
                        content: "[old msg] " + messageContentFilter(msg, client).substring(0, 512).replace(/ {2,}/g, ' ')
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
                        content: "[old msg] " + filterOPENAINAME(msg.author) + ": " + messageContentFilter(msg, client).substring(0, 512).replace(/ {2,}/g, ' ')
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

module.exports = { build_history };