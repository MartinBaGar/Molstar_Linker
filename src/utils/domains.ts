export const DEFAULT_DOMAINS = [
  "github.com",
  "gitlab.com",
  "figshare.com",
  "zenodo.org",
] as const;

export function isDefaultDomain(host: string): boolean {
  const h = host.toLowerCase();
  return DEFAULT_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`));
}
