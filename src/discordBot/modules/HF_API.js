const GradioClient = require("./GradioClient.js");

const envDecrypt = require('../../envDecrypt.js');
const HFSpacesSecret = JSON.parse(
    envDecrypt(process.env.avyKey, process.env.HFSpacesSecret)
);

const carousel = HFSpacesSecret.carousel;
const drawClient = new GradioClient({
  baseUrl: "https://mrddickdickenson-krea-2-turbo-i2i.hf.space",
  apiName: "_generate_wrapper",
  tokens: carousel,
});

module.exports = {
    drawClient
};