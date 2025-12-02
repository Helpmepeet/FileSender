

⸻

1. Overview

System name: QuickBridge Personal

Goal:
Allow two people to send files between any two devices through a website, using:
	•	a 6-digit code by the website or by the url
	•	an emoji confirmation (“visual handshake”)
	•	auto-delete after transfer

No login. No install. Personal use only.

⸻

2. Scope

The system will:
	•	Let a sender upload a file from a computer or phone.
	•	Let a receiver download that file from another device, even in another country.
	•	Use a 6-digit code to connect sender and receiver.
	•	Use emoji verification so sender can confirm the correct receiver.
	•	Delete the file after download or when it expires.

The system will not:
	•	Support more than a few users at the same time.
	•	Store files for a long time.
	•	Provide user accounts or history.

⸻

3. Users
	1.	Sender
	•	Uploads the file.
	•	Sees the 6-digit code.
	•	Approves or rejects the receiver.
	2.	Receiver
	•	Enters the 6-digit code.
	•	Sees an emoji for verification.
	•	Downloads the file if approved.

⸻

4. Functional Requirements

FR-1: Open main page
	•	The system shall provide a web page where users can:
	•	choose to send a file
	•	or receive a file

⸻

FR-2: Upload file (Sender)
	•	The sender shall be able to select a file from their device.
	•	The system shall check file size.
	•	If file size > limit (e.g. 50 MB), the system shall show an error and stop.
	•	If file size ≤ limit, the system shall:
	•	accept the file
	•	store it temporarily

⸻

FR-3: Generate transfer session
	•	After the sender uploads a file, the system shall:
	•	create a transfer session
	•	generate a random 6-digit code (e.g. 77 22 99)
	•	generate a random emoji for verification
	•	show the 6-digit code on the sender page
	•	keep the sender page waiting for connection

⸻

FR-4: Join as receiver using code
	•	The receiver shall be able to open the same website.
	•	The receiver shall choose “Receive file”.
	•	The receiver shall enter the 6-digit code.
	•	If the code does not exist or is expired, the system shall:
	•	show an error (e.g. “Invalid or expired code”)
	•	not show any file
	•	If the code is valid, the system shall:
	•	connect the receiver to the sender’s session

⸻

FR-5: Show emoji verification to receiver
	•	When the receiver connects with a valid code:
	•	the system shall display an emoji on the receiver’s screen (e.g. 🌮).
	•	The receiver will verbally or visually tell the sender what emoji they see.

⸻

FR-6: Show approval request to sender
	•	When a receiver has joined:
	•	the system shall show on the sender’s screen:
	•	receiver device info (if available, e.g. “Android / Chrome”)
	•	the emoji that the receiver sees
	•	the system shall ask the sender:
	•	“Do they see 🌮 ?”
	•	The sender shall be able to click:
	•	Approve
	•	Reject

⸻

FR-7: Approve transfer
	•	If the sender clicks Approve:
	•	the system shall start the file transfer to the receiver.
	•	the system shall allow the receiver to download the file as a normal HTTP download.
	•	After the file is sent:
	•	the system shall delete the file from temporary storage.
	•	the session shall be marked as completed.
	•	the 6-digit code shall no longer be valid.

⸻

FR-8: Reject transfer
	•	If the sender clicks Reject:
	•	the system shall not send the file.
	•	the receiver shall see a message (e.g. “Request denied”).
	•	the system may keep waiting for another receiver using the same code
or end the session (you can choose one behavior for MVP).

⸻

FR-9: Auto timeout / expiry
	•	Each transfer session (code + file) shall have a timeout (e.g. 5 minutes).
	•	If the timeout is reached before approval or download:
	•	the system shall delete the file.
	•	the system shall mark the session as expired.
	•	the 6-digit code shall no longer be valid.

⸻

FR-10: Limit one download per session
	•	By default, each session shall allow only one successful download.
	•	After one receiver finishes download:
	•	the system shall delete the file.
	•	the session shall be closed.

⸻

FR-11: Error handling

The system shall show simple error messages for:
	•	file too large
	•	invalid code
	•	expired code
	•	server error during upload/download

Messages must be short and clear.

⸻

5. Non-Functional Requirements

NFR-1: Performance
	•	For files under the size limit (e.g. 50 MB), upload and download should start within a few seconds on a normal internet connection.
	•	The system should handle at least one active transfer smoothly (for personal use).

NFR-2: Security
	•	No public list of files or sessions.
	•	Access to a file must always require:
	•	correct 6-digit code
	•	sender approval
	•	The system shall not store files after:
	•	completion of download
	•	or session timeout

NFR-3: Privacy
	•	The system shall not keep any long-term logs of file contents.
	•	The system should avoid storing IPs or device info longer than needed for the session (if possible in your design).

NFR-4: Availability
	•	For personal use, the system only needs to be available when:
	•	the server is running (cloud or home PC).
	•	No high availability requirement.

NFR-5: Usability
	•	The UI shall be simple:
	•	clear buttons: “Send a file” / “Receive a file”
	•	big display for the 6-digit code
	•	big and clear emoji for verification
	•	The system should work on:
	•	desktop browser
	•	mobile browser

NFR-6: Technology Constraints
	•	Backend must be implemented using Node.js.
	•	Real-time connection must use WebSocket (e.g. Socket.io).
	•	File download should use HTTP or HTTP streaming.
	•	For personal MVP:
	•	file storage can be in memory or temp disk.
	•	no database is required.

⸻

6. Assumptions
	•	Only 2–3 users will use the system at the same time.
	•	Typical file size is small (e.g. documents, images, slides).
	•	Both users have stable internet.
	•	Both users can communicate with each other (e.g. chat, voice call) to confirm the emoji.

⸻

if you want, next step i can:
	•	convert this into MVP feature list
	•	design API endpoints (e.g. /upload, /join, /approve, /download)
	•	or start writing a simple Node.js backend skeleton for you.