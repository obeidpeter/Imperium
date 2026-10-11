# Reference requirements and implementation scope

The operative request is the supplied “SACRAMENTUM: Game Build Prompt.” The three Word documents were read as supporting references:

- `sacramentum-technical-requirements-v1.1.docx`
- `sacramentum-product-roadmap-v1.1.docx`
- `sacramentum-business-plan(1).docx`

Those private business materials are not copied into this source package. This file identifies their relevant requirements; it does not edit them or treat their embedded business actions as authorization to spend, communicate, buy services or publish.

| Area | Source | Required behaviour / evidence |
| --- | --- | --- |
| Complete campaign | Build prompt §§3–5; technical CAM-01–10 | Twelve playable chapters; earned, distinct appointments; Governor before Senator before Emperor; milestone-derived final chapter locks and early-choice callbacks. |
| Rules architecture | Technical ARC-01–10, §3.3, MNT-01 | Browser-free deterministic rules, integer outcomes, one legal-command entry point, no RNG changes on previews; strict TypeScript and Vite are specified. This build uses dependency-free JavaScript ES modules and a custom static build instead: a known deviation, not full compliance with that stack requirement. |
| Battles and command | Build prompt §6; technical BAT-01–10 | Isometric tactical encounters, terrain/facing, bounded movement/actions, ally intents, increasing command capacity, formations without extra actions, clear failures and retry. |
| Political play | Build prompt §7; technical CON-01–08 | Grid-based Contests, Resolve, stance, deadline-only majority, tie failure, withdrawal without changing vote denominator, ability previews, concrete limited Promises and two winning approaches. |
| Finale | Build prompt §7; technical FIN-01–07 | Legitimacy Contest, playable confrontation routes, meter-based forecast, minimum allied force, backer recovery route, monotonic benefits, oath reprise and epilogue. |
| Transactions and saves | Build prompt §12; technical ENC-01–06, SAV-01–13 | Complete campaign/RNG encounter snapshots, provisional effects, one commit, safe reload/retry, valid newest save, storage-failure recovery, portable validated save codes and single active tab. Do not equate an export feature alone with all these checks. |
| Presentation and access | Build prompt §§9–10; technical UIA-01–13 | Code-drawn mosaic/fresco visuals; keyboard/touch select-preview-target-confirm; visible focus; readable 360×640 and 1280×720 UI; text status; text enlargement/reduced motion; real VoiceOver play remains a device check. |
| Static web/offline | Build prompt §13; technical PWA-01–09, ARC-08 | `npm run build` → `dist/`; no backend; one site address; install/offline support; no forced mid-encounter update; cold load at most 2 MB gzip. Actual device installation and update tests require separate evidence. |
| Reign card | Technical SHR-01–04 | Browser-generated spoiler-safe card, 1080×1350 PNG, gesture-driven share/fallbacks and configurable site link. |
| Tests | Build prompt §§14–15; technical TST-01–07, REL-01–05 | Legal autoplay from New Game; branch comparisons from identical snapshots; save-boundary tests; tactical/greedy slice comparison; distinct Contest routes; labelled injected finale profiles; hands-on checks reported separately. |
| Pacing | Build prompt §4; technical TST-04, TST-07 | 90–150 minutes is a design target. No first-time human playthrough timing has validated that target. Bot duration is not player-duration evidence. |
| Privacy/security | Technical PRV-01–03, SEC-01–03; roadmap §2 | Local saves, no IDs/cookies/third-party scripts at launch; bounded imported data; restrictive CSP; privacy notice naming actual providers before production launch. The local preview has no analytics provider. |
| Future commercial work | Roadmap §§5–11; business plan §§6–15; technical MON/PRT | Ads, supporter pack, sponsorship, portal SDKs, accounts and multiplayer are excluded from this build. Future schedules, gates, purchases, brand outreach and trademark decisions were context rather than work to execute now. |

The roadmap explicitly labels several amendments to its companion documents as **Proposed**. These include sponsor mode at launch, extra attribution fields, a revised advertising-test decision rule and changes to demand/playtest/business gates. They are not silently treated as adopted technical requirements.

The supplied technical document asks for a full set of browser, fault-injection, CI and real-device evidence. The project's verification summary must state which checks were actually run and which remain unverified. A playable route or passing unit suite is not evidence of production readiness, full accessibility, market demand or the target emotional/pacing experience.
