/** 帯では名前（`ui-strong`）とドメイン（`code`）を分けて組む */
export const SITE_LABEL = "games";
export const SITE_DOMAIN = ".kage1020.com";
export const SITE_NAME = `${SITE_LABEL}${SITE_DOMAIN}`;

export function pageTitle(page?: string): string {
  return page ? `${page} — ${SITE_NAME}` : SITE_NAME;
}
