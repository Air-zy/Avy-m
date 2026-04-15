const { generate, buildInputData, sysprompt } = require('../chat_bot/avyai.js');

const DISCORD_LIMIT = 2000;
const STREAM_UPDATE_MS = 900;

function formatForDiscord(text) {
  if (!text) return '';
  if (text.length <= DISCORD_LIMIT) return text;
  return '…' + text.slice(-(DISCORD_LIMIT - 1));
}

module.exports = async (interaction) => {
  const userQuestion = interaction.options.getString('question');
  const author = interaction.user;

  console.log(author, 'asks:', userQuestion);

  await interaction.deferReply();

  const history = [
    {
      role: 'system',
      content: sysprompt,
    },
    {
      role: 'user',
      content: userQuestion,
    },
  ];

  const inputData = buildInputData(history);
  inputData.temperature = 0.5
  inputData.presence_penalty = 1

  let raw = '';
  let lastRendered = '';
  let finished = false;
  let timer = null;

  const flush = async () => {
    if (!interaction.deferred && !interaction.replied) return;

    const next = formatForDiscord(raw);

    if (next === lastRendered) return;
    lastRendered = next;

    try {
      await interaction.editReply(next || '...');
    } catch (err) {
      console.log('editReply failed:', err);
    }
  };

  const scheduleFlush = () => {
    if (timer) return;

    timer = setTimeout(async () => {
      timer = null;
      await flush();

      if (!finished) {
        scheduleFlush();
      }
    }, STREAM_UPDATE_MS);
  };

  try {
    await interaction.editReply('...');

    await generate(inputData, {
      onDelta: (chunk) => {
        if (typeof chunk !== 'string' || !chunk.length) return;

        raw += chunk;
        scheduleFlush();
      },

      onFinal: async () => {
        finished = true;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }

        await flush();
      },
    });

    finished = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    await flush();
  } catch (err) {
    console.error(err);

    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    try {
      await interaction.editReply('Something went wrong while generating the response.');
    } catch (e) {
      console.log('final editReply failed:', e);
    }
  }
};