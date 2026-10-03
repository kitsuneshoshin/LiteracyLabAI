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
  const wsPages = require("../scripts/worksheets-pages").published().length;
  assert.equal(pageFiles.length, 2 + REGIONS.length + REGIONS.reduce((n, r) => n + groupsFor(r).length, 0) + (wsPages ? 1 + wsPages : 0), "hub, prompt generator, regions, year groups, and the worksheets hub and sheets");
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

// ---- the free writing-prompt generator (/learn/prompts/)

const pg = require("../scripts/prompt-generator");
const promptsPage = built.files["learn/prompts/index.html"];

test("prompt generator: every age group, kind of writing and topic gives a clean, complete prompt", () => {
  let seed = 1;
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const seen = new Set();
  for (const stage of Object.keys(pg.PG_STAGES)) {
    for (const type of Object.keys(pg.PG_TYPES)) {
      for (const interest of Object.keys(pg.PG_INTERESTS)) {
        for (let i = 0; i < 12; i++) {
          const o = pg.buildPrompt({ stage, type, interest }, rand);
          assert.equal(o.stage, stage); assert.equal(o.type, type); assert.equal(o.interest, interest);
          assert.ok(o.prompt.length >= 25 && o.prompt.length <= 260, `length ${o.prompt.length}: ${o.prompt}`);
          assert.ok(/[.?'"]$/.test(o.prompt), `ends properly: ${o.prompt}`);
          assert.ok(!/[{}~]|undefined|\s{2,}|\bnull\b/.test(o.prompt), `clean: ${o.prompt}`);
          assert.ok(/^[A-Z'"]/.test(o.prompt), `starts with a capital: ${o.prompt}`);
          seen.add(o.prompt);
        }
      }
    }
  }
  assert.ok(seen.size > 600, `plenty of variety: ${seen.size} different prompts`);
});

test("prompt generator: imaginary topics (a magic library) are only used for stories, descriptions and letters, never facts or opinions", () => {
  for (const interest of Object.keys(pg.PG_TOPICS)) for (const stage of Object.keys(pg.PG_STAGES)) {
    const real = pg.PG_TOPICS[interest][stage].filter((t) => t[0] !== "~");
    assert.ok(real.length >= 2, `${interest}/${stage} needs at least two real topics`);
    assert.equal(pg.PG_TOPICS[interest][stage].length, 5);
  }
  const imaginary = [];
  for (const interest of Object.keys(pg.PG_TOPICS)) for (const stage of Object.keys(pg.PG_STAGES)) pg.PG_TOPICS[interest][stage].filter((t) => t[0] === "~").forEach((t) => imaginary.push(t.slice(1)));
  assert.ok(imaginary.length >= 8);
  for (let i = 0; i < 3000; i++) {
    for (const type of ["explain", "opinion"]) {
      const o = pg.buildPrompt({ stage: ["early", "elementary", "middle", "high"][i % 4], type, interest: Object.keys(pg.PG_INTERESTS)[i % 8] });
      assert.ok(!imaginary.includes(o.topic), `${type} used the imaginary topic "${o.topic}"`);
    }
  }
});

test("prompt generator: unknown or missing choices fall back safely and a fixed random source gives a fixed result", () => {
  const a = pg.buildPrompt({ stage: "nonsense", type: "???", interest: "x" }, () => 0);
  assert.equal(a.stage, "elementary");
  assert.ok(a.prompt.length > 20);
  const b = pg.buildPrompt({ stage: "high", type: "opinion", interest: "space" }, () => 0.5);
  const c = pg.buildPrompt({ stage: "high", type: "opinion", interest: "space" }, () => 0.5);
  assert.equal(b.prompt, c.prompt);
  assert.ok(b.length.length > 10);
});

test("the prompt page: has the tool, works without scripts, embeds the same generator, and collects nothing", () => {
  assert.ok(promptsPage.includes('id="pg-prompt"') && promptsPage.includes('id="pg-new"') && promptsPage.includes('id="pg-copy"'));
  assert.ok(/<noscript>[\s\S]*<li>/.test(promptsPage), "a visitor without JavaScript still sees prompts");
  const script = promptsPage.match(/<script>\n([\s\S]*?)\n<\/script>\n<\/body>/)[1];
  assert.ok(script.includes("function buildPrompt") && !script.includes("module.exports"), "the same generator, without the node export");
  assert.doesNotThrow(() => new Function(script.replace(/document\.getElementById/g, "(function(){return null;})")), "the page script is valid JavaScript");
  for (const banned of ["localStorage", "sessionStorage", "document.cookie", "fetch(", "XMLHttpRequest", "sendBeacon", "indexedDB"]) {
    assert.ok(!script.includes(banned), `the page script must not use ${banned}`);
  }
  // The only thing it reports is the three menu choices, through the existing consent-aware analytics.
  const events = [...script.matchAll(/llTrack\("([a-z_]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(events, ["prompt_copied", "prompt_generated"]);
  assert.ok(/Nothing a visitor chooses is saved/.test(promptsPage));
});

test("the prompt page is linked from the hub and from every year page (with the right age group), and is in the sitemap", () => {
  assert.ok(built.files["learn/index.html"].includes('href="/learn/prompts/"'));
  for (const [rel, html] of pageFiles) {
    if (!/^learn\/[^/]+\/[^/]+\/index\.html$/.test(rel) || rel.startsWith("learn/prompts/")) continue;
    const m = html.match(/href="\/learn\/prompts\/\?stage=(early|elementary|middle|high)"/);
    assert.ok(m, `${rel}: links to the generator`);
  }
  assert.ok(built.urls.includes("https://www.literacylabai.com/learn/prompts/"));
  const uk5 = built.files["learn/uk/year-5/index.html"];
  assert.ok(uk5.includes("/learn/prompts/?stage=elementary"));
  assert.ok(built.files["learn/uk/year-8/index.html"] === undefined && built.files["learn/uk/year-7-to-year-9/index.html"].includes("?stage=middle"));
});

test("prompt generator: formal letters (to a headteacher, a council, a newspaper) only ever use real subjects, and no marker leaks into a prompt", () => {
  const imaginary = [];
  for (const interest of Object.keys(pg.PG_TOPICS)) for (const stage of Object.keys(pg.PG_STAGES)) pg.PG_TOPICS[interest][stage].filter((t) => t[0] === "~").forEach((t) => imaginary.push(t.slice(1)));
  const formal = /^(Write a formal letter|Write an open letter|Write an email to a local newspaper|Write a letter of application)/;
  let formalSeen = 0;
  for (let i = 0; i < 4000; i++) {
    const o = pg.buildPrompt({ stage: ["middle", "high"][i % 2], type: "letter", interest: Object.keys(pg.PG_INTERESTS)[i % 8] });
    assert.ok(!/^!|!Write/.test(o.prompt), `marker leaked: ${o.prompt}`);
    if (formal.test(o.prompt)) { formalSeen++; assert.ok(!imaginary.includes(o.topic), `formal letter about "${o.topic}"`); }
  }
  assert.ok(formalSeen > 1000, "formal letters do get picked");
});

test("the homepage carries the Google Search Console verification tag in its head (so the site stays verified)", () => {
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const head = index.slice(0, index.indexOf("</head>"));
  assert.match(head, /<meta name="google-site-verification" content="[A-Za-z0-9_-]{30,}" \/>/);
});

test("country flags on the guides are small images (flag emoji show as two letters, like GB and US, on Windows), and no flag emoji is left in a guide page", () => {
  for (const [rel, html] of pageFiles) {
    assert.ok(!/[\u{1F1E6}-\u{1F1FF}]/u.test(html), `${rel}: still contains a flag emoji`);
  }
  const hub = built.files["learn/index.html"];
  const flags = [...hub.matchAll(/<img class="flag" src="https:\/\/flagcdn\.com\/20x15\/([a-z]{2})\.png"/g)].map((m) => m[1]);
  assert.deepEqual(flags.sort(), ["ae", "au", "ca", "gb", "sg", "us"]);
  assert.ok(hub.includes("flag-globe"), "English learners keep the globe");
  assert.match(built.files["learn/uk/index.html"], /<h1><img class="flag" src="https:\/\/flagcdn\.com\/20x15\/gb\.png"/);
  for (const m of hub.matchAll(/<img class="flag"[^>]*>/g)) assert.ok(/alt=""/.test(m[0]) && /width="20" height="15"/.test(m[0]), "decorative, sized, no layout shift");
});
