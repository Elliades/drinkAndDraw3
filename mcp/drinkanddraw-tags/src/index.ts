#!/usr/bin/env node
/**
 * MCP server for drinkAndDraw tag management (stdio).
 *
 * Env:
 *   DRINKANDDRAW_API_URL — default http://localhost:3000
 *   DRINKANDDRAW_TAG_API_KEY — required (matches TAG_API_KEY on the app)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createTagsApiClient } from "./client.js";

const baseUrl = process.env.DRINKANDDRAW_API_URL?.trim() || "http://localhost:3000";
const apiKey = process.env.DRINKANDDRAW_TAG_API_KEY?.trim();

if (!apiKey) {
  console.error("DRINKANDDRAW_TAG_API_KEY is required");
  process.exit(1);
}

const api = createTagsApiClient({ baseUrl, apiKey });

const server = new McpServer({
  name: "drinkanddraw-tags",
  version: "1.0.0",
});

server.tool("tags_list", "List tags with reference counts", { q: z.string().optional() }, async ({ q }) => {
  const result = await api.listTags(q);
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

server.tool(
  "reference_get_tags",
  "Get USER tags on a reference",
  { referenceId: z.string() },
  async ({ referenceId }) => {
    const result = await api.getReferenceTags(referenceId);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "reference_set_tags",
  "Replace USER tags on a reference (normalization rules applied)",
  {
    referenceId: z.string(),
    tags: z.array(z.string()),
  },
  async ({ referenceId, tags }) => {
    const result = await api.setReferenceTags(referenceId, tags);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "reference_add_tag",
  "Add one tag to a reference",
  { referenceId: z.string(), tag: z.string() },
  async ({ referenceId, tag }) => {
    const result = await api.addReferenceTag(referenceId, tag);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "reference_remove_tag",
  "Remove one tag from a reference",
  { referenceId: z.string(), tagName: z.string() },
  async ({ referenceId, tagName }) => {
    const result = await api.removeReferenceTag(referenceId, tagName);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "tags_normalize_all",
  "Apply normalization rules to all USER tags (numeric gender compounds, drop part)",
  { dryRun: z.boolean().optional() },
  async ({ dryRun }) => {
    const result = await api.normalizeAll(dryRun);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "tags_list_numeric_review",
  "List references with bare numeric tags (no female/male) and library URLs for manual review",
  {
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(1).max(100).optional(),
  },
  async ({ page, pageSize }) => {
    const result = await api.listNumericReview(page, pageSize);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.resource(
  "numeric-review",
  "tags://review/numeric",
  { description: "First page of references needing numeric tag review" },
  async () => {
    const result = await api.listNumericReview(1, 50);
    return {
      contents: [
        {
          uri: "tags://review/numeric",
          mimeType: "application/json",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
