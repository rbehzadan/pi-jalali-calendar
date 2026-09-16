// Iranian national holidays (time.ir) for pi-jalali-calendar.
//
// Source: https://mana.time.ir/fa/event/list/0/<jalaliYear>/<jalaliMonth>
//   12 SSR HTML pages per year; official holidays carry <li class='eventHoliday'>.
// Cache: per-year CSV (BOM, UTF-8) + meta.json under dataDir():
//   ~/.pi/jalali-holidays/holidays-<year>.csv  (override: PI_JALALI_HOLIDAYS_DIR)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { convertDate, formatDate, toJdn } from "./calendar.mjs";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const BASE = "https://mana.time.ir/fa/event/list/0";
const CSV_HEADER = "ردیف,تاریخ شمسی,تاریخ میلادی,روز هفته,علت تعطیلی";
// 0=Monday, from JDN % 7 (JDN 2451545 = 2000-01-01 was a Saturday → 2451545 % 7 = 5)
const WEEKDAYS_FA = ["دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه", "شنبه", "یکشنبه"];
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const STALE_AFTER_DAYS = 30; // current/future years may change (moon sightings); past years are final

export function dataDir() {
  return process.env.PI_JALALI_HOLIDAYS_DIR ?? join(homedir(), ".pi", "jalali-holidays");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const toEn = (s) =>
  s
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
const decodeEnt = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');

export function currentJalaliYear() {
  const now = new Date();
  return convertDate("gregorian", "jalali", { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, day: now.getUTCDate() }).year;
}

// --- scraping ---

export function parseMonth(html, month) {
  const out = [];
  for (const m of html.matchAll(/<li class='([^']*)'[^>]*>([\s\S]*?)<\/li>/g)) {
    if (!m[1].includes("eventHoliday")) continue;
    const dm = m[2].match(/<span id="[^"]*lblEventDate"[^>]*>([\s\S]*?)<\/span>/);
    if (!dm) continue;
    const day = Number.parseInt(toEn(decodeEnt(dm[1])).trim(), 10);
    const after = m[2].slice((dm.index ?? 0) + dm[0].length);
    // drop tags, then any trailing "[ ... ]" date annotation (e.g. "[ ۱ شوال ]")
    const reason = decodeEnt(after.replace(/<[^>]*>/g, " "))
      .replace(/\s*\[[^\]]*\]\s*$/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!Number.isInteger(day) || !reason) continue;
    out.push({ day, month, reason });
  }
  return out;
}

async function fetchMonth(url, { timeoutMs, attempts }) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, "accept-language": "fa-IR,fa;q=0.9" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
        throw new Error(`fatal: ${url} → HTTP ${res.status}`); // permanent, don't retry
      }
      return await res.text();
    } catch (e) {
      if (/^fatal:/.test(e.message)) throw e;
      lastErr = e;
      if (i + 1 < attempts) await sleep(2000 * 2 ** i); // 2s, 4s, 8s
    }
  }
  throw lastErr;
}

/**
 * Fetch all 12 months of a Jalali year.
 * opts.timeoutMs/attempts/delayMs: per-request policy (defaults suit an explicit update).
 * opts.deadline: total wall-clock budget in ms (for the auto-fetch path, so a
 *   dead/slow network can't hang a tool call forever).
 */
export async function fetchYear(year, { timeoutMs = 20000, attempts = 4, delayMs = 1000, deadline = Infinity } = {}) {
  const t0 = Date.now();
  const holidays = [];
  for (let m = 1; m <= 12; m += 1) {
    if (Date.now() - t0 > deadline) throw new Error(`auto-fetch budget exceeded (${deadline} ms)`);
    const html = await fetchMonth(`${BASE}/${year}/${m}`, { timeoutMs, attempts });
    holidays.push(...parseMonth(html, m));
    if (m < 12) await sleep(delayMs);
  }
  // never cache the result of a broken parse
  if (holidays.length === 0) throw new Error(`0 holidays parsed for ${year} — site markup likely changed`);
  return holidays;
}

// --- storage ---

function toCsv(rows) {
  const lines = rows.map(
    (r, i) => [String(i + 1), r.jalali, r.gregorian, r.weekday, r.reason].map((s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)).join(","),
  );
  return "\uFEFF" + [CSV_HEADER, ...lines].join("\n") + "\n"; // BOM so Excel renders Persian
}

function csvFields(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') (cur += '"'), (i += 1);
        else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") (out.push(cur), (cur = ""));
    else cur += c;
  }
  out.push(cur);
  return out;
}

function readMeta(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
  } catch {
    return {};
  }
}

