# Deploy Zapp on Railway

Zapp is now Railway-ready as a Node.js web service. The repository includes the Node.js files Railway looks for (`package.json` plus application source), a `start` command, a `start.sh` compatibility wrapper, a `railway.json` deployment configuration, and an optional `Dockerfile` for Docker-based deployments.

## Recommended Railway setup

1. Push this repository to GitHub.
2. In Railway, create a new project from the GitHub repository.
3. Keep the root directory set to the repository root, not a subfolder.
4. Railway will read `railway.json` and run:
   - Build command: `npm run build`
   - Start command: `npm start`
5. Generate a public domain for the service.

## Why this fixes the “Push your application source code” error

That Railway error usually appears when the selected deployment root does not contain recognized application files. For this project, make sure Railway points at the repository root where `package.json`, `server.js`, `start.sh`, `railway.json`, and `Dockerfile` live.

## Runtime behavior

- `npm run build` copies the static frontend into `dist/`.
- `npm start` runs `server.js`.
- `./start.sh` is available for hosts or Railway services that were manually configured to run a shell start script; it builds `dist/` if needed and then delegates to `npm start`.
- `server.js` serves `dist/` in production and falls back to the repo root for local development.
- The server listens on Railway's `PORT` environment variable and exposes `/health` for deployment health checks.


## If Railway says “Script start.sh not found”

That means the Railway service start command is currently set to `start.sh` or `./start.sh`. You have two valid fixes:

1. Preferred: change the Railway start command back to `npm start` so it matches `railway.json`.
2. Also supported: leave the command as `./start.sh`; this repository now includes that script at the repository root.
