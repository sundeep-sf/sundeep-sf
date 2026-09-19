const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const checkOnly = process.argv.includes("--check");
// Keep these published addresses available permanently, even if notes move later.
const routes = ["notes", "notes/outliney", "notes/coding-agents-101"];

for (const route of routes) {
  const destination = `https://sundeep-sf.github.io/${route}/`;
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sundeep's Notes has moved</title>
  <link rel="canonical" href="${destination}">
  <script>location.replace(${JSON.stringify(destination)} + location.search + location.hash);</script>
  <noscript><meta http-equiv="refresh" content="0;url=${destination}"></noscript>
</head>
<body><p>This page has moved. <a href="${destination}">Continue to Sundeep's Notes</a>.</p></body>
</html>
`;
  const file = path.join(root, route, "index.html");
  if (checkOnly) {
    if (fs.readFileSync(file, "utf8") !== html) {
      throw new Error(`Redirect is out of date: ${route}. Run npm run build.`);
    }
  } else {
    fs.writeFileSync(file, html);
  }
}
