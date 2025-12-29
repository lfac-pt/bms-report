#!/usr/bin/env Rscript

# rbms Collated Index Calculator
#
# This script calculates butterfly abundance indices using the rbms R library
# It follows the European Grassland Butterfly Indicator methodology:
# - GAM-based flight curves for phenology modeling
# - Imputation of missing counts using flight curves
# - GLM-based collated indices aggregating across sites
# - Transect length normalization for standardized 1-km abundance indices
#
# Usage: Rscript rbms-collated-index.R <visits_csv> <counts_csv> <output_json> <species_name> <baseline_year> <transect_lengths_csv>
#
# The transect_lengths_csv is REQUIRED and should contain columns:
# - site_id: transect identifier matching visits/counts files
# - length_km: transect length in kilometers
#
# Site indices (SINDEX) are normalized by dividing by length_km, producing
# abundance estimates per 1-km transect following BMS methodology.

suppressPackageStartupMessages({
  library(data.table)
  library(rbms)
  library(jsonlite)
})

# Parse command line arguments
args <- commandArgs(trailingOnly = TRUE)

if (length(args) != 7) {
  stop("Usage: Rscript rbms-collated-index.R <visits_csv> <counts_csv> <output_json> <species_name> <baseline_year> <transect_lengths_csv> <site_regions_csv>")
}

visits_file <- args[1]
counts_file <- args[2]
output_file <- args[3]
species_name <- args[4]
baseline_year <- as.numeric(args[5])
transect_lengths_file <- args[6]
site_regions_file <- args[7]

# Verify input files exist
if (!file.exists(visits_file)) {
  stop(paste("Visits file not found:", visits_file))
}
if (!file.exists(counts_file)) {
  stop(paste("Counts file not found:", counts_file))
}

# Read CSV files
cat(paste("Processing species:", species_name, "\n"))
cat(paste("Reading visits from:", visits_file, "\n"))
cat(paste("Reading counts from:", counts_file, "\n"))

visits <- read.csv(visits_file, stringsAsFactors = FALSE)
counts <- read.csv(counts_file, stringsAsFactors = FALSE)

# Read transect lengths (REQUIRED)
if (!file.exists(transect_lengths_file)) {
  stop(paste("Transect lengths file not found:", transect_lengths_file))
}

cat(paste("Reading transect lengths from:", transect_lengths_file, "\n"))
transect_lengths <- read.csv(transect_lengths_file, stringsAsFactors = FALSE)

# Verify required columns
if (!all(c("site_id", "length_km") %in% colnames(transect_lengths))) {
  stop("Transect lengths file missing required columns (site_id, length_km)")
}

# Filter to only valid lengths (> 0)
transect_lengths <- transect_lengths[transect_lengths$length_km > 0, ]
if (nrow(transect_lengths) == 0) {
  stop("No valid transect lengths found (all lengths <= 0)")
}

cat(paste("Loaded transect lengths for", nrow(transect_lengths), "sites\n"))

# Read site regions (required)
if (!file.exists(site_regions_file)) {
  stop(paste("Site regions file not found:", site_regions_file))
}

cat(paste("Reading site regions from:", site_regions_file, "\n"))
site_regions <- read.csv(site_regions_file, stringsAsFactors = FALSE)

# Verify required columns
if (!all(c("site_id", "region") %in% colnames(site_regions))) {
  stop("Site regions file missing required columns (site_id, region)")
}

cat(paste("Loaded regions for", nrow(site_regions), "sites\n"))

# Log unique regions
unique_regions <- unique(site_regions$region)
cat(paste("  Unique regions:", paste(unique_regions, collapse = ", "), "\n"))

# Verify data structure
required_visits_cols <- c("site_id", "date", "year")
required_counts_cols <- c("site_id", "date", "count")

if (!all(required_visits_cols %in% colnames(visits))) {
  stop(paste("Visits file missing required columns:", paste(setdiff(required_visits_cols, colnames(visits)), collapse = ", ")))
}
if (!all(required_counts_cols %in% colnames(counts))) {
  stop(paste("Counts file missing required columns:", paste(setdiff(required_counts_cols, colnames(counts)), collapse = ", ")))
}

# Rename columns to match rbms expectations (uppercase)
colnames(visits) <- c("SITE_ID", "DATE", "YEAR")
colnames(counts) <- c("SITE_ID", "DATE", "COUNT")

cat(paste("Loaded", nrow(visits), "visits and", nrow(counts), "counts\n"))

