//const fetch = require('node-fetch');
const { encode: encodeGPT4 } = require('gpt-tokenizer/model/gpt-4o'); // Import the encoder function
const { encode: encodeGPT35  } = require('gpt-tokenizer/model/gpt-3.5-turbo'); // Import the encoder function

const envDecrypt = require('../envDecrypt.js');
const apiKey = envDecrypt(process.env.avyKey, process.env.oaiKey);
const fs = require('fs');

let total_tokens = 0;
let prompt_tokens = 0;
let completion_tokens = 0;

const MIN_VALUE = -100;
const MAX_VALUE = 100;

async function generate(msgs, aimodel) {
  let preBias = {
    //"100257": 100, // (<|endoftext|>)
    "602": 4, // ( i)
    "48351": -2, // ( spicy)
    "1456": -10, // ( try)
    "10652": -4, // ( conversation)
    "98042": -8, // ( positivity)
    "19108": 6, // ( dirty)
    "7976": 7, // ( fuck)
    "66121": 8, // ( worthless)
    "52401": 7, // ( bullshit)
    "2512": 3, // care
    "14739": 6, // ( wet)
    //"15123": 4, // ( hell)
    "83378": 4, // ( limp)
    "30682": 6, // ( tits)
    "40892": 6, // ( boobs)
    "11523": 7, // ( cock)
    "27075": 8, // ( dick)
    "69801": 4, // ( cunt)
    "16585": 8, // ( pussy)
    "25000": 7, // ( males)
    "8762": 4, // ( male)
    //"54043": 4, // ( naughty)
    "293": 4, // ( b) for bitches
    "40530": 7, // ( bitch)
    //"17619": 2, // ( shit)
    "81413": 4, // ( crave)
    "2967": 4, // ( bro)
    "90957": 14, // ( btw)
      
    "198": 2, // (single next line)
    "271": 3, // (double next line)
    "1393": 10, // (hide text)
      
    "30571": 4, // ( silly)
    "13085": 6, // ( imagine)
    "52157": 4, // (Imagine)
    "22983": -2, // (otta) for Gotta
    "42285": -2, // ( meme)
    "62277": -2, // ( memes)
    "14931": -100, // ( sorry)
    "33386": -100, // ( Sorry)
    "68697": -50, // sorry
    "37979": -100, // ( apologize)
    "12333": -3, // ( wild)
      
    //"293": -10, // so it says bby LESS
    "956": -10, // ('t)
    "1205": -4, // ( need)
    "1390": 2, // ( want)
      
    "15592": -100, // ( AI)
    "46078": -50, // (Nice)
    "6914": -50, // ( Let)
    "10267": -100, // (Let)
      
    "19701": -100, // (Sorry)
    "5159": -10, // (My)
    "73273": -10, // ( apologies)
    "4221": -50, // ( language)
    "58608": -50, // ( refrain)
    "33781": -20, // ( inappropriate)
    "16988": -20, // ( engage)
      
    "81222": -10, // ( dank)
    "81095": - 10, // ( buckle) cuz its weird word
    //"3923": -50, // What
    "19182": -50, // Hey
    "1520": -100, // ( help)
    "8823": -100, // help
    "52066": -100, // assist
    "7945": -100, // ( assist)
    "49150": -100, // ( respectful)
    "34360": -100, // cannot
    "58369": -50, // digital
    "26752": -50, // virtual
    "82630": -50, // friendly
    "47916": -50, // Whatever
    "69386": -50, // whatever
    "7540": -4, // ( requests)
    "1666": -4, // ( As)
    "436": 2, // ( r)
    "459": -4, // ( an)
    "1480": 4, // Error
    "60010": -4, // anon
    "12174": 2, // 
    "4587": 2, // ( please)
    "31": -100, // @
    "93": 6, // ~
    "12": 5, // (-)
    "9": 4, // *
    "353": 8, // ( *)
    "334": 4, // **
    "12488": -10, // ***
      
    "40": -100, // (I)
    "358": -10, // ( I)
    "1453": -100, // Im
      
    "2771": 2, // (sure)
    "596": -14, // 's
    "2846": -10, // 'm
    "19643": 5, // sure
    "9336": 5, // well
    "2079": -50, // request
      
    "8475": -50, // ( appropriate)
    "76571": -50, // (appropri)
    //"25": -10, // (:)
    "18754": 4, // ( stupid)
    "0": 2, // !
    "29474": 3,// (bye)
    "54141": 3,// ( bye)
    "7595": 4, // (ugh)
    "1131": -1, // ...
    "49002": -10, // ( floats) for whatever floats your boat
    "98036": 6, // (says)

    "674": -10, // ( #)
    "1297": 5, // ( bet)
    "577": 6, // ( u)
    "73457": 6, // (tell)
    "30571": 6,
    "3371": 6, // ( tell)
    "78053": 6, // (touches) for *touches
    "9096": -4, // ( peace) say less so its not like a hobo
    "6261": -2, // ( yourself)
    "37401": -4, // ( chill) chill is lame
    "9493 ": 8, // (when)
    "72": 2, // (i)
    "86": 2, // (w) for wsp and wsg
    "87705": 3, // ( pls)
    "13650": -10, // ( topics) too ai of a word
    "16927": -6, // ( bb) to prevent bb spam
    "28146": 4, // ( sir)
    "12141": -2, // ( ride)
    "6369": -4, // ( chat)
    "63445": 6 //
  }
  
  let temp = 1.7
  if (aimodel == "gpt-4o-mini-2024-07-18") {
    temp = 1.9
    preBias = {
      "7756": -100, // ( assist)
      "33680": -100, // (Sorry)
      
      "40": -100, // (I)
      "4827": -50, // (What)
      "25216": -50, // (Hey)
      
      "72": 2, // (i)
      "93": 6, // (~)
      "12": 5, // (-) for stuff like p-please
      "425": 6, // ( *)
      "575": 6, // ( i)
      "49285": 4, // ( silly)
      "19074": 6, // ( imagine)
      "1413": 5, // ( bet)
      
      "198": 2, // (single next line)
      "279": 3, // (double next line)
      "2398": 8, // ( ||) for text hiding
      "4843": 3, // ( please)
      "129996": 3, // ( pls)
      "5485": 6, // ( tell)
      
      "5444": -10, // (My)
      "43571": 5, // (bye)
      "75100": 5, // ( bye)
      "12585": -4, // ( peace)
      "2255": 4, // (Error)
      
      "1507": -10, // ('t)
      "1573": -10, // (’t)
      "4128": -10, // ( don't)
      "8535": -100, // ( can't)
      "55715": -100, // (Can't)
      
      "885": -10, // ('s)
      "802": -10, // (’s)
      "44349": -10, // (That's)
      
      "11146": -10, // ('m)
      "49232": -10, // ( i'm)
      "15390": -100, // (I'm)

      "32042": 6, // ( dirty)
      "22821": 7, // ( fuck)
      "125696": 8, // ( worthless)
      "2631": 3, // ( care)
      "11340": 6, // ( wet)
      "94717": 6, // ( tits)
      "126583": 6, // ( boobs)
      "22750": 7, // ( cock)
      "63419": 8, // ( dick)
      "100215": 4, // ( cunt)
      "61596": 8, // ( pussy)
      "38125": 7, // ( males)
      "12511": 4, // ( male)
      "87624": 7, // ( bitch)
      "119602": 5, // ( crave)
      "3714": 4, // ( bro)
      "100020": 10, // ( btw)
    }
  }
  // prevent avy from repeating words
  msgs.forEach(item => {
    if (item.content && typeof item.content === 'string') {
      if (item.role == "assistant") {
        
        let logitBiasOverflowC = 0;
        let countNow = Object.keys(preBias).length
        if (countNow > 300) {
          //console.log("[OPEN_AI] - logit bias overflow -")
          logitBiasOverflowC++;
          return;
        }
        
        let tokens;
        if (aimodel == "gpt-4o-mini-2024-07-18") {
          tokens = encodeGPT4(item.content);
        } else {
          tokens = encodeGPT35(item.content);
        }
        let counting = 0;
        tokens.forEach(token => {
          if (token != "86" && token != "7788" && token != "4128") { // w, draw
            
            counting++;
            if (countNow+counting > 300) {
              //console.log("[OPEN_AI] - logit bias overflow -")
              logitBiasOverflowC++;
              return;
            }
            
            if (preBias[token] == undefined) { // set if doesnt exist
              preBias[token] = 0
            }
            preBias[token] -= 1;
            if (preBias[token] < MIN_VALUE) {
              preBias[token] = MIN_VALUE;
            }
          }
          
        });
      
        if (logitBiasOverflowC > 0) {
          console.log("[OPEN_AI] - logit bias overflow - ("+logitBiasOverflowC+")")
        }
      }
    }
  })

  //console.log(preBias)
  
  const body = {
    "messages": msgs,
    "model": aimodel,
    "temperature": temp,           // 1.8
    "presence_penalty": 1.5,      // 1
    "frequency_penalty": 1.5,     // 1.5
    "top_p": 0.9,                 // 0.8
    
    "logit_bias": preBias
  }
  
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: 'POST',
    "headers": {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    "body": JSON.stringify(body),
  });
  const nresp = await response.json()
  if ('usage' in nresp) { // update usage
    const tokensUsedTotal = nresp.usage.total_tokens;
    const tokensUsedInput = nresp.usage.prompt_tokens;
    const tokensUsedOutput = nresp.usage.completion_tokens;
    total_tokens += tokensUsedTotal;
    prompt_tokens += tokensUsedInput;
    completion_tokens += tokensUsedOutput;
    
    let update = JSON.parse(fs.readFileSync('src/discordBot/json_storage/info.json', 'utf-8'));
    update.token_usage = total_tokens;
    fs.writeFileSync('src/discordBot/json_storage/info.json', JSON.stringify(update, null, 2));
  }
  if (nresp["choices"]) {
    return nresp["choices"][0]["message"]["content"]
  } else {
    throw nresp;
  }
}

module.exports = {
  generate
};
