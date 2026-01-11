

## Project Overview
This project was **vibe coded by Antigravity**  to solve a specific personal problem: **printing documents at a print shop.**

Often, when you need to print something at a shop, you have to log in to your personal Email or LINE account on their public computer to download the file. This is both inconvenient and a security risk (leaving sessions open, keyloggers, etc.).

**FileSender** solves this by letting you transfer files via a browser *without* logging in.

<img width="1505" height="867" alt="image" src="https://github.com/user-attachments/assets/f150ae89-d42d-45c5-87ed-f40218a32d85" />

## How It Works

### 1. Upload (from your phone/personal device)
- Open the application.
- Select your file and click **"Get Code"**.
- The app generates a **4-digit PIN**.
<img width="1499" height="859" alt="image" src="https://github.com/user-attachments/assets/5ceef29b-70c1-4acd-b20d-c726ac970551" />

### 2. Download (at the print shop)
- Go to `https://bit.ly/ptFile` or `https://filesender-2iwa.onrender.com/` 
- Enter the **4-digit PIN**.
- The file downloads instantly!
<img width="1504" height="865" alt="image" src="https://github.com/user-attachments/assets/de614c32-3b28-40ef-9917-2e3585a5ce2c" />

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

<img width="1510" height="874" alt="image" src="https://github.com/user-attachments/assets/3a558655-f306-4299-b426-8395e00bf4eb" />

