const HF_API = require('./modules/HF_API.js');

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

async function rawGen(body) {
  //console.warn(body)
  const resolution = getRandomResolution(resolutionOptions)
  const input = {
    input: body.input,
    negative_input: body.negative_input,
    reference_image: null,
    resolution: resolution,
    steps: body.steps,
    guidance: body.guidance,
    post_resolution: resolution,
    crop: false,
    remove_background: false,
    safety_check: false,
    safety_input: "Determine if this prompt contains violence.",
    output_format: "Base64 PNG",
    seed: body.seed
  };

  const json = JSON.stringify(input);
  const result = await HF_API.drawClient.generate(json);
  const resultData = result[0];
  const imgb64 = resultData.output;
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
 *   use_json: false,
 *   resolution: [w,h],
 *   steps: 25,
 *   guidance: 7,
 *   post_resolution: [w,h],
 *   remove_background: false,
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
  const steps = upscale ? 16 : 8;
  const guidance = 1;

  const target_image = opts.target_image || null; // if provided, must be base64 string
  const seed = (typeof opts.seed === "number") ? opts.seed : Math.floor(Math.random() * 2 ** 31);

  const body = {
    input: input,
    negative_input: null,//opts.negative_input || "bad quality, worst quality, drawing, old, ugly",
    target_image: target_image,
    use_json: !!opts.use_json,
    resolution: resolution,
    steps: steps,
    guidance: guidance,
    post_resolution: opts.post_resolution || resolution,
    remove_background: !!opts.remove_background,
    seed: seed,
  };

  return await rawGen(body);
}

module.exports = {
  generate,
  rawGen,
};
