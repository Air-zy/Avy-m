class GradioClient {
    constructor({
        baseUrl,
        apiName = "generate",
        tokens = [],
    }) {
        this.baseUrl = baseUrl.replace(/\/$/, "");
        this.apiName = apiName;
        this.tokens = tokens;
        this.tokenIndex = 0;
    }

    getNextToken() {
        if (!this.tokens.length) return null;

        const token = this.tokens[this.tokenIndex];
        this.tokenIndex = (this.tokenIndex + 1) % this.tokens.length;
        return token;
    }

    buildHeaders() {
        const headers = { "Content-Type": "application/json" };
        const token = this.getNextToken();
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
        return headers;
    }

    // The /gradio_api/call/ convenience route reports every failure as a bare
    // `event: error` with a null body -- the reason never leaves the server. The queue
    // protocol underneath it carries the real message, so this speaks that instead.
    // Costs one /config fetch, once, to turn the api_name into the fn_index it wants.
    async resolveFn() {
        if (this.fn) return this.fn;

        const res = await fetch(`${this.baseUrl}/config`, { headers: this.buildHeaders() });
        if (!res.ok) throw new Error(`config ${res.status} ${res.statusText}`);

        const dep = (await res.json()).dependencies.find((d) => d.api_name === this.apiName);
        if (!dep) throw new Error(`space has no endpoint called ${this.apiName}`);

        this.fn = { id: dep.id, triggerId: dep.targets?.[0]?.[0] };
        return this.fn;
    }

    async generate(data) {
        const fn = await this.resolveFn();
        const sessionHash = Math.random().toString(36).slice(2);

        const join = await fetch(`${this.baseUrl}/gradio_api/queue/join`, {
            method: "POST",
            headers: this.buildHeaders(),
            body: JSON.stringify({
                data,
                event_data: null,
                fn_index: fn.id,
                trigger_id: fn.triggerId,
                session_hash: sessionHash,
            }),
        });

        if (!join.ok) {
            throw new Error(`queue/join ${join.status} ${join.statusText}\n${await join.text()}`);
        }

        const { event_id } = await join.json();
        return this.readStream(sessionHash, event_id);
    }

    async readStream(sessionHash, eventId) {
        const res = await fetch(
            `${this.baseUrl}/gradio_api/queue/data?session_hash=${sessionHash}`,
            { headers: this.buildHeaders() }
        );

        if (!res.ok) throw new Error(`queue/data ${res.status} ${res.statusText}`);
        if (!res.body) throw new Error("No response body returned by the server.");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buf += decoder.decode(value, { stream: true });

            let idx;
            while ((idx = buf.indexOf("\n\n")) !== -1) {
                const block = buf.slice(0, idx).trim();
                buf = buf.slice(idx + 2);
                if (!block) continue;

                let msg;
                try {
                    msg = JSON.parse(block.replace(/^data:\s*/, ""));
                } catch { continue; }

                // the stream carries the whole session, so skip other calls' events
                if (msg.event_id && msg.event_id !== eventId) continue;

                if (msg.msg === "process_completed") {
                    reader.cancel().catch(() => { });
                    if (msg.success) return msg.output.data;

                    // title is the useful half: "ZeroGPU quota exceeded", and so on
                    const reason = msg.output?.error || "the space gave no reason";
                    throw new Error(msg.title ? `${msg.title} - ${reason}` : reason);
                }

                if (msg.msg === "close_stream") break;
            }
        }

        throw new Error("the space closed the stream without returning anything");
    }
}

module.exports = GradioClient;
