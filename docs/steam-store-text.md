# Imperium's Steam store page: the draft text

The store page's text for the owner to edit and enter in Steamworks ([the Steam plan](steam-plan.md), S4). It is drawn from [the player guide](player-guide-0.40.md) and the game's own data. Its companion is [the AI-content disclosure](steam-ai-disclosure.md).

- **Steam's rules** quoted here come from reports, not from Valve: the session that drafted this could not reach Valve's partner site. Check them in Steamworks.
- **The facts** match the game on 4 November 2026, before 0.40.0 and the owner's Gate 4 play-through. Revisit the draft after both.
- **The numbers** in it come from the game's data, and the short description must fit Steam's limit: `tests/steam-store.test.mjs` checks both, so a change to the campaign that makes the draft wrong fails a test.

## The name

**Imperium: From Recruit to Emperor**, the installed game's name, as a working title. The name is the owner's to choose: see [the checklist](steam-release.md#now-steams-waiting-times-run-while-the-app-is-built) on the names already on Steam and a trademark search.

## Short description

Plain text, at most 300 characters (reported as the editor's limit; Steam removes formatting here):

```text
A real-time tactical chronicle of Rome’s third-century crisis. Rise from a recruit on the Danube in AD 250 to the purple in 275: fight battles you can pause at any moment, lead companions, squads and a legion, win over the Senate, and answer for every promise you make.
```

## About This Game

In Steam's own markup, to paste as it is. It has no links: since September 2024 Steam allows none in this section or the short description, and none to other games (a website belongs under Basic Info).

```text
[h2]Begin as a soldier. Rise to emperor.[/h2]
AD 250. Goths cross the Danube, plague empties the road stations and emperors fall one after another. You are a recruit at a legionary base on the frontier, with authority over nothing but your own sword.

Over twelve chapters and a quarter of a century, your service takes you from the drill yard to the eastern frontier, a governor's tribunal and the Senate in Rome. When Aurelian falls in 275, the armies and the Senate must decide whose name goes on the decree.

[h2]Play your own soldier. Pause to think.[/h2]
Battles run in real time, in the tradition of the classic isometric role-playing games, and stop whenever you pause. Every command can be given while the world is stopped: point at an enemy to read the forecast, choose a technique, set your companions' standing orders, then let the fight run on. Nothing asks for quick reactions.

[h2]From one sword to a legion[/h2]
Each rank brings a new responsibility. Carry a wounded comrade out of the marshes. Recover what the legion lost with your first companions. Command a squad on the wall, hold a formation through a siege, rally a beaten army and bring its eagle out. Then deploy a legion, settle the terms of a river crossing, choose the stratagem of a campaign, govern a province and win a seat in the Senate.

[h2]On the field and in the chamber[/h2]
19 battles and 6 political Contests. In the field, read the ground, the weather, morale and the enemy's intentions; hold gates, ramparts, towers and bridges; send cavalry to charge or to feign retreat. In the chamber the water clock measures the hours: walk the floor, learn what each bloc wants, make promises, then rise to Address, Rebut, Denounce or Invoke your Record.

[h2]A camp to walk in every chapter[/h2]
Talk to your comrades, train with the camp's instructors, equip yourself from the quartermaster and the armourer, open the camp's chests and take up its errands. Then make the chapter's decision at the commander's table: a choice that follows you to the end.

[h2]Every promise falls due[/h2]
Your decisions move the army's loyalty, public confidence and your political backing, and a ledger keeps every promise and when it falls due. In the final chapter your whole record decides how strong your position is and which roads to the purple stay open, from a negotiated settlement to battle before Aurelian's new walls.

[h2]Features[/h2]
[list]
[*]12 chapters and 25 playable encounters, from AD 250 to 276
[*]Real time with pause, slow time and one-round stepping
[*]Three trainings, eight attributes, trainers, seven decorations, nine titles and over a hundred pieces of kit
[*]Companions with standing orders; squads, formations, cavalry and deployment
[*]A fixed isometric 3D view, or a clear 2D tactical board with the same rules
[*]Story, Standard and Veteran difficulty, and optional Iron discipline
[*]35 Steam achievements
[*]Full keyboard play, screen-reader announcements, text up to 200%, high contrast, reduced motion and remappable keys
[*]Plays offline: the game itself never connects to the internet
[/list]

[h2]History and fiction[/h2]
The setting follows the crisis of the third century. Your soldier, his companions and his career are fiction. Public history runs as recorded until Aurelian's death in 275; the succession then takes the course your chronicle gives it. Historical notes in the game explain each adaptation.
```

**To check before pasting:**
- **Turn-based play.** New Game still offers it alongside real time. If it ships, add a line to the features: `[*]Or play every encounter turn by turn`. If Gate 4 retires it, leave the text as it is.
- **The 35 achievements** count only once they are entered in Steamworks ([the list](steam-achievements.md)).
- **"Plays offline"** is what the desktop check shows: it fails if the game makes any request outside its own files. Steam itself still runs beside the game.

## Languages

English only:

| Language | Interface | Full audio | Subtitles |
| --- | --- | --- | --- |
| English | yes | no | yes |

The four voiced briefings are in English, and their text is always on screen. Nothing else is voiced, so "Full audio" stays unticked.

## Genres and tags

- **Genres:** Strategy and RPG; Indie if it applies to the owner.
- **Tags** to choose from Steam's own list:
  - Real-Time with Pause, Tactical RPG, Party-Based RPG, Strategy, RPG;
  - Historical, Rome, Military, War, Political;
  - Choices Matter, Story Rich, Isometric, Singleplayer;
  - Turn-Based Tactics, only if turn-based play ships.

## Steam features and controls

- **Features to tick:** Single-player, Steam Achievements, and Steam Cloud once Auto-Cloud is on ([the checklist](steam-release.md#steam-features-s3-once-you-have-the-app-id)).
- **Controls:** keyboard and mouse. The game has no controller support, so the store must not claim any, and Steam Deck "Verified" needs gamepad controls ([the plan's risks](steam-plan.md#risks)).

## System requirements (Windows)

| | Minimum | Measured or known |
| --- | --- | --- |
| OS | Windows 10 or 11, 64-bit | The app is a 64-bit build of Electron 45, which supports Windows 10 and later |
| Processor | to fill in after the owner's device check | — |
| Memory | to fill in after the owner's device check | — |
| Graphics | DirectX 11 class, to confirm on the device | The 3D views use WebGL 2 through Chromium; without WebGL the game falls back to its 2D view with the same rules |
| Storage | 500 MB available space | The packaged Linux app measures 344 MB, of which the game's own files are 63 MB. The Windows app folder from CI is a 203 MB zip; check its unpacked size on the PC |

Nothing about speed has been measured on a real PC: the minimum and recommended processor, memory and graphics need the owner's device check on a Steam beta branch. The Performance quality setting is the one to try on the minimum.

## The content survey, beyond AI

The AI section is drafted in [steam-ai-disclosure.md](steam-ai-disclosure.md). For the questions on mature content, what the game shows:

- **Violence:** battles with swords, spears, javelins and arrows. Soldiers are struck and fall, and the fallen stay on the field. No blood, gore or dismemberment is shown.
  - Checked on 4 November: the eight story paintings and the eleven atlases of 2D figures and their actions, looked at by eye. The game's code draws no blood.
  - Not checked by eye: the 22 portraits and the 3D models.
- **Themes:** war, a plague, deaths in battle, and the politics of a succession after an emperor's assassination.
- **Wine:** a wine-seller and a sutler sell it in camp, and the kit includes a wine skin.
- **No** sexual content, nudity, gambling or purchases inside the game.

Choosing between Steam's levels of violence is the owner's answer.

## Not on the store page

- **The free web demo** stays off the description: the rules above forbid an external link there. If the owner wants a demo on Steam, the demo edition can be packaged as a Steam demo app later; that would be new work.
- **Store art rules** (for S4's capsules): since September 2024 Steam has banned review scores, award names and discount text from graphical assets.
