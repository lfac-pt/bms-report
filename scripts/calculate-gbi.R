#!/usr/bin/env Rscript
#
# Calculate Grassland Butterfly Index (GBI) using Multi-Species Indicator methodology
# Following EU GBI Technical Report methodology with LOESS smoothing and bootstrap CIs
#
# Usage: Rscript calculate-gbi.R <bootstrap_dir> <output_json> <baseline_year> <species_metadata_json>
#

if (!require("data.table", quietly = TRUE)) {
  install.packages("data.table", repos = "http://cran.us.r-project.org")
}
if (!require("jsonlite", quietly = TRUE)) {
  install.packages("jsonlite", repos = "http://cran.us.r-project.org")
}
library(data.table)
library(jsonlite)

# MSI Constants
# Center species at 10^2 = 100 in linear space for cross-species comparability
LOG10_CENTER <- 2

# Parse command line arguments
args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 4) {
  stop("Usage: Rscript calculate-gbi.R <bootstrap_dir> <output_json> <baseline_year> <species_metadata_json>")
}

bootstrap_dir <- args[1]
output_json <- args[2]
baseline_year <- as.numeric(args[3])
species_metadata_json <- args[4]

cat("=== Grassland Butterfly Index (GBI) Calculation ===\n")
cat(sprintf("Bootstrap dir: %s\n", bootstrap_dir))
cat(sprintf("Output file: %s\n", output_json))
cat(sprintf("Baseline year: %d\n", baseline_year))

# ============================================================================
# MSI Indicator Functions (from workshop_functions.R)
# ============================================================================

#' Calculate geometric mean
geomean <- function(x) exp(mean(log(x), na.rm = TRUE))

#' Fill tail NAs with last non-NA value (forward fill)
fillTailNAs <- function(x) {
  non_na_positions <- which(!is.na(x))
  if (length(non_na_positions) > 0 && max(non_na_positions) < length(x)) {
    x[(max(non_na_positions) + 1):length(x)] <- x[max(non_na_positions)]
  }
  return(x)
}

#' Calculate multi-species indicator with proper handling of short time series
#' This implements the BRCindicators::rescale_species logic
indicator_func <- function(Data, index = 100, max = 10000, min = 1) {
  Data <- data.matrix(Data)

  # Scale all species to index value in first year
  multipliers <- index / Data[1, 2:ncol(Data)]
  indicator_scaled <- t(t(Data[, 2:ncol(Data)]) * multipliers)

  # Apply min/max constraints
  indicator_scaled[indicator_scaled < min & !is.na(indicator_scaled)] <- min
  indicator_scaled[indicator_scaled > max & !is.na(indicator_scaled)] <- max

  # Calculate initial geometric mean
  geomean_vals <- apply(X = indicator_scaled, MARGIN = 1, FUN = geomean)
  indicator_scaled <- cbind(indicator_scaled, geomean_vals)
  colnames(indicator_scaled)[ncol(indicator_scaled)] <- "geomean"

  # Handle species with NA in first year (shorter time series)
  NAtop <- colnames(Data)[is.na(Data[1, ])]
  firstYear <- function(x) min(which(!is.na(x)))

  if (length(NAtop) > 1) {
    NAtop <- names(sort(apply(X = Data[, NAtop], MARGIN = 2, FUN = firstYear)))
  }

  if (length(NAtop) > 0) {
    for (i in 1:length(NAtop)) {
      temp_col <- data.frame(
        species = !is.na(Data[, NAtop[i]]),
        row = 1:nrow(indicator_scaled)
      )
      first_year <- min(temp_col$row[temp_col$species])

      # Scale species to current indicator value in its first year
      temp_gm <- indicator_scaled[first_year, "geomean"]
      multi <- temp_gm / Data[first_year, NAtop[i]]
      d <- Data[, NAtop[i]] * multi
      d[d < min & !is.na(d)] <- min
      d[d > max & !is.na(d)] <- max

      indicator_scaled[, NAtop[i]] <- d
      indicator_scaled[, "geomean"] <- apply(
        X = indicator_scaled[, !colnames(indicator_scaled) %in% "geomean"],
        MARGIN = 1,
        FUN = geomean
      )
    }
  }

  # Forward fill missing values at end of time series
  temp_indicator_scaled <- try(
    apply(X = indicator_scaled[, -ncol(indicator_scaled)], MARGIN = 2, FUN = fillTailNAs),
    silent = TRUE
  )

  if (!inherits(temp_indicator_scaled, "try-error")) {
    indicator_scaled <- cbind(
      temp_indicator_scaled,
      apply(X = temp_indicator_scaled, MARGIN = 1, FUN = geomean)
    )
    colnames(indicator_scaled)[ncol(indicator_scaled)] <- "indicator"
    indicator_scaled <- cbind(Data[, "year"], indicator_scaled)
    colnames(indicator_scaled)[1] <- "year"
  } else {
    indicator_scaled <- NULL
  }

  return(indicator_scaled)
}

