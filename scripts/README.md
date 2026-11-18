# Data Processing Scripts

## PDF season reports by transect

Run `npm run reports:transects -- --year 2026` to create a PDF recap per transect and
a recipient manifest. Optional contact and visit logs support multiple recipients
and visits without sightings. See [the report generator guide](transect-reports/README.md)
for inputs, analytical definitions, limitations and examples.

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
