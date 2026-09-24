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

## Production deployment

- The production site is [https://filesender-2iwa.onrender.com/](https://filesender-2iwa.onrender.com/).
- Production deployment is **manual**: the user deploys the desired GitHub commit from the Render website. A GitHub push alone does not make a change live.
- Agents may prepare, commit, and push code when authorized, but must leave the Render dashboard deployment to the user. Report the pushed commit SHA so the user can select or verify it in Render.
- After a push, describe the change as pushed, not deployed. Check the production site only after the user says they have deployed, or if they explicitly request a live verification.

## Architecture overview

This is a small server-mediated file/text transfer app for short-lived sharing between two browsers. Despite the README describing the UX as simple browser-to-browser transfer, the implementation is not peer-to-peer: uploads go to the Node server, session state lives in memory, and download approval/coordination happens over Socket.IO.

### Runtime shape

- `server.js` is the real backend entrypoint. It wires the HTTP app, upload middleware, routes, Socket.IO, and expiry cleanup together.
- `index.js` is only a deployment fallback that requires `server.js`; keep behavior changes in `server.js`.
- `routes/transferRoutes.js` owns upload, metadata, and download HTTP behavior; `realtime/registerTransferSocket.js` owns the Socket.IO event flow.
- `sessionManager.js` is the in-memory control plane for transfer sessions: 4-digit code generation, emoji verification setup, session lifecycle, a 5-minute claim deadline, and a 30-minute receive deadline. It does not manage disk files.
- `fileStore.js` owns the temporary upload directory and file deletion, while `cleanupSession.js` performs explicit completion/failure cleanup.
- `public/js/core.js`, `ui.js`, `sender.js`, and `receiver.js` divide browser state/UI utilities from the two transfer workflows. `public/index.html` is a static shell whose element IDs are tightly coupled to those scripts.

### Core transfer flow

1. Sender selects files or enters text in the frontend.
2. `POST /upload` stores uploaded files in `uploads/` via Multer or stores text directly in memory.
3. `sessionManager.createSession()` creates a 4-digit code plus the chosen/random security emoji and stores the session in a process-local `Map`.
4. Sender registers over Socket.IO with `register-sender`; receiver joins with `join-receiver`.
5. The receiver must choose the correct emoji from server-generated options. Wrong guesses throttle that claimant without deleting the sender's transfer.
6. After approval, the browser redeems its Socket.IO grant for a cookie. Metadata and downloads require a receiver grant; the local MCP bridge uses a bearer token instead.
7. Downloads happen through `/download/:code`: single files use `res.download`, multi-file transfers are zipped on the fly with `archiver`, and text is shown in the UI instead of downloaded as a file.
8. Cleanup happens on completion or expiry by removing the session from memory and deleting any uploaded temp files.

## Important implementation constraints

- All transfer state is ephemeral. Sessions live only in memory and uploaded files live only on local disk under `uploads/`.
- A server restart loses active sessions; this matches the Render deployment and README assumptions about temporary storage.
- Upload limits are enforced in multiple places: Multer limits each file to 100 MiB and caps multipart file/field counts in `server.js`; `routes/transferRoutes.js` rejects file transfers over 100 MiB total; the frontend limits total selected file size to 100 MiB in `public/js/sender.js`.
- The client and server communicate through named Socket.IO events rather than a richer API layer. When changing transfer behavior, check `realtime/registerTransferSocket.js` and the sender/receiver browser scripts together.
- `mcp/server.js` is a separate local stdio MCP server. Its four tools reuse FileSender's HTTP and Socket.IO flow; install its dependencies from `mcp/package.json`.
- The frontend is plain HTML/CSS/JS with Tailwind loaded from CDN in `public/index.html`; there is no component framework or build step.
