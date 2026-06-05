# Zapp Architecture

Zapp fills the gap between hearing a cultural sound in your head and having no way to send it. The product is split into four cooperating surfaces.

## 1. Frontend framework and design

The runnable frontend is a no-dependency ES module app mounted from `index.html` through `src/frontend/main.js`. The frontend module composes the Zapp landing page, keyboard preview, locale filters, quick trigger chips, discovery rails, and send receipt. `src/frontend/styles.css` defines the expressive dark visual system, neon gradients, mobile-first keyboard shell, and responsive layouts.

## 2. Mobile app

The React Native shell in `app/App.jsx` presents sounds as small portraits of the sender: each row combines an iconic visual cue, source metadata, duration, and the viral `Sent via Zapp` attribution. Discovery is organized by conversational trigger and character/source rails.

## 3. Keyboard extension

The keyboard is a thin native surface backed by the same catalog/search modules. Its only happy path is `Search > Tap > Sent`, with preview and sending handled by a native bridge so the user does not compose a voice note or manage files.

## 4. Catalog and search

`src/data/clips.js` models licensing/archive metadata for UMS, Maspero, and Rotana libraries, plus trigger tags, character/source tags, locale, icon cue, preview URL, sendable URL, popularity, and seasonal boosts. `src/search/searchEngine.js` scores trigger matches above source matches so searches like `brb`, `cringe`, and `I got a bonus` feel conversational rather than archival.

## 5. Ramadan Engine

`src/backend/ramadanEngine.js` is a near-real-time content injection queue for administrators during nightly TV seasons. It validates clip payloads, enforces short Audio GIF durations, maps uploads to supported archive buckets, flags unlicensed content for review, and automatically adds Ramadan seasonal boost metadata.

## 6. Audio delivery policy

`src/audio/formatPolicy.js` defines compact preview and sendable formats. AAC-LC previews favor broad mobile playback, while Opus sendable assets target low file size. The cache policy warms recent, trending, and Ramadan rails to protect conversation-speed latency.
