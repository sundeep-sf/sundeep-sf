#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const matter = require("gray-matter");
const MarkdownIt = require("markdown-it");

const markdown = new MarkdownIt({ html: true, linkify: true, typographer: false });

function readOption(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : path.resolve(process.argv[index + 1]);
}

const repositoryRoot = path.resolve(__dirname, "..");
const contentRoot = readOption("--content-root", path.join(repositoryRoot, "content"));
const outputRoot = readOption("--output-root", repositoryRoot);
const checkOnly = process.argv.includes("--check");

function sourceDigest(source) {
  return crypto.createHash("sha256").update(source).digest("hex");
}

function readMarkdown(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  return { ...matter(source), source };
}

function loadNotes() {
  const notesRoot = path.join(contentRoot, "notes");
  return fs.readdirSync(notesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const noteRoot = path.join(notesRoot, entry.name);
      const note = readMarkdown(path.join(noteRoot, "note.md"));
      const outline = readMarkdown(path.join(noteRoot, "outline.md"));

      if (outline.data.source_digest !== sourceDigest(note.source)) {
        throw new Error(`Outline is stale for ${entry.name}. Update it from the current raw note.`);
      }

      const requiredFields = ["title", "date", "status", "summary", "slug"];
      for (const field of requiredFields) {
        if (!note.data[field]) {
          throw new Error(`Missing ${field} metadata for ${entry.name}.`);
        }
      }
      if (note.data.slug !== entry.name) {
        throw new Error(`The slug for ${entry.name} must match its directory name.`);
      }
      if (!["published", "draft"].includes(note.data.status)) {
        throw new Error(`The status for ${entry.name} must be published or draft.`);
      }

      return { metadata: note.data, note, outline };
    });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderOutline(source) {
  const tokens = markdown.parse(source, {});
  const root = { children: [], level: 0, tokens: [] };
  const stack = [root];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== "heading_open") {
      stack.at(-1).tokens.push(token);
      continue;
    }

    const level = Number(token.tag.slice(1));
    const titleToken = tokens[index + 1];
    while (stack.at(-1).level >= level) {
      stack.pop();
    }

    const section = {
      children: [],
      level,
      title: markdown.renderInline(titleToken.content),
      tokens: [],
    };
    stack.at(-1).children.push(section);
    stack.push(section);
    index += 2;
  }

  const renderSection = (section, depth) => `
<section class="section" data-outline-depth="${depth}">
  <div class="section-heading expanded" role="button" tabindex="0">
    <span class="indicator" aria-hidden="true">&#9656;</span>
    <h${Math.min(section.level, 6)}>${section.title}</h${Math.min(section.level, 6)}>
  </div>
  <div class="section-content">
    ${markdown.renderer.render(section.tokens, markdown.options, {})}
    ${section.children.map((child) => renderSection(child, depth + 1)).join("")}
  </div>
</section>`;

  return [
    markdown.renderer.render(root.tokens, markdown.options, {}),
    root.children.map((section) => renderSection(section, 1)).join(""),
  ].join("");
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function renderNoteCards(notes, linkPrefix) {
  return notes.map(({ metadata }) => {
    const status = metadata.status === "draft" ? " &middot; Draft" : "";
    return `
    <a href="${linkPrefix}${escapeHtml(metadata.slug)}/" class="note-card" data-preserve-view>
      <div class="note-title">${escapeHtml(metadata.title)}</div>
      <div class="note-meta">${escapeHtml(formatDate(metadata.date))}${status}</div>
      <div class="note-desc">${escapeHtml(metadata.summary)}</div>
    </a>`;
  }).join("");
}

function renderHomepageGroups(notes, outlined) {
  const groups = [
    ["Published notes", notes.filter(({ metadata }) => metadata.status === "published")],
    ["Draft notes", notes.filter(({ metadata }) => metadata.status === "draft")],
  ].filter(([, groupNotes]) => groupNotes.length > 0);

  if (!outlined) {
    return groups.map(([title, groupNotes]) => `
<section class="note-group">
  <h2>${title}</h2>
  ${renderNoteCards(groupNotes, "")}
</section>`).join("");
  }

  return groups.map(([title, groupNotes]) => `
<section class="section" data-outline-depth="1">
  <div class="section-heading expanded" role="button" tabindex="0">
    <span class="indicator" aria-hidden="true">&#9656;</span>
    <h2>${title}</h2>
  </div>
  <div class="section-content">
    ${renderNoteCards(groupNotes, "")}
  </div>
</section>`).join("");
}

