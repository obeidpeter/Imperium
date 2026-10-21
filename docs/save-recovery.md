# Saves, recovery and tab safety

The save service stores the current campaign and up to **three distinct previous checkpoints or replaced campaigns**. Recovery is separate from the encounter's Retry command. Retry still restores the rules engine's complete encounter-start snapshot.

## What is kept

A checkpoint boundary changes when chapter, phase, encounter index/status, a recorded chapter choice or the oath changes. Repeated turn autosaves within the same boundary update the current save without pushing three adjacent turns into history. Starting a new campaign, importing a campaign or confirming recovery preserves the displaced valid current save when it differs from the replacement. At most three previous distinct boundaries are retained, newest first. This is bounded local history, not an unlimited archive.

Current and history envelopes are written together as one record in IndexedDB and one mirrored localStorage value. Historical entries do not recursively contain older history. Each payload retains its own checksum and must pass the same game-state validation as a normal load. A corrupt current payload can leave usable history, but recovery is never silently applied. If the whole browser record or site data is deleted, the history may be lost too; keep an exported save independently.

## Concurrency and durability

IndexedDB reads the latest record, checks the expected sequence, increments that sequence, and writes current state plus history in **one readwrite transaction**. IndexedDB serializes transactions on that store across tabs. This compare-and-write is still enforced when Web Locks is absent and when localStorage is disabled.

When Web Locks is available it also serializes the save operation and allows a safe localStorage-only fallback if IndexedDB fails. If neither transactional IndexedDB nor Web Locks is usable, the service refuses unsafe writes rather than claiming success. The in-memory campaign and portable export remain available. A rejected save does not roll back in-memory gameplay by itself; the UI must show the persistent save problem and preserve Export.

The service resolves a save only after its IndexedDB transaction commits, or a protected localStorage write succeeds. It reads both stores and chooses the newest valid current record. A failed mirror cannot erase a newer valid record in the other store. Checkpoint validation and bounded history also apply to fallback writes.

BroadcastChannel notifies other tabs after an accepted write, including when only IndexedDB works. A confirmed takeover loads the latest validated current save and commits a new sequence; older tabs cannot later commit their stale copies. Sequence validation is the safety mechanism even when notifications are unavailable or delayed. This is not a permanent leader lease: another tab that deliberately reloads the newest state can resume it. The interface offers explicit takeover and stops stale writes rather than silently reconciling different campaigns.

## UI/API contract

The original `loadLocal`, `saveLocal`, `saveCode` and `restoreCode` exports remain compatible. Legacy version-1 save envelopes and portable SAC1/SAC1J formats remain supported. Game-schema migration/validation stays in the rules module, and recovery payloads pass through it too. No new gameplay fields are introduced by storage.

| API | Behaviour |
| --- | --- |
| `listRecoverySaves()` | Returns validated summaries: `id`, `name`, `chapter`, `rank`, `phase`, `encounter`, `savedAt`, `sequence`, `currentSequence`. Does not restore or write. |
| `readRecoverySave(id)` | Returns a freshly validated campaign state for preview. Does not write. |
| `restoreRecovery(id, {confirmed:true, expectedSequence})` | Restores the selected validated state, retaining the displaced valid campaign. Requires explicit confirmation. Pass the summary's `currentSequence`; a newer intervening save causes `SAVE_CONFLICT` instead of replacement. Returns the restored state. |
| `takeOverSaveSession({confirmed:true})` | Loads current progress, atomically reserves a new sequence, returns that state. Requires confirmation because this replaces the tab's in-memory campaign. |
| `getSaveSession()` | Reports latest sequence/writer, whether this instance still matches it, and available IDB/Web Locks capabilities. Read-only. |
| `subscribeSaveChanges(callback)` | Receives other writers' notices, filters this writer, and returns an unsubscribe function. Notifications are advisory; every write still performs comparison. |

On `SAVE_CONFLICT`, keep the in-memory campaign exportable. Offer reload/takeover explicitly; do not silently replace it. `SAVE_UNAVAILABLE` allows memory-only play with a clear warning and export. The existing `saveLocal(state,{replace:true})` is reserved for already confirmed New Game/import/recovery actions, not routine autosave.

The default production database remains `sacramentum`, store `saves`, record `campaign`; the default localStorage key remains `sacramentum.campaign.v1`. These identifiers deliberately retain the former name after the Imperium rename in version 0.14.1 so existing local saves remain accessible on the same origin. Existing state is not deleted as part of this change. History and writer metadata live in the envelope, outside gameplay state and portable exports.

## Verification and isolated browser harness

`node --test tests/storage.test.mjs` currently passes **25 targeted tests**. These import the actual storage module and use transactional platform doubles. They verify transaction completion, mirrored/fallback stores, concurrent stale-write rejection without Web Locks, a denied Web Locks request, unsafe fallback refusal, bounded history, non-mutating preview, explicit restore and sequence checks, current/history corruption, takeover notifications, and legacy portable formats. They are not evidence of physical devices or browser eviction.

Serve the source project and open:

`/tests/storage-browser.html?run=release-20261011&role=controller`

Use a fresh alphanumeric run ID for independent sessions. Click Initialize, then open its matching peer-tab link. Keep both tabs open. Run the two-tab race, explicit takeover, history/corruption and native-abort checks. Then Save reload checkpoint and Reload. The page records a DOM table and copyable JSON with the browser identity and results.

The harness uses real IndexedDB/BroadcastChannel with Web Locks and the campaign's localStorage mirror deliberately disabled. Its database is prefixed `sacramentum-test.` and it never reads or writes the production campaign. The native abort deliberately aborts a real transaction; it is not a simulation of quota exhaustion or operating-system termination. Cleanup is restricted to that exact test database. Use a source origin without an older production service worker controlling its test page.

### Observed browser results — 11 October 2026

The harness was exercised through browser UI in Chrome 154 on Windows. Initialization passed; the concurrent two-tab race accepted the controller at sequence 14 and rejected the peer with `SAVE_CONFLICT`. Confirmed peer takeover reserved sequence 15, rejected the stale controller, and delivered its BroadcastChannel notice. The bounded three-entry history, read-only preview, explicit restore after current-record corruption, native transaction abort with unchanged committed state, and page reload of the saved **Reload checkpoint** all passed.

The game's own UI was also exercised: three recovery entries were listed, a selected entry was previewed and explicitly restored. With two actual game tabs open, the conflict banner appeared and explicit takeover loaded the newer oath state. These are real browser/storage and interface observations. They do not establish operating-system crash durability, quota exhaustion, physical mobile-device support or PWA update behavior.

A separate desktop production update from 0.2 to 0.3 and a server-unavailable localhost-cache reload are recorded in [playability-verification.md](archive/playability-verification.md). Interrupted updates, cache eviction, operating-system shutdown and real iOS/Android installation still need the procedures in [playtest-kit.md](playtest-kit.md). FNV remains the existing checksum; it detects accidental changes but is not a security boundary or proof of honest gameplay. The save-code length target and complete version-migration history are not claimed fixed by this work.
