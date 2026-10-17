// Three plain landing pages that answer what a parent actually searches for:
// feedback on a child's writing, reading comprehension practice, and how the
// product works. They reuse the guide layout. Every claim here is something the
// product really does (see index.html and api/_lib/plans.js); there are no
// statistics, guarantees or comparisons with other products.

const SITE = "https://www.literacylabai.com";
const LASTMOD = "2026-10-17";

const QUICK = {
  "writing-feedback-for-kids": "Good feedback on a child's writing names one thing that worked, gives one next step, and shows the piece corrected, at the right level for the child's year. LiteracyLab AI does this on every piece, matched to the child's own curriculum.",
  "reading-comprehension-practice": "Free printable reading comprehension worksheets for UK Years 3 to 6, US Grades 3 to 6 and Australian Years 3 to 6 come with answer keys, and the LiteracyLab AI app gives online passages that explain every answer.",
  "how-it-works": "You set up a learner (country, year, an interest), get a writing prompt or reading passage, and the child writes or answers. They get back a strength, one next step, a corrected version and vocabulary, matched to their curriculum.",
  "naplan-writing-practice": "NAPLAN writing is one story or persuasive piece written to a prompt in Years 3, 5, 7 and 9. The best practice is writing whole pieces regularly and getting one specific piece of feedback on each. LiteracyLab AI offers that, with a free plan of 3 pieces a month.",
  "ks2-sats-reading-practice": "The KS2 reading test is mostly about finding evidence in texts. Short, regular practice with explained answers works best: the free Year 6 worksheets here come with answer keys, and the app explains every answer online.",
  "11-plus-english-practice": "The 11+ differs by area and school, so check each school's guidance. The skills underneath are comprehension, vocabulary, inference and writing, and they can be built at home with regular practice and feedback.",
  "igcse-english-first-language-writing-feedback": "LiteracyLab AI gives IGCSE and O-Level students a strength, a next step and a corrected version of each piece. Premium adds exam-style bands from 1 to 4 as a guide, never an exam mark.",
  "common-core-writing-feedback-for-parents": "Common Core writing has three kinds of piece: opinion, informative and narrative. Useful feedback names one strength and one next step, and LiteracyLab AI gives both matched to your child's grade.",
  "ai-writing-coach-for-kids": "An AI writing coach reads what a child has written and responds with feedback. LiteracyLab AI never writes the story, accounts are managed by a parent, writing is not sold or used to train public AI models, and parents can delete data at any time."
};

