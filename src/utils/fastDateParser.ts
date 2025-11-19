/**
 * Fast date parser optimized for DD/MM/YYYY format.
 * This is ~100x faster than moment.js for this specific use case.
 */

// Cache for parsed years to avoid re-parsing the same date strings
const yearCache = new Map<string, number>();
const monthCache = new Map<string, number>();
const dateObjCache = new Map<string, Date>();

/**
 * Extract year from DD/MM/YYYY date string (fast path).
 * Uses caching to avoid re-parsing the same dates.
 *
 * @param dateString - Date in DD/MM/YYYY format
 * @returns Year as number
 */
export function getYearFromDateString(dateString: string): number {
  // Check cache first
  const cached = yearCache.get(dateString);
  if (cached !== undefined) {
    return cached;
  }

  // Fast parse: just extract year part (last 4 characters after second slash)
  const lastSlashIndex = dateString.lastIndexOf("/");
  const year = parseInt(dateString.substring(lastSlashIndex + 1), 10);

  // Cache the result
  yearCache.set(dateString, year);

  return year;
}

/**
 * Extract month (0-indexed) from DD/MM/YYYY date string.
 * Uses caching to avoid re-parsing the same dates.
 *
 * @param dateString - Date in DD/MM/YYYY format
 * @returns Month as 0-indexed number (0 = January, 11 = December)
 */
export function getMonthFromDateString(dateString: string): number {
  // Check cache first
  const cached = monthCache.get(dateString);
  if (cached !== undefined) {
    return cached;
  }

  // Fast parse: extract month part (between first and second slash)
  const firstSlashIndex = dateString.indexOf("/");
  const secondSlashIndex = dateString.indexOf("/", firstSlashIndex + 1);
  const month = parseInt(dateString.substring(firstSlashIndex + 1, secondSlashIndex), 10) - 1; // 0-indexed

  // Cache the result
  monthCache.set(dateString, month);

  return month;
}

/**
 * Parse DD/MM/YYYY string to Date object (with caching).
 * Only use when you actually need a Date object.
 *
 * @param dateString - Date in DD/MM/YYYY format
 * @returns Date object
 */
export function parseDateString(dateString: string): Date {
  // Check cache first
  const cached = dateObjCache.get(dateString);
  if (cached !== undefined) {
    return cached;
  }

  const [day, month, year] = dateString.split("/").map(Number);
  // Month is 0-indexed in JavaScript Date
  const date = new Date(year, month - 1, day);

  // Cache the result
  dateObjCache.set(dateString, date);

  return date;
}

/**
 * Format date to Portuguese format "D de MMMM de YYYY"
 * e.g., "15 de maio de 2023"
 *
 * @param dateString - Date in DD/MM/YYYY format
 * @returns Formatted date string in Portuguese
 */
export function formatDatePortuguese(dateString: string): string {
  const monthNames = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];

  const [day, month, year] = dateString.split("/").map(Number);
  return `${day} de ${monthNames[month - 1]} de ${year}`;
}

/**
 * Compare two date strings to determine which is earlier.
 *
 * @param date1 - First date in DD/MM/YYYY format
 * @param date2 - Second date in DD/MM/YYYY format
 * @returns true if date1 is before date2
 */
export function isDateBefore(date1: string, date2: string): boolean {
  const d1 = parseDateString(date1);
  const d2 = parseDateString(date2);
  return d1.getTime() < d2.getTime();
}

/**
 * Clear all date caches. Useful when switching datasets.
 */
export function clearDateCache(): void {
  yearCache.clear();
  monthCache.clear();
  dateObjCache.clear();
}

/**
 * Get cache statistics for debugging/monitoring.
 */
export function getDateCacheStats() {
  return {
    yearCacheSize: yearCache.size,
    monthCacheSize: monthCache.size,
    dateObjCacheSize: dateObjCache.size,
    totalEntries: yearCache.size + monthCache.size + dateObjCache.size,
  };
}
