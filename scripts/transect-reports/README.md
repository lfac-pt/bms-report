# Season reports by transect

Generate a Portuguese PDF recap for each transect and a CSV telling the coordinator
which PDF belongs to each recipient. Uses the existing Node/TypeScript toolchain and
jsPDF dependencies; no browser, R, Python or external service is needed to generate reports.
Node 18.19+ is required for `--import tsx`.

```bash
npm ci
npm run reports:transects -- --year 2026
```

The default inputs are `raw-data/all.csv`, `raw-data/metadata.csv` and the bundled
`public/data/portugal-municipalities.geojson` boundary file. The default
output is `output/pdf/transects/2026/`. Use a **new or empty directory** for each run;
the script refuses non-empty output folders so old PDFs cannot be mixed with new manifests.
All inputs are validated and the complete batch is staged before publication.

```bash
# One transect, for design review; use the internal Transect ID, not its code/name.
npm run reports:transects -- --year 2026 --transect 340178 --out-dir output/pdf/review-2026

# A fresh batch with recipient addresses and a complete visit log.
npm run reports:transects -- --year 2026 \
  --contacts raw-data/report-contacts.csv \
  --visits raw-data/visits.csv \
  --out-dir output/pdf/final-2026

# A different local season window, with only accepted sightings.
npm run reports:transects -- --year 2026 --start 05-01 --end 08-31 \
  --accepted-only --out-dir output/pdf/may-august-2026
```

Repeat `--transect ID` for several routes. By default, the script selects metadata
rows marked `Válido` or `Novo` with visits in the chosen calendar year, including
routes whose visits are all outside the reporting window. An explicit selection can
produce a recap for a route with no visits that year. Other metadata statuses are
excluded. Run `npm run reports:transects -- --help` for all input path options.

## Outputs

- One searchable A4 PDF per transect: forest green and warm parchment design, a
  sepia butterfly engraving, TAGIS and Censos de Borboletas de Portugal attribution,
  running headers, numbered pages and source links. Length adapts to the data.
- `recipients.csv`: one row per transect/recipient pair, with year, transect ID/code/name,
  relative PDF filename, recipient name/email, contact source and delivery status.
  Includes visit/species/highlight/gap counts for a quick coordination review.
- `season-summary.json`: the exact metrics used to build each PDF.
- `run.json`: generation timestamp, season/filter settings, report counts, input SHA-256
  hashes, conservation table hash and records of duplicate occurrences, missing transect
  IDs and data transects absent from metadata.

Reports include the seasonal overview, monthly mean count per visit, effort, gaps over
14 days, earlier season comparisons, first local records, nationally threatened species,
full species inventory with encounter frequency and weekly flight charts, busiest observation day,
data-quality notes and suggestions for the next season.

The species inventory replaces the first/last-date column with inline weekly flight
charts. Every row shares the same season axis, with month labels repeated on table
continuations. Bar height shows the mean individuals per visit for that week, scaled
to the species' own peak so seasonal timing is easy to compare. Absolute counts remain
in the adjacent column. Grey bands mean no recorded visits; sampled weeks without the
species have zero-height bars. These are observed seasonal patterns, without smoothing
or interpolation across unvisited weeks. Weeks start at the reporting window's first
day; the final bin is clipped to its end. The same validation and species filters apply
as elsewhere in the report, including visits without positive species counts in the
denominator. `season-summary.json` stores visit effort in `weekly` and each species'
weekly means in `weeklyMean`; unvisited bins are `null`.

In "O que merece um olhar mais atento", new and nationally threatened species with
local photos appear as cards with their name, counts, visit frequency, first sighting
and photographer credit. A species highlighted for both reasons gets one card with
both labels. Species without an image file retain the existing tables. Photos are
loaded from `public/imgs/sp/` using the species-family mapping, with supplementary
images from `results-photo-credits.json` when needed. Photographer credits and available
source/license links come from the existing credit catalogues. Images keep their
original aspect ratio and need no network access.

The visit-frequency card provides supportive feedback using the longest gap in the
chosen season, including its start and end: up to 14 days is "Fantástico", 15-21 is
"Bom ritmo", 22-28 is "Ganhar ritmo", and over 28 suggests sharing visits with a team.
At least two distinct visit dates are required for a rating. This is a descriptive
coverage aid, not an official project grade; the PDF reminds readers to adapt the
window to the local flight season. Season-wide coverage without long gaps is celebrated;
short clusters also receive a reminder to cover the start and end of the season.
New local species receive positive wording, and the cover mentions threatened species
only when any were recorded.

The cover also recognizes a transect when it is the only registered route in its
municipality. Locations are verified from `Spatial Refere` against the municipality
polygons, respecting the boundary file's CRS (the bundled file is EPSG:3763, while
transect positions are WGS84). Without usable coordinates, a metadata name is used
only if it matches an official municipality; settlement/park names are not accepted
as municipalities. `--municipalities PATH` selects another supported boundary file.
This checks all distinct `Válido`/`Novo` transect IDs in the input metadata, including
inactive routes and those without visits that season. It is independent of `--transect`
or the generated report set. If any registered route remains unlocated or ambiguous,
uniqueness claims are disabled for the batch. Corrections and unresolved records are
logged in `run.json`; original input files are not changed. The number of registered
routes in each report's municipality is stored as `municipalityTransectCount`.
Cover highlights use restrained punctuation, preserving the positive tone.

Generated output is ignored by Git and should be kept outside `public/`, because the
manifest and JSON summaries may contain personal contact information. PDF filenames
contain the season, transect name and stable ID, with no recipient details.

