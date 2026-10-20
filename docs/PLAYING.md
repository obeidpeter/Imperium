# Playing Imperium

Start at the title screen with **Play · Begin your story**. Give the recruit a name or keep Aurelius Marcellus. You begin as a *tiro*, a recruit: no command authority, no political office, and only your own actions to control. **Continue the chronicle** restores the latest valid local save.

This guide describes version 0.34 with **Standard** difficulty. Graphics quality affects presentation, not difficulty. New chronicles include the command campaign below. Older chronicles can enable it in camp; a suspended encounter and its Retry retain their original rules.

## Battlefield and chamber views

All campaign battles and political Contests support the 3D scene. Your legal commands, autosaves, checkpoints and progress are shared with **Switch to 2D**; Pause remembers the view you prefer. If WebGL is unavailable, the tactical view takes over. Switching views does not restart an encounter or change the rules.

Drag to orbit and scroll or press **+ / −** to zoom. **Overview** restores a wide view and **Follow unit** frames the selected soldier. The campaign board keeps arrow-key tile navigation and Enter to select/confirm, plus named action/target selectors. **G / Grid** toggles tile boundaries. Camera movement never spends an action. In a dense chamber, compact labels show delegate stance or speaker Resolve; hover or select a figure for its name and details. Withdrawal preserves a speaker’s vote.

**Horizon / H** lowers the view to show sky and distant scenery. Drag to turn toward another bearing; **Overview / Home** restores the full tactical view. Distant scenery is decorative and cannot receive movement orders. The camera does not spend an action.

Follow can choose a different angle to keep walls or columns out of the subject's view. Selected figures receive label priority; badges that cannot fit without overlapping may be hidden until you select, inspect or reframe the scene. Named controls and the command inspector retain the same rule information. Figure detail changes with viewing distance; it does not change health, equipment, movement or legal targets.

**Generated sound effects** in Pause are off by default, with an adjustable effects volume. Enabled 3D combat sounds are synthesized locally and stop while the page is hidden. Every action is understandable without sound; reduced motion and graphics quality remain presentation settings.

## The optional 3D frontier

**Try a standalone skirmish** on the title screen opens one separate battle. **Take command** begins the study; selecting your soldier, an action and a target produces a preview, then **Confirm order** commits it. Companions act autonomously, as in the campaign's opening field battle. **End turn** lets the other soldiers act. Restart and victory do not change your chronicle or grant campaign progress.

Drag the scene to orbit and scroll to zoom. With the canvas focused, arrows rotate, **+ / −** zoom, **F** focuses the selected soldier and **Home** restores the field view. The **Focus soldier** and **Field view** buttons do the same. Use **Named action and target controls** for a complete alternative to pointing at the terrain. Reduce motion and the three graphics settings affect presentation, not outcomes. **Return to campaign** opens the normal game and its existing save.

This study needs WebGL 2. Its shared renderer and textures also download with each campaign chapter, reusing files already cached; the standalone page and stylesheet are included in the explicit complete offline download from campaign Settings. A chapter's offline-ready message alone does not establish that this separate page is cached. See [study scope and limits](3d-study.md).

## The campaign loop

1. Read the camp passages with **Read on**. The mission panel states the objective and new capabilities to demonstrate.
2. Make the chapter’s consequential decision. Each choice shows meter and supply effects; a promise also shows its recipient, due chapter, and expected cost.
3. Complete any preparation offered in camp, then enter the next encounter.
4. Play the battle or Contest. Check the objective and required capabilities; simply defeating enemies is not every mission’s goal.
5. After success, choose **Record the result**. This commits rewards and returns you to camp or the promotion scene.
6. Complete the chapter’s remaining requirements, accept the advancement, and continue the story.

There is no mandatory grinding. The campaign map shows completed chapters and sealed previews. Chapter XI requires the completed military campaign, Dux appointment, and resolved governorship. Chapter XII requires completed Senate challenges and Senator status. Reloading derives these locks from earned milestones.

## Select, preview, confirm

Every battle and Contest action except a plain walk follows the same route:

