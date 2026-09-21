// Static site build: content/*.json + content/posts/*.md -> index.html + blog/<slug>/index.html + meet/index.html
// Run: node build.js
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { Marked } from "./lib/marked.esm.js";

const site = JSON.parse(readFileSync("content/site.json", "utf8"));

/* ---------- posts ---------- */

function parsePost(file) {
  const raw = readFileSync(`content/posts/${file}`, "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  const meta = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { ...meta, slug: file.replace(/\.md$/, ""), body: raw.slice(m[0].length) };
}

const posts = readdirSync("content/posts")
  .filter((f) => f.endsWith(".md"))
  .map(parsePost)
  .sort((a, b) => b.date.localeCompare(a.date));

/* ---------- markdown ---------- */

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ponytail: regex highlighter, good enough for js/css snippets; swap in shiki at build time if fidelity matters
function highlight(code, lang) {
  const rules = [
    [/\/\/[^\n]*|\/\*[\s\S]*?\*\//, "com"],
    [/"[^"\n]*"|'[^'\n]*'|`[^`]*`/, "str"],
    [/\b(?:const|let|var|function|return|if|else|for|while|new|class|extends|import|export|from|async|await|typeof|of|in|null|undefined|true|false|this)\b/, "kw"],
    [/@[\w-]+|\b\d+(?:\.\d+)?(?:ms|s|px|em|rem|%)?\b/, "num"],
    [/[\w-]+(?=\()/, "fn"],
    [/[a-zA-Z-]+(?=\s*:)/, lang === "css" ? "attr" : null],
  ];
  const master = new RegExp(rules.map(([r]) => `(${r.source})`).join("|"), "g");
  const out = code.replace(master, (match, ...groups) => {
    const i = groups.slice(0, rules.length).findIndex((g) => g !== undefined);
    const cls = i >= 0 && rules[i][1];
    return cls ? `\x01${cls}\x02${match}\x03` : match;
  });
  return esc(out)
    .replace(/\x01(\w+)\x02/g, '<span class="tok-$1">')
    .replace(/\x03/g, "</span>");
}

const slugify = (s) => s.toLowerCase().replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");

const ARROW_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 12h13M13 6.5 18.5 12 13 17.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /></svg>`;

const marked = new Marked({
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const id = slugify(text.replace(/<[^>]*>/g, ""));
      return `<a class="h-anchor" href="#${id}"><h${depth} id="${id}">${text}</h${depth}></a>\n`;
    },
    code({ text, lang }) {
      const lines = highlight(text, lang)
        .split("\n")
        .map((l) => `<span class="line">${l || " "}</span>`)
        .join("\n");
      return `<div class="code-block"><pre><code>${lines}</code></pre></div>\n`;
    },
    // a markdown link whose text ends with "→" renders as an arrow link
    link({ href, tokens }) {
      const text = this.parser.parseInline(tokens);
      if (!text.endsWith("→")) return false; // fall back to default rendering
      const label = text.replace(/\s*→$/, "");
      const blank = /^https?:/.test(href) ? ' target="_blank"' : "";
      return `<a class="arrow-link" href="${href}"${blank}>${label}${ARROW_SVG}</a>`;
    },
  },
});

/* ---------- templates ---------- */

const shell = ({ title, description, content, scripts = "" }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="preload" href="/fonts/InterVariable.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div class="layout-root">
      <header class="site-header">
        <a class="site-name" href="/">${site.name}</a>
        <span class="site-role">${site.role}</span>
      </header>

      <main>
${content}
      </main>
    </div>

    <script src="/script.js"></script>${scripts}
  </body>
</html>
`;

const listItem = ({ href, name, description, external }) => `            <a href="${href}"${external ? ' target="_blank"' : ""} class="item">
              <span>${name}</span>
              <span class="muted">${description}</span>
            </a>`;

const blogLimit = site.blogLimit ?? 5;
const recentPosts = posts.slice(0, blogLimit);

const homepage = () => shell({
  title: site.name,
  description: site.description,
  content: `        <span class="section-label">Today</span>
${site.today.map((p, i) => `        <p class="muted${i ? " mt-4" : ""}">${p}</p>`).join("\n")}

        <div class="list-section">
          <span class="section-label list-label">Projects/Researches</span>
          <div class="list">
${site.projects.map((p) => listItem({ href: p.href, name: p.name, description: p.description, external: true })).join("\n")}
          </div>
        </div>

        <div class="list-section">
          <span class="section-label list-label">Blog</span>
          <div class="list">
${recentPosts.map((p) => listItem({ href: `/blog/${p.slug}/`, name: p.title, description: p.description })).join("\n")}
          </div>
          <a class="arrow-link" href="/blog/">See all${ARROW_SVG}</a>
        </div>

        <div class="newsletter-section">
          <span class="section-label">Newsletter</span>
          <span class="muted block">${site.newsletter.description}</span>
          <form class="newsletter">
            <label for="email" class="sr-only">Email</label>
            <input id="email" required placeholder="Enter your email" value="" />
            <button type="submit">
              <span>${site.newsletter.button}</span>
            </button>
          </form>
        </div>

        <div class="more-section">
          <span class="section-label">More</span>
          <span class="muted">${site.more}</span>
        </div>`,
});

const blogIndex = () => shell({
  title: "Blog",
  description: `Blog by ${site.name}`,
  content: `        <span class="section-label list-label">Blog</span>
        <div class="list">
${posts.map((p) => listItem({ href: `/blog/${p.slug}/`, name: p.title, description: p.description })).join("\n")}
        </div>`,
});

// /meet/ — link-only group scheduler; the page is a shell, meet.js renders the rest
const meetPage = () => shell({
  title: "Meet",
  description: `Find a time that works for everyone. A link-only scheduler by ${site.name}.`,
  content: `        <div class="meet">
          <div class="meet-intro">
            <span class="section-label">Meet</span>
            <p class="muted">Pick the days and hours that could work, share the link, and everyone paints in when they're free. There's no account and no server: every answer lives in the link itself, so always pass along the newest one.</p>
            <noscript><p class="muted mt-4">This page needs JavaScript.</p></noscript>
          </div>
          <div class="meet-app"></div>
        </div>`,
  scripts: `\n    <script src="/meet.js" defer></script>`,
});

const postPage = (post) => shell({
  title: post.title,
  description: post.description,
  content: `        <div class="article">
${marked.parse(post.body).replace(/<p>(<demo-[\w-]+[^>]*><\/demo-[\w-]+>)<\/p>/g, "$1")}
        </div>`,
  scripts: `\n    <script src="/widgets.js" defer></script>`,
});

/* ---------- write ---------- */

writeFileSync("index.html", homepage());
rmSync("blog", { recursive: true, force: true }); // deleted/renamed posts leave no stale pages
mkdirSync("blog", { recursive: true });
writeFileSync("blog/index.html", blogIndex());
mkdirSync("meet", { recursive: true });
writeFileSync("meet/index.html", meetPage());
for (const post of posts) {
  mkdirSync(`blog/${post.slug}`, { recursive: true });
  writeFileSync(`blog/${post.slug}/index.html`, postPage(post));
}
console.log(`built index.html + ${posts.length} posts + meet/`);
