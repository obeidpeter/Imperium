# Version 0.3 evidence snapshot

Copied on 11 October 2026. These files retain the observed gameplay/storage results used by [the playability report](../../archive/playability-verification.md). They ship with documentation even when generated `tests/fixtures/` files are excluded from an archive.

| File | Original source | Scope |
| --- | --- | --- |
| [autoplay-result.json](autoplay-result.json) | `tests/fixtures/autoplay-result.json` | One complete New Game campaign: 25 wins, 12 chapters, 204 turns. |
| [vertical-slice-gate.json](vertical-slice-gate.json) | `tests/fixtures/vertical-slice-gate.json` | Eighteen injected encounter runs, comparing two policies across three scenarios and seeds. |
| [contest-approaches.json](contest-approaches.json) | `tests/fixtures/contest-approaches.json` | Two approaches in each of three later political encounters. |
| [early-contest-approaches.json](early-contest-approaches.json) | `tests/fixtures/early-contest-approaches.json` | Two legal action sequences from the same injected Chapter VIII parley. |
| [finale-depth-routes.json](finale-depth-routes.json) | `tests/fixtures/finale-depth-routes.json` | Five full legal campaigns reaching different accession routes. |
| [save-browser-evidence.json](save-browser-evidence.json) | `outputs/playability-review/save-browser-evidence.json` | Six real Chrome/IndexedDB harness observations, including a two-tab race, takeover, recovery, native abort and reload. |
| [build-report.json](build-report.json) | `dist/build-report.json` | Revision `b2b95f85bd69`: asset lists and initial/complete compressed-size estimates. |
| [production-browser-evidence.json](production-browser-evidence.json) | Recorded UI observations and exported-save comparison | Legacy migration, server-stopped reload, and the final narrow Senate action loop. |

The JSON is unmodified from its source at capture. Automated outcomes do not establish human enjoyment, campaign duration, or physical-device reliability. The browser harness uses an isolated test database; its native abort is deliberate fault injection. The report records these limitations and separates source-interface checks from production offline/update verification.
