import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkHoliday, currentJalaliYear, getYear, isStale, loadYear, parseMonth, saveYear } from "../holidays.mjs";
import { convertDate, toJdn } from "../calendar.mjs";

// --- conversion pins (same source as the holiday rows' gregorian/weekday columns) ---
test("pins Jalali→Gregorian conversion and JDN weekday", () => {
  assert.deepEqual(convertDate("jalali", "gregorian", { year: 1405, month: 1, day: 1 }), { year: 2026, month: 3, day: 21 });
  // 2026-03-21 was a Saturday → JDN % 7 = 5 → index 5 in the Monday-based table
  const WEEKDAYS_FA = ["دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه", "شنبه", "یکشنبه"];
  assert.equal(WEEKDAYS_FA[toJdn("jalali", { year: 1405, month: 1, day: 1 }) % 7], "شنبه");
});

// --- site HTML parsing ---
test("parseMonth keeps only eventHoliday items and strips date annotations", () => {
  const html = `<ul class="list-unstyled">
  <li class='eventHoliday '><span id="a_lblEventDate">۱ فروردین</span> جشن نوروز/جشن سال نو <span style="white-space: nowrap"></span></li>
  <li class=''><span id="b_lblEventDate">۱ فروردین</span> روز جهانی نوروز <span style="white-space: nowrap"> [ 21 March ]</span></li>
  <li class='eventHoliday'><span id="c_lblEventDate">۱۱ فروردین</span> عید سعید فطر <span style="white-space: nowrap"> [ ۱ شوال ]</span></li>
</ul>`;
  assert.deepEqual(parseMonth(html, 1), [
    { day: 1, month: 1, reason: "جشن نوروز/جشن سال نو" },
    { day: 11, month: 1, reason: "عید سعید فطر" },
  ]);
});

// --- cache + lookup (no network) ---
const dir = mkdtempSync(join(tmpdir(), "holidays-"));
process.env.PI_JALALI_HOLIDAYS_DIR = dir;

test("saveYear/loadYear round-trips CSV + meta", () => {
  saveYear(1405, [
    { jalali: "1405-01-01", gregorian: "2026-03-21", weekday: "شنبه", reason: "جشن نوروز/جشن سال نو" },
    { jalali: "1405-01-01", gregorian: "2026-03-21", weekday: "شنبه", reason: "عید سعید فطر" },
    { jalali: "1405-02-01", gregorian: "2026-04-21", weekday: "سه‌شنبه", reason: "not used, fixture" },
  ], dir);
  const loaded = loadYear(1405, dir);
  assert.equal(loaded.rows.length, 3);
  assert.equal(loaded.rows[0].reason, "جشن نوروز/جشن سال نو");
  assert.ok(loaded.updatedAt);
});

test("checkHoliday: Jalali and Gregorian input, holiday and non-holiday", async () => {
  const h = await checkHoliday("jalali", { year: 1405, month: 1, day: 1 });
  assert.equal(h.is_holiday, true);
  assert.equal(h.reasons.length, 2);
  assert.equal(h.gregorian, "2026-03-21");
  assert.equal(h.weekday, "شنبه");
  assert.equal(h.data.fetched_now, false);

  const g = await checkHoliday("gregorian", { year: 2026, month: 3, day: 21 });
  assert.equal(g.jalali, "1405-01-01");
  assert.equal(g.is_holiday, true);

  const n = await checkHoliday("jalali", { year: 1405, month: 2, day: 2 }); // not in cache
  assert.equal(n.is_holiday, false);
  assert.equal(n.gregorian, "2026-04-22");
  assert.equal(n.weekday, "چهارشنبه"); // computed, not from cache
});

const FAST_FAIL = { timeoutMs: 1000, attempts: 1, delayMs: 0, deadline: 60000 };
const stubOffline = () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("offline (test)");
  };
  return () => {
    globalThis.fetch = realFetch;
  };
};

test("no cache + failing fetch → clear error pointing at holiday_update", async () => {
  const restore = stubOffline();
  const empty = mkdtempSync(join(tmpdir(), "holidays-empty-"));
  process.env.PI_JALALI_HOLIDAYS_DIR = empty;
  try {
    await assert.rejects(() => getYear(1406, { autoFetch: true, autoOpts: FAST_FAIL }), /no local holiday data for 1406.*holiday_update/);
  } finally {
    restore();
    process.env.PI_JALALI_HOLIDAYS_DIR = dir;
  }
});

test("stale cache + failing fetch → falls back to cached rows", async () => {
  const cur = currentJalaliYear();
  const sdir = mkdtempSync(join(tmpdir(), "holidays-stale-"));
  saveYear(cur, [{ jalali: `${cur}-01-01`, gregorian: "2026-03-21", weekday: "شنبه", reason: "جشن نوروز" }], sdir);
  writeFileSync(join(sdir, "meta.json"), JSON.stringify({ [String(cur)]: { updated_at: "2000-01-01T00:00:00Z", rows: 1 } }));
  const restore = stubOffline();
  process.env.PI_JALALI_HOLIDAYS_DIR = sdir;
  try {
    const r = await getYear(cur, { autoFetch: true, autoOpts: FAST_FAIL });
    assert.equal(r.stale, true);
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0].reason, "جشن نوروز");
    assert.match(r.fetchError, /offline \(test\)/);
  } finally {
    restore();
    process.env.PI_JALALI_HOLIDAYS_DIR = dir;
  }
});

// --- staleness ---
test("past years never stale; current year stale after 30 days", () => {
  const cur = currentJalaliYear();
  assert.equal(isStale(cur - 1, "2000-01-01"), false);
  assert.equal(isStale(cur, "2000-01-01"), true);
  assert.equal(isStale(cur, new Date().toISOString()), false);
  assert.equal(isStale(cur, null), true);
});
