import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { convertDate, daysBetween, formatDate } from "../calendar.mjs";

const calendar = StringEnum(["jalali", "gregorian"] as const);
const date = Type.Object({
  year: Type.Integer(),
  month: Type.Integer({ minimum: 1, maximum: 12 }),
  day: Type.Integer({ minimum: 1, maximum: 31 }),
});

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "jalali_calendar",
    label: "Jalali Calendar",
    description: "Convert Jalali and Gregorian dates, or calculate absolute calendar-day differences.",
    promptSnippet: "Convert Jalali/Gregorian dates or count calendar days between them",
    promptGuidelines: [
      "Use jalali_calendar for Jalali/Gregorian conversion or date differences; do not calculate these conversions manually.",
    ],
    parameters: Type.Object({
      operation: StringEnum(["convert", "days_between"] as const),
      from_calendar: calendar,
      date: date,
      to_calendar: Type.Optional(calendar),
      other_calendar: Type.Optional(calendar),
      other_date: Type.Optional(date),
    }),
    async execute(_id, params) {
      if (params.operation === "convert") {
        if (!params.to_calendar) throw new Error("to_calendar is required for convert");
        const result = convertDate(params.from_calendar, params.to_calendar, params.date);
        return {
          content: [{ type: "text", text: `${formatDate(params.date)} (${params.from_calendar}) = ${formatDate(result)} (${params.to_calendar})` }],
          details: { operation: params.operation, result },
        };
      }

      if (!params.other_calendar || !params.other_date) throw new Error("other_calendar and other_date are required for days_between");
      const days = daysBetween(params.from_calendar, params.date, params.other_calendar, params.other_date);
      return {
        content: [{ type: "text", text: `${days} day(s) between ${formatDate(params.date)} and ${formatDate(params.other_date)}` }],
        details: { operation: params.operation, days },
      };
    },
  });
}
