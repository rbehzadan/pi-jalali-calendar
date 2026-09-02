# pi-jalali-calendar

A dependency-free Pi package exposing `jalali_calendar`:

- `convert`: convert between Jalali and Gregorian dates.
- `difference_in_calendar_days`: calculate the absolute calendar-day difference between dates in either calendar.

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
  "operation": "difference_in_calendar_days",
  "from_calendar": "jalali",
  "date": { "year": 1402, "month": 12, "day": 29 },
  "other_calendar": "gregorian",
  "other_date": { "year": 2024, "month": 3, "day": 20 }
}
```

The supported Jalali-year range is -61 through 3177.
