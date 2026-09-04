const MAX_CACHE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_MESSAGES = 200;

const cache = new Map();
let totalBytes = 0;

function estimateBytes(messages) {
    return messages.reduce((n, m) => n + (m.content?.length ?? 0) * 2 + 300, 0);
}

function evict() {
    while (totalBytes > MAX_CACHE_BYTES && cache.size > 0) {
        let oldestId = null;
        let oldestTime = Infinity;
        for (const [id, entry] of cache) {
            if (entry.lastAccess < oldestTime) {
                oldestTime = entry.lastAccess;
                oldestId = id;
            }
        }
        if (oldestId === null) break;
        totalBytes -= cache.get(oldestId).byteSize;
        cache.delete(oldestId);
    }
}

async function getMessages(channel) {
    const id = channel.id;
    const now = Date.now();
    const entry = cache.get(id);

    if (!entry) {
        const fetched = await channel.messages.fetch({ limit: 100, cache: true });
        const messages = [...fetched.values()]; // newest-first
        const byteSize = estimateBytes(messages);

        totalBytes += byteSize;
        cache.set(id, { messages, newestId: messages[0]?.id ?? null, byteSize, lastAccess: now });
        evict();
        return messages;
    }

    entry.lastAccess = now;

    if (!entry.newestId) return entry.messages;

    const delta = await channel.messages.fetch({ after: entry.newestId, limit: 100, cache: true });
    if (delta.size === 0) return entry.messages;

    const newMessages = [...delta.values()];

    const combined = [...newMessages, ...entry.messages]
        .sort((a, b) => (BigInt(b.id) > BigInt(a.id) ? 1 : -1)); // newest-first

    const merged = combined.slice(0, MAX_MESSAGES);

    // Trimmed messages fall off the tail (oldest), which came from entry.messages
    const trimCount = combined.length - merged.length;
    const trimmedBytes = trimCount > 0 ? estimateBytes(combined.slice(-trimCount)) : 0;
    const newByteSize = entry.byteSize + estimateBytes(newMessages) - trimmedBytes;

    totalBytes = totalBytes - entry.byteSize + newByteSize;
    entry.messages = merged;
    entry.newestId = newMessages[0].id;
    entry.byteSize = newByteSize;

    evict();
    return merged;
}

// The prompt is only worth caching if its oldest message stays put. Sliding the window by
// one every turn moves every token behind it, so llama-server re-evaluates the whole
// prompt on every message -- the 7122-token / 3070ms case in build_history's comment. So
// the window is pinned to an anchor message and allowed to grow past KEEP, snapping back
// only when it reaches KEEP + SLACK. The prefix is then append-only for SLACK messages at
// a time, and pays for one full eval on the message that snaps it.
const KEEP = 80;
const SLACK = 20;

async function getWindow(channel) {
    const all = await getMessages(channel);
    if (!all.length) return all;

    const entry = cache.get(channel.id);
    if (!entry) return all.slice(0, KEEP);

    // newest-first, so the anchor's index is how many messages the window currently holds
    let idx = entry.windowAnchor ? all.findIndex((m) => m.id === entry.windowAnchor) : -1;
    if (idx === -1 || idx + 1 > KEEP + SLACK) idx = Math.min(KEEP, all.length) - 1;

    entry.windowAnchor = all[idx].id;
    return all.slice(0, idx + 1);
}

function invalidateChannel(channelId) {
    const entry = cache.get(channelId);
    if (entry) {
        totalBytes -= entry.byteSize;
        cache.delete(channelId);
    }
}

module.exports = { getMessages, getWindow, invalidateChannel };