// props to staticaliza <3
const apiEndpoint = "https://api.staticaliza.com/v1/image-generation";

const resolutionOptions = [
  [1024, 1024],
  [1152, 896],
  [896, 1152],
  [1216, 832],
  [1344, 768],
];

const getRandomResolution = (options) => {
  const randomIndex = Math.floor(Math.random() * options.length);
  return options[randomIndex];
};

function generateSimpleHash(length = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let hash = "";
  for (let i = 0; i < length; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

const envDecrypt = require('../envDecrypt.js');
const STATICALIZA_API_KEY = envDecrypt(process.env.avyKey, process.env.staticalKey);
async function rawGen(body) {
    const resp = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STATICALIZA_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const response = await resp.json()
    const imgb64 = response.data.output;
    const buffer = Buffer.from(imgb64, "base64");
    return { msg: buffer };
}

/**
 * generate(prompt, upscale)
 * Builds the body according to your requested template and calls rawGen.
 *
 * Body shape used:
 * {
 *   input: "prompt string",
 *   negative_input: "negative prompt",
 *   target_image: null | "BASE64_IMAGE_STRING",
 *   model: "Default",
 *   use_json: false,
 *   resolution: [w,h],
 *   steps: 25,
 *   guidance: 7,
 *   post_resolution: [w,h],
 *   remove_background: false,
 *   lossy: true,
 *   progressive: false,
 *   seed: 12345
 * }
 */
async function generate(input, upscale = false, opts = {}) {
  if (!input || typeof input !== "string") throw new Error("generate: input prompt required");

  // replacements from your original code
  input = input.replace(/\bavy\b/gi, "1girl, blonde hair, red eyes");
  input = input.replace(/\byou\b/gi, "1girl, blonde hair, red eyes");
  input = input.replace(/\byourself\b/gi, "1girl, blonde hair, red eyes");

  const resolution = getRandomResolution(resolutionOptions);

  // Map upscale to more steps / guidance — tweak as you prefer
  const steps = upscale ? 40 : 25;
  const guidance = upscale ? 20 : 7;

  // allow override via opts
  const model = opts.model || "Default";
  const target_image = opts.target_image || null; // if provided, must be base64 string
  const seed = (typeof opts.seed === "number") ? opts.seed : Math.floor(Math.random() * 2 ** 31);

  const body = {
    input: input,
    negative_input: opts.negative_input || "bad quality, worst quality, drawing, old, ugly",
    target_image: target_image,
    model: model,
    use_json: !!opts.use_json,
    resolution: resolution,
    steps: steps,
    guidance: guidance,
    post_resolution: opts.post_resolution || resolution,
    remove_background: !!opts.remove_background,
    lossy: ("lossy" in opts) ? !!opts.lossy : true,
    progressive: !!opts.progressive,
    seed: seed,
  };

  // optional request_id/session id for tracing
  body.request_id = generateSimpleHash(12);

  return await rawGen(body);
}

module.exports = {
  generate,
  rawGen,
};