# Check if we have enough data
if (nrow(visits) < 10) {
  stop(paste("Insufficient data: only", nrow(visits), "visits"))
}
if (nrow(counts) < 5) {
  stop(paste("Insufficient data: only", nrow(counts), "counts"))
}

# Get unique years
years <- sort(unique(visits$YEAR))
if (length(years) < 3) {
  stop(paste("Insufficient years of data:", length(years), "years. Need at least 3."))
}

cat(paste("Data spans", length(years), "years:", paste(range(years), collapse = "-"), "\n"))

# Step 1: Build temporal framework
# ts_dwmy_table creates day-week-month-year table
cat("Building temporal framework...\n")
ts_date <- rbms::ts_dwmy_table(
  InitYear = min(years),
  LastYear = max(years),
  WeekDay1 = "monday"
)

# ts_monit_season defines monitoring season
# For Portugal grassland butterflies: March-September (months 3-9)
ts_season <- rbms::ts_monit_season(
  ts_date,
  StartMonth = 3,
  EndMonth = 9,
  StartDay = 1,
  EndDay = 30,
  CompltSeason = TRUE,
  Anchor = TRUE,
  AnchorLength = 2,
  AnchorLag = 2,
  TimeUnit = "w"  # weekly
)

# Step 2: Create complete time-series structure using rbms functions
cat("Creating complete site-visit time-series...\n")
visits$DATE <- as.Date(visits$DATE)

# ts_monit_site creates complete time-series with all site-date combinations
# Zeros for visits, NA for non-visited days
ts_season_visit <- rbms::ts_monit_site(
  ts_season = ts_season,
  m_visit = visits[, c("SITE_ID", "DATE")],
  DateFormat = "%Y-%m-%d",
  expand_sy = FALSE  # Only keep sampled site-year combinations
)

cat(paste("Complete time-series created:", nrow(ts_season_visit), "rows\n"))

# Step 3: Add species counts to the time-series
cat("Adding species counts to time-series...\n")
counts$DATE <- as.Date(counts$DATE)
counts$SPECIES <- species_name

# ts_monit_count_site adds counts for this specific species
# Creates proper structure for imputation
m_count <- rbms::ts_monit_count_site(
  m_season_visit = ts_season_visit,
  m_count = counts[, c("SITE_ID", "DATE", "SPECIES", "COUNT")],
  sp = species_name,
  DateFormat = "%Y-%m-%d"
)

cat(paste("Count data prepared:", nrow(m_count), "rows\n"))
cat("First few rows:\n")
print(head(m_count, 3))

# Step 4: Calculate regional GAM flight curves
regional_flight_curves <- list()
regional_pheno_curves <- list()
flight_curve_success <- FALSE
regions_with_data <- c()
regions_excluded <- c()

cat("Calculating regional GAM flight curves...\n")

  # Get unique regions
  unique_regions <- unique(site_regions$region)
  cat(paste("  Processing", length(unique_regions), "regions\n"))

  # For each region, calculate flight curve if sufficient data
  for (region in unique_regions) {
    # Get sites in this region
    region_sites <- site_regions$site_id[site_regions$region == region]
    region_data <- m_count[m_count$SITE_ID %in% region_sites, ]

    # Check minimum requirements (1+ transect, 5+ visits)
    n_sites <- length(unique(region_data$SITE_ID))
    # Count unique site-week combinations where there was actual monitoring
    n_visits <- nrow(unique(region_data[!is.na(region_data$DATE) & region_data$M_SEASON == 1, c("SITE_ID", "WEEK", "M_YEAR")]))

    cat(paste("  Region:", region, "-", n_sites, "sites,", n_visits, "visits"))

    if (n_sites >= 1 && n_visits >= 5) {
      # Calculate regional flight curve
      tryCatch({
        regional_fc <- rbms::flight_curve(
          region_data,
          NbrSample = 300,
          MinVisit = 3,
          MinOccur = 1,
          MinNbrSite = 1,
          MaxTrial = 4,
          GamFamily = 'nb',
          SpeedGam = FALSE,
          CompltSeason = TRUE,
          TimeUnit = 'w'
        )

        regional_flight_curves[[region]] <- regional_fc
        regions_with_data <- c(regions_with_data, region)
        cat(" -> Flight curve calculated\n")

        # Extract phenology for this region
        if ("pheno" %in% names(regional_fc) && nrow(regional_fc$pheno) > 0) {
          pheno_df <- as.data.frame(regional_fc$pheno)
          required_cols <- c("M_YEAR", "WEEK", "NM")

          if (all(required_cols %in% colnames(pheno_df))) {
            pheno_output <- pheno_df[, required_cols]
            colnames(pheno_output) <- c("year", "week", "abundance")
            pheno_output <- pheno_output[!duplicated(pheno_output[, c("year", "week")]), ]

            # Group by year
            pheno_by_year <- split(pheno_output, pheno_output$year)
            regional_pheno <- lapply(pheno_by_year, function(year_data) {
              year_data <- year_data[order(year_data$week), ]
              list(
                year = unique(year_data$year),
                weeks = as.list(year_data$week),
                abundance = as.list(round(year_data$abundance, 4))
              )
            })
            names(regional_pheno) <- sapply(regional_pheno, function(x) as.character(x$year))

            # Calculate total counts for this region
            total_counts <- sum(region_data$COUNT, na.rm = TRUE)

            # Store with data quality info
            regional_pheno_curves[[region]] <- list(
              phenologyCurves = regional_pheno,
              dataQuality = list(
                transectCount = n_sites,
                totalVisits = n_visits,
                totalCounts = total_counts
              )
            )
          }
        }

      }, error = function(e) {
        cat(paste(" -> Failed:", e$message, "\n"))
        regions_excluded <- c(regions_excluded, region)
      })
    } else {
      cat(" -> Excluded (insufficient data)\n")
      regions_excluded <- c(regions_excluded, region)
    }
  }

  # Check if ANY region has sufficient data
  if (length(regions_with_data) == 0) {
    stop("No regions have sufficient data (need 1+ transect and 5+ visits). Cannot calculate indices.")
  }

