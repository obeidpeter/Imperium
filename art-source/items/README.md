# Item pictures (release 13)

Pictures for the inventory, rendered offline from generated models with
`scripts/assets/render-item-pictures.py` (Blender, Cycles on the CPU). `item-pictures.json`
lists each picture: the request in `art-source/models/requests/` whose Tripo model it shows,
its shape in pack cells and the items it serves. Each request records its Tripo task and, in
its `picture` settings, how the model is rendered (the view, the turn and the cells). The
models stay in the gitignored `art-source/models/raw/`; they never ship.

- `pictures/` holds the masters, at 128 pixels a pack cell: the pilot's seven accepted
  pictures, shown to the owner before any further models were made, and the rest.
- `rejected/` holds the renders of the models rejected at review, which `item-pictures.json`
  lists with the reason: the pilot's mail shirt (plates and bands, not rings), the second mail
  shirt (plate shoulder guards), the first gladius (a medieval cross-hilted sword) and the
  first spear (an iron shaft). Each was made again.

`node scripts/assets/item-atlas.mjs` packs the masters into the one atlas the game draws,
`assets/items/item-atlas.webp`, writes `src/data/item-pictures.js` and records the atlas in
`docs/asset-manifest.json`; `--render` renders masters from their models first. See
[the asset pipeline](../../docs/asset-pipeline.md#item-pictures--2026-11-02). Credits:
`art-source/models/item-pictures-credits.json`.
