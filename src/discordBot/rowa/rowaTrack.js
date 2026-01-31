async function getTotalPlayers(placeId) {
  let totalPlayers = 0;
  let nextPageCursor = null;

  do {
    const url = `https://games.roblox.com/v1/games/128262404314907/servers/Public?sortOrder=Asc&limit=100${nextPageCursor ? `&cursor=${nextPageCursor}` : ''}`;
    const json = await fetch(url);
    if (json.data) {
      for (const server of json.data) {
        totalPlayers += server.playing;
      }
      nextPageCursor = json.nextPageCursor
    };
  } while (nextPageCursor);

  return totalPlayers;
}

let lastPlrCount = 0
let lastRenameTime = 0;
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

async function startRowaTracker(client) {
  console.log("starting rowa tracker");
  setInterval( async () => {
    const totalPlrs = await getTotalPlayers()
    if (totalPlrs != lastPlrCount && (Date.now() - lastRenameTime > COOLDOWN_MS) ) {
      console.log("rowa plr count: ", totalPlrs)
      
      const found_channel = await client.channels.fetch("1359998910105522339");
      await found_channel.setName(`${totalPlrs} playing`);
            
      lastPlrCount = totalPlrs
      lastRenameTime = Date.now();
    }
  }, 60000); // every minute
}

module.exports = { startRowaTracker };