const BASE_URL = "https://gifsnap.com/api/v1";

const SEARCH_LIMIT = 50;   // per query, what gifsnap returns in one page
const RETURN_TOP = 5;      // handed to the model; it posts one
const METADATA_MAX = 12;   // ponytail: caps the created_at fanout, raise if ranking suffers
const RECENCY_MAX = 20;
const RECENCY_HALF_LIFE_DAYS = 365;

const normalize = (v = "") =>
    String(v).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const words = (v) => normalize(v).split(" ").filter((w) => w.length >= 2);

// Titles are the only text gifsnap ranks on, and its own ordering is loose, so a whole
// phrase landing in the title is worth far more than the words landing separately.
function overlapScore(query, gif) {
    const q = normalize(query);
    const title = normalize(gif.title || "");
    if (!q || !title) return 0;

    return (title.includes(q) ? 30 : 0) +
        words(q).reduce((s, w) => s + (title.includes(w) ? 4 : 0), 0);
}

async function fetchJson(url) {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`gifsnap ${res.status}`);
    return res.json();
}

async function gifsnapSearch(query) {
    const url = new URL(`${BASE_URL}/gifs/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("page", "1");
    url.searchParams.set("limit", SEARCH_LIMIT);
    return (await fetchJson(url)).data || [];
}

// A gif that shows up for several phrasings of the same idea is the one that actually
// matches it, hence the bonus per extra appearance on top of the per-hit rank score.
const baseScore = ({ gif, appearances }) =>
    appearances.reduce((s, a) => s + Math.max(1, 50 - a.rank) + overlapScore(a.query, gif), 0) +
    Math.max(0, appearances.length - 1) * 35;

function recencyScore(gif) {
    const time = Date.parse(gif.created_at);
    if (!Number.isFinite(time)) return 0;

    const ageDays = Math.max(0, (Date.now() - time) / 86400000);
    return RECENCY_MAX * Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
}

const bestRank = (c) => Math.min(...c.appearances.map((a) => a.rank));

// Some results come back as a /media/<base64> proxy url, which 403s anything that is not
// gifsnap's own page -- discord fetches it to build the embed and gets nothing, so the
// message is a dead link. The base64 is the real cdn url, so unwrap it.
function directUrl(url = "") {
    const b64 = /\/api\/v1\/media\/([A-Za-z0-9+/=_-]+)/.exec(url)?.[1];
    if (!b64) return url;

    try {
        const decoded = Buffer.from(b64, "base64").toString();
        return /^https?:\/\//.test(decoded) ? decoded : url;
    } catch {
        return url;
    }
}

async function searchGif(inputQueries) {
    const queries = [...new Map(
        (Array.isArray(inputQueries) ? inputQueries : [inputQueries])
            .map((q) => String(q).trim())
            .filter(Boolean)
            .map((q) => [normalize(q), q])
    ).values()];

    if (!queries.length) return [];

    const searches = await Promise.all(
        queries.map(async (query) => ({ query, results: await gifsnapSearch(query) }))
    );

    // Merge by gifsnap id first: the same gif coming back for two queries is one
    // candidate with two appearances, not two candidates.
    const candidates = new Map();
    for (const { query, results } of searches) {
        results.forEach((gif, i) => {
            if (!gif?.id || !gif?.url) return;
            if (!candidates.has(gif.id)) candidates.set(gif.id, { gif, appearances: [] });
            candidates.get(gif.id).appearances.push({ query, rank: i + 1 });
        });
    }

    let ranked = [...candidates.values()]
        .map((c) => ({ ...c, baseScore: baseScore(c) }))
        .sort((a, b) => b.baseScore - a.baseScore || bestRank(a) - bestRank(b));

    if (!ranked.length) return [];

    // created_at is only on the detail endpoint, so it costs a request per gif. Only the
    // ones close enough to the cut that RECENCY_MAX could move them are worth fetching.
    const cutoff = ranked[Math.min(RETURN_TOP, ranked.length) - 1].baseScore - RECENCY_MAX;
    await Promise.all(
        ranked
            .filter((c) => c.baseScore >= cutoff && !c.gif.created_at)
            .slice(0, METADATA_MAX)
            .map(async (c) => {
                try {
                    c.gif = { ...c.gif, ...await fetchJson(`${BASE_URL}/gifs/${encodeURIComponent(c.gif.id)}`) };
                } catch {
                    // no metadata = no recency bonus, the base ranking still stands
                }
            })
    );

    ranked = ranked
        .map((c) => ({ ...c, score: c.baseScore + recencyScore(c.gif) }))
        .sort((a, b) => b.score - a.score || bestRank(a) - bestRank(b));

    // Different ids sometimes point at the identical gif url. Keep the best-ranked one,
    // otherwise the model is handed five copies of one gif.
    const seen = new Set();
    return ranked
        .map((c) => ({ ...c, url: directUrl(c.gif.url) }))
        .filter(({ url }) => url && !seen.has(url) && seen.add(url))
        .slice(0, RETURN_TOP);
}

module.exports = {
    schema: {
        description: "search for a reaction gif. put one of the returned urls in your reply to post it",
        parameters: {
            type: "object",
            properties: {
                queries: {
                    type: "array",
                    items: { type: "string" },
                    description: "1-3 phrasings of the same idea, e.g. ['bro thought he cooked', 'you thought']"
                }
            },
            required: ["queries"]
        }
    },

    run: async ({ queries }) => {
        try {
            const results = await searchGif(queries || []);
            if (!results.length) return "no gifs found";

            return results
                .map(({ gif, url }, i) => `${i + 1}. ${gif.title || "untitled"} - ${url}`)
                .join("\n");
        } catch (e) {
            return `gif search failed: ${e.message}`;
        }
    }
};
