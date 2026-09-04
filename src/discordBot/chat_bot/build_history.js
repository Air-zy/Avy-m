const { sysprompt } = require('./avyai.js');
const { imgUrlToText } = require('./imgURLToTxt.js');
const { filterDiscordName, messageContentFilter } = require('./helpers.js');
const { getWindow } = require('./message_cache.js');
const { recall } = require('./tool_memory.js');

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

    // newest first, and pinned to a stable oldest message so the prompt prefix survives
    // from turn to turn. getWindow owns that; it hands back a copy, safe to reverse.
    let prevmessages = await getWindow(msgChannel);

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

    // Tool calls exist nowhere in Discord, so they come from tool_memory instead, keyed by
    // the message that triggered them. Anything whose message has left the window is
    // pruned here, which is the only place that knows what the window still holds.
    const toolTrace = recall(msgChannel.id, new Set(prevmessages.map((m) => m.id)));

    let lastHistoryItem = null;
    let lastRole = null;
    let lastSpeaker = null;

    // The thinking behind a reply cannot be its own message -- an assistant turn carrying
    // reasoning and no content renders a stray empty `to=user` block -- so it waits here
    // and is hung on the reply itself, which is the next assistant message to be built.
    let pendingReasoning = null;

    const pushMergedHistory = (role, speaker, text) => {
        if (lastHistoryItem && lastRole === role && lastSpeaker === speaker) {
            lastHistoryItem.content += `\n${text}`;
            return;
        }

        if (speaker == "avy") {
            lastHistoryItem = { role, content: `${text}` };
        } else {
            lastHistoryItem = { role, content: `${speaker}: ${text}` };
        }

        if (pendingReasoning) {
            // dropped rather than carried further if her turn produced no message at all
            if (role === "assistant") lastHistoryItem.reasoning_content = pendingReasoning;
            pendingReasoning = null;
        }

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

        // The turn this message set off: her call, then what the tool answered, sitting
        // between the ask and the reply she wrote from it. Breaks the merge run on
        // purpose -- the next message is no longer adjacent to the one before the block.
        const trace = toolTrace?.get(msg.id);
        if (trace) {
            history.push(...trace.entries);
            pendingReasoning = trace.finalReasoning || null;
            lastHistoryItem = null;
            lastRole = null;
            lastSpeaker = null;
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