1. Select a unit on the board or the named unit selector.
2. Choose an available action. Each button states its exact cost (`1 move`, `1 action`, `1 order`, `1 speech`, `1 javelin`, cooldown, or promise limit).
3. Select a highlighted tile or choose a target from the target list. If an action has no legal target in reach, the command dock states why (for example, no visible enemy on an adjacent tile or beyond javelin range).
4. Read the effect, target, and cost in the preview. For **Formation**, the preview also names which up to 3 adjacent allies will join and which nearby allies are excluded (already ordered, beyond 1 tile from the anchor, or beyond the 3-unit cap).
5. Press **Confirm**, or activate that same target again. Nothing is spent merely by examining a new target.

**Walking** takes one selection. With no other action chosen, select open ground and the selected unit walks there at once, by the cheapest route the rules allow. If that spot is beyond this turn's movement, the unit walks as far toward it as it can: to the reachable tile that leaves the shortest way on (ties go to the straighter line, then the cheaper move); the rest of the way is measured over ground you can see. If it cannot get any closer, nothing moves and the board says why. Pointing at ground, holding a finger on it on a touch screen, or moving the board cursor onto it shows the route before you commit: a solid line to where the unit will stop this turn, a faint dashed line for the rest of the way, and a faint wash over all the ground the unit can reach. The figure then walks exactly that route. **Undo Move** (`U`) takes a walk back until the unit acts. To preview and confirm moves like every other order, turn on **Pause → Confirm moves**.

**End turn** lets uncommanded allies and the enemy act, then refreshes the next player-side turn. Its tooltip summarizes any remaining unspent moves, actions, speeches, or command orders. One turn means a whole player-side turn, not a single soldier’s action. Open **Tactical advice** (`What can I do?`) or **Named action & target controls** below the dock to see why any capability on the selected unit is currently unavailable and which chapter capabilities still need to be demonstrated before promotion.

### Mouse and touch

Click or tap a figure to select it. Clicking or tapping open ground walks there, or as far toward it as this turn allows (with **Confirm moves** on, it previews Move instead); an opponent automatically previews an available attack. The action dock provides other actions. Activate the previewed target again, or use Confirm. The target selector supplies the same choices as the map. In political Contests, you can also press **Inspect** beside any delegate in the chamber roster to examine their stance, interest, and best appeals without finding their seat on the board. No essential action requires hover or a timing-sensitive double tap. On a touch screen, hold a finger still on the board for a moment to see what a tap there would do: the readout and, on open ground, the route. Lifting the finger after a hold does nothing, and a tap then walks. On a narrow screen, the board, roster, actions, target preview, Confirm and End turn are grouped together. Supporting mission details and dispatches open below. Enlarged text uses normal scrolling.

### Keyboard

Use **Tab** and **Shift+Tab** to move among controls and **Enter** to activate them. When the board has focus, arrow keys move its cursor (updating the visible `#board-hover` readout and screen-reader announcement, which for open ground also says where a walk would stop) and Enter selects a unit, walks to open ground, or previews a target and then confirms that same target. **1–9** choose available actions, **N** cycles ready units, **U** takes back a move until the unit acts, **E** ends the turn, **G** toggles the grid, and **Escape** clears the current action. In 3D scenes, **H** switches to Horizon view, **F** focuses on the active unit, **Home** resets the camera overview, and **+ / −** zoom. Native target, formation, and order selectors work with arrow keys. The named unit selector and target selector provide a complete alternative to navigating the board spatially.

Use **Pause** for settings, help, save codes, and campaign panels. Sound is optional, with an **Effects volume** slider. Reduced motion is available, and game meaning never depends on audio alone.

These are the default letter shortcuts. **Pause → Controls & readability** lets you remap Undo, Next unit, End turn, Grid, Focus and Horizon. Choosing a letter already in use swaps the two commands. Help and command hints follow your bindings. The same panel changes the touch-preview delay, enables stronger interface contrast and switches the compact battlefield layout.

### Graphics and readability

In **Pause → Graphics quality**, choose **Performance**, **Balanced**, or **High quality**. These change optional atmosphere, particles, shadows and rendering resolution. Essential figures, legal targets, labels and rules stay the same. Repeated slow rendering can lower the setting automatically; the game announces that change, and you can choose another setting in Pause.

**3D figure style** chooses *Sculpted* figures, *Painted (HD-2D)*, the campaign's painted unit art standing in the 3D scene, or *Ink and wash* outlines. The painted style settles the overview on diagonal views and adds a tilt-shift; both finishes need Balanced or High quality. **Action camera** (on by default) briefly closes in on each committed attack and then returns; it never moves with reduced motion or while you follow a figure. **Battle remains** (on by default) leaves the fallen, spent arrows and trodden ground on the 3D field until the encounter ends; turn it off for a clean board. The rules never see them.

