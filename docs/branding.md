# Branding

The node uses Novu's official adaptive square dashboard favicon byte-for-byte for both n8n themes. Source: `apps/dashboard/public/favicon.svg` in [`novuhq/novu` commit `dc9caee828136e25db2400433e2f67e2193f964c`](https://github.com/novuhq/novu/blob/dc9caee828136e25db2400433e2f67e2193f964c/apps/dashboard/public/favicon.svg), accessed 2026-09-06.

Both source icons have SHA-256 `20e24ddd90a6e22d367544579645ed50d3a138760f07b2fa7ddcb763c69ba2d8`. The upstream asset has a square `0 0 2000 2000` viewBox and adapts its black/white fill using `prefers-color-scheme`, so the same unmodified asset is appropriate for light and dark registrations. Package validation checks both files and their hashes.

Source and packed-file checks do not establish presentation quality. Light/dark rendering in the actual n8n editor and the independently stored Creator Portal card/version remain visual human gates; neither has been inspected through Batch 8.

This independent Black Swamp AI integration is not affiliated with, endorsed by, sponsored by, or maintained by Novu. The Novu name and logo belong to their respective owner and are used only to identify compatibility.
