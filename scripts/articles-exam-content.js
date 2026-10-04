// The five exam explainers, in full. Facts here were checked against the national NAPLAN site,
// gov.uk (KS2 scaled scores, test timetable, teacher assessment standards, school applications),
// the AQA GCSE English Language page and the Common Core standards text. Examples and practice
// prompts are invented by us. Where a detail varies by area, school or year, the article says so.

const LINKS = {
  guides: ["/learn/", "All year-by-year guides"],
  prompts: ["/learn/prompts/", "Free writing prompt generator"],
  worksheets: ["/learn/worksheets/", "Free reading comprehension worksheets"],
  feedback: ["/learn/writing-feedback-for-kids/", "What good writing feedback looks like"],
  reading: ["/learn/reading-comprehension-practice/", "Reading comprehension practice"],
  how: ["/learn/how-it-works/", "How LiteracyLab AI works"],
  uk: ["/learn/uk/", "UK guides by year"],
  us: ["/learn/us/", "US guides by grade"],
  au: ["/learn/australia/", "Australian guides by year"],
  peel: ["/learn/articles/peel-and-peal-paragraphs-explained/", "PEEL and PEAL paragraphs explained"],
  mountain: ["/learn/articles/story-mountain-explained/", "Story Mountain explained"],
  show: ["/learn/articles/show-dont-tell-explained/", "Show, don't tell explained"],
  length: ["/learn/articles/how-much-should-my-child-write/", "How much should my child write?"],
  spelling: ["/learn/articles/help-a-child-who-makes-lots-of-spelling-mistakes/", "Helping with spelling mistakes"],
  comprehension: ["/learn/articles/help-with-reading-comprehension-at-home/", "Helping with reading comprehension at home"],
};
const rel = (...keys) => keys.map((k) => LINKS[k]);

