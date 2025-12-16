#!/usr/bin/env Rscript

# rbms Collated Index Calculator
#
# This script calculates butterfly abundance indices using the rbms R library
# It follows the European Grassland Butterfly Indicator methodology:
# - GAM-based flight curves for phenology modeling
# - Imputation of missing counts using flight curves
# - GLM-based collated indices aggregating across sites
#
# Usage: Rscript rbms-collated-index.R <visits_csv> <counts_csv> <output_json> <species_name> <baseline_year>

suppressPackageStartupMessages({
  library(data.table)
  library(rbms)
  library(jsonlite)
})

# Parse command line arguments
args <- commandArgs(trailingOnly = TRUE)

if (length(args) != 5) {
  stop("Usage: Rscript rbms-collated-index.R <visits_csv> <counts_csv> <output_json> <species_name> <baseline_year>")
}

visits_file <- args[1]
counts_file <- args[2]
output_file <- args[3]
species_name <- args[4]
baseline_year <- as.numeric(args[5])

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

# Step 4: Calculate flight curves using GAM
cat("Calculating GAM flight curves...\n")
pheno_curves <- NULL  # Initialize for scope
tryCatch({
  ts_flight_curve <- rbms::flight_curve(
    m_count,
    NbrSample = 300,
    MinVisit = 2,
    MinOccur = 2,
    MinNbrSite = 1,
    MaxTrial = 3,
    GamFamily = "nb",
    SpeedGam = TRUE,  # Faster computation
    CompltSeason = TRUE,
    SelectYear = NULL,
    TimeUnit = "w"
  )

  flight_curve_success <- TRUE

  # Extract R² as quality metric
  if (!is.null(ts_flight_curve) && "pheno" %in% names(ts_flight_curve)) {
    pheno_data <- ts_flight_curve$pheno
    if (!is.null(pheno_data) && "r.squared" %in% names(pheno_data)) {
      flight_curve_r2 <- mean(pheno_data$r.squared, na.rm = TRUE)
    } else {
      flight_curve_r2 <- NA
    }
  } else {
    flight_curve_r2 <- NA
  }

  cat(paste("Flight curve R²:", round(flight_curve_r2, 3), "\n"))

  # Debug: Check flight curve structure
  cat("Flight curve structure:\n")
  cat(paste("  Names:", paste(names(ts_flight_curve), collapse = ", "), "\n"))
  if ("pheno" %in% names(ts_flight_curve)) {
    cat(paste("  Pheno rows:", nrow(ts_flight_curve$pheno), "\n"))
    if (nrow(ts_flight_curve$pheno) > 0) {
      cat("  Pheno sample:\n")
      print(head(ts_flight_curve$pheno[, c("SPECIES", "M_YEAR", "WEEK")], 3))
    }
  }

  # Extract phenology curves (weekly abundance predictions)
  if ("pheno" %in% names(ts_flight_curve) && nrow(ts_flight_curve$pheno) > 0) {
    cat("Extracting phenology curves...\n")
    pheno_df <- as.data.frame(ts_flight_curve$pheno)

    # Check available columns
    cat(paste("  Pheno columns:", paste(colnames(pheno_df), collapse = ", "), "\n"))

    # Select relevant columns: year, week, and normalized abundance
    # NM is the key column - normalized mean abundance prediction
    required_cols <- c("M_YEAR", "WEEK", "NM")
    if (all(required_cols %in% colnames(pheno_df))) {
      # Filter to unique year-week combinations (avoid duplicates)
      pheno_output <- pheno_df[, required_cols]
      colnames(pheno_output) <- c("year", "week", "abundance")

      # Remove duplicates if any (keep first occurrence per year-week)
      pheno_output <- pheno_output[!duplicated(pheno_output[, c("year", "week")]), ]

      # Convert to list structure grouped by year for easier JSON output
      pheno_by_year <- split(pheno_output, pheno_output$year)
      pheno_curves <- lapply(pheno_by_year, function(year_data) {
        # Sort by week to ensure proper order
        year_data <- year_data[order(year_data$week), ]

        list(
          year = unique(year_data$year),
          weeks = as.list(year_data$week),
          abundance = as.list(round(year_data$abundance, 4))
        )
      })
      names(pheno_curves) <- sapply(pheno_curves, function(x) as.character(x$year))

      cat(paste("  Extracted phenology for", length(pheno_curves), "years\n"))
      cat(paste("  Weeks per year: ", paste(sapply(pheno_curves, function(x) length(x$weeks)), collapse = ", "), "\n"))
    } else {
      cat("  Warning: Required pheno columns not found\n")
      pheno_curves <- NULL
    }
  } else {
    cat("  No phenology data available\n")
    pheno_curves <- NULL
  }

}, error = function(e) {
  cat(paste("Warning: Flight curve calculation failed:", e$message, "\n"))
  ts_flight_curve <<- NULL
  flight_curve_success <<- FALSE
  flight_curve_r2 <<- NA
  pheno_curves <<- NULL
})