const BASE_PAGES = [
  {
    slug: "writing-feedback-for-kids",
    title: "Writing feedback for kids: what good feedback looks like",
    description: "What useful feedback on a child's writing looks like, how to give it at home, and how LiteracyLab AI marks a piece against the child's own curriculum.",
    h1: "Writing feedback for kids: what good feedback looks like",
    lead: "A child writes a page and hands it over. What do you say? The most useful feedback is specific, short and about one thing at a time. Here is what that looks like, and how LiteracyLab AI does it for every piece.",
    body: `
<h2>What helps a child improve</h2>
<ul>
  <li><b>One thing that worked, with the words quoted.</b> "Good job" teaches nothing. "You made me nervous when you wrote <i>the door creaked open</i>" tells a child what to repeat.</li>
  <li><b>One next step, not a list.</b> A page of corrections feels like failure. One clear step is something a child can actually do in their next piece.</li>
  <li><b>A fixed copy of their own work.</b> Seeing their own sentences corrected teaches more than a rule in a textbook.</li>
  <li><b>The right level.</b> Feedback pitched at the wrong age is either too easy to notice or too hard to use.</li>
</ul>
<h2>What LiteracyLab AI gives back on each piece</h2>
<ul>
  <li>A <b>Glow</b>: what worked, tied to a skill from their year's curriculum, quoting their own words.</li>
  <li>A <b>Grow</b>: one specific next step, explained through an interest they chose when you set them up.</li>
  <li>Highlights in their text, a corrected version of the whole piece, and two vocabulary words to try.</li>
  <li>On the Premium plan: a spelling and grammar check, a whole-piece score out of 10, and for students aged 11 and over, a band from 1 to 4 against the assessment objectives for their year and country.</li>
</ul>
<h2>It is honest about short pieces</h2>
<p>Feedback that praises everything is not feedback. If a student writes far less than is expected for their year, the score reflects that and the feedback says so plainly, then suggests how to develop the piece. The same rule applies in every country and year group the app supports.</p>
<h2>Which curriculum?</h2>
<p>Feedback is matched to the child's country and year: the UK national curriculum, US Common Core, the Australian Curriculum, Canada, Singapore, the Gulf (Cambridge) and English learners at CEFR levels. See the <a href="/learn/">year-by-year guides</a> for what children are working on at each age, or <a href="/learn/prompts/">try the free writing prompt generator</a>.</p>
<h2>Does it replace a teacher?</h2>
<p>No. It gives a child quick, specific feedback between lessons. Your child's teacher knows them in a way no tool does, and the feedback is a starting point for a conversation, not a grade.</p>`,
    cta: "Get feedback on a piece of writing",
    faq: [
      ["How much does it cost?", "The Free plan includes 3 pieces a month with no card needed. Paid plans are billed monthly and can be cancelled at any time."],
      ["What ages is it for?", "Children and students from about 5 to 18, plus English learners, with feedback pitched to their year."],
    ],
  },
  {
    slug: "reading-comprehension-practice",
    title: "Reading comprehension practice for kids: free worksheets and a tool",
    description: "Free printable reading comprehension worksheets for the UK, US and Australia, with answers, plus an online tool that explains each answer.",
    h1: "Reading comprehension practice for kids",
    lead: "Reading comprehension is the skill of understanding what you read, not just reading the words. It grows with regular practice on short texts followed by questions that ask for evidence.",
    body: `
<h2>Free printable worksheets</h2>
<p>We write our own passages and questions for ages 7 to 11, in the spelling, dates and curriculum words each country uses. Each worksheet is a printable PDF with an answer key, and you mark it yourself.</p>
<ul>
  <li><a href="/learn/worksheets/">All free reading worksheets</a>: UK (Years 3 to 6), US (Grades 3 to 6) and Australia (Years 3 to 6).</li>
</ul>
<h2>What the questions practise</h2>
<ul>
  <li><b>Retrieval:</b> finding a fact in the text.</li>
  <li><b>Vocabulary:</b> working out what a word means from the sentence around it.</li>
  <li><b>Inference:</b> reading between the lines, with evidence.</li>
  <li><b>Summary:</b> saying what a text is about in a few words.</li>
</ul>
<h2>How to use a worksheet at home</h2>
<ul>
  <li>Read the passage together once, then let your child answer on their own.</li>
  <li>Ask "How do you know?" and have them point to the line that proves it.</li>
  <li>Keep it short. One worksheet a few times a week beats a long session.</li>
</ul>
<h2>Online reading practice with explanations</h2>
<p>In the LiteracyLab AI app, a child reads a short passage written for their year, answers questions, and gets feedback that explains why each answer is right or wrong, with the line from the passage that shows it. Passages and questions are matched to their year and country.</p>`,
    cta: "Try reading practice free",
    faq: [
      ["Are the worksheets free?", "Yes. They are free to print, with no sign-up."],
      ["Which years are covered?", "Years 3 to 6 in the UK and Australia and Grades 3 to 6 in the US. The app covers more year groups."],
    ],
  },
  {
    slug: "how-it-works",
    title: "How LiteracyLab AI works: feedback on writing and reading",
    description: "How LiteracyLab AI works step by step: set up a learner, get a prompt, write or read, then receive feedback matched to their year and curriculum.",
    h1: "How LiteracyLab AI works",
    lead: "LiteracyLab AI gives children and students feedback on their writing and reading, matched to their year and curriculum. This page explains each step so you know what to expect.",
    body: `
<h2>1. Set up a learner</h2>
<p>You choose the country, the year group and an interest such as football, coding or animals. The interest is used to make explanations easier to picture. It is never the task itself.</p>
<h2>2. Get a task</h2>
<p>For writing, the app suggests a prompt for the year and a kind of writing (story, persuasive, explanation and so on). For reading, it gives a short passage with questions.</p>
<h2>3. Write or answer</h2>
<p>The child writes in the app, or answers the questions. Writing has a length limit suited to their year.</p>
<h2>4. Read the feedback</h2>
<p>For writing: a Glow (what worked), a Grow (one next step), highlights in their own text, a corrected version, vocabulary to try and a named writing technique such as PEEL or Story Mountain. For reading: why each answer is right or wrong, with the evidence from the passage.</p>
<h2>5. Watch progress</h2>
<p>Paid plans show a progress chart over time against the skills for their year.</p>
<h2>What it does not do</h2>
<ul>
  <li>It does not give an exam mark, percentage or grade letter. Bands and scores are guides, not a prediction.</li>
  <li>It is not a replacement for a teacher.</li>
  <li>It is not affiliated with any exam board or government.</li>
</ul>
<h2>Plans</h2>
<p>The Free plan includes 3 pieces a month. Core and Premium add unlimited pieces, more learners, progress tracking and extra feedback sections. Current prices are on the <a href="/#pricing">home page</a>. Plans are billed monthly and can be cancelled at any time.</p>
<h2>Privacy</h2>
<p>Read how children's information is handled in our <a href="/privacy.html">privacy policy</a>.</p>`,
    cta: "Try it free",
    faq: [
      ["Do I need a card to start?", "No. The Free plan does not need a card."],
      ["Which countries are supported?", "The UK, US, Australia, Canada, the Gulf, Singapore and English learners."],
    ],
  },
];