On Balanced and High the chapter paintings in camp and at each promotion drift slowly in depth, with the chapter's weather (rain, embers, dust, mist or motes of light) drawn between near and far. Performance and reduced motion keep them still.

**Reduced motion** disables transition animation, while **Text size** offers enlargement up to 200%. The named unit and target controls remain the alternative to selecting a figure on the battlefield. Unit artwork shows faction, role and facing; movement and gesture effects visualize the committed action and never spend an additional action themselves.

## Fighting and keeping people alive

From Chapter IV each military unit in the 3D view stands as a formation: its leader plus the men of the unit, drawn up in line, shield wall or wedge. Men leave the formation as the unit loses strength, so a thin formation is a weakened one. The rules still treat it as one unit on one tile. When you choose an action, the cells it can reach are washed in ink on the ground; pointing at or inspecting an enemy hatches in red everything it could strike next turn. Rank-and-file units show a small role sign and strength bar instead of a name; point at a unit or select it to see its name.

The protagonist is marked with a star. His fall loses the battle. Each unit has a movement allowance and one action; ordering a unit twice cannot create another move or attack. The early chapters control only the protagonist. Allies display their own intentions.

| Action | Use |
| --- | --- |
| Move | Reposition within the displayed legal range. Occupied ground and terrain constrain routes. |
| Strike | Attack a legal adjacent enemy; check damage and defence in the preview. |
| Brace | Protect the selected soldier against the next exchange. Useful while a threat approaches. |
| Throw javelin | Attack a legal ranged target; ammunition is limited. |
| Assist | Shield or recover a wounded casualty so the rescue can proceed. |
| Scout | Reveal hidden enemies and concealed ground before advancing. |
| Order | Replace an ally’s displayed intention, spending command capacity. Advance, attack, hold, restore morale, or withdraw toward the commander and brace. |
| Formation | Give a shared order to up to three adjacent allies for one command. Choose line, shield wall, or wedge and an ordered intention. |
| Rally | Restore nearby morale when the army risks breaking. |
| Deploy | Reposition the command at the beginning of the legion battle; use it before spending the opening movement. |

Marsh slows movement. Walls and high ground protect; height also improves ranged attacks. River crossings funnel movement through fords. Entering a tile beside a visible hostile melee unit ends movement, so a line can screen an approach. Leaving an engaged starting tile does not trigger an attack. Flanks bypass frontal shield defence, and cavalry needs an open approach to charge. In the command campaign, a braced defender that survives a frontal mounted charge answers with one damage, once per round; the preview includes this response. Read the damage preview’s actual modifiers before committing.

Command capacity is **1** in Chapter IV, **3** in V, **4** in VI, **5** in VII–VIII, and **6** thereafter. The protagonist’s own direct actions do not spend this budget. Unordered allies follow their visible intentions. Formation orders use the units’ existing action limits and last only for the current round. Shield wall gives two protection, limits movement to one and gains extra frontal protection beside another shield-wall member. Line ignores the marsh surcharge, reduces morale loss and screens ranged attacks when cohesive. Wedge adds melee damage on firm open ground but increases incoming damage; its attack benefit is lost in marsh, fords and fortifications.

Hits reduce morale on both sides. Shaken units (`<= 40` morale) and broken units (`<= 20` morale) display amber and crimson base rings; broken autonomous units fall back and regroup. Rally and Inspire emit an expanding golden shockwave and restore initiative. Adjacent enemies sharing a formation display crimson cohesion tethers; striking a shield wall with a Wedge on firm ground (`Wedge splits shield wall`) or from the flank (`Flank breaks shield line`) surfaces a formation-breaker bonus in the combat modifier chips. Guards, archers, cavalry and raiders consider different positions and targets; allies also consider escorts and objectives. **Allied plans & visible threats** shows their current intentions, and after each encounter an **After-Action Chronicle** names Distinguished Service, key Turning Points, and (on defeat) a concrete tactical diagnostic.

Named companions’ permanent fates follow clearly signalled narrative choices. In camp, **Consult the War Council** lets you hear how present officers and counterparts (`Varro`, `Lucan`/`Sabinus`, `Crispus`, `Aelia`, `Paullus`) weigh the chapter’s decision and the upcoming engagement. An allied unit’s ordinary tactical defeat does not silently kill a recurring character in the story. In a rescue, even a difficult personal decision does not remove the chance to Assist another casualty and complete the mission.

