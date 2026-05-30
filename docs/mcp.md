# Reef MCP server

`reef-mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server that exposes reef control-plane operations as tools. Claude Code, Cursor, and other MCP clients can call them directly so an agent can list deploys, edit source, rebuild, tail logs, and manage env vars without shelling out.

## Install

`reef-mcp` ships in the `reefsh` package as a second bin entry.

```sh
npm i -g reefsh   # or: npx -p reefsh reef-mcp
```

## Auth

The server reuses the credentials your local `reef` CLI already stored at `~/.reef/credentials.json` (created by `reef login`). By default it talks to `https://reef.app`. Override either piece:

- `REEF_MCP_API=https://my-host.example.com`
- `REEF_MCP_TOKEN=<bearer>` (bypasses the credentials file)

## Wire it into Claude Code

```sh
claude mcp add reef reef-mcp
```

Or, in `~/.claude.json`:

```json
{
  "mcpServers": {
    "reef": {
      "command": "reef-mcp"
    }
  }
}
```

## Tools

| Tool           | Description                                                          |
| -------------- | -------------------------------------------------------------------- |
| `list_deploys` | List deploys owned by the current user (id, url, status, createdAt). |
| `deploy_files` | List files in a deploy's source tree.                                |
| `read_file`    | Read a source file (e.g. `server/index.ts`).                         |
| `write_file`   | Overwrite a source file. Pair with `build_deploy` to apply.          |
| `build_deploy` | Rebuild the bundle from current source. Returns hash + size.         |
| `tail_logs`    | Return the last N log entries (default 100).                         |
| `env_list`     | List env keys (masked values).                                       |
| `env_set`      | Set / update an env var. Triggers a host-side rebuild + restart.     |

## Reference impl

See `src/mcp/server.ts`.
