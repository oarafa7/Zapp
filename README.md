# Zapp

Zapp is a prototype mobile application and custom keyboard extension for sending **Audio GIFs**: short, iconic, pre-made sound bites that work as cultural reactions inside chats.

## What is included

- A no-dependency web app (deployable on Railway) with a polished landing page, keyboard mockup, and live search.
- **Real, playable Audio GIFs.** Clips are synthesized at build time (license-free) so every catalog entry can be previewed and sent — no external CDN required.
- A working **MVP send flow**: tap to preview, **Download clip** to save the file, then attach it (or send it as a voice note) in WhatsApp. On phones that support the Web Share API, **Share to WhatsApp** opens the share sheet directly.
- A React Native app shell and an iOS/Android keyboard-extension integration contract describing the longer-term native product.
- A searchable Audio GIF catalog seeded with Arabic and international culture examples, plus a Ramadan content injection queue.
- Audio format policy and catalog validation checks for low-latency sharing.

## Uploading your own sounds

The app has a built-in **"Upload your own Audio GIF"** panel:

- **Upload a file** (mp3/wav/m4a/ogg, ≤ 5 MB), and optionally **trim** it first —
  a built-in browser trimmer lets you pick start/end, preview the selection, and
  save just that region (encoded to WAV client-side, works on iOS).
- A **"Capture audio here"** button links out to an external ripper so users can
  grab an MP3, download it, then upload + trim it here.

New clips are added to the live catalog immediately — searchable, playable, and
sendable like any other clip — and stored on a persistent **Railway Volume** so
they survive restarts (see `docs/railway-deploy.md`). Set `ZAPP_ADMIN_TOKEN` to
gate uploads on a public deployment. API: `GET /api/clips` (list) and
`POST /api/clips` (raw audio body, metadata in query).

## How to "try it on WhatsApp" (MVP)

1. Open the deployed site on your phone.
2. Search a trigger (`brb`, `cringe`, `i got a bonus`, `تمام`) and tap a clip to hear it.
3. Tap **Download clip** to save the audio file.
4. In WhatsApp, attach the saved file (or send it as a voice note). The caption carries the `Sent via Zapp` attribution.

> **Scope note:** A true *system-wide keyboard* that injects audio directly into WhatsApp/iMessage is a native iOS/Android app (App Store / Play Store), and on iOS custom keyboards cannot attach media at all — so it can't be hosted on Railway. This repo delivers the deployable web MVP today; `app/App.jsx` and `keyboard/extension-contract.md` capture the native vision for later.

## Development commands

```bash
npm run dev
npm run build
./start.sh
npm start
npm test
npm run lint
```

## Deploying on Railway

This repo is ready for Railway as a Node.js service. Push the repository root to GitHub, create a Railway project from that repo, and keep the Railway root directory pointed at the folder containing `package.json`. Railway can then use `railway.json` to run `npm run build` and `npm start`. If your Railway service was manually configured to run `start.sh`, this repository now includes `./start.sh` as a compatibility wrapper. See `docs/railway-deploy.md` for details.

The repository intentionally avoids generated native project files in this first implementation so the product model, data contracts, and core algorithms can be tested without platform-specific build tooling.
