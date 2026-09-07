# Branding

The node uses Novu's official full-color square dashboard favicon byte-for-byte for both n8n themes. Source: `apps/dashboard/public/favicon-gradient.svg` in immutable [`novuhq/novu` commit `cf904665b2916e631c29f3187d6afe5169a7db89`](https://github.com/novuhq/novu/blob/cf904665b2916e631c29f3187d6afe5169a7db89/apps/dashboard/public/favicon-gradient.svg), retrieved 2026-09-06.

Both registered files have SHA-256 `cb594d2b275dc9308df325c348388b9395d7eae615b366ef9f9ba02267b08c82`. The upstream asset has a square `0 0 2000 2000` viewBox and an orange-to-magenta gradient. The same unmodified full-color asset serves light and dark registrations; package validation checks both files and hashes.

The same `apps/dashboard/public/favicon-gradient.svg` was also present on Novu's current default `next` branch on 2026-09-06 and independently matched that immutable-source SHA-256. This source comparison is not editor-rendering evidence.

The owner completed the requested pre-release source-checkout visual check in an actual local n8n editor and reported the official gradient icon was “perfect” before authorizing the next step. This confirms the requested node picker, canvas, node panel, and credential-form surfaces in light and dark themes. Exact n8n version and screenshots were not recorded. Packed-tarball visual confirmation and the independently stored Creator Portal card/version remain separate open gates.

This independent Black Swamp AI integration is not affiliated with, endorsed by, sponsored by, or maintained by Novu. The Novu name and logo belong to their respective owner and are used only to identify compatibility.
