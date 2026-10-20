# Environment production pass — 0.34

This pass replaces the old small box-and-cylinder interactive field props and develops Chapter V's siege landmark. It is original code-authored geometry, using existing local materials. It is not a scanned environment, commissioned asset collection or a reconstruction of historical Dura-Europos.

## Changes

- Gates have two hinged plank leaves, diagonal bracing, iron straps, rivets, hinge pins, stone footings and a spanning lintel. Opening them visibly clears the east–west travel lane.
- Bridges have individual sloping planks, stringers, nail heads, bound posts and sagging rope rails. Damaged bridges have a real central gap and broken planks. Repaired bridges expose their interpolated deck height to actor grounding.
- Supply wagons have four spoked iron-tyred wheels, axles, separate deck boards, sides, shafts, tied sacks and a folded cloth. Securing or losing the opportunity removes the load.
- Barricades use crossed trestles, a tied rail and pointed stakes. Dismantling leaves low scattered wood. Standards have shaped cloth, a crossbar, finial, disc and fringe. Braziers have a bowl, tripod supports and coals; flames and smoke exist only in the burning state.
- Twelve immutable regional palettes coordinate timber, canvas, masonry and standards, from damp Danube oak through Euphrates ochre to Roman marble and imperial purple. Existing character and UI colours are unchanged.
- Both Chapter V encounters use the new asymmetric siege landmark: unequal towers, open narrow windows, damaged wall courses, stone buttresses, broken shoulders, supported mine roof, spoil, a repair hoist and sagging temporary shade. The central arrival passage stays open and all architecture stays outside the legal board.
- Broad peripheral masonry plinths receive terrain-fitted vertical footings. These only extend down within an existing foundation footprint; they cannot raise terrain or add a rule obstacle.

## Integration and budgets

`createBattlefieldFeatures` retains its existing `sync`, `update`, `stats` and `dispose` interface. Optional `quality` affects geometry tessellation. `surfaceHeight(x,z)` returns a height only over a repaired bridge's deck (`±1.35 m` along its east–west axis, `±0.72 m` across), otherwise `null`. Callers should fall back to the environment's original ground height. The factory's `heightAt` callback must remain that original ground function to avoid recursion.

`sync` returns whether committed field state changed. The stage uses that signal to redrape the existing tactical ink and grid buffers; unchanged turns do not resample or repaint them. Actor placement, foot contact, selection rays, ground movement links and overlays share the repaired deck surface. Initial restored bridges are sampled before the ink is created. A graphics quality change disposes and rebuilds the fieldwork kit with the selected tier and rebuilt terrain.

`getSceneProfile(encounter).artDirection` is immutable presentation metadata. Fieldwork exposes object state and bounds in `group.userData.fieldObjects` for diagnostics; these are not collision or picking data.

Opaque interactive details merge by material. The six-object Balanced fixture with a burning brazier uses **14 draw objects and 19,214 triangles**: nine opaque material batches and five translucent flame/smoke objects. Repeated sync calls do not rebuild unchanged state. Rebuilding and disposal release owned geometries/materials, including source buffers retained for batching. The general environment batcher keeps its prior instancing behaviour; fieldwork explicitly selects material merging.

## Validation

`tests/environment-production-v034.test.mjs` checks actual gate ray clearance, agreement between repaired bridge mesh tops and grounding, geometry/draw budgets in all three quality tiers, state purity and resource disposal, all twelve palettes, both siege compositions on 8- and 10-column boards, and slope-fitting foundations outside legal ground. Existing campaign/environment suites additionally cover every legal scene, terrain height, routes, architecture clearance, batching and disposal.

`tests/bridge-stage-v034.test.mjs` exercises an oblique deck pick that formerly selected the far bank, committed repair/removal redraping with unchanged reach texture, sampled movement links above planks, and actual fieldwork quality rebuild/disposal against replaced terrain.

The production browser inventory now includes both Chapter V fields in overview and Horizon views, plus one representative scene from each other chapter. The captures were inspected for missing geometry, terrain contact, visible figures and readable scene labels. The machine-readable [browser evidence](evidence/benchmark-v034.json) records actual quality tiers, dimensions, scene complexity and unchanged exported saves. Interactive object state and repaired-deck agreement also have the focused geometry and stage tests above.

Geometry tests and software-rendered captures do not establish physical-device performance, GPU memory or player enjoyment. A complete device matrix, independent art review and human playtest remain separate qualification gates.
