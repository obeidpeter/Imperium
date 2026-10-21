# Version 0.17 release validation

Version **0.17.0**, production revision **`9faf31555b45`**, expands character presentation, environments and campaign progression. The campaign still contains **twelve chapters and 25 encounters**. New chronicles created through the normal interface enable the new progression rules; imported chronicles without that version marker retain their existing rules and complete retry checkpoints.

**Release checks complete:** the final Node suite passed **510/510 tests** and the asset/offline verifier passed **13/13 checks**. The current renderer passed **25 browser scenes / 518 assertions**, three targeted scenes passed **63 assertions**, the dedicated compositor harness passed **21 actual GPU checks**, and a separate browser harness passed **11 progression checks**. Two new legal campaign routes, frozen previous-version compatibility, ordinary interface interactions and a server-stopped production continuation are recorded below. No physical-phone or independent human playtest has been performed.

The [compact evidence record](presentation-verification-v017.json) contains scene IDs, route coverage, aggregates and SHA-256 hashes of thirteen raw reports, plus the actual production preview. Raw evidence remains in the local task's `work/v017` directory rather than being embedded in the source distribution. Automated assertions, agent-operated interface observations and unperformed human/device studies remain separate.

## 1. Character anatomy and equipment

Male figures can load a locally bundled, skinned GLB derived from official MakeHuman **CC0** anatomy. Its scope is the **head, neck and exposed arms**, fitted to the existing six-joint anatomical rig. Age, facial proportions, surface color, hair and beard variants retain character identities. The original procedural anatomy remains available while the asset loads or if loading fails.

This is a mixed character pipeline, not a replacement with complete imported production characters. Female anatomy, clothing, armor, hands, legs, equipment and the horse remain project-authored models. Existing weapon contacts, planted feet, role equipment and lower-detail rendering remain part of that rig. The [asset manifest](../asset-manifest.json) and the bundled [MakeHuman license](../../vendor/makehuman/LICENSE.CC0.md) record the imported asset's scope and source; no motion-capture or scanned-actor claim is made.

## 2. Coordinated weapon-specific animation

The authored joint-clip library distinguishes sword, spear and mounted strikes, with preparation, reach and recovery coordinated around the committed command's contact time. Throws retain their release point; directional reactions, blocks, walking and horse strides retain their established contact and foot-placement semantics. The clips are local keyframes blended with procedural posing, not captured performances. Reduced motion continues to present the same committed result without the full action sequence.

## 3. Inhabited environments and clearer framing

Frontier houses gain entrances, roofs and porches, with working-yard details. Wetland settlements use raised structures and fishing equipment; eastern settlements use flat-roofed courtyards and open merchant arcades. Political interiors gain civic furniture and recessed chamber architecture. These changes decorate the existing legal board without changing authoritative tiles, ground heights, movement or objectives.

Follow, Horizon and action framing can cut away obstructing walls, fences and foliage around the inspected figures. The cutaway uses private material copies and restores them when the view or scene ends. Label placement accepts a projected body rectangle: the selected label prefers space above its figure, and other unit/objective labels avoid that body. When space is insufficient, lower-priority labels can be suppressed; this does not promise that every name is simultaneously visible in a crowded narrow view.

## 4. Branching operations and consequences

Eleven encounters each offer two pre-departure operation choices: **22 authored alternatives**, not 22 additional encounters. A branch changes the later objective, route or protected party. A victory with every deployed veteran still active earns the stated resources and a one-use benefit for a following field encounter. A costly victory still advances the campaign but grants no operation bonus.

Those benefits provide bounded recovery, an extra javelin, or a delayed announced reinforcement; the preview explains the actual branch and reward. They are consumed on encounter commit and restored by the exact start checkpoint on retry. Previous chronicles retain their earlier operation definitions.

## 5. Veteran specialization

From Chapter III, a veteran with two deployments may choose one permanent, free specialization in camp:

| Path | Active contribution | Tradeoff |
| --- | --- | --- |
| Protector | Guard an adjacent friend; reduce incoming damage while the protector remains adjacent and active, and brace the protector. | More maximum health, less melee damage. |
| Formation leader | Inspire nearby friends with morale and Brace; one deployed leader adds one command per round, within the cap. | Less maximum health and melee damage; multiple leaders do not stack the command bonus. |
| Ranged specialist | Two aimed volleys per battle, with a four-tile range and clear line of sight. | Archer role, less maximum health and melee damage. |

Each special action spends one command and that veteran's movement/action. The camp roster and legal command preview expose the choice and its costs; a specialization cannot be exchanged for another path.

## 6. Political relationships and negotiated agreements

Nine named fictional representatives recur across all six Contests. Each keeps bounded trust, which changes that representative's starting stance in later chambers. Their interests, demands, limited counterproposals and existing commitments are visible when selected.

