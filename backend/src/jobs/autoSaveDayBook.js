'use strict';

// End-of-day auto-save for the Day Book.
//
// Dependency-free scheduler (no node-cron) so it adds nothing to install and
// can't crash the server on a git-pull deploy that skips `npm install`.
//
// At 23:59 India time (IST, UTC+5:30 — no DST) it snapshots that day's Day Book
// summary, the same as clicking "Save Day Book". Re-running overwrites the
// day's snapshot, so the end-of-day figures are the final ones.
//
// Disable by setting DAYBOOK_AUTOSAVE=off. Override the time with
// DAYBOOK_AUTOSAVE_HOUR / DAYBOOK_AUTOSAVE_MINUTE (IST, 24h).

const { createSnapshot } = require('../controllers/dayBookController');

const IST_OFFSET_MIN = 330; // UTC+5:30, fixed (India has no daylight saving)

// IST wall-clock "now" expressed through a Date's UTC fields.
const istNow = () => new Date(Date.now() + IST_OFFSET_MIN * 60000);

// Today's date in IST as YYYY-MM-DD.
const istDateString = () => istNow().toISOString().split('T')[0];

// Milliseconds from now until the next IST hour:minute.
function msUntilNextIST(hour, minute) {
  const now = Date.now();
  const ist = istNow();
  const target = new Date(ist);
  target.setUTCHours(hour, minute, 0, 0);
  if (target.getTime() <= ist.getTime()) target.setUTCDate(target.getUTCDate() + 1);
  // target's UTC fields hold an IST wall-clock time; shift back to real UTC.
  return (target.getTime() - IST_OFFSET_MIN * 60000) - now;
}

async function runAutoSave() {
  const date = istDateString();
  try {
    await createSnapshot(date, 'auto (end of day)');
    console.log(`✅ Auto-saved Day Book for ${date}`);
  } catch (err) {
    console.error(`❌ Auto-save Day Book failed for ${date}:`, err.message);
  }
}

function startAutoSaveDayBook() {
  if ((process.env.DAYBOOK_AUTOSAVE || '').toLowerCase() === 'off') {
    console.log('ℹ️  Day Book auto-save disabled (DAYBOOK_AUTOSAVE=off)');
    return;
  }

  const hour = Number.isInteger(+process.env.DAYBOOK_AUTOSAVE_HOUR) ? +process.env.DAYBOOK_AUTOSAVE_HOUR : 23;
  const minute = Number.isInteger(+process.env.DAYBOOK_AUTOSAVE_MINUTE) ? +process.env.DAYBOOK_AUTOSAVE_MINUTE : 59;

  const scheduleNext = () => {
    const delay = msUntilNextIST(hour, minute);
    setTimeout(async () => {
      await runAutoSave();
      scheduleNext(); // chain the next day (avoids long-interval drift)
    }, delay).unref?.(); // don't keep the process alive solely for this timer
    const mins = Math.round(delay / 60000);
    console.log(`🕒 Day Book auto-save scheduled for ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} IST (in ~${mins} min)`);
  };

  scheduleNext();
}

module.exports = { startAutoSaveDayBook };
