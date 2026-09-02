const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

function div(a, b) {
  return Math.trunc(a / b);
}

function mod(a, b) {
  return a - div(a, b) * b;
}

function jalCal(jy) {
  if (jy < breaks[0] || jy >= breaks.at(-1)) throw new RangeError(`Jalali year out of range: ${jy}`);
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jump = 0;

  for (let i = 1; i < breaks.length; i += 1) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }

  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  const leap = mod(mod(n + 1, 33) - 1, 4);
  return { leap, gy, march };
}

function g2d(gy, gm, gd) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d -= div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) - 752;
  return d;
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j += div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { year: gy, month: gm, day: gd };
}

function j2d(year, month, day) {
  const { gy, march } = jalCal(year);
  return g2d(gy, 3, march) + (month - 1) * 31 - div(month, 7) * (month - 7) + day - 1;
}

function d2j(jdn) {
  const g = d2g(jdn);
  let jy = g.year - 621;
  const { march, leap } = jalCal(jy);
  const jdn1f = g2d(g.year, 3, march);
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) return { year: jy, month: 1 + div(k, 31), day: mod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (leap === 1) k += 1;
  }
  return { year: jy, month: 7 + div(k, 30), day: mod(k, 30) + 1 };
}

function isGregorianLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInGregorianMonth(year, month) {
  return [31, isGregorianLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

function daysInJalaliMonth(year, month) {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return jalCal(year).leap === 0 ? 30 : 29;
}

export function validateDate(calendar, { year, month, day }) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) throw new TypeError("Date fields must be integers");
  if (month < 1 || month > 12) throw new RangeError(`Invalid month: ${month}`);
  const maxDay = calendar === "gregorian" ? daysInGregorianMonth(year, month) : daysInJalaliMonth(year, month);
  if (day < 1 || day > maxDay) throw new RangeError(`Invalid day: ${day}`);
}

export function toJdn(calendar, date) {
  validateDate(calendar, date);
  return calendar === "gregorian" ? g2d(date.year, date.month, date.day) : j2d(date.year, date.month, date.day);
}

export function convertDate(fromCalendar, toCalendar, date) {
  const jdn = toJdn(fromCalendar, date);
  return toCalendar === "gregorian" ? d2g(jdn) : d2j(jdn);
}

export function daysBetween(firstCalendar, firstDate, secondCalendar, secondDate) {
  return Math.abs(toJdn(secondCalendar, secondDate) - toJdn(firstCalendar, firstDate));
}

export function formatDate({ year, month, day }) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
