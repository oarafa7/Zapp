# Zapp

Zapp is a prototype mobile application and custom keyboard extension for sending **Audio GIFs**: short, iconic, pre-made sound bites that work as cultural reactions inside chats.

## What is included

- A React Native app shell that supports the core `Search > Tap > Sent` journey.
- A keyboard extension integration contract for iOS and Android host apps.
- A searchable Audio GIF catalog seeded with Arabic and international culture examples.
- A Ramadan content injection queue for near-real-time administrator uploads.
- Audio format policy and catalog validation checks for low-latency sharing.

## Development commands

```bash
npm test
npm run lint
```

The repository intentionally avoids generated native project files in this first implementation so the product model, data contracts, and core algorithms can be tested without platform-specific build tooling.
