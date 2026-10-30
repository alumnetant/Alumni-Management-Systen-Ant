/**
 * Pluggable Corporate Registry Provider Interface
 * Allows querying corporate registries per country (e.g. SEC Philippines, Companies House, OpenCorporates)
 */

export interface RegistryQueryResult {
  found: boolean;
  status: 'active' | 'dissolved' | 'suspended' | 'not_found' | 'registry_unchecked';
  matchedLegalName?: string;
  registrationNumber?: string;
  matchScore?: number; // 0.0 to 1.0
  source: string;
  queriedAt: string;
  details?: Record<string, any>;
  error?: string;
}

export interface IRegistryProvider {
  readonly providerName: string;
  readonly countryCode: string; // ISO 3166-1 alpha-2, e.g. "PH", "US", "GB"
  queryCompany(legalName: string, registrationNumber?: string): Promise<RegistryQueryResult>;
}