#' Produce indicator for original data (BOOTi == 0)
#' Now accepts loess_span as a parameter for consistency
produce_indicator0 <- function(collind_region0, loess_span, interval = "decreasing") {
  if (interval != "decreasing") {
    warning("Interval not defined as decreasing - will increase in width over time")
  }

  # Rescale collated indices from log10 scale
  collind_region0$TRMOBS100 <- 10^collind_region0$TRMOBS

  # Change year column name
  colnames(collind_region0)[colnames(collind_region0) == "M_YEAR"] <- "year"

  # Calculate indicator for real data
  indicator0 <- indicator_func(
    data.table::dcast(collind_region0, year ~ SPECIES, value.var = "TRMOBS100")
  )[, c("year", "indicator")]

  # Validate that baseline year exists in the data
  if (!(baseline_year %in% indicator0[, "year"])) {
    warning(sprintf(
      "Baseline year %d not found in indicator data (data spans %d-%d). Indicator values will not be anchored to the specified baseline.",
      baseline_year, min(indicator0[, "year"]), max(indicator0[, "year"])
    ))
  }

  # NOTE: Do NOT rescale to last year = 100 before LOESS smoothing
  # This must match the bootstrap approach to ensure CIs are valid
  # The "decreasing interval" effect happens naturally from bootstrap variation

  # Fit LOESS to get smoothed indicators using the passed span
  ind_gam <- predict(
    loess(indicator0[, 2] ~ indicator0[, 1],
      span = loess_span, degree = 2,
      na.action = na.exclude
    ),
    se = FALSE
  )

  # Rescale such that the smoothed indicator starts at 100
  msi <- data.frame(indicator0)
  msi$indicator <- msi$indicator / ind_gam[1] * 100
  msi$ind_gam0 <- ind_gam
  msi$SMOOTH <- ind_gam / ind_gam[1] * 100

  # Add species count per year
  msi <- merge(
    msi,
    collind_region0[, .(NSPECIES = uniqueN(SPECIES)), by = "year"],
    by = "year"
  )

  return(msi)
}

#' Produce indicators for all bootstrap samples
#' Now accepts loess_span as a parameter for consistency
#' Note: Bootstrap samples are NOT rescaled to anchor year = 100 before smoothing.
#' This preserves variation needed for confidence intervals. Rescaling happens
#' in add_indicator_CI to match the baseline of the main indicator.
produce_indicators_boot <- function(collind_region_boot, loess_span) {
  setDT(collind_region_boot)

  # Rescale collated indices from log10 scale
  collind_region_boot[, TRMOBS100 := 10^TRMOBS]

  # Change year column name
  setnames(collind_region_boot, "M_YEAR", "year")

  # Calculate indicator for each bootstrap
  if (nrow(collind_region_boot) > 0) {
    # Split by bootstrap ID and calculate indicator for each
    boot_list <- split(collind_region_boot, collind_region_boot$BOOTi)
    indicators_boot <- do.call(
      rbind,
      lapply(boot_list, function(x) {
        indicator_func(
          data.table::dcast(x, year ~ SPECIES, value.var = "TRMOBS100")
        )[, "indicator"]
      })
    )

    # NOTE: Do NOT rescale to last year = 100 before LOESS smoothing
    # This would remove all bootstrap variation in the last year, causing zero-width CIs
    # Instead, keep natural variation and let add_indicator_CI handle rescaling

    # Apply LOESS smoothing to each bootstrap using the passed span
    indicators_gam <- apply(indicators_boot, 1, function(x) {
      z <- data.frame(ind = x, y = 1:ncol(indicators_boot))
      predict(
        loess(ind ~ y,
          span = loess_span, degree = 2,
          na.action = na.exclude, data = z
        ),
        se = FALSE
      )
    })

    return(indicators_gam)
  } else {
    return(NULL)
  }
}

