# Tripo V3 migration and recovery

Prepared 2026-11-04 against `main` at `112509d`. This changes the development asset pipeline, not the game's bundled models or its runtime. It does not authorize generation, change credentials or merge itself.

## Provider contract

Tripo's V2 shutdown notice specified 2026-11-01 00:00 UTC+8 (2026-10-31 16:00 UTC). Its 2026-11-02 notice also retires generation/texture `v2.5-20250123` and segmentation `v1.0-20250506` on 2026-12-01. Some examples still show these versions; new requests in this client refuse them now.

Official references, checked 2026-11-04:

- [V2 to V3 migration](https://developers.tripo3d.ai/en/docs/migration-v2-to-v3) and [authentication](https://developers.tripo3d.ai/en/docs/authentication).
- [Text generation](https://developers.tripo3d.ai/en/docs/generation-text-to-model/standard) and [image generation](https://developers.tripo3d.ai/en/docs/generation-image-to-model/standard).
- [Task queries](https://developers.tripo3d.ai/en/docs/task-query), [lifecycle](https://developers.tripo3d.ai/en/docs/task-lifecycle) and [account balance](https://developers.tripo3d.ai/en/docs/account).
- [Rig checks](https://developers.tripo3d.ai/en/docs/animations-rig-check) and [rigging](https://developers.tripo3d.ai/en/docs/animations-rig).
- [Changelog](https://developers.tripo3d.ai/en/docs/changelog) and [usage history](https://developers.tripo3d.ai/en/docs/account-usage-history).

## Exact interface changes

API base: `https://api.tripo3d.ai/v2/openapi` → `https://openapi.tripo3d.ai/v3`.

| Function | V2 | V3 |
| --- | --- | --- |
| Balance | `GET /user/balance` | `GET /account/balance` |
| Task/recovery | `GET /task/{id}` | `GET /tasks/{id}` |
| Text generation | `POST /task`, `type=text_to_model` | `POST /generation/text-to-model` |
| Image generation | `POST /task`, `type=image_to_model` | `POST /generation/image-to-model` |
| Free rig check | `POST /task`, `type=animate_prerigcheck` | `POST /animations/rig-check` |
| Paid rig | `POST /task`, `type=animate_rig` | `POST /animations/rig` |

The wire payload no longer contains `type`. `generator.task` remains in source requests as an internal operation selector. Old `generator.options.model_version` is translated to `model` in memory; conflicting names fail. Rig inputs use `input` instead of `original_model_task_id`. Image requests need `generator.input` (or `options.input`): a V3 file token, image task UUID or HTTPS image URL. Local-image uploading is not implemented; no files are uploaded implicitly.

V3 results use `output.model_url`, `output.rendered_image_url`, `credits_consumed`, `created_at` and `completed_at`. Recovery also accepts legacy output names if returned. The client checks task IDs, handles terminal failures, and bounds unknown states, transient read errors and polling time. Task creation is never retried, including on HTTP 429/5xx or a malformed response. API redirects are rejected; authorization is never forwarded to download hosts.

| New-request selection | Default | Other accepted versions |
| --- | --- | --- |
| H-series geometry | `v3.1-20260211` | `v3.0-20250812` |
| Textures | `v3.0-20250812` | `v3.5-20260815` |
| Biped rig, Tripo naming, GLB | `v1.0-20240301` | Explicit `v2.5-20260210` or `v3.0-20260909` |

The default biped skeleton is intentional: the existing Blender binder expects it. The newer rig models and naming conventions need paid output and binding review before use. Existing provenance is never relabelled with the new defaults. Separate texturing/segmentation, P-series generation, FBX, generated parts and implicit smart-low-poly generation are outside this pipeline's supported single-GLB workflow. They fail locally rather than invoking retired or automatically changing models. Blender still performs mesh reduction.

## Authentication

Reuse the existing Bearer API key via `TRIPO_API_KEY`, supplied to the client process by the existing secure loader. Do not put the key in a request JSON, command argument, repository, log or browser build. No key is installed, rotated or rewritten by this migration.

An environment-managed proxy secret must be scoped to `openapi.tripo3d.ai`. `TRIPO_PROXY_AUTH=1` explicitly selects that already-approved setup when no environment key is provided. The previous `api.tripo3d.ai` scope does not cover V3. Changing that secret scope requires the owner's approval. The existing environment-proxy startup opt-in is retained; it needs a Node runtime that supports `NODE_USE_ENV_PROXY`.

## Review, then authorize a paid task

```sh
# No HTTP requests, credentials or file writes:
node scripts/assets/tripo.mjs generate art-source/models/requests/<new-id>.json --dry-run
node scripts/assets/tripo.mjs rig art-source/models/requests/<id>.json --dry-run

# Only AFTER approval of this exact request and its current cost:
node scripts/assets/tripo.mjs generate art-source/models/requests/<new-id>.json --allow-paid
node scripts/assets/tripo.mjs rig art-source/models/requests/<id>.json --allow-paid
```

`--allow-paid` is an execution guard, not a quote, spending cap or substitute for approval. Old pilot/batch allowances do not authorize this migration to spend again. A separately approved retry needs a new asset ID/request; keep the old record and rejected-attempt history. Never erase a task ID to pay again.

Commands that do not create paid tasks:

| Command | Behaviour |
| --- | --- |
| `balance` | Read available and frozen credits. |
| `task <task-id>` | Read a task summary, without exposing its signed download URL or writing a record. |
| `resume <request.json>` | Restore/finish its recorded generation. Never POST. |
| `resume-rig <request.json>` | Restore/finish its recorded rig. Never POST. |
| `rig-check <request.json>` | Reuse a recorded check or submit only the documented free check; never submit a rig. |

`rig` with an already-recorded rig ID also resumes without requiring `--allow-paid`.

## Records, interruption and recovery

- Before creating a task, save its exact V3 body, endpoint, API version, timestamp, body SHA-256 and a local submission identifier. Paid submissions also record available/frozen balances. The submission identifier is local evidence, **not** a provider idempotency key.
- Persist the returned task ID immediately, before polling. Atomic JSON replacement and an exclusive per-request `.tripo.lock` protect against partial writes and two processes submitting that same file concurrently. A crash can leave a lock: inspect the record, confirm no process still owns it, then remove only that lock.
- An ambiguous submission remains `pending` or `uncertain` and refuses a new POST. Reconcile the request with the Tripo console/support using timestamp, payload and any returned task ID. Preserve all evidence. Once the exact ID is confirmed, add it to the relevant `provenance.taskId`, `provenance.rig.taskId` or `provenance.rigCheck.taskId`, then resume. Do not choose a merely similar task automatically. Usage history lists successful tasks only, so absence from it does not prove a request was never accepted.
- A failed, unavailable or expired task never causes a replacement generation. The sampled legacy tasks worked with V3; that is not a guarantee of retention for every older task. If recovery is unavailable, preserve local raw files, bundled models and the historical record; seek provider help before considering an approved import or regeneration.
- For completed records, verify the existing raw file locally or download and compare its SHA-256 **before** restoring it. Different bytes are rejected. The completed request file remains byte-for-byte unchanged, including CRLF, exact prompts, charges, model versions, dates, review status and provenance. An interrupted record receives only completion evidence, without discarding fields already present.
- New costs come from the task's `credits_consumed`; legacy `consumed_credit` remains readable. Missing costs stay unknown and need reconciliation, even for a sequential command. A shared wallet delta can include other work and is not a reliable per-asset cost. Existing batch ledgers and charges remain unchanged.
- The announced December USD display change does not change API units: Tripo's current changelog says `balance`, `frozen` and `credits_consumed` remain credits. No currency conversion is applied to historical or new API records.

Per-file locks cannot deduplicate separately copied requests on other computers. Keep one authoritative request record and review each paid invocation.

## Validation

Automated checks use an injected transport and temporary files; they never use a real key or the network. Run `node --test tests/tripo.test.mjs`. They cover V3 payloads, model retirement, authentication, no authorization on downloads, polling/failure states, decimal/zero/missing charges, paid guards, pre-POST persistence, ambiguous submissions, disk failures, concurrent calls, legacy recovery, unchanged history, hashes, rigs and Windows paths.

Local validation: all 52 dedicated Tripo tests passed on Windows/Node 24.22.1. The production build and asset/offline-integrity checks also passed. The full Node suite runs these tests alongside the existing game tests; GitHub additionally runs the existing browser, benchmark and desktop jobs without Tripo credentials.

Live read-only validation on 2026-11-04 reused the already-encrypted Windows key without changing it:

- V3 balance authenticated successfully.
- Generation task `4ba61fec-b221-460e-93c0-4072c5490722` and rig task `72b45b3e-b9df-45a9-949b-5305866deb5e`, both created on V2, returned successfully through V3 with their recorded 20- and 25-credit charges.
- Both downloaded GLBs matched their recorded SHA-256 hashes exactly (44,601,328 and 59,614,420 bytes); verification used memory and wrote no raw assets or historical records.
- A new free rig-check task returned `riggable: true`, `rig_type: biped` and `credits_consumed: 0`. It was recorded in an ignored temporary copy, never in the original asset request. Available and frozen balances were unchanged throughout validation.

The [live validation record](evidence/tripo-v3-validation.json) retains task IDs, hashes and limits without credentials or signed download URLs. All 163 historical request files and runtime assets remain unchanged. The local PowerShell companions were also updated: the setup helper's balance URL points to V3, and the invocation helper accepts `task`, `rig-check` and `resume-rig`. Neither change runs key setup; these local helpers are outside the repository and are supplied as a separate review diff.

No paid generation or rigging is part of this migration's validation. Mocks verify their request/response contracts and recovery logic; they do not prove newly generated artwork, rig topology, weights, visual quality or compatibility of a newer skeleton with Blender. A later explicitly approved paid pilot is required for those checks. Proxy-secret injection is also unverified here; the live check uses the existing Windows key loader.
