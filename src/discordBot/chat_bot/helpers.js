const pingRegex = /<@(\d+)>/g;

function normalizeText(text) {
    if (!text) return "";

    // 1. Normalize accents/diacritics (e.g., "é" -> "e")\
    let normalized = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, "");

    // 2. Map "Fancy" Unicode blocks back to standard Latin (A-Z, a-z, 0-9)\
    return normalized.replace(/[\u1D400-\u1D7FF\u2460-\u24FF\uFF01-\uFF5E]/g, (char) => {
        const code = char.charCodeAt(0);

        // Mathematical Bold / Italic / Script / Double-struck / Sans-serif\
        if (code >= 0x1D400 && code <= 0x1D7FF) {
            // This is a simplified mapping for the most common fancy blocks
            // We map them based on their position relative to the block start
            const offset = code - 0x1D400;
            
            // Map to Uppercase A-Z
            if (offset >= 0 && offset <= 25) return String.fromCharCode(0x41 + offset);
            // Map to Lowercase a-z (handling different block offsets)
            if (offset >= 32 && offset <= 57) return String.fromCharCode(0x61 + (offset - 32));
            
            // For more complex blocks (Script, Double-struck, etc), we use a more 
            // robust approach: since they repeat A-Z patterns every 26 characters
            const alphabetPos = offset % 26;
            const isUppercase = Math.floor(offset / 26) % 2 === 0; // Simplified heuristic
            return isUppercase ? String.fromCharCode(0x41 + alphabetPos) : String.fromCharCode(0x61 + alphabetPos);
        }

        // Full-width characters (common in Asian fonts)
        if (code >= 0xFF01 && code <= 0xFF5E) {
            return String.fromCharCode(code - 0xFEE0);
        }

        return char;
    });
}

function getAuthorName(author) {
    let author_name = "anon";
    
    if (author.globalName) {
        author_name = author.globalName;
    } else {
        author_name = author.username;
    }
    
    if (!author_name || author_name.length < 1) {
        author_name = "anon";
    }
    
    if (author.bot) {
        author_name += " [bot]";
    }
    
    return author_name;
}

function filterDiscordName(author) {
    let strName = getAuthorName(author);
    let newName = normalizeText(strName);
    return newName;
}


function messageContentFilter(msg, client) {
    let msgcontent = msg.content;

    if (msg.mentions.users.size > 0) {
        let mentionuser;
        msg.mentions.users.forEach((mentionedMember) => {
            mentionuser = mentionedMember;
        });
        msgcontent = msgcontent.replace(pingRegex, `@${filterDiscordName(mentionuser)}`);
    }

    if (msg.mentions.repliedUser && client.user.id != msg.mentions.repliedUser.id && client.user.id != msg.author.id) {
        msgcontent = "@" + filterDiscordName(msg.mentions.repliedUser) + " " + msgcontent;
    }

    return msgcontent;
}

// The system prompt ends "only respond as Avy:", so the model completes the pattern and
// opens its reply with the same prefix. Stripping just that beats the old general
// `label:` stripper, which also ate "note:", "edit:" and the like.
const stripAvyPrefix = (s) => String(s || "").replace(/^\s*avy\s*:\s*/i, "");

module.exports = { getAuthorName, filterDiscordName, messageContentFilter, stripAvyPrefix };