flight_curve_success <- TRUE
cat(paste("  Regions with flight curves:", paste(regions_with_data, collapse = ", "), "\n"))
if (length(regions_excluded) > 0) {
  cat(paste("  Regions excluded:", paste(regions_excluded, collapse = ", "), "\n"))
}

# Step 5: Impute missing counts using flight curves
ts_season_count <- NULL
imputation_success <- FALSE

if (flight_curve_success && length(regional_flight_curves) > 0) {
  # Regional imputation - use region-specific flight curves
  cat("Imputing missing counts using regional flight curves...\n")

    imputed_data <- data.frame()
    sites_imputed <- 0
    sites_excluded <- 0

    # Group sites by region
    for (region in names(regional_flight_curves)) {
      region_sites <- site_regions$site_id[site_regions$region == region]
      region_data <- m_count[m_count$SITE_ID %in% region_sites, ]

      if (nrow(region_data) > 0) {
        cat(paste("  Imputing region:", region, "-", length(unique(region_data$SITE_ID)), "sites\n"))

        tryCatch({
          region_imputed <- rbms::impute_count(
            ts_season_count = region_data,
            ts_flight_curve = regional_flight_curves[[region]],
            YearLimit = NULL,
            TimeUnit = "w"
          )
          imputed_data <- rbind(imputed_data, region_imputed)
          sites_imputed <- sites_imputed + length(unique(region_data$SITE_ID))
        }, error = function(e) {
          cat(paste("    Warning: Imputation failed for region", region, ":", e$message, "\n"))
          # Still include the un-imputed data
          imputed_data <<- rbind(imputed_data, region_data)
        })
      }
    }

    # Exclude sites from regions without flight curves
    if (length(regions_excluded) > 0) {
      for (region in regions_excluded) {
        region_sites <- site_regions$site_id[site_regions$region == region]
        excluded_count <- length(region_sites)
        if (excluded_count > 0) {
          sites_excluded <- sites_excluded + excluded_count
          cat(paste("  Excluding", excluded_count, "sites from region:", region, "\n"))
        }
      }
    }

  ts_season_count <- imputed_data
  imputation_success <- TRUE
  cat(paste("Regional imputation complete:", sites_imputed, "sites imputed,", sites_excluded, "sites excluded\n"))
} else {
  cat("No regional flight curves available - cannot perform imputation\n")
  ts_season_count <- m_count
  imputation_success <- FALSE
}

# Step 6: Calculate site-level indices
cat("Calculating site indices...\n")
tryCatch({
  site_indices <- rbms::site_index(
    butterfly_count = ts_season_count,
    MinFC = 0.10
  )
  site_index_success <- TRUE

  cat(paste("Site indices calculated:", nrow(site_indices), "rows\n"))
  cat("Columns:", paste(colnames(site_indices), collapse = ", "), "\n")
  cat("Site indices summary:\n")
  print(summary(site_indices))
  cat("Years with site indices:", paste(sort(unique(site_indices$M_YEAR)), collapse = ", "), "\n")

}, error = function(e) {
  cat(paste("Error: Site index calculation failed:", e$message, "\n"))
  stop(e)
})

