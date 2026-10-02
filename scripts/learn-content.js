// The words on the /learn/ guide pages. Every page is built from the same real
// curriculum data the app uses (api/_lib/masteryTargets.js: each year's focus
// areas and their cited standard) plus the plain-English explanations below.
//
// House rules for everything written here:
//   - Explain a skill in everyday words; never claim what an exam board or a
//     particular school "requires" beyond the standard's own label.
//   - No promises about marks, grades or results, no invented statistics, and no
//     "best", "#1", "guaranteed" or "official" claims (a test enforces this).
//   - Nothing about a real child: examples are made up.

// ----------------------------------------------------------------------------
// Plain-English guide to each focus area. Keyed by the exact target name used in
// masteryTargets.js (a test fails if a name is missing here).
//   what: what the skill means.   home: one thing a parent can try this week.
// ----------------------------------------------------------------------------
const TARGET_GUIDE = {
  // ---- Reading skills (all regions)
  "Comprehension Strategies": { what: "The habits good readers use to understand a text: predicting what comes next, re-reading when something does not make sense, and picturing what is happening.", home: "Pause halfway through a book and ask, 'What do you think happens next, and what in the story makes you think so?'" },
  "Making Inferences From the Text": { what: "Working out something the writer has not said outright, by combining clues in the text with what we already know.", home: "Read a short passage together and ask, 'How is the character feeling, and which words told you?'" },
  "Answering & Asking Questions About a Text": { what: "Finding the answer to a question in a text, and learning to ask good questions about it.", home: "After a chapter, take turns: each of you asks one question the other must answer by pointing to the page." },
  "Drawing Inferences With Evidence": { what: "Going beyond what is stated and backing the idea up with a specific detail from the text.", home: "Ask 'What makes you say that?' every time your child gives an opinion about a story." },
  "Summarising Main Ideas": { what: "Saying what a text is mainly about in a few sentences, leaving out the small details.", home: "After reading, ask for a three-sentence summary: how it began, the main event, and how it ended." },
  "Summarising & Organising Ideas": { what: "Pulling the key points out of a longer text and arranging them in a clear order.", home: "Read a short article and have your child list its three most important points in their own words." },
  "Inference & Textual Evidence": { what: "Reaching a conclusion about a text and supporting it with short, well-chosen quotations.", home: "Pick a view about a character and find two short quotes that support it." },
  "Interpreting & Evaluating Ideas": { what: "Explaining what a writer means and judging how convincing or effective it is.", home: "After an article, ask 'Did the writer convince you? Which part worked best?'" },
  "Analysing & Summarising Information": { what: "Looking closely at information in a text, picking out what matters and putting it briefly in your own words.", home: "Choose a news story for young readers and write a two-sentence summary together." },
  "Interpreting Complex & Abstract Ideas": { what: "Making sense of ideas that are not concrete, such as themes like fairness or ambition, and explaining how a text develops them.", home: "Ask 'What is this story really about underneath?' and look for the moments that show it." },
  "Comparing & Contrasting Ideas": { what: "Noticing how two texts, characters or ideas are alike and how they differ.", home: "After two books or two articles on one topic, draw a simple table of 'same' and 'different'." },
  "Comparing Writers' Perspectives": { what: "Seeing how two writers treat the same subject differently and why.", home: "Read two short pieces on the same topic and ask which writer feels more convinced, and what words show it." },
  "Analysing Language for Effect": { what: "Looking at a writer's word choices, images and sentence patterns and explaining the effect they have on the reader.", home: "Choose one striking sentence and ask 'Why did the writer pick that word instead of a plainer one?'" },
  "Reading for Meaning": { what: "Reading carefully enough to follow what a text says and why, not just to say the words aloud.", home: "Ask your child to explain a paragraph back to you without looking at it." },
  "Understanding Implicit Meaning": { what: "Picking up on meaning that is suggested rather than stated, including attitude, tone and what is left unsaid.", home: "Read a short dialogue and ask what a character really means beneath what they say." },
  "Understanding Writers' Attitudes & Viewpoints": { what: "Recognising what a writer thinks about a subject and the signals that show it.", home: "Underline words in an opinion piece that show the writer's feelings." },
  "Understanding Long & Complex Texts": { what: "Following a long or dense text, tracking how its ideas connect from start to finish.", home: "Read a long article in sections and write one line after each section about what it added." },
  "Reading Abstract & Structurally Complex Texts With Ease": { what: "Reading demanding, layered texts fluently and noticing how their structure creates meaning.", home: "Try a classic essay or an editorial and discuss how the argument is built, paragraph by paragraph." },
  "Understanding Familiar Words & Simple Sentences": { what: "Recognising common words and following short, simple sentences in everyday situations.", home: "Read labels, signs and short messages together and say what each one means." },
  "Finding Specific Information in Everyday Texts": { what: "Scanning a timetable, advert or notice for the one piece of information you need.", home: "Give a simple leaflet or timetable and ask a question such as 'What time does it start?'" },
  "Understanding Short Personal Letters": { what: "Understanding the main message and details in a short, friendly letter or message.", home: "Read a short note together and ask who wrote it, what they want and what happens next." },
  "Understanding High-Frequency Everyday Language": { what: "Understanding the common words and phrases people use about family, work, school and daily life.", home: "Listen to or read a short everyday dialogue and note the three most useful new phrases." },
  "Answering Questions About Key Details": { what: "Locating and stating the important details of a text: who, what, where and when.", home: "Read a short story and ask 'Who was in it, and where did it happen?'" },
  "Answering Who/What/Where/When/Why/How Questions": { what: "Answering the six question words about a story or fact text, using the text to find the answers.", home: "Ask one of each question word after a bedtime story and have your child find the answer in the book." },
  "Referring Explicitly to the Text": { what: "Pointing to the exact words or lines in a text that support an answer.", home: "When your child answers a question, ask 'Can you show me the line?'" },
  "Quoting Accurately When Explaining the Text": { what: "Copying short pieces from a text exactly and using them to explain what the text says.", home: "Ask for one short, exact quote that proves an answer, written inside quotation marks." },
  "Inference From the Text": { what: "Drawing conclusions that the text supports without stating them directly.", home: "Cover the last paragraph of a story and ask what probably happened, and which earlier clue suggests it." },
  "Citing Textual Evidence": { what: "Supporting a point with a specific piece of the text rather than a general feeling.", home: "Make a habit of 'I think ... because the text says ...' in conversations about reading." },
  "Citing Several Pieces of Textual Evidence": { what: "Using more than one detail from a text to support a single idea, so the case is stronger.", home: "Ask for two separate details from different parts of a text that prove the same point." },
  "Citing the Strongest Textual Evidence": { what: "Choosing the best quotation from several possible ones and explaining why it is the strongest.", home: "Find three possible quotes for one idea and decide together which is most convincing." },
  "Citing Strong & Thorough Textual Evidence": { what: "Backing up an analysis with well-chosen, sufficient evidence from across the whole text.", home: "After reading, build a short list of evidence for one claim and check nothing important was missed." },
  "Citing Evidence Where the Text Is Ambiguous": { what: "Handling passages that can be read more than one way, and using evidence to support an interpretation while noting the doubt.", home: "Find a line open to two meanings and write a sentence defending each one with evidence." },

  // ---- Writing skills: sentences and grammar
  "Punctuation & Capital Letters": { what: "Starting sentences with a capital letter, ending them with a full stop, question mark or exclamation mark, and using capitals for names.", home: "Write a short note together and check every sentence begins and ends correctly." },
  "Simple Sentences": { what: "Writing a complete thought with a subject and a verb, such as 'The dog ran.'", home: "Look at a picture and take turns saying one complete sentence about it, then write it down." },
  "Joining Clauses With 'and'": { what: "Linking two short ideas into one sentence with 'and', such as 'I got my coat and I went out.'", home: "Turn two short sentences from a diary into one joined sentence." },
  "Compound Sentences": { what: "Joining two complete ideas with a word like 'and', 'but' or 'so'.", home: "Give your child two short sentences and ask them to join them with 'but' or 'so'." },
  "Compound Sentences & Irregular Plurals": { what: "Writing sentences with two linked ideas, and spelling plurals that do not just add an s, like 'mice' and 'children'.", home: "Make a list of plurals that break the rule and use each one in a sentence." },
  "Subordination & Co-ordination": { what: "Joining ideas in two ways: equal ideas with 'and', 'but' or 'or', and an extra idea attached with words like 'because', 'when' or 'if'.", home: "Say one fact, then ask for the same fact with a 'because' added." },
  "Time, Place & Cause Conjunctions": { what: "Linking ideas with words that show when, where or why, such as 'before', 'while', 'because' and 'so'.", home: "Describe the school day using 'before', 'after' and 'because' in each sentence." },
  "Fronted Adverbials": { what: "Opening a sentence with a word or phrase that tells how, when or where, followed by a comma: 'Later that night, the storm arrived.'", home: "Pick five plain sentences and add a different opening phrase and comma to each." },
  "Modal Verbs & Relative Clauses": { what: "Using words like 'might', 'could' and 'must' to show how certain something is, and adding extra detail with clauses starting 'who', 'which' or 'that'.", home: "Describe a pet using 'might' and 'could', then add a 'who' or 'which' detail." },
  "Passive Voice & Formal Register": { what: "Writing in a more formal style, including the passive ('The window was broken') and avoiding chatty language.", home: "Rewrite a casual message to a friend as a polite note to a head teacher." },
  "Frequently Occurring Conjunctions": { what: "Using the common joining words such as 'and', 'but', 'or', 'so' and 'because' correctly.", home: "Play 'finish my sentence': start a sentence and ask your child to continue it after 'because' or 'but'." },
  "Simple, Compound & Complex Sentences": { what: "Using sentences of different shapes: short single ideas, two linked ideas, and a main idea with an extra attached idea.", home: "Write about your day in three sentences, one of each kind." },
  "Complex Sentences": { what: "Building sentences with a main idea and an extra idea attached by a word like 'although', 'because' or 'when'.", home: "Start with 'Although' and ask your child to finish a sentence about their day." },
  "Complex Sentences for Effect": { what: "Choosing a complex sentence on purpose to build suspense, show contrast or add detail.", home: "Rewrite a flat sentence as a complex one and say which version is more interesting and why." },
  "Complex & Compound-Complex Sentences": { what: "Combining several ideas in one well-organised sentence without losing clarity.", home: "Join three short sentences into one long one, then check it is still easy to read aloud." },
  "Embedded Clauses": { what: "Slotting extra detail into the middle of a sentence between commas, such as 'My brother, who loves football, was late.'", home: "Take a simple sentence about a person and add a detail about them in the middle." },
  "Embedded Clauses That Expand Ideas": { what: "Using clauses inside a sentence to add useful detail or explanation without starting a new sentence.", home: "Expand one plain sentence three times, each time adding detail in the middle." },
  "Clauses & Subject-Verb Agreement": { what: "Understanding the building blocks of a sentence and making verbs match their subjects ('the dog runs', 'the dogs run').", home: "Spot and fix the verb in a few sentences you have read aloud with deliberate mistakes." },
  "Modal Auxiliaries": { what: "Using helper verbs such as 'can', 'may' and 'must' to show ability, possibility and obligation.", home: "Write rules for a game using 'must', 'may' and 'cannot'." },
  "Correlative Conjunctions": { what: "Using paired linking words such as 'either ... or' and 'neither ... nor'.", home: "Ask your child to make choices with 'either ... or' sentences about dinner or weekend plans." },
  "Pronoun Case & Sentence Variety": { what: "Choosing the right form of a pronoun ('he' or 'him', 'I' or 'me') and varying sentence openings and lengths.", home: "Read a paragraph where every sentence starts the same way and rewrite three of them." },
  "Phrase & Clause Function in Sentences": { what: "Seeing what each phrase and clause does in a sentence, and using them to add detail and variety.", home: "Take a sentence and mark the main clause, then add a phrase that tells when or where." },
  "Verbals & Active/Passive Voice": { what: "Using verb forms that act as other word types (like 'swimming' in 'swimming is fun') and choosing active or passive voice on purpose.", home: "Rewrite five active sentences as passive and decide which version reads better." },
  "Parallel Structure & Sentence Variety": { what: "Giving items in a list or a pair of ideas the same grammatical shape, and mixing sentence lengths to keep writing lively.", home: "Check a list like 'she likes swimming, to run and cycling' and fix it so every item matches." },
  "Resolving Usage Issues": { what: "Spotting and fixing common mistakes in word choice and grammar, such as confusing 'its' and 'it's' or 'fewer' and 'less'.", home: "Keep a small list of your child's usual slip-ups and check each piece for them." },
  "Language Conventions": { what: "Using standard grammar, punctuation and spelling correctly and consistently.", home: "Ask for a final proofreading pass, reading the piece out loud to catch errors." },
  "Conventions of Standard English": { what: "Following the usual rules of grammar, capitalisation, punctuation and spelling in formal writing.", home: "After writing, check one thing at a time: first capitals, then punctuation, then spelling." },
  "Technical Accuracy": { what: "Getting the spelling, punctuation and grammar right so that errors do not distract the reader.", home: "Read the piece backwards, one sentence at a time, to spot spelling and punctuation mistakes." },
  "Accurate Spelling, Punctuation & Grammar": { what: "Using correct spelling, punctuation and grammar throughout a piece of writing.", home: "Keep a personal list of words that were spelt wrongly and test them again a week later." },
  "Accurate, Fluent Writing": { what: "Writing that is both correct and easy to read, with sentences that flow naturally.", home: "Read the finished piece aloud and mark any place where you stumble." },
  "Evaluating Sentence Structure": { what: "Judging whether a sentence is clear, varied and effective, and rewriting it when it is not.", home: "Choose a long, clumsy sentence and rewrite it two different ways." },
  "Varying Sentence Structure for Effect": { what: "Mixing short and long sentences, and different openings, to control pace and emphasis.", home: "Write a tense moment using a short sentence at the key point." },

  // ---- Writing skills: planning, structure and texts
  "Creating Short Written Texts": { what: "Writing a few connected sentences for a purpose, such as a short story, label, caption or message.", home: "Ask your child to write a three-sentence note to a family member about something that happened today." },
  "Creating & Editing Short Texts": { what: "Writing short pieces and then improving them by checking the words, punctuation and meaning.", home: "After a short piece is written, ask your child to find one thing to improve and fix it." },
  "Creating & Editing Texts": { what: "Writing a text for a purpose and audience, then rereading and improving it.", home: "Write a short letter, leave it for an hour, then reread it with fresh eyes and fix two things." },
  "Planning & Publishing Texts": { what: "Planning what to write, drafting it, and presenting a neat final copy.", home: "Plan a short piece with three bullet points, write it, then copy a tidy final version." },
  "Planning, Editing & Publishing Texts": { what: "Going through the full writing process: plan, draft, edit and present the final piece.", home: "Use a simple checklist: plan, write, check, tidy. Tick each stage off." },
  "Sequencing Sentences Into Narratives": { what: "Putting sentences in a sensible order so a story has a clear beginning, middle and end.", home: "Cut a short story into sentence strips and ask your child to put them back in order." },
  "Planning & Revising Writing": { what: "Thinking about what to say before writing, and improving the piece afterwards.", home: "Before writing, ask for a quick plan of three things to include. Afterwards, ask what could be better." },
  "Organising Paragraphs Around a Theme": { what: "Grouping related sentences into paragraphs, each with its own main idea.", home: "Ask your child to write about a holiday in two paragraphs: one for the place and one for the activities." },
  "Building Cohesion Across Paragraphs": { what: "Linking paragraphs so a piece flows, using words and phrases that connect one idea to the next.", home: "Check the start of each paragraph and add a linking phrase such as 'Meanwhile' or 'As a result'." },
  "Opinion Pieces": { what: "Stating a view on a topic and giving reasons for it.", home: "Ask 'What is your favourite and why?' and write two reasons." },
  "Opinion Writing With Reasons": { what: "Writing an opinion and supporting it with reasons.", home: "Pick a topic like 'the best pet' and write an opinion with two reasons." },
  "Opinion Writing With Supporting Reasons": { what: "Stating an opinion and backing it up with reasons that really support it.", home: "Ask your child to check that each reason really supports their opinion." },
  "Opinion Writing With Linking Words": { what: "Writing an opinion piece and connecting reasons with words such as 'because', 'also' and 'for example'.", home: "Write an opinion and underline each linking word used." },
  "Opinion Writing & Organization": { what: "Writing an opinion piece with a clear introduction, organised reasons and a conclusion.", home: "Plan an opinion piece with a one-line start, two reasons and a closing sentence." },
  "Opinion Writing With Logically Ordered Reasons": { what: "Writing an opinion piece whose reasons follow a sensible order and are linked clearly.", home: "Number the reasons in order of strength and check the piece follows that order." },
  "Argument Writing": { what: "Making a case with a clear claim, reasons and evidence.", home: "Debate a family question like 'Should bedtime be later?' then write the argument down." },
  "Argument Writing With Relevant Evidence": { what: "Building an argument whose evidence is relevant and directly supports the claim.", home: "Underline each piece of evidence and ask 'Does this really prove my claim?'" },
  "Claims vs. Counterclaims": { what: "Stating a claim and fairly considering a view that opposes it.", home: "Write a claim, then write the best argument against it, and respond to it." },
  "Precise Claims": { what: "Stating an argument clearly and exactly, so the reader knows what is being claimed.", home: "Rewrite a vague claim like 'School is bad' into a precise one with limits." },
  "Precise, Knowledgeable Claims": { what: "Making exact claims backed by real knowledge of the topic.", home: "Before writing, find two facts or examples you can use to support each claim." },
  "Viewpoint & Argument Writing": { what: "Writing that puts forward a point of view and builds a reasoned case for it.", home: "Pick a debate topic and write the opening paragraph that states the view clearly." },
  "Analytical & Persuasive Writing": { what: "Writing that examines a subject closely or tries to convince the reader of a view.", home: "Take a short text and write a paragraph explaining how it tries to persuade." },
  "Rhetorical Awareness": { what: "Understanding how writers use tone, audience and techniques to influence a reader, and doing the same in your own writing.", home: "Read an advert or speech and name two techniques it uses to persuade." },
  "Organising & Selecting Text Structures": { what: "Choosing the best layout for a piece of writing, such as a story, report or argument, and arranging ideas to suit it.", home: "Ask 'How would a report on this be laid out differently from a story?'" },
  "Structuring Texts With Literary Devices": { what: "Using techniques such as imagery, repetition and contrast to shape a piece of writing.", home: "Add one image, one repetition and one contrast to a short description." },
  "Organising & Developing Ideas": { what: "Putting ideas in a clear order and developing each one with detail and explanation.", home: "Choose one idea in a piece and add two sentences of explanation or example." },
  "Developing & Organizing Ideas": { what: "Growing ideas with detail and arranging them in a logical sequence.", home: "Ask 'Can you tell me more?' about each idea, then add the extra detail." },
  "Organizing & Structuring Ideas": { what: "Arranging ideas with a clear beginning, middle and end, and sensible paragraphing.", home: "Make a quick outline before writing and check the piece matches it." },
  "Organising Ideas for Effect": { what: "Ordering and shaping ideas so the writing has the effect the writer wants on the reader.", home: "Reorder the paragraphs of a short piece and decide which order works best." },
  "Writing Short, Simple Messages": { what: "Writing short messages about everyday things in simple sentences.", home: "Write a short text message to a friend inviting them to something." },
  "Writing Short, Simple Notes & Messages": { what: "Writing brief notes and messages about immediate needs and familiar topics.", home: "Write a short note leaving instructions for someone at home." },
  "Filling in Forms With Personal Details": { what: "Writing basic personal information such as name, address and nationality on a form.", home: "Practise with a simple practice form: name, age, country and hobbies." },
  "Writing Simple Connected Text on Familiar Topics": { what: "Writing a few linked sentences on a topic you know, using simple linking words.", home: "Write five sentences about your hobby using 'and', 'but' and 'because'." },
  "Describing Experiences & Giving Reasons for Opinions": { what: "Writing about things that happened and explaining why you feel the way you do.", home: "Write about a recent trip and give two reasons you liked or disliked it." },
  "Writing Clear, Detailed Text on a Range of Subjects": { what: "Writing clearly and in detail about many topics, with ideas linked in a sensible order.", home: "Write about the same topic in two different forms: an email and a short article." },
  "Giving Reasons For & Against a Point of View": { what: "Weighing up arguments on both sides of an issue in a piece of writing.", home: "Make two columns, 'for' and 'against', then write a balanced paragraph from them." },
  "Expressing Points of View at Length": { what: "Presenting and developing a point of view over several well-organised paragraphs.", home: "Write a 200-word piece on a topic you feel strongly about, with a clear start and end." },
  "Writing About Complex Subjects Clearly": { what: "Explaining difficult topics in clear, well-organised writing.", home: "Explain a hard idea from school to a younger relative in writing." },
  "Writing Clear, Smoothly Flowing Text in an Appropriate Style": { what: "Writing that reads smoothly and suits its purpose and reader.", home: "Rewrite the same message for a friend and then for an employer, and note the differences." },
  "Presenting a Case With Effective Logical Structure": { what: "Laying out an argument in a logical order that carries the reader from claim to conclusion.", home: "Plan an argument as a chain: claim, reason, evidence, counter-view, conclusion." },
  "Reading Strand": { what: "The reading side of Cambridge English at this stage: understanding what is read, using clues in the text, and talking about it.", home: "Read together for ten minutes a day and talk about one thing that surprised you." },
  "Writing Strand": { what: "The writing side of Cambridge English at this stage: writing for different purposes with clear sentences and organised ideas.", home: "Ask for a short piece each week on a topic your child chooses, and praise one thing that works." },
  "Comprehension": { what: "Understanding a text well enough to answer questions about it, explain it and make sense of the ideas.", home: "After reading, ask three questions: one fact, one 'why', and one 'what do you think?'" },
};

