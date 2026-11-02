# Gate 4: the owner's play-through

**Status: ready to play, not played.** This is a checklist for the owner's play-through, release 10 of the [worlds and gameplay plan](worlds-and-gameplay-plan.md). Releases 11–14 are merged, so everything it covers is in the game. Nothing in it has been done by a person yet. The bot's sweeps and the browser checks do not count as a play-through.

Updated on 1 November for [#44](https://github.com/obeidpeter/Imperium/pull/44): its order review, errand tracking and battle debriefs have rows below, and the Performance check now asks for its tab to stay in front.

Updated on 2 November for releases 11–14 ([#46](https://github.com/obeidpeter/Imperium/pull/46) to [#54](https://github.com/obeidpeter/Imperium/pull/54)): chests, the armourer, champions, the full-screen world, the camera, the inventory, leaving camp on foot and the field after a victory have rows under [Practice, the skirmish and the settings](#practice-the-skirmish-and-the-settings), and the text-size and phone rows include the world that never scrolls and the bar's **Panels** button.

Gate 4 decides three things:

- **Whether real time becomes the default.** New Game already preselects **Real-time with pause**, but a chronicle continued or restored without a chosen mode still plays in turns. Real time becomes the default for those too only after this play-through, once what it finds is fixed.
- **Whether the turn-based mode stays.** The turns stay selectable in Settings → Controls for 0.40.0. Whether to retire them afterwards is the owner's decision.
- **Release 0.40.0**, with the changelog, README and guide, and the Performance-check files below as device evidence.

The [playtest kit](playtest-kit.md) is for a first-time player watched by an observer. This checklist is for the owner, who knows the game, playing it through.

## Before you start

1. Use the live site, or build and serve it yourself: `npm run build`, then `npm run preview`. The live site is published by hand ([Replit static deployment](../README.md#replit-static-deployment)), so republish it from `main` first. To play on a phone on the same network, use `HOST=0.0.0.0 npm run preview` and open the address it prints.
2. Write down the build: the commit you built (`git log -1 --format=%h`) or the date you opened the live site. Use `41652bd` (2 November) or later, which has releases 11–14 and the two fixes their checks found after the merge.
3. Begin a **New Game** with **Real-time with pause**:
   - the first time on **Standard**;
   - the second time on **Story**, ideally played by someone less experienced, as the 0.40 brief asks.
4. Keep the defaults unless a row asks otherwise. Settings → Readability → **Learning tips** shows the opening's lessons.
5. Note your active minutes for each chapter, without breaks. The target for the whole campaign is 90–150 minutes.

## What to note

For every row, write one line in the **Notes** column:

- **Felt:** too easy, about right or too hard.
- **Clear:** whether you knew what to do and why you won or lost.
- **Problems:** what you did, what you expected, and what happened. The chapter and the battle's round or the chamber's hour help find it.
- **Minutes** for the chapter.

Mark anything that stops play, loses progress or saves the wrong thing as **blocking**. Everything else is fixed in order of how much it gets in the way.

## Chapter by chapter

| Chapter | Where | What to try | Notes |
| --- | --- | --- | --- |
| I · The Oath | Camp: the legionary base at Novae | Walk, talk to Varro and Lucan, use the drill field, choose the javelin decision. Take Varro's errand, **Track** it in Mission orders (**Q**) and follow its step above the camp. The oath ceremony in its five story beats. | |
| | The drill yard (the drill) | The guided opening's lessons: move, pause, slow time, a target, a queued action, resume. | |
| | Fire on the boundary road | The first real fight. | |
| II · First Blood | Camp: the march camp on the causeway | Lucan's decision. | |
| | The broken causeway (rescue) | Reaching and bringing back the wounded man. | |
| | Torches in the reeds (defend) | Holding against the reeds. | |
| III · Under the Eagle | Camp: the camp below the road station | Standing orders for your companions. | |
| | The silent station (recover) | | |
| | Names on the road (escort) | | |
| IV · Hold the Line | Camp: the frontier ford court | Squads and their orders appear. An errand or two, the trader. | |
| | The gate with the broken drum (the escalade) | Throwing down the ladders; the gate's integrity. Pause and open **Review orders**: cancel one squad's queued order and replace another's. | |
| | Across the wall walk (escort) | | |
| V · The Centurion | Camp: the Euphrates staging courtyard | The engineer's preparation; the countermine or the families. | |
| | The cracked tower (siege) | The countermine against the siege works. | |
| | The red river gate (the sortie) | Out by the postern to burn the ram, then back to hold the gate. The bot loses this one most on Veteran: is it fair? | |
| VI · The Broken Standard | Camp: the eagle's retreat halt | | |
| | The empty wells (the rearguard) | Falling back line by line. | |
| | A pole bound with leather (escort) | | |
| VII · A Legion to Lead | Camp: the council camp before Milan | The plot against Gallienus. | |
| | The officers' table (Contest) | The chamber: walking, talking, asking a member's interest, Persuade, yielding the hour, the rivals' hour. | |
| | A legion at your word | Deployment before the battle, then the legion. | |
| VIII · Beyond the Frontier | Camp: the Danube ferry assembly | Aelia's demand; the ferry loads. Her seed-jar errand, tracked from collecting the jar to returning it. Aelia now blinks and changes expression. | |
| | Words above the ford (Contest) | | |
| | The last boats (escort) | | |
| | The far bank (the crossing under fire) | Forcing the ford under the volleys, then holding the landing. If you repair the bridge, demolish it again: two stages, or one with an engineer beside you. | |
| IX · Rome's Sword | Camp: the surrender court on campaign | The terms of surrender. | |
| | The turning cavalry (the feigned retreat) | Your horse's charge and feigned retreat; drawing the armoured horse onto the line. The order card shows both, under your keys. | |
| | The road to the keys | | |
| X · The Province | Camp: the governor's relief courtyard | The convoys' allocation and the land judgment. | |
| | Grain under guard (the relief convoy) | The road you chose in camp. | |
| | The governor's tribunal (Contest) | | |
| XI · The Senate | Camp: the service-record portico at Rome | Severianus's offer. | |
| | The accounts of a soldier (Contest, in the Curia) | | |
| | The petition for the broad stripe (Contest, in the Curia) | | |
| XII · The Purple | Camp: the loyal standards court | Your terms before the confrontation. Severianus stands in the court only if he backs you. | |
| | Whose name on the decree? (Contest, in the Curia) | | |
| | The road to the purple (the finale) | Your route, before Aurelian's walls. Then the accession in its story beats, and the ending: does the oath come back? | |

## The finale's routes

The finale has five routes: **the backer**, **the battle**, **defection**, **settlement** and **surrender**. Your campaign opens some of them, depending on your standing. The others can be played in **Practice** (see below), whose War-Room Mutators include the approach. For each route:

| Route | Played in | Felt | Clear | Problems |
| --- | --- | --- | --- | --- |
| The backer | campaign / practice | | | |
| The battle | campaign / practice | | | |
| Defection | campaign / practice | | | |
| Settlement | campaign / practice | | | |
| Surrender | campaign / practice | | | |

In the bot's sweeps the backer's and the battle's routes last 8 of the finale's 16 rounds on Standard and Veteran (10 on Story), and defection, settlement and surrender two to five. The bot's campaigns never open settlement or surrender without their standing raised. Their balance needs a person's view.

## Practice, the skirmish and the settings

| Check | What to try | Notes |
| --- | --- | --- |
| Practice a battle | In a camp, **Menu → Camp** → **Practice your completed encounters** (or the practice post on the drill field). A battle opens on the live field. Change the weather with the War-Room Mutators, play it, then **Return to chronicle**: the camp should be exactly as you left it. | |
| Practice a Contest | A Contest from Chapter VII on opens in the chamber. | |
| F2 in practice | Should say practice is not saved. | |
| The standalone skirmish | From the title screen, **Try a standalone skirmish** opens the real-time arena. | |
| Settings → Controls | Switching to Turn-based in camp, playing one battle, and switching back. | |
| Keys | Remapping one key in Settings → Controls, and using it in a fight. | |
| Saves | A quick save (F2), a named save, Load, and a save code exported and restored. | |
| Help | **?** in a fight, a chamber and a camp. Does the help match the game? | |
| Review orders | Pause in a squad battle and choose **Review orders** beside Resume. Each squad shows its order, destination, Command and delay. Try **Cancel unapplied**, **Replace…** and **Hold · 1 Command**, then resume. Could you tell what each squad would do? | |
| Errand tracking | In Mission orders (**Q**), **Track** one errand. Its next step shows above the camp. Use its button to go there, reload the page, then **Stop tracking**. Did the step change by itself when the task moved on? | |
| After a battle | The result's **Key recorded moments**, and after a defeat **Advice for retrying**. Did they help you choose what to do differently? | |
| Chests in camp (release 11) | In two or three camps, open every chest and locker. Find a lock's key in another chest, or force one. Walk close to find a hidden cache. Did each chest say why you may open it? Could you see which were open and which empty? | |
| The armourer (release 11) | Talk to Bassus beside the quartermaster in two camps. Buy a fine piece, wear it, and check **Against squads** in the character panel (**C**). Was it worth its price? | |
| Battlefield containers (release 11) | In a battle with a locked strongbox, take its key from the field, open it during the fight, then **Search the field** after the victory. Try **Retry** after taking something: it should be back. | |
| Champions (release 11) | In a squad battle from Chapter IV, the enemy's champion comes for your soldier. Did he feel like a fair test of your kit, too easy, or too hard? Take what he carries. | |
| The full-screen world (release 12) | In a camp, a battle and a Contest, the world fills the window and nothing scrolls. Use the bar's buttons for the panels (**Kit**, **Character**, **Journal**, **Orders**, **Chronicle**, **Map**, **Company**, **Decorations**, **Help**). Open help, the battle log, **All actions** and **Review orders** over the world, and close each with **Esc**. Was anything you needed hard to find? | |
| The camera (release 12) | In a camp, a battle and a Contest, in 3D: zoom out to the whole field with the wheel and with **Z**; drag with the middle button (two fingers on a phone) to look further, then move or press **F** to spring back; hold **H** to glance at the horizon; press **X** near a building. Did you miss turning the view? Was your soldier ever hidden? | |
| The inventory (release 13) | Open **Kit** (**I**) in camp. Drag a piece onto your soldier to wear it, move one within the pack, take one off into a chosen place and leave one on the ground; then do the same with the keyboard (**Move in pack**, the arrows, **Enter**, **Escape**). Trade with the armourer and open a chest by dragging into and out of the pack, and search a fallen man in a battle. On the phone, use the tabs. Was anything hard to find, or did a drop land where you did not expect? | |
| Leaving camp on foot (release 14) | In each camp, find the waymarker that points to the next encounter (**The road out**, **The drill yard**, **The river gate**, or a principia or Curia door) and walk to it. Before the chapter's decision or a needed preparation, the gate sentry says what is missing and nothing changes; once all is ready, a card names where you are going. Check that talking to the gate and **Menu → Camp → March out** still leave the same way, and the sign's place in 3D and 2D. | |
| The field after a victory (release 14) | After a won battle, choose **Walk the field**. Check that the enemy still standing have gone and nothing fights, then search one of the fallen and a chest (a locked one with its key, or by force). Take **The road to camp** with something left: it names what is left and nothing changes; take it again and the result is recorded once, and you are back in camp (after a chapter's last battle, at the promotion). Check **Result** and **Continue** in the strip, the road's sign in 3D and 2D, that a reload shows the result again with what you took, and **The road back** in Practice. | |
| Walking to places (release 12) | In two camps, use the people and services by walking to them. Then open **Menu → Camp**, choose a person, and **March out** from the list. Did you miss the old list beside the scene? | |
| Kit and difficulty (release 11) | Over the play-through: did better kit make battles feel easier? Was a soldier in only the issued kit able to keep up? The bot wins nearly everything with any kit; your view sets the final feel. | |

## Accessibility (the 0.40 brief's manual checks)

| Check | What to try | Notes |
| --- | --- | --- |
| Keyboard only | Chapters I–II, the standing orders of III, a formation in V, the deployment of VII, a Contest and a kit change, without the mouse. | |
| Screen reader | NVDA or VoiceOver: a battle's actions and a Contest's vote are read out, and nothing traps the focus. | |
| Colour | High contrast (Settings → Readability) and the blocs without colour. | |
| Text size | Game text at 200%: nothing hidden or cut off, the order review, the camp list and the tracked errand included. The world itself never scrolls (release 12). | |
| Reduced motion | The ceremonies keep their first view; the scene holds still. | |

## On a phone and a laptop

On each device, in a large battle (Chapter VII or XII):

1. Menu → Settings → Graphics → **Performance diagnostics** → **Run performance check**. Keep the game's tab in front until it finishes. It builds, warms up and measures each quality, then measures yours twice more: one to three minutes in all. Switching tabs or locking the phone stops it as interrupted: run it again.
2. Save the results file and send it. It records the frame times, the graphics chip and the simulation's tick on that device, and the tiers are tuned from it. A check that reports software rendering or an unidentified graphics chip cannot recommend a quality; send it anyway.
3. Play a few minutes by touch on the phone, and note anything hard to reach or read: the **Panels** button, the actions along the bar and the camp list (release 12) included.

| Device | Model, system and browser | File sent | Notes |
| --- | --- | --- | --- |
| Phone | | | |
| Laptop | | | |

Automated runs on the owner's Windows computer on 31 October (Intel Graphics through ANGLE and Direct3D 11) are summarised in [Windows observations](command-camp-refinement.md#windows-observations). There the check recommended Performance, and Balanced and High missed their 60 fps target. They are not a play-through. Their report files (`tests/visual-results/windows-device-headed/` and `tests/visual-results/performance-check-native/`) stay on that computer, as git ignores those folders: send them with the two files, or commit them under `docs/evidence/`, so 0.40.0 can cite them.

## After the play-through

Send the filled checklist, the two files and your decision on the turn-based mode:

- **Keep the turns** as an option in Settings → Controls; or
- **Retire the turns** after 0.40.0. Saves begun in turns would then continue in real time from their encounter checkpoints, as chronicles from before 0.40 already do.

Then:

1. What the play-through finds is fixed, blocking problems first.
2. Real time becomes the default for a chronicle with no chosen mode.
3. The changelog, README and guide are updated, the device files are recorded as evidence, and 0.40.0 is released.
