async function resolveChannelById(client, rawId) {
  const id = String(rawId ?? '').replace(/\D/g, '');
  if (!id) return null;

  try {
    const user = await client.users.fetch(id);
    if (user?.id) {
      const dmChannel = await user.createDM();
      if (dmChannel) return dmChannel;
    }
  } catch (_) {
    // Not a user; try a guild channel.
  }

  try {
    return await client.channels.fetch(id);
  } catch (_) {
    return null;
  }
}

// True only for channels in servers owned by one of the bot's developers.
// Keeps message-reading admin tools out of other people's servers and DMs.
function isDeveloperOwnedChannel(channel, authorizedUsers) {
  const ownerId = channel?.guild?.ownerId;
  return Boolean(ownerId) && authorizedUsers.includes(String(ownerId));
}

module.exports = { resolveChannelById, isDeveloperOwnedChannel };
