# Character anatomy and animation, v0.17

The near-view male characters now use an imported, genuinely authored human head/neck and exposed-arm mesh. This is an adaptation of the MakeHuman Community base topology; it is not a GLB export of the game's old procedural body. The local GLB contains 5,255 indexed vertices, 9,904 triangles, six joint bindings and normalized skin weights. It is 220,008 bytes (136,985 bytes with gzip level 9). The head/neck contributes 8,520 triangles; both exposed arms contribute 1,384. Source helpers, hidden body regions and application code are excluded.

The [official assets license](https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/LICENSE.ASSETS.md) is CC0 1.0 Universal. The actual source files explicitly state that they were released under CC0 in September 2020. Their named original rights holders include Data Collection AB, Joel Palmius and Jonas Hauquier. The game's attribution is informational; CC0 does not require attribution. MakeHuman application code is not used or bundled.

Exact immutable source paths, revision and SHA-256 checksums are in `vendor/makehuman/source.json`; the complete CC0 text is `vendor/makehuman/LICENSE.CC0.md`. The base and two macro targets were independently fetched again from the pinned revision and hash-matched. The conversion applies the young male target and 35% of the male maximum-muscle target, adapts the authored anatomical regions to the established game skeleton, preserves source UVs, computes smooth normals, and packs normals/UVs/weights while retaining float positions. No paid or unlicensed assets, Blender installation, remote model service or runtime network source is required.

To reproduce from the source project:

```sh
node scripts/fetch-actor-source.mjs /path/to/CC0-sources
node scripts/build-actor-asset.mjs /path/to/CC0-sources
```

The first command explicitly downloads only the pinned official source files and verifies their checksums. The second is a local deterministic conversion and writes `assets/models/roman-human-v017.glb`. The production game loads that bundled file with the vendored official Three.js 0.186.1 GLTFLoader. No CDN or model download occurs during play.

Each actor clones the immutable master anatomy and binds it to its existing joints. The existing feet, mounted rider placement, shield, sword, spear, bow and projectile-release anchors remain authoritative. Facial proportions and local coloring preserve named identities; fitted scalp/beard surfaces follow the imported head. Eye components fit its actual sockets. The original female sculpt remains in use for Aelia; the project does not claim that one male anatomical base supplies appropriate female anatomy.

The existing custom tunics, armor, helmets, hair treatment, hands, boots, equipment and horse remain original code-authored geometry. In particular, this is an imported anatomical upgrade, not a complete scanned or externally authored costume/horse pack. Facial motion remains restrained procedural eyelid/jaw cues rather than facial motion capture or a full expression blendshape rig. Overview geometry remains the lighter original role silhouette. The GLB master is shared, while instance geometry, skin and material resources have independent disposal. A failed asset load keeps the previous complete articulated rig; an actor disposed during loading cannot install a late replacement. Late successful loading preserves the caller-owned group placement and contact object.

Sword cuts, level spear thrusts and mounted cuts now use distinct original keyframe sequences with visible preparation and recovery. The legal impact remains at `230/620`; thrown projectiles release at `310/620`. Turning locomotion adds bounded torso/head counter-rotation while the existing world-space stance solver retains grounded feet. These are presentation changes; rules, pathfinding, random state, saves, combat outcomes and action timing are unchanged.

`tests/actor-imported.test.mjs` directly parses the shipped GLB and verifies weights/provenance, actual deformed vertices, identity isolation, reduced overview cost, stable anchors, independent disposal, asynchronous success/failure and weapon-specific timing. `tests/actor-model-browser.html` is an explicit development-only neutral-light inspection page; it has no game-state mutation or production import.
