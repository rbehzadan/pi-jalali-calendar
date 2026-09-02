import assert from "node:assert/strict";
import test from "node:test";
import { convertDate, differenceInCalendarDays, formatDate } from "../calendar.mjs";

test("converts Nowruz 1403 both ways", () => {
  assert.deepEqual(convertDate("jalali", "gregorian", { year: 1403, month: 1, day: 1 }), { year: 2024, month: 3, day: 20 });
  assert.deepEqual(convertDate("gregorian", "jalali", { year: 2024, month: 3, day: 20 }), { year: 1403, month: 1, day: 1 });
});

test("handles Jalali leap day and day differences", () => {
  assert.equal(formatDate(convertDate("jalali", "gregorian", { year: 1399, month: 12, day: 30 })), "2021-03-20");
  assert.equal(differenceInCalendarDays("jalali", { year: 1402, month: 12, day: 29 }, "gregorian", { year: 2024, month: 3, day: 20 }), 1);
});