# Step 6b: Normalize site indices by transect length (REQUIRED)
# This follows BMS technical report methodology for standardizing to 1-km transects
# Instead of using offset(log(TL)) in GLM, we normalize SINDEX directly
cat("Normalizing site indices by transect length...\n")

  # Merge transect lengths with site_indices using standard R operations
  # to preserve data.frame structure for boot_sample() compatibility
  original_nrow <- nrow(site_indices)

  # Create a lookup table for transect lengths
  length_lookup <- setNames(transect_lengths$length_km, transect_lengths$site_id)

  # Add length_km column by matching SITE_ID
  site_indices$length_km <- length_lookup[as.character(site_indices$SITE_ID)]

  # Check how many sites have length data
  sites_with_length <- sum(!is.na(site_indices$length_km))
  sites_without_length <- sum(is.na(site_indices$length_km))

  if (sites_without_length > 0) {
    missing_sites <- unique(site_indices$SITE_ID[is.na(site_indices$length_km)])
    cat(sprintf("Warning: %d/%d site-year records missing transect length\n",
                sites_without_length, nrow(site_indices)))
    cat(sprintf("  Missing sites: %s\n", paste(head(missing_sites, 5), collapse = ", ")))
    if (length(missing_sites) > 5) {
      cat(sprintf("  ... and %d more\n", length(missing_sites) - 5))
    }
    # Use 1.0 km as default for missing lengths (no scaling)
    site_indices$length_km[is.na(site_indices$length_km)] <- 1.0
    cat("  Using 1.0 km as default for missing lengths (no normalization)\n")
  }

  # Check for the SINDEX column (site index value)
  if (!"SINDEX" %in% colnames(site_indices)) {
    stop(paste("SINDEX column not found in site_indices. Available columns:",
               paste(colnames(site_indices), collapse = ", ")))
  }

  # Store original SINDEX for logging
  sindex_original_first <- site_indices$SINDEX[1]
  length_first <- site_indices$length_km[1]

  # Normalize SINDEX by dividing by transect length (km)
  # This converts to abundance per 1-km transect
  site_indices$SINDEX <- site_indices$SINDEX / site_indices$length_km

  cat(sprintf("  Normalized %d site-year SINDEX values by transect length\n", sites_with_length))
  cat(sprintf("  Example: SINDEX %0.2f on %0.2f km transect -> normalized to %0.2f\n",
              sindex_original_first,
              length_first,
              site_indices$SINDEX[1]))

  # Remove the temporary length_km column to avoid interfering with rbms functions
  site_indices$length_km <- NULL

  cat("  [OK] Site indices normalized to 1-km transect equivalents\n")

# Step 7: Generate bootstrap samples for confidence intervals
cat("Generating bootstrap samples (n=500)...\n")
set.seed(218795)  # For reproducibility
bootsample <- tryCatch({
  rbms::boot_sample(site_indices, boot_n = 500)
}, error = function(e) {
  cat(paste("Warning: Bootstrap sampling failed:", e$message, "\n"))
  NULL
})

# Step 8: Calculate collated index with bootstrap confidence intervals
cat("Calculating collated index with bootstrap CIs...\n")
co_index_list <- list()
collated_result_all <- NULL  # Initialize outside tryCatch for proper scope

tryCatch({
  # Determine number of bootstrap iterations
  n_boots <- if (!is.null(bootsample) && !is.null(bootsample$boot_ind)) {
    dim(bootsample$boot_ind)[1]
  } else {
    0
  }

  cat(paste("Running", n_boots + 1, "collated index calculations (1 original + ", n_boots, "bootstraps)...\n"))

  # Loop through original (bootID=0) and all bootstrap samples
  for(i in c(0, seq_len(n_boots))){
    if (i %% 100 == 0) {
      cat(paste("  Progress:", i, "/", n_boots + 1, "\n"))
    }

    co_index_list[[i+1]] <- rbms::collated_index(
      data = site_indices,
      s_sp = species_name,
      bootID = i,
      boot_ind = bootsample,
      glm_weights = TRUE,
      rm_zero = TRUE
    )
  }

  # Combine all results
  collated_result_all <- data.table::rbindlist(lapply(co_index_list, FUN = "[[", "col_index"))

  # Extract original result (bootID=0)
  collated_result <- list(
    col_index = collated_result_all[collated_result_all$BOOTi == 0, ]
  )

  if (is.null(collated_result$col_index) || nrow(collated_result$col_index) == 0) {
    stop("Collated index calculation returned no indices")
  }

  cat(paste("Collated index calculated successfully with", n_boots, "bootstrap samples\n"))
  collated_success <- TRUE

}, error = function(e) {
  cat(paste("Error: Collated index calculation failed:", e$message, "\n"))
  stop(e)
})

