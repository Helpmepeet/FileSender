# FileSender Architecture & Flow

This document explains how the application handles file transfers, from upload to download.

## Core Concept
The application acts as a temporary "holding area". It is **not** peer-to-peer in the strict sense (where data goes directly from phone to phone). Instead, it uses the server as a middleman.

## The Workflow

### 1. The Upload (Sender)
1.  **User Action**: User selects a file and clicks "Get Code".
2.  **Frontend (`client.js`)**:
    *   Creates a `FormData` object containing the file.
    *   Sends a `POST` request to `/upload`.
3.  **Backend (`server.js`)**:
    *   Uses `multer` middleware to receive the file.
    *   Saves the file to the local `uploads/` folder with a unique ID (UUID).
    *   **Session Creation**: Calls `sessionManager.createSession()`.
        *   Generates a random **4-digit PIN** (e.g., `1234`).
        *   Stores the file path, original name, and PIN in memory (`sessions` Map).
    *   Returns the PIN to the frontend.
4.  **Result**: The file is now sitting on the server, waiting for the PIN to be used.

### 2. The Connection (Receiver)
1.  **User Action**: Receiver enters the 4-digit PIN.
2.  **Frontend (`client.js`)**:
    *   Connects via `Socket.io` (real-time connection).
    *   Emits a `join-receiver` event with the PIN.
3.  **Backend (`server.js`)**:
    *   Checks if a session exists for that PIN.
    *   If valid, it links the Receiver and Sender via a socket room.
    *   (Optional) If verification is on, it triggers the emoji security check.

### 3. The Download (Receiver)
1.  **Trigger**: Once connected (and verified), the server tells the frontend "Transfer Approved".
2.  **Frontend**: Automatically redirects the browser to `/download/:code`.
3.  **Backend**:
    *   Looks up the file path using the PIN.
    *   Streams the file from the `uploads/` folder to the Receiver's browser.
    *   **Cleanup**: Immediately **deletes** the file from the `uploads/` folder after the download starts (to save space and privacy).
    *   Removes the session from memory.

## Key Components

| File | Purpose |
| :--- | :--- |
| `server.js` | The web server. Handles HTTP requests (upload/download) and Socket.io events. |
| `sessionManager.js` | The "Brain". Keeps track of active codes (PINs) and which file belongs to which PIN. |
| `uploads/` | A temporary folder on the server where files live for a few minutes. |

## Why Render "Ephemeral" Storage Matters
Since you are using Render's free tier:
*   The `uploads/` folder is **temporary**.
*   If the server "sleeps" (spins down) or restarts, all files in `uploads/` are wiped.
*   This is why files might disappear if you wait too long, but for quick transfers, it works perfectly.
