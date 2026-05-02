const openAiPattern = /[^a-zA-Z0-9_-]/g;
const pingRegex = /<@(\d+)>/g;

function getAutherName(author) {
    let auther_name = "anon";
    if (author.globalName) {
        auther_name = author.globalName;
    } else {
        auther_name = author.username;
    }
    if (auther_name.length < 1) {
        auther_name = "anon";
    }
    if (author.bot) {
        auther_name += " [bot]";
    }
    return auther_name;
}

function filterOPENAINAME(author) {
    let strName = getAutherName(author);
    let newName = strName.replace(openAiPattern, '');
    if (!/[a-zA-Z]/.test(newName)) {
        newName = "anon";
    }
    return newName;
}

function messageContentFilter(msg, client) {
    let msgcontent = msg.content;

    if (msg.mentions.users.size > 0) {
        let mentionuser;
        msg.mentions.users.forEach((mentionedMember) => {
            mentionuser = mentionedMember;
        });
        msgcontent = msgcontent.replace(pingRegex, `@${getAutherName(mentionuser)}`);
    }

    if (msg.mentions.repliedUser && client.user.id != msg.mentions.repliedUser.id && client.user.id != msg.author.id) {
        msgcontent = "@" + getAutherName(msg.mentions.repliedUser) + " " + msgcontent;
    }

    return msgcontent;
}

function filterSentText(text) {
    // non-strings and empty strings pass through unchanged
    if (typeof text !== "string" || text.length === 0) return text;

    // skip leading whitespace
    let i = 0;
    while (i < text.length && (text[i] === " " || text[i] === "\t")) i++;

    // must have a colon
    const colon = text.indexOf(":", i);
    if (colon === -1) return text;

    // find label end... ignoring trailing whitespace before the colon
    let end = colon;
    while (end > i && (text[end - 1] === " " || text[end - 1] === "\t")) end--;
    const label = text.slice(i, end);

    // empty or invalid label... letters, digits, _ ' - only
    if (label.length === 0) return text;
    if (!/^[\p{L}\p{M}\p{N}_'\-]+$/u.test(label)) return text;

    // skip whitespace after colon and return the value
    let j = colon + 1;
    while (j < text.length && (text[j] === " " || text[j] === "\t")) j++;
    return text.slice(j);
}

module.exports = { getAutherName, filterOPENAINAME, messageContentFilter, filterSentText };