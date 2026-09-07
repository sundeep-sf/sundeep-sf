const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { afterEach, test } = require("node:test");

const root = path.resolve(__dirname, "..");
const temporaryDirectories = [];

function digest(source) {
  return crypto.createHash("sha256").update(source).digest("hex");
}

function writeNote(contentRoot, metadata, rawBody, outlineBody) {
  const noteRoot = path.join(contentRoot, "notes", metadata.slug);
  const rawSource = [
    "---",
    `title: ${metadata.title}`,
    `date: ${metadata.date}`,
    `status: ${metadata.status}`,
    `summary: ${metadata.summary}`,
    `slug: ${metadata.slug}`,
    "---",
    "",
    rawBody,
    "",
  ].join("\n");
  const outlineSource = [
    "---",
    `source_digest: ${digest(rawSource)}`,
    "---",
    "",
    outlineBody,
    "",
  ].join("\n");

  fs.mkdirSync(noteRoot, { recursive: true });
  fs.writeFileSync(path.join(noteRoot, "note.md"), rawSource);
  fs.writeFileSync(path.join(noteRoot, "outline.md"), outlineSource);
}

function writeHome(contentRoot, rawBody, outlineBody, sourceDigest = null) {
  fs.mkdirSync(contentRoot, { recursive: true });
  fs.writeFileSync(path.join(contentRoot, "home.md"), rawBody);
  fs.writeFileSync(
    path.join(contentRoot, "home-outline.md"),
    [
      "---",
      `source_digest: ${sourceDigest || digest(rawBody)}`,
      "---",
      "",
      outlineBody,
    ].join("\n"),
  );
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

test("publishing rejects an outline that has not been checked against its raw note", () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "notes-publisher-"));
  temporaryDirectories.push(fixtureRoot);

  const contentRoot = path.join(fixtureRoot, "content");
  const noteRoot = path.join(contentRoot, "notes", "example");
  fs.mkdirSync(noteRoot, { recursive: true });
  writeHome(contentRoot, "A homepage introduction.\n", "## About\n\nA homepage introduction.\n");
  fs.writeFileSync(
    path.join(noteRoot, "note.md"),
    [
      "---",
      "title: Example note",
      "date: 2026-09-07",
      "status: published",
      "summary: An example note.",
      "slug: example",
      "---",
      "",
      "The current raw note.",
      "",
    ].join("\n"),
  );
  fs.writeFileSync(
    path.join(noteRoot, "outline.md"),
    [
      "---",
      "source_digest: stale",
      "---",
      "",
      "## Main idea",
      "",
      "An older outline.",
      "",
    ].join("\n"),
  );

  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "scripts", "publish-notes.cjs"),
      "--content-root",
      contentRoot,
      "--output-root",
      path.join(fixtureRoot, "site"),
    ],
    { encoding: "utf8" },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /outline is stale for example/i);
});

test("publishing rejects a homepage outline that has not been checked against its raw source", () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "notes-publisher-"));
  temporaryDirectories.push(fixtureRoot);

  const contentRoot = path.join(fixtureRoot, "content");
  writeHome(
    contentRoot,
    "The current homepage introduction.\n",
    "## About\n\nAn older homepage introduction.\n",
    "stale",
  );
  writeNote(
    contentRoot,
    {
      title: "Example note",
      date: "2026-09-07",
      status: "published",
      summary: "An example note.",
      slug: "example",
    },
    "The example note.",
    "## Example\n\nThe example note.",
  );

  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "scripts", "publish-notes.cjs"),
      "--content-root",
      contentRoot,
      "--output-root",
      path.join(fixtureRoot, "site"),
    ],
    { encoding: "utf8" },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /homepage outline is stale/i);
});

test("publishing renders both views and builds the homepage from note metadata", () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "notes-publisher-"));
  temporaryDirectories.push(fixtureRoot);

  const contentRoot = path.join(fixtureRoot, "content");
  const outputRoot = path.join(fixtureRoot, "site");
  writeHome(
    contentRoot,
    "Welcome to the notes.\n",
    "## About these notes\n\nWelcome to the notes.\n",
  );

  writeNote(
    contentRoot,
    {
      title: "Older published note",
      date: "2026-08-01",
      status: "published",
      summary: "The older note.",
      slug: "older",
    },
    "## Raw heading\n\nRaw article text.",
    "## Outline heading\n\nOutline article text.",
  );
  writeNote(
    contentRoot,
    {
      title: "Newer published note",
      date: "2026-09-01",
      status: "published",
      summary: "The newer note.",
      slug: "newer",
    },
    "The newer article.",
    "## Newer outline\n\nThe newer article.",
  );
  writeNote(
    contentRoot,
    {
      title: "Draft note",
      date: "2026-09-07",
      status: "draft",
      summary: "The draft note.",
      slug: "draft",
    },
    "The draft article.",
    "## Draft outline\n\nThe draft article.",
  );

  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "scripts", "publish-notes.cjs"),
      "--content-root",
      contentRoot,
      "--output-root",
      outputRoot,
    ],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);

  const notePage = fs.readFileSync(path.join(outputRoot, "notes", "older", "index.html"), "utf8");
  assert.match(notePage, /Normal/);
  assert.match(notePage, /Outline/);
  assert.match(notePage, /Raw article text/);
  assert.match(notePage, /Outline article text/);

  const homepage = fs.readFileSync(path.join(outputRoot, "notes", "index.html"), "utf8");
  assert.ok(homepage.indexOf("Newer published note") < homepage.indexOf("Older published note"));
  assert.ok(homepage.indexOf("Older published note") < homepage.indexOf("Draft note"));
  assert.match(homepage, /Draft/);
});
