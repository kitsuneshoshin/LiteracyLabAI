// A third batch of free UK reading-comprehension sheets, Years 3 to 6: four history information
// texts on topics families search for. All passages and questions are ORIGINAL. The facts are
// well-known, widely published history, kept general on purpose (see worksheets-content.js for
// the field guide).

const UK3 = [
  // ---------------------------------------------------------------- YEAR 3
  {
    id: "living-in-the-stone-age",
    region: "uk",
    year: "Year 3",
    title: "Living in the Stone Age",
    kind: "non-fiction",
    blurb: "An information text about how people lived in the Stone Age, with eight questions on finding facts, word meanings and explaining why.",
    target: "Organising Paragraphs Around a Theme",
    published: true,
    passage: [
      { h: "A long time ago", p: "The Stone Age was a very long time ago. It lasted for thousands of years. People did not have shops, cars or machines. They used stone, wood and bone to make the things they needed." },
      { h: "Finding food", p: "Early people did not grow their own food. They hunted animals, such as deer, and they fished in rivers. They also picked berries, nuts and roots. People moved from place to place to follow the food." },
      { h: "Homes and fire", p: "Some families sheltered in caves. Others built huts from branches and animal skins. Fire was very important. It kept people warm, and they used it to cook meat. It also scared away wild animals at night." },
      { h: "Tools and art", p: "People made tools from a hard stone called flint. They chipped it to make a sharp edge. They used flint axes and spears for hunting. Some people also painted animals on cave walls. Later, people began to farm and stayed in one place." },
    ],
    questions: [
      { type: "retrieval", q: "What did people use to make the things they needed in the Stone Age?", marks: 1, answer: "Stone, wood and bone.", why: "A detail to find in the first section." },
      { type: "retrieval", q: "Which hard stone did people use to make tools?", marks: 1, answer: "Flint.", why: "A key word that is stated in the last section." },
      { type: "vocabulary", q: "Find and copy one word from the section called “Finding food” that means chased in order to catch.", marks: 1, answer: "hunted", why: "The child matches a word to its meaning, using the section heading to find it." },
      { type: "explain", q: "Give two reasons why fire was important to Stone Age people.", marks: 2, answer: "Any two: it kept them warm, they cooked meat on it, or it scared away wild animals.", why: "The child picks out the facts that answer why, from a short list in the text." },
      { type: "explain", q: "Why did early people move from place to place?", marks: 1, answer: "To follow the food.", why: "A reason that is stated in the text." },
      { type: "inference", q: "Why do you think people stayed in one place once they began to farm?", marks: 2, answer: "Crops and animals need looking after, so they could not leave them, and they no longer had to follow wild food (any sensible reason).", why: "The text says what changed but not why, so the child has to work it out." },
      { type: "opinion", q: "Which do you think was more useful to Stone Age people, fire or flint tools? Give a reason.", marks: 1, answer: "Either, with a sensible reason, for example: Fire, because it kept them warm and safe, or flint tools, because they helped them hunt.", why: "There is no wrong choice. What matters is a reason that fits the facts in the text." },
      { type: "summary", q: "Write one sentence to sum up how people lived in the Stone Age.", marks: 2, answer: "One mark for finding food (hunting or gathering) and one for another detail such as caves, huts, fire or stone tools, for example: People in the Stone Age hunted and gathered food, lived in caves or huts and made tools from stone.", why: "Choosing the key ideas from a longer text is the skill of summarising." },
    ],
    writeAfter: "Imagine you are a child living in the Stone Age. Write five sentences about your day, using the words first, then and later.",
  },

  // ---------------------------------------------------------------- YEAR 4
  {
    id: "ancient-egypt-and-the-river-nile",
    region: "uk",
    year: "Year 4",
    title: "Ancient Egypt and the River Nile",
    kind: "non-fiction",
    blurb: "An information text about why the River Nile mattered to the Ancient Egyptians, with eight questions on facts, order and explaining why.",
    target: "Organising Paragraphs Around a Theme",
    published: true,
    passage: [
      { h: "A land beside a river", p: "Ancient Egypt began more than five thousand years ago. It grew up along the River Nile, in a hot, dry part of Africa. Most of the land around the river was desert. Almost everyone lived close to the water. Farmers, builders and traders all depended on the river." },
      { h: "The yearly flood", p: "Every year, the Nile flooded its banks. When the water went down, it left behind rich, dark mud. The mud was perfect for growing crops. Farmers grew wheat, barley and flax. The flax was used to make linen cloth." },
      { h: "Boats and writing", p: "The Nile was also a busy road. Boats carried people, food and heavy stones from place to place. The Egyptians wrote using pictures and symbols called hieroglyphs. They often wrote on papyrus, a type of paper made from reeds." },
      { h: "Pharaohs and pyramids", p: "The pharaoh was the ruler of Egypt. When a pharaoh died, workers built a huge stone tomb called a pyramid. Inside, they placed treasure and food for the next life. The Egyptians believed that the pharaoh would need them. Some of these pyramids are still standing today." },
    ],
    questions: [
      { type: "retrieval", q: "Which river did Ancient Egypt grow up beside?", marks: 1, answer: "The River Nile.", why: "A fact to find in the first section." },
      { type: "retrieval", q: "What was left behind when the flood water went down?", marks: 1, answer: "Rich, dark mud.", why: "Finding a detail in the right section." },
      { type: "vocabulary", q: "Find and copy one word from the section called “The yearly flood” that means exactly right.", marks: 1, answer: "perfect", why: "The child matches a word to its meaning, using the section heading to find it." },
      { type: "order", q: "Number these events 1 to 4 in the order they happen each year.\n• Farmers grow crops in the mud.\n• The water goes down.\n• The Nile floods its banks.\n• Rich, dark mud is left behind.", marks: 2, answer: "1. The Nile floods its banks. 2. The water goes down. 3. Rich, dark mud is left behind. 4. Farmers grow crops in the mud.", why: "Putting events in order shows the child has followed how one thing leads to the next." },
      { type: "explain", q: "Why was the mud left by the flood useful?", marks: 1, answer: "It was perfect for growing crops.", why: "The child links a fact to the reason for it." },
      { type: "inference", q: "Why do you think almost everyone in Ancient Egypt lived close to the Nile?", marks: 2, answer: "The river gave them water, farmland and a way to travel and carry goods, and the land around it was desert (any sensible reasons).", why: "The text gives the facts but not the conclusion, so the child has to put them together." },
      { type: "explain", q: "Why did workers place treasure and food inside a pyramid?", marks: 1, answer: "The Egyptians believed the pharaoh would need them in the next life.", why: "A cause that is stated in the last section." },
      { type: "summary", q: "Write one sentence to explain why the River Nile was so important to Ancient Egypt.", marks: 2, answer: "One mark for the river giving water, mud or farmland and one for another use, such as travel and trade, for example: The Nile flooded and left rich mud for crops, and it was also a road for boats.", why: "Choosing the key ideas from a longer text is the skill of summarising." },
    ],
    writeAfter: "Imagine you are a farmer in Ancient Egypt when the flood water goes down. Write a paragraph about what you see and what you do next.",
  },

  // ---------------------------------------------------------------- YEAR 5
  {
    id: "who-were-the-anglo-saxons",
    region: "uk",
    year: "Year 5",
    title: "Who Were the Anglo-Saxons?",
    kind: "non-fiction",
    blurb: "An information text about the Anglo-Saxons in Britain, with eight questions on facts, evidence, order and summarising.",
    target: "Summarising Main Ideas",
    published: true,
    passage: [
      { h: "Coming to Britain", p: "After the Romans left Britain, about sixteen hundred years ago, new people began to arrive. They were the Anglo-Saxons. They came from lands that are now Germany, Denmark and the Netherlands. They crossed the North Sea in wooden boats. Many came looking for good farmland." },
      { h: "Villages and farming", p: "Many Anglo-Saxons built their own small villages instead of living in Roman towns. The houses were made of wood, with roofs of thatch. Families grew crops such as wheat and barley, and they kept pigs, sheep and cattle. Skilled workers, such as blacksmiths and carpenters, made tools and built houses for the village. A village was usually led by a lord, who owned much of the land." },
      { h: "Kingdoms", p: "Over time, small groups joined together to form kingdoms. Famous kingdoms included Wessex, Mercia and Northumbria. Each kingdom was ruled by a king, who often led his warriors into battle. The kingdoms sometimes fought one another. Later, they also had to defend their land from Viking raiders." },
      { h: "Language and days", p: "The Anglo-Saxons spoke a language called Old English. It sounds very different from the English we speak today, but many everyday words come from it, such as house, bread and water. Some of our days of the week also come from the Anglo-Saxons. Wednesday was named after the god Woden, and Thursday after the god Thor." },
      { h: "Treasure from the ground", p: "In 1939, archaeologists dug into a huge burial mound at Sutton Hoo, in Suffolk. Inside, they found the outline of a ship and the treasure of an Anglo-Saxon king. There was gold jewellery, and there was a helmet. The discovery showed that Anglo-Saxon craftspeople were highly skilled." },
    ],
    questions: [
      { type: "retrieval", q: "Name two of the lands that the Anglo-Saxons came from.", marks: 2, answer: "Any two of Germany, Denmark and the Netherlands.", why: "Finding two facts in the first section." },
      { type: "retrieval", q: "In which county is the Sutton Hoo burial mound?", marks: 1, answer: "Suffolk.", why: "A fact to find in the last section." },
      { type: "vocabulary", q: "Find and copy one word from the section called “Kingdoms” that means attackers.", marks: 1, answer: "raiders", why: "The child matches a word to its meaning, using the section heading to find it." },
      { type: "explain", q: "According to the text, why did many Anglo-Saxons come to Britain?", marks: 1, answer: "They were looking for good farmland.", why: "A reason that is stated in the first section." },
      { type: "inference", q: "The text says that Anglo-Saxon craftspeople were highly skilled. What evidence from Sutton Hoo supports this?", marks: 2, answer: "They found gold jewellery and a helmet in the king’s treasure, which took great skill to make.", why: "The child checks a general claim against the details in the text." },
      { type: "order", q: "Number these events 1 to 4 in the order they appear in the text.\n• Small groups joined together to form kingdoms.\n• The Romans left Britain.\n• The kingdoms had to defend their land from Viking raiders.\n• Anglo-Saxon villages of wooden houses were built.", marks: 2, answer: "1. The Romans left Britain. 2. Anglo-Saxon villages of wooden houses were built. 3. Small groups joined together to form kingdoms. 4. The kingdoms had to defend their land from Viking raiders.", why: "Putting events in order shows the child has followed the way the text moves through time." },
      { type: "explain", q: "How can we tell that the Anglo-Saxons still affect the way we speak today?", marks: 2, answer: "Many everyday words come from Old English, such as house, bread and water, and some of our days of the week are named after Anglo-Saxon gods.", why: "Two facts in the same section have to be joined to answer the question." },
      { type: "summary", q: "Write two sentences to sum up who the Anglo-Saxons were and how they lived.", marks: 2, answer: "One mark for who they were or where they came from (people who crossed the North Sea and settled in Britain) and one for how they lived (farming villages, kingdoms, Old English).", why: "Choosing the main ideas from a longer text is the skill of summarising." },
    ],
    writeAfter: "Imagine you are an Anglo-Saxon child seeing the coast of Britain for the first time. Write the opening paragraph of a diary entry, using at least two expanded noun phrases.",
  },

  // ---------------------------------------------------------------- YEAR 6
  {
    id: "children-in-victorian-britain",
    region: "uk",
    year: "Year 6",
    title: "Children in Victorian Britain",
    kind: "non-fiction",
    blurb: "An information text about children's lives in Victorian Britain, with eight questions on evidence, explaining and summarising.",
    target: "Summarising Main Ideas",
    published: true,
    passage: [
      { h: "A time of change", p: "Queen Victoria ruled Britain from 1837 to 1901. During this time, factories, railways and coal mines grew quickly, and many families moved from the countryside to the new towns and cities. Life could be exciting, but it was also very hard, especially for poor families. Rich factory owners grew wealthy, while many workers lived in crowded streets and had little money to spare. Families often shared a single room, and several children might sleep in one bed." },
      { h: "Children at work", p: "Many poor children had to work to help their families earn enough to live. Some worked in cotton mills, where they crawled under busy machines to clear away fluff. Others worked in coal mines, opening heavy wooden doors in dark tunnels. Chimney sweeps sent small boys up narrow chimneys to clean away soot. These jobs were tiring and dangerous, and the children were often paid very little." },
      { h: "Changing the law", p: "Not everyone accepted that this was right. Writers such as Charles Dickens described the lives of poor children in their books, and many readers were shocked. Reformers pressed Parliament to act, and gradually new laws were passed. In 1842, a law stopped women, and boys under ten, from working underground in coal mines. Other laws limited the hours that children could work in factories." },
      { h: "Going to school", p: "Before this, many poor children never went to school at all. Some attended church or charity schools, where lessons were strict and children chanted facts by heart. They wrote on slates with chalk and were often punished for mistakes. In 1880, school became compulsory for children up to the age of ten, and over time the school leaving age rose." },
      { h: "Richer families", p: "Children from wealthy families had a very different life. They often lived in large houses with servants. Many were taught at home by a governess until they were sent away to school." },
    ],
    questions: [
      { type: "retrieval", q: "Between which years did Queen Victoria rule Britain?", marks: 1, answer: "From 1837 to 1901.", why: "A fact to find in the first section." },
      { type: "retrieval", q: "What did children in cotton mills crawl under busy machines to do?", marks: 1, answer: "Clear away fluff.", why: "Finding a detail in the right section." },
      { type: "vocabulary", q: "Find and copy one word from the section called “Changing the law” that means very surprised and upset.", marks: 1, answer: "shocked", why: "The child matches a word to its meaning, using the section heading to find it." },
      { type: "explain", q: "Give two reasons why the law began to change. Use the text to help you.", marks: 2, answer: "Writers such as Charles Dickens described the lives of poor children, and many readers were shocked; reformers also pressed Parliament to act.", why: "The child picks out the causes that are spread across a short section." },
      { type: "inference", q: "Choose one job from the section called “Children at work” and explain why it was dangerous for a child.", marks: 2, answer: "Any one with a reason, for example: crawling under busy machines, where a child could be hurt, or climbing narrow chimneys, where a child could get stuck or breathe in soot.", why: "The text says the jobs were dangerous but does not explain how, so the child has to work it out." },
      { type: "opinion", q: "Do you think the new laws came soon enough? Give a reason.", marks: 1, answer: "Any view with a sensible reason, for example: No, because children had already been hurt or kept from school for many years.", why: "There is no single right answer. What matters is a reason that fits the facts in the text." },
      { type: "explain", q: "How was life different for children from wealthy families?", marks: 2, answer: "They lived in large houses with servants, and many were taught at home by a governess before being sent away to school.", why: "Two details in the last section have to be joined to answer the question." },
      { type: "summary", q: "Write two sentences to sum up what life was like for children in Victorian Britain and how it began to change.", marks: 2, answer: "One mark for the hard lives of poor children (work, little schooling) and one for the changes (new laws and school becoming compulsory), with a nod to richer children for full credit.", why: "Choosing the main ideas from a longer text is the skill of summarising." },
    ],
    writeAfter: "Write a diary entry from a Victorian child on their first day at a new school or a new job. Show how the child feels, and use at least two sentences with a subordinate clause.",
  },
];

module.exports = { UK3 };
