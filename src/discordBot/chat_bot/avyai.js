const envDecrypt = require('../../envDecrypt.js');
const AVYAI_AUTH = envDecrypt(process.env.avyKey, process.env.AVYAI_AUTH);
const AVYAI_ENDPOINT = envDecrypt(process.env.avyKey, process.env.AVYAI_ENDPOINT);
// The Space is private: HF's gateway needs an HF token, and it consumes this header
// rather than forwarding it, leaving Authorization free for llama-server's own key.
const AVYAI_HF_AUTH = envDecrypt(process.env.avyKey, process.env.AVYAI_HF_AUTH);

const sysprompt = envDecrypt(process.env.avyKey, process.env.SYSTEM_PROMPT);

// The model routes a tool call to the `to=<tool>` channel most of the time, but it
// sometimes emits the block on `to=user` instead, where llama.cpp hands it back as
// plain content. The template states this format "is parsed with regular expressions",
// so we recover those rather than leak raw markup into Discord and lose the call.
const ATEM_CALL = /<atem:function_calls>\s*<atem:invoke name="([^"]+)">([\s\S]*?)<\/atem:invoke>\s*<\/atem:function_calls>/g;
const ATEM_PARAM = /<atem:parameter name="([^"]+)">([\s\S]*?)<\/atem:parameter>/g;

function parseAtemCalls(text) {
    const calls = [];
    for (const m of text.matchAll(ATEM_CALL)) {
        const args = {};
        for (const p of m[2].matchAll(ATEM_PARAM)) args[p[1]] = p[2].trim();
        calls.push({ id: `atem_${calls.length}`, type: "function",
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
// delta.reasoning_content carries the model's hidden channel and is dropped on purpose.
async function generate(inputData, { onDelta, onFinal, onError } = {}) {
    if (isGenerating) {
        throw new Error("A generation is already in progress.");
    }

    isGenerating = true;

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

        console.log("avy:", finalText, toolCalls.length ? `+${toolCalls.length} tool call(s)` : "");
        onFinal?.(finalText, toolCalls);
        return finalText;
    } catch (err) {
        console.warn("[AVYAI ERR]", err);
        onError?.(err);
        throw err;
    } finally {
        isGenerating = false;
    }
}

// Rendered into the system block, which is the stable cached prefix, so the ~460 tokens
// of tool definitions cost one prompt-eval and then ride the cache (prompt_n 1 on warm).
const TOOLS = [
    {
        type: "function",
        function: {
            name: "draw",
            description: "draw image. comma separated tags.",
            parameters: {
                type: "object",
                properties: { tags: { type: "string", description: "comma separated danbooru tags" } },
                required: ["tags"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "self_info",
            description: "creator?, and the current channel, server, user, and time.",
            parameters: { type: "object", properties: {}, required: [] }
        }
    },
    {
        type: "function",
        function: {
            name: "run_code",
            description: "run python3",
            parameters: {
                type: "object",
                properties: { code: { type: "string", description: "python source" } },
                required: ["code"]
            }
        }
    }
];

function buildInputData(history) {
    return {
        messages: history,
        tools: TOOLS,
        stream: true,
        max_tokens: 1024,
        temperature: 1.0,
        top_p: 0.95,
        top_k: 64,
        min_p: 0.08,
        // DRY penalises repeated *sequences*, which is what the old hand-rolled n-gram
        // logit_bias was badly approximating. Its default breakers include ':', so the
        // `avy:` prefix survives. dry_penalty_last_n must be >= 0 on this build (b10752
        // rejects -1), and its default of 64 is too short to reach into the history.
        dry_multiplier: 0.8,
        dry_penalty_last_n: 4096,
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
    buildInputData,
    sysprompt,
    isCurrentlyGenerating,
    beginTurn,
    endTurn
};
