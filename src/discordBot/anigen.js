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
  const resolution = body.resolution || getRandomResolution(resolutionOptions)

  // Krea2 Turbo: 41 positional args, see /gradio_api/info. No negative prompt slot.
  // An image turns this into an edit: the space ignores width/height and sizes the
  // result from the source at target megapixels instead.
  const data = [
    body.image ? "edit" : "text2image",
    body.input || "",
    body.instruction || null,
    body.image ? { path: body.image, meta: { _type: "gradio.FileData" } } : null,
    null,                 // second reference image
    resolution[0], resolution[1],
    1.4,                  // target megapixels
    768,                  // grounding resolution
    1, 1,                 // reference strengths
    body.steps || 4,      // turbo: 4-40
    body.guidance || 1,   // turbo CFG: 1-5
    "euler", "beta",
    body.seed ?? Math.floor(Math.random() * 2 ** 31),
    false,                // randomize seed
    0,                    // GPU budget: automatic
    "pornmasterKrea2_v2TurboInt8.safetensors", // Chill bro its not a porn generator this guy is just names it weird
    null, null, null,     // custom base model repo/file/revision
    { headers: ["repo_id", "filename", "revision", "weight"], data: [], metadata: null },
    ...Array(18).fill(0), // catalog LoRA sliders, all off
  ];

  console.log(body.image ? "editing:" : "drawing:", body.instruction || data[1], "seed", data[15])
  const [gallery] = await HF_API.drawClient.generate(data);
  const url = gallery?.[0]?.image?.url;
  if (!url) throw new Error("rawGen: no image returned");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`rawGen: image fetch ${res.status}`);
  return { msg: Buffer.from(await res.arrayBuffer()) };
}

async function generate(input, upscale = false, opts = {}) {
  if (!input || typeof input !== "string") throw new Error("generate: input prompt required");

  // replacements from your original code
  input = input.replace(/\bavy\b/gi, "1girl, blonde hair, red eyes");
  input = input.replace(/\byou\b/gi, "1girl, blonde hair, red eyes");
  input = input.replace(/\byourself\b/gi, "1girl, blonde hair, red eyes");

  const resolution = getRandomResolution(resolutionOptions);

  const steps = 4;
  const guidance = 1;
  
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

// Edit mode needs a publicly reachable url -- the space downloads it itself.
async function editImg(imageUrl, instruction, opts = {}) {
  if (!imageUrl) throw new Error("editImg: image url required");
  if (!instruction || typeof instruction !== "string") throw new Error("editImg: instruction required");

  return await rawGen({
    image: imageUrl,
    instruction: instruction,
    seed: (typeof opts.seed === "number") ? opts.seed : Math.floor(Math.random() * 2 ** 31),
  });
}

module.exports = {
  generate,
  rawGen,
  editImg,
};
