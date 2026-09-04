/**
 * Centralized Region Code Configuration & Resolver
 * Derives a standardized 3-letter uppercase region code from city, district, or state.
 *
 * Map lookup uses trim+lowercase (spaces preserved) so multi-word city names like
 * "New Delhi" are correctly resolved.
 *
 * For cities not in the map, the first 3 alpha characters of the city name are used
 * as the region code, making registration open to any city nationwide.
 *
 * An empty or whitespace-only city falls through to district, then state, then 'GEN'.
 * 'GEN' is a valid, deterministic fallback — it never causes a crash or silent failure.
 */

const CITY_CODE_MAP: Record<string, string> = {
  // Tamil Nadu
  madurai: 'MDU',
  chennai: 'CHE',
  coimbatore: 'CBE',
  salem: 'SLM',
  tiruchirappalli: 'TRZ',
  trichy: 'TRZ',
  tirunelveli: 'TNV',
  erode: 'EDO',
  vellore: 'VLR',
  thoothukudi: 'TUT',
  thanjavur: 'TNJ',
  dindigul: 'DGL',

  // Major Indian Metros & Cities
  delhi: 'DEL',
  'new delhi': 'DEL',
  mumbai: 'BOM',
  bengaluru: 'BLR',
  bangalore: 'BLR',
  hyderabad: 'HYD',
  kolkata: 'KOL',
  pune: 'PUN',
  ahmedabad: 'AMD',
  jaipur: 'JAI',
  lucknow: 'LKO',
  chandigarh: 'CHD',
  bhopal: 'BPL',
  kochi: 'KOC',
  cochin: 'KOC',
  thiruvananthapuram: 'TRV',
  trivandrum: 'TRV',
  visakhapatnam: 'VTZ',
  patna: 'PAT',
  nagpur: 'NGP'
};

const normalizeForLookup = (str: string): string =>
  str
    .trim()
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ');

/**
 * Resolves a 3-letter uppercase region code from location parameters.
 *
 * Resolution order: city → district → state → 'GEN'
 * For unmapped cities/districts the first 3 alpha characters are used,
 * so instruments can be registered from any city in India.
 */
export const resolveRegionCode = (city?: string, district?: string, state?: string): string => {
  const tryResolve = (name: string | undefined): string | null => {
    if (!name || !name.trim()) return null;

    // Map lookup: trim + lowercase, preserving spaces for multi-word names
    const key = normalizeForLookup(name);
    if (CITY_CODE_MAP[key]) {
      return CITY_CODE_MAP[key];
    }

    // Fallback: first 3 alpha characters of the name (deterministic, never crashes)
    const alphaOnly = name.toUpperCase().replace(/[^A-Z]/g, '');
    if (alphaOnly.length >= 3) {
      return alphaOnly.substring(0, 3);
    }

    return null;
  };

  return tryResolve(city) ?? tryResolve(district) ?? tryResolve(state) ?? 'GEN';
};
