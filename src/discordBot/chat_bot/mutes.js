// A mute here only stops avy answering. The person keeps talking, everyone else still
// sees them, and she still reads them in the history -- she just does not reply until it
// expires. No discord permission is involved and nothing is hidden: this is not a timeout.
//
// In memory on purpose: a restart clears them, which is the right failure direction for
// something that tops out at an hour anyway.
const MAX_MINUTES = 60;
const DEFAULT_MINUTES = 5;

const mutes = new Map();   // userId -> expiry timestamp

function mute(userId, minutes) {
    const asked = Math.round(Number(minutes)) || DEFAULT_MINUTES;
    const mins = Math.max(1, Math.min(MAX_MINUTES, asked));
    mutes.set(userId, Date.now() + mins * 60000);
    return mins;
}

function isMuted(userId) {
    const until = mutes.get(userId);
    if (!until) return false;
    if (until > Date.now()) return true;

    mutes.delete(userId);
    return false;
}

function unmute(userId) {
    return mutes.delete(userId);
}

module.exports = { mute, isMuted, unmute, MAX_MINUTES };
