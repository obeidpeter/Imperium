# Sacramentum interface design system

The interface presents a cinematic Roman opening and a quieter, readable chronicle once play begins. Warm plaster and ivory support reading; Pompeian red identifies the main action; charcoal anchors navigation and ceremony. Bronze supplies small labels and rules rather than outlining every surface. Imperial purple is reserved for late-career ceremony. The battlefield’s semantic markers remain consistent with the separate graphics system.

## Shared foundation

The palette and sizing contract is maintained in `src/ui/styles.css`. `src/ui/interface.css` supplies the shared website, navigation, panel, and control treatment; `src/ui/cinematic.css` supplies the established narrative and graphics presentation. These files load in that order: base, cinematic, then interface. Components use shared tokens rather than adding a separate font package or UI framework.

| Role | Value | Use |
| --- | --- | --- |
| Warm paper | `#f3eddf` | Page and reading ground |
| Pale ivory | `#fffaf0` | Raised reading areas and light text on primary actions |
| Charcoal | `#242724` | Header and dark structural areas |
| Pompeian red | `#742b30` | Primary action and selected ceremonial emphasis |
| Weathered bronze | `#8a7049` | Rules and short labels; not body copy on pale backgrounds |
| Corner treatment | `2px` | Restrained control and surface corners |
| Space scale | `4 / 8 / 12 / 16 / 24 / 32 / 48 / 72px` | Controls, grouped content, sections, and major compositions |
| Main content width | `1280px` | Desktop layout limit |
| Reading measure | `68ch` | Comfortable long-form copy |
| Minimum main touch target | `44px` | Navigation, choices, dialog controls, and tactical confirmation |

Headings use Palatino with Georgia and other installed serif fallbacks. Body copy and controls use the operating system’s sans-serif stack. No remote fonts, icon libraries, or additional font downloads are required. Long paragraphs use sentence case; inscription-like capitals belong to brief labels and the wordmark. Text follows the existing in-game scale setting, including 200%, and may wrap or extend the page vertically.

## Layout and hierarchy

The title page combines a locally served illustration with an immediate **Play now** or **Continue** action. Supporting sections use different compositions for the career, actual battle and Contest captures, historical setting, an early decision, and how to begin. Gameplay screenshots must remain explicitly distinguished from illustrative key art. Returning to the title preserves the campaign and its unfinished encounter.

Camp puts current orders and choices before secondary records on a phone. Rank, equipment, relationships, and the company roll remain accessible throughout the career. Ceremonial promotions and outcomes may use larger illustration and darker material; repeated reading and controls use restrained surfaces.

Dialogs are part of this same visual system. Their titles identify the task, introductory copy explains its purpose, and the main action follows the information needed to make that decision. The mobile navigation opens an actual dialog of working destinations; it does not create a second routing system.

## Reusable panel vocabulary

`src/ui/panels.js` produces semantic HTML and delegates all interaction to existing `data-cmd` handlers. The context supplies state, settings, save/offline status, and `showModal`. Display code does not change rules state, unlock chapters, write storage, or advance a turn.

| Component | Classes and state | Intended use |
| --- | --- | --- |
| Panel introduction | `panel-lead`, `eyebrow` | A short purpose or current chapter, not a second page-length hero |
| Reading section | `panel-section`, `panel-section-heading` | One topic, with clear heading and quiet separation |
| Facts and counts | `panel-facts`, `panel-statline` | Definition lists for labelled values; compact parallel counts |
| Actions | `panel-actions`, `settings-controls` | Primary commit plus secondary navigation/cancellation |
| Notices | `panel-note`, `notice`, `panel-empty` | Costs, replacement warnings, and useful empty states |
| Forms | `panel-form`, `settings-description` | Visible labels, associated explanations, wrapping input areas |
| Campaign | `campaign-progress`, `campaign-list`, `chapter-entry`, `chapter-number`, `chapter-copy`, `chapter-state`, `unlock-note` | Ordered service with `data-status="complete\|current\|available\|locked"` and explicit text labels |
| Character | `character-layout`, `character-portrait`, `character-details`, `equipment-section`, `equipment-list` | Portrait and equipment given early prominence; standing and company follow |
| Ledger | `ledger-summary`, `ledger-list`, `obligation`, `obligation-meta`, `obligation-promise` | Creditor, promise, status, due chapter, and cost presented in that order |
| Journal | `journal-entry`, `journal-requirements`, `chronicle-list`, `encounter-records` | Current orders first; consequences, company, and historical record below |
| Settings | `settings-group`, `setting` | Display/accessibility, audio, downloads, saved data, and support |
| Navigation | `menu-intro`, `menu-links`, `menu-group`, `menu-link` | Plain destinations with brief explanations and current-view semantics |
| Reference and recovery | `guide-section`, `guide-steps`, `history-entry`, `recovery-entry` | Comfortable instructions and reviewable checkpoint identity |

