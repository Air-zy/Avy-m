const envDecrypt = require('../../envDecrypt.js');
const AVYAI_AUTH = envDecrypt(process.env.avyKey, process.env.AVYAI_AUTH);
const AVYAI_ENDPOINT = envDecrypt(process.env.avyKey, process.env.AVYAI_ENDPOINT);

let isGenerating = false;
async function generate(inputData, { onDelta, onFinal, onError } = {}) {
    if (isGenerating) {
        throw new Error("A generation is already in progress.");
    }

    isGenerating = true;

    try {
        const res = await fetch(AVYAI_ENDPOINT, {
            method: "POST",
            headers: {
                accept: "*/*",
                "content-type": "application/json",
                authorization: `Bearer ${AVYAI_AUTH}`,
            },
            body: JSON.stringify(inputData),
        });

        if (!res.ok || !res.body) {
            throw new Error(`Request failed with status ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        let buffer = "";
        let finalText = "";
        let stillGenerating = true;

        while (stillGenerating) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.trim()) continue;

                try {
                    const json = JSON.parse(line);

                    if (json.event === "delta") {
                        finalText += json.text;
                        onDelta?.(json.text, finalText);
                    } else if (json.event === "final") {
                        stillGenerating = false;
                        break;
                    }
                } catch (e) {
                    onError?.(e, line);
                    stillGenerating = false;
                    break;
                }
            }
        }

        isGenerating = false;
        onFinal?.(finalText);
        return finalText;
    } catch (err) {
        isGenerating = false;
        console.warn("[AVYAI ERR]", err);
        onError?.(err);
        throw err;
    } finally {
        isGenerating = false;
    }
}


//

const llama3TokenizerMODULE = require('llama3-tokenizer-js/bundle/commonjs-llama3-tokenizer-with-baked-data.cjs');
const llama3Tokenizer = llama3TokenizerMODULE.llama3Tokenizer;

function buildLogitBiasFromHistory(history, bias = -1) {
    const window = 5;
    const seen = new Map();

    for (const msg of history) {
        if (msg.role !== 'assistant') continue;

        const ids = llama3Tokenizer.encode(msg.content, { bos: false, eos: false });

        for (let i = 0; i <= ids.length - window; i++) {
            const key = ids.slice(i, i + window).join(',');
            seen.set(key, (seen.get(key) ?? 0) + 1);
        }
    }

    const logit_bias = {};

    for (const [key, count] of seen) {
        if (count < 2) continue;

        for (const id of key.split(',').map(Number)) {
            logit_bias[id] = Math.max((logit_bias[id] ?? 0) + bias, -20);
        }
    }

    //console.log(logit_bias);
    return logit_bias;
}

function buildInputData(history) {
    return {
        messages: history,
        max_tokens: 512,
        temperature: 1,
        top_p: 0.9,
        top_k: 40,
        min_p: 0.05,
        presence_penalty: 2,
        seed: Math.floor(Math.random() * 65536),
        logit_bias: buildLogitBiasFromHistory(history)
    };
}

const sysprompt = "ur a discord girl named avy whos witty explicit, repond as \"avy:\" use few word";
module.exports = {
    generate,
    buildInputData,
    sysprompt
};