// ----------------------------------------------------------------------------
// Practice prompts and parent tips by stage of schooling (the app's four tiers).
// ----------------------------------------------------------------------------
const TIER_INFO = {
  early: {
    label: "early years",
    length: "just a few short sentences",
    prompts: [
      "Draw your favourite animal and write two sentences about it.",
      "What did you do at the weekend? Write three things you did.",
      "Write a sentence about something that makes you happy.",
      "Describe your best toy using three describing words.",
      "Write a short message to someone you love.",
      "What is the weather like today? Write two sentences.",
    ],
    tips: [
      "Keep it short and happy: two or three sentences, often, is better than one long session.",
      "Let your child read their writing aloud to you. Ask what they would add.",
      "Praise one specific thing, such as a good capital letter or a lovely describing word.",
    ],
  },
  elementary: {
    label: "primary years",
    length: "one or two short paragraphs",
    prompts: [
      "Write a story about a day when everything went wrong, and how it ended.",
      "Describe your favourite place without using the word 'nice'.",
      "Write a letter to a character from your favourite book.",
      "Should children have a longer lunch break? Give two reasons.",
      "Write the first paragraph of an adventure story that starts with a surprise.",
      "Explain how to make your favourite snack so a friend could follow it.",
    ],
    tips: [
      "Have your child plan in three bullet points first, then write.",
      "Read the piece aloud together and let your child spot what to fix before you do.",
      "Pick one thing to improve each time, such as an interesting opening, rather than correcting everything.",
    ],
  },
  middle: {
    label: "middle years",
    length: "several paragraphs",
    prompts: [
      "Write a short story that begins with a character finding something that should not be there.",
      "Should schools start later in the morning? Give your view and support it.",
      "Describe a place that is special to you so well that a reader could picture it.",
      "Write a speech persuading your school to try one new idea.",
      "Explain how a piece of technology has changed the way people live.",
      "Write a diary entry from a character at the most important moment of a book you have read.",
    ],
    tips: [
      "Ask for a short plan before writing, then compare the finished piece with the plan.",
      "Focus on one skill at a time, such as paragraphing or varied sentence openings, and revisit it across pieces.",
      "Encourage a proofreading pass at the end: spelling, then punctuation, then sense.",
    ],
  },
  high: {
    label: "senior years",
    length: "a structured piece of several well-developed paragraphs",
    prompts: [
      "Social media does more harm than good. Discuss.",
      "Write the opening of a story in which the setting plays a central role.",
      "Analyse how a writer creates tension in a passage you have studied.",
      "Should the voting age be lowered? Argue your case.",
      "Describe a moment of change in a character's life through a vivid scene.",
      "Write a formal letter to a local council proposing a change in your area.",
    ],
    tips: [
      "Use timed practice: plan for five minutes, write, then spend five minutes proofreading.",
      "Check each paragraph makes one clear point and links back to the question.",
      "Ask your teen to say in one sentence what their piece is arguing before they begin.",
    ],
  },
};

module.exports = { TARGET_GUIDE, TIER_INFO };