const PAGES = [...BASE_PAGES, ...require("./landing-pages-seo").PAGES].map((p) => ({ ...p, quick: p.quick || QUICK[p.slug] }));
const QUICK_ANSWERS = QUICK;

const niceDate = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const urlFor = (p) => `${SITE}/learn/${p.slug}/`;

function buildLandingFiles({ layout, breadcrumbLd, ctaBlock }) {
  const files = {};
  const urls = [];
  for (const p of PAGES) {
    const crumbs = [["Home", `${SITE}/`], ["Guides", `${SITE}/learn/`], [p.h1, urlFor(p)]];
    const jsonld = { "@context": "https://schema.org", "@graph": [
      { "@type": "WebPage", name: p.title, description: p.description, url: urlFor(p), inLanguage: "en", dateModified: LASTMOD, publisher: { "@type": "Organization", name: "LiteracyLab AI" } },
      { "@type": "FAQPage", mainEntity: p.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
      breadcrumbLd(crumbs),
    ] };
    const body = `<div class="crumbs"><a href="/">Home</a> › <a href="/learn/">Guides</a> › ${esc(p.h1)}</div>
<h1>${esc(p.h1)}</h1>
<p class="lead">${esc(p.lead)}</p>
${p.quick ? `<p class="quick"><b>Short answer:</b> ${esc(p.quick)}</p>` : ""}${p.body}
<h2>Common questions</h2>
${p.faq.map(([q, a]) => `<details class="faq-q"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}
<p class="small">Last updated <time datetime="${LASTMOD}">${niceDate(LASTMOD)}</time>.</p>
${ctaBlock(p.slug, p.cta)}
<p class="small">${PAGES.filter((o) => o !== p).map((o) => `<a href="/learn/${o.slug}/">${esc(o.h1)}</a>`).join(" · ")}</p>`;
    files[`learn/${p.slug}/index.html`] = layout({ title: p.title, description: p.description, canonical: urlFor(p), jsonld, body });
    urls.push(urlFor(p));
  }
  return { files, urls };
}

module.exports = { PAGES, buildLandingFiles, LASTMOD };
