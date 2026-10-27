# Environment composition polish

Implemented 26 October 2026 on the player-experience-polish branch. This work follows the foreground foliage and repetitive courtyard composition findings after PR #32.

Trees now reserve their complete crown, including curved leaf sprays, around the legal board and the default low-camera approaches. The reservation covers both the classic negative-yaw Horizon and the real-time positive-yaw views. Branch clusters contain fewer overlapping sprays, and their crowns sit higher. The existing dynamic scenery cutaways remain available for manually rotated cameras and other obstructions. Regional species, wind and quality levels remain in use.

Eleven regional kits now form different peripheral working arrangements: barrack streets, riverbank work lines, loading courts, command tents, market wings and Roman courts. They reuse the same eight kit slots and two camp repeats. Chapter V retains its distinct fortress placement. All structures remain outside the actual rules board; camp service coordinates, collision pockets, movement, terrain heights and save data are unchanged by these presentation files.

Building footprints and orientation also drive ground dressing. Existing ground layers form irregular aggregate aprons, worn entrances and narrow runoff strips; only wet regions show damp runoff soil. Models and fallback buildings share the same placement data and ground treatment. Paving courses continue across adjacent stone cells rather than restarting at each rules tile. Exposed outer courses have restrained erosion; unpaved cells remain clear.

## Source and provenance

The new `src/showcase/environment-composition.js` contains original deterministic presentation geometry and ground-sampling code. Regional arrangements are original data in `src/ui/world-layouts.js`. These changes reuse bundled models, texture layers, materials and instance batches. No external asset, generated image, paid generation, additional download or new shader program was introduced. The asset manifest therefore requires no new source entry.

## Focused evidence

The focused Node run passed **38/38** checks across environment composition, foliage, regional worlds, regional atmosphere, world layouts and terrain splatting. New regressions cover actual leaf-vertex bounds, both camera approaches across twelve chapters, oriented footprint/entrance dressing, unchanged distant splat weights, paving across internal cell boundaries without filling missing floor, and distinct spatial arrangements. Existing checks cover collision-pocket clearance, structure separation at several board sizes, asset fallback ownership, resource retirement and presentation purity.

A separate source preview captured Chapter V wall, Chapter VII camp and Chapter XII camp in Horizon and Overview: **six settled views**, imported actors and scenery, Balanced quality, 1280×900 viewport, DPR 1. Chromium 151.0.7922.34 used ANGLE/SwiftShader; Reduce motion was enabled through visible Settings for these static captures. The browser restored earned campaign saves through the visible interface. There were no unexpected browser errors; the source-only service-worker 404 was recorded separately.

The local report and PNGs are in `work/player-experience-polish/environment-source/` beside the repository workspace, not bundled game assets. The report explicitly identifies these as source observations, not final production acceptance. The Chapter V infantry and objectives are clear of the former foreground leaf mass. Chapter VII's soldier, court and approach are visible without a dotted leaf cutaway. Chapter XII retains distant Roman/cypress framing while keeping the central court clear.

## Limits

This improves peripheral composition; it does not redesign the authoritative camp interiors. Those still use broad, mostly flat service courts. Architecture remains a modular kit, and the ground transitions are texture-layer dressing rather than authored drainage simulation. Arbitrary manual camera positions can still need the existing cutaway. Static source captures do not establish animation quality, human navigation comfort or hardware frame rate. Production shader, draw-call and download ceilings remain unchanged and require integration qualification at the final build.
