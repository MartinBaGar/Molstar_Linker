export const DEFAULT_DOMAINS = [
    'github.com',
    'gitlab.com',
    'figshare.com',
    'zenodo.org',
] as const;

export function isDefaultDomain(domain: string): boolean {
    return DEFAULT_DOMAINS.some(d => domain.includes(d));
}
