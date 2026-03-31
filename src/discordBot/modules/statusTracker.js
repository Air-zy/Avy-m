const MultiYearStatusLog = require('./classes/MultiYearStatusLog.js');

function startHourlyStatusLogger(log, getStatus, saveLog) {
    let timerId = null;

    async function logCurrentHour() {
        const now = new Date();
        const status = getStatus();
        const isOnline = status ?? false;

        log.set(now, isOnline);

        console.log(
            `${now.toISOString().slice(0, 13)}:00Z -> ${isOnline ? 'online' : 'offline'}`
        );

        // save each upd
        try {
            await saveLog(log);
        } catch (err) {
            console.error('[Status Tracker] failed to save log', err);
        }
    }

    function scheduleNextRun() {
        const now = new Date();
        const nextHour = new Date(now);

        nextHour.setUTCMinutes(0, 0, 0);
        nextHour.setUTCHours(nextHour.getUTCHours() + 1);

        const delay = nextHour.getTime() - now.getTime();

        timerId = setTimeout(async () => {
            await logCurrentHour();
            scheduleNextRun();
        }, delay);
    }

    logCurrentHour();
    scheduleNextRun();

    return () => {
        if (timerId !== null) clearTimeout(timerId);
        timerId = null;
    };
}

//


let currentStatus = null; // true = online, false = offline, null = unknown
let stopHourlyLogger = null;

function statusUpd(newStatus) {
    const isOnline = newStatus != 'offline';
    currentStatus = isOnline;
    console.log('[Status Tracker] newStatus', newStatus);
}

const statusDoc = require('../../firebase/avyFirebase.js').statusDoc
async function initTracker() {
    const snapshot = await statusDoc.get();
    let log;
    if (!snapshot.exists) { // doc doesnt exist?
        console.log('[Status Tracker] creating new status doc');

        log = new MultiYearStatusLog(); // your class
        await statusDoc.set({
            log: log.serialize()
        });

    } else { // doc exists
        console.log('[Status Tracker] loading existing status');

        const data = snapshot.data();
        log = MultiYearStatusLog.deserialize(data.log);
    }

    console.log('[Status Tracker] started');
    if (stopHourlyLogger) {
        stopHourlyLogger();
    }

    stopHourlyLogger = startHourlyStatusLogger(log, () => currentStatus, async (logInstance) => {
        await statusDoc.set(
            { log: logInstance.serialize() },
            { merge: true } // safer
        );
    });
}

/*
function stopTracker() {
  if (stopHourlyLogger) {
    stopHourlyLogger();
    stopHourlyLogger = null;
  }
}*/

module.exports = { initTracker, statusUpd };