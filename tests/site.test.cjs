const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { after, before, test } = require("node:test");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const siteBasePath = "/sundeep-sf";
const routes = [
  `${siteBasePath}/notes/`,
  `${siteBasePath}/notes/outliney/`,
  `${siteBasePath}/notes/coding-agents-101/`,
];

let baseUrl;
let browser;
let server;

before(async () => {
  server = http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const repositoryPathname = pathname.startsWith(`${siteBasePath}/`)
      ? pathname.slice(siteBasePath.length)
      : pathname;
    const relativePath = repositoryPathname.endsWith("/")
      ? `${repositoryPathname}index.html`
      : repositoryPathname;
    const filePath = path.resolve(root, `.${relativePath}`);

    if (!filePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(filePath)) {
      response.writeHead(404).end("Not found");
      return;
    }

    const contentType = filePath.endsWith(".css")
      ? "text/css"
      : filePath.endsWith(".js")
        ? "text/javascript"
        : "text/html";

    response.writeHead(200, { "Content-Type": `${contentType}; charset=utf-8` });
    fs.createReadStream(filePath).pipe(response);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    headless: true,
  });
});

after(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
});

test("every notes page uses the shared shell and links to the notes home", async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let sharedAppearance;

  for (const route of routes) {
    await page.goto(`${baseUrl}${route}`);

    assert.equal(await page.locator("link[href$='assets/site.css']").count(), 1, route);
    assert.equal(await page.locator("script[src$='assets/outline.js']").count(), 1, route);
    assert.equal(await page.locator("header.site-header").count(), 1, route);

    const notesLink = page.getByRole("navigation", { name: "Notes" }).getByRole("link", { name: "Notes" });
    const notesHref = await notesLink.getAttribute("href");
    assert.equal(new URL(notesHref, `${baseUrl}${route}`).pathname, `${siteBasePath}/notes/`, route);

    const appearance = await page.locator("body").evaluate((body) => {
      const bodyStyle = getComputedStyle(body);
      const titleStyle = getComputedStyle(document.querySelector("h1"));
      return {
        backgroundColor: bodyStyle.backgroundColor,
        fontFamily: bodyStyle.fontFamily,
        maxWidth: bodyStyle.maxWidth,
        titleSize: titleStyle.fontSize,
      };
    });

    sharedAppearance ??= appearance;
    assert.deepEqual(appearance, sharedAppearance, route);
    assert.equal(appearance.backgroundColor, "rgb(250, 250, 250)", route);
    assert.match(appearance.fontFamily, /-apple-system/, route);
    assert.equal(appearance.maxWidth, "720px", route);
    assert.equal(appearance.titleSize, "28px", route);
  }

  await page.goto(`${baseUrl}${siteBasePath}/notes/outliney/`);
  await page.getByRole("navigation", { name: "Notes" }).getByRole("link", { name: "Notes" }).click();
  assert.equal(new URL(page.url()).pathname, `${siteBasePath}/notes/`);

  await page.close();
});

test("every notes page provides accessible outline controls", async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  for (const route of routes) {
    await page.goto(`${baseUrl}${route}`);

    const headings = page.locator(".section-heading[role='button']");
    assert.ok(await headings.count(), route);

    const firstHeading = headings.first();
    const controlledContent = page.locator(`#${await firstHeading.getAttribute("aria-controls")}`);

    assert.equal(await firstHeading.getAttribute("aria-expanded"), "true", route);
    assert.equal(await controlledContent.getAttribute("aria-hidden"), "false", route);

    await firstHeading.press("Enter");
    assert.equal(await firstHeading.getAttribute("aria-expanded"), "false", route);
    assert.equal(await controlledContent.getAttribute("aria-hidden"), "true", route);

    await firstHeading.press("Space");
    assert.equal(await firstHeading.getAttribute("aria-expanded"), "true", route);
    assert.equal(await controlledContent.getAttribute("aria-hidden"), "false", route);

    const toggleAllButton = page.locator("#toggle-all");
    assert.equal(await toggleAllButton.textContent(), "Collapse all", route);
    await toggleAllButton.click();
    assert.equal(await page.locator(".section-heading[aria-expanded='false']").count(), await headings.count(), route);
    assert.equal(await toggleAllButton.textContent(), "Expand all", route);

    await toggleAllButton.click();
    assert.equal(await page.locator(".section-heading[aria-expanded='true']").count(), await headings.count(), route);
  }

  await page.close();
});

test("every notes page keeps the shared layout on a small screen", async () => {
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });

  for (const route of routes) {
    await page.goto(`${baseUrl}${route}`);

    const layout = await page.locator("body").evaluate((body) => ({
      fitsViewport: document.documentElement.scrollWidth <= window.innerWidth,
      headerDirection: getComputedStyle(body.querySelector(".header-top")).flexDirection,
      titleSize: getComputedStyle(body.querySelector("h1")).fontSize,
    }));

    assert.deepEqual(layout, {
      fitsViewport: true,
      headerDirection: "column",
      titleSize: "24px",
    }, route);
  }

  await page.close();
});