The cover credits volunteers directly below the transect title. Add an optional
`Voluntários` column to the metadata CSV, separating team members with semicolons
(for example, `Ana Silva; Rui Santos`). When absent or blank, the report uses
`Responsável`. Names are not inferred from email recipients, who may be coordinators.
Routes without either field omit the credit; `run.json` counts them in
`reportsWithoutVolunteerNames`. Full teams wrap onto up to three lines on the cover.

## Recipient mapping

There are no email addresses in the current metadata. Create a private UTF-8 CSV:

```csv
transect_id,name,email
340178,Example recipient,recipient@example.org
340178,Second recipient,second@example.org
```

Use **one address per row**. Multiple people can receive the same PDF; the script
emits one manifest row per person. Unknown IDs and malformed addresses fail validation.
Exact duplicate contact rows are collapsed. Explicit contacts replace the metadata
owner for that transect. With no explicit mapping, the `Responsável` value is copied
as a single recipient label; the script does not guess how to split a team name.

`delivery_status` is `ready` when an address is present, `missing_email` when a name
is available without an address, and `missing_contact` when neither is available.
`ready` describes contact completeness, not scientific validation or approval to send.
CSV fields are quoted, use a UTF-8 BOM for spreadsheet applications, and neutralize
formula-like text. The script **does not send emails**.

## Visits, counts and comparisons

- Default reporting window: **1 March to 30 September**, inclusive. This follows the
  broad window in the [TAGIS census manual](https://www.tagis.pt/uploads/4/7/9/5/47950987/manual_censos_de_borboletas.pdf).
  Override it for local conditions; cross-year windows are not supported.
- A visit is a unique `Transect Sample ID` within a transect. All section occurrences
  contribute to that visit. Different sample IDs on one date count as separate visits.
  Gaps use unique dates, so multiple same-day visits do not create artificial gaps.
- Without a sample ID, the script uses the date. If that date has exactly one known
  sample ID it merges into that visit; with several IDs it fails rather than guessing.
  Sample IDs with conflicting dates also fail. Calendar calculations use UTC.
- Zero-count rows, unidentified records and rejected sightings establish visit evidence,
  but only positive counts of recognized species contribute to species/individual totals.
  Outside-transect counts are excluded. The PDF calls out unidentified individuals.
- **Occurrence exports can omit visits without sightings.** Supply `--visits` with a
  complete visit log to count empty visits reliably:

  ```csv
  Transect ID,Transect Sample ID,Date
  340178,empty-visit-1,01/03/2026
  340178,empty-visit-2,15/03/2026
  ```

  Prefer the same sample IDs as the occurrence export. A date-only file is accepted,
  with the fallback rules above. A visit-only route can be selected in bulk.

- Sightings marked `Rejected` are excluded from all counts and discoveries. Pending
  and unknown statuses are included by default and their number is shown. Use
  `--accepted-only` to restrict counts and historical species to `Accepted` records.
  Visits remain independent of sighting validation status.
- Species names use `SPECIES_NAME_CORRECTIONS` and `VALID_SPECIES`, as in the existing
  data pipeline. Repeated occurrence IDs with identical analytical/section fields are
  counted once; conflicting duplicates fail. Negative, blank, fractional or malformed
  counts and invalid dates fail. Rows without a transect ID are skipped and logged.
- A gap is **strictly greater than 14 days**. Start-to-first-visit and last-visit-to-end
  intervals are shown separately. No visits yields one whole-season gap (when >14 days).
  These are gaps in recorded coverage, not proof that visits were missed.
- Earlier seasons use the **same date window** and only years with recorded visits.
  Means divide recognized-species individuals by all visits, including empty ones.
  A relative comparison uses the latest prior season, if its mean is nonzero.
  Zero baselines yield no percentage change.
  Descriptive counts and means are not population trends or modelled indices; weather,
  timing, habitat and incomplete section coverage can affect them.
- A new species has a positive count this season and none in **any previous calendar
  year** at that transect, including records outside the comparison window. Future years
  do not affect this determination. First seasons establish a baseline and do not label
  every species as new. A first available record does not demonstrate colonization.

## Conservation and branding

National CR, EN and VU highlights reuse `src/utils/endangered_pt.ts`, a project-curated
snapshot referring to the [Lista Vermelha de Invertebrados de Portugal Continental](https://lvinvertebrados.pt/).
The report states this scope and source; unlisted species are **not** assigned LC.
Review this table against current assessments before distribution. European categories
are not mixed with national categories. This feature does not update conservation data.

Project information links to [TAGIS / Censos de Borboletas de Portugal](https://www.tagis.pt/censos-de-borboletas.html).
The PDF uses typographic attribution and an original AI-generated decorative engraving,
inspired by the natural-history illustration style in the TAGIS reference supplied for
this design. It does not serve as a species-identification image or an official logo.
The PNG is bundled in `assets/`, with its source and generation prompt documented in
[the artwork notes](assets/README.md); bulk report generation needs no image service.
Change `pdf.ts` to adapt the
design and wording; change `model.ts` for analytical rules and `io.ts` for manifests.

## Validation

```bash
npm run test:transect-reports
npx tsc --noEmit --target ES2022 --module commonjs --moduleResolution node \
  --esModuleInterop --skipLibCheck --strict --noUnusedLocals --noUnusedParameters \
  scripts/generate-transect-reports.ts scripts/transect-reports/reports.test.ts
```

Tests cover visit identity, empty visits, strict dates, exact gap thresholds, historical
comparisons, new species, accepted-only filtering, conservation highlights, duplicates,
recipient mapping, CSV safety, CLI output and refusal to mix batches. For design edits,
render representative PDFs with `pdftoppm -png report.pdf preview` and inspect every
page, including long species inventories, sparse seasons and continuation pages.
