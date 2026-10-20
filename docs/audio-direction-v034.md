# Contextual audio direction — 0.34

The game still bundles the same fourteen original recordings: three music beds, four environmental beds, three foley recordings and four voiced moments. This update adds mixing direction, not additional compositions, voices, recordings, stems or motion-captured performance.

## Direction

Each chapter has a named, immutable profile controlling the score's frequency range, the environmental bed's frequency range and restrained environmental stereo placement. The profiles range from the open first oath and rain-softened retreat to the muted station, dry siege curtain, river crossing, bright eastern city and centred Roman chambers. Music retains its original pitch, speed and centred placement.

The mixer then reads visible, already committed state:

- A low-health protagonist or escort, damaged defended objective, visible nearby opponent or approaching displayed deadline can produce engaged or urgent direction.
- A won/lost encounter receives a slower, quieter resolution envelope.
- Rain selects the existing rain recording outside civic chambers. Chambers retain their existing environmental recording and centred placement.
- Hidden enemies, future reinforcements, campaign outcomes and random state are not read.

Pressure does not mean more volume. Urgent direction reduces the music bed to 76% and environmental bed to 82% of their normal user-controlled mix, opens some musical high frequencies, and reduces competing ambience high frequencies. This leaves room for action sounds and speech. Narration still ducks music and restores the currently appropriate direction afterward.

Transitions use Web Audio envelopes, normally 1.15–2.4 seconds. Repeated renders with unchanged targets do not restart those envelopes. Browsers without optional filter or stereo-panner nodes retain the existing gain-based mix. The filters do not require an additional decoded recording.

## Contracts and limits

`soundscapeFor(state,screen)` keeps its two-field recording-selection contract. The separate pure `audioDirection(state,screen)` supplies direction metadata; `createSoundscape().stats().direction` exposes its latest value for diagnostics. Only the mixer applies its optional rain override.

The mixer still requires explicit opt-in and gesture unlock. Mute, hidden-page cancellation, narration cancellation, one fading tail per channel, eight foley sources, serialized decoding and the 24 MiB PCM cache remain enforced. No service, telemetry, account, timer, gameplay mutation or additional runtime download provider is added.

The rain recording must be included in each chapter's offline group because direction can select it from that chapter's actual weather.

## Evidence

The focused audio suites include the existing lifecycle, cache, cancellation, source-cap and offline tests plus new chapter-direction, hidden-enemy isolation, pressure-mix, fade-deduplication, narration-restoration, weather/offline coverage and filter-disposal cases. These tests use a controlled Web Audio substitute; they do not establish final loudness on headphones/phone speakers or subjective musical quality.

Listening review should compare calm/urgent/resolution transitions, foley intelligibility, narration and rain in a real browser at several user volume settings. The four original briefings remain limited coverage; this release does not claim a fully voiced campaign.