# Step 9: Extract and normalize indices
cat("Extracting and normalizing indices...\n")

# Extract col_index (collated index) by year
# collated_result is a list with $col_index containing the data.table
collated_indices_df <- as.data.frame(collated_result$col_index)

# Check column names and extract index column
cat("Collated indices columns:", paste(colnames(collated_indices_df), collapse = ", "), "\n")

# The index column might be COL_INDEX, col_index, or just INDEX
index_col <- NULL
if ("COL_INDEX" %in% colnames(collated_indices_df)) {
  index_col <- "COL_INDEX"
} else if ("col_index" %in% colnames(collated_indices_df)) {
  index_col <- "col_index"
} else if ("INDEX" %in% colnames(collated_indices_df)) {
  index_col <- "INDEX"
}

if (is.null(index_col) || !"M_YEAR" %in% colnames(collated_indices_df)) {
  stop(paste("Expected columns not found. Available:", paste(colnames(collated_indices_df), collapse = ", ")))
}

collated_by_year <- collated_indices_df[, c("M_YEAR", index_col), drop = FALSE]
colnames(collated_by_year) <- c("year", "index")

# Remove any NA values
collated_by_year <- collated_by_year[!is.na(collated_by_year$index), , drop = FALSE]

if (nrow(collated_by_year) == 0) {
  stop("No valid collated indices produced")
}

# Normalize to baseline year = 100
baseline_row <- collated_by_year[collated_by_year$year == baseline_year, ]

# Check if baseline year exists and has valid non-zero index
if (nrow(baseline_row) == 0) {
  cat(paste("Warning: Baseline year", baseline_year, "not found in results.\n"))
  baseline_value <- NULL
} else {
  baseline_value <- baseline_row$index[1]
  # Check if baseline value is zero, NA, NaN, or Inf
  if (is.na(baseline_value) || !is.finite(baseline_value) || baseline_value == 0) {
    cat(paste("Warning: Baseline year", baseline_year, "has invalid index (", baseline_value, ").\n"))
    baseline_value <- NULL
  }
}

# If baseline is invalid, find first year with valid non-zero index
if (is.null(baseline_value)) {
  cat("Searching for first year with valid non-zero index...\n")
  valid_rows <- collated_by_year[!is.na(collated_by_year$index) &
                                  is.finite(collated_by_year$index) &
                                  collated_by_year$index > 0, ]

  if (nrow(valid_rows) == 0) {
    stop("No valid non-zero indices found in any year")
  }

  baseline_value <- valid_rows$index[1]
  baseline_year_used <- valid_rows$year[1]
  cat(paste("Using first valid year", baseline_year_used, "as baseline\n"))
} else {
  baseline_year_used <- baseline_year
}

# Normalize: index_normalized = (index / baseline_value) * 100
collated_by_year$index_normalized <- (collated_by_year$index / baseline_value) * 100

# Convert to named list for JSON output
normalized_indices <- setNames(
  as.list(collated_by_year$index_normalized),
  as.character(collated_by_year$year)
)

cat(paste("Normalized to baseline year", baseline_year_used, "= 100\n"))

# Step 10: Calculate bootstrap confidence intervals
cat("Calculating 95% bootstrap confidence intervals...\n")
confidence_intervals <- list()

