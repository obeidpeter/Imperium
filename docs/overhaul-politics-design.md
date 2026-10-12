# Political overhaul: audit and approved direction

This design precedes the political mechanics changes in the complete overhaul. It responds to the user's explicit permission to redesign weak mechanics while preserving the twelve-chapter career, political commitments, promises, deadlines, deterministic outcomes, transactions, and compatible saves. The frozen comparison source is `work/overhaul-baseline-06/Sacramentum`.

## Source findings

1. **Blocs lose their mechanical identity after seating.** `createContest` uses Army, Political Backing, and Public Confidence to seed Veteran, Landholder, and Civic stance. Thereafter `speechStrength` keys principally on a delegate's personal interest. A Civic and Veteran delegate with the same interest respond identically. The existing mixed-interest layouts are valuable; they should be retained and given distinct bloc priorities.
2. **Rival priorities are partly a turn counter.** `endContestTurn` attacks every third turn for lobbyists and every even turn for brokers/prosecutors. It then selects a target before checking the quality of reachable speaking positions. Static `intent` strings describe a style but do not forecast the next legal intervention. This creates an opportunity for deterministic, visible strategic plans rather than extra enemy statistics.
3. **Some authoritative information is missing from previews.** Address lists raw interest gains, although commitment resistance and the stance cap can change the actual result. Threaten forecasts its main recipient but only describes its bloc-wide backlash. The same forecast should enumerate affected delegates, net votes, and costs and then drive application.
4. **Material Promise is disproportionately efficient.** Grain and office interests receive six stance at range two, while Persuade is usually one or two at adjacency. Promises already have a two-recipient cap and staged two-supply accession cost; those safeguards are implemented. The revision should retain them while making the largest promises less dominant and their greater material cost explicit.

These are code-observed limitations, not proof that players dislike the system. Existing automated approach gates show legal completion, not human enjoyment. Browser and human play observations must be reported separately.

## Revised Standard rules

- Keep the fixed thirteen-member electorate, seven-vote threshold, deadline-only resolution, tie failure, surviving votes after speaker withdrawal, stance bounds, commitment resistance, move-plus-speech economy, ability unlocks, required chapter demonstrations, Address cooldown, and Record recipient cap.
- Add small, structured bloc affinities alongside personal interests: Veterans respond especially to military Record and coercive security arguments, Landholders to material Promise, and Civic delegates to Persuade/Address but resist Threaten. Bonuses are bounded and included in the exact preview.
- Give political positioning one clear cooperative use: a living allied speaker within two tiles adds one point to Persuade. Staying together improves local lobbying but gives up coverage of distant delegations and exposes both speakers to the same opposition. Record and broad Address retain distinct reach and use limits.
- Reduce grain/office Promise's base gain from six to four. Their commitment costs three supplies at accession; other Promise obligations still cost two. Landholder affinity can improve the offered gain. Preserve at most two promises, once per recipient, staged obligations, and the established cost for breaking a promise. The preview names the recipient, benefit, due chapter, full honour cost, and breach consequence before commitment.
- Replace parity-driven rival decisions in new encounters with public-state, legal-position planning. Lobbyists prioritize votes near the majority boundary; brokers prioritize promised supporters; prosecutors weigh vulnerable speakers and consequential withdrawals. Rivals do not gain movement, speeches, hidden knowledge, or extra Resolve. Their plans are recomputed after player actions and simulated sequentially for an accurate upcoming-turn forecast.

These are intentional changes from the previous argument table and rival schedule, documented before implementation. They are balance changes rather than claims about historical Roman voting procedure. They do not change the campaign's historical anchors or add a new political currency.

## Interface and save boundary

Newly created chambers carry `politicsVersion: 2`. Existing authored chambers without that marker keep version-one argument values and rival behavior. `createContest(state, data, {politicsVersion: 1})` must recreate that previous behavior for Retry; the save boundary records the old version in encounter options and its checkpoint. Original pre-authored Contests continue through the existing frozen legacy module. No save is silently discarded.

The political module will expose pure `contestIntents(state)`, `politicalPosition(state, unitId)`, and `argumentForecast(state, unit, action, target)` helpers. `previewContest` retains `{ok, message}` and adds structured forecast data. Existing command names and targets remain stable. The interface must render these rule-owned facts rather than calculate a separate tactical result.

## Verification plan

Regression checks will cover exact preview/application parity, commitment resistance, capped and bloc-wide effects, Promise limit and debt staging, public-state intent purity and execution, legal movement, frozen old behavior, fixed electorate after withdrawal, and deadline resolution. Multiple legal-command approaches will exercise Senate and legitimacy encounters from the same labelled start state, with action traces, votes, Resolve, promises, and turns reported. Generated campaign fixtures and the shared autoplay policy remain under their owners' control. No scenario fixture will be presented as a fresh full-campaign playthrough.

## Implemented evidence

The nine political overhaul tests pass, along with three existing focused checks for chamber variety, Record versus Promise and Address preview purity. The fixed v0.6 serialized accounts chamber produces its original next turn and its exact original Retry start after migration.

The [comparison report](evidence/overhaul/political-approaches.json) records 48 legal-command scenario runs: six chambers, moderate meters (45/45/45) or zero meters, two approach policies, and old/new political rules. All 48 won. The policies share movement evaluation but constrain their arguments: the debt-free policy avoids Promise and Threaten; the coalition policy avoids Address, Record and Denounce except when a chapter requires demonstrating one. Chapter 7 has only Persuade, so its policy labels do not represent two distinct available strategies there.

Under the new rules, the eight Senate/admission cases and four legitimacy cases won with 7–11 supporting votes. The debt-free approach added no obligations. In Chapters 8–12 the coalition approach made two promises and staged 4–6 supplies of debt, depending on recipients; the stricter material cost is actually exercised. The moderate-support legitimacy coalition finished at the seven-vote threshold. Every Contest still lasts to its authored deadline of 8, 10, 12 or 14 turns; these changes do not claim shorter political pacing.

This evidence establishes deterministic execution, compatibility and viable routes under two declared policies. It does not prove that the new AI is uniformly harder: some positions become safer because rivals prefer valuable votes to weak scheduled attacks. It also does not replace the integrated full-campaign run, browser interaction checks or first-time human playtesting recorded by the final overhaul report.
