# Verification record — 0.1.0

Recorded 11 October 2026. This is evidence for a playable local build, not certification of every requirement in the supplied technical document. Automated rules tests, tests with injected scenarios, browser-interface play and physical-device checks are reported separately.

## Automated checks performed

The final reported Node suite passed **43 tests: 22 core, 3 gate, 5 content and 13 storage tests**, with zero failures. Runtime: **Node.js v24.19.0 on Windows**. Commands: `node --test tests/*.test.mjs` and `node scripts/autoplay.mjs`.

| Check | Observed result | Evidence |
| --- | --- | --- |
| Full campaign from New Game | Seed 275 reached Augustus and the epilogue through all twelve chapters, 25 encounters and 231 player-side turns, using legal commands only. No chapter injection or direct victory awards. | `docs/evidence/autoplay-result.json`, `tests/fixtures/legal-route-trace.json` |
| Turn counts | Tutorial: 4 turns. Other encounters: 8–14 turns; battles: 8–13. These are bot turns, not measured player minutes. | Autoplay result |
| Exact replay | Replaying the recorded command sequence from New Game produced the same complete state in Node. | Core replay test |
| Advancement and locks | Initial recruit state, restricted early commands, chapter access from milestones, complete campaign advancement and once-only result commits passed. | `tests/core.test.mjs` |
| Tactical rules | Illegal targets, repeated actions/movement, marsh movement, cover, shields, flanking, command limits, formation overlap and Deploy movement restrictions passed. | Core tests |
| Contest rules | Deadline-only vote, tie failure, retained votes on withdrawal, commitment resistance, Address cooldown, speech limits, concrete Promise staging/caps and retry passed. | Core tests |
| Recovery | Exact battle retry; won-encounter save/reload without duplicated rewards; costly Contest re-run without promotion; missing required capability fails with retry available. | Core tests |
| Narrative branches | First two alternatives for every chapter, plus the third Chapter 7 option, were run under the same starting seed and produced distinct later prose/relationship/ending state. | Core branch tests |
| Content audit | Every authored decision option has a distinct journal and epilogue reader; all authored character-conditional intro/aftermath branches are reachable and exclusive; absent companions do not speak after their fate; finale replacements, identical oath bookends, four early callbacks and all six Contest deadlines in the rules sheet passed. | `tests/content.test.mjs` |
| Storage boundary | Completion waits for the mocked IndexedDB transaction; both fallback directions, newest-valid-save selection, stale-write rejection, failed writes, corrupt data and portable code round-trips passed. | `tests/storage.test.mjs` |

The storage tests use isolated Node mocks. They do **not** establish actual browser private-mode behaviour, quota eviction, operating-system interruption or two-window lock behaviour. A previously reproduced failure allowed a stale tab to overwrite a newer IndexedDB-only save; the regression test now rejects it and preserves the newer record.

Compressed export/import was tested with the full active encounter and its start snapshot. Altering a structurally valid payload without updating its checksum was rejected, and existing local data stayed unchanged. Uncompressed fallback and malformed/incompatible imports were also tested. The current checksum is FNV-based, not the SHA-256 specified by the technical document.

The exact replay evidence is **Node-to-Node**. Chromium/WebKit cross-engine replay parity, a five-seed-per-PR CI gate, fifty-seed nightly execution, coverage reporting, a general content-schema audit and automated accessibility scanning have not been established by these results.

## Vertical-slice tuning evidence

Three repeatable injected scenarios were tested at seeds **17, 275 and 913**: the first field assignment, marsh rescue and a formation command fixture. Both bots know the mission objective. The command fixture increases enemy damage by three for a stronger pressure test; it is explicitly a scenario test, not part of the unmodified New Game route.

| Metric, summed across nine runs per bot | Greedy | Tactical |
| --- | ---: | ---: |
| Objectives completed / wins | 9 / 9 | 9 / 9 |
| Allied unit losses | 4 | 3 |
| Player-side turns | 75 | 75 |
| Surviving commander health | 104 | 170 |