# Step 5: Impute missing counts using flight curves
if (flight_curve_success && !is.null(ts_flight_curve)) {
  cat("Imputing missing counts...\n")

  tryCatch({
    ts_season_count <- rbms::impute_count(
      ts_season_count = m_count,
      ts_flight_curve = ts_flight_curve,
      YearLimit = NULL,
      TimeUnit = "w"
    )
    imputation_success <- TRUE
    cat("Imputation successful\n")
  }, error = function(e) {
    cat(paste("Warning: Count imputation failed:", e$message, "\n"))
    cat("Continuing without imputation...\n")
    ts_season_count <<- m_count
    imputation_success <<- FALSE
  })
} else {
  cat("Skipping imputation (flight curve unavailable)\n")
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

if (nrow(baseline_row) == 0) {
  cat(paste("Warning: Baseline year", baseline_year, "not found in results. Using first year.\n"))
  baseline_value <- collated_by_year$index[1]
  baseline_year_used <- collated_by_year$year[1]
} else {
  baseline_value <- baseline_row$index[1]
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

    # Calculate quantiles for each year
    unique_years <- unique(collated_by_year$year)

    for (year in unique_years) {
      year_boot_data <- boot_only[boot_only$M_YEAR == year, ]

      if (nrow(year_boot_data) > 10) {  # Need enough bootstrap samples
        # Get bootstrap index values
        boot_indices <- year_boot_data[[index_col]]
        boot_indices <- boot_indices[!is.na(boot_indices)]

        if (length(boot_indices) > 10) {
          # Calculate percentiles
          ci_lower_raw <- quantile(boot_indices, 0.025, na.rm = TRUE)
          ci_upper_raw <- quantile(boot_indices, 0.975, na.rm = TRUE)

          # Normalize CI bounds the same way we normalized the point estimate
          ci_lower_norm <- (ci_lower_raw / baseline_value) * 100
          ci_upper_norm <- (ci_upper_raw / baseline_value) * 100

          confidence_intervals[[as.character(year)]] <- list(
            ci_lower = round(ci_lower_norm, 2),
            ci_upper = round(ci_upper_norm, 2)
          )
        } else {
          confidence_intervals[[as.character(year)]] <- list(ci_lower = NULL, ci_upper = NULL)
        }
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

# Step 11: Compile data quality metrics
data_quality <- list(
  site_count = length(unique(visits$SITE_ID)),
  total_visits = nrow(visits),
  total_counts = nrow(counts[counts$COUNT > 0, ]),
  years_with_data = length(unique(collated_by_year$year)),
  flight_curve_r2 = ifelse(is.na(flight_curve_r2), 0, round(flight_curve_r2, 4)),
  imputation_success = imputation_success,
  baseline_year = baseline_year_used
)

# Step 12: Create output structure
output <- list(
  species = species_name,
  collated_indices = normalized_indices,
  confidence_intervals = confidence_intervals,
  phenology_curves = pheno_curves,
  data_quality = data_quality,
  processing_info = list(
    method = "rbms (GAM flight curves + GLM collated index + bootstrap CI)",
    timestamp = format(Sys.time(), "%Y-%m-%d %H:%M:%S"),
    rbms_version = as.character(packageVersion("rbms")),
    bootstrap_iterations = if(exists("n_boots")) n_boots else 0
  )
)

# Step 13: Write JSON output
cat(paste("Writing output to:", output_file, "\n"))
json_output <- jsonlite::toJSON(output, pretty = TRUE, auto_unbox = TRUE)
write(json_output, file = output_file)

cat("Processing complete!\n")
cat(paste("Years with indices:", length(normalized_indices), "\n"))
cat(paste("Index range:", round(min(collated_by_year$index_normalized), 2), "-",
          round(max(collated_by_year$index_normalized), 2), "\n"))
