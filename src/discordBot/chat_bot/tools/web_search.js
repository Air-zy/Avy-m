const envDecrypt = require('../../../envDecrypt.js');

// Optional: the bot runs fine without it, web_search just reports itself unconfigured.
const TAVILY_KEY = process.env.TAVILY_KEY ? envDecrypt(process.env.avyKey, process.env.TAVILY_KEY) : "";

module.exports = {
    schema: {
        description: "search the web/online for info.",
        parameters: {
            type: "object",
            properties: { query: { type: "string", description: "search query" } },
            required: ["query"]
        }
    },

    // Tavily rather than a scrape: DuckDuckGo's html/lite endpoints answer 200 with a
    // CAPTCHA page now, so a regex over them silently returns nothing. `fast` depth is one
    // credit and returns snippets already summarised, which is all that fits in a reply.
    run: async ({ query }) => {
        if (!TAVILY_KEY) return "web search is not configured";

        const q = String(query || "").trim();
        if (!q) return "nothing searched, no query was given";

        try {
            const res = await fetch("https://api.tavily.com/search", {
                method: "POST",
                headers: { "content-type": "application/json", authorization: `Bearer ${TAVILY_KEY}` },
                body: JSON.stringify({ query: q, max_results: 10, search_depth: "fast", include_answer: true }),
                signal: AbortSignal.timeout(10000)
            });

            if (!res.ok) return `search failed (${res.status})`;

            const data = await res.json();
            const out = (data.results || []).map((r) => `${r.title} - ${r.url}\n${r.content}`);
            console.log("web_search", out)
            if (data.answer) out.unshift(data.answer);
            return out.join("\n\n").slice(0, 1500) || "no results";
        } catch (e) {
            return `search failed: ${e.message}`;
        }
    }
};
