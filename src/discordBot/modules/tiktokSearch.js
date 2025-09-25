//const fetch = require('node-fetch'); 
const envDecrypt = require('../../envDecrypt.js');
const ttwid = envDecrypt(process.env.avyPublicClusterKey, process.env.ttwid);

class Base62 {
  constructor() {
    this.alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    this.base = this.alphabet.length;
  }

  encode(number) {
    if (number === 0) return this.alphabet[0];
    let result = '';
    while (number > 0) {
      result = this.alphabet[number % this.base] + result;
      number = Math.floor(number / this.base);
    }
    return result;
  }

  decode(string) {
    let result = 0;
    for (let i = 0; i < string.length; i++) {
      result = result * this.base + this.alphabet.indexOf(string[i]);
    }
    return result;
  }
}


async function TikTokSearch(prompt, pages) {
  const resp = await fetch("https://www.tiktok.com/api/search/general/full/?from_page=search&keyword="+prompt+"&", {
    "headers": {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "max-age=0",
      "priority": "u=0, i",
      "sec-ch-ua": "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Windows\"",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
      "cookie": ttwid
    },
    "referrerPolicy": "strict-origin-when-cross-origin",
    "body": null,
    "method": "GET"
  });
  
  try {
    const data = await resp.json()
    return data.data;
  } catch (err) {
    console.log("[Tiktok Search JSON FAIL]", err, resp)
  }
}

module.exports = {TikTokSearch, Base62};