An agreement uses the commander's available speech within two tiles. Accepting a demand or making a counterproposal improves stance now and creates a stated supply payment due in a later camp. At most two agreements may be made per Contest, with only one open agreement per representative. Terms become durable only after the encounter is committed; retry discards uncommitted agreements.

Honoring an agreement pays once and earns trust and Political Backing. Breaking it loses trust and Public Confidence. An unaffordable payment changes nothing: the player may leave it open or explicitly break it. These agreements are separate from the existing **Promise** action and its accession obligations.

## 7. Guided opening

Optional field-guide prompts respond to the training actions, first patrol and opening political turns. They explain the next legal step and use the authoritative action forecast. Advice distinguishes a ready command from one that needs a new turn. Hiding or reopening the guide changes presentation settings, not campaign state; named selectors and the usual select–preview–confirm controls remain available.

## 8. Deferred assets, compression and adaptive rendering

The shared 3D code, model, materials and vendor dependencies remain outside the initial campaign shell and join the current chapter's offline asset group. A restored later chapter receives those shared dependencies without requiring a Chapter I visit. The active earth, stone and timber textures use smaller, same-resolution exports; their earlier files remain preserved in the complete inventory. Existing recordings are unchanged in this release.

Where the browser supports asynchronous GPU elapsed-time queries, an optional resolution controller responds to sustained GPU cost. It reduces only the WebGL drawing buffer, within a 65–100% scale range, and can restore resolution after sustained headroom. DOM text and controls retain their normal resolution. Unavailable, disjoint or lost-context measurements are discarded; the controller does not substitute CPU submission time for GPU execution time. This mechanism does not establish a speedup, target frame rate, or phone thermal/battery performance.

## Recorded verification

| Check | Recorded result | Scope |
| --- | --- | --- |
| New progression route, primary choices | 25 wins, twelve chapters, Augustus; **233 turns** | Standard, seed 275; New Game and public legal commands. |
| New progression route, alternate choices | 25 wins, twelve chapters, Augustus; **216 turns** | A second legal route using the alternative operation selections. |
| New-feature coverage across those routes | All 22 operation alternatives, all three specialist actions, five earned specializations, agreements in all six Contests | No injected service, resources, positions, promotions or victories. Each route also checks 25 exact retries. |
| Frozen v0.16 compatibility | **1,079 commands and all 25 retries exact**, including save round trips | Comparison against the captured previous-version route; separate from the new progression routes. |
| Final full Node suite | **510/510 passed**; zero failed, skipped, cancelled or todo | Full regression rerun; recorded duration 64,484.2406 ms. |
| Current-renderer campaign browser sweep | **25/25 scenes; 518/518 assertions** | Actual WebGL using legally reached checkpoints from the frozen 1,079-command route. |
| Progression browser harness | **11/11 checks passed** | Isolated public-API checks on copied legal fixtures; separate from ordinary campaign interface play. |
| Targeted browser checks | **3/3 scenes; 63/63 assertions** | High cavalry, narrow Balanced Senate, and Performance rearguard. |
| Dedicated compositor GPU checks | **21/21 passed** | Actual output, transfer, contact shading, cleanup and deliberate shader-failure fallback. |
| GPU timer observation | **259 completed hardware queries**; scale **1** | One saved stage snapshot; last query 21.90177 ms. Observational, not a benchmark. |
| Ordinary interface checks | New chronicle, guidance, training, branch selection, negotiation, settlement and presentation preferences observed | Agent-operated normal controls with legally earned restored checkpoints; not a complete campaign interface playthrough. |
| Production browser-offline check | Cached title and Chapter I road continued with exact save, imported anatomy and finishing pass | Local production server stopped before reload; current-chapter readiness remained truthful. |
| Production build and asset/offline verifier | Revision **9faf31555b45**; **13/13 checks** | Manifest, budgets, provenance and simulated worker/cache behavior; measured groups below. |

The primary route exhausts supplies and explicitly breaks expensive agreements. The alternate route honors two cheaper counterproposals and breaks others. This demonstrates real resource consequences in those legal routes, not a guarantee that either strategy is optimal or enjoyable. The route generator is `scripts/progression-autoplay.mjs`; the fixed previous-version trace is `tests/compatibility/campaign-v016-route.json`. Focused tests also use explicitly isolated scenarios for exact damage, geometry and settlement rules; those are not substitutes for the complete legal routes.

The campaign sweep ran in Windows Chromium 154 at a **1280 × 720** browser viewport, DPR **2**, with a **1233 × 468 CSS-pixel canvas**, Balanced quality. All 25 scenes recorded the imported anatomy asset ready and the compositor enabled. Assertions cover real WebGL, weighted skinning, legal figure anchors, settled label bounds/overlap, command presentation, state purity, cancellation and disposal. These are legally reached renderer checkpoints, not uninterrupted manual campaign play or browser coverage of every new operation alternative. Startup rendering samples in the raw report are not used as warmed performance measurements.

