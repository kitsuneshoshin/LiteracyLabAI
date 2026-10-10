// Search pages for the things parents actually type: an exam or test by name, and the plain question "is an AI writing
// coach safe for my child?". Like the other landing pages, every claim here is something the product really does
// (see index.html and api/_lib/plans.js, and the verified exam facts in scripts/articles-*.js). No statistics, no
// guarantees, no comparisons with named products, and each page says what the tool does NOT do.

const PAGES = [
  {
    slug: "naplan-writing-practice",
    title: "NAPLAN writing practice for Years 3, 5, 7 and 9, with feedback",
    description: "NAPLAN writing practice for Australian students in Years 3, 5, 7 and 9: story and persuasive prompts, feedback on each piece, and free reading worksheets.",
    h1: "NAPLAN writing practice with feedback",
    lead: "NAPLAN writing is a single timed piece, a story or a persuasive text, written to a prompt. The best practice is writing real pieces regularly and getting specific feedback on each one. Here is how to do that at home.",
    body: `
<h2>What the NAPLAN writing task asks for</h2>
<p>Students in Years 3, 5, 7 and 9 write one piece to a prompt, and it is marked against published criteria for things like audience, ideas, structure, vocabulary, sentence structure, punctuation and spelling. The exact format and timing can change from year to year, so check the National Assessment Program website for the current details. Our <a href="/learn/articles/naplan-writing-explained/">NAPLAN writing explained</a> article walks through it in plain English.</p>
<h2>How to practise at home</h2>
<ul>
  <li><b>Write whole pieces, not just exercises.</b> A short story or persuasive piece each week teaches planning, pacing and finishing.</li>
  <li><b>Get feedback on one thing at a time.</b> One strength to repeat and one next step beats a page of corrections.</li>
  <li><b>Practise both kinds of writing.</b> Alternate narrative and persuasive pieces so neither feels new on the day.</li>
  <li><b>Read the piece aloud.</b> Children catch missing words and long, tangled sentences by ear.</li>
</ul>
<h2>How LiteracyLab AI helps</h2>
<ul>
  <li>Pick <b>story</b> or <b>persuasive</b> writing, with a prompt written for your child's year.</li>
  <li>On Premium, tick <b>"Word it like a NAPLAN task"</b> (Australia, Years 3 to 9) to get a prompt worded the way an exam task is.</li>
  <li>Each piece comes back with a Glow (what worked), a Grow (one next step), highlights in their own text, a corrected version of the piece and vocabulary to try.</li>
  <li>Premium adds a spelling and grammar check and an overall score out of 10 for the whole piece.</li>
</ul>
<h2>What it does not do</h2>
<p>LiteracyLab AI is not affiliated with ACARA or any government body, and it does not give a NAPLAN score or band. Scores and bands in the app are practice guides, not a prediction of a result. Your child's teacher knows their work best.</p>
<h2>Free reading practice too</h2>
<p>NAPLAN also tests reading. Our <a href="/learn/worksheets/">free reading worksheets</a> for Years 3 to 6 in Australia come with answer keys, and the <a href="/learn/articles/naplan-reading-explained/">NAPLAN reading</a> article explains the test. See also the year-by-year <a href="/learn/australia/">Australian curriculum guides</a>.</p>`,
    cta: "Try NAPLAN-style writing practice free",
    faq: [
      ["Which years does NAPLAN writing cover?", "NAPLAN is sat in Years 3, 5, 7 and 9. LiteracyLab AI supports writing practice for Australian students across the primary and secondary years."],
      ["Does LiteracyLab AI give a NAPLAN score?", "No. It gives feedback and a practice score out of 10 on Premium, which is a guide for practice, not a NAPLAN result or band."],
      ["Is there a free option?", "Yes. The Free plan includes 3 pieces a month with full feedback and needs no card."],
    ],
  },
  {
    slug: "ks2-sats-reading-practice",
    title: "KS2 SATs reading practice: free worksheets and online feedback",
    description: "KS2 SATs reading practice for Year 6 in England: free printable worksheets with answers, plus online passages that explain every answer.",
    h1: "KS2 SATs reading practice",
    lead: "The KS2 reading test asks children to read several texts and answer questions on them, mostly by finding evidence in the text. Short, regular practice with explained answers works better than one big cram.",
    body: `
<h2>What the KS2 reading test looks at</h2>
<p>Children read fiction, non-fiction and sometimes poetry, then answer questions that test retrieving facts, working out what words mean, summarising, and making inferences with evidence. A scaled score of 100 means the expected standard. Our <a href="/learn/articles/ks2-sats-reading-and-writing-explained/">KS2 SATs explained</a> article covers the format in plain English, and you should always check the government's current guidance for the details.</p>
<h2>A simple routine for Years 5 and 6</h2>
<ul>
  <li><b>Little and often:</b> two or three short sessions a week.</li>
  <li><b>Always ask "how do you know?"</b> and have your child point to the line that proves their answer.</li>
  <li><b>Look at the wrong answers.</b> Understanding why an answer was wrong is where most of the learning happens.</li>
  <li><b>Mix the question types.</b> Retrieval, vocabulary, inference and summary all come up.</li>
</ul>
<h2>Free printable practice</h2>
<p>Our <a href="/learn/worksheets/">free reading worksheets</a> for UK Years 3 to 6 each have a passage, questions and an answer key. You mark them yourself. There is no sign-up.</p>
<h2>Online practice that explains every answer</h2>
<p>In the LiteracyLab AI app, a child reads a passage written for their year and answers questions in several styles: multiple choice, true, false or not given, "which line proves it", putting events in order, matching words to meanings and filling a gap. After submitting, each answer is explained, with the line from the passage that shows it. On Premium, Years 3 and above also get a short written question marked by the AI.</p>
<h2>What it does not do</h2>
<p>LiteracyLab AI is not a SATs paper and does not give a SATs score. The passages are our own, written for each year. Use them alongside your child's school work, not instead of it.</p>`,
    cta: "Try reading practice free",
    faq: [
      ["Are these real SATs papers?", "No. The passages and questions are our own, written for each year. Past papers are published by the government."],
      ["Is it free?", "The worksheets are free to print with no sign-up. The app has a Free plan with 3 pieces a month and needs no card."],
      ["What year is it for?", "Reading practice is available across the primary years, with free worksheets for Years 3 to 6."],
    ],
  },
  {
    slug: "11-plus-english-practice",
    title: "11+ English practice at home: comprehension and writing",
    description: "11+ English practice for parents: how to build comprehension, vocabulary and writing skills at home, with free worksheets and feedback on every piece.",
    h1: "11+ English practice at home",
    lead: "The 11+ looks different depending on where you live and which schools you apply to. Whatever the format, the same skills sit underneath it: understanding what is read, a wide vocabulary and clear writing.",
    body: `
<h2>Check what your target schools ask for</h2>
<p>Different areas and independent schools use different 11+ papers, and some include writing while others test only multiple choice. Check each school's own guidance first. Our <a href="/learn/articles/11-plus-english-explained/">11+ English explained</a> article sets out what varies.</p>
<h2>The skills worth building from Year 4</h2>
<ul>
  <li><b>Comprehension:</b> reading a passage closely and answering with evidence.</li>
  <li><b>Vocabulary:</b> learning new words in context and using them in their own writing.</li>
  <li><b>Inference:</b> working out what is meant but not said.</li>
  <li><b>Writing:</b> planning a story or an argument and finishing it with a clear ending.</li>
</ul>
<h2>How LiteracyLab AI fits in</h2>
<ul>
  <li><a href="/learn/worksheets/">Free reading worksheets</a> for Years 3 to 6 with answer keys.</li>
  <li>Online passages that explain every answer, including, on Premium, a short written question marked by the AI from Year 3.</li>
  <li>Writing feedback on stories and persuasive pieces: a strength, a next step and a corrected version of their own work.</li>
  <li>A vocabulary bank that builds from every word your child is taught, with flashcards and a quiz.</li>
</ul>
<h2>What it does not do</h2>
<p>LiteracyLab AI does not replicate any particular 11+ exam, and it does not predict a pass or a score. It is a way to practise reading and writing regularly, with feedback, alongside whatever exam preparation you choose.</p>`,
    cta: "Try it free",
    faq: [
      ["Does LiteracyLab AI follow the 11+ exam format?", "No. It builds the underlying reading, vocabulary and writing skills with practice that matches your child's school year, and does not copy any 11+ paper."],
      ["Can it replace a tutor?", "It gives quick, specific feedback between lessons. A tutor or teacher knows your child in a way no tool does."],
    ],
  },
  {
    slug: "igcse-english-first-language-writing-feedback",
    title: "IGCSE English First Language writing feedback for students",
    description: "Feedback on IGCSE and O-Level English writing: a strength, a next step and a corrected version, with exam-style bands on Premium. Not an exam mark.",
    h1: "IGCSE English First Language writing feedback",
    lead: "For Cambridge IGCSE and O-Level English, the writing skills that earn marks are clear, accurate and well-organised prose. Regular practice with specific feedback is the fastest way to build them.",
    body: `
<h2>What students are working towards</h2>
<p>The Cambridge IGCSE First Language English syllabus (0500) assesses reading and writing, including directed writing and composition. Check the current syllabus and mark schemes on the Cambridge International website, because details can change.</p>
<h2>What helps a student improve</h2>
<ul>
  <li><b>Write full pieces under realistic conditions,</b> then review them.</li>
  <li><b>Fix one thing at a time:</b> structure, then accuracy, then style.</li>
  <li><b>Learn from a model.</b> Seeing a strong response to the same task teaches more than a rule.</li>
</ul>
<h2>What LiteracyLab AI gives back</h2>
<ul>
  <li>A <b>Glow</b> and a <b>Grow</b> tied to named skills for their year, quoting their own words.</li>
  <li>A corrected, improved version of the whole piece.</li>
  <li>On Premium: a spelling and grammar check, a score out of 10 for the whole piece, an extended second next step, and for students aged 11 and over, a band from 1 to 4 against the published writing assessment objectives for their year and region, with evidence quoted from their work.</li>
  <li>A model response and the framework used (for example PEEL or PEAL) shown beside the student's own.</li>
</ul>
<h2>What it does not do</h2>
<p>LiteracyLab AI is not affiliated with Cambridge, and bands are guides, not predictions. It never produces a raw exam mark, a percentage or a grade letter. Your teacher's marking is the one that counts.</p>
<p>See the year-by-year guides for <a href="/learn/uae-gcc/">the UAE and Gulf</a> and <a href="/learn/singapore/">Singapore</a>, and our <a href="/learn/articles/gcse-english-language-explained/">GCSE English Language explained</a> article for the UK equivalent.</p>`,
    cta: "Get feedback on a piece of writing",
    faq: [
      ["Does it mark to the Cambridge mark scheme?", "No. It gives exam-style bands against the published writing objectives as a guide. It does not produce an exam mark, percentage or grade."],
      ["Which students is this for?", "Students in the IGCSE and O-Level years, in the Gulf, Singapore and elsewhere. Premium bands are for students aged 11 and over."],
    ],
  },
  {
    slug: "common-core-writing-feedback-for-parents",
    title: "Common Core writing feedback for parents, Grades K to 12",
    description: "Common Core writing feedback for parents: opinion, informative and narrative writing explained, and feedback on your child's writing at their grade.",
    h1: "Common Core writing feedback for parents",
    lead: "Common Core writing asks children to write three kinds of piece, opinion, informative and narrative, with more independence each year. Here is what to look for and how to help.",
    body: `
<h2>The three kinds of writing</h2>
<ul>
  <li><b>Opinion and argument:</b> state a view and support it with reasons and evidence.</li>
  <li><b>Informative and explanatory:</b> explain a topic clearly with facts and detail.</li>
  <li><b>Narrative:</b> tell a real or imagined story with a beginning, middle and end.</li>
</ul>
<p>Our <a href="/learn/articles/common-core-writing-standards-explained/">Common Core writing standards explained</a> article goes through each in plain English. Your state may use its own version of the standards, so check your school's guidance.</p>
<h2>How to give useful feedback at home</h2>
<ul>
  <li>Quote one thing that worked and say why.</li>
  <li>Choose one next step, not five.</li>
  <li>Ask your child to read the piece aloud and fix what they hear.</li>
</ul>
<h2>What LiteracyLab AI does</h2>
<p>Choose the US and your child's grade, then pick a kind of writing, such as a story or a persuasive piece. Each piece comes back with a Glow tied to a skill from their grade's standards, a Grow with one next step explained through an interest they chose, highlights in their text, a corrected version and vocabulary to try. Free reading worksheets for <a href="/learn/worksheets/">Grades 3 to 6</a> come with answer keys. Browse the <a href="/learn/us/">grade-by-grade guides</a>.</p>
<h2>What it does not do</h2>
<p>LiteracyLab AI is not affiliated with any state or testing company and does not give a state test score. It is practice and feedback, not a replacement for your child's teacher.</p>`,
    cta: "Get feedback on your child's writing",
    faq: [
      ["Is this aligned to Common Core?", "Feedback is matched to the Common Core writing and reading skills for your child's grade. Your state may use its own version of the standards."],
      ["Is it free?", "The Free plan includes 3 pieces a month with full feedback and needs no card."],
    ],
  },
  {
    slug: "ai-writing-coach-for-kids",
    title: "AI writing coach for kids: is it safe, and does it write for them?",
    description: "Is an AI writing coach safe for children? What LiteracyLab AI does with your child's writing, why it never writes the story, and how parents stay in control.",
    h1: "An AI writing coach for kids: what parents should know",
    lead: "Parents are right to ask hard questions about AI and children. Here are straight answers: what an AI writing coach does, what happens to your child's work, and where its limits are.",
    body: `
<h2>What an AI writing coach does</h2>
<p>A child writes a piece, and the AI reads it and gives feedback: one thing that worked, one next step, and fixes for spelling and grammar. It responds to work the child has already done. LiteracyLab AI never writes their story for them, and the corrected version it shows is built from the child's own ideas and wording.</p>
<h2>Is it safe?</h2>
<ul>
  <li><b>Parent-managed accounts.</b> A parent or guardian creates and manages every account. Children do not register on their own.</li>
  <li><b>No selling of writing.</b> Submissions are used only to give feedback to that child. We do not sell or rent writing samples or personal data, and we do not use submissions to train public AI models.</li>
  <li><b>You can delete it.</b> Parents can review, export or permanently delete a child's data from the dashboard.</li>
</ul>
<p>Read the full <a href="/privacy.html">privacy policy</a> for details.</p>
<h2>Will it make my child lazy?</h2>
<p>The design aims the other way. The feedback is one specific step at a time, so the child still has to do the writing and the revising. It also teaches a named technique, such as PEEL or Story Mountain, so the skill transfers to school work.</p>
<h2>How accurate is it?</h2>
<p>AI can be wrong. LiteracyLab AI checks its own output for obvious mistakes before showing it, and it says plainly when a piece is too short to judge. Scores and bands are guides, not exam results. If something looks wrong, tell your child's teacher or tell us through the feedback card in the app.</p>
<h2>Matched to the curriculum</h2>
<p>Feedback is pitched to your child's country and year, from the UK national curriculum to Common Core, the Australian Curriculum, Canada, Singapore, the Gulf and CEFR levels for English learners. See the <a href="/learn/how-it-works/">full walkthrough</a> or the <a href="/learn/">year-by-year guides</a>.</p>`,
    cta: "Try it free",
    faq: [
      ["Does the AI write the essay for my child?", "No. It responds to work your child has already written. The corrected version is built from their own ideas and wording."],
      ["Does LiteracyLab AI use my child's writing to train AI?", "No. Submissions are used only to give feedback to that child and are not used to train public AI models."],
      ["Can I delete my child's data?", "Yes. Parents can review, export or permanently delete a child's data from the dashboard."],
    ],
  },
];

module.exports = { PAGES };