#' Add confidence intervals to indicator from bootstrap samples
add_indicator_CI <- function(msi0, msi_boot) {
  # Validate that rescaling baseline is valid
  if (is.na(msi0$ind_gam0[1]) || !is.finite(msi0$ind_gam0[1]) || msi0$ind_gam0[1] <= 0) {
    stop("First year LOESS prediction is invalid (", msi0$ind_gam0[1],
         ") - cannot rescale bootstrap samples for CI calculation")
  }

  # 95% CI (2.5th and 97.5th percentiles)
  msi0$ci_lower <- apply(
    msi_boot / msi0$ind_gam0[1] * 100,
    1, quantile, 0.025
  )
  msi0$ci_upper <- apply(
    msi_boot / msi0$ind_gam0[1] * 100,
    1, quantile, 0.975
  )

  # Also calculate 80% and 90% CIs (EU standard)
  msi0$ci80_lower <- apply(
    msi_boot / msi0$ind_gam0[1] * 100,
    1, quantile, 0.10
  )
  msi0$ci80_upper <- apply(
    msi_boot / msi0$ind_gam0[1] * 100,
    1, quantile, 0.90
  )

  msi0$ci90_lower <- apply(
    msi_boot / msi0$ind_gam0[1] * 100,
    1, quantile, 0.05
  )
  msi0$ci90_upper <- apply(
    msi_boot / msi0$ind_gam0[1] * 100,
    1, quantile, 0.95
  )

  return(msi0)
}

#' Classify trend based on confidence intervals (EU GBI methodology)
trend_class_func <- function(trend_ci, low = "rate_lt_low", upp = "rate_lt_upp") {
  trend_class <- rep(NA, nrow(trend_ci))

  # Strong increase: CI lower > 1.05
  trend_class[trend_ci[, low] > 1.05] <- "Strong increase"

  # Moderate increase: CI lower in ]1, 1.05]
  trend_class[trend_ci[, low] > 1 & trend_ci[, low] <= 1.05] <- "Moderate increase"

  # Strong decline: CI upper < 0.95
  trend_class[trend_ci[, upp] < 0.95] <- "Strong decline"

  # Moderate decline: CI upper in [0.95, 1[
  trend_class[trend_ci[, upp] >= 0.95 & trend_ci[, upp] < 1] <- "Moderate decline"

  # Uncertain: CI crosses both 0.95 and 1.05
  trend_class[is.na(trend_class) &
    (trend_ci[, upp] > 1.05 | trend_ci[, low] < 0.95)] <- "Uncertain"

  # Stable: everything else
  trend_class[is.na(trend_class)] <- "Stable"

  return(trend_class)
}

