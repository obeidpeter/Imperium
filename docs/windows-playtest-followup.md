# Windows playtest follow-up — 23 October 2026

This implements the findings from the Windows assessment of main `d5957fe`.
Controls and completion apply to the shared real-time field and chamber. Art,
character inspection and campaign presentation are shared across all twelve
chapters; Chapter V is the siege benchmark. The default controls setting and
earned campaign access are unchanged.

## Controls and completion

- Victory, defeat and chamber results appear before the battlefield, receive
  keyboard focus, and expose Continue or Retry immediately. Rewards and the
  actual victory condition are summarized; searching the fallen is deliberate.
  An ended battle cannot restart its clock. A resume save made between the
  final tick and result handoff completes that handoff on load. Retry after a
  defeat uses one action. Campaign includes Restart this encounter; abandoning
  an active encounter still asks first, and cancelling preserves its pause.
- Party members and squads have separate rows. Squad shortcuts reveal the
  selected card; Home clears squad mode and restores the soldier's controls.
  Selection and queued-order feedback remain visible.
- The drill starts paused with its first lesson open. Enter executes the
  selected targeted ability. Self abilities execute on one press and return
  to Strike after a successful command. Mission-essential abilities remain
  outside More actions; finale Rally explains its rival-morale effect/range.
- Target summaries are short, with full forecasts in a disclosure. Nearby
  exchanges receive shared framing; offscreen target/objective buttons show
  directions and distance. The complete-map overview remains available.
  Phone fields retain a 20rem minimum height, and expanded Options wrap inside
  their available width.

## Art, combat and campaign presentation

- Chapter V has connected curtain wings, unequal towers, inner barracks,
  supported mine works, rubble and a ground-following approach. Arrival gates
  have masonry shoulders rather than isolated arches. Other regions have
  matching frontage, porches or timber structures outside the legal board.
- Camera bearings face authored destinations. Ground joins share normals,
  textures, lighting and fog; near/far water share the same material. River
  colour and roughness are more restrained. Scenery adds no legal route or
  collision cell.
- Creation has a live, uncovered appearance preview. Equipment, career records,
  promotions and accession use the same customized soldier and worn kit. Face
  inspection and full-kit controls are available; appearance/equipment changes
  invalidate the preview. Garment folds/hem, horse musculature/tail/blazes and
  crowd height/tint variation improve silhouettes. Existing grips, foot
  contacts and animation rigs are retained.
- Threat hatching is replaced with an optional boundary. Target cues describe
  wind-up, recovery, retreat, brace and counters. Separate, dismissible notices
  retain phase changes, opened routes, field opportunities, losses and pledges.
  Archers disengage briefly and then commit to a firing window instead of
  continually replacing their retreat route.
- Delegates have brief stance/bloc-specific dialogue alongside the existing
  support forecast. Pack items have compact vector silhouettes and existing
  equipment comparisons. Training explains the next actual stat threshold and
  its total TP cost. Save slots include portable import/export. Long promotion
  records and epilogue sections are expandable rather than removed.

## Validation and interpretation

The browser scripts use the built site and legally generated checkpoints.
The targeted balance probe deliberately injects three meter profiles **before**
departure, then uses public gameplay commands. It is sensitivity testing, not
evidence of three manually earned campaigns or human enjoyment.

In that probe, the weak direct assault lost, but its patron-backed route won.
Mixed and strong states won their available routes. Allied formations rose
from 3 to 5 to 7 and the direct-assault opposition fell from 6 to 5 to 3. The
strong campaign advantage is preserved; no general enemy-health increase was
introduced. The three-seed real-time sweep also covers alternate decisions
through XII and all five finale routes; locked settlement/surrender routes are
explicitly marked as injected in that sweep.

Performance safeguards retain the existing scenery draw and fallback-character
triangle caps. Unchanged crowd placement/pose-bank buffers are no longer
uploaded every frame. Quality fallback remains downward-only until the player
chooses otherwise; Performance targets 30 fps and Balanced/High target 60.
Software-rendered benchmark timings do not establish physical GPU performance.

The [evidence report](evidence/windows-playtest-followup.json) records build IDs
and coverage. Checks were run during implementation; final layout, gateway and
menu adjustments received the targeted checks listed there rather than an
unsupported claim that every suite ran on one identical build.

| Check | Result |
| --- | --- |
| Unit suite | 1,105 passed; later layout, gateway and menu checks also passed |
| Chromium smoke | 16 scenarios passed |
| Real-time controls and completion | 20 checks passed |
| Final desktop and phone-width usability | 9 flows passed on `e99521297bf2` |
| Twelve-chapter benchmark | 13 scenes, 5 acceptance checks passed; no browser errors |
| Legal campaign progression | 25 encounters, 12 chapters, 25 exact retries; Augustus |
| Autoplay and real-time sweep | Four autoplay suites and three seeds through XII passed |
| Finale sensitivity | 10 available cases resolved with exact retries across three profiles |
| Asset and stage checks | Integrity, character budgets and four affected gateway/quality probes passed |

