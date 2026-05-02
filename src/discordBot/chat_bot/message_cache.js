const MAX_CACHE_BYTES = 10 * 1024 * 1024; // 10MB

const cache = new Map();
let totalBytes = 0;

function estimateBytes(messages) {
    return messages.reduce((n, m) => n + (m.content?.length ?? 0) * 2 + 300, 0);
}

function evict() {
    while (totalBytes > MAX_CACHE_BYTES && cache.size > 0) {
        let oldestId, oldestEntry, oldestTime = Infinity;
        for (const [id, entry] of cache) {
            if (entry.lastAccess < oldestTime) {
                oldestTime = entry.lastAccess;
                oldestId = id;
                oldestEntry = entry;
            }
        }
        totalBytes -= oldestEntry.byteSize;
        cache.delete(oldestId);
    }
}

async function getMessages(channel) {
    const id = channel.id;
    const now = Date.now();
    const entry = cache.get(id);

    if (!entry) {
        const fetched = await channel.messages.fetch({ limit: 100, cache: true });
        const messages = [...fetched.values()]; // newest first
        const byteSize = estimateBytes(messages);
        const newestId = messages[0]?.id ?? null;

        totalBytes += byteSize;
        cache.set(id, { messages, newestId, byteSize, lastAccess: now });
        evict();
        return messages;
    }

    entry.lastAccess = now;

    if (!entry.newestId) return entry.messages;

    const delta = await channel.messages.fetch({ limit: 100, after: entry.newestId, cache: true });

    if (delta.size === 0) return entry.messages;

    const newMessages = [...delta.values()].reverse();
    const merged = [...entry.messages, ...newMessages].slice(0, 200).reverse();

    const deltaBytes = estimateBytes(newMessages);
    const trimCount = (entry.messages.length + newMessages.length) - merged.length;
    const trimmedBytes = trimCount > 0 ? estimateBytes(newMessages.slice(-trimCount)) : 0;
    const newByteSize = entry.byteSize + deltaBytes - trimmedBytes;

    totalBytes -= entry.byteSize;
    totalBytes += newByteSize;

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