#' Estimate indicator trend with bootstrap CIs
estimate_ind_trends <- function(msi0, msi_boot) {
  setDT(msi0)
  maxyear <- max(msi0$year)
  minyear <- min(msi0$year)

  # Fit linear model to log-transformed smoothed indicator
  lm_obj <- try(lm(log(SMOOTH) ~ year, msi0), silent = TRUE)

  msi_trend <- data.frame(
    rate_lt = ifelse(!inherits(lm_obj, "try-error"), exp(coef(lm_obj)[2]), NA),
    pc1_lt = ifelse(!inherits(lm_obj, "try-error"), 100 * (exp(coef(lm_obj)[2]) - 1), NA),
    pcn_lt = ifelse(!inherits(lm_obj, "try-error"),
      100 * (exp(coef(lm_obj)[2])^(maxyear - minyear) - 1), NA
    )
  )

  # Calculate trends for all bootstrap samples
  msi_boot_trends <- do.call(rbind, apply(msi_boot, 2, function(msi_boot1) {
    lm_obj_boot <- try(lm(log(msi_boot1) ~ msi0$year), silent = TRUE)
    data.frame(
      rate_lt = ifelse(!inherits(lm_obj_boot, "try-error"), exp(coef(lm_obj_boot)[2]), NA),
      pc1_lt = ifelse(!inherits(lm_obj_boot, "try-error"),
        100 * (exp(coef(lm_obj_boot)[2]) - 1), NA
      ),
      pcn_lt = ifelse(!inherits(lm_obj_boot, "try-error"),
        100 * (exp(coef(lm_obj_boot)[2])^(maxyear - minyear) - 1), NA
      )
    )
  }))

  # Calculate CIs from bootstrap
  msi_trend$rate_lt_low <- quantile(msi_boot_trends$rate_lt, 0.025, na.rm = TRUE)
  msi_trend$rate_lt_upp <- quantile(msi_boot_trends$rate_lt, 0.975, na.rm = TRUE)
  msi_trend$pc1_lt_low <- quantile(msi_boot_trends$pc1_lt, 0.025, na.rm = TRUE)
  msi_trend$pc1_lt_upp <- quantile(msi_boot_trends$pc1_lt, 0.975, na.rm = TRUE)
  msi_trend$pcn_lt_low <- quantile(msi_boot_trends$pcn_lt, 0.025, na.rm = TRUE)
  msi_trend$pcn_lt_upp <- quantile(msi_boot_trends$pcn_lt, 0.975, na.rm = TRUE)

  # Classify trend
  msi_trend$TrendClass_lt <- trend_class_func(msi_trend)

  msi_trend$minyear <- minyear
  msi_trend$maxyear <- maxyear
  msi_trend$nboot_lt <- sum(!is.na(msi_boot_trends$rate_lt))

  return(msi_trend)
}

# ============================================================================
# Main GBI Calculation
# ============================================================================

cat("\n1. Loading species bootstrap data...\n")

# Load metadata to get list of species to include
cat("   Loading species metadata...\n")
species_metadata <- fromJSON(species_metadata_json)

# Extract species names from the array of objects
# grasslandSpecies is an array of {scientificName, type} objects
if (is.data.frame(species_metadata$grasslandSpecies)) {
  grassland_species_list <- species_metadata$grasslandSpecies$scientificName
} else if (is.list(species_metadata$grasslandSpecies)) {
  grassland_species_list <- sapply(species_metadata$grasslandSpecies, function(x) x$scientificName)
} else {
  grassland_species_list <- species_metadata$grasslandSpecies
}

if (length(grassland_species_list) == 0) {
  stop("No grassland species specified in metadata")
}

cat(sprintf("   Grassland species to include: %s\n",
    paste(grassland_species_list, collapse = ", ")))

# Find all bootstrap RDS files
all_species_files <- list.files(bootstrap_dir, pattern = "*_boot.rds$", full.names = TRUE)
cat(sprintf("   Found %d total bootstrap files in directory\n", length(all_species_files)))

# Filter to only include species in grassland_species_list
# Convert species names to safe filenames (same as rbms-collated-index.R does)
safe_names <- gsub(" ", "_", tolower(grassland_species_list))
expected_files <- paste0(safe_names, "_boot.rds")

species_files <- all_species_files[basename(all_species_files) %in% expected_files]
cat(sprintf("   Filtered to %d files matching grassland species list\n", length(species_files)))

if (length(species_files) == 0) {
  stop("No bootstrap RDS files found for specified grassland species in ", bootstrap_dir)
}

# Load only the filtered species data
co_index <- rbindlist(lapply(species_files, readRDS), fill = TRUE)
cat(sprintf("   Loaded %d rows (%d bootstrap iterations) for %d species\n",
    nrow(co_index), uniqueN(co_index$BOOTi), uniqueN(co_index$SPECIES)))

cat("\n2. Preparing data for MSI calculation...\n")

# Filter out rows where COL_INDEX is zero or invalid
# This removes years where a species had zero abundance (can't take log of zero)
cat(sprintf("   Before filtering: %d rows, %d species\n",
    nrow(co_index), uniqueN(co_index$SPECIES)))

# Show per-species row counts before filtering
species_counts_before <- co_index[, .(rows_before = .N), by = SPECIES]
setkey(species_counts_before, SPECIES)

