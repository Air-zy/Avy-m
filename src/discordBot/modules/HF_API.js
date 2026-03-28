const GradioClient = require("./GradioClient.js");

const envDecrypt = require('../../envDecrypt.js');
const HFSpacesSecret = JSON.parse(
    envDecrypt(process.env.avyKey, process.env.HFSpacesSecret)
);

const carousel = HFSpacesSecret.carousel;
const drawClient = new GradioClient({
  baseUrl: HFSpacesSecret.url1,
  apiName: "generate",
  tokens: carousel,
});

module.exports = {
    drawClient
};