## Political Contests

A Contest is a chamber encounter on the same grid. Speakers move to reach members and each gets one move and one speech per turn. **Resolve** replaces health. A speaker at zero Resolve withdraws and cannot act, but their own vote still counts; the majority required does not shrink.

In the 3D chamber a member's bloc shows in two ways, so it never rests on colour alone: his toga trim (Veterans a broad crimson band, Landholders a double wheat-ochre band, Civic a blue band broken into three lengths, Chamber purple with a gilt line) and the letter at the head of his stance marker (V, L, C or Ch). The 2D board uses the same colours and letters. His posture shows his stance: leaning in with an open hand for your motion, arms folded against it. When the deadline vote is decided, the members divide (*discessio*) and walk to stand behind the speaker whose side they were counted on. Click the board to skip the walk.

Members’ **Stance** runs from −6 to +6. At +1 a member votes for your motion. At −3 or +3, commitment hardens, so reversing it takes more effort. The interface shows the support count and the deadline. **Only the vote at the deadline wins**; gaining an early majority does not end the Contest. A tie rejects the motion.

| Speech | Effect and trade-off |
| --- | --- |
| Persuade | Shift an adjacent member’s stance. A living allied speaker within two tiles adds one point. |
| Promise | Gain support for a concrete obligation. One promise per recipient, at most two per Contest; grain and office promises cost three supplies to honour, others two. |
| Threaten | Fast support at the cost of Public Confidence and resistance in the member’s bloc. |
| Address the Chamber | An area stance shift; positioning matters, and the ability has a cooldown. |
| Rebut | Restore a friendly speaker’s Resolve or weaken a rival’s next speech. |
| Invoke Record | Appeal to a delegate once per Contest. Service-focused delegates respond most; grain and office interests respond weakly. |
| Denounce | Reduce a rival speaker’s Resolve. Their withdrawal removes actions, not their vote. |

Inspect each delegate’s bloc and personal interest. Veterans favour Record and Threaten, Landholders favour Promise, and Civic delegates favour Persuade and Address while resisting Threaten. Grain or office interests respond better to promises than military appeals; law responds well to persuasion and public address. The preview includes commitment resistance, stance caps, every affected delegate, net votes and costs.

Concrete promises carry their debt beyond the vote. Breaking one costs eight Public Confidence and four Political Backing; honouring with insufficient supplies costs one Public Confidence per missing supply. Brokers put additional pressure on promised supporters. The preview names the commitment and its due chapter before you confirm.

The coalition panel distinguishes committed delegates from wavering support, shows remaining promises, and includes a live **Chamber Whip Forecast** marking supporters **At Risk** from rival speakers’ next-turn lobby intentions alongside **1-speech flips** in reach. Rivals’ next replies are forecasts if the position holds: lobbyists value swing votes, prosecutors exploit vulnerable speakers, and brokers contest pledged support. Your actions can change those plans. Use both player speakers, compare staying together with covering distant seats, and defend enough votes while demonstrating the chapter’s required abilities. The [Contest rules sheet](contest-rules.md) contains exact tuning values.

## The expanded campaign

New chronicles started from the title screen use the expanded campaign. A chronicle begun before 0.32 keeps its original rules until you press **Enable expanded campaign** in camp, and an encounter already under way is never changed. The exact numbers are in the [expanded campaign rules](expanded-campaign-v031.md).

### Field objects

Every battle after the training drill offers two opportunities, and you can take only one. Their labels and exact effects appear in the field panel. In the command campaign they serve distinct chapter purposes; for example, Chapter V offers engineer plans to open the side gate and repair the footbridge, or a water detail to extinguish pitch fires and heal living friends. Older expanded chronicles retain the supply-cart and signal-station effects. Either opportunity closes after turn 7, or one turn before a shorter mission's deadline, and neither replaces the main objective. From Chapter III a timber barricade gives adjacent defenders 1 protection until it is dismantled. A pitch brazier, once lit, blocks sight through its smoke and hurts **both sides** within one tile at the end of each round; it burns for three rounds, or one in rain. Chapters V, VIII, IX and XII add a side corridor reached through a closed gate, which blocks movement and sight until opened, and a damaged footbridge, which becomes a ford when repaired. Until then the corridor cannot be reached, and the board says so.

