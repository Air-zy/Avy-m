const { generate, buildInputData, sysprompt } = require('../chat_bot/avyai.js')

module.exports = async (interaction) => {
    const userQuestion = interaction.options.getString('question');
    const author = interaction.user;
    console.log(author,"asks:",userQuestion)
    let systemMessage = {
      role: "system",
      content: sysprompt
    }
    const history = [
        systemMessage,
        {
            role: 'user',
            content: userQuestion
        }
    ];

    const inputData = buildInputData(history)
    const responseTxt = await generate(inputData)  
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
