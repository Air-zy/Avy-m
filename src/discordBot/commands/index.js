const fs = require('fs');
const path = require('path');

function loadCommands() {
  const commands = new Map();
  const dir = __dirname;

  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.js')) continue;
    if (file === 'index.js') continue;

    const cmd = require(path.join(dir, file));
    if (!cmd || typeof cmd.execute !== 'function' || !cmd.name) continue;

    commands.set(String(cmd.name).toLowerCase(), cmd);

    if (Array.isArray(cmd.aliases)) {
      for (const alias of cmd.aliases) {
        commands.set(String(alias).toLowerCase(), cmd);
      }
    }
  }

  return commands;
}

module.exports = { loadCommands };
