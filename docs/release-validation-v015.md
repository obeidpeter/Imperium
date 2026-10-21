# Version 0.15 release validation

Version **0.15.0**, production revision **`846f713e4096`**. The complete Node suite passed **452/452 tests**. The last change was confined to CSS contrast; the seven campaign UI tests, production build and twelve asset/offline checks were rerun afterward. Browser rendering, legal campaign progression and audio decoding have completed the checks below. Ordinary production UI, paid Retry, edition-update and server-unavailable checks also passed within the scope below.

The [compact evidence record](presentation-verification-v015.json) contains the measured results, scope and SHA-256 hashes of the original local reports. It is self-contained in the source release; raw reports remain under the task's `work/v015` evidence directory. Earlier release screenshots are not evidence of this version.

## Changes under review

- New campaigns offer Story, Standard and Veteran difficulty. Their rules version and difficulty persist; legacy saves retain their original campaign rules.
- Eligible battle camps expose available veterans, deployment order and one preparation package. Selection does not spend supplies; departure pays once, and Retry restores the paid encounter setup. Training and legacy campaigns do not expose these controls.
- Selected battles have authored operation phases and successive objectives. Phase banners and optional contextual advice read authoritative state without advancing it.
- All 25 encounters have distinct staging metadata. Connected courts, gate approaches, landing refuges, camp streets and civic backdrops use original geometry and existing materials. Recommended overview angles retain camera fitting and clearance.
- A local material atlas adds linen, leather, mail and skin detail to the original procedural characters. Fourteen optional local recordings provide music, ambience, foley and selected briefings. [Provenance](presentation-assets-v015.md) records the files, prompts, exports and limitations. No external runtime media service is needed.

## Automated and legal-play evidence

| Check | Recorded result | Interpretation |
| --- | --- | --- |
| Complete Node suite | 452 passed; zero failed, cancelled, skipped or todo; 73,960.7279 ms. | Rules, platform and presentation regressions passed before the final contrast-only CSS adjustment. |
| Final campaign UI rerun | 7/7 passed; 553.2623 ms. | Read-only rendering and real `app.js` event hooks use an inert DOM and isolated storage substitute, not a rendered browser or device. |
| Final build and asset/offline verifier | Build `846f713e4096`; 12/12 checks passed. | Local hashes, resource grouping, worker failure/retry and version-scoped cache behavior passed the verifier. Its worker/cache is simulated. |
| Legacy compatibility | 1,041 commands and reloads compared state-for-state; 25 encounter retries; original route 213 turns. | The frozen v0.14.1 route remains exact. This is separate from the new-campaign rules. |
| New-campaign legal routes | Six New Game routes reached Augustus: 12 chapters, 25 victories and 25 commits each; no failed attempts recorded. | Seed 275, two authored choice routes at each difficulty. Commands are legal; final saves deserialize. Withdrawals were used. |

The six campaign results are:

| Difficulty | Default route: turns / commands / withdrawals | Alternate route: turns / commands / withdrawals |
| --- | --- | --- |
| Story | 220 / 1,101 / 2 | 225 / 1,121 / 2 |
| Standard | 217 / 1,079 / 2 | 222 / 1,098 / 2 |
| Veteran | 225 / 1,107 / 4 | 230 / 1,125 / 4 |

The alternate route chooses `ch2=leave`, `ch6=obey` and `ch8=soldiers`. The seven gameplay module hashes recorded with these results still match the release source. These routes establish legal reachability and consistent commits, not human pacing, difficulty calibration or enjoyment.

The separate seeded combat diagnostic **injects its starting campaigns**, then uses public preview/action/End Turn commands. Across 24 scenarios per policy, the simple policy won 21 and lost 3; the tactical policy won 24, with 4 withdrawals versus 9. Mean remaining strength was 61.042 versus 56.125. A limited opening-road beginner policy won 2/3 and lost its companion in all three cases. These results identify an opening-learning risk; they do not prove that new players will understand or enjoy the tactics. They are not additional full campaign playthroughs.

[Campaign UI tests](../tests/campaign-upgrade-ui.test.mjs) cover exact slot counts, duplicate prevention, labelled controls, affordability, escaping, operation phases, difficulty, coaching and sound settings. Actual app event hooks reject invalid plans without saving or charging, persist valid plans without premature spending, and keep preferences separate from the campaign save. Low supplies and hostile names are explicitly labelled stress fixtures. [Audio offline tests](../tests/audio-offline.test.mjs) verify chapter selections against the actual soundscape/briefing API and exact MP3 response bytes. Environment checks cover finite geometry, clear playable space, quality tiers, disposal, horizon/river continuity and Follow-camera regressions.

## Actual browser evidence

