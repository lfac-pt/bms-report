/**
 * Date parsing utilities
 */

/**
 * Parse a date string in DD/MM/YYYY format and extract the year
 */
export function getYearFromDate(dateString: string): number | null {
  if (!dateString || typeof dateString !== "string") return null;
  const parts = dateString.split("/");
  if (parts.length !== 3) return null;
  const year = parseInt(parts[2], 10);
  return isNaN(year) ? null : year;
}

/**
 * Parse a date string in DD/MM/YYYY format and extract the month (0-indexed)
 */
export function getMonthFromDate(dateString: string): number | null {
  if (!dateString || typeof dateString !== "string") return null;
  const parts = dateString.split("/");
  if (parts.length !== 3) return null;
  const month = parseInt(parts[1], 10) - 1; // Convert to 0-indexed (0 = Jan, 1 = Feb, etc.)
  return isNaN(month) ? null : month;
}
