# Zapp Keyboard Extension Contract

The native keyboard extension mirrors the main app catalog but constrains every interaction to the frictionless `Search > Tap > Sent` path.

## Runtime surfaces

- **iOS custom keyboard extension**: exposes a compact search field, top trigger rails, and a tap target for each Audio GIF. For iMessage, the bridge sends the audio file plus `Sent via Zapp` caption. For apps that block direct attachment from custom keyboards, the bridge copies a prepared share card and opens the host app share sheet.
- **Android input method service**: uses `InputConnection.commitContent` where supported by WhatsApp, Slack, and rich editors; falls back to a generated share intent when the target field does not accept audio MIME types.

## Send payload

```json
{
  "id": "ramadan-series-brb-tea",
  "mimeType": "audio/ogg; codecs=opus",
  "audioUrl": "https://cdn.zapp.example/audio/ramadan-series-brb-tea.opus",
  "previewUrl": "https://cdn.zapp.example/previews/ramadan-series-brb-tea.m4a",
  "caption": "Sent via Zapp"
}
```

## Latency rules

1. Preload the first screen of trending clips and the first ten results for each typed query.
2. Keep previews below seven seconds and sendable assets below 512 KB.
3. Cache by trigger and locale so Arabic Ramadan clips remain instant during nightly spikes.
