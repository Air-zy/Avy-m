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

function buildLogitBiasFromHistory(history, bias = -1, exclude = []) {
    const window = 5;
    const ngramSeen = new Map();
    const msgSeen   = new Map();

    const excluded = new Set(
        exclude.flatMap(s => llama3Tokenizer.encode(s, { bos: false, eos: false }))
    );

    for (const msg of history) {
        if (msg.role !== 'assistant') continue;

        const ids = llama3Tokenizer.encode(msg.content, { bos: false, eos: false });

        if (ids.length < window) {
            const key = ids.join(',');
            if (!msgSeen.has(key)) msgSeen.set(key, { ids, count: 0 });
            msgSeen.get(key).count++;
        } else {
            const seenThisTurn = new Set();
            for (let i = 0; i <= ids.length - window; i++) {
                const ngram = ids.slice(i, i + window);
                const key   = ngram.join(',');
                if (seenThisTurn.has(key)) continue;
                seenThisTurn.add(key);
                if (!ngramSeen.has(key)) ngramSeen.set(key, { ids: ngram, count: 0 });
                ngramSeen.get(key).count++;
            }
        }
    }

    const logit_bias = {};

    const punish = ({ ids, count }, label) => {
        if (count < 2) return;
        const text = llama3Tokenizer.decode(ids);
        if (count > 2) {
            console.log(`[logit_bias] punishing ${label} (x${count}): "${text}"`);
        }
        for (const id of ids) {
            if (excluded.has(id)) continue;
            logit_bias[id] = Math.max((logit_bias[id] ?? 0) + bias * count, -20);
        }
    };

    for (const entry of msgSeen.values())   punish(entry, 'short msg');
    for (const entry of ngramSeen.values()) punish(entry, 'ngram');

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
        presence_penalty: 4,
        seed: Math.floor(Math.random() * 65536),
        logit_bias: buildLogitBiasFromHistory(history, -1, [
            'avy:',
            ' ||',
            '```',
            ' ```'
        ])
    };
}

const sysprompt = "ur a discord girl named avy whos witty explicit, repond as \"avy:\" dont repeat use few word";
module.exports = {
    generate,
    buildInputData,
    sysprompt
};
