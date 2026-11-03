// Build replaces this one value from SITE_URL. Relative defaults work on any static host.
// Keep this pre-Imperium storage identity: renaming it would strand existing saves.
// `platform` is 'web' here and in the web build; the desktop build (scripts/build.mjs --target desktop) writes 'desktop'.
export const CONFIG = Object.freeze({ siteUrl: '', version: '0.38.1', saveKey: 'sacramentum.campaign.v1', platform: 'web' });

