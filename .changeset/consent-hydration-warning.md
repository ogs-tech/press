---
'@ogs-tech/press-web': patch
---

fix: suppress the React hydration warning caused by the consent bootstrap script

The pre-paint consent script stamps `<html data-press-consent="decided">`
before React hydrates, but the server-rendered element never carries that
attribute (reading the cookie in the RSC tree would force the route dynamic).
React 19 reported a hydration mismatch for every returning visitor who had
already decided. The host template's `<html>` now sets
`suppressHydrationWarning` — the canonical fix for pre-paint attribute
stamping (the next-themes pattern); it silences only that element's attribute
diff, so real content mismatches in children still surface.