The [Windows device sample](evidence/windows-followup-device.json) uses the
actual Intel integrated GPU through ANGLE Direct3D11. With automated runners
stopped, Chapter V was observed during active combat at a 1265 × 720 viewport.
Two rolling 240-frame samples were collected roughly 16 seconds apart. The
later sample reports a 33.32 ms mean / 33.50 ms p95 display interval, a 7.49 ms
mean / 11.20 ms p95 CPU submission time, full resolution scale, and 167 draw
calls. The selected Performance preset targets 30 fps. This is a recent-frame
sample with autonomous formations and an idle hero, not a maximum-FPS test or
a continuous full-campaign trace. CPU timing excludes asynchronous GPU work.

The [Chapter V preview](images/windows-followup-ch5.png) shows the clear horizon,
fortress context and separate party/squad rows. The
[character preview](images/windows-followup-character.png) shows consistent
soldier identity, face inspection and compact equipment tiles.

Physical phones and first-time player sessions remain pending the owner's
arranged access. This work does not establish world-class art, audio quality,
a human campaign-duration target, or universal device performance. Existing
face/hand meshes and animation rigs remain; the character work here improves
presentation, garment and horse shapes, and crowd variation, rather than
replacing the complete character asset and motion library.

## Reproduction

Run `node scripts/prepare-tests.mjs`, `node --test tests/*.test.mjs`, the four
package autoplay commands, and `node scripts/build.mjs`. Browser checks are
`scripts/browser-smoke.mjs`, `scripts/realtime-polish-smoke.mjs`,
`scripts/usability-smoke.mjs` and `scripts/benchmark-campaign.mjs`. Set
`PLAYWRIGHT_MODULE` and `PLAYWRIGHT_EXECUTABLE_PATH` when using an external
Playwright runtime or installed Chrome. Additional probes:

```sh
node scripts/realtime-sweep.mjs --seeds=3 --last=12
node scripts/playtest-balance.mjs
```

The latter writes `tests/visual-results/playtest-overhaul/balance.json` and
checks that every available scenario resolves, retries exactly, and retains
the campaign-strength reward.

## Follow-up to the 3 November Windows playtest

Implemented from main `5c7168c` after the native Chrome assessment. These changes
apply to the shared camp, battlefield, character and chamber systems throughout
Chapters I–XII. They do not replace the campaign rules or its saved progress.

- Hover explanations have a fixed, keyboard-scrollable space. Battlefield
  notices float within the world without moving the canvas under the pointer;
  important losses take precedence and notices remain while paused or read.
- The first inventory comparison preserves renderer-owned canvas dimensions
  and redraws the retained soldier. Desktop comparisons sit beside the pack,
  with secondary statistics folded and the Wear control kept near the item.
- Camps name the required person, decision table or departure destination.
  The map shows the soldier and numbered destinations; walking to an unvisited
  place uses ordinary movement, while fast travel still requires discovery.
  Choosing a route closes any Services overlay before following the soldier.
- Follow, Overview and Cutaway are visible controls. Overview also fades
  obstructing architecture along relevant sight lines. Terrain approaches use
  softer irregular transitions and chambers have additional staged furnishings.
- Squad cards expose strength and current orders without a horizontal roster.
  All actions can be searched, with objectives and engineering work first and
  optional opportunities identified separately. New battles begin with time to
  plan; hold objectives show remaining control time and retry advice opens.
- Council actions lead with talking to a delegate and explain the vote change
  in plain language. Delegate labels name their bloc and current support.
  Civic clothing and combat anticipation are more legible without changing
  the simulation's strike/contact timing.
- Creation folds optional training, cloak and challenge choices. Its landing
  copy reflects the chosen play mode. Dynamic resolution recovers in measured
  steps when GPU timings leave enough headroom, rather than remaining blurry
  behind an unnecessarily strict recovery threshold.

Validation for this follow-up is recorded below. Software-rendered Chromium
checks establish behavior and rendering integrity, not a physical GPU frame
rate or a first-time human playthrough of all twelve chapters.

- Full Node suite: **1,627 passed**, with no failures, skips or cancellations.
  The subsequent direct-input feedback refinement passed **17 focused tests**.
- All four autoplay scripts, production asset integrity, character-asset audit,
  performance-export freshness and character-production audit passed.
- The strict Balanced stage checks for Chapter V and Chapter XII passed against
  the existing ceilings, with no browser errors or first-frame/late shader
  compilation. Their respective overview counts were **157 / 160 draws**,
  **470,365 / 792,719 triangles**, and **46 / 47 programs**. The later UI-only
  refinements do not change those stage assets or renderer paths.
