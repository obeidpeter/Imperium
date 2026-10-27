# First-time playtest and device release kit

**Status: prepared, not completed.** This document is a script and recording matrix, not a report of people or devices tested. No participants have been contacted, no analytics added and no sessions scheduled by this delivery.

## First-time session

Use the candidate production build with its exact version/revision recorded. Ask a first-time player to use a device they ordinarily play on. Agree before beginning whether handwritten notes or a local screen recording are acceptable; recording is optional and never uploads automatically. Avoid collecting a real name. A simple session code is enough.

Reserve up to 150 minutes for a full campaign, with permission to stop or take a break. Record wall-clock and active-play time separately. A shorter opening-session study is useful but cannot validate the 90–150 minute complete-campaign target. Do not combine time spent in imported later checkpoints with a claimed uninterrupted first playthrough.

Read: “Play as you normally would. Say what you are trying to do when convenient. You can stop at any time. We are evaluating the game, not you. I will mostly observe rather than explain controls.”

| Stage | Neutral task / observation | Record |
| --- | --- | --- |
| Opening | “Start a new chronicle.” Let the player choose Real-time with pause or Turn-based without recommending a mode aloud. | Whether the difference is understood; chosen mode; time to first meaningful action; what oath/title/story they remember. |
| First battle | “Complete this assignment.” Do not teach targeting unless progress has stopped and assistance is requested. | Real-time: first move, pause, target, queued action and resume. Turn-based: preview, confirm and End Turn. Record mistaken taps, scrolling, and assistance separately by mode. |
| Result and promotion | Ask “What changed, and what will you do next?” | Whether result commitment, new rank, equipment and next objective are understood. |
| Choice and debt | Ask “What do you think this choice will cost you later?” before the player decides. | Expected versus actual consequence; ability to find the creditor and settlement action. |
| Mid-campaign | Observe an ordinary save/resume and a deliberate encounter Retry after exporting a backup. | Whether the player understands current progress versus the encounter checkpoint; confidence after resume. |
| Optional camp situation | In V, VIII or XI, ask “Is there anyone here you want to help?” Do not point out the records or supply the answer. | Discovery, understanding of evidence, ability to revisit a clue and recover from a wrong answer, recognition of the changed camp; whether the player understands it is optional. |
| Command learning | Observe the optional deployment, squad-order, engineering and political exercises when they first appear. | Whether the action can be completed from the hint; whether Skip, pause and replay are understood; repeated or mistimed lessons. |
| First political Contest | “Try to secure the vote.” Ask for the player's explanation after the attempt. | Whether votes, Resolve, commitment, deadline, majority and Promise cost are distinguished; avoid supplying the strategy. |
| Governor / Senator | Ask “What responsibility is different from your earlier command?” | Whether career change reads through play, portrait and interface; confusing terms or unrelated busywork. |
| Finale | Let the player choose their approach and read the ending without interruption. | Which early decisions they recognize; whether the oath callback lands; perceived fairness of available routes. |
| Exit | “What made you want to continue or stop? What would you change first?” | Unprompted impressions, most memorable moment, tedious moment and unexpected outcome. |

Record each intervention and its reason. Separate observed behavior (“scrolled four times to compare target and action”) from interpretation (“the control group may be too long”). Do not call a seeded bot completion evidence of player enjoyment or human pacing.

Use at least a small mix of tactical-game familiarity, small/large phones and accessibility needs. This is qualitative usability work, not a statistically representative engagement study. Report sample size and experience honestly; do not invent retention or market-demand claims.

## Session record template

- Session code, build revision, date; desktop/mobile; device model, OS and browser/version.
- New player or returning; relevant genre familiarity; input and accessibility settings.
- Active minutes, breaks, chapters completed; whether checkpoints were imported.
- Each blocker: exact screen/action, expected result, actual result, screenshot/time reference if agreed, recovery used.
- Assistance count and wording; accidental actions; lost progress; confusing terminology.
- Comprehension of choices, obligations, military/civic advancement and finale callbacks.
- Player's own closing words, followed separately by observer interpretation.
- Follow-up change and repeat-check needed; no identifying contact information required.

## Real-device and browser matrix

Every row below is **NOT RUN** until an execution record names the device, OS/browser, build revision and outcome. Desktop viewport emulation cannot fill a physical-device row.

