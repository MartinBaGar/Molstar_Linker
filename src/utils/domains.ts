export const DEFAULT_DOMAINS = [
    'github.com',
    'raw.githubusercontent.com',
    'gitlab.com',
    'rcsb.org',
    'alphafold.ebi.ac.uk',
] as const;

export function isDefaultDomain(domain: string): boolean {
  return DEFAULT_DOMAINS.some(d => domain.includes(d));
}
