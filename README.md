# pi-jalali-calendar

A dependency-free Pi package exposing:

- `jalali_calendar`
  - `convert`: convert between Jalali and Gregorian dates.
  - `days_between`: count absolute calendar days between dates in either calendar.
- `holiday_check`: whether a date is an Iranian national/official holiday (time.ir), with the reason(s). Default calendar is Jalali.
- `holiday_update`: refresh the local holiday database for a Jalali year (default: current).

## Install locally

```bash
pi install git:github.com/rbehzadan/pi-jalali-calendar
```

For development:

```bash
pi -e /absolute/path/to/pi-jalali-calendar
npm test
```

## Tool inputs

```json
{
  "operation": "convert",
  "from_calendar": "jalali",
  "date": { "year": 1403, "month": 1, "day": 1 },
  "to_calendar": "gregorian"
}
```

```json
{
  "operation": "days_between",
  "from_calendar": "jalali",
  "date": { "year": 1402, "month": 12, "day": 29 },
  "other_calendar": "gregorian",
  "other_date": { "year": 2024, "month": 3, "day": 20 }
}
```

The supported Jalali-year range is -61 through 3177.

## Holidays

`holiday_check` takes a date (Jalali by default, Gregorian accepted) and returns whether it is an Iranian official holiday plus the reason(s):

```json
{ "date": { "year": 1405, "month": 1, "day": 1 }, "calendar": "jalali" }
```

→ `1405-01-01 (2026-03-21, شنبه) is an Iranian official holiday: جشن نوروز/جشن سال نو; عید سعید فطر`

`holiday_update` re-fetches a year from time.ir (12 monthly event-list pages, polite delays + retries) and reports added/removed/unchanged rows:

```json
{ "year": 1404 }
```

Data is cached per year under `~/.pi/jalali-holidays/` (`holidays-<year>.csv` + `meta.json`, override with `PI_JALALI_HOLIDAYS_DIR`). Freshness rules:

- past Jalali years are considered final — cached forever after the first fetch;
- current/future years are stale after 30 days; `holiday_check` re-fetches automatically when data is missing or stale and the network is reachable (20 s budget), otherwise it answers from cache and says the data may be stale;
- an explicit refresh is always available via `holiday_update`.
