# Data Processing Scripts

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
