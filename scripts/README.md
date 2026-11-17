# Scripts

## `form-fields.py` — what fields does a form have

```bash
python3 scripts/form-fields.py https://bondautotransport.muntean2stefan.workers.dev/get-quote
```

Prints every input, select and textarea with its step, name, type and whether it is required.
Use it when a form changes, so a scripted submission does not silently miss a new field.

## `fill-quote.sh` — submit a quote from the terminal

```bash
./scripts/fill-quote.sh                                   # production
./scripts/fill-quote.sh http://127.0.0.1:8787             # local dev
```

Sends one quote with every field filled and prints the HTTP status plus the price the
calculator returned. Edit the `-F` values to test a different route or vehicle.

Notes:
- `photo=@/path/to.jpg` adds a photo (max 5, 10 MB each).
- Extra vehicles use indexed names: `vehicle_year___2__`, `vehicle_make___2__`,
  `vehicle_model___2__`, `condition___2__`, `vin___2__` — note the double underscores.
- `available_date` must be today or later; the server rewrites past dates.

## `snapshot-page.sh` — copy a page with its styles and images

```bash
./scripts/snapshot-page.sh https://bondautotransport.muntean2stefan.workers.dev/get-quote ui-copy
open ui-copy/index.html
```

Saves the rendered HTML, the stylesheet, the logo and the icons into `ui-copy/`, and rewrites
the paths so it opens from disk with no server. The date picker, the step wizard and the
vehicle comboboxes all keep working, because the JavaScript is inline in the page.

Use it to hand a copy of a screen to someone, to compare before/after a change, or to work on
the look without running the app.

## Where the calendar actually lives

| Piece | File |
|---|---|
| markup + behaviour | `src/views.ts` — the `<script>` that starts with `document.querySelectorAll("[data-date-picker]")` |
| styles | `public/styles.css` — `.date-picker`, `.date-grid`, `.date-day` |
| server values | `parseDateTime()` in `src/index.ts` |
