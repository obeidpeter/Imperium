# In-game usability improvements

The play interface now puts the current task ahead of reference material. This revision addresses the crowded controls, long menus and repeated explanations identified by the player. The supplied Nielsen usability heuristics informed the changes; the reference document is not included in the repository.

## Navigation and settings

The main in-game menu has seven choices, including Resume, instead of eighteen competing destinations. Soldier tools, campaign records and supporting information have separate groups. A consistent Menu return and Close button replace the unlabeled close icon. Equipment, Training, Company and Honours share local navigation, and order editors return directly to Company.

Settings has five categories: Readability, Controls, Graphics, Sound, and Saves & offline. The opening category presents six preferences. Keyboard groups, mouse behavior, automatic pause, appearance details, diagnostics and developer tools expand on demand. The selected category is announced, hidden categories cannot receive keyboard focus, and all original preferences remain available. High contrast now uses dark text on parchment and light text on dark play surfaces, fixing pale labels and save status on light backgrounds.

Help begins with Move, Act and Pause (or End turn on the tactical board). Search finds matching topics in the full offline guide. Task links and an expandable index retain all fourteen guide chapters. Detailed rules, forecasts and action costs remain available.

## During play

- The real-time battle bar presents three common actions. More actions retains every learned ability and its original shortcut; selecting one by key reveals it. The action-bar focus shortcut also reaches personal, squad and chamber actions correctly.
- The objective, progress, deadline, required capabilities and urgent warnings remain visible. Full orders, detailed votes, tips and logs expand separately.
- Options groups weapon, movement, range and time controls. All actions retains the complete text alternative, with a Close button that returns focus.
- The turn-based board also groups secondary actions and camera controls. Choosing an advanced action opens its group.
- Results retain the outcome, failure cause, available loot and next action. Statistics and historical explanations are optional detail.

## Camp and soldier tools

Every chapter starts with its next mission, departure requirements and any promises due. Required choices stay exposed. Story passages, training references, travel destinations and campaign records are available without occupying the entire first screen.

Equipment keeps its model, item comparison and equip action together. Training keeps prices and next-point effects visible. Company cards show readiness and current orders before detailed presets. Same-page updates preserve open sections and the player's focus instead of closing their work after each change.

## Protecting progress

Loading a saved slot and overwriting a named save require an explicit confirmation. Cancel leaves the current campaign unchanged. Quick save and saving into an empty slot retain their direct action. Menu navigation always pauses play; closing it respects an existing player pause.

The optional Pause in panels setting now behaves consistently in 2D and 3D. With it disabled, opening Mission orders directly leaves the real-time world running and updates the orders without losing keyboard focus. Menu and Settings still pause play.

## Applying the supplied usability heuristics

| Principle | In-game application |
| --- | --- |
| Visibility of system status | Current objective, progress, deadline, pause and save status stay visible. |
| Familiar language | Equipment, Training, Save & load and How to play describe the player's task. |
| User control | Close, Menu return, cancellation and preserved focus provide predictable exits. |
| Consistency | Dialog headers, soldier navigation, settings categories and disclosures use shared patterns. |
| Error prevention | Loading and replacing named saves require confirmation; requirements and costs remain visible. |
| Recognition over recall | Labeled actions and searchable topics supplement keyboard shortcuts. |
| Flexibility and efficiency | Experienced players retain remapping, numbered abilities and complete action lists. |
| Minimal presentation | Common actions appear first; reference text and secondary controls open on demand. |
| Error recovery | Failure causes, retry options and save recovery remain available without searching through lore. |
| Help and documentation | A three-action introduction leads to task topics and the full offline guide. |

## Verification

`scripts/usability-smoke.mjs` exercises visible player flows at desktop and 390-pixel widths, including 200% text, category focus, search, keyboard access to advanced actions, menu pause and save confirmation. It uses legally earned checkpoints and compares exported campaign states. Reports and screenshots are written to `tests/visual-results/usability/` and uploaded by CI.

The existing full Chromium smoke, real-time polish checks and twelve-chapter benchmark use the same visible categories and disclosure controls as a player. Their gameplay and visual assertions remain in place. Unit checks cover all twelve camps, all mission families, original preferences, shortcut reachability and save purity.

### Windows validation, 22 October 2026

The production build is `99d18a108763`. Local browser checks use Chromium 149.0.7827.55; CI runs its configured Playwright Chromium version independently. The final build differs from `5dcd7b777475` only by allowing the narrow dialog header to wrap, keeping the enlarged Settings title intact without overlapping its Close action.

| Check | Result |
| --- | --- |
| Full Node suite | 1,071 passed; later focused regression subsets also passed after the dialog, HUD and pause fixes |
| Base, expanded, command and production campaign autoplay | Passed |
| Character coverage and production audits | Passed; 768 coverage cases and 54 production samples |
| Production assets and offline behavior | All 13 checks passed on the final build |
| Original Chromium smoke | All 16 scenarios passed across the full run and a targeted rerun, as detailed below |
| Focused usability flows | All 9 passed on `5dcd7b777475`, including desktop and 390px navigation, 200% text, high contrast, save protection and keyboard access |
| Real-time controls and layout polish | All 16 passed on `5dcd7b777475`, with no browser errors |
| Final enlarged-text header geometry | All 10 combinations passed on `99d18a108763`: five Settings categories at 320px and 390px with 200% text, an intact title, no overlapping controls and no horizontal overflow |
| Twelve-chapter benchmark | All 13 scenes and all 5 acceptance checks passed on `99d18a108763`, with exact scene-save preservation and zero browser or runner errors |

The initial full Chromium run passed 15 scenarios. The additional live Mission orders check exposed a 3D-only pause inconsistency, with the runtime reporting unpaused while its renderer prevented time from advancing. After the fix, the complete real-time campaign scenario passed on `5dcd7b777475`, including the new tick, focus and navigation assertions, the drill, thumbnail saves, abilities, victory and result commit. The unrelated passing scenarios were not repeated. There were no page or console errors in either run.

The chapter benchmark uses command-campaign checkpoints; real-time behavior is covered by the separate smoke and polish checks above. Its first run completed all 13 captures before a test-navigation error closed the Practice disclosure a second time. After correcting that test path, the resumed run reused only verified captures from the identical build and passed all five acceptance checks, including practice-save isolation. Both runs and the original failure evidence are retained under `tests/visual-results/usability/chapters/` and the surrounding log directory.

Local evidence is kept under `tests/visual-results/usability/`, with earlier results archived under `baseline-d90352c62cab/`. The full Node and campaign logs are under `tests/visual-results/`. The existing character-handoff freshness check still reports its pre-existing advisory about exported GLBs; this interface revision does not change character art.

Browser automation checks interaction and layout; it does not establish first-time-player comprehension or physical-phone performance. Those checks remain the next source of usability feedback.
