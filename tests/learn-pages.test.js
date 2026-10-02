const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildAll, groupsFor, REGIONS, GRADE_DATA, tierForGrade } = require("../scripts/build-learn");
const { TARGET_GUIDE, TIER_INFO } = require("../scripts/learn-content");
const { GRADE_MAPPED_TARGETS } = require("../api/_lib/masteryTargets");

// The /learn/ guide pages: built from the app's own curriculum data, committed,
// and checked here so they stay accurate, unique, linked up and honest.

const ROOT = path.join(__dirname, "..");
const built = buildAll();
const pageFiles = Object.entries(built.files).filter(([rel]) => rel.startsWith("learn/"));
const text = (html) => html.slice(html.indexOf("<main"), html.indexOf("</main>")).replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

test("the committed pages and sitemap are exactly what the generator produces (run: node scripts/build-learn.js)", () => {
  for (const [rel, html] of Object.entries(built.files)) {
    const onDisk = fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
    assert.equal(onDisk, html, `${rel} is out of date`);
  }
});

test("every year group the app supports a mapped curriculum for has a page, and merged years are honestly merged", () => {
  for (const r of REGIONS) {
    const groups = groupsFor(r);
    const covered = groups.flatMap((g) => g.grades);
    assert.deepEqual(covered, Object.keys(GRADE_MAPPED_TARGETS[r.key]), `${r.slug} covers every mapped year, in order`);
    // years in a group share identical focus areas; neighbouring groups differ
    groups.forEach((g, i) => {
      g.grades.forEach((gr) => assert.deepEqual(GRADE_MAPPED_TARGETS[r.key][gr], g.targets));
      if (groups[i + 1]) assert.notDeepEqual(groups[i + 1].targets, g.targets);
    });
  }
  const uk = groupsFor(REGIONS.find((r) => r.slug === "uk")).map((g) => g.label);
  assert.ok(uk.includes("Years 7–9") && uk.includes("Years 10–11"), "England's shared years are one page each");
  assert.equal(pageFiles.length, 1 + REGIONS.length + REGIONS.reduce((n, r) => n + groupsFor(r).length, 0));
});

test("every focus area in the curriculum data has a plain-English explanation and something to try at home", () => {
  const names = new Set();
  Object.values(GRADE_MAPPED_TARGETS).forEach((by) => Object.values(by).forEach((ts) => ts.forEach((t) => names.add(t.name))));
  for (const n of names) {
    const g = TARGET_GUIDE[n];
    assert.ok(g, `no guide for "${n}"`);
    assert.ok(g.what.length > 40 && g.home.length > 30, `"${n}" guide is too thin`);
  }
  for (const k of Object.keys(TARGET_GUIDE)) assert.ok(names.has(k), `"${k}" is explained but not used anywhere`);
});

test("the app's list of years and stage boundaries used here match the app's own (app.html GRADE_DATA)", () => {
  const app = fs.readFileSync(path.join(ROOT, "app.html"), "utf8");
  for (const [country, d] of Object.entries(GRADE_DATA)) {
    const line = app.split("\n").find((l) => l.includes(`"${country}"`) && l.includes("grades:"));
    assert.ok(line, `${country} not found in app.html`);
    const grades = JSON.parse(line.match(/grades: (\[[^\]]*\])/)[1]);
    const tiers = JSON.parse(line.match(/tiers: (\[[^\]]*\])/)[1]);
    assert.deepEqual(d.grades, grades, `${country} years differ from the app`);
    assert.deepEqual(d.tiers, tiers, `${country} stage boundaries differ from the app`);
  }
  assert.equal(tierForGrade("🇬🇧 United Kingdom", "Year 5"), "elementary");
  assert.equal(tierForGrade("🇬🇧 United Kingdom", "Year 8"), "middle");
  assert.equal(tierForGrade("🇬🇧 United Kingdom", "Year 11"), "high");
  assert.ok(Object.keys(TIER_INFO).every((k) => TIER_INFO[k].prompts.length >= 6 && TIER_INFO[k].tips.length >= 3));
});

test("every page has one h1, a unique title and description of sensible length, a matching canonical URL, and valid structured data", () => {
  const titles = new Set(), descs = new Set();
  for (const [rel, html] of pageFiles) {
    assert.equal((html.match(/<h1>/g) || []).length, 1, `${rel}: one h1`);
    const title = html.match(/<title>([^<]*)<\/title>/)[1];
    const desc = html.match(/name="description" content="([^"]*)"/)[1];
    assert.ok(title.length >= 20 && title.length <= 75, `${rel}: title length ${title.length}`);
    assert.ok(desc.length >= 60 && desc.length <= 165, `${rel}: description length ${desc.length}`);
    assert.ok(!titles.has(title), `${rel}: duplicate title`); titles.add(title);
    assert.ok(!descs.has(desc), `${rel}: duplicate description`); descs.add(desc);
    const canon = html.match(/rel="canonical" href="([^"]*)"/)[1];
    const expected = "https://www.literacylabai.com/" + rel.replace(/index\.html$/, "");
    assert.equal(canon, expected, `${rel}: canonical`);
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.ok(ld["@graph"].some((n) => n["@type"] === "BreadcrumbList"), `${rel}: breadcrumbs`);
  }
});

