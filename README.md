# FileSender

## Project Overview
This project was **vibe coded by Antigravity** 🚀 to solve a specific personal problem: **printing documents at a print shop.**

Often, when you need to print something at a shop, you have to log in to your personal Email or LINE account on their public computer to download the file. This is both inconvenient and a security risk (leaving sessions open, keyloggers, etc.).

**FileSender** solves this by letting you transfer files via a browser *without* logging in.

## How It Works

### 1. Upload (from your phone/personal device)
- Open the application.
- Select your file and click **"Get Code"**.
- The app generates a **4-digit PIN**.

### 2. Download (at the print shop)
- Go to `[bit.ly/ptFile](https://bit.ly/ptFile)` or `https://filesender-2iwa.onrender.com/` 
- Enter the **4-digit PIN**.
- The file downloads instantly!

## Deployment
This project is deployed to **Render**.

> **Note**: Because this runs on Render's ephemeral storage (free tier), uploaded files are **temporary**. They will disappear if the server restarts or if they are not downloaded quickly. This is perfect for the use case of immediate file transfer.

## Tech Stack
- **Frontend**: HTML, CSS, Vanilla JavaScript
- **Backend**: Node.js, Express
- **Real-time**: Socket.io (for instant connection)

## Security & Privacy
Since this project handles personal files, security is a priority:

1.  **Ephemeral Storage**:
    *   **5-Minute Limit**: All uploaded files are automatically deleted from the server after 5 minutes, whether they are downloaded or not.
    *   **Instant Deletion**: For multi-file transfers (zips) or text, data is deleted *immediately* after the transfer is complete.
2.  **Emoji Verification**:
    *   To prevent random people from guessing your 4-digit code, you can enable **"Security Mode"**.
    *   This forces the receiver to match a secret Emoji chosen by the sender before the download can start.
    *   It acts like a visual password to ensure the person downloading is the intended recipient.
