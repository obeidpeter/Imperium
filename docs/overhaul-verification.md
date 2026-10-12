# Graphics and gameplay overhaul verification

Version **0.7.0**, final production revision **92400cbd6662**. Comparison baseline: frozen **0.6.0** (9968c5977d0c). The [browser evidence](evidence/overhaul-browser.json) contains compact per-case metrics and hashes of the original captures/reports. The [regression evidence](evidence/overhaul-regression.json) records tests, legal autoplay and unchanged package gates. Full raw browser reports and matching JPEGs are supplied in the separate **overhaul-review** gallery. The JPEG files are unchanged browser screenshot bytes, not edited or re-encoded artwork.

## Implemented changes

Combat now exposes the revised positioning, screening, terrain and formation rules through authoritative previews and public intentions. Political action forecasts expose stance/Resolve consequences, promise costs and opponent intent. The renderer adds distinct chapter/chamber materials, natural stone and palm forms, worn masonry, formation/guard/morale markers, visible political commitment and recipient-linked feedback. Source-directed recoil and command gestures remain presentation-only. See the [combat design](overhaul-combat-design.md), [political design](overhaul-politics-design.md) and [visual design](overhaul-visual-design.md) for exact scope and compatibility behavior.

- Inspected matched opening, Chapter IX battlefield, Senate and accession screenshots. Terrain now has irregular stone silhouettes, curved palms, distinct chapter palettes and clearer elevation; the original painted unit and portrait assets remain in use.
- The live Senate separates a visible coalition tally, exact target interests and cost preview from the board. A selected-action contrast issue and enlarged vote-track overflow were found and corrected.
- Formation bases, facing arrows, guard arcs, low-morale markers and committed votes add tactical cues without changing hit testing. Dense formations can still overlap visually; named selectors remain available.
- The live accession loaded its full imperial scene and choice-dependent legacy, with no missing artwork in the inspected scenes. Scene encoding changes preserved composition, but are lossy, not a new art set.

Existing narrative scene masters were re-encoded from WebP quality **76 to 74**, and the title from **80 to 78**. Pixel dimensions and composition remain the same; portraits and tactical atlases are unchanged. This is lossy encoding optimization, not lossless compression or newly painted artwork.

## Measured comparison

The same **28 static cases** (24 board/size combinations plus four narrative cases) used five warmups and 45 measured draws each. Both editions used the same legally reached legacy fixture hashes, 1280 × 900 desktop viewport, DPR 1, balanced quality and warmed artwork. This isolates rendering differences while the separate legal autoplay exercises revised gameplay.

| Work | Cases | Median of per-case medians, ms: before → after | Range of per-case p95, ms: before → after |
| --- | ---: | ---: | --- |
| All Canvas boards | 24 | 1.10 → 1.80 | 1.20–1.90 → 1.40–3.30 |
| Canvas 360 × 196 | 12 | 1.10 → 1.75 | 1.30–1.90 → 1.50–3.30 |
| Canvas 720 × 540 | 12 | 1.10 → 1.80 | 1.20–1.90 → 1.40–2.50 |
| Narrative DOM/layout | 4 | 4.65 → 5.20 | 4.40–7.90 → 5.20–10.90 |

Eight actual animation cases at **960 × 640** ran one warmup and six plays each. Median of per-case CPU medians: **1.65 → 1.80 ms**. Per-case p95 range: **1.80–3.50 → 1.40–4.80 ms**. Every case completed with real paint/RAF samples and unchanged input-state hashes. Per-case cadence and cleanup remain in the raw reports; CPU submission does not wait for the GPU. These measurements neither guarantee FPS nor establish physical-phone performance.

The richer presentation cost more CPU in this measured series: board, narrative and motion medians all increased. The smaller complete download is a separate result of compression and dead-code removal, not evidence of faster rendering.

Matched rendering benchmarks use unchanged v0.6 legal scene/action fixtures to isolate the renderer. After captures used revised rendering code before final compatibility, help and vote-track CSS fixes; these fixes do not change the benchmark renderer. Separate regenerated v0.7 fixtures replay 1,041 legal commands and the final production smoke uses rules version 2.

| Compressed package measure | Baseline bytes | Final bytes | Limit |
| --- | ---: | ---: | ---: |
| Initial shell | 318,580 | 327,315 | 2,000,000 |
| Shell plus Chapter 1 | 1,286,671 | 1,292,052 | 2,000,000 |
| Complete campaign | 1,991,422 | 1,980,194 | 2,000,000 |

