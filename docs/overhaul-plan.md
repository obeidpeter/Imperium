# Version 0.7 implementation direction

The new complete graphics and gameplay brief governs this pass. The twelve approved chapters, historical anchors, decisions, promise limit, deadline voting, encounter transactions and final milestone gates remain intact. The existing implementation is JavaScript ES modules, not the TypeScript stack named in the brief; retaining its browser-free rules avoids an unrelated rewrite. Standard remains the supported difficulty while its tactical systems are improved.

## Audit and priority

The unmodified 0.6 source, distribution and fixtures are frozen in `work/overhaul-baseline-06/Sacramentum` outside the deliverable. Its full unit suite passes 215 tests. Existing missions already include extraction, hold, capture, supply, recovery and distinct finale routes; adding more objectives would not fix the underlying decision quality.

1. Combat: mostly nearest-target AI underuses cover, role, guard anchors and scenario objectives. Formation effects need positional tradeoffs. Improve the authoritative rules and publish understandable intentions. See `overhaul-combat-design.md`.
2. Politics: interests exist, but rival tactics and coalition risks are hard to anticipate. Improve objective-aware political opposition and exact previews without changing commitment, vote denominator or promise limits. See `overhaul-politics-design.md`.
3. Usability: objectives, enemy plans, delegate interests and morale sit behind an optional disclosure. Surface a compact mission brief, coalition status, named intentions and contextual terrain/action information. Keep the select–preview–confirm loop and equivalent keyboard selectors.
4. Progression: ranks and ceremonies exist, but the next practical responsibility is scattered through prose. Add authored chapter briefings and earned responsibility summaries tied to actual unlocks. Preserve all story choices and callbacks.
5. Rendering: extend the existing painted atlases and 2.5D renderer, with consistent terrain, unit silhouettes, material depth and political feedback. See `overhaul-visual-design.md`. No 3D conversion or external runtime assets.
6. Feedback: differentiate outcomes and political cues, add adjustable optional effects volume, and shorten routine turn dispatch presentation. No voice acting or audio dependency.

## Compatibility and verification contracts

New tactical or political rules are encounter-versioned. Suspended 0.6 encounters retain their old outcomes and retry rules; the next new encounter uses the new rules. Validate the versioned fields and migrate the retry options explicitly. Preview and rendering remain read-only.

Keep both existing compressed build gates: first load and the stricter complete campaign at 2,000,000 bytes. Preserve chapter lazy loading, data saving, offline downloads and presentation quality controls. Record any measured performance regressions rather than implying visual improvement is free.

Run legal New Game-to-Augustus autoplay, revised mechanic tests, old-save comparisons, seeded bot diagnostics and actual browser control checks. Capture matching pre/post scenes at the same viewport. Automated completion is not a human enjoyment or 90–150-minute pacing measurement; physical-device and independent player checks must remain explicitly unverified if unavailable.
