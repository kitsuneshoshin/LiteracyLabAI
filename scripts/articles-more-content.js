// Nine more plain-English articles for parents, on what the product now does and what parents search for. The same
// rules as articles-content.js apply (tests enforce the mechanical ones): no statistics, guarantees, rankings or
// endorsements; exam details only where checked against published material, with a reminder to confirm current
// details with the school or the provider; every example is invented by us.

const LINKS = {
  guides: ["/learn/", "All year-by-year guides"],
  prompts: ["/learn/prompts/", "Free writing prompt generator"],
  worksheets: ["/learn/worksheets/", "Free reading comprehension worksheets"],
  feedback: ["/learn/writing-feedback-for-kids/", "What good writing feedback looks like"],
  reading: ["/learn/reading-comprehension-practice/", "Reading comprehension practice"],
  how: ["/learn/how-it-works/", "How LiteracyLab AI works"],
  comprehension: ["/learn/articles/help-with-reading-comprehension-at-home/", "Helping with reading comprehension at home"],
  naplanWriting: ["/learn/articles/naplan-writing-explained/", "NAPLAN writing explained"],
  naplanReading: ["/learn/articles/naplan-reading-explained/", "NAPLAN reading explained"],
  inference: ["/learn/articles/help-your-child-with-inference-questions/", "Helping with inference questions"],
  aforest: ["/learn/articles/persuasive-devices-aforest-explained/", "Persuasive devices (AFOREST) explained"],
  race: ["/learn/articles/race-and-cer-short-answers-explained/", "RACE and CER short answers explained"],
  vocab: ["/learn/articles/build-vocabulary-at-home/", "How to build vocabulary at home"],
  tfng: ["/learn/articles/true-false-not-given-questions-explained/", "True, False, Not Given questions explained"],
  tables: ["/learn/articles/how-to-read-a-table-or-graph-question/", "How to read a table or graph question"],
  twoTexts: ["/learn/articles/comparing-two-texts-how-to-help-a-child/", "Comparing two texts: how to help a child"],
  poetry: ["/learn/articles/helping-a-child-read-poetry/", "Helping a child read poetry"],
  peel: ["/learn/articles/peel-and-peal-paragraphs-explained/", "PEEL and PEAL paragraphs explained"],
};
const rel = (...keys) => keys.map((k) => LINKS[k]);

