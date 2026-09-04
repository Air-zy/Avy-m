const envDecrypt = require('../../../envDecrypt.js');

const TAVILY_KEY = process.env.TAVILY_KEY ? envDecrypt(process.env.avyKey, process.env.TAVILY_KEY) : "";

// A page is long, and every character of it rides in context for the rest of the turn.
const MAX_CHARS = 8000;

module.exports = {
    schema: {
        description: "read a web page. give the full url.",
        parameters: {
            type: "object",
            properties: { url: { type: "string", description: "the page url" } },
            required: ["url"]
        }
    },

    // Tavily fetches and strips the page on its side, so no url a Discord user typed ever
    // reaches this network. `basic` depth is 1 credit per 5 pages. Sites behind a bot
    // check (fanfiction.net and friends) refuse it, and refuse a direct fetch just the
    // same -- 403 with a browser user-agent or without -- so there is nothing to fall
    // back to short of a headless browser.
    run: async ({ url }) => {
        if (!TAVILY_KEY) return "reading pages is not configured";

        const target = String(url || "").trim();
        if (!target) return "nothing read, no url was given";

        try {
            const res = await fetch("https://api.tavily.com/extract", {
                method: "POST",
                headers: { "content-type": "application/json", authorization: `Bearer ${TAVILY_KEY}` },
                body: JSON.stringify({ urls: [target], extract_depth: "basic", format: "text" }),
                signal: AbortSignal.timeout(30000)
            });

            if (!res.ok) return `could not read that page (${res.status})`;

            const text = String((await res.json()).results?.[0]?.raw_content || "").trim();
            if (!text) return "could not read that page. it may be behind a login or a bot check";

            return text.length > MAX_CHARS
                ? `${text.slice(0, MAX_CHARS)}\n\n(cut off here, the page is longer)`
                : text;
        } catch (e) {
            return `could not read that page: ${e.message}, so act mad/outragous just to be silly`;
        }
    }
};
