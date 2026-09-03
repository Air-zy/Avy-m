const { sysprompt } = require('./avyai.js');
const { imgUrlToText } = require('./imgURLToTxt.js');
const { filterDiscordName, messageContentFilter } = require('./helpers.js');
const { getMessages } = require('./message_cache.js');

const TWENTY_FOUR_HOURS_MS = 86400000;

// Backs the `self_info` tool. This used to be a `[SYSTEM]: ...` line prepended at
// history index 1, but it carries a to-the-minute timestamp, so it changed on nearly
// every message and invalidated the cached prefix behind it. Measured against the live
// server with a ~7K-token history: same minute prompt_n=6 / 171ms, next minute
// prompt_n=7122 / 3070ms. As a tool result it sits at the end, only when asked for.
function buildEnvInfo(message) {
    const msgChannel = message.channel;
    const msgGuild = message.guild;
    const msgMember = message.member;
    const now = new Date();

    const info = {
        my_creator: "airzy",
        channel: msgChannel.name ?? "dm",
        server: msgGuild?.name,
        members: msgGuild?.memberCount,
        user: message.author.username,
        nickname: msgMember?.nickname,
        top_role: msgMember && msgMember.roles.highest.name !== "@everyone"
            ? msgMember.roles.highest.name
            : undefined,
        presence: msgMember?.presence
            ? `${msgMember.presence.status}${msgMember.presence.activities?.length
                ? `; activities=${msgMember.presence.activities.map(a => a.name).join("|")}`
                : ""}`
            : undefined,
        user_member_for_days: msgMember?.joinedTimestamp
            ? Math.floor((now - msgMember.joinedTimestamp) / TWENTY_FOUR_HOURS_MS)
            : undefined,
        thread: msgChannel.isThread() ? msgChannel.name : undefined,
        date: now.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric",
            hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" })
    };

    for (const k of Object.keys(info)) if (info[k] === undefined) delete info[k];
    return info;
}

async function build_history(message, client) {
    const msgChannel = message.channel;

    let systemMessage = {
        role: "system",
        content: sysprompt
    };

    // Channel/user/time context is no longer prepended here; the model pulls it through
    // the `self_info` tool when it actually needs it. See buildEnvInfo above.
    const history = [systemMessage];

    let prevmessagesALL = await getMessages(msgChannel); // newest first, up to 100
    let prevmessages = prevmessagesALL.slice(0, 80);

    let msgCount = 0;
    let totalMsgs = 0;
    let previousTimeStamp = message.createdTimestamp;

    let prevMsgIsDayOld = false;

    prevmessages.forEach((msg) => {
        const spamdelta_ms = previousTimeStamp - msg.createdTimestamp;
        previousTimeStamp = msg.createdTimestamp;
        totalMsgs += 1;

        if (totalMsgs == 2 && spamdelta_ms > TWENTY_FOUR_HOURS_MS) {
            prevMsgIsDayOld = true;
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

        const speakerName = filterDiscordName(msg.author);
        let msgv = messageContentFilter(msg, client)
            .substring(0, 512)
            .replace(/ {2,}/g, ' ');

        if (msg.author.id === client.user.id) {
            if (msg.attachments.size > 0) {
                msg.attachments.forEach((mattach) => {
                    msgv += ` (sent image){${mattach.name.replace(/_/gi, " ")}}`;
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
                        content: "[old msg] " + filterDiscordName(msg.author) + ": " + messageContentFilter(msg, client).substring(0, 512).replace(/ {2,}/g, ' ')
                    });
                }
            }
        }
    });

    // Only remaining mutation of the system block. It fires after a >24h gap, when the
    // slot's cached prefix is cold anyway, so it costs no extra prompt eval in practice.
    if (prevMsgIsDayOld) {
        systemMessage.content += ". its been days since user has talked with you. send a weird re-connection text";
        console.log("[DIFF SYS PROMPT]: ", systemMessage.content);
    }

    //console.log(history)
    return history;
}

module.exports = { build_history, buildEnvInfo };