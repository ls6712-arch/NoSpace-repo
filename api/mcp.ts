import type { IncomingMessage, ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { hobbies } from "../src/app/data/hobbies.js";

/**
 * Public, read-only MCP endpoint. Never expose user moments, profiles, tokens,
 * service-role credentials, or private Supabase data from this endpoint.
 */
function createServer() {
  const server = new McpServer({ name: "soosh", version: "0.1.0" });

  server.registerTool(
    "discover_hobbies",
    {
      title: "Discover hobbies on Soosh",
      description: "Search Soosh's curated hobby and activity categories. These are ideas, not bookable local events.",
      inputSchema: {
        interest: z.string().max(120).optional(),
        limit: z.number().int().min(1).max(20).default(10),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ interest, limit }) => {
      const needle = interest?.trim().toLowerCase() ?? "";
      const results = hobbies
        .filter((h) => !h.hidden)
        .flatMap((h) => h.subItems.map((item) => ({
          name: item.label,
          category: h.name,
          categorySlug: h.slug,
          url: `https://www.onsoosh.com/#/space/${encodeURIComponent(h.slug)}`,
          searchText: [item.label, h.name, ...(h.keywords ?? [])].join(" ").toLowerCase(),
        })))
        .filter((item) => !needle || item.searchText.includes(needle))
        .slice(0, limit)
        .map(({ searchText: _searchText, ...item }) => item);
      return { content: [{ type: "text", text: JSON.stringify({ results, note: "Curated hobbies only; no live events, availability or pricing verified." }) }] };
    },
  );

  server.registerTool(
    "list_hobby_spaces",
    {
      title: "List Soosh hobby spaces",
      description: "List the public curated hobby categories available on Soosh.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => ({
      content: [{
        type: "text",
        text: JSON.stringify(hobbies.filter((h) => !h.hidden).map((h) => ({
          name: h.name,
          description: h.description,
          url: `https://www.onsoosh.com/#/space/${encodeURIComponent(h.slug)}`,
        }))),
      }],
    }),
  );
  return server;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // MCP is stateless for this public discovery integration.
  if (req.method !== "POST" && req.method !== "GET" && req.method !== "DELETE") {
    res.writeHead(405, { Allow: "GET, POST, DELETE" }).end();
    return;
  }
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => { void transport.close(); void server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error("Soosh MCP request failed", error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" })
        .end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null }));
    }
  }
}
