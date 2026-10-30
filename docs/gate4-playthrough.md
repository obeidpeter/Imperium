# Gate 4: the owner's play-through

**Status: prepared, not played.** This is a checklist for the owner's play-through, release 10 of the [worlds and gameplay plan](worlds-and-gameplay-plan.md). Nothing in it has been done by a person yet. The bot's sweeps and the browser checks do not count as a play-through.

Gate 4 decides three things:

- **Whether real time becomes the default.** New Game already preselects **Real-time with pause**, but a chronicle continued or restored without a chosen mode still plays in turns. Real time becomes the default for those too only after this play-through, once what it finds is fixed.
- **Whether the turn-based mode stays.** The turns stay selectable in Settings → Controls for 0.40.0. Whether to retire them afterwards is the owner's decision.
- **Release 0.40.0**, with the changelog, README and guide, and the Performance-check files below as device evidence.

The [playtest kit](playtest-kit.md) is for a first-time player watched by an observer. This checklist is for the owner, who knows the game, playing it through.

## Before you start

1. Use the live site, or build and serve it yourself: `npm run build`, then `npm run preview`. To play on a phone on the same network, use `HOST=0.0.0.0 npm run preview` and open the address it prints.
2. Write down the build: the commit you built (`git log -1 --format=%h`) or the date you opened the live site.
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
| I · The Oath | Camp: the legionary base at Novae | Walk, talk to Varro and Lucan, use the drill field, choose the javelin decision. The oath ceremony in its five story beats. | |
| | The drill yard (the drill) | The guided opening's lessons: move, pause, slow time, a target, a queued action, resume. | |
| | Fire on the boundary road | The first real fight. | |
| II · First Blood | Camp: the march camp on the causeway | Lucan's decision. | |
| | The broken causeway (rescue) | Reaching and bringing back the wounded man. | |
| | Torches in the reeds (defend) | Holding against the reeds. | |
| III · Under the Eagle | Camp: the camp below the road station | Standing orders for your companions. | |
| | The silent station (recover) | | |
| | Names on the road (escort) | | |
| IV · Hold the Line | Camp: the frontier ford court | Squads and their orders appear. An errand or two, the trader. | |
| | The gate with the broken drum (the escalade) | Throwing down the ladders; the gate's integrity. | |
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
| VIII · Beyond the Frontier | Camp: the Danube ferry assembly | Aelia's demand; the ferry loads. | |
| | Words above the ford (Contest) | | |
| | The last boats (escort) | | |
| | The far bank (the crossing under fire) | Forcing the ford under the volleys, then holding the landing. | |
| IX · Rome's Sword | Camp: the surrender court on campaign | The terms of surrender. | |
| | The turning cavalry (the feigned retreat) | Your horse's charge and feigned retreat; drawing the armoured horse onto the line. | |
| | The road to the keys | | |
| X · The Province | Camp: the governor's relief courtyard | The convoys' allocation and the land judgment. | |
| | Grain under guard (the relief convoy) | The road you chose in camp. | |
| | The governor's tribunal (Contest) | | |
| XI · The Senate | Camp: the service-record portico at Rome | Severianus's offer. | |
| | The accounts of a soldier (Contest, in the Curia) | | |
| | The petition for the broad stripe (Contest, in the Curia) | | |
| XII · The Purple | Camp: the loyal standards court | Your terms before the confrontation. | |
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
| Practice a battle | In a camp, Camp services → **Practice your completed encounters** (or the practice post on the drill field). A battle opens on the live field. Change the weather with the War-Room Mutators, play it, then **Return to chronicle**: the camp should be exactly as you left it. | |
| Practice a Contest | A Contest from Chapter VII on opens in the chamber. | |
| F2 in practice | Should say practice is not saved. | |
| The standalone skirmish | From the title screen, **Try a standalone skirmish** opens the real-time arena. | |
| Settings → Controls | Switching to Turn-based in camp, playing one battle, and switching back. | |
| Keys | Remapping one key in Settings → Controls, and using it in a fight. | |
| Saves | A quick save (F2), a named save, Load, and a save code exported and restored. | |
| Help | **?** in a fight, a chamber and a camp. Does the help match the game? | |

## Accessibility (the 0.40 brief's manual checks)

| Check | What to try | Notes |
| --- | --- | --- |
| Keyboard only | Chapters I–II, the standing orders of III, a formation in V, the deployment of VII, a Contest and a kit change, without the mouse. | |
| Screen reader | NVDA or VoiceOver: a battle's actions and a Contest's vote are read out, and nothing traps the focus. | |
| Colour | High contrast (Settings → Readability) and the blocs without colour. | |
| Text size | Game text at 200%: nothing hidden or cut off. | |
| Reduced motion | The ceremonies keep their first view; the scene holds still. | |

## On a phone and a laptop

On each device, in a large battle (Chapter VII or XII):

1. Menu → Settings → Graphics → **Performance diagnostics** → **Run performance check**.
2. Save the results file and send it. It records the frame times and the simulation's tick on that device, and the tiers are tuned from it.
3. Play a few minutes by touch on the phone, and note anything hard to reach or read.

| Device | Model, system and browser | File sent | Notes |
| --- | --- | --- | --- |
| Phone | | | |
| Laptop | | | |

## After the play-through

Send the filled checklist, the two files and your decision on the turn-based mode:

- **Keep the turns** as an option in Settings → Controls; or
- **Retire the turns** after 0.40.0. Saves begun in turns would then continue in real time from their encounter checkpoints, as chronicles from before 0.40 already do.

Then:

1. What the play-through finds is fixed, blocking problems first.
2. Real time becomes the default for a chronicle with no chosen mode.
3. The changelog, README and guide are updated, the device files are recorded as evidence, and 0.40.0 is released.