if (exists("collated_result_all") && !is.null(collated_result_all) && nrow(collated_result_all) > 0) {
  # Convert to data.table for easier manipulation
  if (!inherits(collated_result_all, "data.table")) {
    collated_result_all <- data.table::as.data.table(collated_result_all)
  }

  # Identify the index column
  index_col <- NULL
  if ("COL_INDEX" %in% colnames(collated_result_all)) {
    index_col <- "COL_INDEX"
  } else if ("col_index" %in% colnames(collated_result_all)) {
    index_col <- "col_index"
  } else if ("INDEX" %in% colnames(collated_result_all)) {
    index_col <- "INDEX"
  }

  if (!is.null(index_col) && "M_YEAR" %in% colnames(collated_result_all) && "BOOTi" %in% colnames(collated_result_all)) {
    # Filter to only bootstrap samples (exclude original bootID=0)
    boot_only <- collated_result_all[collated_result_all$BOOTi != 0, ]

    # Get unique bootstrap IDs and years
    unique_boot_ids <- unique(boot_only$BOOTi)
    unique_years <- unique(collated_by_year$year)

    # For each bootstrap sample, normalize by its own baseline year value
    # This is the correct approach: normalize first, then take percentiles
    normalized_boots <- list()

    for (boot_id in unique_boot_ids) {
      boot_data <- collated_result_all[collated_result_all$BOOTi == boot_id, ]

      # Find this bootstrap's baseline year COL_INDEX
      baseline_row_boot <- boot_data[boot_data$M_YEAR == baseline_year_used, ]

      if (nrow(baseline_row_boot) > 0) {
        baseline_val_boot <- baseline_row_boot[[index_col]][1]

        # Check if baseline is valid (non-zero, finite)
        if (!is.na(baseline_val_boot) && is.finite(baseline_val_boot) && baseline_val_boot > 0) {
          # Normalize all years in this bootstrap by its baseline
          for (year in unique_years) {
            year_row <- boot_data[boot_data$M_YEAR == year, ]
            if (nrow(year_row) > 0) {
              year_val <- year_row[[index_col]][1]
              if (!is.na(year_val) && is.finite(year_val)) {
                normalized_val <- (year_val / baseline_val_boot) * 100

                # Store normalized value
                if (is.null(normalized_boots[[as.character(year)]])) {
                  normalized_boots[[as.character(year)]] <- c()
                }
                normalized_boots[[as.character(year)]] <- c(
                  normalized_boots[[as.character(year)]],
                  normalized_val
                )
              }
            }
          }
        }
      }
    }

    # Now calculate percentiles from the normalized bootstrap distributions
    for (year in unique_years) {
      if (!is.null(normalized_boots[[as.character(year)]]) &&
          length(normalized_boots[[as.character(year)]]) > 10) {

        norm_values <- normalized_boots[[as.character(year)]]

        # Calculate percentiles directly on normalized values
        ci_lower_norm <- quantile(norm_values, 0.025, na.rm = TRUE)
        ci_upper_norm <- quantile(norm_values, 0.975, na.rm = TRUE)

        confidence_intervals[[as.character(year)]] <- list(
          ci_lower = round(ci_lower_norm, 2),
          ci_upper = round(ci_upper_norm, 2)
        )
      } else {
        confidence_intervals[[as.character(year)]] <- list(ci_lower = NULL, ci_upper = NULL)
      }
    }

    cat(paste("Calculated CIs for", length(confidence_intervals), "years\n"))
  } else {
    cat("Warning: Could not identify required columns for CI calculation\n")
  }
} else {
  cat("Warning: No bootstrap results available for CI calculation\n")
}

# Step 11: Calculate trend statistics with bootstrap CIs
cat("Calculating trend statistics from bootstrap samples...\n")