The tactical policy's advantage was modest and concentrated in the command fixture. It searches passable routes around occupied roads, uses protection and commands, and coordinates attacks. Rescue gains were small; one first-assignment seed left the tactical commander with less health. Both policies won every test in the same aggregate number of turns. This provides tuning evidence for survivability, not a win-rate advantage or proof of engagement. Successful tactical runs took 8–9 turns. See `docs/evidence/vertical-slice-gate.json`.

Two approaches won each of three later Contest fixtures. The public-argument policy used no Promises; the coalition policy used two. Chapter 10 has no Invoke Record yet, so its public-argument route uses Address, Rebut and Persuade.

| Fixture | Turns | Public-argument votes | Coalition votes | Majority |
| --- | ---: | ---: | ---: | ---: |
| Chapter 10 tribunal | 12 | 11 | 11 | 7 of 13 |
| Chapter 11 accounts | 12 | 11 | 8 | 7 of 13 |
| Chapter 12 legitimacy | 14 | 11 | 9 | 7 of 13 |

See `docs/evidence/contest-approaches.json`. A separate **Chapter 8 crossing-parley fixture** used identical seed 275 and starting campaign meters for two approaches. Both won with **7 of 13 votes in 10 turns**. Persuasion used no Promises or Threaten actions; the second route used two Promises, four Threaten actions and Persuade, staging a public-confidence cost of 12. Every encounter command was validated through preview and act. See `docs/evidence/early-contest-approaches.json`. These are injected fixtures, not evidence that every Contest or the Chapter 7 council was independently won by two approaches. The complete requested slice gate, including real reference phones and human engagement, remains open.

Compact copies of the four generated result fixtures are included in `docs/evidence/`. Their original sources are in `tests/fixtures/`; full command replay and checkpoint fixtures remain there. The content audit is reported by its five test cases and this record; it does not have a separate generated result file.

## Finale profiles actually tested

These are **injected scenario tests**, separate from legal full-route autoplay. Each profile won both the legitimacy Contest and its selected playable confrontation. They use an absent comrade and mentor, an estranged patron, and two synthetic conflicting land promises; the profile setup applies the release choice and then explicitly restores the listed meter values.

| Profile | Army / Political / Public | Confrontation |
| --- | --- | --- |
| Floor with absent allies and conflicting debts | 0 / 0 / 0 | Costly backer battle |
| Military strength only | 80 / 0 / 0 | Defections standoff |
| Political coalition | 0 / 80 / 0 | Negotiated settlement standoff |
| Open gates | 30 / 60 / 90 | Surrender standoff |
| Mixed conventional force | 60 / 35 / 45 | Battle |

Each confrontation lasted at least eight turns and retained no more than eight living player/allied units. A further zero-meter, zero-supply fixture combined compatible selected authored debts with synthetic Promise and fallback debts for the Chapter 8–11 Contests, totalling at least sixty supply units. With the comrade and mentor absent and patron estranged, honouring those debts and using the backer route still won both encounters.

For fixed choices and Obligations, each meter was swept from 0 to 100 in increments of five with the other meters at zero. The forecast never removed an available route or reduced allied strength; enemy count, health, damage and morale did not worsen. The backer remained available. This tests those forecast samples, not every integer combination or every possible campaign state. The conflicting-debt fixture is not proof that all narrative promises can be reconciled.

## Browser-interface checks performed

Play was driven through the actual rendered controls in a Codex-controlled browser. Later chapters were entered by importing **checkpoints earned by the legal New Game harness**, then played through the interface. Those checks do not count as a second uninterrupted New Game playthrough.

| Chapter | What was completed through the interface | Observed viewport evidence |
| --- | --- | --- |
| 1 | New Game, training, oath, field assignment and first promotion | 390 × 844 CSS pixels |
| 6 | Both retreat encounters from an earned imported checkpoint | 390 × 844 and 1280 × 900 |
| 11 | Both full Contests and admission to the Senate from an earned imported checkpoint | 390 × 844 and 1280 × 900 |
| 12 | Legitimacy Contest, final confrontation, accession, epilogue and opened reign card from an earned imported checkpoint | Legitimacy: 390 × 844; confrontation: 1280 × 900 |

Observed controls include movement through the target selector with Enter, arrow-key board navigation, action previews, confirmations and pointer clicks at the mobile viewport. The code-drawn battlefield and portraits were observed. Pointer clicks in a narrow viewport are **not physical-touch testing**. The complete set of battle and Contest actions has not been exhaustively completed by keyboard alone and by touch alone.