Sizes are sums of per-file gzip output including the service worker, not a cold-network timing result. The decoded-art limit remains 24 entries / 24 MiB plus the separately bounded terrain canvas; diagnostic JS heap snapshots do not measure all decoded/GPU/browser memory.

## Gameplay and regression evidence

The supplied final test run passed **247/247** tests, with zero failures, cancellations or skips. **9** asset/offline checks passed. New Game autoplay completed all **25 encounters**, all twelve chapters and the **Augustus** rank through successful legal commands: **213 turns**, encounter range **2–14**, non-training range **2–14**. This is one deterministic route, not measured human campaign duration or a claim about every possible strategy.

A separate fresh source copy omitted both the production distribution and generated test fixtures. The preparation script regenerated all three fixture sets sequentially, then a direct Node test run passed **247/247** tests with exit code 0. Preparation was invoked from outside the project directory to verify path handling. This exercised the commands behind the new npm pretest hook, not an invocation of npm verify. The outer Python wrapper encountered a Windows console-encoding error after the successful Node process; its saved UTF-8 [test log](evidence/overhaul/clean-source-tests.txt) and [structured result](evidence/overhaul/clean-source.json) were checked independently. Generated fixtures remain excluded from the source archive and are rebuilt by npm test.

The diagnostic compares eight authored battle scenarios over seeds **17, 275, 913**, with identical seeded starts for policies inside each edition and the same maps across editions. Campaign starts are injected for these scenario diagnostics; subsequent encounter commands use legal public APIs. The tactical policy was also updated, so cross-edition changes combine rule and policy changes.

| Policy | Wins before → after | Mean turns before → after | Mean remaining strength before → after |
| --- | ---: | ---: | ---: |
| Objective-aware | 22/24 → 21/24 | 7.79 → 7.38 | 58.75 → 56.67 |
| Tactical | 23/24 → 24/24 | 8.13 → 7.71 | 61.29 → 61.29 |
| Cautious opening (first road only) | 3/3 → 2/3 | 8.33 → 10.33 | 17.33 → 4.67 |

The tactical policy won all 24 current scenarios, while the simple policy lost three. The cautious opening policy regressed to two wins in three seeds; its repeated bracing is an onboarding follow-up, not evidence that beginners are well served. Some scenarios tie or take longer with tactical play. These results do not measure enjoyment. The default legal campaign changed from **204 to 213 turns**; several encounters remain below the 8–15-turn design target.

Political diagnostics ran **48 scenarios**: saved v1 and current v2 rules, six Contests, moderate/zero-support profiles and two declared policies. **48/48** won, including **24/24** current-rule runs. Five Promise-enabled Contests supported both debt-free arguments and a promised coalition in these profiles. Chapter VII has no Promise ability, so its two policy labels converge and are not counted as distinct approaches. Current promised coalitions incurred **4–6 supplies** of future debt; debt-free runs incurred none. These are injected scenarios at seed 275 with legality-enforced commands, not a complete human playthrough or broad balance proof. The [scenario record](evidence/overhaul/political-approaches.json) retains exact votes, actions, costs and command traces.

## Actual application observations

Recorded environment: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36. Desktop 1280 × 900, DPR 1; narrow 360 × 740, DPR 1. Codex in-app desktop browser; agent-operated DOM controls and keyboard. Not a human-subject or physical-device playtest.

