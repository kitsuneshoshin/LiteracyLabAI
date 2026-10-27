// Two articles written from what parents actually search for (Search Console, October 2026). The same rules as
// articles-content.js apply (tests enforce the mechanical ones): no statistics, guarantees, rankings or
// endorsements; exam details only as published, with a reminder to confirm with the school or provider;
// every example is invented by us.

const LINKS = {
  guides: ["/learn/", "All year-by-year guides"],
  prompts: ["/learn/prompts/", "Free writing prompt generator"],
  worksheets: ["/learn/worksheets/", "Free printable reading worksheets for children"],
  how: ["/learn/how-it-works/", "How LiteracyLab AI works"],
  comprehension: ["/learn/articles/help-with-reading-comprehension-at-home/", "Helping with reading comprehension at home"],
  naplanWriting: ["/learn/articles/naplan-writing-explained/", "NAPLAN writing explained"],
  naplanReading: ["/learn/articles/naplan-reading-explained/", "NAPLAN reading explained"],
  naplanResults: ["/learn/articles/how-to-read-naplan-results/", "How to read NAPLAN results"],
  au: ["/learn/australia/", "Australian guides by year"],
  us: ["/learn/us/", "US guides by grade"],
  vocab: ["/learn/articles/build-vocabulary-at-home/", "How to build vocabulary at home"],
  spelling: ["/learn/articles/help-a-child-who-makes-lots-of-spelling-mistakes/", "Helping a child who makes lots of spelling mistakes"],
  length: ["/learn/articles/how-much-should-my-child-write/", "How much should my child write?"],
  kindergarten: ["/learn/articles/kindergarten-language-arts-at-home/", "Kindergarten language arts at home"],
};
const rel = (...keys) => keys.map((k) => LINKS[k]);

