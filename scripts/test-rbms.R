#!/usr/bin/env Rscript

# Simple test of rbms functions
library(rbms)

cat("rbms version:", as.character(packageVersion("rbms")), "\n")

# Try to run the example from rbms documentation
data(m_visit)
data(m_count)

cat("Example data loaded\n")
cat("m_visit columns:", paste(colnames(m_visit), collapse = ", "), "\n")
cat("m_count columns:", paste(colnames(m_count), collapse = ", "), "\n")

# Try temporal framework
ts_date <- ts_dwmy_table(InitYear = 2000, LastYear = 2003, WeekDay1 = "monday")
ts_season <- ts_monit_season(ts_date, StartMonth = 4, EndMonth = 9, StartDay = 1,
                             EndDay = 30, CompltSeason = TRUE, Anchor = TRUE,
                             AnchorLength = 2, AnchorLag = 2, TimeUnit = "w")

cat("Temporal framework created\n")

#Try flight curve
ts_flight_curve <- flight_curve(m_count, NbrSample = 100, MinVisit = 3, MinOccur = 2,
                                 MinNbrSite = 1, MaxTrial = 3, GamFamily = "nb",
                                 SpeedGam = FALSE, CompltSeason = TRUE, SelectYear = NULL,
                                 TimeUnit = "w")

cat("Flight curve calculated\n")

# Try site index
site_index_result <- site_index(butterfly_count = m_count, MinFC = 0.10)

cat("Site index calculated:", nrow(site_index_result), "rows\n")
cat("Site index columns:", paste(colnames(site_index_result), collapse = ", "), "\n")

cat("\nTest completed successfully!\n")
