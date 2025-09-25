const { igdl, ttdl, fbdown, twitter, youtube } = require('btch-downloader');

const download = async (url) => {
  try {
    if (url.startsWith('https://www.instagram') || url.startsWith('https://instagram')) {
      const data = await igdl(url);
      return data[0].url;
    } else if (url.startsWith('https://www.tiktok') || url.startsWith('https://tiktok')) {
      const data = await ttdl(url);
      return data.video[0];
    } else if (url.startsWith('https://www.facebook') || url.startsWith('https://facebook')) {
      const data = await fbdown(url);
      return data;
    } else if (url.startsWith('https://twitter') || url.startsWith('https://x')) {
      const data = await twitter(url);
      return data.url[1].sd;
    } else if (
      url.startsWith('https://youtube') ||
      url.startsWith('https://www.youtube')
    ) {
      const data = await youtube(url)
      return data.mp4;
    } else {
      console.log('URL not supported:', url);
    }
  } catch(err) {
    console.log("[downloadAny.js err]", err)
  }
};

module.exports = download
