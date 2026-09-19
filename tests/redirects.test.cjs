const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

for (const route of ["notes", "notes/outliney", "notes/coding-agents-101"]) {
  test(`${route} redirects to the matching new page and preserves the view and fragment`, () => {
    const html = fs.readFileSync(path.join(__dirname, "..", route, "index.html"), "utf8");
    const destination = `https://sundeep-sf.github.io/${route}/`;
    const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    for (const search of ["", "?view=normal", "?view=outline&source=shared"]) {
      let redirected;
      vm.runInNewContext(script, {
        location: { search, hash: "#outline-section-2", replace: url => { redirected = url; } },
      });
      assert.equal(redirected, `${destination}${search}#outline-section-2`);
    }
    assert.ok(html.includes(`<link rel="canonical" href="${destination}">`));
    assert.ok(html.includes(`<a href="${destination}">`));
    assert.ok(html.includes(`<noscript><meta http-equiv="refresh" content="0;url=${destination}"></noscript>`));
  });
}