function renderViewSwitch() {
  return `<div class="view-switch" role="group" aria-label="View">
      <button type="button" data-view-option="normal" aria-pressed="false">Normal</button>
      <button type="button" data-view-option="outline" aria-pressed="true">Outline</button>
    </div>`;
}

function renderPage({ assetPrefix, hasLinkToggle = false, metadata, normalHtml, outlineHtml }) {
  const title = metadata?.title || "Notes";
  let meta = "";
  if (metadata?.author) {
    const author = metadata.author_url
      ? `<a href="${escapeHtml(metadata.author_url)}">${escapeHtml(metadata.author)}</a>`
      : escapeHtml(metadata.author);
    meta = `<div class="meta">
        Author: ${author}<br>
        Date: ${escapeHtml(metadata.display_date || formatDate(metadata.date))}<br>
        Status: ${metadata.status === "draft" ? "Draft" : "Published"}
      </div>`;
  } else if (metadata) {
    meta = `<div class="meta">${escapeHtml(metadata.display_date || formatDate(metadata.date))}${metadata.status === "draft" ? " &middot; Draft" : ""}</div>`;
  }
  const links = hasLinkToggle
    ? `<div class="toggle-container">
      <label class="toggle-label" for="link-toggle">Links</label>
      <label class="toggle-switch">
        <input type="checkbox" id="link-toggle" checked>
        <span class="toggle-slider"></span>
      </label>
    </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}${metadata ? " — Notes" : " — Sundeep Yedida"}</title>
<script>document.documentElement.classList.add("js")</script>
<link rel="stylesheet" href="${assetPrefix}assets/site.css">
</head>
<body>

<header class="site-header">
  <nav class="site-nav" aria-label="Notes">
    <a href="${assetPrefix}" data-preserve-view>Notes</a>
  </nav>
  <div class="header-top">
    <div>
      <h1>${escapeHtml(title)}</h1>
      ${meta}
    </div>
    <div class="header-actions">
      ${renderViewSwitch()}
      ${links}
    </div>
  </div>
  <div class="controls" data-outline-controls>
    <button id="toggle-all" type="button">Expand all</button>
  </div>
</header>

<main id="article">
  <article class="view-panel normal-view" data-view-panel="normal" hidden>
    ${normalHtml}
  </article>
  <article class="view-panel outline-view" data-view-panel="outline">
    ${outlineHtml}
  </article>
</main>

<script src="${assetPrefix}assets/outline.js"></script>

</body>
</html>
`.replace(/[ \t]+\n/g, "\n");
}

function writeGeneratedFile(filePath, contents) {
  if (checkOnly) {
    if (!fs.existsSync(filePath) || fs.readFileSync(filePath, "utf8") !== contents) {
      throw new Error(`Generated file is out of date: ${path.relative(repositoryRoot, filePath)}`);
    }
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function publish() {
  const notes = loadNotes().sort((left, right) => {
    const statusOrder = { published: 0, draft: 1 };
    const statusDifference = statusOrder[left.metadata.status] - statusOrder[right.metadata.status];
    return statusDifference || new Date(right.metadata.date) - new Date(left.metadata.date);
  });
  const home = readMarkdown(path.join(contentRoot, "home.md"));
  const homeOutline = readMarkdown(path.join(contentRoot, "home-outline.md"));
  if (homeOutline.data.source_digest !== sourceDigest(home.source)) {
    throw new Error("Homepage outline is stale. Update it from the current raw homepage source.");
  }

  const normalHome = `${markdown.render(home.content)}${renderHomepageGroups(notes, false)}`;
  const outlineHome = `${renderOutline(homeOutline.content)}${renderHomepageGroups(notes, true)}`;
  writeGeneratedFile(
    path.join(outputRoot, "notes", "index.html"),
    renderPage({ assetPrefix: "", normalHtml: normalHome, outlineHtml: outlineHome }),
  );

  for (const note of notes) {
    writeGeneratedFile(
      path.join(outputRoot, "notes", note.metadata.slug, "index.html"),
      renderPage({
        assetPrefix: "../",
        hasLinkToggle: /https?:\/\//.test(`${note.note.content}${note.outline.content}`),
        metadata: note.metadata,
        normalHtml: markdown.render(note.note.content),
        outlineHtml: renderOutline(note.outline.content),
      }),
    );
  }
}

try {
  publish();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
