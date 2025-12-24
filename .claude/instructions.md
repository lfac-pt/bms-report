# Project-Specific Instructions for Claude Code

## Data Processing Commands

### IMPORTANT: Always use fast-process-data for testing

**Rule**: When testing or running data processing during development, ALWAYS use:

```bash
npm run fast-process-data
```

**Only use** `npm run process-data` when:
- Specifically testing regional phenology curves
- Generating the final production data
- Explicitly requested by the user

### Why?

- `npm run fast-process-data` skips regional phenology calculation (saves ~15-20 minutes)
- Uses the `--skip-regional` flag internally
- Regional phenology is time-consuming and not needed for most testing scenarios
- GBI calculation and other features work the same with or without regional data

### Commands

| Command | Use Case | Time |
|---------|----------|------|
| `npm run fast-process-data` | Testing, development, GBI verification | ~30-60 seconds |
| `npm run process-data` | Production, regional phenology testing | ~15-20 minutes |

### Example Testing Workflow

```bash
# Making changes to GBI calculation
npm run fast-process-data  # Quick test

# Making changes to regional phenology
npm run process-data        # Full test including regional data
```

## Cache System

The project uses a sophisticated caching system for rbms R calculations:

- Cache location: `.cache/rbms/`
- Caches both JSON output and binary RDS bootstrap files
- Cache version: v3
- Clear cache if encountering weird data issues: `rm -rf .cache/rbms/`

## GBI (Grassland Butterfly Index)

- Uses Multi-Species Indicator (MSI) methodology
- Bootstrap confidence intervals calculated via species-level resampling
- R script: `scripts/calculate-gbi.R`
- Requires `reshape2` R package
- Output: `public/data/gbi-data.json`
