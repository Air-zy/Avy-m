const fs = require('fs');
const path = require('path');

const { loadCommands } = require('./commands');
const { toText, reverseLines } = require('./modules/text');

let client;
let discordjs;
let Permissions;
let commands;
let cmdprefix = '!';
let authorizedUsers = [];

function loadConfig() {
  const configPath = path.join('src', 'discordBot', 'json_storage', 'configs.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(raw)[0] || {};
  cmdprefix = config.prefix ?? '!';
  authorizedUsers = Array.isArray(config.authorized_users) ? config.authorized_users.map(String) : [];
}

function pass_exports(p_client, p_discordjs, p_Permissions) {
  client = p_client;
  discordjs = p_discordjs;
  Permissions = p_Permissions;
  loadConfig();
  commands = loadCommands();
}

function buildContext(message) {
  return {
    message,
    client,
    discordjs,
    Permissions,
    utils: { toText, reverseLines },
    config: {
      cmdprefix,
      authorizedUsers,
    },
  };
}

async function handle_cmds(message) {
  if (!message?.content || !message.content.startsWith(cmdprefix)) return;
  if (!commands) return;

  const words = message.content.trim().split(/\s+/);
  const commandName = words[0].slice(cmdprefix.length).toLowerCase();
  const command = commands.get(commandName);
  if (!command) return;

  const authorId = toText(message.author?.id);
  if (command.adminOnly && !authorizedUsers.includes(String(authorId))) return;

  try {
    await command.execute(buildContext(message));
  } catch (error) {
    console.error(`[cmds] command "${commandName}" failed:`, error);
    try {
      await message.channel.send(`command "${commandName}" failed: ${error.message}`);
    } catch (_) {}
  }
}

module.exports = {
  handle_cmds,
  pass_exports,
};
