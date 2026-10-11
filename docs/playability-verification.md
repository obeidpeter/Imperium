# Version 0.3 playability verification

Recorded 11 October 2026 for the 0.3.0 gameplay and save-recovery revision. The complete campaign has been run through legal commands, and the revised phone interface and storage behavior have been checked in a real desktop browser. Physical phones and first-time human play sessions have not been tested.

## What passed

The final complete automated run passed **111 tests, with zero failures**, in 18,617.094 milliseconds. This includes **25 storage tests**, **eight renderer tests**, and **six service-worker update watcher tests**. The final asset verification passed **seven checks**. These checks cover deterministic rules, commands, progression locks, story and choice readers, company transactions, exact retries, malformed imports, original version-one checkpoint compatibility, rendering helpers, and save concurrency/recovery. Counts describe the runs observed, not an estimate of future results.

The main campaign runner started at New Game with seed 275 and reached Augustus through **12 chapters, 25 won encounters, and 204 encounter turns**. It used the same legality-enforced gameplay API as the browser, without chapter injection. Its opening drill took three turns. This establishes a working complete route; it does not measure a person's reading time or difficulty. See [the frozen campaign result](evidence/0.3/autoplay-result.json).

## Tactical comparison

The repeatable slice compares the first field assignment, the marsh rescue, and a formation-command encounter across seeds 17, 275, and 913. These are explicitly injected scenarios, separate from the complete campaign route.

| Policy | Wins | Total turns | Sum of surviving commander health |
| --- | ---: | ---: | ---: |
| Greedy immediate actions | 9 / 9 | 61 | 107 |
| Tactical movement, protection and coordination | 9 / 9 | 64 | 149 |

Both policies won every scenario, with no allied withdrawals in this sample. The tactical policy preserved more commander health but took three more turns overall. This is evidence that the tested tactical decisions change their cost; it is neither a win-rate improvement nor proof of better pacing or enjoyment. The full scenario records and policy interpretation are preserved in [the slice evidence](evidence/0.3/vertical-slice-gate.json).

## Different political approaches

The Chapter VIII parley was tested from the same injected start with two legal action sequences. The persuasion route won 7–6 with no promises and no threat penalty. The promises-and-threats route won 9–4, creating two obligations and staging a loss of nine Public Confidence from three threats. Both reached the ten-turn deadline. These are distinct winning costs, not a claim that every combination succeeds. [The recorded sequences](evidence/0.3/early-contest-approaches.json) include every action.

The governor's tribunal, accounts hearing, and legitimacy vote each passed under two additional approaches: a record/argument policy and a coalition policy using promises. All six runs won; the coalition runs used two promises each and the argument runs used none. The policy called `record` uses only actions available in its chapter—Chapter X uses Address and Rebut, before Invoke Record unlocks. These are isolated approach checks rather than six additional complete campaigns. See [the political results](evidence/0.3/contest-approaches.json).

## Five complete accession routes

Every row below began at New Game and completed all twelve chapters through legal commands. Different decisions and crossing terms supplied the standing required by the conditional routes; the tests did not inject high meters into the final encounter.

| Final approach | Final confrontation turns | Whole campaign turns | Result |
| --- | ---: | ---: | --- |
| Costly backing | 5 | 204 | Augustus |
| Win the field | 6 | 205 | Augustus |
| Win the legions through defection | 6 | 205 | Augustus |
| Negotiated settlement | 10 | 207 | Augustus |
| Receive surrender | 4 | 200 | Augustus |

The [versioned finale evidence](evidence/0.3/finale-depth-routes.json) retains the choice overrides, crossing agreement, resulting campaign meters, commands demonstrated, health, and outcomes. These five routes prove their tested paths are reachable; they do not exhaust every decision combination or guarantee that every strategy will win.

## Browser observations

The following checks used Chrome on Windows with a narrow viewport. Viewport emulation changes available layout space; it does not reproduce a phone's touch hardware, browser chrome, performance, or storage policy.

