# Item pictures (release 13)

Pictures for the inventory, rendered offline from generated models with
`scripts/assets/render-item-pictures.py` (Blender, Cycles on the CPU). Each request in
`art-source/models/requests/item-*.json` records its Tripo task and its `picture` settings
(the view, the turn and the item's pack cells from `src/data/items.js`). The models stay in
the gitignored `art-source/models/raw/`; they never ship. These PNGs are the masters, at
128 pixels a pack cell; the game will draw them from one WebP atlas.

`pilot/` holds the eight pictures shown to the owner before any further models are made.
The mail shirt (`item-hamata.png`) came out as plates and bands, not rings, and is not to
be used. Credits: `art-source/models/item-pictures-credits.json`.
