import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

const CONTENT_URL = "https://taylortreece.dev/content.json";

// Cache the fetched content for the life of the isolate. Workers reuse
// isolates across requests, so this avoids refetching on every call without
// introducing any protocol session state.
let cached = null;
let cachedAt = 0;
const TTL_MS = 5 * 60 * 1000;

async function getContent() {
  const now = Date.now();
  if (cached && now - cachedAt < TTL_MS) return cached;

  const res = await fetch(CONTENT_URL, {
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!res.ok) {
    throw new Error(`Could not load content (${res.status})`);
  }
  cached = await res.json();
  cachedAt = now;
  return cached;
}

const text = (value) => ({
  content: [
    {
      type: "text",
      text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
    },
  ],
});

function createServer() {
  const server = new McpServer({
    name: "taylor-treece",
    version: "1.0.0",
  });

  server.registerTool(
    "search_writing",
    {
      description:
        "Search Taylor Treece's technical writing (the Field Notes blog) by keyword or topic. " +
        "Returns matching posts with their title, URL, an outline of sections, and a relevant excerpt. " +
        "Use this for questions about his opinions, technical approach, or how he thinks about a problem. " +
        "Topics covered include MCP and agent architecture, hyperautomation, CCaaS and Twilio Flex, " +
        "project scoping, and on-prem to cloud modernization.",
      inputSchema: {
        query: z
          .string()
          .describe("Keyword or topic, for example 'MCP identity' or 'scope'"),
        full_text: z
          .boolean()
          .optional()
          .describe("Return the entire post body instead of an excerpt. Defaults to false."),
      },
    },
    async ({ query, full_text = false }) => {
      const { posts } = await getContent();
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

      const scored = posts
        .map((post) => {
          const haystack = `${post.title} ${post.description} ${post.sections.join(" ")} ${post.body}`.toLowerCase();
          const score = terms.reduce(
            (sum, term) => sum + (haystack.split(term).length - 1),
            0
          );
          return { post, score };
        })
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      if (scored.length === 0) {
        return text(
          `No posts matched "${query}". Available posts: ` +
            posts.map((p) => p.title).join("; ")
        );
      }

      return text(
        scored.map(({ post }) => {
          const lower = post.body.toLowerCase();
          const hit = lower.indexOf(terms[0]);
          const excerpt =
            hit >= 0
              ? post.body.slice(Math.max(0, hit - 200), hit + 800)
              : post.body.slice(0, 800);

          return {
            title: post.title,
            url: post.url,
            sections: post.sections,
            [full_text ? "body" : "excerpt"]: full_text ? post.body : `...${excerpt}...`,
          };
        })
      );
    }
  );

  server.registerTool(
    "get_experience",
    {
      description:
        "Get Taylor Treece's professional background: roles, organizations, dates, and what was " +
        "actually built in each. Optionally filter to roles involving a specific technology. " +
        "Use this for questions about his work history, seniority, or hands-on experience with a stack.",
      inputSchema: {
        technology: z
          .string()
          .optional()
          .describe(
            "Optional filter, for example 'Twilio', 'Blazor', or 'SQL Server'. Omit to return all roles."
          ),
      },
    },
    async ({ technology }) => {
      const { person, experience, skills } = await getContent();

      if (!technology) {
        return text({ person, experience, skills });
      }

      const needle = technology.toLowerCase();
      const matches = experience.filter(
        (role) =>
          role.technologies.some((t) => t.toLowerCase().includes(needle)) ||
          role.summary.toLowerCase().includes(needle)
      );

      if (matches.length === 0) {
        const all = Object.values(skills).flat().join(", ");
        return text(
          `No roles matched "${technology}". Skills on record: ${all}`
        );
      }
      return text({ person, matchedRoles: matches });
    }
  );

  server.registerTool(
    "get_project_detail",
    {
      description:
        "Get the detailed story behind a specific project Taylor Treece built, including the " +
        "architectural decisions and why they were made. Call with no arguments to list available " +
        "projects. Use this when someone wants depth on a particular piece of work rather than a " +
        "resume-level summary.",
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe(
            "Project id or name. Omit to list what is available."
          ),
      },
    },
    async ({ project }) => {
      const { projects } = await getContent();

      if (!project) {
        return text(
          projects.map((p) => ({ id: p.id, name: p.name, org: p.org }))
        );
      }

      const needle = project.toLowerCase();
      const match =
        projects.find((p) => p.id.toLowerCase() === needle) ||
        projects.find(
          (p) =>
            p.name.toLowerCase().includes(needle) ||
            p.id.toLowerCase().includes(needle)
        );

      if (!match) {
        return text(
          `No project matched "${project}". Available: ` +
            projects.map((p) => p.id).join(", ")
        );
      }
      return text(match);
    }
  );

  return server;
}

const handler = createMcpHandler(createServer);

export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url);

    // a plain GET on the root is useful for a human who pastes the URL
    // into a browser, since /mcp itself only speaks the protocol
    if (url.pathname === "/") {
      return new Response(
        "MCP server for taylortreece.dev\n\n" +
          "Endpoint: /mcp\n" +
          "Tools: search_writing, get_experience, get_project_detail\n",
        { headers: { "content-type": "text/plain" } }
      );
    }

    return handler(request, env, ctx);
  },
};