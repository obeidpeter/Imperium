# Sacramentum visual system

## Direction

The game is presented as a restored military chronicle: painted historical scenes, faces with consistent lighting and costume, restrained fresco framing, and quiet surfaces for decisions. Richness belongs to the world and the milestones in a life. Controls stay familiar as that life changes.

The October 2026 aesthetic brief authorizes locally integrated original and AI-generated illustration alongside procedural graphics. This supersedes the earlier code-only art rule, while retaining the static architecture, third-century equipment brief, save behaviour, game rules, and download constraints.

In the captured baseline, the phone Contest placed a large chapter heading, location, progression strip, and meters ahead of the board. Small labels and repeating outlined panels competed with the playable scene. The camp image and portrait were also simpler and flatter than the intended historical illustration. Those are observations of the baseline captures. The painted treatment, lead-seal motif, and editorial grouping are the chosen artistic response rather than newly discovered gameplay requirements.

## Palette and meaning

| Token | Value | Purpose |
| --- | --- | --- |
| `--paper` | `#f4ead5` | Warm ivory page and main interface ground |
| `--pale` | `#fcf6e9` | Light controls and text on dark backgrounds |
| `--plaster` | `#e9dfca` | Quiet material variation |
| `--ink` | `#292b26` | Primary text |
| `--muted` | `#626357` | Secondary text that still meets normal-text contrast |
| `--red` | `#6b2428` | Pompeian red, principal actions, chapter identity |
| `--bronze` | `#8a7049` | Decorative edges; not the default small-text colour |
| `--bronze-text` | `#705533` | Darker bronze for readable labels |
| `--dark` | `#172a27` | Forest-dark battlefield headings and ceremonial ground |
| `--olive` | `#485b45` | Completed service, relief, and meter fills |
| `--purple` | `#493049` | Earned imperial ceremony only |

Gameplay information has separate tokens: selection `#23646c`, movement `#46694f`, attack `#922f32`, danger `#8a292c`, ally `#284f59`, neutral `#705d39`, and objective `#76521b`. These are a shared design vocabulary, not permission to recolour mechanics arbitrarily. The Canvas renderer also uses shapes, facing, outlines, flags, labels, and health/Resolve marks. DOM controls retain a selected border, underline, and pressed state in addition to colour. The renderer's own palette is maintained at its existing drawing boundary.

`data-stage="imperial"` changes the ceremonial ground after the earned accession. Ordinary buttons, movement meanings, and interface placement do not change with rank. Red is available from the beginning; imperial purple is not a general accent.

## Typography and spacing

Headings and reading passages use the installed Palatino/Georgia serif stack. Buttons, labels, statistics, and system messages use the system sans-serif stack. No web font or external font request is added. Capitals are reserved for short chapter labels, inscriptions, and ceremonial text.

- Body text starts at 16 px, interface text at 15 px, and essential labels at 14 px.
- Dialogue starts at 19 px with a 1.75 line height and a bounded reading measure.
- Heading sizes respond to viewport width. The existing text-size preference multiplies text sizes through shared variables.
- Buttons are at least 44 px high; primary title actions are at least 52 px high. Tactical actions are 56–58 px high before text enlargement.
- Layout uses flexible columns, `minmax(0, 1fr)`, wrapping controls, and long-word wrapping. Reading and action controls are not fixed-height boxes.
- Large-scale spacing uses the shared gutter and a small set of section, paragraph, and control gaps. Borders separate subjects; they do not frame every paragraph.

Native text remains real DOM text. Artwork does not contain essential commands, statistics, dialogue, or unlock instructions. The target selector and named unit buttons preserve the alternative to map targeting.

## Materials and components

The page has a flat ivory ground. Plaster, tesserae, cloth, armour, and atmosphere belong to the scene and illustration. Behind text, only gentle tonal differences and occasional single bronze edges remain. No repeating texture is placed under body copy.

**Buttons and choices.** Ordinary controls are pale; the main action is red. Choice blocks use a single bronze leading edge, a serif decision title, readable explanatory copy, and a separate consequence line. Selected actions use teal and a marked lower edge. Focus has a three-pixel outline and a light separator. Disabled controls retain legible text and their native disabled behaviour.

**Dialogue and identity.** A consistent portrait accompanies a named speaker. Narration and oath passages use a lead-coloured stamped `S` seal. This is a modern emblem recalling the reconstructed identity seal, not a newly asserted archaeological depiction. Portrait backgrounds, crop, costume, and directional light stay coherent across character stages.

**Camp and character.** The scene establishes location; the prose follows as an open chronicle page. The profile has a large portrait and compact service information. The character modal pairs the portrait with equipment and the next earned appointment. Equipment is grouped as a readable inventory, not a stat spreadsheet.

**Battles and Contests.** The Canvas board is the largest element. A dark title band identifies the encounter and turn. Unit chips, action choices, target preview, Confirm, and End turn remain separate, in-flow controls. Feedback appears in an inline band after the unit list rather than covering a selected tile. The document order places unit selection, feedback, action controls, and turn controls before the mission detail and dispatches; phone layout follows that same order so keyboard navigation matches the visible sequence. Speaker status, vote support, and deadline remain text as well as marks on the board.

**Maps, journals, and obligations.** Geography establishes the campaign's extent; chapter entries retain location, status, objective, and plain-language locks. The journal uses numbered dispatches and open sections. The ledger places the creditor, status, promise, due chapter, and available settlement actions together. No locked chapter is made to look like an available command.

