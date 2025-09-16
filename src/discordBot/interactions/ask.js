const send_msg = require('../chat_bot/chat_generate')
const sysprompt = require('../chat_bot/getSystemPrompt')


const openAiPattern = /[^a-zA-Z0-9_-]/g;
function filterOPENAINAME(strName) {
    let newName = strName.replace(openAiPattern, '');
    if (!/[a-zA-Z]/.test(newName)) {
        newName = "anon";
    }
    return newName;
}

function getAutherName(author) {
  let auther_name = "anon";
  if (author.globalName){
    auther_name = author.globalName
  } else {
    auther_name = author.username
  }
  if (auther_name.length < 1){
    auther_name = "anon"
  }
  if (author.bot) {
    auther_name += " [bot]"
  }
  return auther_name;
}

module.exports = async (interaction) => {
    const userQuestion = interaction.options.getString('question');
    /*const messages = await interaction.channel.messages.fetch({ limit: 10 });
    messages.forEach(msg => {
        console.log(`[${msg.author.tag}]: ${msg.content}`);
    });*/

    const author = interaction.user;
    let systemMessage = {
      role: "system",
      content: sysprompt
    }
    const history = [
        systemMessage,
        {
            role: 'user',
            name: filterOPENAINAME(getAutherName(author)),
            content: userQuestion
        }
    ];

    const responseTxt = await send_msg(history)  
    try {
        if (responseTxt) {
            await interaction.channel.send(responseTxt);
        }

        await interaction.reply({
            content: 'a',
            withResponse: true,
        });

        const reply = await interaction.fetchReply();
        try {
            await reply.delete().catch((err) => {console.log(err)});
        } catch {}
    } catch (err) {
        if (responseTxt) {
            await interaction.reply({
                content: responseTxt
            });
        }
    }
};