function toRows(raw, year) {
  return raw
    .sort((a, b) => a.month - b.month || a.day - b.day || a.reason.localeCompare(b.reason, "fa"))
    .map((h) => {
      const jdn = toJdn("jalali", { year, month: h.month, day: h.day });
      const g = convertDate("jalali", "gregorian", { year, month: h.month, day: h.day });
      return {
        jalali: formatDate({ year, month: h.month, day: h.day }),
        gregorian: formatDate(g),
        weekday: WEEKDAYS_FA[jdn % 7],
        reason: h.reason,
      };
    });
}

export function saveYear(year, rows, dir = dataDir()) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `holidays-${year}.csv`), toCsv(rows), "utf8");
  const meta = readMeta(dir);
  meta[String(year)] = { updated_at: new Date().toISOString(), rows: rows.length };
  writeFileSync(join(dir, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
}

export function loadYear(year, dir = dataDir()) {
  const p = join(dir, `holidays-${year}.csv`);
  if (!existsSync(p)) return null;
  const meta = readMeta(dir)[String(year)];
  const text = readFileSync(p, "utf8").replace(/^\uFEFF/, "");
  const rows = [];
  for (const line of text.split("\n").slice(1)) {
    if (!line.trim()) continue;
    const f = csvFields(line);
    if (f.length >= 5) rows.push({ jalali: f[1], gregorian: f[2], weekday: f[3], reason: f[4] });
  }
  return { year, rows, updatedAt: meta?.updated_at ?? null };
}

// --- freshness + lookup ---

export function isStale(year, updatedAt) {
  if (!updatedAt) return true;
  if (year < currentJalaliYear()) return false; // finalized
  return Date.now() - Date.parse(updatedAt) > STALE_AFTER_DAYS * 86400e3;
}

// fast-fail policy for the auto-fetch path inside holiday_check (explicit holiday_update
// uses fetchYear defaults: 20s timeout, 4 attempts, 1s inter-month delay)
const DEFAULT_AUTO = { timeoutMs: 8000, attempts: 2, delayMs: 300, deadline: 20000 };

/**
 * Get a year's rows, fetching if missing/stale (when autoFetch) with cache fallback.
 * autoOpts overrides the fetch policy (tests inject fast-fail values).
 */
export async function getYear(year, { autoFetch = false, autoOpts = DEFAULT_AUTO } = {}) {
  let cached = loadYear(year);
  if (!cached || isStale(year, cached.updatedAt)) {
    if (autoFetch) {
      try {
        const rows = toRows(await fetchYear(year, autoOpts), year);
        saveYear(year, rows);
        return { year, rows, updatedAt: new Date().toISOString(), fetchedNow: true, stale: false, fetchError: null };
      } catch (e) {
        if (!cached) throw new Error(`no local holiday data for ${year} and auto-fetch failed: ${e.message}. Run holiday_update.`);
        return { ...cached, fetchedNow: false, stale: true, fetchError: e.message };
      }
    }
  }
  return { ...(cached ?? { year, rows: [], updatedAt: null }), fetchedNow: false, stale: isStale(year, cached?.updatedAt), fetchError: null };
}

/**
 * Check one date. `calendar` is "jalali" or "gregorian"; result always in both.
 */
export async function checkHoliday(calendar, input) {
  const jalali = calendar === "jalali" ? input : convertDate("gregorian", "jalali", input);
  const data = await getYear(jalali.year, { autoFetch: true });
  const matches = data.rows.filter((r) => r.jalali === formatDate(jalali));
  const jdn = toJdn("jalali", jalali);
  const g = convertDate("jalali", "gregorian", jalali);
  return {
    is_holiday: matches.length > 0,
    reasons: matches.map((m) => m.reason),
    jalali: formatDate(jalali),
    gregorian: formatDate(g),
    weekday: WEEKDAYS_FA[jdn % 7],
    data: {
      year: jalali.year,
      updated_at: data.updatedAt,
      fetched_now: data.fetchedNow,
      stale: data.stale,
      fetch_error: data.fetchError,
    },
  };
}

/**
 * On-demand refresh of one year's data. Returns change counts vs the previous file.
 */
export async function updateYear(year, dir = dataDir()) {
  const prev = loadYear(year, dir);
  const rows = toRows(await fetchYear(year), year);
  saveYear(year, rows, dir);
  const keyOf = (r) => `${r.jalali}|${r.reason}`;
  const newKeys = new Set(rows.map(keyOf));
  const oldKeys = new Set((prev?.rows ?? []).map(keyOf));
  const added = rows.filter((r) => !oldKeys.has(keyOf(r))).length;
  const removed = [...oldKeys].filter((k) => !newKeys.has(k)).length;
  return {
    year,
    rows: rows.length,
    added,
    removed,
    unchanged: rows.length - added,
    updated_at: readMeta(dir)[String(year)].updated_at,
  };
}
