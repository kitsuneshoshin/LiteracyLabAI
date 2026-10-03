// Free reading-comprehension sheets for the /learn/ guides. Every passage and question
// here is ORIGINAL, written for this site. Nothing is copied from a book, exam paper or
// another worksheet site.
//
// A sheet is only built into the live site when `published: true`. New sheets start as
// drafts so the owner can review the text and the PDF first.
//
// Fields
//   id            URL slug (kebab-case, unique)
//   region        "uk" (more regions later)
//   year          the exact year label used in masteryTargets.js ("Year 4")
//   title         the passage title
//   kind          "story" | "non-fiction"
//   blurb         one plain sentence for search results and the sheet's intro
//   target        the curriculum focus area this sheet practises (must exist for that year)
//   passage       [{ h?: heading, p: paragraph }]
//   questions     [{ type, q, marks, answer, why }]
//                 type: retrieval | vocabulary | inference | explain | order | summary | language | opinion
//                 `answer` is what a good answer says; `why` explains it to the parent in a sentence.
//   published     false until the owner approves it

const SHEETS = [
  {
    id: "the-kite-on-the-hill",
    writeAfter: "Write a short story about a time something you loved got stuck, lost or broken, and how it was put right.",
    region: "uk",
    year: "Year 3",
    title: "The Kite on the Hill",
    kind: "story",
    blurb: "A short story about a kite, a windy hill and a clever idea, with eight questions on finding facts and reading between the lines.",
    target: "Drawing Inferences With Evidence",
    published: true,
    passage: [
      { p: "Maya had been waiting all week to fly her new kite. It was bright red with a long yellow tail, and her grandad had helped her make it." },
      { p: "On Saturday morning, the wind was perfect. Maya and her grandad climbed to the top of Windy Hill. “Hold the string tight,” said Grandad, “and run as fast as you can!”" },
      { p: "Maya ran across the grass with her heart thumping. Slowly, the kite lifted from the ground. It wobbled, dipped and then soared high above the trees. Maya laughed out loud." },
      { p: "Suddenly, a strong gust tugged the string out of her hands. The kite swooped over the fence and landed at the top of an old oak tree. Maya’s smile disappeared." },
      { p: "“Don’t worry,” said Grandad, rubbing his chin. “I have an idea.” He tied a ball of string to a small stick and threw it over the branch above the kite. Together they pulled the string until the branch shook, and the kite slid gently down into Maya’s hands." },
      { p: "“Good thinking, Grandad!” she cried. From that day on, Maya always carried a ball of string in her pocket, just in case." },
    ],
    questions: [
      { type: "retrieval", q: "What colour was Maya’s kite?", marks: 1, answer: "Bright red (with a long yellow tail).", why: "The answer is stated in the first paragraph, so the skill here is finding information in the text." },
      { type: "retrieval", q: "Where did Maya and her grandad go to fly the kite?", marks: 1, answer: "To the top of Windy Hill.", why: "Another fact to find, this time in the second paragraph." },
      { type: "vocabulary", q: "Find and copy one word from the third paragraph that means “flew up smoothly and powerfully”.", marks: 1, answer: "soared", why: "Children practise matching a word to its meaning. “Wobbled” and “dipped” describe a shaky kite, so only “soared” fits." },
      { type: "order", q: "Put these events in the order they happen in the story. Write 1, 2, 3 and 4 in the boxes.\n• The kite lands in the tree.\n• Grandad has an idea.\n• Maya runs across the grass.\n• The kite lifts into the air.", marks: 2, answer: "1. Maya runs across the grass. 2. The kite lifts into the air. 3. The kite lands in the tree. 4. Grandad has an idea.", why: "Sequencing shows the child has followed the whole story, not just single sentences." },
      { type: "inference", q: "How do you think Maya felt when the kite landed in the tree? Use a detail from the story to explain how you know.", marks: 2, answer: "Upset, disappointed or worried, because “Maya’s smile disappeared.”", why: "The story never says how she felt, so the child must read between the lines and back the idea up with evidence from the text." },
      { type: "inference", q: "The story says Grandad rubbed his chin. What does this suggest he was doing?", marks: 1, answer: "Thinking hard (about how to solve the problem).", why: "A small action that hints at a thought is a classic inference." },
      { type: "explain", q: "Why do you think Maya started to carry a ball of string in her pocket?", marks: 1, answer: "Because string had helped to rescue the kite, so she wanted to be ready if it happened again.", why: "The child links the ending back to the problem and its solution." },
      { type: "summary", q: "What was the problem in the story, and how was it solved?", marks: 2, answer: "The kite got stuck in the tree. Grandad tied string to a stick, threw it over the branch above the kite, and they pulled until the kite slid down.", why: "Summarising a problem and its solution in one or two sentences is a key reading skill." },
    ],
  },

  {
    id: "growing-up-in-roman-britain",
    writeAfter: "Imagine you are a Roman child in Londinium. Write a paragraph about your day.",
    region: "uk",
    year: "Year 4",
    title: "Growing Up in Roman Britain",
    kind: "non-fiction",
    blurb: "A short information text about what life was like for children in Roman Britain, with eight questions on finding facts, word meanings and headings.",
    target: "Drawing Inferences With Evidence",
    published: true,
    passage: [
      { h: "A different world", p: "Almost two thousand years ago, Britain was part of the Roman Empire. Roman soldiers, traders and families lived in towns such as Londinium, which is now London. Children growing up there had a very different life from children today." },
      { h: "School days", p: "Not every child went to school. Families who could pay sent their sons to school at about the age of seven. Pupils wrote on wooden tablets covered in wax, using a pointed tool called a stylus. If they made a mistake, they simply smoothed the wax and started again. Many girls and children from poorer families did not go to school. Some girls from wealthy families were taught to read and write at home." },
      { h: "Time to play", p: "Roman children still found time to play. They rolled hoops, spun tops and played board games with counters. One popular game used knucklebones, which were small bones from sheep or goats. Players tossed them into the air and tried to catch them on the back of the hand." },
      { h: "Rich and poor homes", p: "Wealthy children lived in houses with painted walls and warm floors, heated by a system called a hypocaust. Poorer children often lived in small, crowded rooms, many of them in or above shops. Many children began helping their families with work while they were still young." },
    ],
    questions: [
      { type: "retrieval", q: "Which modern city was built on the Roman town of Londinium?", marks: 1, answer: "London.", why: "A fact stated in the first section: children practise finding it quickly." },
      { type: "retrieval", q: "At about what age did boys from families who could pay start school?", marks: 1, answer: "About seven.", why: "Retrieval from the “School days” section." },
      { type: "retrieval", q: "What did Roman pupils write on?", marks: 1, answer: "Wooden tablets covered in wax (accept “wax tablets”).", why: "The answer is a short phrase in the text, so the child must copy it accurately." },
      { type: "vocabulary", q: "Find and copy one word that names the tool pupils used to write on the wax.", marks: 1, answer: "stylus", why: "Practises finding a specific word that matches a description." },
      { type: "explain", q: "Why was a wax tablet useful for someone learning to write?", marks: 2, answer: "Mistakes could be smoothed away and the pupil could start again.", why: "The child explains a reason from the text in their own words, which goes a step beyond copying." },
      { type: "retrieval", q: "Which two groups of children often did not go to school?", marks: 2, answer: "Girls and children from poorer families.", why: "The child pulls two pieces of information together from one sentence." },
      { type: "inference", q: "The text says poorer children “often lived in small, crowded rooms” and “began helping their families with work”. Why do you think they started work while still young?", marks: 2, answer: "Their families needed the help or the money, so children had to work instead of staying at school or playing all day.", why: "The text gives two facts but never joins them. The child has to work out the link, which is what inference means." },
      { type: "inference", q: "The text says Roman children had “a very different life from children today”. Give one way their lives were different. Use the text to explain your answer.", marks: 2, answer: "Any supported difference, for example: many children did not go to school (“Not every child went to school”); they wrote on wax tablets with a stylus; they played with knucklebones; wealthy homes had a hypocaust.", why: "The child makes a comparison with their own life and backs it up with a detail, a step towards inference." },
    ],
  },

  {
    id: "the-storm-at-herons-rest",
    writeAfter: "Write the next scene. Ellis’s mother comes home. What does she say, and what does Ellis tell her?",
    region: "uk",
    year: "Year 5",
    title: "The Storm at Heron’s Rest",
    kind: "story",
    blurb: "A tense story about a boy, a failing lighthouse lamp and a storm, with eight questions on evidence, figurative language and summarising.",
    target: "Summarising Main Ideas",
    published: true,
    passage: [
      { p: "By the time Ellis reached the harbour wall, the sky had turned the colour of old slate. Out at sea, the waves were growing taller, and the wind had begun to howl through the rigging of the small boats. Ellis pulled his hood tight and pushed on towards the lighthouse." },
      { p: "Heron’s Rest had been home to the Penhallow family for four generations. Ellis’s great-grandfather had kept the lamp burning through storms long before electricity reached the coast, and Ellis’s mother still checked the light each evening. Tonight, though, she was away at the mainland hospital, and the keys were in Ellis’s pocket." },
      { p: "He climbed the winding stairs two at a time, his breath ragged. At the top, the great lamp sat dark and silent. Ellis fumbled with the switch. Nothing. He tried again, and a faint crackle of static was the only reply." },
      { p: "Through the glass he could see a single fishing boat battling the swell, its tiny lantern flickering like a dying star. Somebody out there was relying on this light, and the only person who could help was a twelve-year-old with cold hands and a pounding heart." },
      { p: "Ellis took a deep breath. He remembered the old brass lantern that his mother kept in the cupboard beneath the stairs, “for emergencies only”. He raced down, wrenched open the door and found it wrapped in a blanket, its glass polished and its oil topped up." },
      { p: "Back at the top, his hands shook as he struck the match. The flame caught, steadied and grew. Ellis lifted the lantern high in the window and began to swing it in slow, deliberate arcs, just as he had seen his mother do on the night of the last big storm." },
      { p: "Out on the water, the little boat turned slowly towards the safety of the harbour." },
    ],
    questions: [
      { type: "retrieval", q: "For how many generations had the Penhallow family lived at Heron’s Rest?", marks: 1, answer: "Four generations.", why: "A fact to find in the second paragraph." },
      { type: "retrieval", q: "Why was Ellis alone at the lighthouse that evening?", marks: 1, answer: "His mother was away at the mainland hospital.", why: "The reason is stated, so the child practises locating and rewording it." },
      { type: "vocabulary", q: "Find and copy one word from the third paragraph that tells you the stairs were not straight.", marks: 1, answer: "winding", why: "Practises matching a word to a description." },
      { type: "inference", q: "How can you tell that Ellis was nervous as he climbed to the lamp room and lit the lantern? Give two pieces of evidence from the story.", marks: 2, answer: "Any two of: “a pounding heart”, “his hands shook”, “fumbled with the switch”. (“Breath ragged” is not accepted on its own, because it could just mean he was out of breath from the stairs.)", why: "The author never says “Ellis was scared”. The child finds the clues that show it." },
      { type: "language", q: "The author describes the boat’s lantern as “flickering like a dying star”. What does this comparison suggest about the boat’s situation?", marks: 2, answer: "The light is weak and could go out, so the boat is in danger.", why: "Understanding what a simile suggests, not just spotting it, is an upper-primary reading skill." },
      { type: "inference", q: "Why do you think Ellis’s mother kept the brass lantern “for emergencies only”?", marks: 2, answer: "So there would be a light to use if the main lamp failed; Ellis used it when the lamp would not work.", why: "The child links a detail from earlier in the story to what happens later." },
      { type: "summary", q: "Summarise the story in no more than three sentences. Say what the problem was, what Ellis did and what happened in the end.", marks: 3, answer: "1 mark each for: the lamp would not work while a boat was in danger in the storm; Ellis fetched and lit his mother’s emergency lantern and swung it in the window; the boat saw the light and turned safely towards the harbour.", why: "A good summary keeps the main events and leaves out the small details. This is the core Year 5 and 6 reading skill." },
      { type: "opinion", q: "How do you think Ellis’s mother will feel when she hears what he did? Use evidence from the story to explain your answer.", marks: 2, answer: "Proud (or relieved/amazed): he acted bravely, used the lantern she kept for emergencies, and copied what she had done in the last storm.", why: "There is more than one good answer here. What matters is a sensible feeling backed by evidence from the text." },
    ],
  },
];

const { MORE } = require("./worksheets-content-2.js");

module.exports = { SHEETS: SHEETS.concat(MORE) };