| Required surface | Procedure | Pass evidence / status |
| --- | --- | --- |
| Real iPhone, Safari | At 360px-class width or closest real device, finish one battle and one Contest entirely by touch; check target preview, Confirm, End Turn, dialogs and long labels. | No blocked action or page-level horizontal overflow; record errors/time. NOT RUN. |
| Real iPhone, installed home-screen app | Install, play/save, close app, reopen; after complete offline download disable networking and repeat. Reboot device and resume once. | Same committed state and active encounter checkpoint, local portraits/scenes available. NOT RUN. |
| iPhone VoiceOver | Complete selection → action → target → preview → confirmation in a battle and Contest; read vote/deadline, error, save status and recovery confirmation. | Correct labels/order, no focus trap, all required actions possible without sight. NOT RUN. |
| Real low-memory Android, Chrome | Record memory class/model; play an extended session, background/foreground, switch apps, rotate and resume. Repeat installed and offline. | No crash/reload-induced loss; controls remain reachable. NOT RUN. |
| Desktop Chromium and WebKit/Safari | Complete battle/Contest by keyboard only, 200% browser zoom and 200% game text separately, reduced motion, long name and URL. | Focus stays logical; no hidden action/overflow; explain any difference. NOT RUN. |
| Storage restricted / private mode | In a disposable origin/profile, disable storage or use the browser's actual restrictive mode; attempt saves, export, reload. | Accurate unavailable notice; in-memory play/export retained; no false Saved claim. NOT RUN. |
| Two real tabs | Run the isolated harness with matching run ID, then test production UI takeover using a disposable campaign and exported backup. | One accepted race writer, stale tab blocked, explicit takeover loads current state. NOT RUN until recorded. |
| First-time full campaign | One uninterrupted legal New Game route per observed player; breaks logged. | Completion/pacing and interpretation evidence, including whether 90–150 active minutes is realistic. NOT RUN. |

## Offline/update recovery procedure

Use a disposable local origin or staging subdirectory, not a valuable personal campaign. Export the save first. These steps do not authorize publication, account setup or external outreach.

1. Record build A's revision. Install/open it, wait for complete offline readiness, and save during a battle. Record chapter, encounter, turn, positions, meters and an exported code.
2. Open a second tab at a chapter break. Make build B available at the same origin using the existing deployment workflow. Observe the update notice; verify neither open tab switches its active renderer/rules mid-encounter.
3. Interrupt B's asset download with the browser's actual network-offline setting. Keep A open. Confirm saved A play remains usable and B is not falsely reported as fully downloaded.
4. Reconnect, retry download, save and close all A tabs. Reopen and verify B's revision and the exact saved campaign. Repeat once with networking unavailable immediately after A tabs close to identify incomplete-update behavior.
5. Restore the independently exported code into a fresh disposable profile through Validate and Confirm. Verify chapter locks, current encounter, Retry and once-only result commitment.
6. Test quota/eviction separately if the browser exposes them: record precisely what was removed. History stored with the same origin is not a backup against deleting all site data. Confirm the user can recover from the external code.
7. After each failure, record whether the old release remains available, whether the current code/art revisions match, the last durable checkpoint and the exact recovery path. Stop claiming readiness if any state is lost or a false Saved/Offline-ready message appears.

Record native sharing/cancellation and a downloaded 1080×1350 reign card on each supported mobile platform. Do not equate a desktop download with an iOS share-sheet result. Runtime measurements should distinguish initial transfer, full offline transfer, main-thread draw submission, actual frame cadence and user-visible input latency.

## Windows candidate check and audio listening

Record the candidate build hash and unmasked WebGL renderer before sampling. Stop parallel browser tests, warm the scene, and measure at least two non-overlapping 240-frame windows in Chapter V at a stated viewport, quality, camera and motion setting. Report frame cadence separately from CPU draw submission and estimated GPU resource bytes. A software-renderer capture proves rendering correctness, not hardware frame rate. Repeat after a tab hide/show and an ordinary save/resume; record failures rather than discarding slow samples.

For listening, use headphones and ordinary speakers at a comfortable fixed volume. Compare camp, close combat, formation orders, urgent low health and a spoken briefing. Record intelligibility, clipping/fatigue, repetitive impacts, command-signal distinction and whether music obscures important effects. Check Music, Ambience, Effects and Voices independently, then background the tab. Sample/peak and lifecycle tests do not complete this subjective listening row. Physical phones, fresh players, a full human campaign and headphone/speaker review remain pending until separately observed.