The records identify Windows Chromium **154**, a 1280 × 720 browser viewport and device-pixel ratio 2. These are desktop browser checks using legally reached checkpoints in the development harness; they do not read or write a player's campaign save and are not an uninterrupted manual campaign.

- **25 unique scenes, 518/518 assertions:** visible legal figures and anchors, live WebGL/weighted skinning, labels and objectives, camera/grid controls, one retained canvas, state purity, reduced-motion output and cancellation. The sweep used Balanced quality with a 1233 × 468 canvas. Its 1,078-command fixture predates the final 1,079-command legal fixture; the later opening check below used the latter.
- **Opening road, 20/20 assertions:** a separate final check with the 1,079-command fixture. A 120-frame idle sample after 18 warm-up frames recorded CPU render submission median **12.3 ms**, p95 **15.9 ms**, and RAF interval p95 **33.4 ms**. Draw calls ranged from 86 to 145, including changing shadow work. The complete saved state remained unchanged. This is one desktop observation, not a GPU timing, stable-frame-rate guarantee, before/after speed claim or phone benchmark.
- **Chapter XI adlection, 23/23 assertions:** Performance quality at a **360 × 420 canvas inside the desktop viewport**. Labels settled without visible overlap or out-of-bounds roots, including after cancelled motion. This is a narrow renderer check, not a physical phone or full-page mobile accessibility audit. The file also retains the preceding road row; that row is not counted as another new test.
- **Audio, 14/14 valid decodes:** all local recordings decoded with finite duration and PCM samples. No automatic playback or human listening assessment was performed. Tiny decoded sample fractions exceeded amplitude 1 in battle music (0.00051%), shield foley (0.00469%) and impact foley (0.01927%). These observations remain for a listening/mix review; the decode result is not a loudness, loop-seam or mastering verdict.

The broad scene check and targeted captures are version-tagged browser reports, not embedded build-hash attestations. Final source/build identity is supplied by the production build report; the release coordinator records the last adjustment as CSS contrast only. No unrecorded device or console-error claim is inferred.

## Final download measurements

| Resource group | Summed gzip bytes, including worker | Gate |
| --- | ---: | ---: |
| Initial shell | 379,537 | 2,000,000 |
| Chapter I | 7,866,599 | 8,000,000 |
| Complete campaign | 10,309,507 | 24,000,000 |

The build contains 172 runtime files: 71 initial and 101 deferred. Complete uncompressed bytes including the worker are 12,768,188. Chapter I retains **133,401 bytes** of gzip headroom. These are build sums, not browser network-transfer measurements. All fourteen recordings are deferred from the initial shell; chapter groups include their needed music, ambience, briefings and foley. Complete installation remains explicit.

## Production offline and Retry signoff

The release coordinator completed these ordinary UI checks on the final production build at local port **4395**, revision **`846f713e4096`**:

- A new Story campaign completed the drill in three turns. Selecting Naso and Rearm cost two supplies at departure: **14 → 12**, with hero ammunition **5**. Portable exported codes before and after Retry were **bit-identical**.
- Ordinary End Turn, 3D Move, Brace and End Turn commands reached **operation phase 2 on turn 3**.
- Explicit all-chapters download reached complete readiness. After stopping the owned local preview server, the title reloaded from cache. Continue restored **turn 3, phase 2 and Naso**; a confirmed Brace action displayed Saved while the server remained unavailable. The character-material atlas reported loaded. The preview server was then restarted.
- A **360px-wide camp with 200% game text** had no horizontal overflow. This is desktop responsive checking, not physical touch or genuine browser zoom. The light parchment contrast correction is included in the final build.
- The older revision displayed its worker update notice; closing and reopening retained the save and settings. The coordinator reported no browser errors or warnings during the production check.

These observations are recorded separately from the development harness in the compact evidence JSON. The actual screenshot is retained as `work/v015/production-offline.png`; the normal Follow view and phase 2 are captured in `work/v015/imperium-v015-preview.png`. The offline mechanism was **server unavailable**, not an OS network toggle. Complete cache readiness and one opening-road offline action do not establish all-chapter offline play, mobile installation, quota resilience or OS eviction recovery.

## Human and device limits

Physical iPhone/Android use, recruited first-time human playtests, screen-reader completion and human listening are **unverified**. So are a full human 90–150-minute playthrough, prolonged low-memory behavior, installed-app/OS eviction and update recovery, genuine browser zoom across every screen, native sharing and a complete touch/keyboard action matrix. The [playtest and device kit](playtest-kit.md) provides the procedures; its unperformed rows remain unperformed.

No participant outreach, telemetry or new account service was added. Five named veterans are the maximum company; later choices chiefly affect deployment, recovery and supplies. Original articulated geometry, generated materials and recordings should not be described as imported sculpts, motion capture, professional voice direction or evidence of player retention. The next human review should prioritize the opening road's teachability, preparation/Retry clarity and the audio mix.
