#!/usr/bin/env node
/**
 * Reads the blog HTML files and the experience data below, and emits
 * content.json into the site root. That file becomes the single thing the
 * MCP Worker fetches, so the site stays the source of truth and the Worker
 * stays stateless.
 *
 * Run from the site root:  node mcp/scripts/build-content.js
 */

const fs = require("fs");
const path = require("path");

// site root, assuming this file lives at <root>/mcp/scripts/
const ROOT = path.resolve(__dirname, "..", "..");
const BLOG_DIR = path.join(ROOT, "blogs");
const OUT = path.join(ROOT, "content.json");

// ---------------------------------------------------------------------------
// Experience: edit this by hand. It is the one thing not derived from the site.
// ---------------------------------------------------------------------------

const EXPERIENCE = [
  {
    title: "Director of Applications and Integrations",
    org: "William Carey University",
    start: "2025",
    end: "Present",
    technologies: ["ASP.NET", "C#", "Python", "SQL Server", "CI/CD", "SIS"],
    summary:
      "Leads the migration from an on-prem to a cloud-based Student Information System and directs eight new third-party vendor integrations alongside it. Leads a four-person team and reports system status and risk directly to executive leadership and the board. Cleaned up three legacy platforms and set team standards for source control, CI/CD, and documentation.",
  },
  {
    title: "Senior Programmer",
    org: "William Carey University",
    start: "2024",
    end: "2025",
    technologies: ["Blazor", "ASP.NET", "IIS", "SQL Server", "REST APIs"],
    summary:
      "Built a centralized internal tools platform on Blazor, ASP.NET APIs, and IIS that departments across campus use instead of one-off spreadsheets and scripts. Ran technical discovery and solution design for new vendor implementations, defining data models, integration patterns, and system boundaries.",
  },
  {
    title: "Software Analyst",
    org: "William Carey University",
    start: "2023",
    end: "2024",
    technologies: ["ASP.NET 7", "REST APIs", "Machine Learning", "Generative AI"],
    summary:
      "Built RESTful APIs on ASP.NET 7 connecting academic and administrative systems that had not previously exchanged data. Applied machine learning and generative AI to automate transcript translation, cutting processing effort by roughly 98%.",
  },
  {
    title: "Solutions Developer / Pre-Sales CX",
    org: "Waterfield Technologies",
    start: "2022",
    end: "2023",
    technologies: ["Twilio Flex", "React", "Redux", "Node.js", "CCaaS"],
    summary:
      "Designed and demoed twelve custom CCaaS environments on Twilio Flex, React, and Node.js, with more than 80% converting to follow-on phases. Ran discovery, wrote SOWs, and built estimates and pricing models. Stepped into a failing client engagement, ran a fast re-discovery and redesign, and kept the contract alive for two additional phases. Built deployment tooling that cut environment setup time by about eight hours.",
  },
];

const PROJECTS = [
  {
    id: "internal-toolbox",
    name: "Internal tools platform",
    org: "William Carey University",
    detail:
      "A Blazor front end sitting in front of two separate ASP.NET Web APIs, backed by SQL Server, with authorization driven by existing directory group membership. Built on prem because that is where the institution was, but structured so on prem was a deployment target rather than an assumption baked into the code: the front end talks to APIs over HTTP rather than reaching into a database directly, environment specifics live in configuration, and data access goes through the API layer. The two-API split separates internal tooling from vendor integrations, making the trust boundary structural rather than a convention a developer has to remember. Front end and API were saved as templates in source control so new tools start as a fork and inherit the same wiring and conventions.",
  },
  {
    id: "transcript-automation",
    name: "Transcript evaluation automation",
    org: "William Carey University",
    detail:
      "Transfer students arrive with transcripts from other institutions, each with its own formatting, terminology, and credit conventions. Applying machine learning and generative AI to the translation step cut processing effort by roughly 98%. Deliberately scoped: the system does not decide whether a course transfers. That judgment stayed with the people whose job it is.",
  },
  {
    id: "ccaas-deployments",
    name: "CCaaS environments on Twilio Flex",
    org: "Waterfield Technologies",
    detail:
      "Twelve custom contact center environments designed, built, and demoed across Studio flows, TaskRouter configuration, and custom Flex plugins. More than 80% converted to follow-on phases. Included one rescued engagement: a fast round of re-discovery found where scope had drifted from what the client needed, and the redesign kept the contract alive for two more phases.",
  },
];

