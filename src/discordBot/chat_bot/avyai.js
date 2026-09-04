const envDecrypt = require('../../envDecrypt.js');
const AVYAI_AUTH = envDecrypt(process.env.avyKey, process.env.AVYAI_AUTH);
const AVYAI_ENDPOINT = envDecrypt(process.env.avyKey, process.env.AVYAI_ENDPOINT);
// The Space is private: HF's gateway needs an HF token, and it consumes this header
// rather than forwarding it, leaving Authorization free for llama-server's own key.
const AVYAI_HF_AUTH = envDecrypt(process.env.avyKey, process.env.AVYAI_HF_AUTH);

const sysprompt = envDecrypt(process.env.avyKey, process.env.SYSTEM_PROMPT);

const { stripAvyPrefix } = require('./helpers.js');

// The model routes a tool call to the `to=<tool>` channel most of the time, but it
// sometimes emits the block on `to=user` instead, where llama.cpp hands it back as
// plain content. The template states this format "is parsed with regular expressions",
// so we recover those rather than leak raw markup into Discord and lose the call.
const ATEM_CALL = /<atem:function_calls>\s*<atem:invoke name="([^"]+)">([\s\S]*?)<\/atem:invoke>\s*<\/atem:function_calls>/g;
const ATEM_PARAM = /<atem:parameter name="([^"]+)">([\s\S]*?)<\/atem:parameter>/g;

// Monotonic, not per-message: these ids end up in tool_memory and several remembered
// turns share one history. Reusing `atem_0` for all of them renders fine here (the
// template keys off the tool name) but is a malformed message array anywhere else.
let atemCallSeq = 0;

function parseAtemCalls(text) {
    const calls = [];
    for (const m of text.matchAll(ATEM_CALL)) {
        const args = {};
        for (const p of m[2].matchAll(ATEM_PARAM)) args[p[1]] = p[2].trim();
        calls.push({ id: `atem_${atemCallSeq++}`, type: "function",
                     function: { name: m[1], arguments: JSON.stringify(args) } });
    }
    return calls;
}

// How much of `s` is safe to stream: everything before a complete "<atem:", and also
// short of a trailing fragment of it, so half a marker never reaches a Discord message.
const MARKER = "<atem:";
function visibleLength(s) {
    const full = s.indexOf(MARKER);
    if (full !== -1) return full;
    for (let n = Math.min(MARKER.length - 1, s.length); n > 0; n--) {
        if (MARKER.startsWith(s.slice(s.length - n))) return s.length - n;
    }
    return s.length;
}

let isGenerating = false;

// llama-server speaks OpenAI SSE: `data: {...}` lines, terminated by `data: [DONE]`.
// delta.reasoning_content carries the model's hidden channel. It never goes to Discord,
// but it is handed to onFinal so a tool round can send it back: the template renders it
// as `assistant to=self`, which is where the model expects to find its own thinking.
async function generate(inputData, { onDelta, onFinal, onError } = {}) {
    if (isGenerating) {
        throw new Error("A generation is already in progress.");
    }

    isGenerating = true;
    abortPrefill();   // a real turn must never queue behind a speculative one

    try {
        const res = await fetch(AVYAI_ENDPOINT, {
            method: "POST",
            headers: {
                accept: "text/event-stream",
                "content-type": "application/json",
                authorization: `Bearer ${AVYAI_AUTH}`,
                "x-hf-authorization": `Bearer ${AVYAI_HF_AUTH}`,
            },
            body: JSON.stringify(inputData),
        });

        if (!res.ok || !res.body) {
            throw Object.assign(
                new Error(`Request failed with status ${res.status}: ${(await res.text()).slice(0, 200)}`),
                { status: res.status }
            );
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        let buffer = "";
        let raw = "";        // user-channel text, markup included
        let emitted = 0;     // how much of it has been streamed out
        let reasoning = "";  // the hidden channel, for the next round of the same turn
        const toolAcc = new Map();

        stream: while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                // skips blank separators and `: keep-alive` comment frames
                if (!trimmed.startsWith("data:")) continue;

                const payload = trimmed.slice(5).trim();
                if (payload === "[DONE]") break stream;

                const json = JSON.parse(payload);
                if (json.error) {
                    throw Object.assign(new Error(json.error.message || "stream error"), { status: json.error.code });
                }

                const delta = json.choices?.[0]?.delta;
                if (!delta) continue;

                for (const tc of delta.tool_calls || []) {
                    const cur = toolAcc.get(tc.index)
                        || { id: tc.id, type: "function", function: { name: "", arguments: "" } };
                    if (tc.id) cur.id = tc.id;
                    if (tc.function?.name) cur.function.name = tc.function.name;
                    if (tc.function?.arguments) cur.function.arguments += tc.function.arguments;
                    toolAcc.set(tc.index, cur);
                }

                if (delta.reasoning_content) reasoning += delta.reasoning_content;

                if (!delta.content) continue;
                raw += delta.content;

                const safe = visibleLength(raw);
                if (safe > emitted) {
                    const chunk = raw.slice(emitted, safe);
                    emitted = safe;
                    onDelta?.(chunk, raw.slice(0, safe));
                }
            }
        }

        const finalText = raw.slice(0, visibleLength(raw)).trimEnd();
        const toolCalls = toolAcc.size ? [...toolAcc.values()] : parseAtemCalls(raw);

        console.log("avy:", stripAvyPrefix(finalText));
        onFinal?.(finalText, toolCalls, reasoning);
        return finalText;
    } catch (err) {
        console.warn("[AVYAI ERR]", err);
        onError?.(err);
        throw err;
    } finally {
        isGenerating = false;
    }
}