| Check | Observation |
| --- | --- |
| 360 × 640 field action loop | Action, target, preview and Confirm were exercised without horizontal page overflow on the earlier candidate. Its exact vertical measurement is superseded by the final production Senate check below. |
| Final production 360 × 640 Senate Promise flow | Including the offline banner, Confirm Promise ended at approximately 630 CSS pixels from the page top, inside the 640-pixel viewport. The button was 44 pixels tall; the board was 185.26 pixels tall. Document width was 345 pixels within the 360-pixel viewport, with no horizontal page overflow. |
| 200% game text and reduced motion | Full controls remained reachable; a keyboard-only target selection and Confirm action completed. This does not mean every enlarged control fits simultaneously without vertical scrolling. |
| Reading restoration | Passage 2 of 5 remained selected after reload. |
| Oath chronology | The oath was offered after the three-turn training result; the received seal followed the oath action. |
| Recovery interface | Earlier records were listed, previewed and explicitly restored. |
| Two actual game tabs | A stale-tab conflict was shown. Explicit takeover loaded the newer oath state. |

The isolated storage harness additionally exercised real IndexedDB and BroadcastChannel with Web Locks and the campaign's localStorage mirror disabled. Its latest saved run accepted one tab at sequence 14, rejected the stale writer with `SAVE_CONFLICT`, and reserved sequence 15 on confirmed peer takeover. Bounded history, read-only preview, explicit recovery after a corrupted current payload, reload restoration, and an intentionally aborted native transaction passed. The abort left the prior committed campaign exact. This fault injection is not operating-system crash or quota-exhaustion testing. [The browser evidence JSON](evidence/0.3/save-browser-evidence.json) records the environment, timestamps and six observed checks.

## Compatibility and preserved behavior

Original version-one battle and Contest checkpoints are retained under `tests/compatibility/`. Their tests compare the original deterministic turn response, exact retry, and a reload at the once-only commit boundary. Missing new company/reading fields receive defaults; existing decisions, ranks, resources and checkpoints remain. Authored mission and chamber fields are validated before imported data reaches play.

The campaign still has twelve chapters, twenty-five encounters, governor-to-Senate-to-emperor advancement locks, all recorded choice callbacks, signalled companion fates, and complete retry snapshots. Company recovery is bounded and never removes a veteran through an ordinary tactical defeat. See [campaign improvements](campaign-improvements.md) and [save recovery](save-recovery.md) for the implemented behavior.

## Evidence and remaining checks

The JSON files in [evidence/0.3](evidence/0.3/README.md) are copied release evidence, not links to disposable generated fixtures. Run `npm test` for the complete suite and `node scripts/autoplay.mjs --fixtures` to regenerate the current main-route results. Regenerated files under `tests/fixtures/` do not automatically overwrite this versioned record.

The production build is version **0.3.0**, revision **`b2b95f85bd69`**. Its [saved build report](evidence/0.3/build-report.json) reports 54 files: 36 initial files and 18 deferred files. The initial gzip estimate is **528,612 bytes** and the complete-campaign gzip estimate is **1,202,915 bytes**, both below the enforced **2,000,000-byte** limit. These figures include the service worker. They are build estimates, not measured transfers or load times on a physical phone.

The actual production update from 0.2 to 0.3 retained the existing “Update Probe” chronicle at Chapter I training, turn one. Portable saves exported before and after the update were decoded by the current validator and compared deeply equal after normalization, including `legacyLayout: true`. The old 0.2 update notice was not observed: that run exposed a mutable worker-reference bug. A dedicated watcher now retains the worker being observed; its six automated tests pass. The old browser run is not retroactively counted as a successful notice check.

For the final production revision, the local server was stopped with Ctrl+C. Reloading the browser and choosing Continue succeeded from the desktop localhost cache: “Update Probe,” Chapter I training, turn one, 22/22 health at 1D, with all offline artwork ready. A fresh console check after Continue and modal open/close, before stopping the server, showed no errors or warnings. This verifies the observed server-unavailable desktop-cache flow. It is not a network toggle blocking all traffic, a physical installed-PWA test, an operating-system crash, cache eviction, or an interrupted asset-download test.

The **90–150 minute campaign duration remains an unverified design target**. No first-time human completion, enjoyment assessment, physical iPhone/Android pass, installation/share-menu check, long-term eviction test, or live custom-domain check is claimed. The [playtest and device kit](playtest-kit.md) is prepared for those sessions; it is not evidence that sessions occurred.
