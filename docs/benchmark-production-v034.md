# Imperium benchmark and campaign production

Baseline: 0.33.0, commit `7523d63`. Work begins with Chapter V and a representative political scene, then extends the same systems through Chapters I–XII.

## Delivery ledger

| Workstream | Status | Implementation and evidence |
| --- | --- | --- |
| Visual direction, character and chapter identity | Implemented and inspected | Twelve regional palettes, career/cast finishes and Chapter V siege composition; thirteen accepted scenes in the browser report |
| Cohesive character geometry and authored motion | Implemented | Connected tunics, formed helmet cheeks, restrained face morphs, horse contours, 11 authored clips; 54-specimen production audit |
| Chapter V siege environment and regional kits | Implemented | Fractured walls, mine supports, detailed stateful field equipment; legal opportunity completion and geometry/grounding tests |
| All-chapter terrain, architecture, lighting and atmosphere | Implemented and inspected | Regional material direction, terrain-fitted foundations, repaired bridge surface integration and existing chapter light/sky systems; representative captures from all twelve chapters |
| Versioned tactics, enemy doctrine and operational preparation | Implemented | Four plans, visible doctrines, bounded charge response, six complete legal campaigns, 150 exact retries and legacy opt-in checks |
| Issue-specific politics, evidence and lasting consequences | Implemented | Twelve evidence cases across six hearings, exact stance previews, surviving-companion testimony and committed campaign records |
| Campaign interface, controls and accessibility | Implemented; human evaluation remains | Compact battlefield, high contrast, six remappable keys, adjustable touch delay; keyboard/touch smoke and 320px/200% text checks |
| Chapter sound direction and contextual feedback | Implemented | Twelve contextual mixes using existing local recordings; bounded weather/pressure response, gesture/mute/hidden-tab tests |
| Asset loading and production tooling | Implemented | Shared original surface atlas, overview geometry reduction, reproducible clip compiler, asset provenance and offline/build budget checks |
| Replay and practice improvements | Implemented | Completed encounters accessible from camp, safe preparation reset, pure case inspection and protected main chronicle |
| Browser, visual and release qualification | Local qualification passed; CI configured | 752/752 tests, build/offline checks and thirteen-scene browser inventory pass; exact case UI, narrow layout, remapping and practice checks pass; GitHub runs Node 20/22 verification, Chromium smoke and the chapter benchmark |
| Physical-device, assistive-technology and first-time human playtests | Requires external evaluation | Named devices, actual participant sessions and dated results |

“Implemented” means working code or integrated assets, with the stated evidence. A procedural asset is not described as commissioned or hand-sculpted; generated images are not described as fully rigged characters. Automated scenarios, scripted browser interaction, human play and physical-device measurements are recorded separately.

## Production direction

Grounded, readable Roman historical drama. A consistent scale and material response connect the hero, company, architecture and terrain. Warm limestone, iron, leather, faded cloth and region-specific vegetation support the existing third-century setting. Scenic detail must not suggest passages or cover that the rules do not provide.

The primary view is a cohesive sculpted world; painted and 2D modes remain usable alternatives. Shared identities, scene data, input commands and animation events prevent the modes from diverging in gameplay.

## Invariants

The deterministic rules remain independent of rendering, sound, clocks and browser state. New gameplay is versioned. Existing suspended encounters preserve their original behavior and complete retry checkpoint. Invalid commands and previews do not mutate state or randomness. Rewards and consequences commit once. Named-character permanent fates remain authored. The finale retains its recovery path and stronger standing never removes a route.

## Qualification

Targets, not current claims: sustained 60 fps on the selected desktop reference tier and stable 30 fps on the selected mobile tier; clear command feedback; no normal-play asset placeholders; correct contact and readable motion; meaningful alternative tactics and coalitions; safe offline updates and old saves. A physical-device and human-playtest report is needed to claim these targets are achieved.

The current passing Chromium CI uses software rendering. It is functional evidence, not a real GPU benchmark. The 90–150-minute campaign target is subject to human playtesting.
