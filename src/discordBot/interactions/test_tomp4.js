// node src/discordBot/interactions/test_tomp4.js
// The CDN 403s intermittently with a 30-byte error page; discord.js would upload
// those 30 bytes named .mp4. Stubbed fetch, no network.
const assert = require('assert');
const { fetchVideo } = require('./tomp4.js');

let queue;
global.fetch = async () => queue.shift();

const res = (status, body, len) => ({
    ok: status < 400,
    status,
    headers: { get: () => String(len ?? body.length) },
    text: async () => body,
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
});

(async () => {
    // the actual bug: a 403 error page must never become an attachment
    queue = [res(403, 'An error occurred (code: 1-4).'), res(403, 'An error occurred (code: 1-4).')];
    let [video, err] = await fetchVideo('u');
    assert.strictEqual(video, null);
    assert.match(err, /403 An error occurred/);

    // it is transient, so the retry is the whole point of retrying
    queue = [res(403, 'nope'), res(206, 'MP4BYTES')];
    [video, err] = await fetchVideo('u');
    assert.strictEqual(err, null);
    assert.strictEqual(video.toString(), 'MP4BYTES');

    // oversize never reaches arrayBuffer: 1GB box, content-length is the gate
    queue = [res(206, 'x', 999 * 1024 * 1024)];
    [video, err] = await fetchVideo('u');
    assert.strictEqual(video, null);
    assert.strictEqual(typeof err, 'number', 'size failures must stay numeric so the handler posts the link');

    // network throw is not a crash
    queue = [];
    global.fetch = async () => { throw new Error('ECONNRESET'); };
    [video, err] = await fetchVideo('u');
    assert.strictEqual(video, null);
    assert.match(err, /ECONNRESET/);

    console.log('tomp4 ok');
})();
