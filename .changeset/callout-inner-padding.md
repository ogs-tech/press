---
"@ogs-tech/create-press": patch
---

Give the scaffolded `custom.callout` block inner padding so its message no longer sits flush against the colored left border. The `<aside>` now pads `0.5rem` vertically and `1rem` on the left (mirroring the engine's `press.quote` spacing), letting the accent bar extend slightly past single-line text and keeping multi-line callouts balanced.