// After a turn, re-submit the conversation so llama-server encodes it into its slot KV
// cache while the user is still reading the reply. Next turn then only has to evaluate the
// new message. Worth it because the prompt cannot be reused as generated: avy's own turn
// comes back re-rendered from Discord (emoji stripped, messages merged, `avy:` gone) and
// the tool block comes back truncated from tool_memory, so the tail diverges every time.
//
// Best-effort by design: it never holds isGenerating, so an incoming message is never
// dropped for it, and generate() aborts it on the way in.
let prefillAbort = null;

function abortPrefill() {
    prefillAbort?.abort();
    prefillAbort = null;
}

async function prefill(inputData) {
    if (isCurrentlyGenerating()) return false;

    abortPrefill();
    const controller = new AbortController();
    prefillAbort = controller;

    try {
        const res = await fetch(AVYAI_ENDPOINT, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                authorization: `Bearer ${AVYAI_AUTH}`,
                "x-hf-authorization": `Bearer ${AVYAI_HF_AUTH}`,
            },
            // max_tokens 1 rather than 0: the prompt eval is the whole point and every
            // build accepts 1, while 0 means "unlimited" on some of them.
            body: JSON.stringify({ ...inputData, stream: false, max_tokens: 1 }),
            signal: controller.signal
        });

        await res.text();   // drain, or the connection is held open
        return res.ok;
    } catch {
        return false;       // aborted, or the server is away. Nothing to do either way.
    } finally {
        if (prefillAbort === controller) prefillAbort = null;
    }
}

// Rendered into the system block, which is the stable cached prefix, so the ~460 tokens
// of tool definitions cost one prompt-eval and then ride the cache (prompt_n 1 on warm).
// tools/index -> self_info -> build_history -> avyai is a require cycle, so this reads
// .TOOLS at call time; destructuring here captures undefined when avyai loads first.
const toolRegistry = require('./tools');

function buildInputData(history) {
    return {
        messages: history,
        tools: toolRegistry.TOOLS,
        stream: true,
        max_tokens: 8192,
        temperature: 1.0,
        top_p: 0.95,
        top_k: 64,
        min_p: 0.08,
        seed: Math.floor(Math.random() * 65536),
        // The template defaults reasoning_strength to 'high', which burns the whole
        // max_tokens budget in the hidden channel and returns an empty reply.
        chat_template_kwargs: { reasoning_strength: "low" }
    };
}

// A tool round trip is two generate() calls with tool execution in between, and image
// generation in that gap takes seconds. isGenerating alone goes false there, which would
// let the next Discord message start a second conversation straight into the same
// channel, so respond_process holds this across the whole turn.
let turnActive = false;
const beginTurn = () => { turnActive = true; };
const endTurn = () => { turnActive = false; };

function isCurrentlyGenerating() {
    return isGenerating || turnActive;
}

module.exports = {
    generate,
    prefill,
    buildInputData,
    sysprompt,
    isCurrentlyGenerating,
    beginTurn,
    endTurn
};
