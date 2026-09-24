# FileSender Architecture & Flow

FileSender is a short-lived, server-mediated file and text transfer app. It is not peer-to-peer: uploaded files are temporarily held on the Node server, while session state lives in memory.

## Transfer flow

1. The sender selects files or enters text. `public/js/sender.js` creates a `FormData` request for `POST /upload`.
2. `routes/transferRoutes.js` uses Multer to put files in `uploads/` (or retains text in memory), then asks `sessionManager.js` to create a four-digit code and required emoji challenge.
3. Sender and receiver connect through Socket.IO. `realtime/registerTransferSocket.js` coordinates `register-sender`, `join-receiver`, and emoji verification. Approval creates a receiver grant.
4. Once approved, `public/js/receiver.js` redeems its grant for a cookie and requests `/session/:code/metadata`. The MCP bridge uses a bearer grant. Both routes require receiver authorization. The browser renders text for copying, one file for downloading, or individual and ZIP options for multiple files.
5. `/download/:code` streams an individual file or creates the ZIP on demand. Files remain available for additional downloads until the receiver selects **Finish transfer** or the transfer expires.
6. `cleanupSession.js` removes completed sessions and delegates uploaded-file deletion to `fileStore.js`. A transfer must be claimed within five minutes; successful verification starts a 30-minute receive lease. `sessionManager.js` invokes cleanup on expiry.

## Modules

| Area | Responsibility |
| :--- | :--- |
| `server.js` | Runtime entrypoint: configures Express, Socket.IO, uploads, routes, and expiry cleanup. |
| `config.js` | Shared transfer duration, upload/verification limits, and verification emojis. |
| `routes/transferRoutes.js` | Upload, approved-transfer metadata, and download HTTP endpoints. |
| `realtime/registerTransferSocket.js` | Sender/receiver Socket.IO coordination and verification. |
| `sessionManager.js` | In-memory sessions, codes, emoji choices, and expiry timers. |
| `fileStore.js` / `cleanupSession.js` | Temporary upload directory and cleanup of uploaded files/sessions. |
| `public/js/` | Shared browser state/UI plus separate sender and receiver workflows. |

## Render storage

Render's local filesystem is ephemeral. A restart loses active in-memory sessions and may remove temporary uploads. This matches FileSender's short-lived transfer model; users should download promptly.