The separate progression harness checks an earned Chapter III specialization, pure reads/previews, rejected unknown or repeated choices, a legal Chapter VII agreement, consumption of the commander's speech, staging until commit, exact retry, and the absence of progression controls in older/default campaigns. It calls the public rules API on copied legal fixtures. Its embedded full-route summary refers to the prior automated route, not actions performed through ordinary browser controls during that harness run.

The targeted report contains the earlier 25-scene sweep followed by three new checks; only those final three rows count as additional evidence. Chapter IX cavalry (`ch9-wing`) passed **20** checks in High, Chapter XI Senate (`ch11-adlection`) passed **23** in Balanced with a **360 × 420 CSS-pixel canvas**, and Chapter II rearguard (`ch2-rearguard`) passed **20** in Performance. The narrow scene is inside a desktop browser, not a physical-phone test. All three check exact committed state under reduced motion and cancellation; High/Balanced retain the compositor and Performance uses the direct path.

The dedicated GPU harness used a **720 × 400 drawing buffer**. It checked visible, nonuniform output, neutral transfer, contact shading and release of render targets/geometry. A deliberately broken shader produced the expected diagnostic and a visible direct-render fallback. That induced error is expected; it is not a normal-scene failure or an assertion that no shader error was generated by the harness.

Separately, a saved Balanced/Horizon stage snapshot recorded **259 asynchronous GPU elapsed queries**, with a last value of **21.90177 ms**. Adaptive resolution was enabled and remained at scale **1**, with zero changes. This confirms that the actual hardware-query path ran in that browser. A last sample is neither a median nor a frame-rate benchmark, and this observation does not demonstrate adaptation under sustained load, a speedup or a device performance guarantee.

## Ordinary interface and offline continuation

The operating agent used ordinary controls and restored legally earned checkpoints through the validated portable-save dialog. A default new chronicle enabled progression, and a legal Move advanced the training display to **2/4**. In Chapter III, Lucan's Formation leader training became permanent. In Chapter VII, the accessible selector reached Titus Valens and a limited counterproposal became staged while spending the commander's speech. In Chapter VIII with zero supplies, Honour was disabled; explicitly breaking an agreement reduced trust by two and Public Confidence by three, and displayed counts refreshed.

The Chapter I pursue choice persisted through reload and departure. The guide could be hidden and reopened. Turning adaptive resolution off changed the renderer diagnostic, and it was restored to on. These are agent-operated observations recorded in `ordinary-ui.json`, not an automated assertion count or independent usability study. They do not establish a complete twelve-chapter interface playthrough.

At the final local production origin, the restored Chapter I road save matched the source export. Follow and zoom preserved it exactly. After the origin's server process was stopped, the cached title reloaded and Continue returned to **Chapter I road, turn 1**. The imported anatomy was ready, the Balanced finishing pass remained enabled, Chapter I was reported available offline, and the exported save remained exact. The app did not claim the complete campaign was offline. This tests the local desktop browser's cache with its server unavailable, not a physical phone, disconnection of all network traffic, an operating-system crash or a full offline campaign.

The [release preview](../images/imperium-v017-preview.png) is an actual full-page production capture in a close **Follow** view, showing the imported recruit anatomy, field guide and command dock. It is not a Horizon capture or illustrative key art.

## Download scope

| Resource group | Summed gzip bytes, including service worker | Gate |
| --- | ---: | ---: |
| Initial shell | 397,938 | 2,000,000 |
| Chapter I | 7,903,090 | 8,000,000 |
| Complete campaign | 11,516,769 | 24,000,000 |

The build has **200 runtime files**, with **79 initial** and **121 deferred**. Complete uncompressed size including the worker is **14,268,589 bytes**. Chapter I retains **96,910 gzip bytes** of headroom. These are build sums, not observed browser network transfers. The final build report is hashed with the local evidence; simulated asset/offline protocol checks remain separate from the actual browser-offline observation above.

## Limits and remaining validation

The imported anatomy improves only part of the character. Clothing, hand articulation, the horse and scripted animation remain visible limits at close range. Camera cutaways and label priority manage obstruction but cannot make every dense scene equally readable. Rendering correctness and deterministic campaign completion do not establish attractive art, enjoyable pacing, understandable negotiation or comfortable touch controls.

Physical-phone GPU, memory, thermal, battery and installation behavior remain unverified. Independent human onboarding, accessibility and enjoyment testing also remain unperformed. Final desktop browser and automated checks must retain their actual scope rather than being presented as those missing studies.
