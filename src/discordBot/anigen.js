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

  const prompt = body.input
  const negativePrompt = "blurry, low quality, worst quality, bad score, low score, messy, bad anatomy, animated, duplicated, clones, low resolution, abstract, lowres, painting, text, technology, malformed, Chibi, masterpiece"

  const input = {
    "input": prompt,
    "negative_input": negativePrompt,
    "width": resolution[0],
    "height": resolution[1],
    "steps": body.steps || 28,
    "guidance": body.guidance || 5,
    "seed": body.seed,
    "sampler": "Euler a"
  }

  console.log("drawing:", input)
  const json = JSON.stringify(input);
  const result = await HF_API.drawClient.generate(json);
  const resultData = result[0];
  const imgb64 = resultData.image_base64;
  const buffer = Buffer.from(imgb64, "base64");
  return { msg: buffer };
}

async function generate(input, upscale = false, opts = {}) {
  if (!input || typeof input !== "string") throw new Error("generate: input prompt required");

  // replacements from your original code
  input = input.replace(/\bavy\b/gi, "1girl, blonde hair, red eyes");
  input = input.replace(/\byou\b/gi, "1girl, blonde hair, red eyes");
  input = input.replace(/\byourself\b/gi, "1girl, blonde hair, red eyes");

  const resolution = getRandomResolution(resolutionOptions);

  const steps = 28;
  const guidance = 5;

  const seed = (typeof opts.seed === "number") ? opts.seed : Math.floor(Math.random() * 2 ** 31);

  const body = {
    input: input,
    resolution: resolution,
    steps: steps,
    guidance: guidance,
    seed: seed,
  };

  return await rawGen(body);
}

module.exports = {
  generate,
  rawGen,
};
