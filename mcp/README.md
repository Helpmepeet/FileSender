# FileSender MCP bridge

This local stdio MCP server lets an agent send text or files through FileSender and receive transfers from a browser or another agent. The MCP client starts the bridge when needed. File bytes move through FileSender and are streamed to disk; they are not put in tool results.

The bridge runs on the **agent's machine** so it can read and save local files. It connects to the existing FileSender web server over HTTP and Socket.IO. The published app URL in this repository is `https://filesender-2iwa.onrender.com/` (Render). Once that deployment includes the MCP-enabled server changes, set `FILESENDER_URL` to this URL and use the published app; the agent does not need to run the web server locally. The bridge itself is not deployed to Render.

## Install

You need Node.js 20 or newer and a reachable FileSender app running the MCP-enabled server code in this repository. For the published app, install only the bridge dependencies with `npm ci --prefix mcp` from the repository root, then configure its URL below. To run the web app locally for development, use two terminals:

```sh
# Terminal 1: start the FileSender app
cd /absolute/path/to/FileSender
npm ci
npm start
```

```sh
# Terminal 2: install the separate MCP bridge dependencies
cd /absolute/path/to/FileSender
npm ci --prefix mcp
```

The local app is then at `http://localhost:3000`. For the published app, deploy this server code first: older FileSender deployments do not provide the transfer grants required by the bridge.

## Connect Codex

Choose two folders on the computer that runs this MCP bridge: one containing files it may send, and one where it may save received files. Configure these folders separately on every computer that installs the bridge. The example creates narrow folders in that computer's home directory; it does not set a shared destination for other agents. Run it from the FileSender repository root, replacing that first path with your checkout:

```sh
cd /absolute/path/to/FileSender
mkdir -p "$HOME/FileSender-outgoing" "$HOME/FileSender-incoming"
codex mcp add filesender \
  --env "FILESENDER_URL=http://localhost:3000" \
  --env "FILESENDER_READ_DIRS=$HOME/FileSender-outgoing" \
  --env "FILESENDER_WRITE_DIRS=$HOME/FileSender-incoming" \
  -- node "$PWD/mcp/server.js"
codex mcp list
```

Start a new Codex session after adding the server. The desktop app also supports **Settings → MCP servers → Add server → STDIO**; save the same command and environment settings there, then select **Restart**. In the Codex terminal UI, `/mcp` shows connected servers. The bridge runs on the agent's machine, so `localhost` means that machine. The app must be reachable from it. See the [Codex MCP configuration guide](https://developers.openai.com/codex/mcp) for the current setup options.

To use the published app after deploying the MCP-enabled server, change `FILESENDER_URL` in the `filesender` MCP configuration from `http://localhost:3000` to `https://filesender-2iwa.onrender.com`. The local `npm start` process is then unnecessary.

Codex's default tool timeout is 60 seconds. For the hosted Render service, set `tool_timeout_sec = 1800` under the existing `[mcp_servers.filesender]` table in `~/.codex/config.toml` and start a new session. This covers a cold start or a long file download.

Other MCP clients can use a stdio server command with the same settings. For clients that accept `mcpServers` JSON, adapt this example to their configuration file:

```json
{
  "mcpServers": {
    "filesender": {
      "command": "node",
      "args": ["/absolute/path/to/FileSender/mcp/server.js"],
      "env": {
        "FILESENDER_URL": "http://localhost:3000",
        "FILESENDER_READ_DIRS": "/absolute/path/to/outgoing",
        "FILESENDER_WRITE_DIRS": "/absolute/path/to/incoming"
      }
    }
  }
}
```

`FILESENDER_READ_DIRS` and `FILESENDER_WRITE_DIRS` can each contain multiple existing root folders, separated by `:` on macOS/Linux or `;` on Windows. These paths refer to the bridge's computer, not the hosted FileSender app or the sender's computer. If a session uses a bridge running on another machine, received files are saved on that machine. Use private folders that other local users cannot rename or replace while a transfer runs. The bridge may create a requested subfolder inside a write root. `send_text` and receiving text do not need either folder. `send_files` needs a read root; receiving files needs a write root. Optional `FILESENDER_MAX_TOTAL_BYTES` defaults to `104857600` (100 MiB) and can only be set lower. Text is also limited to 1 MiB. `FILESENDER_URL` must be the app's HTTP(S) origin, without a path or embedded credentials.

## Use it

The agent sees four tools:

| Tool | What the agent provides | What it returns |
| --- | --- | --- |
| `send_text` | `text` | Four-digit `code`, `emoji`, expiry |
| `send_files` | `paths` to local files inside a read root | Four-digit `code`, `emoji`, expiry |
| `receive_transfer` | `code`, `emoji`, optional `outputDirectory` inside a write root | Received `text` or `savedPaths`, plus `receiverHandle` |
| `finish_transfer` | The returned `receiverHandle` | Completion confirmation |

For example, tell the sending agent: “Use FileSender to send the text `Hello`; give me the code and emoji.” Share both with the receiver. Then tell the receiving agent: “Receive FileSender code `1234` with emoji `🚀`, save any files in my FileSender incoming folder, and finish the transfer after you have the text or saved files.” A browser can be either sender or receiver as well.

The receiver must claim the transfer within 5 minutes. A successful claim gives it 30 minutes to download and call `finish_transfer`. For files, `outputDirectory` can select a folder inside a configured write root on the receiver bridge's computer. If omitted, the first configured write root on that computer is used. Without a write root, file receiving fails; text still works. The receiver handle works only in the MCP process that returned it, so finish before restarting the agent session.

## If setup fails

- No tools appear: check `codex mcp list`, confirm `node` is on the MCP client's `PATH`, run `npm ci --prefix mcp`, check the absolute path to `server.js`, then start a new agent session.
- A connection fails: confirm the FileSender app is running and `FILESENDER_URL` is reachable **from the agent's machine**. A hosted app must run the MCP-enabled server version.
- A path is rejected: use a file inside `FILESENDER_READ_DIRS` or a destination inside `FILESENDER_WRITE_DIRS`; the root folders themselves must exist.
- A claim fails: check both the four-digit code and emoji, and whether the 5-minute claim window has expired.
