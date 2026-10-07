// Live check against the Krea2 Turbo space. Fails if the 41-arg payload drifts.
// HF_TOKEN=hf_... node src/discordBot/test_anigen.js
// Without a token this burns the anonymous ZeroGPU quota and starts erroring after a
// couple of runs -- the space reports that as a bare `event: error` with null data.
const path = require("path"), Module = require("module"), assert = require("assert");
const GradioClient = require("./modules/GradioClient.js");

// stub HF_API so the encrypted env secret isn't needed
const id = require.resolve("./modules/HF_API.js");
const stub = new Module(id);
stub.filename = id;
stub.loaded = true;
stub.exports = {
  drawClient: new GradioClient({
    baseUrl: "https://mrddickdickenson-krea-2-turbo-i2i.hf.space",
    apiName: "_generate_wrapper",
    tokens: process.env.HF_TOKEN ? [process.env.HF_TOKEN] : [],
  }),
};
require.cache[id] = stub;

const isPng = (b) => Buffer.isBuffer(b) && b.length > 10000 && b.subarray(0, 4).toString("hex") === "89504e47";

(async () => {
  const { msg } = await require("./anigen.js").generate("avy in a flower field", false, { seed: 777 });
  assert(isPng(msg), "draw: no png bytes");
  console.log("ok draw -", msg.length, "bytes");
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