To use an object, bring your commander onto it or next to it, then press its button in the battlefield panel below the board: **Secure objective**, **Open gate**, **Repair bridge**, **Dismantle**, **Ignite** or **Extinguish**. This spends the commander's personal action, not their move or the company's orders. The board readout, the arrow-key cursor, the target list and the ground note in the command dock all name each object and its state, for example "Side gate (closed)".

### Cohesion, suppression and weather

Every unit has cohesion (80 at the start) and suppression (0–3). Blows wear cohesion down; arrows and javelins wear it less but add suppression. After Chapter I, cohesion below 40 and suppression of 2 or more each take 1 off that unit's attacks. **Brace**, or a friend standing next to the unit, restores cohesion and lifts one point of suppression at the end of the round; **Rally** restores more and clears suppression. In rain each step onto high ground costs one more movement, which the walk preview already counts. Rain, mist and dust take 1 off ranged damage beyond two tiles. The attack preview lists every modifier that applies.

Visible enemies now work together against one exposed unit of yours: archers suppress it, flankers look for a side approach and the rest hold it in place. Their intentions are shown and update as the field changes. A protected column advances toward its goal while staying within three tiles of your commander and away from visible enemies, so screen its route.

### Policy debates

In each Contest you may table one policy motion from the policy panel (**Table motion**, one speech). After the next reply the rival offers amended terms: **Accept amendment** or **Defend original motion**, each one speech; leaving it unanswered keeps the original. The motion's costs and lasting effects apply only when you win and record the Contest, and each motion can be enacted once per campaign. The camp ledger lists enacted policies and the field opportunities you secured.

## The command campaign

New chronicles include this edition. In an older chronicle, choose **Enable command campaign** in camp when ready. Existing suspended encounters retain their rules.

Before field battles from Chapter III, the commander's table offers four operational preparations: keep the company together for free, reconnaissance for one supply, or engineers for two. A command reserve costing two supplies becomes available in Chapter IV. Each card states its benefit and trade-off. These costs combine with your company supply package and are paid at departure, so spending the last supplies affects the troops' condition. Retry restores the complete camp checkpoint and the same departure.

Open the field intelligence panel to inspect enemy doctrine, its current focus and the chapter's opportunities. A reserve held back early can still commit when threatened. Intentions can change after your orders; use the current forecast.

In a hearing, open **Evidence & interests** to inspect either documented case. Availability depends on your earlier service, choices and surviving witnesses. Inspection shows each delegate's exact stance change and spends nothing. Presenting a case spends the commander's speech, once per hearing. It can gain one interest's support while losing another's, and the rival can respond before the deadline. Your successful cases and opportunities enter the command record when you record the result.

Camp also offers **Practice completed encounters**. Practice allows weather, time and difficulty variations without replacing the active chronicle or awarding progress. Returning to camp or reloading restores your main chronicle. See the [command rules](command-campaign-v034.md) for all chapter effects and preparation values.

## What each chapter adds

| Chapter | New responsibility | Required preparation or demonstration |
| --- | --- | --- |
| I — The Oath | Your own survival | Move, Strike, Brace, Throw; complete training, then swear the oath before the field assignment. |
| II — First Blood | A wounded survivor | Assist and bring the patrol to the rally point. |
| III — Under the Eagle | Specialist recovery work | Scout and recover what the legion lost. |
| IV — Hold the Line | One commanded ally | Use Order and bring the squads through. |
| V — The Centurion | Coordinated groups | Use a Formation through the siege’s turning point. |
| VI — The Broken Standard | The legion’s morale | Rally during the retreat and bring the eagle out. |
| VII — A Legion to Lead | A legion and its council | Persuade in the council; Prepare camp and Deploy before the battle. |
| VIII — Beyond the Frontier | Negotiated passage | Choose crossing terms, carry the council, escort settlers, and secure the far bank. |
| IX — Rome’s Sword | An operational approach | Choose a Stratagem before the campaign’s decisive battle. |
| X — The Province | Relief and civil justice | Allocate six convoys, enter the judgment, win the road battle, and demonstrate Address and Rebut in the tribunal. |
| XI — The Senate | Your claim to membership | Win both Contests, using Invoke Record and Denounce. Admission follows the required backing and imperial grant. |
| XII — The Purple | The whole record | Resolve obligations, win legitimacy, and complete the chosen confrontation. |

