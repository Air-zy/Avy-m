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

function invalidateChannel(channelId) {
    const entry = cache.get(channelId);
    if (entry) {
        totalBytes -= entry.byteSize;
        cache.delete(channelId);
    }
}

module.exports = { getMessages, invalidateChannel };