//const fetch = require('node-fetch');

const resolutionOptions = [
  [1024, 1024],  
  [1152, 896],
  [896, 1152],
  [1216, 832],
  //"832 x 1216",
  [1344, 768],
  //"768 x 1344"
];
const getRandomResolution = (options) => {
  const randomIndex = Math.floor(Math.random() * options.length);
  return options[randomIndex];
};

let drawingId = 5;
function cycleProxy() {
  //TODO
  return "https://airzy.ca/nfetch"
}

function generateSimpleHash(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let hash = '';
  
  for (let i = 0; i < length; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  
  return hash;
}

async function readStream(response) {
    const data2 = await response.text();
    const lines = data2.split("\n");

    let lastJsonData = null; 

    for (let line of lines) {
        if (line.startsWith("data: ")) {
            try {
              const newJson = JSON.parse(line.slice(6));
              if (newJson.event_id != null) {
                lastJsonData = newJson; // rid of "data: "
              }
            } catch (e) {
                console.error("err parsing JSON:", e);
            }
        }
    }

    return lastJsonData;
}

async function rawGen(inData, attempts) {
  try {
    const mainAgent = "\"Chromium\";v=\"134\", \"Not:A-Brand\";v=\"24\", \"Google Chrome\";v=\"134\""
    const mainReferer = "https://multimodalart-stable-diffusion-3-5-large-turbox.hf.space/?__theme=dark"
    const spaceQueue = "https://multimodalart-stable-diffusion-3-5-large-turbox.hf.space/gradio_api/queue"
    
    const sessionHash = generateSimpleHash()
    const bodyData = JSON.stringify({
      data: inData,
      event_data: null,
      fn_index: 1,
      trigger_id: 6,
      session_hash: sessionHash
    });

    
    const mainBody = JSON.stringify({
        url: spaceQueue+"/join?__theme=dark",
        options: {
          "headers": {
            "accept": "*/*",
            "accept-language": "en-CA,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
            "content-type": "application/json",
            "priority": "u=1, i",
            "sec-ch-ua": mainAgent,
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "sec-fetch-storage-access": "active",
            "x-zerogpu-token": process.env.xZeroGpuToken,
            "x-zerogpu-uuid": process.env.zZeroGpuUUID,
            "Referer": mainReferer,
            "Referrer-Policy": "strict-origin-when-cross-origin"
          },
          "body": bodyData,
          "method": "POST"
        }
    })
    
    const proxyHeaders = {
      'Content-Type': 'application/json',
      'Authorization': process.env.airWebToken
    }
    
    console.log("start draw: id ", drawingId)
    const usedProxy = cycleProxy();
    
    // SSE LOGIN
    const SUUID = generateSimpleHash()
    const sseBody = JSON.stringify({
        url: "https://api.hf.space/v1/multimodalart/stable-diffusion-3.5-large-turboX/sse?session_uuid="+SUUID,
        options: {
          "headers": {
            "accept": "text/event-stream",
            "accept-language": "en-CA,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
            "authorization": "Bearer "+process.env.xZeroGpuToken,
            "priority": "u=1, i",
            "sec-ch-ua": mainAgent,
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "cross-site",
            "Referer": "https://huggingface.co/",
            "Referrer-Policy": "strict-origin-when-cross-origin"
          },
          "body": null,
          "method": "GET"
        }
      })
    const sseResp = await fetch(usedProxy, {method: 'POST', headers: proxyHeaders, body: sseBody});
    if (sseResp.ok) {
      console.log("login ok")
    }
    
    // START PREDICT
    const response = await fetch(usedProxy, {method: 'POST', headers: proxyHeaders, body: mainBody});
    if (response.ok) {
      const data = await response.json();
      const event_id = data.event_id
      console.log(event_id, sessionHash);
      
      const mainBody2 = JSON.stringify({
        url: spaceQueue + "/data?session_hash="+sessionHash,
        options: {
          "headers": {
            "accept": "text/event-stream",
            "accept-language": "en-US,en;q=0.9",
            "content-type": "application/json",
            "priority": "u=1, i",
            "sec-ch-ua": mainAgent,
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "sec-fetch-storage-access": "active",
            "Referer": mainReferer,
            "Referrer-Policy": "strict-origin-when-cross-origin"
          },
          //"body": null,
          "method": "GET"
        }
      })
 
      const response2 = await fetch(usedProxy, {method: 'POST', headers: proxyHeaders, body: mainBody2});
      //.log(response2)
      if (response2.ok) {
        const jsonEnd = await readStream(response2);
        if (jsonEnd.success && jsonEnd.output) {
          console.log(jsonEnd.output.data[0].url)
          return {msg: jsonEnd.output.data[0].url}
        } else {
          if (jsonEnd && (jsonEnd.title == 'ZeroGPU queue' || jsonEnd.title == 'ZeroGPU quota exceeded')) {
            console.log("[ANIGEN res] RETRY " + usedProxy, jsonEnd);
            if (attempts == null) {
              attempts = 0
            }
            if (attempts < 6) {
              return await rawGen(inData, attempts + 1)
            } else {
              return "rate limit..."
            }
          } else {
            console.log("[ANIGEN res2] notsucess " + usedProxy, jsonEnd);
          }
        }
      } else {
        console.log("[ANIGEN res2] ERR " + usedProxy, response2);
        response2.text().then(a => console.log("[ANIGEN] ERR", a));
        return "read err"
      }
    } else {
      console.log("[ANIGEN res1] ERR " + usedProxy, response);
      response.text().then(a => console.log("[ANIGEN] ERR", a));
      return "read res1 err"
    }

  } catch (err) {
    console.log("[ANIGEN] ERR ", err)
    return err
  }
}


async function generate(input, upscale) {
  input = input.replace(/\bavy\b/gi, "1girl, blonde hair, red eyes");    
  input = input.replace(/\byou\b/gi, "1girl, blonde hair, red eyes");    
  input = input.replace(/\byourself\b/gi, "1girl, blonde hair, red eyes");  
  
  const resolution = getRandomResolution(resolutionOptions);
  const inData = [
    input, //input
    "", // negative
    2038347146, // seed
    true, // random seed
    resolution[0],
    resolution[1],
    1, // guidance scale
    upscale ? 20 : 8    // interf steps
  ]
  return await rawGen(inData)
}

module.exports = {
  generate,
  rawGen
};
