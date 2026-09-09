# CLAUDE.md

This file provides guidance to Cat Code when working with code in this repository.

## Development commands

- `npm install` — install dependencies.
- `npm start` — start the app locally on `PORT` or `3000` by default.
- `npm run share` — expose the local server on port 3000 through `localtunnel` for ad hoc sharing.
- `npm test` — currently a placeholder that exits with an error; there is no working automated test suite in the repo yet.

## Tooling status

- There is no lint script or ESLint config in the repository.
- There is no configured test runner and no single-test command today.
- Deployment is configured for Render via `render.yaml`, with `npm install` as the build step and `node server.js` as the start command.

## Architecture overview

This is a small server-mediated file/text transfer app for short-lived sharing between two browsers. Despite the README describing the UX as simple browser-to-browser transfer, the implementation is not peer-to-peer: uploads go to the Node server, session state lives in memory, and download approval/coordination happens over Socket.IO.

### Runtime shape

- `server.js` is the real backend entrypoint. It serves `public/`, accepts uploads, exposes metadata/download endpoints, owns all Socket.IO events, and performs file cleanup.
- `index.js` is only a deployment fallback that requires `server.js`; keep behavior changes in `server.js`.
- `sessionManager.js` is the in-memory control plane for transfer sessions: 4-digit code generation, emoji verification setup, session lifecycle, and the 5-minute expiry timer.
- `public/client.js` contains nearly all frontend behavior and view-state transitions for both sender and receiver flows.
- `public/index.html` is a static shell whose element IDs are tightly coupled to `public/client.js`; DOM changes usually require matching JS updates.

### Core transfer flow

1. Sender selects files or enters text in the frontend.
2. `POST /upload` stores uploaded files in `uploads/` via Multer or stores text directly in memory.
3. `sessionManager.createSession()` creates a 4-digit code plus the chosen/random security emoji and stores the session in a process-local `Map`.
4. Sender registers over Socket.IO with `register-sender`; receiver joins with `join-receiver`.
5. If security mode is enabled, the receiver must choose the correct emoji from server-generated options; otherwise the server auto-approves.
6. After approval, the receiver fetches `/session/:code/metadata` to determine whether the payload is text, one file, or multiple files.
7. Downloads happen through `/download/:code`: single files use `res.download`, multi-file transfers are zipped on the fly with `archiver`, and text is shown in the UI instead of downloaded as a file.
8. Cleanup happens on completion or expiry by removing the session from memory and deleting any uploaded temp files.

## Important implementation constraints

- All transfer state is ephemeral. Sessions live only in memory and uploaded files live only on local disk under `uploads/`.
- A server restart loses active sessions; this matches the Render deployment and README assumptions about temporary storage.
- Upload limits are enforced in two places: Multer limits each file to 100 MB in `server.js`, while the frontend limits total selected file size to 100 MB in `public/client.js`.
- The client and server communicate through named Socket.IO events rather than a richer API layer. When changing transfer behavior, check both `server.js` and `public/client.js` together.
- There is still legacy manual approval code mixed into the current emoji-based auto-approval flow. Be careful when editing approval logic because some unused handlers and UI fragments remain in place.
- The frontend is plain HTML/CSS/JS with Tailwind loaded from CDN in `public/index.html`; there is no component framework or build step.