const SKILLS = {
  "Software Engineering": [
    "C#", "ASP.NET", "ASP.NET Core", "Blazor", "Python", "SQL Server",
    "REST APIs", "JavaScript", "React", "Node.js",
  ],
  "Architecture & Integrations": [
    "Enterprise architecture", "Solutions architecture", "API architecture",
    "Cloud architecture", "ERP/CRM/SIS integrations", "Salesforce",
  ],
  "AI & Automation": [
    "Generative AI", "Agentic and multi-agent systems", "MCP",
    "Conversational AI", "Intent recognition", "Intelligent routing",
  ],
  "CX & Contact Center": [
    "CCaaS architecture", "Contact center design", "Workflow orchestration",
    "Twilio Flex", "Demo environment design",
  ],
  "Consulting & Pre-Sales": [
    "Technical discovery", "SOW development", "Estimation",
    "Proposal and RFP development", "Solution design", "Stakeholder workshops",
  ],
};

// ---------------------------------------------------------------------------
// Blog parsing
// ---------------------------------------------------------------------------

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html, attr, value) {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${value}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${value}["']`,
    "i"
  );
  const m = html.match(re) || html.match(alt);
  return m ? m[1] : null;
}

function parsePost(file) {
  const html = fs.readFileSync(file, "utf8");
  const slug = path.basename(file, ".html");

  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title =
    (h1 && stripTags(h1[1])) ||
    metaContent(html, "property", "og:title") ||
    slug;

  const description =
    metaContent(html, "name", "description") ||
    metaContent(html, "property", "og:description") ||
    "";

  // section headers give a useful outline for the agent
  const sections = [...html.matchAll(/<h2[^>]*class="post-subhead"[^>]*>([\s\S]*?)<\/h2>/gi)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean);

  // body text: paragraphs inside the article body
  const bodyMatch = html.match(
    /<!--\s*ARTICLE BODY\s*-->([\s\S]*?)<!--\s*NAV BETWEEN ENTRIES\s*-->/i
  );
  const bodyHtml = bodyMatch ? bodyMatch[1] : html;
  const paragraphs = [...bodyHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((t) => t.length > 40);

  return {
    slug,
    title,
    description,
    url: `https://taylortreece.dev/blogs/${slug}`,
    sections,
    body: paragraphs.join("\n\n"),
  };
}

// ---------------------------------------------------------------------------

function main() {
  if (!fs.existsSync(BLOG_DIR)) {
    console.error(`No blogs directory at ${BLOG_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".html") && f !== "index.html")
    .map((f) => path.join(BLOG_DIR, f));

  const posts = files.map(parsePost);

  const payload = {
    generatedAt: new Date().toISOString(),
    person: {
      name: "Taylor Treece",
      title: "Director of Applications and Integrations",
      location: "Hattiesburg, MS",
      site: "https://taylortreece.dev",
      linkedin: "https://www.linkedin.com/in/taylor-treece-dev/",
      summary:
        "Solutions-focused technical leader working across enterprise application development, systems integration, and AI-driven automation. Currently directing a cloud SIS migration and eight vendor integrations in higher education. Previously pre-sales and solutions consulting on cloud contact center platforms.",
    },
    experience: EXPERIENCE,
    projects: PROJECTS,
    skills: SKILLS,
    posts,
  };

  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${OUT}`);
  console.log(`  ${posts.length} posts`);
  posts.forEach((p) =>
    console.log(`    ${p.slug}: "${p.title}" (${p.body.length} chars, ${p.sections.length} sections)`)
  );
}

main();