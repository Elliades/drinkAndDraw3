# drinkAndDraw Tags MCP

stdio MCP server that wraps `/api/tags/v1` on the drinkAndDraw app.

## Environment

| Variable | Description |
| -------- | ----------- |
| `DRINKANDDRAW_API_URL` | App base URL (default `http://localhost:3000`, prod `http://apps:3081`) |
| `DRINKANDDRAW_TAG_API_KEY` | Same value as `TAG_API_KEY` on the Next.js app |

## Run

From the repo root (uses root `node_modules`):

```bash
npm run mcp:tags
```

## Cursor configuration

Add to `.cursor/mcp.json` (project) or user MCP settings:

```json
{
  "mcpServers": {
    "drinkanddraw-tags": {
      "command": "npx",
      "args": ["tsx", "mcp/drinkanddraw-tags/src/index.ts"],
      "cwd": "C:/workspace/web/drinkanddraw-v3",
      "env": {
        "DRINKANDDRAW_API_URL": "http://apps:3081",
        "DRINKANDDRAW_TAG_API_KEY": "your-tag-api-key"
      }
    }
  }
}
```

## Tools

- `tags_list` — list tags with counts
- `reference_get_tags` / `reference_set_tags` / `reference_add_tag` / `reference_remove_tag`
- `tags_normalize_all` — bulk apply normalization (`dryRun` optional)
- `tags_list_numeric_review` — references with bare `1`, `2`, … and no gender tag

## Resource

- `tags://review/numeric` — JSON snapshot of the numeric review queue (page 1)
