const { igdl, ttdl, fbdown, twitter, youtube } = require('btch-downloader');

async function getInstagramReelVideoUrl(reelPageUrl) {
  if (!reelPageUrl || typeof reelPageUrl !== 'string') throw new TypeError('reelPageUrl must be a string');
  const apiKey = process.env.rapidApiKey;
  if (!apiKey) throw new Error('Missing RapidAPI key in process.env.rapidApiKey');

  // https://www.instagram.com/reels/DVugk2YDOi9/
  // https://www.instagram.com/reel/DVugk2YDOi9/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ==
  const m = reelPageUrl.match(/\/reel(?:s)?\/([^\/?#]+)/i);
  if (!m) throw new Error('Invalid reel URL — expected /reel/<shortcode> or /reels/<shortcode>');
  const shortcode = decodeURIComponent(m[1]);

  const endpoint = 'https://social-media-video-downloader.p.rapidapi.com/instagram/v3/media/post/details';
  const url = `${endpoint}?shortcode=${encodeURIComponent(shortcode)}&renderableFormats=720p,highres`;

  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': 'social-media-video-downloader.p.rapidapi.com',
      'Accept': 'application/json'
    }
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`API error ${resp.status}: ${t}`);
  }

  const body = await resp.json();
  console.log(body.contents)
  const videoUrl = body.contents?.[0]?.videos?.[0]?.url;

  if (!videoUrl) throw new Error('Video URL not found in response.content[0].videos[0].url');

  return videoUrl;
}

const download = async (url) => {
  try {
    if (url.startsWith('https://www.instagram') || url.startsWith('https://instagram')) {
      const data = await getInstagramReelVideoUrl(url);
      return [data, null];
    } else if (url.startsWith('https://www.tiktok') || url.startsWith('https://tiktok')) {
      const data = await ttdl(url);
      return [data.video[0], null];
    } else if (url.startsWith('https://www.facebook') || url.startsWith('https://facebook')) {
      const data = await fbdown(url);
      return [data, null];
    } else if (url.startsWith('https://twitter') || url.startsWith('https://x')) {
      const data = await twitter(url);
      return [data.url[1].sd, null];
    } else if (
      url.startsWith('https://youtube') ||
      url.startsWith('https://www.youtube')
    ) {
      const data = await youtube(url)
      return [data.mp4, null];
    } else {
      return [null, 'URL not supported: '+url];
      console.log('URL not supported:', url);
    }
  } catch(err) {
    console.log("[downloadAny.js err]", err)
    return [null, '[downloadAny.js err] '+err];
  }
};

module.exports = download