- **Fresh source reproducibility — PASS automated:** A fresh source copy omitted dist and generated tests/fixtures. Direct preparation from outside the project regenerated all three fixture sets; the subsequent Node test run passed 247/247 with exit code 0. These were the commands behind the npm pretest hook, not npm verify. The outer Python wrapper hit a Windows console-encoding error only after the successful child; the saved UTF-8 log and counts were independently checked.
- **Opening drill and early road — PASS:** New Game, the Lucan responsibility choice, Move confirmed with Enter, Throw, Strike and Brace won training on turn 3 at 20/22 health. Reload/Continue preserved the uncommitted victory; Record result and Oath led to the road. Compact controls at 360 × 740 executed Move to 2C, Brace and End Turn. These opening checks used the candidate build immediately before the final keyboard, fallback, help and CSS fixes; those fixes were separately verified.
- **Final build and legal save import — PASS:** Final revision 92400cbd6662 was served from dist on a fresh test origin. Normal Restore, Validate and review, and Restore this chronicle accepted unedited legal New Game checkpoints for chapters IX, XI and XII (trace steps 719, 899 and 1019), enforcing existing milestone validation. No debug browser state injection was used.
- **Senate preview and execution — PASS:** At turn 3, Promise to Landholders delegate 1 previewed stance 2 to 6, support 9 to 9, one speech, and 3 supplies due at accession with breach costs. Execution matched. End Turn produced the displayed rival move to 8B and Civic delegate 1 stance 2 to 0; support became 8/13. Thirteen seats included the four permanent speaker votes.
- **Formation command — PASS:** Chapter IX Wedge + Attack around Marcus Felix displayed the firm-ground attack/exposure tradeoff and ordinary action limits. Confirmation consumed exactly one command (6 to 5) and reduced the visible enemy count from 4 to 3.
- **Final confrontation to accession — PASS:** From an unedited, legally earned chapter XII turn 3 checkpoint, the agent used Wedge/Attack formations, Strike, Throw and End Turn through the normal UI. The encounter was won on turn 5 at 19/26 health, with 0 allied withdrawals. Record result, then Receive the oath, reached Augustus and the choice-dependent epilogue. This was representative hands-on play from a legal checkpoint, not a manual full-campaign playthrough.
- **Text enlargement and narrow screens — PASS after repair:** At 360 × 740 and 200% text, a thirteen-seat vote track originally widened the document to 414 px. After symbol flex sizing was fixed, the final DOM width was 345 px within the 360 px viewport. Dialog bounds x = 16–329 remained within the viewport. New compact controls worked; no real touch-device measurement was performed.
- **Settings and reload — PASS:** Reduced motion, 200% text and effects volume at 20% persisted across reload. Audio could be muted. The imported turn 4 Senate retained the executed promise and state. Audio control behavior was exercised; subjective audio quality was not measured.
- **Offline — PASS:** Download all chapters reached All twelve chapters are available offline. Stopped the local production server, reloaded, selected Continue and recovered the complete accession with ALL CHAPTERS AVAILABLE OFFLINE. Automated service-worker checks also cover partial downloads and version isolation.
- **Browser errors — PASS while server available:** No captured warnings/errors during final Senate/command/finale play before the intentional server-offline test. Expected network/update probes after stopping the server are not claimed absent.
- **Compatibility — PASS automated:** The final 247-test suite includes frozen v0.6 next-turn and complete Retry equivalence, preserved old rules for patron-backed reruns, reward/debt idempotence, campaign gates and all five finale routes. Tests ran before the final CSS-only vote-track sizing fix; final CSS was checked in the browser and the build/asset gates were rerun.

## Remaining limits

- The benchmark is one warmed desktop Chromium comparison using identical legal legacy fixtures. It isolates presentation cost, not new rules balance or player pacing.
- Synchronous Canvas/DOM submission, animation paint intervals and independent RAF intervals are separate measurements. They are not GPU timings, a guaranteed frame rate or physical-phone evidence.
- No physical Android/iPhone, screen-reader, thermal, battery, VRAM or mobile network measurements are inferred from desktop canvas dimensions.
- The existing painted atlases retain four facings; movement and gestures are bounded procedural deformations, not authored frame sequences or 3D animation.
- New Game autoplay and bot comparisons diagnose deterministic playability and tactical behavior; they cannot establish human enjoyment, 90–150-minute pacing or emotional impact.
- Three diagnostic seeds over eight authored battle scenarios; fixed scenarios do not measure broad player skill.
- Tactical policy is updated for new positioning rules; cross-edition improvements combine rule and policy changes. Within each edition, simple/tactical start from identical states.
- Higher remaining strength and win rate do not imply faster human play or enjoyment. Some scenarios tie and tactical can take longer.
- The cautious opening policy repeatedly braces below 8 health when surrounded: it loses one of 3 current seeds versus none in the frozen edition. Direct objective-aware opening policy wins all 3. Human onboarding/pacing remains unverified.
- The first-road companion stays near the recruit; later allies use mission/role scoring. No statistical handicap or extra difficulty mode is used.
- No independent human enjoyment, emotional impact, voluntary retention or complete-session timing study was conducted.
- No physical Android or iPhone testing; desktop viewport emulation does not establish device FPS, battery use or real touch behavior.
- Standard is the only tuned difficulty. The overly cautious opening brace policy wins 2/3 seeds versus 3/3 in the baseline; this remains an onboarding follow-up.
- Existing painted characters, narrative scenes and tactical atlases are retained; this release adds procedural terrain/markers/motion, not newly authored multi-frame character animation or true 3D.
- Enemy animation source attribution can remain ambiguous when older prose-only event records name several actors; deterministic combat outcomes are unaffected.
- No startup wall-clock load, total browser/GPU memory peak, human minutes-per-battle, engagement or enjoyment statistics are claimed.
