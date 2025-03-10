#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import Discourse from "discourse2";
import { z } from "zod";

// Get optional API URL
const DISCOURSE_API_URL = process.env.DISCOURSE_API_URL;
const DISCOURSE_API_KEY = process.env.DISCOURSE_API_KEY;
const DISCOURSE_API_USERNAME = process.env.DISCOURSE_API_USERNAME;

// Create server instance
const server = new McpServer({
	name: "discourse",
	version: "1.0.0",
});

if (!DISCOURSE_API_URL) {
	console.error("DISCOURSE_API_URL environment variable is required");
	process.exit(1);
}

const options: Record<string, string> = {};
if (DISCOURSE_API_KEY) {
	options["Api-Key"] = DISCOURSE_API_KEY;
}
if (DISCOURSE_API_USERNAME) {
	options["Api-Username"] = DISCOURSE_API_USERNAME;
}
const discourse = new Discourse(DISCOURSE_API_URL, options);

// Register discourse tools
server.tool(
	"search_posts",
	"Search Discourse posts",
	{
		query: z.string().min(5).describe("Query"),
	},
	async ({ query }) => {
		try {
			const results = await discourse.search({ q: query });

			if (!results?.posts || results.posts.length < 1) {
				return {
					content: [
						{
							type: "text",
							text: `Could not find posts for the query: "${query}"`,
						},
					],
				};
			}

			const posts = await Promise.all(
				results.posts.map((post: Record<string, unknown>) =>
					// biome-ignore lint: useLiteralKeys
					discourse.getPost({ id: String(post["id"]) }),
				),
			);

			return {
				content: posts.map(
					(post: {
						id?: string;
						raw?: string;
						post_url?: string;
						user_title?: string;
						topic_slug?: string;
					}) => ({
						type: "text",
						text: JSON.stringify({
							id: post.id,
							raw: post.raw,
							post_url: `${DISCOURSE_API_URL}${post.post_url}`,
							user_title: post.user_title,
							topic_slug: post.topic_slug,
						}),
					}),
				),
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Error: "${(error as Error).message}"`,
					},
				],
				isError: true,
			};
		}
	},
);

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("Discourse MCP Server running on stdio");
}

main().catch((error) => {
	console.error("Fatal error in main():", error);
	process.exit(1);
});
