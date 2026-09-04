// Discord is the only record of a conversation and it holds no trace of tool calls, so
// without this every search, run, and result is gone by the next message -- avy can see
// what she said about a page but not the page. respond_process is what witnesses the
// calls, build_history is what needs them back, so the trace parks here in between.
//
// Entries are anchored to the id of the user message whose turn produced them, and are
// dropped only when that message falls out of the history window. Expiring them per-turn
// instead would make the block appear and vanish under the same prefix every message,
// re-evaluating the whole tail each time -- the mistake the old `[old msg]` splice made.
const MAX_RESULT_CHARS = 400;

// Her thinking is kept across turns too: this template renders it back as `assistant
// to=self` rather than dropping prior-turn reasoning, so the model gets to see why it
// said what it said. Capped because it is spent on every turn in the window from here on.
const MAX_REASONING_CHARS = 800;

// ponytail: a memory backstop, not a policy -- 25 tool turns anchored inside an 80-message
// window is already pathological. Raise it if a channel ever legitimately gets there.
const MAX_PER_CHANNEL = 25;

const memory = new Map();   // channelId -> [{ anchorId, entries }]

// entries are the assistant(tool_calls) and tool messages of one turn, in order. The text
// she spoke is left out on purpose -- Discord already has it, and storing it here would
// put it in the history twice. finalReasoning is the thinking behind the reply she ended
// on; it has no message of its own to sit in (an assistant message with reasoning and no
// content renders a stray empty turn) so build_history hangs it on the Discord reply.
function remember(channelId, anchorId, entries, finalReasoning = "") {
    if (!channelId || !anchorId || (!entries.length && !finalReasoning)) return;

    const trimmed = entries.map((m) => m.role === "tool"
        ? { ...m, content: String(m.content).slice(0, MAX_RESULT_CHARS) }
        : { ...m, ...(m.reasoning_content ? { reasoning_content: m.reasoning_content.slice(0, MAX_REASONING_CHARS) } : {}) });

    const list = memory.get(channelId) || [];
    list.push({ anchorId, entries: trimmed, finalReasoning: finalReasoning.slice(0, MAX_REASONING_CHARS) });
    if (list.length > MAX_PER_CHANNEL) list.splice(0, list.length - MAX_PER_CHANNEL);
    memory.set(channelId, list);
}

// Prunes to what is still in the window and returns anchorId -> entries for the walk.
function recall(channelId, liveIds) {
    const list = memory.get(channelId);
    if (!list) return null;

    const kept = list.filter((e) => liveIds.has(e.anchorId));
    if (kept.length) memory.set(channelId, kept);
    else memory.delete(channelId);

    return new Map(kept.map((e) => [e.anchorId, e]));
}

function forget(channelId) {
    memory.delete(channelId);
}

module.exports = { remember, recall, forget };
