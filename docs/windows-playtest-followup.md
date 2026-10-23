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
