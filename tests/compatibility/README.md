# Frozen pre-upgrade saves

These version-one JSON states were generated from the saved pre-gameplay-upgrade source in `work/aesthetic-baseline/src/core/game.js` and its original battle, Contest, and shared rules on 11 October 2026. They are committed regression inputs, not disposable outputs from the current campaign bot. Keep this directory in the source archive.

Each file contains an original encounter `start` and an `active` save after one legal hero movement to the first available move target followed by one legal End Turn. Neither contains company or reading-progress additions. The chapter itself was injected with the original `debugJump(..., chapter, true)` helper so this fixture isolates save compatibility. It does not prove a legally completed campaign route.

- `legacy-battle-checkpoint.json`: seed 275, Chapter 2, `carry` decision, original marsh encounter.
- `legacy-contest-checkpoint.json`: seed 275, Chapter 11, `independent` decision, original accounts Contest.

`tests/career-story.test.mjs` imports the stored JSON without rebuilding it through the revised constructors. It compares a retry against the normalized original start and compares a repeated legal move/end turn against the normalized original active save. A separately labelled injected won state tests that reload/commit applies rewards once and the following encounter uses the new rules.

The frozen legacy implementations are retained in `src/core/legacy-battle.js` and `src/core/legacy-contest.js`, each with its original private shared helpers. Do not update these fixtures when changing new encounter rules: a changed result is a compatibility regression that needs investigation.
