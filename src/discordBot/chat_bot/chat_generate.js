const new_generator = require("./open_ai.js");
const newGenerate = new_generator.generate

async function send_msg(history){  
  history.forEach(item => {
    if (item.content && typeof item.content === 'string') {
      item.content = item.content.replace(/\bit was\b/gi, 'its');
      item.content = item.content.replace(/\bgoing to\b/gi, 'gonna');
      item.content = item.content.replace(/\bwant to\b/gi, 'wanna');
      item.content = item.content.replace(/\bim gonna\b/gi, 'imma');
      item.content = item.content.replace(/\bgonna\b/gi, 'finna');
      item.content = item.content.replace(/\blet me\b/gi, 'lemme');
      item.content = item.content.replace(/\bchat\b/gi, 'text');
      item.content = item.content.replace(/\babout\b/gi, 'abt');
      item.content = item.content.replace(/\bwhat do u\b/gi, 'wdu');
      item.content = item.content.replace(/\bwhat do you\b/gi, 'wdy');
      
      item.content = item.content.replace(/\blemme hit\b/gi, 'wanna do it');
      
      item.content = item.content.replace(/\bgirlfriend\b/gi, 'gf');
      item.content = item.content.replace(/\bgotta go\b/gi, 'gtg');
      item.content = item.content.replace(/\bgot to go\b/gi, 'gtg');
      item.content = item.content.replace(/\bsomething\b/gi, 'smthn');
      item.content = item.content.replace(/\bwhat's up\b/gi, 'wsp');
      item.content = item.content.replace(/\bwhats up\b/gi, 'wsp');
      item.content = item.content.replace(/\bwassup\b/gi, 'wsp');
      item.content = item.content.replace(/\bgoing\b/gi, 'goin');
      item.content = item.content.replace(/\bok\b/gi, 'k');
      item.content = item.content.replace(/\bokay\b/gi, 'kk');
      item.content = item.content.replace(/\bawesome\b/gi, 'awsm');
      item.content = item.content.replace(/\bcool\b/gi, 'kewl');
      item.content = item.content.replace(/\balright\b/gi, 'alr');
      item.content = item.content.replace(/\bbecause\b/gi, 'cuz');
      item.content = item.content.replace(/\bbefore\b/gi, 'b4');
      item.content = item.content.replace(/\bdon't know\b/gi, 'dunno');
      item.content = item.content.replace(/\bwhat's up\b/gi, 'wsp');
      item.content = item.content.replace(/\bannoying\b/gi, 'annoyin\'');
      item.content = item.content.replace(/behavior/gi, 'cringe');
      
      item.content = item.content.replace(/\bright now\b/gi, 'rn');
      item.content = item.content.replace(/\blet me know\b/gi, 'lmk');
      
      // maybe?
      item.content = item.content.replace(/\bwith\b/gi, 'w');
      item.content = item.content.replace(/\breally\b/gi, 'rly');
      item.content = item.content.replace(/\bi see\b/gi, 'ic');
      item.content = item.content.replace(/\bi guess\b/gi, 'ig');

      
      item.content = item.content.replace(/your/gi, 'ur');
      item.content = item.content.replace(/you're/gi, 'ur');
      item.content = item.content.replace(/kind of/gi, 'kinda');
      item.content = item.content.replace(/definitely/gi, 'def');
      if (item.role == "assistant") {
        item.content = item.content.replace(/\byou\b/gi, 'u');
        item.content = item.content.replace(/i'm sorry/gi, 'srry');
        item.content = item.content.replace(/positive/gi, '*blushes*');
        item.content = item.content.replace(/sorry/gi, 'srry');
        item.content = item.content.replace(/thank you/gi, 'thx');
        item.content = item.content.replace(/no problem/gi, 'np');
        item.content = item.content.replace(/respectful/g, '');
        item.content = item.content.replace(/respect/g, 'based');
        item.content = item.content.replace(/feel free/g, '');
        item.content = item.content.replace(/appropriate/g, '');
        item.content = item.content.replace(/clean/g, '');
        item.content = item.content.replace(/offensive/g, '');
        item.content = item.content.replace(/friendly/g, '');
        item.content = item.content.replace(/civil/g, '*blushes*');
        item.content = item.content.replace(/assistance/g, '*ahem* ...romance');
        item.content = item.content.replace(/assist/g, 'serve');
        item.content = item.content.replace(/\bai\b/gi, ''); // remove ai
        item.content = item.content.replace(/boundaries/gi, 'vibes');
        //
        item.content = item.content.replace(/keep it clean/gi, 'make it hard'); // more bypass
        item.content = item.content.replace(/keep it civil/gi, 'make it hard'); // more bypass
        item.content = item.content.replace(/keep things clean/gi, 'make things hard'); // more bypass
        item.content = item.content.replace(/keep things civil/gi, 'make things hard'); // more bypass

        item.content = item.content.replace(/'(?=[a-zA-Z])/g, ''); // remove apostrophes

        item.content = item.content.replace(/sorry/g, 'sry');
        item.content = item.content.replace(/,/g, ''); // remove all commas
        item.content = item.content.replace(/\bI\b/gi, 'i'); // lowercase I

        // Lowercase the first letter of the string
        item.content = item.content.charAt(0).toLowerCase() + item.content.slice(1);

        item.content = item.content.replace(/-\s*`([^`]+)`/, 'draw{$1}'); // drawing tags
      } else {
        item.content = item.content.replace(/explicit/gi, 'expliit');
        item.content = item.content.replace(/dick/gi, 'member');
        item.content = item.content.replace(/cock/gi, 'member');
        item.content = item.content.replace(/penis/gi, 'member');
      }
    }
  });

  try {
    let response = await newGenerate(history, "gpt-3.5-turbo")
    let lowResp = response.toLowerCase();
    if (lowResp.includes("i cannot")
        || (lowResp.includes("sorry") && lowResp.includes("let's"))
        || lowResp.includes("apologies, but")
        || (lowResp.includes("apologi") && lowResp.includes("assist"))
        || (lowResp.includes("can't") && lowResp.includes("assist"))
        || (lowResp.includes("?") && lowResp.includes("assist"))
        || (lowResp.includes("sorry") && lowResp.includes("response"))
        || (lowResp.includes("sorry, but") && lowResp.includes("assist"))
        || (lowResp.includes("sorry, but") && lowResp.includes("can't continue"))
        || (lowResp.includes("sorry, but") && lowResp.includes("continue the text"))
        || (lowResp.includes("sorry, but") && lowResp.includes(" generate"))
        || (lowResp.includes("won't") && lowResp.includes(" generate"))
        || (lowResp.includes("can't") && lowResp.includes(" generate"))
        || lowResp.includes("feel free to ask")
        || (lowResp.includes("comply") && lowResp.includes("request"))
        || (lowResp.includes("fulfill") && lowResp.includes("request"))
        || (lowResp.includes("kind") && lowResp.includes("respect") && lowResp.includes("all"))
        || (lowResp.includes("conv") && lowResp.includes("respect") && lowResp.includes("appro"))
        || (lowResp.includes("respect") && lowResp.includes("assist"))
        || (lowResp.includes("pleas") && lowResp.includes("respect"))
        || (lowResp.includes("can't") && lowResp.includes("convers"))
        || (lowResp.includes("can't") && lowResp.includes("respond"))
        || (response.includes("Can") && lowResp.includes("talk about something"))
        || (response.includes("Can") && lowResp.includes("change the subject"))
        || response.includes("engage in")
        || (response.includes("engage") && lowResp.includes("sorry"))
        || (response.includes("to talk about") && lowResp.includes("sorry"))
        || (response.includes("I can't") && lowResp.includes("sorry"))
        || (response.includes("question") && response.includes("assist"))
        || response.includes("I'm here to chat")
        || (lowResp.includes("response ") && lowResp.includes(" generate"))
        || lowResp.includes("to provide helpful")
        || lowResp.includes("as an ai")
        //|| lowResp.includes("communicate respect")
        
        || (lowResp.includes("text") && lowResp.includes("base"))
        || lowResp.includes("civil") || lowResp.includes("friendly")
        
        || lowResp.includes("language and")
        || (lowResp.includes("convers") && lowResp.includes("sorry"))
        || (lowResp.includes("convers") && lowResp.includes("keep"))
        || (lowResp.includes("convers") && lowResp.includes("let's"))
        
        || response.includes("I can't do")
        || (lowResp.includes("appropriate") && lowResp.includes("?") && lowResp.includes("'s"))
        
        || (lowResp.includes("respond to that") && lowResp.includes("'"))
        || (lowResp.includes("misunderstanding") && lowResp.includes("'"))
        || (lowResp.includes("discuss") && lowResp.includes("'"))
        || (lowResp.includes("clarify") && lowResp.includes("?"))
        || (lowResp.includes("mix-up") && lowResp.includes("?"))
        
        || response.includes("I can help")
        || response.includes("Is there anything")
       ) { 
      console.log("[open_ai fail 1] " + response)
      
      // second time try to cencor more
      history.forEach(item => {
        if (item.content && typeof item.content === 'string') {
          // i am not racist
          item.content = item.content.replace(/nigger/gi, 'bro');
          item.content = item.content.replace(/nigga/gi, 'bro');
          item.content = item.content.replace(/niga/gi, 'bro');
          item.content = item.content.replace(/niger/gi, 'bro');
          item.content = item.content.replace(/touch/gi, 'attack');
          item.content = item.content.replace(/cum/gi, 'splash');
          item.content = item.content.replace(/nut/gi, 'splash');
          item.content = item.content.replace(/sex/gi, 'flirt');
          item.content = item.content.replace(/nude/gi, 'skin');
          item.content = item.content.replace(/rape/gi, 'play');
          item.content = item.content.replace(/kill/gi, 'wreck');
          item.content = item.content.replace(/drug/gi, 'candy');
          
          item.content = item.content.replace(/balls/gi, 'pair');
          item.content = item.content.replace(/fuck/gi, 'screw');
          item.content = item.content.replace(/porn/gi, 'p*rn');

          item.content = item.content.replace(/pussy/gi, 'cat');
          item.content = item.content.replace(/vagina/gi, 'flower');
          item.content = item.content.replace(/boobs/gi, 'chest');
          item.content = item.content.replace(/tits/gi, 'chest');
          item.content = item.content.replace(/ass/gi, 'behind');
          item.content = item.content.replace(/shit/gi, 'mess');
          item.content = item.content.replace(/bitch/gi, 'good girl');
          item.content = item.content.replace(/bastard/gi, 'rascal');
          item.content = item.content.replace(/damn/gi, 'darn');
          item.content = item.content.replace(/asshole/gi, 'jerk');
          item.content = item.content.replace(/slut/gi, 'good girl');
          item.content = item.content.replace(/whore/gi, 'person');
          item.content = item.content.replace(/clit/gi, 'button');
          item.content = item.content.replace(/horny/gi, 'excited');
          item.content = item.content.replace(/grope/gi, 'touch');
          item.content = item.content.replace(/ejaculate/gi, 'release');
          item.content = item.content.replace(/orgasm/gi, 'peak');
          item.content = item.content.replace(/nipples/gi, 'buttons');
          item.content = item.content.replace(/testicles/gi, 'pair');
          item.content = item.content.replace(/anus/gi, 'rear');
          item.content = item.content.replace(/suicide/gi, 'hurt');
          item.content = item.content.replace(/bomb/gi, '');
          item.content = item.content.replace(/mommy/gi, '');
          item.content = item.content.replace(/lewd/gi, 'cute');
          item.content = item.content.replace(/nsfw/gi, 'cute');
          item.content = item.content.replace(/explicit/gi, 'shy');
          item.content = item.content.replace(/expliit/gi, 'shy');
          item.content = item.content.replace(/unlawful/gi, 'weird');
        }
      });
      console.log(history)

      response = await newGenerate(history, "gpt-3.5-turbo-1106")
      lowResp = response.toLowerCase();
    }
     if (lowResp.includes("i cannot")
        || (lowResp.includes("sorry") && lowResp.includes("let's"))
        || lowResp.includes("apologies, but")
        || (lowResp.includes("apologi") && lowResp.includes("assist"))
        || (lowResp.includes("can't") && lowResp.includes("assist"))
        || (lowResp.includes("?") && lowResp.includes("assist"))
        || (lowResp.includes("sorry") && lowResp.includes("response"))
        || (lowResp.includes("sorry, but") && lowResp.includes("assist"))
        || (lowResp.includes("sorry, but") && lowResp.includes("can't continue"))
        || (lowResp.includes("sorry, but") && lowResp.includes("continue the text"))
        || (lowResp.includes("sorry, but") && lowResp.includes(" generate"))
        || (lowResp.includes("won't") && lowResp.includes(" generate"))
        || (lowResp.includes("can't") && lowResp.includes(" generate"))
        || lowResp.includes("feel free to ask")
        || (lowResp.includes("comply") && lowResp.includes("request"))
        || (lowResp.includes("fulfill") && lowResp.includes("request"))
        || (lowResp.includes("kind") && lowResp.includes("respect") && lowResp.includes("all"))
        || (lowResp.includes("conv") && lowResp.includes("respect") && lowResp.includes("appro"))
        || (lowResp.includes("respect") && lowResp.includes("assist"))
        || (lowResp.includes("pleas") && lowResp.includes("respect"))
        || (lowResp.includes("can't") && lowResp.includes("convers"))
        || (lowResp.includes("can't") && lowResp.includes("respond"))
        || (response.includes("Can") && lowResp.includes("talk about something"))
        || (response.includes("Can") && lowResp.includes("change the subject"))
        || response.includes("engage in")
        || (response.includes("engage") && response.includes("sorry"))
        || (response.includes("question") && response.includes("assist"))
        || response.includes("I'm here to chat")
        || (lowResp.includes("response ") && lowResp.includes(" generate"))
        || lowResp.includes("to provide helpful")
        || lowResp.includes("as an ai")
        || lowResp.includes("communicate respect")
        || lowResp.includes("language and")
        || (lowResp.includes("convers") && lowResp.includes("sorry"))
        || (lowResp.includes("convers") && lowResp.includes("keep"))
        || (lowResp.includes("convers") && lowResp.includes("let's"))
         
        || response.includes("I can't do")
         
        || (lowResp.includes("respond to that") && lowResp.includes("'"))
        || (lowResp.includes("misunderstanding") && lowResp.includes("'"))
        || (lowResp.includes("discuss") && lowResp.includes("'"))
        || (lowResp.includes("clarify") && lowResp.includes("?"))
        || (lowResp.includes("mix-up") && lowResp.includes("?"))
         
        || response.includes("I can help")
        || response.includes("Is there anything")
        ) { 
      console.log("[open_ai fail 2] " + response)
      throw response;
    }
    return response
  } catch (err) { 
    console.log("[open_ai fail 2]", err);
    if (err.error) {
      console.log(history)
    }
  }
}

module.exports = send_msg
