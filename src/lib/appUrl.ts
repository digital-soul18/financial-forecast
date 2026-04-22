/**
 * Returns the canonical app URL with no trailing slash.
 * Throws clearly if APP_URL is not configured so misconfiguration is obvious.
 */
export function getAppUrl(): string {
  const raw = process.env.APP_URL ?? '';
  if (!raw) {
    console.error('[appUrl] APP_URL env var is not set — email links will be broken');
  }
  return raw.replace(/\/+$/, ''); // strip trailing slash(es)
}
