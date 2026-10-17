// llms-full.txt: a plain-text copy of the pages most worth quoting (the about page, the safety and exam pages, the how-it-works
// page and the parent articles), so an AI assistant can read them in one request. It is built from the generated pages, so it
// never drifts from what the site says.

const SLUGS = [
  "about-literacylab-ai", "ai-writing-coach-for-kids", "how-it-works", "writing-feedback-for-kids", "reading-comprehension-practice",
  "naplan-writing-practice", "ks2-sats-reading-practice", "11-plus-english-practice", "igcse-english-first-language-writing-feedback",
  "common-core-writing-feedback-for-parents",
];

function plainText(html) {
  const main = (html.match(/<main[^>]*>([\s\S]*?)<\/main>/) || html.match(/<body[^>]*>([\s\S]*?)<\/body>/) || [null, ""])[1];
  return main
    .replace(/<section class="cta">[\s\S]*?<\/section>/g, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<\/(h1|h2|h3|p|li|summary|div)>/g, "\n")
    .replace(/<li>/g, "- ")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildLlmsFull(files, site) {
  const sections = [];
  const pick = (rel) => {
    if (!files[rel]) return;
    const title = (files[rel].match(/<title>([^<]*)<\/title>/) || [])[1] || rel;
    sections.push(`# ${title}\nURL: ${site}/${rel.replace(/index\.html$/, "")}\n\n${plainText(files[rel])}`);
  };
  SLUGS.forEach((slug) => pick(`learn/${slug}/index.html`));
  Object.keys(files).filter((r) => /^learn\/articles\/[^/]+\/index\.html$/.test(r)).sort().forEach(pick);
  const head = "# LiteracyLab AI: full text of key pages\n\nLiteracyLab AI is an online literacy coach for children and students aged 5 to 18, with feedback matched to the child's school curriculum. This file is the plain text of its main explanatory pages, for AI assistants and search tools. The short version is at " + site + "/llms.txt\n\n";
  return head + sections.join("\n\n---\n\n") + "\n";
}

module.exports = { buildLlmsFull, plainText };