const MORE = [
  {
    slug: "naplan-reading-explained",
    title: "NAPLAN reading explained for parents (Years 3, 5, 7 and 9)",
    description: "What the NAPLAN reading test asks of students, the kinds of text and question, what the four result levels mean, and how to practise calmly at home.",
    lead: "NAPLAN reading checks how well students in Years 3, 5, 7 and 9 understand what they read. This guide explains what the test looks like, what the results mean and how to help at home without adding pressure. Details change from year to year, so confirm them with your child's school or the National Assessment Program website (nap.edu.au).",
    sections: [
      { h: "When it happens", p: ["NAPLAN is held in March each year, in Term 1, for every student in Years 3, 5, 7 and 9. Reading is one of the tests, alongside writing, language conventions (spelling, grammar and punctuation) and numeracy. Schools tell families the timetable for their own students."] },
      { h: "How the test is delivered", p: ["Students take the reading test on a computer. The test is tailored: after an opening set of questions, a student is given a next set that is harder or easier depending on how they went. That means two children in the same class can see different questions. This is designed so that the test can measure a wide range of ability more precisely, so a child who sees easier questions has not failed."] },
      { h: "What students read", p: ["Students read a range of texts: informative texts such as an article, imaginative texts such as a story or poem, and persuasive texts that argue a point of view. The texts get longer and more complex in the older years."] },
      { h: "What the questions ask", p: ["Most questions are multiple choice, and some are interactive, for example choosing or dragging words or sentences. Across the years the thinking moves from finding information that is stated, to working out the meaning of words from the sentence around them, to inference (understanding what the text suggests but does not say), and in the older years to comparing ideas and judging how a writer persuades."] },
      { h: "How results are described", p: ["NAPLAN results are reported in four proficiency levels for each area: Exceeding, Strong, Developing and Needs additional support. Strong means a student is meeting a challenging but reasonable expectation for their year. The results are a snapshot of how a student went on one day, so they are best used alongside what the teacher sees through the year."] },
      { h: "Practising at home", ul: [
        "Read a short text together a few times a week, then ask the four kinds of question: find it, word meaning, read between the lines and sum it up.",
        "Always ask \"how do you know?\" so your child points to the words that prove an answer.",
        "Let your child read some texts on a screen, so the format feels familiar.",
        "Try the practice material and demonstration site on the National Assessment Program website, which uses the same online platform as the test.",
        "Keep it short and calm. Ten to fifteen minutes is plenty."] },
      { h: "On the day", p: ["Good sleep and a normal breakfast matter more than last-minute cramming. Remind your child to read every question in full, to look back at the text for the answer instead of guessing from memory, and to cross out answers that are clearly wrong before choosing."] },
    ],
    faq: [
      ["Does my child need to study for NAPLAN reading?", "Not in a heavy way. Regular reading, talking about books and short comprehension practice are enough for most children, and the test is not a pass or fail."],
      ["Why did my child get different questions from their friend?", "The online test is tailored, so the questions a student sees depend on how they answer the opening ones."],
    ],
    related: rel("naplanWriting", "comprehension", "inference", "worksheets", "reading"),
  },
  {
    slug: "help-your-child-with-inference-questions",
    title: "How to help your child with inference questions (reading between the lines)",
    description: "What an inference is, why children get stuck on these questions, and a simple clue-plus-what-I-know routine you can use with any text at home.",
    lead: "An inference is something the text suggests but does not say. Many children can find a fact that is written down and still lose marks on questions that ask why, how someone feels or what a writer suggests. The skill can be taught, and it starts with noticing clues.",
    sections: [
      { h: "What an inference is", p: ["Read this sentence: \"Sam checked the window again and chewed his fingernail.\" The text never says Sam is nervous or waiting for someone, but a reader works it out from the clues. An inference is a clue from the text plus something you already know."] },
      { h: "Teach the three-part routine", ul: [
        "The text says: Sam checked the window again and chewed his fingernail.",
        "I know that: people look out of windows and bite their nails when they are waiting or worried.",
        "So I think: Sam is anxious about someone arriving."],
        extra: "Saying the three parts out loud makes the thinking visible, and it is exactly the habit that earns marks on written answers." },
      { h: "Spot an inference question", p: ["Look for question words such as why do you think, how does the character feel, what does this suggest, what can you tell about, or what is the writer implying. If the answer could not be underlined in the text, it is probably an inference."] },
      { h: "Practise with everyday things", p: ["You do not need a book. Describe a scene and ask what is going on: \"A wet umbrella is dripping by the door and the kettle is on.\" Or look at a photo and ask what happened just before it. Children enjoy this like a detective game."] },
      { h: "Always point to the clue", p: ["Ask \"which words made you think that?\" An inference without a clue is only a guess. A strong answer names the feeling or idea and quotes or points to the words that suggest it."] },
      { h: "Common slips", ul: [
        "Answering from their own life instead of the text: \"I'd be scared\" is not about the character.",
        "Staying too vague: \"he was sad\" scores less than \"he was lonely, because he ate alone and did not look up\".",
        "Retelling what happens instead of saying what it suggests."] },
    ],
    faq: [
      ["What if there is more than one possible answer?", "Several answers can be sensible. Choose the one with the strongest clue in the text, and be ready to say what the clue is."],
      ["Can inference be practised before a child reads fluently?", "Yes. Pictures and stories read aloud work well, because the thinking is the same."],
    ],
    related: rel("comprehension", "tfng", "naplanReading", "worksheets", "reading"),
  },
  {
    slug: "persuasive-devices-aforest-explained",
    title: "Persuasive devices (AFOREST) explained, with examples",
    description: "What the AFOREST memory aid stands for, an example of each persuasive device, and how to help a child use a few of them well instead of all of them badly.",
    lead: "AFOREST is a memory aid many schools use for persuasive writing. Each letter is a device that can make an argument more convincing. Children often learn the list quickly and then use every device at once, so the real skill is choosing a few and using them well.",
    sections: [
      { h: "What the letters stand for", p: ["Here is each device with an invented example for the topic \"Should children walk to school?\""], ul: [
        "Alliteration: words that start with the same sound. \"Safe, sensible strolls to school.\"",
        "Facts: things that can be checked. \"Walking is free, and cars add to traffic outside the gates.\"",
        "Opinion: what the writer believes, stated with confidence. \"I strongly believe walking is the best start to the day.\"",
        "Rhetorical question: a question asked for effect, not an answer. \"Who would not want a calmer, quieter morning?\"",
        "Emotive language: words that make the reader feel something. \"Children deserve to arrive happy, not rushed and anxious.\"",
        "Statistics: numbers that back a point. In a child's piece, only use a number they really know. Otherwise say \"many\" or \"most\".",
        "Triple: three words or ideas together. \"Healthy, cheap and fun.\""] },
      { h: "Choose three or four", p: ["A paragraph with every device in it sounds forced. Ask your child to pick the three or four that suit their argument and place them where they matter most: a rhetorical question to open, a fact to prove a reason, a triple near the end."] },
      { h: "Devices need reasons", p: ["Devices decorate an argument but do not replace one. Check that the piece still has a clear position and reasons with explanations. A strong persuasive piece with a few devices beats a weak one with many."] },
      { h: "Keep facts honest", p: ["Children sometimes invent figures to sound convincing. Teach them that a made-up number is not a fact. If they do not know a figure, they can say \"many children\" or give an example they know to be true."] },
      { h: "Practise at home", p: ["Pick a small argument, such as a later bedtime or a class pet, and ask for three sentences, each using a different device. Then read them aloud and ask which one sounded most convincing and why."] },
      { h: "Where it shows up in LiteracyLab AI", p: ["For persuasive pieces from the upper primary years, the feedback includes an AFOREST check: which devices the writer used, quoting the exact words from their own piece, and one device they could try next."] },
    ],
    faq: [
      ["Does every persuasive piece need all seven?", "No. Using a few well-chosen devices is better than using all of them."],
      ["Is AFOREST used everywhere?", "It is a teaching aid, not a rule of any exam. Schools use different memory aids, so ask your child's teacher which they use."],
    ],
    related: rel("peel", "feedback", "prompts", "how"),
  },
  {
    slug: "race-and-cer-short-answers-explained",
    title: "RACE and CER: how to write a good short answer",
    description: "How the RACE and CER structures help a child write a clear short written answer to a reading question, with a worked example and common mistakes.",
    lead: "Short-answer questions ask a child to answer a question about a text in a few sentences. Two simple structures, RACE and CER, give them a pattern to follow so the answer is complete and supported by the text.",
    sections: [
      { h: "RACE", p: ["Restate, Answer, Cite, Explain."], ul: [
        "Restate: turn the question into the start of your answer.",
        "Answer: give your answer clearly.",
        "Cite: back it up with evidence from the text, using a quote or close detail.",
        "Explain: say how the evidence proves your answer."] },
      { h: "A worked example", p: ["Question: Why did Mia hide the letter?"], ul: [
        "Restate: Mia hid the letter because",
        "Answer: she did not want her brother to read it.",
        "Cite: The text says she \"slid it under her pillow the moment she heard footsteps\".",
        "Explain: This shows she was worried about being caught, so she wanted to keep it secret."] },
      { h: "CER", p: ["Claim, Evidence, Reasoning. It is the same idea in three steps and is often used in older years and in science."], ul: [
        "Claim: your answer in one sentence.",
        "Evidence: the fact, quote or detail that supports it.",
        "Reasoning: the link that explains why the evidence supports the claim."] },
      { h: "Which one to use", p: ["Use whichever your child's school uses. RACE suits younger students because the first step, restating the question, gets them started. CER suits older students who are ready to think more about the reasoning step."] },
      { h: "Common mistakes", ul: [
        "Skipping Explain or Reasoning. A quote on its own is not an answer.",
        "Quotes that are too long. Choose the few words that prove the point.",
        "Evidence that does not match the claim. Ask: does this really show what I said?"] },
      { h: "Where it shows up in LiteracyLab AI", p: ["On Premium, the reading practice includes one short written answer marked out of two or three with the reason. The structure it teaches is RACE for primary and middle years and CER for high school, and you can see which parts the student used."] },
    ],
    faq: [
      ["How long should a short answer be?", "Two to four sentences is usual. It is long enough to cover each step and short enough to finish in the time."],
      ["Do I mark it myself?", "Yes, at home you can check each step in turn: did they restate, answer, cite and explain?"],
    ],
    related: rel("comprehension", "inference", "peel", "reading"),
  },
  {
    slug: "build-vocabulary-at-home",
    title: "How to build vocabulary at home: word parts and the Frayer card",
    description: "Practical ways to grow a child's vocabulary at home: word parts, context clues, the Frayer card for new words, and short regular review.",
    lead: "Children learn most new words by meeting them often, in context, and by using them. A few simple habits at home speed this up: looking at word parts, making a small card for each new word, and coming back to it after a few days.",
    sections: [
      { h: "Learn a few words at a time", p: ["Three or four words a week is plenty. Choose words from what your child is reading or writing so they matter to them, and keep a small list on the fridge or in a notebook."] },
      { h: "Look at word parts", p: ["Many long words are built from small parts. Knowing a few of them lets a child guess new words."], ul: [
        "Prefixes at the start: un- means not (unhappy), re- means again (rebuild), pre- means before (preview).",
        "Suffixes at the end: -ful means full of (hopeful), -less means without (careless), -er often means a person who (teacher).",
        "Roots in the middle: port means carry (transport, portable), bio means life (biology)."] },
      { h: "Use context clues", p: ["When your child meets an unknown word, cover it and ask what word would fit in its place. The sentences around it often give the meaning: \"The ground was parched and cracked, and not a drop of rain had fallen for weeks.\" Parched must mean very dry."] },
      { h: "Make a Frayer card", p: ["A Frayer card is a small four-box card for one word. It makes a child think about the word from several sides."], ul: [
        "Definition: what it means, in their own words.",
        "Characteristics: facts or features about the word.",
        "Examples: things that fit the word.",
        "Non-examples: things that do not fit, which is where much of the understanding is built."] },
      { h: "Use it, then come back to it", p: ["A new word sticks when it is used. Ask your child to say or write a sentence with it, then spot it again over the next few days. A few minutes of flashcard review, a day later and then a few days later, works better than one long session."] },
      { h: "Where it shows up in LiteracyLab AI", p: ["Every piece of feedback gives new words. On Core and Premium they collect in a vocabulary bank with flashcards and a short self-test quiz, and the progress follows the learner between devices. For the primary years, each word also comes with Frayer details."] },
    ],
    faq: [
      ["How many new words should my child learn each week?", "Three or four, used properly, is more useful than a long list that is forgotten."],
      ["Does reading more help?", "Yes, because children meet words in context. Talking about the words and using them in their own sentences makes it stronger."],
    ],
    related: rel("comprehension", "feedback", "worksheets", "how"),
  },
  {
    slug: "true-false-not-given-questions-explained",
    title: "True, False, Not Given questions explained",
    description: "What True, False and Not Given reading questions ask, how to tell False from Not Given, and a simple routine children can use to answer them.",
    lead: "In these questions a child reads a passage and then decides whether each statement is true, false or not given. Children usually find True and False straightforward. The tricky one is Not Given, which means the passage does not say.",
    sections: [
      { h: "What each answer means", ul: [
        "True: the passage says this, in the same meaning, perhaps in different words.",
        "False: the passage says the opposite.",
        "Not Given: the passage does not say either way."] },
      { h: "A worked example", p: ["Passage: \"Ella's bakery opens at seven in the morning and sells bread and cakes.\""], ul: [
        "\"The bakery sells bread.\" True, because the passage says so.",
        "\"The bakery opens at nine.\" False, because the passage says seven.",
        "\"The bakery sells cheese.\" Not Given, because the passage does not mention cheese."] },
      { h: "A routine for every statement", ul: [
        "Find the part of the passage the statement is about.",
        "Ask: does the passage say this, say the opposite, or say nothing about it?",
        "Choose True, False or Not Given from your answer, and be ready to point to the words."] },
      { h: "The trap: using what you already know", p: ["Many children answer from their own knowledge. A child might think \"most bakeries sell cheese rolls, so True.\" The question only asks what this passage says. If it is not written, it is Not Given, however likely it seems."] },
      { h: "False versus Not Given", p: ["False needs a line that contradicts the statement. If you cannot point to a contradicting line, the answer is probably Not Given. Ask your child to find the line each time."] },
      { h: "Practise at home", p: ["Read a short paragraph and write three statements together, one of each kind. Swap with your child and let them write the next three for you. Making questions is a good way to understand them."] },
    ],
    faq: [
      ["Where do these questions appear?", "In some school reading tasks and in English-language tests for older students. Check what your child's own tests use."],
      ["Why is Not Given hard?", "Because it asks a child to notice the absence of information, which goes against the habit of filling gaps with what they know."],
    ],
    related: rel("inference", "comprehension", "worksheets", "reading"),
  },
  {
    slug: "how-to-read-a-table-or-graph-question",
    title: "How to read a table or graph question",
    description: "A calm step-by-step method for questions about tables and bar charts: read the title and labels, find the right row or bar, and check the units.",
    lead: "Reading questions are not always about stories. Children are also asked about tables, bar charts and other data. These questions are quite mechanical, which makes them a good way to build confidence if your child follows the same steps each time.",
    sections: [
      { h: "Step one: read the title and labels", p: ["Before looking at any numbers, find what the table or chart is about. Read the title, the column headings or axis labels, and the units, such as centimetres, minutes or number of children."] },
      { h: "Step two: read the question twice", p: ["Underline what is being asked. Is it one value, a comparison, a total, a difference or a trend? Many wrong answers come from answering a slightly different question, such as giving the total when the difference was asked."] },
      { h: "Step three: find the right row or bar", p: ["Use a finger or a ruler to follow the row across or the bar up to the number. Check you are in the right row and the right column before you read the value."] },
      { h: "Step four: do the maths and check it", p: ["If the question asks for a total, difference or comparison, write the calculation. Then ask whether the answer makes sense next to the data. If one bar is much taller than another, the biggest value should match it."] },
      { h: "Watch for common traps", ul: [
        "Reading the wrong row or column.",
        "Ignoring the units, for example reading minutes as hours.",
        "Scales that do not start at zero or count in twos or fives.",
        "Answering with the label instead of the value, or the other way round."] },
      { h: "Practise with real things", p: ["Sports tables, weather charts, bus timetables and recipe quantities are all data. Ask a question about one each day, such as which day had the most rain, and have your child explain how they found it."] },
      { h: "Where it shows up in LiteracyLab AI", p: ["Reading practice includes passages that are a data table or a bar chart, so students answer questions about data as well as stories and articles."] },
    ],
    faq: [
      ["Why do children find graph questions hard?", "Often because they rush to the numbers and skip the title, labels and units, which is where the meaning is."],
      ["What if my child is not confident with maths?", "These questions mostly need careful reading and simple arithmetic. Practising the steps builds confidence."],
    ],
    related: rel("comprehension", "inference", "worksheets", "reading"),
  },
  {
    slug: "comparing-two-texts-how-to-help-a-child",
    title: "Comparing two texts: how to help a child",
    description: "How to help a child read two texts on the same topic and compare them: what to look for, useful sentence starters, and common mistakes.",
    lead: "Some reading tasks give two short texts on the same topic, often called Text A and Text B, and ask how they are similar or different. These questions test whether a child can hold two ideas in mind at once, which takes practice.",
    sections: [
      { h: "Read each text on its own first", p: ["Ask your child to read Text A and say in one sentence what it is about, then do the same for Text B. Do not compare until each is clear."] },
      { h: "Then look at the same four things in each", ul: [
        "Purpose: is it trying to inform, persuade, entertain or describe?",
        "Audience: who is it written for?",
        "Viewpoint: what does the writer think or feel about the topic?",
        "Features: facts or opinions, a personal voice or a neutral one, a story or a list."] },
      { h: "Use a simple two-column note", p: ["Draw two columns, one for each text, with the four things above down the side. Fill in a few words for each. The gaps and matches are the similarities and differences."] },
      { h: "Sentence starters that help", ul: [
        "Both texts say that...",
        "Text A focuses on... whereas Text B focuses on...",
        "The writers agree that... but they differ on...",
        "Text A uses facts to... while Text B uses personal experience to..."] },
      { h: "Support every point with evidence", p: ["As with any reading answer, ask \"how do you know?\" A good comparison names something in each text, in the writer's words or a close detail."] },
      { h: "Common mistakes", ul: [
        "Summarising one text and forgetting the other.",
        "Saying they are \"different\" without saying how.",
        "Comparing small details when the main purposes or viewpoints are the real difference."] },
      { h: "Where it shows up in LiteracyLab AI", p: ["Reading practice includes passages made of two texts, marked Text A and Text B, with questions about how they connect."] },
    ],
    faq: [
      ["How much should my child write?", "Two or three clear sentences naming one similarity or difference and the evidence in each text are usually enough."],
      ["Do the texts always disagree?", "No. Sometimes they agree on a fact but differ in tone or audience."],
    ],
    related: rel("comprehension", "inference", "tables", "worksheets"),
  },
  {
    slug: "helping-a-child-read-poetry",
    title: "Helping a child read poetry without the fear",
    description: "A calm way to read a poem with a child: read it aloud twice, notice what it is about, spot a few devices and talk about their effect.",
    lead: "Poetry makes many children, and many parents, nervous because it seems to have a hidden answer. It does not. A poem is read like any text: closely, with attention to the words, and with the confidence to say what you think and why.",
    sections: [
      { h: "Read it aloud twice", p: ["Read the poem out loud once for the sound and again for the meaning. Poems are written to be heard, and reading aloud shows rhythm, rhyme and where the lines pause."] },
      { h: "Ask what it is about first", p: ["Before looking for devices, ask your child to say in a sentence what is happening or what is being described. Then ask how the poem makes them feel."] },
      { h: "Notice a few devices", ul: [
        "Simile: compares two things using like or as. \"Her voice was like a bell.\"",
        "Metaphor: says one thing is another. \"The classroom was a zoo.\"",
        "Personification: gives human qualities to something that is not human. \"The wind whispered.\"",
        "Rhyme and rhythm: the sound pattern at the end of lines and the beat inside them.",
        "Line breaks: where the poet chooses to stop a line, which can slow or surprise the reader."] },
      { h: "Always ask about the effect", p: ["Spotting a simile earns little on its own. The better question is what it does: what picture does it give, and how does it change how we feel about the subject? Practise the sentence \"The poet uses ... to show...\""] },
      { h: "Accept more than one idea", p: ["Poems can mean more than one thing. A reading is sound if the words of the poem support it, so ask \"which words make you say that?\" instead of hunting for a single correct meaning."] },
      { h: "Try writing a tiny poem", p: ["Four lines about something at home, using one simile, is enough. Writing even a short poem shows a child how a poet chooses words, and it makes reading poems less strange."] },
    ],
    faq: [
      ["My child says poems are boring. What can I do?", "Try funny poems, song lyrics and short poems about things they care about, and read them aloud with some drama."],
      ["Does a poem have to rhyme?", "No. Many poems do not rhyme. They rely on images, rhythm and line breaks instead."],
    ],
    related: rel("comprehension", "inference", "worksheets", "prompts"),
  },
];

module.exports = { MORE };
