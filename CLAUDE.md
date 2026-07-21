# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A dependency-free static portfolio site whose design recreates https://emilkowal.ski/ (layout, spacing, typography, motion) with original content. No framework, no node_modules — the only library is a vendored copy of marked at `lib/marked.esm.js`.

## Commands

- `npm run build` (= `node build.js`) — regenerates `index.html` and `blog/<slug>/index.html` from `content/`. Success prints `built index.html + N posts`. Run after any change to `content/` or the templates in `build.js`.
- Serve: `python3 server.py` from the repo root (http.server on port 4173 plus `Cache-Control: no-cache` — plain `python3 -m http.server` heuristically caches edited CSS/JS and will show stale styles). The browser-preview launch config `portfolio` (`.claude/launch.json`) runs it. Generated pages use root-relative asset paths, so serving from the repo root is required.
- No tests, no linter.
- Deploy: `git push origin main` — this repo *is* `takeachangs/takeachangs.github.io`, live at https://seongm.in/ via GitHub Pages. Run `npm run build` and commit the regenerated output before pushing; Pages serves whatever's committed, it doesn't run the build. `CNAME` (custom domain) and `.nojekyll` (tells Pages to serve the pre-built HTML as-is, skip Jekyll) must stay at the repo root — don't delete them. The old Jekyll site's full history lives on the `backup-pre-portfolio2` branch.

## Architecture: content → build → generated output

- `content/site.json` — all homepage data: name, role, bio paragraphs (HTML allowed), projects, newsletter copy, footer links.
- `content/posts/*.md` — articles. Front matter `title` / `description` / `date`; filename (minus `.md`) is the slug and the URL `/blog/<slug>/`. The homepage Blog list is generated from these, newest first, capped at `site.json`'s `blogLimit` (default 5); a "See all →" arrow link under the list leads to the generated `/blog/` index page that lists every post.
- `build.js` — the entire build: front-matter parser, marked with custom renderers (`##` → self-linking anchor with slugged id; fenced code → highlighted line grid via a small regex highlighter for `js`/`css`), demo-widget tags unwrapped from `<p>`, and all page templates as template literals. To change page structure, edit the templates here.
- Generated output — **never edit by hand**: `index.html` and `blog/` (the build deletes and recreates `blog/` every run, so removed or renamed posts leave no stale pages).
- Hand-maintained runtime assets: `styles.css` (all styling, including design tokens), `script.js` (newsletter label morph; loaded on every page), `widgets.js` (post demo widgets; post pages only), `fonts/`.

## Design fidelity rules

The design was matched to emilkowal.ski numerically (bounding-rect comparisons at 375/700/1280px). Odd-looking values are measured, not accidental — do not normalize them (e.g. 26px paragraph margins, 0.9 article opacity, 13.72px inline code, the -25px mobile card breakout, the 692px column, breakpoints at exactly 640/768px).

- Colors are the Radix Sand scale as custom properties in `styles.css`; dark mode is pure `@media (prefers-color-scheme: dark)` — there is no theme toggle.
- Fonts: Inter Variable is the true match to the original. Geist Mono and Newsreader italic are OFL substitutes for the original's Berkeley Mono and Tiempos Text, which are commercial — never fetch or vendor those. The substitutes ship latin subsets only.
- Content must stay original prose. The design is the recreation; never copy text from emilkowal.ski.

## Post format

`##` headings only — posts have no visible title (title lives in the tab/meta), so never use `#`. `*em*` renders as a serif italic accent, backtick spans as gray mono chips, `js`/`css` fences get highlighting. Interactive demos are raw HTML tags on their own line with blank lines around them: `<demo-transition>`, `<demo-speed>`, `<demo-toast>`, `<demo-morph>`, each with a `caption="..."` attribute. The full spec (field formats, widget usage rules, voice guide, skeleton) lives in the `portfolio` plugin: `~/plugins/portfolio/skills/write-article/references/post-format.md`.

## Gotchas

- Never gate a CSS transition's start state on `requestAnimationFrame` — background tabs freeze rAF and the transition never fires. Force a synchronous reflow instead (`void el.offsetHeight`) before applying the target state; `script.js` and `widgets.js` already follow this pattern.
- A new demo widget needs both a custom element in `widgets.js` and its CSS in `styles.css`; reuse the shared `.demo` / `.demo-stage` / `.demo-caption` card chrome.
- The newsletter form has no backend; the hook point is marked with a `ponytail:` comment in `script.js`.

## Still placeholder

Project links (`#`), X/GitHub usernames in `content/site.json`, and the newsletter backend.