co_index <- co_index[!is.na(COL_INDEX) & is.finite(COL_INDEX) & COL_INDEX > 0]
cat(sprintf("   After filtering: %d rows with valid COL_INDEX values\n", nrow(co_index)))

# Show per-species row counts after filtering
species_counts_after <- co_index[, .(rows_after = .N), by = SPECIES]
setkey(species_counts_after, SPECIES)

# Merge and display
species_counts <- merge(species_counts_before, species_counts_after, all = TRUE)
species_counts[is.na(rows_after), rows_after := 0]
cat("\n   Per-species filtering results:\n")
print(species_counts)

cat(sprintf("\n   Species in final dataset: %s\n", paste(unique(co_index$SPECIES), collapse = ", ")))
cat(sprintf("   Years: %d-%d\n", min(co_index$M_YEAR), max(co_index$M_YEAR)))

# Check for species with data only in later years
first_year <- min(co_index$M_YEAR)
species_first_years <- co_index[, .(first_year_with_data = min(M_YEAR)), by = SPECIES]
late_starters <- species_first_years[first_year_with_data > first_year]
if (nrow(late_starters) > 0) {
  cat("\n   Species starting after first year:\n")
  print(late_starters)
}

# CRITICAL: Recalculate TRMOBS to center each species in log-space
# This makes species comparable in the multi-species indicator calculation
# Each species was normalized to its own baseline year, so raw COL_INDEX values
# are on different scales. Centering by mean(LOGDENSITY) fixes this.
cat("\n   Centering TRMOBS for cross-species comparability...\n")
co_index[, LOGDENSITY := log10(COL_INDEX)]
co_index[, TRMOBS := LOGDENSITY - mean(LOGDENSITY) + LOG10_CENTER, by = .(SPECIES, BOOTi)]
cat("   [OK] TRMOBS recalculated and centered\n")

# Use standard LOESS span of 0.75 (EU GBI standard)
loess_span <- 0.75
n_years <- uniqueN(co_index$M_YEAR)
cat(sprintf("\n   Time series length: %d years -> Using LOESS span: %.2f\n", n_years, loess_span))

cat("\n3. Calculating main indicator (BOOTi == 0)...\n")
# Pass the calculated span to the function
msi <- produce_indicator0(co_index[BOOTi == 0], loess_span = loess_span)
cat(sprintf("   Indicator calculated for %d years\n", nrow(msi)))

# Warn about years with only one species (not truly a multi-species indicator)
single_species_years <- msi$year[msi$NSPECIES == 1]
if (length(single_species_years) > 0) {
  cat(sprintf("   Warning: Years with only 1 species (not a true multi-species indicator): %s\n",
              paste(single_species_years, collapse=", ")))
}

cat("\n4. Calculating bootstrap indicators...\n")
# Pass the calculated span to the function
msi_boot <- produce_indicators_boot(co_index[BOOTi > 0], loess_span = loess_span)

# Handle empty bootstrap case
if (is.null(msi_boot) || ncol(msi_boot) == 0) {
  cat("   Warning: No bootstrap samples available - CIs will be set to NA\n")
  msi$ci_lower <- msi$ci_upper <- NA
  msi$ci80_lower <- msi$ci80_upper <- NA
  msi$ci90_lower <- msi$ci90_upper <- NA
} else {
  cat(sprintf("   Bootstrap indicators: %d iterations x %d years\n",
      nrow(msi_boot), ncol(msi_boot)))

  cat("\n5. Adding confidence intervals...\n")
  msi <- add_indicator_CI(msi, msi_boot)
  cat("   95%, 90%, and 80% CIs calculated\n")
}

cat("\n6. Estimating GBI trend...\n")