The schematic route map sits inside a native `details.route-map` disclosure so the current chapter is visible sooner on a phone. Completed chapters remain a record, not a replay or unlock button. Current chapters use `aria-current="step"`; locked chapters retain their exact plain-language service requirements. The ledger labels Open, Honoured, and Broken independently of color. Due obligations offer the existing settlement commands only when their rules permit settlement in camp.

## Controls, status, and accessibility

Every action retains a visible name. Tactical action glyphs are monochrome arrows, lines, squares, or mathematical marks; they are hidden from accessibility APIs and never substitute for the label. No colorful emoji swords or lightning icons are used as finished action controls. Battlefield shape markers continue to distinguish commander, ally, rival, and objective alongside text.

Buttons and native selects retain normal keyboard behavior. Focus must remain visible against both dark and pale surfaces. The dialog receives an accessible title, starts with deliberate focus, retains focus while open, and returns focus to the invoking control when it closes where that control still exists. Opening a replacement panel must reset its reading position. Background or menu navigation must close the dialog before replacing the underlying view.

Main touch targets are at least 44 pixels. Narrow layouts change arrangement instead of shrinking body text. In landscape, tactical controls can sit beside the field; enlarged text is allowed to produce vertical scrolling. Important actions must not be covered by sticky headers, overlays, or device safe areas. Long names, URLs, save codes, and error messages wrap within their containers. File inputs remain inside their panel.

The interface uses labels as well as color for active, completed, locked, warning, and failure states. Native checkboxes and selects expose settings directly. Offline and save status use live status text; failures use the existing visible alert route. Motion is secondary to reading: reduced motion must retain all content and action feedback, and no reveal effect may leave text permanently hidden.

## Data, recovery, and truthful wording

Use **No installation required**. A browser game still transfers code and assets. Chapter readiness and complete-campaign readiness are separate states. A full download starts only through the explicit control; it must not be implied by entering a menu. Local storage can fail or be evicted, so copy must not promise that every action has saved before the storage boundary confirms it.

The existing IDs remain stable: `name-input`, `audio-setting`, `motion-setting`, `graphics-quality`, `text-size`, `settings-offline-status`, `restore-file`, `restore-code`, `save-code`, and `reign-card`. Recovery entries retain their identity and expected save sequence. Import and recovery show the validated character, chapter, rank, and encounter count before the existing confirmation handler replaces a campaign. Retry describes the complete checkpoint it restores. An unavailable-storage panel offers the existing memory-only path without silently discarding the previous save.

The panel factory also supplies presentation adapters for export, recovery records, verified imports, retry, takeover, storage failure, and reign-card preparation. Async reads, validation, safe replacement, stale-tab checks, file generation, and sharing remain owned by `app.js` and storage modules. The card buttons start disabled until the existing preparation process enables them.

## Art, credits, and maintenance boundaries

Production artwork is local and compressed. The credits explain the project’s AI-generated illustrations, procedural Canvas presentation, system fonts, and fictional historical career without inventing creators, awards, licences, or performance claims. Provenance and exports remain in [the asset manifest](asset-manifest.json) and [art documentation](graphics-narrative-art.md). Privacy copy distinguishes browser-local saves, explicit clipboard/download/share actions, and ordinary hosting access logs.

This interface work does not change the renderer, tactical rules, progression, costs, narrative choices, saves, or offline policy. New panels must reuse the same command boundary and semantic structure. Visual validation, browser checks, loading measurements, and remaining device limitations belong in the release verification report; this design reference is not an accessibility certification or physical-device performance claim.
