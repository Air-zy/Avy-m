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

  // edit_img end to end: finds the url on the message, then edits it
  const editTool = require("./chat_bot/tools/edit_img.js");
  const deferred = [];
  const sent = [];
  const ctx = {
    message: {
      attachments: [{ contentType: "image/png", url: "https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/diffusers/cat.png" }],
      embeds: []
    },
    send: async (p) => sent.push(p),
    defer: (p) => deferred.push(p)
  };

  assert((await editTool.run({ instruction: "" }, ctx)).includes("no instruction"), "edit: empty instruction not caught");
  assert((await editTool.run({ instruction: "x" }, { message: { attachments: [], embeds: [] } })).includes("no recent image"), "edit: missing image not caught");

  await editTool.run({ instruction: "give the cat a tiny red wizard hat" }, ctx);
  await Promise.all(deferred);
  assert(sent.length === 1 && isPng(sent[0].files?.[0]?.attachment), "edit: no png sent");
  console.log("ok edit -", sent[0].files[0].attachment.length, "bytes");
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