# Only calculate trend if we have bootstrap samples
if (is.null(msi_boot) || ncol(msi_boot) == 0) {
  cat("   Warning: Cannot calculate trend CIs without bootstrap samples\n")
  # Create a minimal trend object with point estimates only
  maxyear <- max(msi$year)
  minyear <- min(msi$year)
  lm_obj <- try(lm(log(SMOOTH) ~ year, msi), silent = TRUE)

  msi_trend <- data.frame(
    rate_lt = ifelse(!inherits(lm_obj, "try-error"), exp(coef(lm_obj)[2]), NA),
    rate_lt_low = NA,
    rate_lt_upp = NA,
    pc1_lt = ifelse(!inherits(lm_obj, "try-error"), 100 * (exp(coef(lm_obj)[2]) - 1), NA),
    pc1_lt_low = NA,
    pc1_lt_upp = NA,
    pcn_lt = ifelse(!inherits(lm_obj, "try-error"),
      100 * (exp(coef(lm_obj)[2])^(maxyear - minyear) - 1), NA),
    pcn_lt_low = NA,
    pcn_lt_upp = NA,
    TrendClass_lt = "Uncertain",
    minyear = minyear,
    maxyear = maxyear,
    nboot_lt = 0
  )
} else {
  msi_trend <- estimate_ind_trends(msi, msi_boot)
}

cat(sprintf("   Trend: %s (%.1f%%/yr)\n",
    msi_trend$TrendClass_lt, msi_trend$pc1_lt))
cat(sprintf("   Total change: %.1f%% [%.1f%%, %.1f%%]\n",
    msi_trend$pcn_lt, msi_trend$pcn_lt_low, msi_trend$pcn_lt_upp))

cat("\n7. Preparing JSON output...\n")

# Convert to JavaScript-compatible structure
gbiByYear <- lapply(1:nrow(msi), function(i) {
  list(
    year = as.integer(msi$year[i]),
    gbiValue = round(msi$indicator[i], 2),
    ci_lower = round(msi$ci_lower[i], 2),
    ci_upper = round(msi$ci_upper[i], 2),
    ci80_lower = round(msi$ci80_lower[i], 2),
    ci80_upper = round(msi$ci80_upper[i], 2),
    ci90_lower = round(msi$ci90_lower[i], 2),
    ci90_upper = round(msi$ci90_upper[i], 2),
    smoothedValue = round(msi$SMOOTH[i], 2),
    speciesIndices = list(), # Will be filled by JavaScript
    dataQuality = list(
      transectCount = 0, # Will be filled by JavaScript
      totalVisits = 0,
      speciesWithData = as.integer(msi$NSPECIES[i])
    )
  )
})
names(gbiByYear) <- as.character(msi$year)

# Overall GBI trend
gbiTrend <- list(
  category = as.character(msi_trend$TrendClass_lt),
  rate = round(msi_trend$rate_lt, 4),
  rateCI = list(
    lower = round(msi_trend$rate_lt_low, 4),
    upper = round(msi_trend$rate_lt_upp, 4)
  ),
  pcn = round(msi_trend$pcn_lt, 2),
  pcnCI = list(
    lower = round(msi_trend$pcn_lt_low, 2),
    upper = round(msi_trend$pcn_lt_upp, 2)
  ),
  pc1 = round(msi_trend$pc1_lt, 2),
  pc1CI = list(
    lower = round(msi_trend$pc1_lt_low, 2),
    upper = round(msi_trend$pc1_lt_upp, 2)
  )
)

# Metadata
metadata <- list(
  baselineYear = baseline_year,
  grasslandSpecies = species_metadata$grasslandSpecies,
  qualityCriteria = species_metadata$qualityCriteria,
  transectsUsed = species_metadata$transectsUsed,
  # Update calculation method string to show actual span used
  calculationMethod = sprintf("rbms + MSI (LOESS smoothing span=%.2f, bootstrap CIs)", loess_span),
  confidenceInterval = list(
    method = "multi_species_bootstrap",
    nIterations = as.integer(msi_trend$nboot_lt),
    confidenceLevel = 0.95
  )
)

output <- list(
  metadata = metadata,
  gbiByYear = gbiByYear,
  speciesTrends = list(), # Will be filled by JavaScript
  years = sort(as.integer(msi$year)),
  gbiTrend = gbiTrend
)

cat(sprintf("\n8. Writing output to %s...\n", output_json))
write_json(output, output_json, pretty = TRUE, auto_unbox = TRUE)

cat("\n=== GBI Calculation Complete ===\n")
cat(sprintf("Years: %d\n", length(output$years)))
cat(sprintf("Trend: %s\n", gbiTrend$category))
cat(sprintf("Annual rate: %.2f%% [%.2f%%, %.2f%%]\n",
    gbiTrend$pc1, gbiTrend$pc1CI$lower, gbiTrend$pc1CI$upper))