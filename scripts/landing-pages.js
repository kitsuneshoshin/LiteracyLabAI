// Three plain landing pages that answer what a parent actually searches for:
// feedback on a child's writing, reading comprehension practice, and how the
// product works. They reuse the guide layout. Every claim here is something the
// product really does (see index.html and api/_lib/plans.js); there are no
// statistics, guarantees or comparisons with other products.

const SITE = "https://www.literacylabai.com";
const LASTMOD = "2026-10-04";

const PAGES = [
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
<p class="lead">${esc(p.lead)}</p>${p.body}
<h2>Common questions</h2>
${p.faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("")}
${ctaBlock(p.slug, p.cta)}
<p class="small">${PAGES.filter((o) => o !== p).map((o) => `<a href="/learn/${o.slug}/">${esc(o.h1)}</a>`).join(" · ")}</p>`;
    files[`learn/${p.slug}/index.html`] = layout({ title: p.title, description: p.description, canonical: urlFor(p), jsonld, body });
    urls.push(urlFor(p));
  }
  return { files, urls };
}

module.exports = { PAGES, buildLandingFiles, LASTMOD };
