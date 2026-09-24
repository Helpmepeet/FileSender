# FileSender

Send files from your phone to a print-shop computer without logging into your email or LINE account. Open the app on both devices and transfer with a **4-digit code**, no account needed.

[Open FileSender](https://filesender-2iwa.onrender.com/) · [Short link](https://bit.ly/ptFile)

![FileSender home screen with Send and Receive options](docs/images/app.jpg)

*The app displays the name QuickBridge.*

## How it works

**Your device:** select files → get a code. **Print-shop computer:** enter the code → match the emoji → download.

### 1. Choose what to send: on your device

Open the app and choose **Send**. Tap or drag in your files, or switch to **Text** to paste a message or link. You can send multiple files, up to **100 MB total**.

Choose an emoji before selecting **Get Code**. Emoji verification is required for every transfer.

![Sender with a sample file selected and emoji verification enabled](docs/images/01-send.jpg)

### 2. Get your code: on your device

Select **Get Code**. The app uploads your files and displays a **4-digit code**. Keep this screen open and use the code on the receiving computer. Each transfer gets a new code; the one pictured is an example.

![Sender displaying the four-digit transfer code and verification emoji](docs/images/02-code.jpg)

### 3. Enter the code: on the print-shop computer

Open the same app, choose **Receive**, enter the sender’s code, and select **Join**. No email or LINE login is needed.

![Receiver with the sender's four-digit code entered](docs/images/03-receive.jpg)

### 4. Match the emoji

On the receiving computer, select the emoji shown on your device. In this example, it is the rocket. Verification is required for every transfer.

![Receiver choosing the matching emoji from a grid of nine options](docs/images/04-verify.jpg)

### 5. Download and print: on the print-shop computer

When the file is ready, select **Download file**, then open it to print. Once your downloads are saved, select **Finish transfer** to remove the transfer from the server. For multiple files, you can download individual files or use **Download all (ZIP)** for a ZIP. Text transfers show the text with a copy button instead.

![Receiver showing the sample file ready to download](docs/images/05-download.jpg)

You have **5 minutes to join** a transfer. After verification, you have **30 minutes to download and finish** it. Expired uploads are automatically deleted. Files are stored temporarily on the server; download them promptly.

## Use with an agent (MCP)

An agent can send text or local files and receive a transfer through the local FileSender MCP bridge. See [MCP setup](mcp/README.md) for installation, allowed directories, and the four available tools.

## Run locally

Install [Node.js](https://nodejs.org/), then run:

```sh
npm install
npm start
```

Open [localhost:3000](http://localhost:3000). To use another port, run `PORT=3100 npm start`.

Built with HTML, CSS, vanilla JavaScript, Node.js, Express, and Socket.IO. See [DEPLOY.md](DEPLOY.md) for deployment instructions.

Originally vibe coded with Antigravity to solve a personal print-shop problem.