const EXAM = {
  "naplan-writing-explained": {
    slug: "naplan-writing-explained",
    title: "NAPLAN writing explained for parents (Years 3, 5, 7 and 9)",
    description: "What the NAPLAN writing test asks of students, how it is marked on ten criteria, what the four result levels mean, and how to practise calmly.",
    lead: "NAPLAN is the national literacy and numeracy assessment taken by students in Years 3, 5, 7 and 9 in Australia. This guide covers the writing test: what children are asked to do, how it is marked, what the results mean and how to help at home without adding pressure. Dates and formats can change, so confirm current details with your school or the national NAPLAN website.",
    sections: [
      { h: "When it happens and who takes it", p: ["NAPLAN is held in March, in Term 1, over a test window of about two weeks. Every student in Years 3, 5, 7 and 9 takes the same set of tests: reading, writing, language conventions (spelling, grammar and punctuation) and numeracy. In recent years Year 3 students have written their response on paper, and students in Years 5, 7 and 9 have written on a computer. Your school will tell you which applies and when your child's sessions are."] },
      { h: "What the writing task looks like", p: ["Students are given a writing prompt and asked to write one kind of text: either a narrative (a story) or a persuasive piece (an argument). Students do not get to choose which one on the day, so it helps to be comfortable with both. The prompts for Years 3 and 5 are different from those for Years 7 and 9, though they are designed to be of similar difficulty.", "Writing is timed at 40 minutes in Year 3 and 42 minutes in Years 5, 7 and 9. That is not long, which is why planning and finishing matter so much."] },
      { h: "How the writing is marked", p: ["Trained markers score each response using a rubric with ten criteria. Each criterion has its own scale, and the scores are then combined. The ten criteria are:"], ul: [
        "Audience: does the writer orient and engage the reader?",
        "Text structure: does the piece have a clear beginning, middle and end, suited to the kind of writing?",
        "Ideas: are the ideas relevant, well chosen and developed?",
        "Character and setting (narrative) or persuasive devices (persuasive): the one criterion that changes with the text type.",
        "Vocabulary: is the word choice varied and precise?",
        "Cohesion: do ideas link together, with connecting words and a clear thread?",
        "Paragraphing: is the writing grouped into sensible paragraphs?",
        "Sentence structure: is there a mix of correct, well-built sentences?",
        "Punctuation: are full stops, capital letters, commas and so on used correctly?",
        "Spelling: are words spelt correctly, including more difficult ones?"], extra: "The national program publishes marking guides for both text types, so you can read exactly what markers look for." },
      { h: "How results are described", p: ["Since 2023, NAPLAN results are reported in four proficiency levels for each area tested: Exceeding, Strong, Developing and Needs additional support.", "Strong means a student is meeting challenging but reasonable expectations for their year. Exceeding means they are above that. Developing means they are working towards expectations. Needs additional support means they are not yet meeting expectations and would benefit from extra help. There is no pass mark, and a Developing result is information about where to focus, not a failure. Families receive an individual student report, and the report is a snapshot of one test on one day."] },
      { h: "A simple plan for a narrative", p: ["A story marked on these criteria needs a shape. Spend the first three or four minutes planning on rough paper or in a notes box:"], ul: [
        "Who is the main character, and where are they? (Character and setting.)",
        "What is the problem or surprise that sets things moving?",
        "What is the most exciting moment, and how is it solved?",
        "How does it end, and how does the character feel now?"], extra: "Our Story Mountain article shows this planning method with an example, and our show, don't tell article helps with the vocabulary and detail that make characters and settings come alive." },
      { h: "A simple plan for a persuasive piece", p: ["A persuasive piece needs a clear position and reasons. A reliable plan is one sentence stating the position, two or three reasons each with an example or explanation, and a closing sentence that restates the view. Persuasive devices include a rhetorical question, a confident opening, strong words such as essential or unfair, and addressing the reader directly. A good habit is to build each reason as a short paragraph using the PEEL or PEAL pattern."] },
      { h: "Practising at home", ul: [
        "Practise one text type at a time, then alternate. A short piece twice a week beats one long session.",
        "Use made-up prompts of your own to start with. For example: \"The best day of the year\" for a story, or \"Should every school have a garden?\" for a persuasive piece.",
        "Do some practice untimed, so your child can focus on ideas and structure, and some timed, so they learn to finish in the time.",
        "Always leave the last two minutes for rereading. Look for missing full stops, capital letters and words that were left out.",
        "Give one piece of feedback each time, not ten. One clear thing to improve is something a child can do next time."] },
      { h: "Common problems and how to fix them", ul: [
        "No plan: the piece starts well and wanders. Fix with a two-minute plan every time.",
        "No ending: the writer runs out of time. Plan the ending before starting, and if time is short, write a one-line ending.",
        "One long block of text: show where paragraphs begin, for example when time, place or idea changes.",
        "Repeated simple sentences: practise combining two short sentences, and starting sentences in different ways.",
        "Careless spelling of easy words: leave time to reread."] },
      { h: "Keeping it in proportion", p: ["NAPLAN is one short snapshot, and the best preparation is regular reading and writing through the year, with some familiarity with the format. Tell your child it is a chance to show what they can do, and that the result is information for their teachers and for you, not a judgement of them."] },
    ],
    faq: [
      ["Is there a pass mark?", "No. Results are described in four levels. Strong means meeting challenging but reasonable expectations for the year."],
      ["Which kinds of writing are tested?", "Narrative and persuasive writing. The prompt tells students which one to write, and they do not choose."],
      ["How long is the writing test?", "40 minutes in Year 3 and 42 minutes in Years 5, 7 and 9. Your school will confirm the timetable."],
      ["Can my child see past papers?", "The national program publishes example tests and marking guides on its website, and your school may have practice material too."],
    ],
    related: rel("au", "mountain", "peel", "show", "prompts"),
  },

  "ks2-sats-reading-and-writing-explained": {
    slug: "ks2-sats-reading-and-writing-explained",
    title: "KS2 SATs reading and writing explained for parents (England)",
    description: "How the Year 6 SATs reading test, grammar and spelling tests and teacher-assessed writing work in England, what a scaled score of 100 means, and how to help.",
    lead: "In England, children take national tests at the end of Key Stage 2 in Year 6, usually called SATs. This guide covers the English parts: the reading test, the grammar, punctuation and spelling tests, and how writing is assessed. Dates and formats can change, so confirm current details with your school or the government's published guidance.",
    sections: [
      { h: "What children take, and when", p: ["The tests take place in the same week in May each year. The English tests are the reading test, a grammar and punctuation test, and a spelling test, alongside the maths tests. Writing is not tested in this way. It is assessed by the teacher, which is covered below."] },
      { h: "The reading test", p: ["The reading test is a single paper of 60 minutes. It has three texts of different kinds, usually a mix of different kinds of text, with questions on each. In total the paper is worth 50 marks, and the questions are a mix of multiple choice, short written answers and longer written answers worth one to three marks.", "The questions test several skills:"], ul: [
        "Finding and recording information that is stated in the text.",
        "Working out what a word or phrase means in context.",
        "Making inferences, which means reading between the lines, and explaining them with evidence.",
        "Explaining how the writer's choices affect the reader.",
        "Summarising a section, or comparing ideas."], extra: "Inference and retrieval questions make up a large share of the paper, which is why asking \"how do you know?\" at home is such useful practice." },
      { h: "Grammar, punctuation and spelling", p: ["There is a 45-minute grammar and punctuation paper, covering things like word classes, clauses, tenses and punctuation marks. There is also a separate short spelling test of 20 words, which takes about 15 minutes and is read aloud to the children."] },
      { h: "How results are reported", p: ["Each child's marks are turned into a scaled score. A scaled score of 100 or more means the child has met the expected standard in that test. The lowest score is 80 and the highest is 120. Scaled scores exist so that results can be compared fairly from year to year, because individual papers vary a little in difficulty. Parents receive their child's results from the school."] },
      { h: "How writing is assessed", p: ["There is no SATs writing test. Instead, the class teacher judges your child's writing using work collected across Year 6, in different subjects as well as English, against national standards. There are three possible judgements: working towards the expected standard, working at the expected standard, and working at greater depth. Schools' judgements are checked through a process of moderation.", "This has an important consequence for parents. Because the judgement comes from a body of work, regular, good-quality writing across the year matters more than any single piece. It is also worth asking the teacher what they are looking for."] },
      { h: "Helping with reading at home", ul: [
        "Practise the five question types above on short texts. Ten to fifteen minutes, a few times a week, is plenty.",
        "Ask \"how do you know?\" Pointing to the line that proves an answer is the key habit.",
        "Build stamina with longer texts. A paper with three texts in 60 minutes works out at roughly twenty minutes per text, so practise reading a text and answering questions in about that time, occasionally.",
        "Teach children to read the question first, then find the answer. Underline key words in the question.",
        "Encourage wide reading. Children who read widely meet more words and ideas, which helps with every question type."] },
      { h: "Helping with grammar, punctuation and spelling", ul: [
        "Learn the terms in short bursts: noun, verb, adjective, adverb, conjunction, clause, and so on. Use examples from your child's own writing.",
        "For spelling, practise the words the class is given, and spend a few minutes a day on patterns such as common prefixes, suffixes and endings.",
        "Remember the spelling test is only 20 words. Practise saying words by syllables and writing them from memory."] },
      { h: "Helping with writing at home", p: ["Encourage a short piece each week in a different form, such as a story, a letter, a diary entry or an explanation. Give one piece of feedback each time and let your child rewrite one paragraph. Our free prompt generator gives you ideas to start from."] },
      { h: "Keeping it calm", p: ["Children pick up on adult worry. Present the tests as a chance to show what they have learned, keep routines normal, and make sure they are sleeping and eating well in test week. The results are a snapshot used by the school and, later, by their secondary school, and they say nothing about your child's worth."] },
    ],
    faq: [
      ["What does a scaled score of 100 mean?", "It means the child has met the expected standard in that test. Scores run from 80 to 120."],
      ["Is writing tested in the SATs?", "No. Writing is assessed by the teacher using work from across Year 6."],
      ["How long is the reading test?", "60 minutes, with three texts and 50 marks in total."],
      ["How can I see sample papers?", "Past papers and the test frameworks are published on the government's website, and your school can share practice material."],
    ],
    related: rel("uk", "comprehension", "worksheets", "spelling", "prompts"),
  },

  "11-plus-english-explained": {
    slug: "11-plus-english-explained",
    title: "11+ English explained: what is tested and how to prepare",
    description: "A plain guide to the English part of the 11+ in England: what is tested, why papers differ by area, key dates, and how to prepare without overdoing it.",
    lead: "The 11+ is the entrance test some areas of England use to select pupils for grammar and other selective secondary schools. There is no single national 11+, so the first and most important step is to find out exactly what your area and your chosen schools use. This guide explains the English side in general terms.",
    sections: [
      { h: "It varies by area and school", p: ["The format, the subjects and the test provider differ between areas, groups of schools and sometimes individual schools. Some tests include English, maths, verbal reasoning and non-verbal reasoning, and others use only some of these. Some use multiple-choice answer sheets, and some use written answers. Some are set by a national test provider, and others are written locally. Because of all this, general 11+ books and websites are a guide only.", "The best sources are always the websites of the schools you are interested in, and your local authority's admissions information. They will tell you which tests, which subjects, which dates and how places are decided."] },
      { h: "Key dates to know", p: ["The tests are usually taken in the autumn term of Year 6, often in September or early October, and many schools ask families to register in advance over the summer. Separately, the application for a secondary school place in England is made through your local authority, opens on 1 September and closes on 31 October for entry the following September. Offers are sent on National Offer Day in early March. Check your area's own timetable, because registration and test dates differ."] },
      { h: "What the English paper usually covers", p: ["Where there is an English paper, it commonly includes some or all of the following:"], ul: [
        "Reading comprehension: a passage followed by questions that check understanding, inference and vocabulary.",
        "Vocabulary: word meanings, synonyms and antonyms, and choosing the right word in context.",
        "Grammar, punctuation and spelling, for example choosing the correct form, spotting errors or completing sentences.",
        "Writing, in some areas, which may be a short piece such as a story, description or argument, written in a set time."] },
      { h: "Why reading comprehension matters most", p: ["Comprehension and vocabulary reward the same habits: reading widely, noticing how words are used and being able to say how you know. The passages can be harder than children are used to, and may include older or more formal language. Children who are used to reading a range of fiction and non-fiction cope better."] },
      { h: "A calm preparation plan", ul: [
        "Start with the schools' own information, and find out which provider and format to prepare for.",
        "Build a daily reading habit of twenty minutes or so. Include non-fiction and some older writing.",
        "Keep a vocabulary notebook of new words your child meets, with a short meaning and a sentence. Revisit a few each week.",
        "Practise comprehension in short sessions, and ask how they know each answer.",
        "Once the format is familiar, add occasional timed practice with sample or past papers from the named provider. Mark them together and talk about mistakes.",
        "If writing is tested, practise planning and finishing a short piece in a set time, and rereading it."] },
      { h: "Common mistakes to avoid", ul: [
        "Starting too early and too intensively. Months of gentle routine usually serve a child better than a last-minute burst.",
        "Drilling past papers without discussing mistakes. The learning is in understanding why an answer was wrong.",
        "Ignoring vocabulary. Many wrong answers come from not knowing a single word.",
        "Rushing. Many children lose marks by not reading the question or passage carefully."] },
      { h: "Keeping perspective", p: ["The 11+ is one route among several, and many excellent schools do not use it. Children who are tired or anxious do worse than they should. A steady, modest routine, with plenty of time for play and rest, is kinder and usually more useful. Whatever the outcome, a child who has built a reading habit and a stronger vocabulary has gained something real."] },
    ],
    faq: [
      ["Is there one national 11+?", "No. It depends on the area and the school, so check with the schools you are interested in and your local authority."],
      ["When is it taken?", "Usually in the autumn term of Year 6, often in September or early October, though some areas differ."],
      ["When do I apply for a secondary school place?", "Applications to your local authority open on 1 September and close on 31 October for entry the following September. Check your authority's own dates."],
      ["Does every 11+ include writing?", "No. Many tests have only comprehension, vocabulary and grammar. Some include a short writing task."],
    ],
    related: rel("uk", "comprehension", "worksheets", "reading", "length"),
  },

  "gcse-english-language-explained": {
    slug: "gcse-english-language-explained",
    title: "GCSE English Language explained: the six assessment objectives",
    description: "How GCSE English Language is assessed in England: both papers question by question, the six objectives (AO1 to AO6), and how to help a teenager.",
    lead: "GCSE English Language is marked against six assessment objectives, usually shortened to AO1 to AO6. Knowing what they mean, and how they appear in each paper, shows you exactly what examiners are looking for. This guide uses the AQA specification, the most widely taught. Other exam boards have similar objectives but different paper structures, so check your own board's specification.",
    sections: [
      { h: "The two papers", p: ["AQA GCSE English Language has two papers. Each paper lasts 1 hour 45 minutes, is worth 80 marks and counts for half of the GCSE. Each has a reading section followed by a writing section.", "Paper 1, Explorations in Creative Reading and Writing, uses a fiction extract for reading and asks for narrative or descriptive writing. Paper 2, Writers' Viewpoints and Perspectives, uses two non-fiction texts, from different times, for reading and asks for writing that gives the student's own viewpoint on a topic. Grades are reported on a 9 to 1 scale, where 9 is the highest."] },
      { h: "Paper 1, question by question", ul: [
        "Question 1 (4 marks): find and list four pieces of information from a short part of the text. This is AO1.",
        "Question 2 (8 marks): analyse how the writer uses language to create an effect. This is AO2.",
        "Question 3 (8 marks): analyse how the writer uses structure, such as shifts in focus, to hold the reader's interest. This is AO2.",
        "Question 4 (20 marks): evaluate how far you agree with a statement about the text, using evidence. This is AO4.",
        "Question 5 (40 marks): a descriptive or narrative writing task, with 24 marks for content and organisation (AO5) and 16 marks for technical accuracy (AO6)."] },
      { h: "Paper 2, question by question", ul: [
        "Question 1 (4 marks): choose which statements are true. This is AO1.",
        "Question 2 (8 marks): write a summary of the differences between the two texts. This is AO1.",
        "Question 3 (12 marks): analyse how the writer uses language in one text. This is AO2.",
        "Question 4 (16 marks): compare the writers' perspectives and how they convey them across both texts. This is AO3.",
        "Question 5 (40 marks): a viewpoint writing task such as an article, speech or letter, with 24 marks for content and organisation (AO5) and 16 marks for technical accuracy (AO6)."] },
      { h: "The reading objectives (AO1 to AO4)", ul: [
        "AO1: identify and interpret explicit and implicit information and ideas, and select and synthesise evidence from different texts.",
        "AO2: explain, comment on and analyse how writers use language and structure to achieve effects and influence readers, using relevant terminology.",
        "AO3: compare writers' ideas and perspectives, as well as how these are conveyed, across two or more texts.",
        "AO4: evaluate texts critically and support this with appropriate textual references."] },
      { h: "The writing objectives (AO5 and AO6)", ul: [
        "AO5: communicate clearly, effectively and imaginatively, selecting and adapting tone, style and register for different forms, purposes and audiences, and organise information and ideas, using structural and grammatical features to support coherence and cohesion.",
        "AO6: use a range of vocabulary and sentence structures for clarity, purpose and effect, with accurate spelling and punctuation."], extra: "In plain terms, AO5 asks whether the writing is well planned, fits its purpose and reads well. AO6 asks whether the language is varied and the spelling and punctuation are accurate. Because AO6 carries 16 of the 40 marks in each writing question, accuracy is worth real effort." },
      { h: "How to help with reading questions", ul: [
        "For short retrieval questions, practise finding exact details and not adding opinions.",
        "For language questions, teach a simple routine: quote a short phrase, name the technique if you can, say what it makes the reader think or feel, and say why the writer chose it.",
        "For structure questions, practise noticing how a text begins, where the focus shifts and how it ends, and what effect each choice has.",
        "For comparison, practise writing one sentence that links the two writers' views before giving evidence from each.",
        "For evaluation, practise forming a clear judgement, then proving it with short quotations."] },
      { h: "How to help with writing questions", ul: [
        "Plan for five minutes. For narrative, plan a beginning, a build-up, a turning point and an ending. For viewpoint writing, plan three clear points and a strong opening and ending.",
        "Choose a tone and register that fits the form and audience. A speech sounds different from a letter to a newspaper.",
        "Use a range of sentence types and vary the openings. Paragraph clearly.",
        "Save five minutes to check spelling, punctuation and missing words.",
        "For viewpoint writing, build each point as a paragraph using the PEEL or PEAL pattern."] },
      { h: "Revision tips that help", ul: [
        "Use the exam board's past papers and mark schemes. They show what top answers look like.",
        "Practise a single question type at a time, rather than whole papers only.",
        "Ask a teacher or tutor to mark one answer in detail, then redo it.",
        "Read widely. Newspaper articles, speeches and good fiction all build the range of language needed.",
        "Keep a list of useful terms, such as simile, metaphor, tone, perspective, structure and shift, with an example of each."] },
      { h: "A note on feedback tools", p: ["Reading objectives such as AO2 and AO3 are judged on how a student responds to texts, so they can only be judged from reading answers, not from a student's own essay. LiteracyLab AI bands a piece of writing on the writing objectives and leaves the reading ones to its reading practice. It gives bands, not marks, and it is not a replacement for the feedback of a teacher who knows the student and the exam board's own mark scheme."] },
    ],
    faq: [
      ["Are the objectives the same for every exam board?", "They are very similar across boards, but the paper structures and mark totals differ. Check your board's specification."],
      ["How are grades reported?", "On a 9 to 1 scale, with 9 the highest."],
      ["How many marks are there for accuracy in the writing questions?", "In AQA, 16 of the 40 marks in each writing question are for technical accuracy (AO6)."],
      ["Where can I see past papers?", "Past papers and mark schemes are published on the exam board's website."],
    ],
    related: rel("uk", "peel", "feedback", "how", "spelling"),
  },

  "common-core-writing-standards-explained": {
    slug: "common-core-writing-standards-explained",
    title: "Common Core writing standards explained for parents",
    description: "The three kinds of writing in the Common Core standards (opinion or argument, informative, narrative), how they grow by grade, and tips for home.",
    lead: "The Common Core State Standards for English describe what US students should be able to do in writing at each grade. Not every state uses them in the same way, and some have replaced or adapted them, so check your own state's standards and your child's school. This guide explains the main ideas in plain terms.",
    sections: [
      { h: "The three kinds of writing", p: ["The first three writing standards, called W.1 to W.3, describe three kinds of writing students are expected to do at every grade:"], ul: [
        "Opinion and argument (W.1): state a point of view or claim and support it with reasons and evidence. In Kindergarten to Grade 5 this is called opinion writing, and from Grade 6 it is called argument writing.",
        "Informative and explanatory (W.2): examine a topic and explain ideas and information clearly.",
        "Narrative (W.3): develop real or imagined experiences or events using effective technique, descriptive details and a clear sequence of events."], extra: "A fourth idea sits behind all of these: students are expected to write routinely, over longer periods for research and revision and over shorter periods in a single sitting, for many purposes and audiences." },
      { h: "How opinion writing starts: Grade 3", p: ["In Grade 3 the standard asks students to write opinion pieces on topics or texts, supporting a point of view with reasons. It has four parts. Students introduce the topic or text, state an opinion and organise a list of reasons. They give reasons that support the opinion. They use linking words and phrases such as because, therefore, since and for example to connect the opinion and the reasons. And they provide a concluding statement or section.", "A Grade 3 example: \"I think our class should have a pet. First, a pet would teach us to be responsible. For example, we would take turns feeding it. Also, it would make our classroom friendlier. That is why our class should have a pet.\""] },
      { h: "How argument writing develops: Grades 6 to 12", p: ["In Grade 6 the standard changes to writing arguments to support claims with clear reasons and relevant evidence. By Grades 9 and 10 students are asked to write arguments to support claims in an analysis of substantive topics or texts, using valid reasoning and relevant and sufficient evidence. In practice, that means students:"], ul: [
        "Introduce precise claims and distinguish them from alternate or opposing claims.",
        "Develop claims and counterclaims fairly, supplying evidence for each and pointing out strengths and limitations of both.",
        "Use words, phrases and clauses to link the major sections of the text and show relationships between claims, reasons and evidence.",
        "Establish and maintain a formal style and objective tone.",
        "Provide a concluding statement or section that follows from the argument."] },
      { h: "Informative and narrative writing", p: ["Informative writing starts with naming a topic and supplying facts and details, and grows into organising information into categories, using precise language and domain-specific vocabulary, and drawing on evidence from sources. Narrative writing starts with recounting events in order and adding details and feelings, and grows into using dialogue, pacing, description and reflection to develop characters and situations."] },
      { h: "How to help at home: Kindergarten to Grade 2", ul: [
        "Ask for opinions with reasons: \"Which animal do you like best, and why?\" Write one sentence together.",
        "Let your child draw first, then label and describe the drawing in a sentence.",
        "Read stories and ask what happened first, next and last."] },
      { h: "How to help at home: Grades 3 to 5", ul: [
        "Ask for a reason every time your child gives an opinion, then ask for an example.",
        "Practise linking words such as because, for example and therefore, in speaking first, then in writing.",
        "For explanations, ask your child to teach you something they know, then write it in order.",
        "For stories, plan a beginning, a problem and an ending before writing."] },
      { h: "How to help at home: Grades 6 to 12", ul: [
        "Ask your child to argue the opposite side of a topic for a minute, then to say which side is stronger and why. This builds the habit of counterclaims.",
        "Practise building each paragraph with a point, evidence and explanation. Our PEEL and PEAL article shows how.",
        "Encourage using evidence from what they read, since the standards ask for evidence from texts as well as claims.",
        "Read their writing aloud together to check tone and flow."] },
      { h: "Reading standards sit alongside", p: ["The same standards also ask students to cite textual evidence in what they read. This is why good writing practice and good reading practice help each other. A student who can find and quote the best evidence in a text is better at using evidence in their own argument."] },
      { h: "What the standards do not tell you", p: ["The standards describe what students should be able to do, not how long a piece should be or how it will be marked on a particular state test. For those details, look at your state's own assessment information and ask your child's teacher what the class is working on."] },
    ],
    faq: [
      ["Does every state use Common Core?", "States adopted and adapted the standards differently, and some have replaced them. Check your state's standards."],
      ["What is the difference between opinion and argument writing?", "In Kindergarten to Grade 5, students write opinion pieces with reasons. From Grade 6 they write arguments with claims, evidence and reasoning, and later address opposing claims."],
      ["What are linking words?", "Words and phrases such as because, therefore, since and for example that connect an opinion to its reasons."],
      ["How long should a student's writing be?", "The standards do not set lengths. See our article on how much a child should write for practical targets."],
    ],
    related: rel("us", "peel", "length", "prompts", "feedback"),
  },
};

module.exports = { EXAM };
