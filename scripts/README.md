# Data Processing Scripts

## PDF season reports by transect

Run `npm run reports:transects -- --year 2026` to create a PDF recap per transect and
a recipient manifest. Optional contact and visit logs support multiple recipients
and visits without sightings. See [the report generator guide](transect-reports/README.md)
for inputs, analytical definitions, limitations and examples.

## Import of 22 November 2026

The replacement exports in `Desktop/candida` add 84 observations (207 individuals)
from 2026 across A Rocha Cruzinha I, A Rocha Cruzinha II and Baldios de São Miguel
de Poiares. `raw-data/all.csv` now contains 63,735 observations; every previous
observation is unchanged. The site, section-definition and timed-count exports
are byte-for-byte unchanged from the previous import.

The new `raw-data/transect-visits.csv` preserves the original transect-level export:
6,306 visits, all with a populated `Recorded by` field. Its 254 distinct labels
include spelling/order variants, teams and organizations; they are not a count of
unique people. Names are retained as supplied, without splitting on commas or
overwriting curated owners or volunteer credits.

`raw-data/section-visits.csv` preserves the 24,846 section-visit rows. The combined
`raw-data/visits.csv` contains one row per transect/sample ID, links the recorder
and visit details from the transect export, and includes 21 visits without section
rows. Pass it to the PDF generator with `--visits raw-data/visits.csv`. Recorder
information stays in the Git-ignored raw inputs; it is not added to public JSON.

Four sample IDs have conflicting parent/section dates. The combined visit log
retains the section dates already used in observations and the previous import.
`Exported Transect Date` retains the parent date and `Visit Date Source` records
the choice. These discrepancies still need confirmation from the data provider:

| Transect | Sample ID | Transect export date | Retained section date |
| --- | --- | --- | --- |
| Oficina Abelha | 14138174 | 11/04/2021 | 12/04/2021 |
| Parque Urbano do Vale da Montanha | 24869570 | 23/11/2023 | 04/02/2024 |
| Azenhas do Ervedal | 25659204 | 08/05/2024 | 09/05/2024 |
| Aguiar de Sousa | 26598075 | 13/07/2024 | 14/07/2024 |

The curated `metadata.csv` remains unchanged. Replaced inputs are backed up under
`raw-data/import-backups/2026-11-22-candida/`; source filenames, hashes, row counts
and the date discrepancies are recorded in `raw-data/candida-import-2026-11-22.json`.
Dashboard visit calculations retain their existing observation-based definitions.

## Import of 17 November 2026

The exports supplied in `Desktop/candida` were imported into the local, Git-ignored
`raw-data/` directory:

| Project file | Contents |
| --- | --- |
| `all.csv` | 63,651 transect observations through 12 November 2026; 990 added, all previous records unchanged |
| `visits.csv` | 24,821 section-visit rows representing 6,276 transect visits |
| `raw transects metadata.csv` | 152 transects, including lengths and habitats |
| `transect-sections.csv` | 638 transect sections |
| `timed-count-observations.csv` | 33,875 observations from the separate timed-count survey |
| `timed-count-visits.csv` | 2,869 timed-count visits |

The curated `metadata.csv` is preserved. Replaced files are backed up under
`raw-data/import-backups/2026-11-17-candida/`; source filenames, row counts and
SHA-256 hashes are recorded in `raw-data/candida-import-2026-11-17.json`.
Five observation rows lack a transect ID and remain in the source data; the PDF
generator skips and reports them. The visit export adds 327 visits with no
observation rows. Section rows are grouped by transect sample ID in PDF reports.

Include the visit log explicitly when generating a report:

```bash
npm run reports:transects -- --year 2026 --transect 330931 \
  --visits raw-data/visits.csv --out-dir output/pdf/gateira-2026-with-visits
```

The dashboard processing pipeline still derives visits from observation records.
The section and timed-count exports are retained as separate inputs; the current
dashboard and transect reports do not consume them. Timed counts must not be
appended to `all.csv`, because they use a different survey protocol and schema.

## process-butterfly-data.js

This script processes raw butterfly monitoring data from the EBMS (European Butterfly Monitoring Scheme) Portugal project.

### What it does

1. Reads `raw-data/metadata.csv` containing transect metadata
2. Filters for transects with `Situação === "Válido"` (valid transects only)
3. Reads `raw-data/all.csv` containing all butterfly observation records
4. Calculates statistics for each valid transect:
   - Total unique species observed
   - Total number of visits (unique dates)
   - Average visits per year
   - Average butterflies per visit
   - Number of years active
   - First monitoring season year
5. Outputs processed data to `public/data/processed-transects.json`

### How to run

```bash
npm run process-data
```

### When to run

- After updating `raw-data/all.csv` or `raw-data/metadata.csv`
- Before deploying the application
- The script automatically runs before `npm run build` (via prebuild hook)

### Output

- **Location**: `public/data/processed-transects.json`
- **Format**: JSON array of transect statistics
- **Size**: ~40 KB (96 transects as of Nov 2025)
- **Structure**: See `src/types/transectStats.ts` for TypeScript definitions

### Statistics Calculated

| Metric                | Description                        | Calculation                             |
| --------------------- | ---------------------------------- | --------------------------------------- |
| Total Species         | Number of unique butterfly species | Count distinct "Preferred Species Name" |
| Total Visits          | Number of monitoring visits        | Count distinct dates                    |
| Avg Visits/Year       | Average visits per year            | Total visits ÷ Years active             |
| Avg Butterflies/Visit | Average abundance per visit        | Sum of all counts ÷ Total visits        |
| Years Active          | Number of years monitored          | Count distinct years in dates           |
| First Monitoring Year | Year of first observation          | Earliest year from dates                |
| Is Active             | Current status                     | From metadata "Estado" === "Ativo"      |

### Data Quality

- Only processes transects marked as "Válido" in metadata
- Handles missing or invalid data gracefully
- Rounds averages to 1 decimal place
- Filters out 3 transects from metadata that have no observation data
- **Result**: 96 out of 99 valid transects have observation data
  - 70 Active transects
  - 26 Inactive transects
