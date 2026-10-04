// Twelve plain-English articles for parents. Rules for everything here (a test enforces the
// mechanical ones): no statistics, guarantees, rankings or endorsements; exam details only where
// they were checked against the exam provider's published material, and each exam article tells
// the reader to confirm current details with the school or provider; examples are invented by us.

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
};
const rel = (...keys) => keys.map((k) => LINKS[k]);

const ARTICLES = [
  {
    slug: "help-with-reading-comprehension-at-home",
    title: "How to help your child with reading comprehension at home",
    description: "Simple, calm ways to build reading comprehension at home: what to ask, how to practise inference and vocabulary, and how to keep it short and regular.",
    lead: "Reading comprehension is understanding what you read, not just saying the words. It grows with short, regular practice and good questions. Here is a simple routine that works for most children aged 7 to 12.",
    sections: [
      { h: "Start with a short text", p: ["Pick something about half a page long that your child finds at least a little interesting: a story, a news item for children, a page from a non-fiction book. A short text lets you finish in ten minutes, which makes it easy to do again tomorrow."] },
      { h: "Read it twice", p: ["Let your child read it aloud or silently once. Then ask them to read it again with a pencil, underlining any word they are unsure of. The second read is where most of the understanding happens."] },
      { h: "Ask four kinds of question", ul: [
        "Find it: \"What colour was the door?\" The answer is written in the text.",
        "Word meaning: \"What does reluctant mean here?\" Show them how to use the sentence around the word to work it out.",
        "Read between the lines (inference): \"Why do you think Sam kept checking the window?\" The text does not say, so they need a clue and a reason.",
        "Sum it up: \"Tell me what this was about in one sentence.\""] },
      { h: "Always ask \"how do you know?\"", p: ["This one question builds the habit that school tests reward: pointing to the line that proves your answer. If they say \"Sam was nervous\", ask which words showed it. A child who can answer that is reading closely."] },
      { h: "Keep it kind and short", p: ["Ten to fifteen minutes, a few times a week, beats one long session. If your child gets something wrong, read the sentence together and look for the clue instead of giving the answer. Praise the specific thing they did well, such as finding the right line."] },
      { h: "Where to find texts", p: ["Library books, children's news sites and our own free printable worksheets all work. Each of our worksheets has an original passage, questions of the four kinds above and an answer key, so you can mark it yourself."] },
    ],
    faq: [
      ["How long should a session be?", "Ten to fifteen minutes is plenty. Little and often works better than one long sitting."],
      ["What if my child can read fluently but still misses questions?", "That is common. Fluent reading and understanding are different skills. Slow down, reread, and practise asking how they know each answer."],
    ],
    related: rel("worksheets", "reading", "guides"),
  },
  {
    slug: "correct-your-childs-writing-without-putting-them-off",
    title: "How to correct your child's writing without putting them off",
    description: "A calm way to give feedback on a child's writing: what to praise, the one thing to fix, and how to handle spelling mistakes so they keep writing.",
    lead: "A page covered in red pen can make a child decide they are bad at writing. Good feedback does the opposite: it shows them what already works and gives them one clear thing to try next.",
    sections: [
      { h: "Read it as a reader first", p: ["Before you look for mistakes, read the piece the way you would read a story or a letter. Then tell them what you noticed: a line that made you smile, a detail you could picture, a reason that convinced you."] },
      { h: "Praise something specific", p: ["\"Good job\" tells a child nothing. \"I could really see the dark kitchen when you wrote the floor creaked\" tells them exactly what to do again. Quote their words back to them."] },
      { h: "Choose one thing to improve", p: ["Pick the single change that would help most: adding a reason, starting sentences in different ways, or finishing with a clear ending. One step is something a child can actually do in the next piece. A list of ten corrections feels like failure."] },
      { h: "Leave most spelling for later", p: ["Unless the piece is for a spelling test, pick two or three words to fix together and let the rest go. Children who worry about spelling often write shorter, safer sentences. You can come back to spelling in a separate, low-pressure way."] },
      { h: "Let them fix it themselves", p: ["Ask them to reread the sentence aloud and see what they would change. Children often hear a missing full stop or a clumsy phrase when they read it out. When they find it themselves, it sticks."] },
      { h: "Show a corrected copy", p: ["Seeing their own sentences polished teaches more than a rule in a textbook. Write out a corrected version of one paragraph beside theirs, keeping their ideas and voice, and let them compare."] },
    ],
    faq: [
      ["Should I correct every mistake?", "No. Fixing everything at once is discouraging and hard to learn from. Choose one improvement and two or three words."],
      ["My child will not rewrite anything. What can I do?", "Try rewriting only one sentence together. Small wins build the habit."],
    ],
    related: rel("feedback", "prompts", "how"),
  },
  {
    slug: "how-much-should-my-child-write",
    title: "How much should my child write? Length by year group",
    description: "A practical guide to how long a child's writing should be in the UK, US and Australia, with example targets by year and why quality matters more than length.",
    lead: "There is no single correct length for a child's writing, and most curricula do not set one. But a rough target helps you judge whether a piece is thin, about right or long enough to show what a child can do.",
    sections: [
      { h: "Why length matters, and why it does not", p: ["A very short piece gives very little to work with. A child who writes two sentences has not had the chance to organise ideas, support a point or finish properly. On the other hand, a long piece is not automatically good: padding and repetition do not help.", "Think of length as a minimum that gives room to show skill, not a goal in itself."] },
      { h: "Practical targets we use", p: ["These are the practice targets LiteracyLab AI uses to judge whether a piece is short for the year. They are our own sensible guides built from exam and curriculum guidance where it exists, not rules set by a school or exam board."], ul: [
        "UK: Year 3 about 80 words, Year 4 about 120, Year 5 about 160, Year 6 about 250.",
        "US: Grade 3 about 150 words, Grade 4 about 200, Grade 5 about 250, Grade 6 about 300.",
        "Australia: Year 3 about 130 words, Year 4 about 170, Year 5 about 210, Year 6 about 260.",
        "Older students write more, for example around 450 words for UK Year 11 and about 650 for Australian Year 11."] },
      { h: "What if my child is well below that?", p: ["That is normal, especially for children who find writing hard. Aim to build up gradually: first add one more sentence with a reason, then one with an example. Praise the extra sentence, not the word count."] },
      { h: "What if my child writes a lot but it is hard to follow?", p: ["Length is not the problem then. Help them plan in three or four short points before writing, and read the piece aloud together to find where it loses the thread."] },
      { h: "Check what the task asks", p: ["Exams and class tasks often give their own guidance on length or time. If your child's teacher has given a target, use that."] },
    ],
    faq: [
      ["Do schools set a word count?", "Some tasks and exams give guidance, but most curricula describe writing in words rather than numbers. Check with the teacher."],
      ["Is longer always better?", "No. A focused piece with clear reasons beats a long one that repeats itself."],
    ],
    related: rel("uk", "us", "au", "prompts"),
  },
  {
    slug: "naplan-writing-explained",
    title: "NAPLAN writing explained for parents (Years 3, 5, 7 and 9)",
    description: "What the NAPLAN writing test asks of students, how results are described in four levels, and how to help your child practise at home without extra pressure.",
    lead: "NAPLAN is the national literacy and numeracy assessment taken by students in Years 3, 5, 7 and 9 in Australia. This guide covers the writing part: what children are asked to do and how to prepare calmly. Always confirm current dates and details with your school or the national NAPLAN website.",
    sections: [
      { h: "What the writing task looks like", p: ["Students are given an idea or prompt and asked to write a response in one kind of writing, either a narrative (a story) or a persuasive piece (an argument). The test takes place in the first part of the year and runs for around forty minutes, but your school will give the exact timetable."] },
      { h: "How results are described", p: ["Since 2023, results are reported in four proficiency levels: Exceeding, Strong, Developing and Needs additional support. Strong is the level students are expected to reach for their year. A result of Developing means a child is on the way and may benefit from focused help on specific skills. It is not a fail."] },
      { h: "What markers look for", p: ["Writing is marked against published criteria covering areas such as how well the writing fits its purpose and audience, how ideas are organised, how paragraphs and sentences are built, vocabulary, and spelling and punctuation. The national program publishes the criteria, so you can read them yourself."] },
      { h: "How to practise at home", ul: [
        "Practise both kinds: a short story and a short persuasive piece, one at a time.",
        "Plan first. Two minutes jotting a beginning, middle and end (or a point and two reasons) makes the writing clearer.",
        "Leave time to reread and fix. Even a minute helps catch missing full stops and repeated words.",
        "Use timed practice only occasionally, and keep it relaxed. Most of the learning comes from untimed writing with feedback."] },
      { h: "Keep it in proportion", p: ["NAPLAN is one snapshot, not a measure of your child. Regular writing and reading through the year does more than last-minute cramming."] },
    ],
    faq: [
      ["Is there a pass mark?", "Results are described in four levels, not pass or fail. Strong is the expected level for the year."],
      ["Which kinds of writing are tested?", "Narrative and persuasive writing. The task tells students which one to write."],
    ],
    related: rel("au", "prompts", "feedback"),
  },
  {
    slug: "ks2-sats-reading-and-writing-explained",
    title: "KS2 SATs reading and writing explained for parents (England)",
    description: "How the Year 6 SATs reading test and writing assessment work in England, what a scaled score of 100 means, and how to help at home without adding stress.",
    lead: "In England, children take national tests at the end of Key Stage 2 in Year 6, usually called SATs. This guide covers the English parts. Dates and formats can change, so confirm current details with your school or the government's published guidance.",
    sections: [
      { h: "The reading test", p: ["The reading test is a single paper of about an hour with several texts and a mix of question types, from finding facts to explaining what a character feels and why. Each child's marks are turned into a scaled score, where 100 is the expected standard."] },
      { h: "Grammar, punctuation, spelling", p: ["There are separate short tests for grammar and punctuation, and for spelling. They are marked externally and also reported as scaled scores."] },
      { h: "Writing is different", p: ["There is no SATs writing test. Writing is assessed by the teacher, using work collected through Year 6, and schools' judgements are checked between schools. This means regular, good-quality writing across the year matters more than a single practice piece."] },
      { h: "Helping with reading at home", ul: [
        "Practise the four question types: finding information, word meaning, inference and summary.",
        "Always ask how they know. Pointing to the line is the key habit.",
        "Read a text slowly once, then answer. Rushing is the most common reason for lost marks.",
        "Short and regular: ten to fifteen minutes a few times a week."] },
      { h: "Helping with writing at home", p: ["Encourage a short piece each week in different forms, such as a story, a letter or an explanation, and give one piece of feedback each time. Our free prompt generator and worksheets give you things to start from."] },
      { h: "Keep it calm", p: ["Children pick up on adult worry. Present the tests as a chance to show what they know, and keep other parts of life normal."] },
    ],
    faq: [
      ["What does a scaled score of 100 mean?", "It represents the expected standard. Scores are reported on a scale, and the school will explain your child's result."],
      ["Is writing tested in the SATs?", "No. Writing is teacher assessed during the year."],
    ],
    related: rel("uk", "worksheets", "reading"),
  },
  {
    slug: "11-plus-english-explained",
    title: "11+ English explained: what is tested and how to prepare",
    description: "A plain guide to the English part of the 11+ in England: comprehension, vocabulary and grammar, why papers differ by area, and how to prepare without overdoing it.",
    lead: "The 11+ is the entrance test some areas of England use for selective secondary schools. There is no single national 11+, so the first step is always to find out exactly what your area and school use.",
    sections: [
      { h: "It varies by area", p: ["The format, subjects and provider differ between areas, consortia and sometimes individual schools. Some papers include English, maths, verbal reasoning and non-verbal reasoning, and others use only some of these. The test is usually taken in the autumn of Year 6."] },
      { h: "What the English paper usually covers", ul: [
        "Reading comprehension: a passage followed by questions that check understanding, inference and vocabulary.",
        "Vocabulary: word meanings and using words in context.",
        "Grammar, punctuation and spelling, in some papers.",
        "Writing, in some areas, which may be a short piece such as a story or description."] },
      { h: "How to prepare calmly", ul: [
        "Find the school's own information first, and use past or sample papers from the provider they name.",
        "Build a reading habit. Wide reading builds vocabulary better than any list.",
        "Practise comprehension in short sessions and ask how they know each answer.",
        "If writing is tested, practise planning and finishing a short piece in a set time, and read it back to check."] },
      { h: "Keep perspective", p: ["The test is one route among several, and children who are tired or anxious do worse than they should. A steady, modest routine over months is kinder and usually more useful than intense last-minute practice."] },
    ],
    faq: [
      ["Is there one national 11+?", "No. It depends on the area and school, so check with the schools you are interested in."],
      ["When is it taken?", "Usually in the autumn of Year 6, though some areas differ. The school or local authority will give the dates."],
    ],
    related: rel("uk", "worksheets", "reading"),
  },
  {
    slug: "gcse-english-language-explained",
    title: "GCSE English Language explained: the six assessment objectives",
    description: "What GCSE English Language assesses in England: reading objectives AO1 to AO4, writing objectives AO5 and AO6, and how to help a teenager improve at each.",
    lead: "GCSE English Language is marked against six assessment objectives, usually shortened to AO1 to AO6. Knowing what they mean shows you what examiners are looking for. This guide uses the AQA wording; other exam boards use similar objectives. Check your own board's specification for exact details.",
    sections: [
      { h: "The reading objectives (AO1 to AO4)", ul: [
        "AO1: find and understand information and ideas, both stated and implied, and pick evidence from different texts.",
        "AO2: explain how writers use language and structure to create effects and influence readers, using the right terms.",
        "AO3: compare writers' ideas and perspectives across two texts, and how they are shown.",
        "AO4: judge a text critically and back it up with references to it."] },
      { h: "The writing objectives (AO5 and AO6)", ul: [
        "AO5: write clearly and effectively for a purpose and audience, choosing the right tone, style and register, and organise ideas so the writing hangs together.",
        "AO6: use a range of vocabulary and sentence structures for effect, with accurate spelling and punctuation."] },
      { h: "How the papers use them", p: ["Each paper has a reading section and a writing section. Narrative or descriptive writing is tested on one paper and argument or viewpoint writing on the other. Results are reported on a 9 to 1 grade scale."] },
      { h: "Helping a teenager improve", ul: [
        "For reading, practise quoting a short phrase and saying what it suggests, then what effect it has on the reader.",
        "For writing, plan three or four clear points before starting and finish with a purposeful ending.",
        "For accuracy, reread for full stops, capital letters and apostrophes. These are easy marks.",
        "Past papers and mark schemes from the exam board's website show what the top answers look like."] },
      { h: "A note on feedback tools", p: ["Reading objectives such as AO2 and AO3 are judged on how a student responds to texts, so they can only be judged from reading answers, not from a student's own essay. LiteracyLab AI bands a piece of writing on the writing objectives and leaves the reading ones to its reading practice."] },
    ],
    faq: [
      ["Are the objectives the same for every exam board?", "They are very similar across boards, but check your board's specification for the exact wording."],
      ["How are grades reported?", "On a 9 to 1 scale, with 9 the highest."],
    ],
    related: rel("uk", "feedback", "how"),
  },
  {
    slug: "common-core-writing-standards-explained",
    title: "Common Core writing standards explained for parents",
    description: "The three kinds of writing in the Common Core standards (opinion or argument, informative and narrative) and what they look like as children move up the grades.",
    lead: "The Common Core State Standards for English describe what US students should be able to do in writing at each grade. Not every state uses them in the same way, so check your own state's standards. This guide explains the three main kinds of writing in plain terms.",
    sections: [
      { h: "The three kinds of writing", ul: [
        "Opinion and argument (W.1): state a claim and support it with reasons and evidence. In the early grades this starts as opinion writing, and it grows into logical argument.",
        "Informative and explanatory (W.2): explain a topic clearly using facts, definitions and details.",
        "Narrative (W.3): tell a real or imagined story with well-chosen details and events in a clear order."] },
      { h: "How it grows with the grades", p: ["Young children state an opinion and give a reason. Upper-elementary students learn to organise reasons and link them with words such as because and for example. In middle and high school the emphasis moves to making precise claims, using evidence from texts and answering opposing views."] },
      { h: "How to help at home", ul: [
        "Ask for a reason every time your child gives an opinion: \"Why do you think that?\" Then ask for an example.",
        "For explanations, ask them to teach you something they know, then write it down in order.",
        "For stories, help them plan a beginning, a problem and an ending before they start.",
        "Praise specific details and clear reasons rather than length."] },
      { h: "Reading standards sit alongside", p: ["The same standards also ask students to cite evidence from what they read. This is why good writing practice and good reading practice help each other."] },
    ],
    faq: [
      ["Does every state use Common Core?", "States adopted and adapted the standards differently. Check your state's own standards."],
      ["What is the difference between opinion and argument writing?", "Opinion writing in early grades states a view and gives reasons. Argument writing in later grades requires claims backed by evidence and reasoning."],
    ],
    related: rel("us", "prompts", "feedback"),
  },
  {
    slug: "peel-and-peal-paragraphs-explained",
    title: "PEEL and PEAL paragraphs explained, with an example",
    description: "What PEEL and PEAL paragraph structures are, how they differ, and a worked example showing each part so your child can use them in essays and arguments.",
    lead: "PEEL and PEAL are two simple ways to build a paragraph that proves a point. They are used in many schools for essays and argument writing. Each letter is one job the paragraph has to do.",
    sections: [
      { h: "PEEL", p: ["Point, Evidence, Explain, Link."], ul: [
        "Point: say what you are arguing in one sentence.",
        "Evidence: give a fact, quote or example that backs it up.",
        "Explain: say what the evidence shows and why it supports the point.",
        "Link: connect back to the question or on to the next idea."] },
      { h: "PEAL", p: ["The same idea with Analysis in place of Explain. Analysis means saying why the evidence matters and what effect it has, not just what it shows. It is used a lot when writing about texts and when building arguments."] },
      { h: "A worked example", p: ["Question: should children have less homework?"], ul: [
        "Point: Children should have less homework because they need time to rest.",
        "Evidence: A school day is already about six hours of learning, and many children also have clubs and chores.",
        "Analysis: Tired children find it harder to concentrate, so extra homework late in the evening may teach them less than the same time asleep.",
        "Link: Therefore a lighter homework load would help children learn better, not worse."] },
      { h: "Common mistakes", ul: [
        "Writing the point and the evidence but skipping the explanation, which is where most marks are earned.",
        "Choosing evidence that does not really prove the point.",
        "Forgetting to link back, so the paragraph ends without a conclusion."] },
      { h: "Practise it", p: ["Pick a simple question, such as the example above, and write one paragraph using each part in turn. Then label the four parts with different coloured pencils. LiteracyLab AI shows the framework labelled in a student's own response and in a model response for the same task."] },
    ],
    faq: [
      ["What is the difference between PEEL and PEAL?", "Only the third letter. Explain says what the evidence shows, and Analysis goes further to say why it matters and its effect."],
      ["Does every paragraph need all four parts?", "In a structured essay it is a good habit. Writers can vary the order once they are confident."],
    ],
    related: rel("feedback", "how", "prompts"),
  },
  {
    slug: "story-mountain-explained",
    title: "Story Mountain explained: planning a story step by step",
    description: "What the Story Mountain is, its five parts (opening, build-up, climax, resolution, ending), and how to use it to help a child plan a story that holds together.",
    lead: "The Story Mountain is a simple way to plan a story so it has a shape. Picture a mountain: the story climbs to an exciting peak and then comes back down. Children aged about 7 to 12 use it in many schools.",
    sections: [
      { h: "The five parts", ul: [
        "Opening: introduce who and where.",
        "Build-up: something starts to happen, and the tension grows.",
        "Climax: the most exciting or tense moment, the top of the mountain.",
        "Resolution: the problem gets sorted out.",
        "Ending: how things settle, and how the character feels now."] },
      { h: "A tiny example", ul: [
        "Opening: Mia is camping with her dad by a lake.",
        "Build-up: At night she hears a rustling outside the tent.",
        "Climax: She unzips the tent and sees two glowing eyes.",
        "Resolution: It is a hedgehog looking for crumbs.",
        "Ending: Mia laughs, shares a biscuit and falls asleep."] },
      { h: "How to use it", p: ["Draw a mountain on paper and write one line at each point before your child writes the story. Planning takes two minutes and fixes the most common problem in children's stories: a lot of build-up and then a rushed ending."] },
      { h: "Common problems", ul: [
        "No problem: the story is just a list of things that happened. Ask what goes wrong.",
        "A climax that is not very exciting. Ask what the worst thing that could happen is.",
        "An abrupt ending. Ask how the character feels at the end and what has changed."] },
      { h: "Make it their own", p: ["Once they can use the mountain, encourage them to change it: start in the middle of the action or end on a surprise. Structure is a starting point, not a cage."] },
    ],
    faq: [
      ["What age is the Story Mountain for?", "It is most often used with children of about 7 to 12, but the idea works for any age."],
      ["Does every story need all five parts?", "For planning, yes. Later they can vary or combine parts."],
    ],
    related: rel("prompts", "feedback", "guides"),
  },
  {
    slug: "show-dont-tell-explained",
    title: "Show, don't tell: how to teach it with simple examples",
    description: "What show, don't tell means in writing, with before and after examples for children, and simple exercises to help them describe instead of just naming a feeling.",
    lead: "Show, don't tell is advice every writing teacher gives. Instead of naming a feeling or a fact, describe what a reader would see, hear or feel that proves it.",
    sections: [
      { h: "Telling versus showing", p: ["Telling names it: She was scared. Showing makes the reader work it out: Her hands shook as she reached for the door handle. The second version feels more real because the reader notices the clue themselves."] },
      { h: "More examples", ul: [
        "Telling: It was a hot day. Showing: The pavement burned through my sandals and the ice cream ran down my wrist.",
        "Telling: He was angry. Showing: He slammed the door so hard the picture on the wall rattled.",
        "Telling: The room was messy. Showing: Clothes covered the floor, and a cereal bowl balanced on the stack of books."] },
      { h: "Simple exercises", ul: [
        "Pick a feeling card (nervous, proud, bored) and write two sentences that show it without using the word.",
        "Take a sentence from their own writing that says a feeling and rewrite it using what the character does or sees.",
        "Use the five senses: ask what the character sees, hears, smells, touches and tastes."] },
      { h: "When telling is fine", p: ["Showing everything makes writing slow. Use telling for quick facts, and save showing for the moments that matter most."] },
      { h: "A tip for feedback", p: ["When reading your child's writing, circle one sentence that tells and ask: what would we see if this were true? Let them rewrite just that sentence."] },
    ],
    faq: [
      ["What ages is this for?", "Children can start from about 7 with simple examples, and it stays useful through secondary school."],
      ["Should every sentence show?", "No. Show the important moments and tell the rest quickly."],
    ],
    related: rel("feedback", "prompts", "guides"),
  },
  {
    slug: "help-a-child-who-makes-lots-of-spelling-mistakes",
    title: "Helping a child who makes lots of spelling and punctuation mistakes",
    description: "Practical, low-pressure ways to help a child with frequent spelling and punctuation errors: what to fix first, how to practise, and when to seek extra help.",
    lead: "Lots of spelling and punctuation mistakes can worry parents, but they are fixable. The key is to work on a few things at a time, keep it low-pressure, and not let mistakes stop your child from writing.",
    sections: [
      { h: "Separate ideas from accuracy", p: ["Praise the ideas first, always. Treat spelling and punctuation as a separate job done afterwards, like proofreading. Children who are afraid of mistakes tend to write less and use only words they can spell."] },
      { h: "Fix the common ones first", ul: [
        "Capital letters at the start of sentences and for names, and the word I.",
        "Full stops at the end of sentences. Reading aloud shows where the breaks are.",
        "Common words they use often, such as because, friend and said.",
        "Apostrophes for short forms like don't, before the harder uses."] },
      { h: "Pick two or three words at a time", p: ["Choose the words that appear most in their writing and practise those. Look, say, cover, write, check works well: look at the word, say it by syllables, cover it, write it from memory, then check."] },
      { h: "Use their own writing", p: ["Words from their own work matter more to them than a list. Keep a small \"my words\" page and add two or three each week."] },
      { h: "Read it aloud", p: ["Reading their writing aloud, exactly as written, helps a child catch missing words and punctuation. Do it together and let them make the fixes."] },
      { h: "When to ask for more help", p: ["If spelling and writing are very hard compared with other work, or your child is distressed by it, talk to their teacher. Some children benefit from extra support, and an early conversation helps."] },
    ],
    faq: [
      ["Should I correct every spelling mistake?", "No. Choose two or three words and fix those together."],
      ["Does reading more help spelling?", "It helps, because children meet words in context, but it works best alongside short, regular practice of common words."],
    ],
    related: rel("feedback", "how", "guides"),
  },
];

module.exports = { ARTICLES, LINKS };