A **360 × 640** title/camp/settings spot-check and **200% in-game text** setting exposed horizontal overflow, which was corrected with CSS reflow. After the fix, the settings body width and viewport content width both measured **345 CSS pixels**. This is a settings reflow check, not a complete battle/Contest action check at that size or desktop browser zoom testing.

The browser exported an epilogue **SAC1** save code of **5,393 characters**, exceeding the technical document’s 4,000-character Should target.

The browser was the **Codex In-app Browser, using its Chromium surface**. Its version was not recorded. No real Android phone, iPhone, mobile Safari, iOS VoiceOver or physical touch device has been verified. A mobile-sized desktop viewport does not establish those results.

## Build and platform evidence

The final production build completed with **279,151 raw bytes and 123,636 summed gzip bytes across 17 counted files**, revision `b1b411d6b09b`. These figures come from `dist/build-report.json`. The script sums individually compressed files; this is not a browser network-transfer measurement, excludes its generated worker/report from the sum, and does not measure the required `chapter1-playable` mark.

The production build was served on a fresh local origin at port **4175**. The interface reported **“All chapters available offline.”** A browser-generated SAC1 epilogue code was imported through Validate and Confirm and restored Augustus with 25 completed encounters.

The owned static server was then stopped and its exit confirmed. With the origin server unavailable, reloading the tab and choosing Continue restored the accession epilogue from the cached application and saved state. While the server remained stopped, a New Game was started; the Chapter 1 decision and training were entered; Brace was selected and confirmed with Enter; End Turn worked; and confirmed Retry restored turn 1 and its original start log. Another reload and Continue retained that training state at turn 1. This verifies cached reload, play, retry and restoration with the origin server unavailable. It does not establish behaviour after an operating-system restart, device network toggle, cache eviction or on installed mobile PWAs.

A **1080 × 1350** reign card rendered and the Download Card action created a **326,297-byte PNG**. The browser automation’s download-event wait timed out, but the resulting file and its timestamp confirmed the download. A copy is included at `outputs/sacramentum-reign-example.png` alongside the source deliverable. Native sharing was not exercised.

The source includes static hosting support, a web manifest, a generated service worker and portable save codes. A live Replit deployment, own-domain configuration, actual home-screen installation, new-version cache migration and a production link on real phones are not verified here. The production site address remains relative to the host until configured.

## Known deviations and remaining work

- The build uses JavaScript ES modules, Node's test runner and a custom static build. The companion's strict TypeScript, Vite and Vitest stack is not implemented.
- Save integrity uses FNV rather than SHA-256. The specified release-migration fixture history, pre-migration rollback archive, last-three-checkpoint retention, and every real browser interruption boundary are not established. The observed 5,393-character epilogue save code misses the 4,000-character Should target; all-state code lengths have not been measured.
- Single-active-tab takeover, simultaneous windows without Web Locks, incomplete update recovery and deployed previous-release asset retention need full browser checks. The stale-write mock regression is narrower than these requirements.
- The 360 × 640 and 200% in-game text spot-check is described above. The complete action matrix at those settings, desktop 200% browser zoom, grayscale recognition, measured contrast and automated accessibility/VoiceOver checks remain incomplete.
- The authored conditional intro/aftermath scenes, every authored key-choice reader and Contest deadline table are covered by the five content tests. Every possible scene/state combination, recorded non-key decision and the sheet’s complete numerical balance synchronization have not been established.
- Real-device load/animation latency, memory ceiling, 2 GB Android stability and the full supported browser matrix remain unverified.
- No first-time human playthrough has validated the **90–150 minute** target, individual chapter budgets, enjoyment, pacing or emotional payoff. Bot turns cannot substitute for those observations.
- Analytics, advertisements, supporter payments, sponsorship, portal integrations, accounts and multiplayer are not part of this local build. Future commercial updates are **not yet due**. No private business-plan documents are bundled or uploaded with the source.

No unperformed check is counted as passed. Technical Should targets without evidence remain open rather than silently waived; deviations above are disclosed limitations, not evidence that all due Must requirements are satisfied.
