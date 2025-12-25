/**
 * Types for Nominatim geocoding API
 */

export interface NominatimAddress {
  municipality?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
}

export interface NominatimResponse {
  address?: NominatimAddress;
}
