# Character surfaces and complexion provenance — v0.18

The exposed imported anatomy and eligible short hairstyles use textures from the official MakeHuman CC0 asset pack. Clothing, leather, mail, scale, metal, horse coats and retained procedural grooms use the project's original surface fields, with the previously recorded local painted atlas providing restrained colour variation. These are separate sources and techniques.

## Skin source and export

The source archive is [MakeHuman system assets, CC0](https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip). Its male and female `.mhmat` files explicitly record a September 2020 CC0 release and name Data Collection AB, Joel Palmius and Jonas Hauquier. The project retains the [CC0 license text](../vendor/makehuman/LICENSE.CC0.md). The original male metadata internally calls its material `old_caucasian_male_detailed`, despite the `young_lightskinned_male_diffuse.png` filename; the export does not assert a precise age or add new age-specific photographs.

| Source archive member | Original bytes | SHA-256 |
| --- | ---: | --- |
| `skins/young_caucasian_male/young_lightskinned_male_diffuse.png` | 3,693,828 | `862a26e335e958b70534cb5f0d7c47ef30ab148a56c42b3e9da969cf76f12963` |
| `skins/young_caucasian_female/young_lightskinned_female_diffuse.png` | 4,391,156 | `b2a6ac8cd4f9febdb447368e29c76cd68410bb66e46d9dcfa2d5f75126eea8fc` |
| `skins/young_caucasian_male/young_caucasian_male.mhmat` | 1,462 | `6eda60b07ff2afbde078a2535ef3913593d84e9de92b2eb76c30f396a181fe2e` |
| `skins/young_caucasian_female/young_caucasian_female.mhmat` | 1,464 | `0bdea7786201f0b1132a24088336a97496ccdc54e9984db65d253a6a6d66f24f` |

Both original diffuse images are RGB, 2048 × 2048. Export uses Pillow `convert('RGB')`, `resize((1024,1024), Image.Resampling.LANCZOS)` and WebP `method=6, exact=True`, using quality 80 for male and 82 for female. The entire image remains in its original orientation and UV layout: no cropping, rearrangement, repainting, generated detail or file colour adjustment. Unused source body regions remain in the texture, while the game model contains only the imported exposed anatomy.

| Local export | Dimensions | Bytes | Gzip level 9 | SHA-256 |
| --- | --- | ---: | ---: | --- |
| `assets/textures/complexion-male-v018.webp` | 1024 × 1024 | 36,954 | 36,911 | `9467b9111bb88cc62eed260a244d4159b6b4b54275d8225168c331dcd4788adf` |
| `assets/textures/complexion-female-v018.webp` | 1024 × 1024 | 50,734 | 50,772 | `6a7de0b783e0e76ce1a554f3c1d3df854f6b6b51caafddcd3ba9e449506fc887` |

`actor-complexion.js` neutralizes the source's average pink/tan undertone in memory before the actor's existing skin tint is applied. Fixed reference colours measured from ordinary torso pixels preserve relative freckles, lips and stubble; this is a presentation transform, not a change to the licensed source or exported file. It is an approximate diffuse tint, not a measured skin-scattering model. The source material's emissive, litsphere and subsurface settings are not imported.

The model converters preserve original OBJ UV coordinates verbatim. Consequently these textures use **`flipY=true`**, despite the GLB container; applying the usual glTF `flipY=false` assumption misregisters facial features. Both axes clamp and repeat is one. Tiled procedural bump/normal/roughness maps are cleared on imported skin to avoid unrelated oversized pores. Skin uses a nonmetallic, roughness 0.64 surface; there is no glow.

The loader is lazy and shares one stable texture per male/female source. A neutral placeholder updates in place after decoding. The last actor releases the map; late completion does not revive disposed owners, and failed loads retain the fallback without repeated per-frame retries. A warm-only texture is bounded to one per source until an owner releases it or its library is disposed. Each decoded RGBA texture occupies 4 MiB before GPU mipmaps; the transfer size is much smaller. Male and female requests are independent so the female texture can remain deferred with the Chapter VIII model.

## Female anatomy