calculate_trend_with_ci <- function(collind_boot, baseline_year) {
  # Function to fit trend for one bootstrap sample
  fit_trend <- function(boot_df) {
    # Filter out rows with NA, NaN, or Inf TRMOBS values
    boot_df <- boot_df[!is.na(boot_df$TRMOBS) & is.finite(boot_df$TRMOBS), ]

    if (nrow(boot_df) < 3) return(data.frame(rate=NA, pc1=NA))

    # Fit log-linear regression: lm(TRMOBS ~ M_YEAR)
    # TRMOBS is the log-transformed index in rbms collated output
    lm_obj <- try(lm(TRMOBS ~ M_YEAR, data=boot_df), silent = TRUE)
    if (inherits(lm_obj, "try-error")) {
      return(data.frame(rate=NA, pc1=NA))
    }

    # Extract slope and convert to annual rate of change
    # rate = exp(slope * 2.303) where 2.303 converts log10 to ln
    slope <- coef(lm_obj)[2]
    if (is.na(slope)) {
      return(data.frame(rate=NA, pc1=NA))
    }

    rate <- exp(slope * 2.303)
    pc1 <- 100 * (rate - 1)  # Annual percentage change

    return(data.frame(rate=rate, pc1=pc1))
  }

  # Check if we have the required columns
  if (!all(c("BOOTi", "M_YEAR", "TRMOBS") %in% colnames(collind_boot))) {
    cat("Warning: Required columns for trend calculation not found\n")
    return(list(
      rate = NA,
      rate_ci_lower = NA,
      rate_ci_upper = NA,
      pc1 = NA,
      pc1_ci_lower = NA,
      pc1_ci_upper = NA,
      trend_class = "Uncertain"
    ))
  }

  # Calculate trends for all bootstraps
  boot_ids <- unique(collind_boot$BOOTi)
  boot_trends <- do.call(rbind, lapply(boot_ids, function(boot_id) {
    boot_data <- collind_boot[collind_boot$BOOTi == boot_id, ]
    trend_result <- fit_trend(boot_data)
    trend_result$BOOTi <- boot_id
    return(trend_result)
  }))

  # Extract point estimate (BOOTi == 0)
  point_est <- boot_trends[boot_trends$BOOTi == 0, ]

  # Calculate CIs from bootstraps (BOOTi > 0)
  boot_only <- boot_trends[boot_trends$BOOTi > 0 & !is.na(boot_trends$rate), ]

  if (nrow(boot_only) < 10) {
    # Not enough bootstrap samples
    cat(paste("Warning: Only", nrow(boot_only), "valid bootstrap trends. Using point estimate only.\n"))
    return(list(
      rate = if(nrow(point_est) > 0) point_est$rate else NA,
      rate_ci_lower = NA,
      rate_ci_upper = NA,
      pc1 = if(nrow(point_est) > 0) point_est$pc1 else NA,
      pc1_ci_lower = NA,
      pc1_ci_upper = NA,
      trend_class = "Uncertain"
    ))
  }

  rate_ci <- quantile(boot_only$rate, c(0.025, 0.975), na.rm = TRUE)
  pc1_ci <- quantile(boot_only$pc1, c(0.025, 0.975), na.rm = TRUE)

  # Classify trend based on rate CI bounds
  ci_lower <- rate_ci[1]
  ci_upper <- rate_ci[2]

  trend_class <- if (ci_lower > 1.05) {
    "Strong increase"
  } else if (ci_lower > 1.0) {
    "Moderate increase"
  } else if (ci_upper < 0.95) {
    "Strong decline"
  } else if (ci_upper < 1.0) {
    "Moderate decline"
  } else if (ci_upper > 1.05 | ci_lower < 0.95) {
    "Uncertain"
  } else {
    "Stable"
  }

  cat(paste("  Trend classification:", trend_class, "\n"))
  cat(paste("  Annual rate:", round(if(nrow(point_est) > 0) point_est$rate else NA, 4), "\n"))
  cat(paste("  Annual % change:", round(if(nrow(point_est) > 0) point_est$pc1 else NA, 2), "%\n"))

  return(list(
    rate = if(nrow(point_est) > 0) round(point_est$rate, 4) else NA,
    rate_ci_lower = round(rate_ci[1], 4),
    rate_ci_upper = round(rate_ci[2], 4),
    pc1 = if(nrow(point_est) > 0) round(point_est$pc1, 2) else NA,
    pc1_ci_lower = round(pc1_ci[1], 2),
    pc1_ci_upper = round(pc1_ci[2], 2),
    trend_class = trend_class
  ))
}

# Calculate trend statistics if we have bootstrap results
trend_statistics <- NULL
if (exists("collated_result_all") && !is.null(collated_result_all) && nrow(collated_result_all) > 0) {
  cat("Calculating trend statistics...\n")

  # Add TRMOBS column (log10-transformed collated index) for trend calculation
  # Filter out zero and negative values before log transformation to avoid -Inf
  collated_result_all$TRMOBS <- ifelse(
    collated_result_all$COL_INDEX > 0,
    log10(collated_result_all$COL_INDEX),
    NA
  )

  trend_statistics <- calculate_trend_with_ci(collated_result_all, baseline_year)
  if (!is.na(trend_statistics$pc1)) {
    cat(sprintf("  Trend: %s (%.1f%%/yr)\n", trend_statistics$trend_class, trend_statistics$pc1))
  } else {
    cat(sprintf("  Trend: %s\n", trend_statistics$trend_class))
  }
} else {
  cat("Warning: No bootstrap results available for trend calculation\n")
  trend_statistics <- list(
    rate = NA,
    rate_ci_lower = NA,
    rate_ci_upper = NA,
    pc1 = NA,
    pc1_ci_lower = NA,
    pc1_ci_upper = NA,
    trend_class = "Uncertain"
  )
}

