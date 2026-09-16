import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { checkHoliday, currentJalaliYear, updateYear } from "../holidays.mjs";

const calendar = StringEnum(["jalali", "gregorian"] as const);
const date = Type.Object({
  year: Type.Integer(),
  month: Type.Integer({ minimum: 1, maximum: 12 }),
  day: Type.Integer({ minimum: 1, maximum: 31 }),
});

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "holiday_check",
    label: "Iranian Holiday Check",
    description:
      "Check whether a date is an Iranian national/official holiday (time.ir). Returns the reason(s). Default calendar is Jalali; Gregorian input is accepted and converted.",
    promptSnippet: "Check if a date is an Iranian official holiday and why",
    promptGuidelines: [
      "Use holiday_check for Iranian official holidays; missing or stale year data is fetched automatically when online and falls back to the local cache otherwise.",
    ],
    parameters: Type.Object({
      date,
      calendar: Type.Optional(calendar),
    }),
    async execute(_id, params) {
      const r = await checkHoliday(params.calendar ?? "jalali", params.date);
      const when = `${r.jalali} (${r.gregorian}, ${r.weekday})`;
      const verdict = r.is_holiday
        ? `${when} is an Iranian official holiday: ${r.reasons.join("; ")}`
        : `${when} is not an Iranian official holiday.`;
      const note = r.data.fetched_now
        ? " [year data fetched just now]"
        : ` [local data, updated ${r.data.updated_at ?? "unknown"}${r.data.stale ? " — possibly stale, consider holiday_update" : ""}]`;
      return {
        content: [{ type: "text", text: verdict + note }],
        details: {
          is_holiday: r.is_holiday,
          reasons: r.reasons,
          jalali: r.jalali,
          gregorian: r.gregorian,
          weekday: r.weekday,
          data: r.data,
        },
      };
    },
  });

  pi.registerTool({
    name: "holiday_update",
    label: "Iranian Holiday Data Update",
    description:
      "Fetch the latest official Iranian holidays for a Jalali year from time.ir into the local database (default: current year). Reports added/removed/unchanged rows.",
    promptSnippet: "Update the local Iranian holiday database",
    parameters: Type.Object({
      year: Type.Optional(Type.Integer({ description: "Jalali year to update (default: current Jalali year)" })),
    }),
    async execute(_id, params) {
      const year = params.year ?? currentJalaliYear();
      const r = await updateYear(year);
      return {
        content: [
          {
            type: "text",
            text: `Updated ${r.year}: ${r.rows} holidays — ${r.added} added, ${r.removed} removed, ${r.unchanged} unchanged (updated ${r.updated_at}).`,
          },
        ],
        details: r,
      };
    },
  });
}
