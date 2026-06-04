/**
 * Smoke-test the drinkanddraw-tags MCP server (stdio) and underlying API.
 * Usage: node scripts/test-tags-mcp.mjs
 * Env: DRINKANDDRAW_API_URL, DRINKANDDRAW_TAG_API_KEY
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiUrl = process.env.DRINKANDDRAW_API_URL?.trim() || "http://apps:3081";
const apiKey = process.env.DRINKANDDRAW_TAG_API_KEY?.trim();

if (!apiKey) {
  console.error("FAIL: set DRINKANDDRAW_TAG_API_KEY");
  process.exit(1);
}

const transport = new StdioClientTransport({
  command: process.platform === "win32" ? "npx.cmd" : "npx",
  args: ["tsx", path.join(root, "mcp/drinkanddraw-tags/src/index.ts")],
  cwd: root,
  env: {
    ...process.env,
    DRINKANDDRAW_API_URL: apiUrl,
    DRINKANDDRAW_TAG_API_KEY: apiKey,
  },
});

const client = new Client({ name: "mcp-smoke-test", version: "1.0.0" });

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  console.log("OK connect + listTools:", names.length, "tools");
  console.log("  tools:", names.join(", "));

  const listResult = await client.callTool({ name: "tags_list", arguments: { q: "female" } });
  const text = listResult.content?.find((c) => c.type === "text")?.text ?? "";
  const parsed = JSON.parse(text);
  if (!parsed.items?.length) throw new Error("tags_list returned no items");
  console.log("OK tags_list:", parsed.items[0].name, "count=", parsed.items[0].referenceCount);

  const reviewResult = await client.callTool({
    name: "tags_list_numeric_review",
    arguments: { page: 1, pageSize: 2 },
  });
  const reviewText = reviewResult.content?.find((c) => c.type === "text")?.text ?? "";
  const review = JSON.parse(reviewText);
  console.log("OK tags_list_numeric_review: total=", review.total, "sample_url=", review.items[0]?.url ?? "(empty)");

  await client.close();
  console.log("\nMCP smoke test passed.");
} catch (err) {
  console.error("FAIL:", err);
  process.exit(1);
}