The Chapter X convoy allocation must total six, with at least one each for river, farms, and town. River relief raises Army Loyalty; farm relief raises Public Confidence; town relief raises Political Backing. The new province has a fixed relief reserve separate from the campaign’s carried supplies.

## Meters, obligations, and the finale

Army Loyalty grows from the first chapter. All three meters—Army Loyalty, Political Backing, and Public Confidence—are visible from Chapter VII. The journal records the decisions that shaped them; the obligations ledger records what was promised, to whom, and when it is due.

In the final chapter, inspect the forecast before choosing a route. The army meter affects loyal formations and defections, political backing affects rival morale and negotiation, and public confidence affects the resistance around Rome. Higher standing preserves available routes while improving the position.

Every route includes a playable confrontation. A battle requires field victory. Defection, surrender, and negotiated approaches require holding the army together on the map; choosing their label does not award the crown. The minimum relief force and a costly backer remain available even after a difficult campaign. Costly backing creates a serious debt.

After the accession, read the epilogue and create the reign card if desired. There is no further ability or post-accession campaign. The oath is original writing, reused word for word from the beginning.

## Failure, retry, and saves

**Retry checkpoint** restores the complete encounter-start campaign and random seed. Choices made in camp before that encounter remain. Actions, damage, provisional promises, and other staged effects inside it are rolled back. A defeated political Contest can also offer a patron-funded rerun with a new debt; it still requires winning the vote.

Older active battles and Contests retain their original outcomes and Retry rules when imported. Internally, new encounters carry `combatVersion: 2` or `politicsVersion: 2`; this is automatic and does not require starting a new chronicle.

Autosave follows game actions. Look for **Chronicle saved** and any storage warning. Only one local campaign occupies the save slot: **New chronicle** replaces it after the new-game flow. Export first if you want to preserve an older campaign.

To keep or transfer progress:

1. Open **Pause → Copy a save code**.
2. Copy the code or download its text file to a place you control.
3. On the destination device, use **Restore a save code**, paste the code, and validate it.
4. Check the displayed name and chapter before confirming replacement of that device’s local campaign.

A code includes your chosen name, decisions, progression, and encounter state. The game does not upload it. An incompatible or damaged code is rejected without replacing the campaign. If a second tab has saved more recent progress, reload rather than overwriting it.

For offline play, open the **production build**. It initially keeps the application shell and opening artwork, then loads each chapter's artwork and shared 3D dependencies as you reach it. A restored later chapter requests its complete resource group without requiring Chapter I first. Suitable connections may also prefetch the next chapter. **This chapter is ready offline** does not mean that later chapters are available.

Before taking the whole campaign offline, choose **Pause → Download all twelve chapters for offline play**. This starts a complete download using your current connection. Wait for **All chapters available offline** before disconnecting. If chapter artwork is missing, use **Retry this chapter’s artwork**; an interrupted full download can be started again from Pause. The source preview does not provide the generated production offline cache.

On iPhone, add the game to the Home Screen through Safari’s Share menu. Browser storage can still be cleared, so keep a separate save code under your control. Installation and storage behavior should be checked on the device you intend to use.


## The company and recovery history

The company roll names the small group whose service follows the campaign. Successful field commits record deployments and commend safe returns. Wounds reduce readiness temporarily; the recovery counter falls as encounters are completed. Previewing, retrying or reopening a result cannot grant duplicate service. Ordinary tactical defeat never permanently deletes a named veteran. Promotions describe the chapter’s leadership record.

The Governor’s relief plan has field consequences: river convoys strengthen road-defence morale, farm convoys protect grain-store integrity, and a large town allocation improves Landholder support. Shared tenure and settler priority change the tribunal’s starting blocs. The provincial record in camp states the exact effects.

**Pause → Recover an earlier checkpoint** lists the last three distinct checkpoints or replaced chronicles. Inspect one, then explicitly restore it. The displaced save remains recoverable within that bounded history. Keep an exported save separately: clearing browser data can erase both current and recovery records.

If another tab saves, use **Continue in this tab** to review the takeover and load the latest chronicle. Export the current tab first if it has progress you want to preserve. See [save recovery](save-recovery.md) for storage limits and [the playtest kit](playtest-kit.md) for physical-device checks.