**Ceremony and endings.** Promotions use a brief, dark-red composition, a restrained internal rule, the new portrait, and the earned title. Accession introduces purple, the same seal, and the returning oath. Epilogue passages use a reading layout rather than a wall of repeated cards. Victory and defeat have distinct tones and plainly labelled recovery actions.

**System states.** Settings, export/import, offline notices, errors, and save feedback share the same type and materials. Modal headings stay available while content scrolls. Errors use wording, a leading rule, and a warm error ground. Tactical notifications stay inline; short non-tactical notices occupy a calm full-width band below navigation and do not take keyboard focus. Reign-card previews are centred and limited to 28 rem while their export retains its full resolution.

## Art and character specification

Use cinematic historical illustration with soft directional light from the upper left, warm pigment, muted distant planes, natural proportions, and restrained edge wear. Texture should suggest pigment and plaster without obscuring eyes, mouths, equipment silhouettes, or interactive boundaries.

The protagonist remains the same person: recognisable facial structure, increasingly weathered skin, greying hair, and the established equipment progression. The local portrait library covers recruit, miles, centurion, prefect, governor, senator, and emperor presentations. Rank mapping stays at the existing UI boundary. Recurring characters keep individual face, costume, and lighting continuity.

Third-century visual references remain mail or scale, long-sleeved tunics, trousers, cloaks, large oval shields, spathae, spears, and javelins. Do not introduce fantasy plate, a uniform first-century film silhouette, or imperial purple before it is earned. Existing historical notes disclose the game's reconstructions and simplifications.

The title painting is `assets/scenes/frontier-oath.webp`. The scene family includes the Danube, marsh, eastern fort, river crossing, province, and Rome. Full portraits use local `assets/portraits/` files. The asset manifest records provenance, generation instructions, rights, and export settings separately; filenames and byte sizes there are authoritative. Portraits can carry detail; small battlefield figures remain purposefully simplified and are composed with the procedural terrain, overlays, and facing indicators.

## Responsive behaviour

Desktop gives the painting or playable board most of the width, with a narrow supporting column. Below 900 px, the battlefield occupies a full row. Below 700 px, camp, tactical controls, character details, and epilogue reflow into a single reading path. Controls never float over the board.

During a phone encounter, the long chapter metadata, decorative heading line, and progression strip are suppressed; the short chapter title, current encounter title, meters, turn/deadline, and the Campaign navigation remain. This reduces the space before the board without hiding mission or capability requirements. Outside combat, the full chapter framing remains.

The progression strip and unit list can scroll horizontally within their own bounds. They do not widen the document. The campaign map and target selector offer alternate routes. At 360 px, convoy allocation reflows into labelled rows. Landscape uses a shallower battlefield ratio. Text enlargement wraps controls and content instead of clipping them.

These are implementation rules. The accompanying verification report records the specific browser sizes and enlargement settings actually exercised; this document does not claim physical-device testing.

## Measured text contrast

Calculated from the final CSS colour values using sRGB linearisation and the WCAG relative-luminance ratio `(lighter + 0.05) / (darker + 0.05)`. These are solid-colour pair checks, not a full accessibility certification or a measurement of text over every image.

| Text / ground | Colours | Ratio |
| --- | --- | --- |
| Body / paper | `#292b26` / `#f4ead5` | **11.97:1** |
| Secondary / paper | `#626357` / `#f4ead5` | **5.11:1** |
| Primary button | `#fcf6e9` / `#6b2428` | **10.22:1** |
| Primary hover | `#fcf6e9` / `#813337` | **7.92:1** |
| Disabled button | `#626257` / `#e6e0d1` | **4.68:1** |
| Battlefield heading | `#fcf6e9` / `#172a27` | **13.96:1** |
| Battlefield secondary label | `#d6c7a8` / `#172a27` | **9.02:1** |
| Selected action | `#fcf6e9` / `#23646c` | **6.27:1** |
| Selected unit | `#172a27` / `#dce8e4` | **11.96:1** |
| Error copy | `#292b26` / `#f1ded5` | **11.00:1** |
| Dark bronze label | `#705533` / `#f4ead5` | **5.79:1** |
| Supporting vote | `#2d4932` / `#e3e8d8` | **7.96:1** |
| Opposing vote | `#702f30` / `#f1ded5` | **7.55:1** |

All listed pairs exceed 4.5:1, including the disabled label even though disabled controls are exempt from that normal-text requirement. Decorative bronze is intentionally distinct from the darker bronze used for small text. Images use a darkened caption area; their composition still requires visual review.

## Motion and maintenance

Input transitions use 140 ms and the shared easing curve; short scene reveals use 280 ms and at most five pixels of movement. No CSS animation consumes gameplay randomness or changes game state. `data-reduced="true"` and the system reduced-motion preference remove nonessential animation and transitions. Detailed battle feedback belongs in the UI motion module and must remain separate from rules and saved state.

`src/ui/styles.css` is organised into named cascade layers: tokens, base, shell, components, scenes, overlays, states, responsive, and motion. Add a component rule in its owning layer, then a responsive exception in the responsive layer. Do not append competing global overrides. Semantic hooks include `.character-layout`, `.equipment-list`, `.journal-entry`, `.chronicle-list`, `.alliance-entry`, `.status-pill`, `.action-feedback`, `.narrator-seal`, and `.oath-seal`.

All assets are local. No font CDN, runtime generation call, paid service, or new rendering engine is introduced by the visual system. The existing compressed first-load limit remains a build constraint; actual before/after download measurements, asset failures, and gameplay regression results belong in the upgrade's verification report.