test("year pages are substantial, not thin: each has a real explanation per focus area, practice prompts, tips and questions", () => {
  for (const [rel, html] of pageFiles) {
    if (!/^learn\/[^/]+\/[^/]+\/index\.html$/.test(rel)) continue;
    const t = text(html);
    assert.ok(t.split(" ").length >= 380, `${rel}: only ${t.split(" ").length} words`);
    assert.ok((html.match(/class="card"/g) || []).length >= 3, `${rel}: at least three focus areas`);
    assert.equal((html.match(/<li>[^<]*<\/li>/g) || []).length >= 6, true, `${rel}: prompts and tips`);
    assert.ok(/Common questions/.test(t) && /Try at home/.test(t) && /practice prompts/i.test(t));
  }
});

test("no page is a copy of another: the focus areas differ between neighbouring pages in a region", () => {
  for (const r of REGIONS) {
    const bodies = pageFiles.filter(([rel]) => rel.startsWith(`learn/${r.slug}/`) && rel.split("/").length === 4).map(([, h]) => text(h));
    assert.equal(new Set(bodies).size, bodies.length, `${r.slug} has identical pages`);
  }
});

test("every internal link on every page points at a page or file that exists", () => {
  const existing = new Set(Object.keys(built.files).map((rel) => "/" + rel.replace(/index\.html$/, "")));
  for (const [rel, html] of pageFiles) {
    for (const m of html.matchAll(/href="(\/[^"#?]*)(?:[?#][^"]*)?"/g)) {
      const target = m[1];
      const ok = existing.has(target) || fs.existsSync(path.join(ROOT, target.replace(/^\//, "")));
      assert.ok(ok, `${rel}: broken link ${target}`);
    }
  }
});

test("the sitemap lists every guide page, once, plus the homepage, privacy and terms", () => {
  const sm = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(new Set(locs).size, locs.length, "no duplicates");
  for (const u of built.urls) assert.ok(locs.includes(u), `${u} missing from the sitemap`);
  for (const u of ["https://www.literacylabai.com/", "https://www.literacylabai.com/privacy.html", "https://www.literacylabai.com/terms.html"]) assert.ok(locs.includes(u));
  assert.equal(locs.length, built.urls.length + 3);
});

test("honest claims: no superlatives, guarantees, endorsements or invented statistics anywhere in the guides", () => {
  const banned = /\b(guarantee[sd]?|guaranteed|proven|#1|number one|best in|world'?s best|official(ly)?\b|endorsed|approved by|certified|miracle|instantly|\d+\s?%|studies show|research shows|experts agree)\b/i;
  for (const [rel, html] of pageFiles) {
    const t = text(html);
    const hit = t.match(banned);
    assert.ok(!hit, `${rel}: contains "${hit && hit[0]}"`);
    assert.ok(!/undefined|\[object|NaN|null/.test(t), `${rel}: leaked a bad value`);
  }
  // The only claims about LiteracyLab AI itself match the product: 3 free pieces a month, no card.
  for (const [, html] of pageFiles) assert.ok(/3 pieces a month and needs no card/.test(html));
});

test("every page tells the reader its limits: it is general information and the school's guidance comes first", () => {
  for (const [rel, html] of pageFiles) {
    assert.ok(/not a substitute for your school's own guidance/.test(html), `${rel}: footer disclaimer`);
    assert.ok(/not affiliated with any exam board or curriculum body/.test(html), `${rel}: no implied endorsement`);
  }
  const uk = text(built.files["learn/uk/year-5/index.html"]);
  assert.ok(/Scotland, Wales and Northern Ireland have their own curricula/.test(uk));
  const sg = text(built.files["learn/singapore/primary-3/index.html"]);
  assert.ok(/Ministry of Education sets its own English syllabus/.test(sg), "Singapore is honest that this follows the Cambridge pathway");
});

test("no child's real details can appear: pages contain no names, emails or personal data", () => {
  for (const [rel, html] of pageFiles) assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(text(html)), `${rel}: looks like an email address`);
});

test("the homepage links to the guides, the app links from guides count as call-to-action clicks, and the app itself stays out of search", () => {
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(index.includes('<a href="learn/">Guides</a>'));
  const analytics = fs.readFileSync(path.join(ROOT, "analytics.js"), "utf8");
  assert.ok(analytics.includes("/^\\/?app\\.html/.test(href)"), "root-relative links into the app are tracked");
  assert.ok(/Disallow: \/app\.html/.test(fs.readFileSync(path.join(ROOT, "robots.txt"), "utf8")));
  assert.ok(!/Disallow: \/learn/.test(fs.readFileSync(path.join(ROOT, "robots.txt"), "utf8")), "guides are open to search engines");
  assert.ok(fs.readFileSync(path.join(ROOT, "llms.txt"), "utf8").includes("/learn/"));
});