- The optional editable artist-handoff GLBs still record an earlier character
  source fingerprint. `check-character-handoff.mjs --warn` reports this; these
  development exports are excluded from the game build and should be exported
  again before an artist handoff. Runtime character checks pass.
- The twelve-chapter benchmark passed **13 scenes and all five acceptance
  checks**, with no browser or runner errors, on build `42dd54199fc2`. Chapter V
  used Balanced; the other chapter inventory used Performance. Checks include
  political preview/commit, 320-pixel width at 200% text, remapped controls and
  practice-save isolation. The subsequent build `66c58ffae95a` only changes
  squad accessible names, phone camp-map button layout and guide text; those
  UI refinements receive the browser checks below.
- Camp navigation, DOM patching and generated guide/help checks passed
  **21 focused tests** after those later changes.
- Build `66c58ffae95a` passed the new navigation smoke at **1,280 and 390 pixels**:
  compact creation, map destinations, legible phone route buttons, preserved
  fast-travel discovery requirements, closing the Services overlay, and a legal
  walk to the chapter decision. The browser observes movement and conversation
  arrival; it does not inject a destination or campaign state. This regression
  now runs in the GitHub usability job and uploads its report and captures.
- A later phone-field check caught a height regression when opening More
  actions with the larger squad cards. In build `60e05c8cf02c`, those extra
  actions open as a bounded drawer above the HUD. The focused phone flow
  passes the original minimum-canvas and no-page-scroll requirements, plus a
  new assertion that the battlefield height stays exactly unchanged. Keyboard
  selection, button selection, focus return, All actions and pause also pass.
- The full usability suite passed **15 flows** on `60e05c8cf02c`, including
  phone/desktop field controls, 200% settings, help and save protections,
  keyboard/mouse equipment handling and emulated touch equipment handling.
- The expanded real-time polish suite passed **39 checks** on `60e05c8cf02c`,
  including Chapter V and council layouts at 390, 580 and 1,280 pixels,
  fixed world geometry during long guidance/notices, readable complete squad
  rosters, discoverable cameras and zero-time preparation pauses. The capture
  immediately after the first equipment comparison visibly retains the soldier;
  its WebGL drawing-buffer dimensions also remain unchanged. Comparison details
  are visible beside the pack. In battle they correctly direct equipment changes
  to camp; actual wear/remove interactions are covered by the usability suite.
- Chromium smoke group B passed **13/13 scenarios** on `60e05c8cf02c`, with no
  page or console errors. Coverage includes the real-time opening and completion
  flow, 3D/2D switching, deployment, all six political contests, hearings,
  finale defection, remapping, practice-save isolation, legacy chronicles and
  post-battle exploration/search with once-only result recording.
- A native Windows Chrome check reloaded the current local build, continued the
  existing Chapter VII playtest and opened Equipment. The first Galea comparison
  retained the visible soldier; Turn model right visibly changed his orientation
  and Full kit restored the front view. No item was equipped. Closing the panel
  returned to the paused chamber at Hour 2 with 6/13 support. This supplements
  the headless capture limitation for rendered preview rotation; it is not a
  new complete campaign playthrough or a hardware frame-rate measurement.
- Chromium smoke group A passed ten scenarios on `60e05c8cf02c`. Its two
  remaining scenarios passed isolated reruns on `f9fb078d355e`, so all **25
  scenarios across groups A and B** are verified across these runs. The camp
  departure check now uses 320 pixels for its truncated-message assertion:
  the complete sentry message fits at 390 pixels. Full text, focus/hover holds,
  expiry, history, keyboard pause and saved-state protection passed, as did
  Chapter II departures in both 2D and 3D. No retry was needed in the final run.
- The performance smoke exposed a separate defect: the deliberately demanding
  graphics tour could trigger the application's automatic quality downgrade
  while its stage-level adaptation was disabled. The tour now suspends both
  mechanisms and releases the hold on success, cancellation or error. All
  **35 focused graphics/profiler tests** passed. The unchanged browser smoke
  assertions then confirmed restoration of the original Balanced quality,
  an unchanged board, all three measured tiers and zero first-frame shader
  compilation, with no page or console errors. Its software-rendering report
  remains explicitly labelled and never applies a recommendation automatically.
- Final production build: **`c983c891db5f`**, successfully built after the two
  isolated browser reruns. The only runtime-source change from `f9fb078d355e`
  removes an unsupported help claim about preserving a resumed battle's pause;
  the fresh-battle preparation pause is unchanged. The **11 guide/settings
  tests** passed after regenerating help. `git diff --check` passes. These are
  local validation results; no GitHub upload or CI run was performed in this
  implementation task.