const SEARCH = [
  {
    slug: "how-to-read-naplan-results",
    title: "How to read NAPLAN results: a parent's guide to the student report",
    description: "How to read your child's NAPLAN student report: the four proficiency levels, what each means, what to look at first, and what to do with the results.",
    lead: "A NAPLAN student report can look dense the first time you see it. The good news is that it answers a small number of questions: where did my child land in each area, and what does that mean? This guide explains how to read it in plain terms. Reports change in layout from year to year, so use it alongside the explanation that comes with your child's own report, and ask the school if anything is unclear.",
    sections: [
      { h: "How to read NAPLAN results in one minute", ul: [
        "Find each area tested: reading, writing, spelling, grammar and punctuation, and numeracy.",
        "Look at the proficiency level for each one: Exceeding, Strong, Developing or Needs additional support.",
        "Remember that Strong means your child is meeting a challenging but reasonable expectation for their year.",
        "Treat the result as one snapshot from one test on one day, not a judgement of your child.",
        "Talk to the teacher about what they see in class, because that fills in the picture."] },
      { h: "The four proficiency levels", p: ["Since 2023, NAPLAN has reported each area in four levels. There is no pass mark. Each level describes how a student is doing against what is expected for their year level."], ul: [
        "Exceeding: working above the expected level for their year.",
        "Strong: meeting a challenging but reasonable expectation for their year.",
        "Developing: working towards the expected level and likely to benefit from some support to get there.",
        "Needs additional support: not yet meeting the expected level and likely to benefit from extra help."] },
      { h: "What the report shows", p: ["The individual student report shows the level your child reached in each area. It may also show where within that level they sit. The report is written for families, and it comes with a short guide to reading it. If yours includes a graph, the bands on it are the four levels."] },
      { h: "What results can and cannot tell you", ul: [
        "They can show a broad area, such as reading or writing, where your child is comfortable or where extra practice would help.",
        "They cannot show everything your child can do. A short test on one day misses effort, creativity and progress through the year.",
        "A tired or anxious day can lower a result, and a lucky day can raise one, so a single result is best read alongside classwork and teacher comments.",
        "Year-to-year change is more useful than a single result, so keep each report to look back on."] },
      { h: "What to do if the result is lower than you hoped", p: ["Stay calm and keep it private from your child if they are likely to be upset. Ask the teacher whether the result matches what they see in class, and which one or two skills would make the biggest difference. Then pick small, regular habits: ten minutes of reading together, a short piece of writing a week, and a vocabulary notebook. Short and regular beats long and rare."] },
      { h: "What to do if the result is high", p: ["A high result is something to celebrate, and it does not mean there is nothing left to learn. Keep reading widely, and try writing in different forms, such as arguments, descriptions and stories, so the skills keep growing instead of settling."] },
      { h: "Questions to take to the teacher", ul: [
        "Does this result match what you see in class?",
        "Which skill would help most at the moment: reading carefully, planning writing, spelling or something else?",
        "Is there anything the school is already doing, and what can we do at home to match it?"] },
      { h: "A note on feedback tools", p: ["A practice tool can show a child how their own writing or reading went and where to focus next, which is useful between tests. LiteracyLab AI gives feedback on a child's writing and reading practice, but it does not predict a NAPLAN result and is not a replacement for the school's reports or a teacher who knows your child."] },
    ],
    faq: [
      ["What do the NAPLAN levels mean?", "There are four: Exceeding, Strong, Developing and Needs additional support. Strong means your child is meeting a challenging but reasonable expectation for their year."],
      ["Is there a pass mark on NAPLAN?", "No. Each area is described in one of four proficiency levels, and a Developing result is information about where to focus, not a failure."],
      ["When do families get the NAPLAN report?", "Schools share the individual student report with families after results are released. Ask your school when to expect it if you have not seen it."],
      ["Should I worry about a Developing result?", "Not by itself. It is a snapshot. Ask the teacher whether it matches what they see in class, then plan a few small, regular habits to practise at home."],
    ],
    related: rel("naplanReading", "naplanWriting", "comprehension", "worksheets", "au"),
  },
  {
    slug: "kindergarten-language-arts-at-home",
    title: "Kindergarten language arts: what it covers and how to help at home",
    description: "What kindergarten language arts (ELA) usually covers: letters and sounds, reading, early writing, talking and listening, with simple, playful ways to help at home.",
    lead: "Kindergarten language arts, often shortened to ELA, is the part of the school day where children learn to read, write, speak and listen. It is mostly play, songs, stories and drawing, and not worksheets. This guide explains what it usually covers and how to help at home. Schools and states vary, so check what your child's school expects.",
    sections: [
      { h: "Kindergarten language arts at a glance", ul: [
        "Reading: learning letters and their sounds, hearing the sounds in words, and reading simple words and sentences.",
        "Writing: drawing and writing about something they know, then building up to a short sentence.",
        "Speaking and listening: taking turns, listening to a story and retelling it.",
        "Language: learning new words, and starting to use capital letters and full stops.",
        "How it feels: short, playful and full of stories. Many children do not read independently at first, and that is common."] },
      { h: "Letters and sounds", p: ["Most kindergarten programs teach the letters of the alphabet and the sound each one makes, usually a few at a time. Children also learn to hear the separate sounds in a word: that \"cat\" has three sounds, c, a and t. This is the base for reading and spelling."], ul: [
        "Sing alphabet songs and point to letters on signs, cereal boxes and book covers.",
        "Play \"I spy\" with sounds: \"I spy something that starts with mmm.\"",
        "Clap the beats in names and words, then say the first sound of each one.",
        "Make letters with playdough, chalk or a finger in sand, which links the shape to the sound."] },
      { h: "Reading together", p: ["Reading aloud to your child every day is one of the most useful habits. Children who are read to hear new words, learn how stories work and associate books with comfort."], ul: [
        "Let your child choose some books, and read favourites again and again.",
        "Point to the words as you read, so they see that print goes left to right.",
        "Pause before a rhyming word and let your child fill it in.",
        "Ask simple questions: \"What happened first?\" and \"What do you think will happen next?\"",
        "When they start reading, take turns: they read a page or a line, and you read the next."] },
      { h: "Early writing", p: ["Writing starts as drawing and marks, and then letters and words. Many kindergarten programs ask children to draw a picture and tell or write something about it. Spelling is expected to be \"sounded out\", so a child who writes \"I lik my dog\" is doing exactly what is hoped."], ul: [
        "Write their name and a few favourite words together.",
        "Ask your child to draw a picture and tell you about it, then write down what they say, or help them write one word.",
        "Praise the sounds they got right instead of correcting every spelling.",
        "Make writing useful: a shopping list, a card for a grandparent or a label for a toy box."] },
      { h: "Talking and listening", p: ["Conversation builds vocabulary and confidence. Ask open questions, give your child time to answer and add a new word to what they say: if they say \"big dog\", you might say \"yes, a huge, fluffy dog\". Retelling a story or a day in order, with a beginning, middle and end, is early practice for writing a narrative."] },
      { h: "How to keep it calm", ul: [
        "Keep sessions short, five to ten minutes, and stop while your child is still enjoying it.",
        "Follow their interests: dinosaurs, trucks and princesses all make good reading and writing.",
        "Do not compare with other children. Children learn to read at different speeds in these early years.",
        "If you are worried about your child's progress or speech, talk to the teacher or your child's doctor."] },
      { h: "A note on feedback tools", p: ["Kindergarten children learn best through play and talk with a trusted adult, so screens are not the place to start. As children move into the early grades and begin writing sentences and short pieces, LiteracyLab AI can give calm, specific feedback on what they have written. It is not a replacement for a teacher who knows your child."] },
    ],
    faq: [
      ["What is kindergarten language arts?", "It is the part of kindergarten that teaches reading, writing, speaking and listening, including letters and sounds, sharing stories and early writing."],
      ["What does ELA mean in kindergarten?", "ELA stands for English language arts. In kindergarten it covers the same things as language arts: reading, writing, speaking and listening."],
      ["Should my kindergartener be able to read?", "Children develop at different speeds, and many are just beginning to read simple words at this age. Ask the teacher what your school expects and how your child is doing."],
      ["How can I help my kindergartener with writing?", "Let them draw and tell you about their picture, praise the sounds they have written, and make writing useful with lists and cards. Do not worry about perfect spelling at this age."],
    ],
    related: rel("us", "comprehension", "vocab", "worksheets", "prompts"),
  },
];

module.exports = { SEARCH, LINKS };