`assets/models/roman-woman-v018.glb` uses the official pinned MakeHuman base and the full female-young macro target, with no male or muscle target. [The source record](../vendor/makehuman/female-source.json) includes the pinned revision, source hashes, actual female landmarks and converter. The model has 5,393 vertices, 10,168 triangles and six weighted joints. It is 225,896 bytes (143,238 gzip level 9), SHA-256 `b92c3c5bbc101453bf24aee5d804237f35b0fa80208b61b7a6461d363eb933ff`. The existing male asset is unchanged. Clothing, hands, hair, equipment and the horse remain original project geometry.

## Original procedural material detail

`actor-surface.js` supplies bounded periodic colour, height and roughness maps at 96 × 96 and tangent-space normals at 192 × 192. The fields distinguish woven yarn, leather grain, overlapping mail links, scale edges, hammered metal and directional hair fibres. Mail recess brightness is bounded so painted wear cannot create large black holes; normal and colour relief align. Normal maps react to lighting without adding individual geometric rings. These patterns are original code-native artwork, not downloaded scans, and no new raster material files are required.

Texture objects are shared by material kind and disposed after their final actor owner. The nine native material kinds together use about 2.22 MiB of raw RGBA map data before mipmaps. Costume metric UVs and the imported skin UVs have separate contracts; a repeating cloth normal must not be assigned to anatomy.

## Imported short hair

The official archive's `hair/short04/` supplies the CC0 OBJ, `.mhclo` binding, `.mhmat` material and RGBA diffuse. The same three credited creators and CC0 release apply. [The hair source record](../vendor/makehuman/hair-source.json) records each source hash; original OBJ SHA-256 is `676964a133ee35ffcea1195382bf75542da7a298931e4001bc7b0d7b707225de`, original diffuse SHA-256 is `0bef7fc0e403db5a40fabb2111ebfa6f7e8158e204c6e56b8da98e9ef527846e`.

`scripts/build-hair-actor-asset.mjs` verifies those hashes and the pinned base/male targets before conversion. Each source `.mhclo` vertex uses its three weighted, target-deformed base vertices plus the recorded offsets. Each axis offset is scaled by the named target landmark separation divided by its source nominal separation. The result uses the existing male head transform and head bone. This adapts an authored hair asset; it does not generate new strand topology or a new hairstyle for each identity.

| Local export | Geometry / image | Bytes | Gzip level 9 | SHA-256 |
| --- | --- | ---: | ---: | --- |
| `assets/models/short-hair-v018.bin` | 991 UV-split vertices, 1,050 triangles | 19,223 | 17,193 | `7565a90117e15ca3b68d2106dad0952349a1b40255a12ad133ff1c7000a1e8c4` |
| `assets/textures/short-hair-v018.webp` | 256 × 256 RGBA | 15,974 | 15,997 | `0759f18339119418d95e5a7c9d0fe967ce5ee000e3ecd1fcb6651e8650c098e8` |

The compact `IHR1` model stores bounded uint16 positions, int8 normals, uint16 UV coordinates and triangle indices; the loader validates the header, lengths, bounds and indices, then dequantizes before creating independently owned actor geometry. The texture is the full 2048² source resized with LANCZOS to 256² and encoded as WebP quality 76, method 6, alpha quality 75, `exact=True`. No crop, repaint or UV rearrangement is applied. The alpha channel remains a strand cutout. Runtime diffuse normalization prevents the source's dark colour and the existing identity tint from multiplying into almost black.

Hair uses `alphaTest=0.4`, double-sided depth-writing material, and no transparent-object sorting. The texture uses the retained OBJ UV convention (`flipY=true`). The shared master and one decoded 256² tile are bounded caches; GPU maps are reference-counted. There is no runtime source-model download, external service or additional rendering library. Male cropped/swept/curly/receding variants share this short topology with modest width adaptation; it is not an exact separately authored hairstyle for each. Female bound hair and long hair keep their existing project groom. Hair follows the head joint; individual strands are not dynamically simulated.

Focused Node tests cover neutrality and preserved facial contrast, lazy source selection, UV settings, request deduplication, failed-load fallback, disposal and late loads, periodic material normals, mail relief alignment, packed-hair validation, head weighting and independent geometry, alpha preservation, and shared material resource lifetime. They do not establish perceived realism, human identity recognition or real-device performance. See the release verification for browser evidence. Licensing provenance is recorded without promising exclusivity or a legal guarantee.