# Step 11b: Calculate LOESS smoothed trend line for visualization
# This uses LOESS smoothing to match the GBI methodology
# Filters out zero/invalid values to match trend_statistics methodology
trend_line <- list()
if (nrow(collated_by_year) >= 2) {
  # Filter out years where the original COL_INDEX was zero or invalid
  # This ensures trend_line matches trend_statistics methodology
  valid_indices <- collated_by_year$index_normalized > 0 &
                   !is.na(collated_by_year$index_normalized) &
                   is.finite(collated_by_year$index_normalized)

  collated_valid <- collated_by_year[valid_indices, ]

  if (nrow(collated_valid) >= 3) {  # LOESS needs at least 3 points
    years_numeric <- as.numeric(collated_valid$year)
    indices_values <- collated_valid$index_normalized

    # Use standard LOESS span of 0.75 (EU GBI standard)
    loess_span <- 0.75

    # LOESS smoothing on normalized indices
    loess_trend <- try(
      loess(indices_values ~ years_numeric,
            span = loess_span,
            degree = 2,
            na.action = na.exclude),
      silent = TRUE
    )

    if (!inherits(loess_trend, "try-error")) {
      # Calculate predicted values for valid years only
      predicted_values <- predict(loess_trend)

      # Store as named list by year
      for (i in seq_along(collated_valid$year)) {
        trend_line[[as.character(collated_valid$year[i])]] <- round(predicted_values[i], 2)
      }

      cat("  LOESS smoothed trend line calculated\n")
    } else {
      cat("Warning: Could not calculate LOESS trend line\n")
    }
  } else {
    cat("Warning: Not enough valid data points for LOESS (need at least 3)\n")
  }
}

# Step 11c: Save bootstrap results for multi-species indicator (GBI) calculation
# Export full bootstrap distribution as RDS file for proper MSI methodology
if (exists("collated_result_all") && !is.null(collated_result_all) && nrow(collated_result_all) > 0) {
  cat("Saving bootstrap results for GBI calculation...\n")

  # Determine bootstrap output directory
  # Navigate from output_file (/path/to/raw-data/temp-rbms/output_species.json)
  # up two levels to project root, then to .cache/rbms/bootstrap
  project_root <- dirname(dirname(dirname(output_file)))  # temp-rbms -> raw-data -> project root
  bootstrap_output_dir <- file.path(project_root, ".cache", "rbms", "bootstrap")
  dir.create(bootstrap_output_dir, recursive = TRUE, showWarnings = FALSE)
  cat(sprintf("  Bootstrap output dir: %s\n", bootstrap_output_dir))

  # Create safe filename from species name
  species_safe <- gsub(" ", "_", tolower(species_name))
  bootstrap_file <- file.path(bootstrap_output_dir, paste0(species_safe, "_boot.rds"))

  # Prepare data for MSI: Add SPECIES column and keep only necessary columns
  bootstrap_data <- collated_result_all[, c("BOOTi", "M_YEAR", "COL_INDEX", "TRMOBS")]
  bootstrap_data$SPECIES <- species_name

  # Save as RDS
  saveRDS(bootstrap_data, bootstrap_file)
  cat(sprintf("  Bootstrap data saved: %s\n", basename(bootstrap_file)))
} else {
  cat("Warning: No bootstrap data available for GBI calculation\n")
}

# Step 12: Compile data quality metrics
data_quality <- list(
  site_count = length(unique(visits$SITE_ID)),
  total_visits = nrow(visits),
  total_counts = nrow(counts[counts$COUNT > 0, ]),
  years_with_data = length(unique(collated_by_year$year)),
  imputation_success = imputation_success,
  baseline_year = baseline_year_used
)

# Step 13: Create output structure
output <- list(
  species = species_name,
  collated_indices = normalized_indices,
  confidence_intervals = confidence_intervals,
  trend_statistics = trend_statistics,
  trend_line = if(length(trend_line) > 0) trend_line else NULL,
  regional_phenology_curves = if(length(regional_pheno_curves) > 0) regional_pheno_curves else NULL,
  data_quality = data_quality,
  processing_info = list(
    method = "rbms (regional GAM flight curves + GLM collated index + bootstrap CI + linear trend + transect length normalization)",
    timestamp = format(Sys.time(), "%Y-%m-%d %H:%M:%S"),
    rbms_version = as.character(packageVersion("rbms")),
    bootstrap_iterations = if(exists("n_boots")) n_boots else 0
  )
)

# Step 14: Write JSON output
cat(paste("Writing output to:", output_file, "\n"))
json_output <- jsonlite::toJSON(output, pretty = TRUE, auto_unbox = TRUE)
write(json_output, file = output_file)

cat("Processing complete!\n")
cat(paste("Years with indices:", length(normalized_indices), "\n"))
cat(paste("Index range:", round(min(collated_by_year$index_normalized), 2), "-",
          round(max(collated_by_year$index_normalized), 2), "\n"))
