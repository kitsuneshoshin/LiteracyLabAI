// Builds the parent articles hub and one page per article, in the same layout as the guides.

const { ARTICLES } = require("./articles-content");

const SITE = "https://www.literacylabai.com";
const LASTMOD = "2026-10-08";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const hubUrl = () => `${SITE}/learn/articles/`;
const urlFor = (a) => `${SITE}/learn/articles/${a.slug}/`;

function sectionHtml(s) {
  const paras = (s.p || []).map((t) => `<p>${esc(t)}</p>`).join("");
  const list = s.ul ? `<ul>${s.ul.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "";
  const extra = s.extra ? `<p>${esc(s.extra)}</p>` : "";
  return `<h2>${esc(s.h)}</h2>${paras}${list}${extra}`;
}

function buildArticle(a, { layout, breadcrumbLd, ctaBlock }) {
  const crumbs = [["Home", `${SITE}/`], ["Guides", `${SITE}/learn/`], ["Articles for parents", hubUrl()], [a.title, urlFor(a)]];
  const jsonld = { "@context": "https://schema.org", "@graph": [
    { "@type": "Article", headline: a.title, description: a.description, url: urlFor(a), inLanguage: "en", datePublished: LASTMOD, dateModified: LASTMOD, author: { "@type": "Organization", name: "LiteracyLab AI" }, publisher: { "@type": "Organization", name: "LiteracyLab AI" } },
    { "@type": "FAQPage", mainEntity: a.faq.map(([q, ans]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: ans } })) },
    breadcrumbLd(crumbs),
  ] };
  const body = `<div class="crumbs"><a href="/">Home</a> › <a href="/learn/">Guides</a> › <a href="/learn/articles/">Articles for parents</a> › ${esc(a.title)}</div>
<h1>${esc(a.title)}</h1>
<p class="lead">${esc(a.lead)}</p>
${a.sections.map(sectionHtml).join("\n")}
<h2>Common questions</h2>
${a.faq.map(([q, ans]) => `<h3>${esc(q)}</h3><p>${esc(ans)}</p>`).join("")}
${ctaBlock("article-" + a.slug, "Get feedback on your child's writing")}
<h2>Related</h2>
<ul>${a.related.map(([href, text]) => `<li><a href="${href}">${esc(text)}</a></li>`).join("")}</ul>
<p class="small"><a href="/learn/articles/">All articles for parents</a> · <a href="/learn/">All guides</a></p>`;
  return layout({ title: a.title, description: a.description, canonical: urlFor(a), jsonld, body });
}

function buildHub({ layout, breadcrumbLd, ctaBlock }) {
  const title = "Articles for parents: reading, writing and exams explained";
  const description = "Plain-English articles for parents on helping with reading and writing, and what NAPLAN, SATs, the 11+, GCSE English and Common Core ask of students.";
  const crumbs = [["Home", `${SITE}/`], ["Guides", `${SITE}/learn/`], ["Articles for parents", hubUrl()]];
  const jsonld = { "@context": "https://schema.org", "@graph": [
    { "@type": "CollectionPage", name: title, description, url: hubUrl(), inLanguage: "en", dateModified: LASTMOD },
    breadcrumbLd(crumbs),
  ] };
  const items = ARTICLES.map((a) => `<li><a href="/learn/articles/${a.slug}/">${esc(a.title)}<small>${esc(a.description.length > 110 ? a.description.slice(0, 107) + "..." : a.description)}</small></a></li>`).join("\n");
  const body = `<div class="crumbs"><a href="/">Home</a> › <a href="/learn/">Guides</a> › Articles for parents</div>
<h1>Articles for parents</h1>
<p class="lead">Short, practical articles on helping your child with reading and writing, and on what the main exams ask of students in the UK, US and Australia. Where an article covers an exam, check current details with your school or the exam provider.</p>
<ul class="grid">
${items}
</ul>
${ctaBlock("articles-hub", "See it work on real writing")}`;
  return layout({ title, description, canonical: hubUrl(), jsonld, body });
}

function buildArticleFiles(helpers) {
  const files = { "learn/articles/index.html": buildHub(helpers) };
  const urls = [hubUrl()];
  for (const a of ARTICLES) {
    files[`learn/articles/${a.slug}/index.html`] = buildArticle(a, helpers);
    urls.push(urlFor(a));
  }
  return { files, urls };
}

module.exports = { ARTICLES, buildArticleFiles, hubUrl, LASTMOD };
