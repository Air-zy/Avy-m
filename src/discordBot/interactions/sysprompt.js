module.exports = async (interaction, client) => {
    const prompt = interaction.options.getString("prompt")
    if (!prompt) {
      return interaction.reply({ content: "No prompt provided.", ephemeral: true });
    }

    console.log("set sysPrompTO",prompt)
    await interaction.reply({ content: "setting prompt..." });
};
