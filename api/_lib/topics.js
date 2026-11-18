// Topic seeds for generated reading passages and writing prompts.
//
// Left to itself the model keeps coming back to the same few ideas: a live check of 70 generated pieces gave a hidden
// door, key or box for every younger story prompt, phones in school for 9 of 20 older prompts, and gardens, seeds,
// composting or rain for about half of the passages. A learner would meet the same text again and again.
//
// So every generation is handed one subject, picked at random from a long list for the learner's age. The lists are
// plain data: add a line to widen the variety. They are deliberately neutral (no country, no exam) because the country
// and curriculum are handled separately in countryProfile.js.

const READING = {
  early: [
    "a puppy learning a new trick", "a rainy-day indoor picnic", "a baker who is out of flour", "a child's first day at swimming lessons",
    "a lost mitten that turns up somewhere surprising", "an owl that cannot sleep", "a toy robot that needs new batteries", "a trip on a big red bus",
    "a snowman that melts", "a cat who wants to be friends with a fish", "a birthday cake that goes wrong", "a visit to a fire station",
    "a little boat on a big lake", "a kite that will not stay up", "the moon following a child home", "a farmer and a very loud rooster",
    "a market stall full of colours", "a hedgehog getting ready for winter", "a drawing that comes to life", "a very tall giraffe at the zoo",
  ],
  elementary: [
    "a football team that keeps losing and finds a new plan", "how bees make honey", "a lighthouse keeper's long night", "a girl who invents a gadget to help her grandfather",
    "the history of the bicycle", "a school trip to a museum with a surprise", "how volcanoes form", "a young chef's first cooking competition",
    "a lost dog being found by a whole street", "life in a space station", "a boy who is afraid of the dark stage at the school play", "the journey of a letter through the post",
    "an orphaned baby elephant being cared for", "a rescue team after a storm", "how a bridge is built", "a street musician and a quiet crowd",
    "a camping trip with a broken tent", "the world's smallest library", "two cousins and a long train journey", "how penguins keep warm",
    "a young inventor at a science fair", "a stray cat adopted by a bakery", "the story of a famous explorer", "a swimming race and a tangled goggle strap",
  ],
  middle: [
    "a teenager's first day at a new school in a new city", "the history of the printing press", "a community that saves its local cinema", "a marathon runner's training diary",
    "how the internet reaches remote villages", "an astronaut's message from orbit", "the ethics of keeping animals in zoos", "a family business facing hard times",
    "the life and work of a famous scientist", "a lifeguard's tense afternoon", "a debate about a four-day school week", "the secret history of a street name",
    "a young chess player facing a rival", "deep-sea exploration and strange creatures", "how a film gets made", "volunteers rebuilding a village footpath",
    "a coastal town fighting erosion", "a travel blog from a night train", "a violinist who loses her confidence", "the invention of the light bulb",
    "the pros and cons of electric buses", "a mountain rescue at dawn", "life on an Antarctic research base", "a local market that has run for 300 years",
  ],
  high: [
    "the economics of a tiny island nation", "an ageing city's plan for cycling", "a translator's view of two languages", "a surgeon's first operation",
    "a debate about space exploration funding", "the cultural effects of streaming music", "a lighthouse automated for the last time", "an architect rebuilding after an earthquake",
    "the quiet life of a long-distance lorry driver", "a journalist at a small-town newspaper's final issue", "the ethics of gene editing in farming", "the legacy of a famous bridge",
    "a refugee chef opening a first restaurant", "the loneliness of a night-shift nurse", "city life versus village life", "an athlete deciding whether to retire",
    "the history of a famous trade route", "how sleep affects learning", "a village that votes on a wind farm", "a diplomat's difficult dinner",
    "the rise of remote working", "a documentary about ocean plastic", "a student orchestra on tour", "what a mountain village teaches a visiting engineer",
  ],
};

// Story ideas. None of them is a hidden door, a key or a box.
const NARRATIVE = {
  early: [
    "a child who finds a lost balloon", "a small dragon that is afraid of fire", "a cat who goes to the seaside", "a teddy bear that is left on a train",
    "a snowy morning when everything is different", "a bird who cannot sing", "a boy and his very big boots", "a rabbit that wants to see the moon",
    "a girl who makes friends with a cloud", "a fox who is learning to bake",
  ],
  elementary: [
    "a ship that is stuck in the ice", "a child who is chosen to carry the school flag", "a market where one stall sells something unusual", "a dog that follows the wrong person home",
    "a train that stops at a station nobody has heard of", "a boy who wakes up able to understand animals for one day", "a storm that cuts the power during a party", "a missing trophy on sports day",
    "a girl who finds an old camera with film still inside", "a lighthouse and a very small fishing boat", "an invisible friend who gets lost", "a robot that learns to laugh",
  ],
  middle: [
    "a character who must decide whether to tell the truth about a mistake", "two friends on opposite teams in the final match", "a village where the clocks have all stopped", "a character who inherits a failing shop",
    "a long journey home after missing the last bus", "a new student who seems to know everyone's secrets", "a night when the whole town loses power", "a character who is asked to guard something they do not understand",
    "a letter that arrives forty years late", "a rescue at sea", "a performer who freezes on stage", "a character who sees their own town as a visitor would",
  ],
  high: [
    "a character caught between loyalty to a friend and doing the right thing", "a quiet town on the night before a big change", "a long-awaited reunion that goes differently than imagined", "a character returning to a childhood home that has been sold",
    "an interview that changes someone's plans", "a storm-bound ferry and its passengers", "someone who discovers their neighbour is not who they claim", "the last day of a family business",
    "a character starting over in a country where they do not speak the language", "a conversation overheard on a late train", "a competition that reveals more about the rivals than the result", "a message that is sent to the wrong person",
  ],
};

// Opinion topics. Mobile phones in school are left out on purpose: they came up in nearly half of the older prompts.
const PERSUASIVE = {
  early: [
    "whether dogs or cats make better pets", "whether recess should be longer", "which season is the best", "whether every classroom should have a pet",
    "whether picnics are better than parties", "whether children should choose the class story",
  ],
  elementary: [
    "whether the school day should start later", "whether children should have a weekly choice of lunch", "whether zoos are good for animals", "whether every school should have a library dog",
    "whether homework should be given at weekends", "whether the town should build a new skate park", "whether school trips are worth the cost", "whether children should learn a second language from age six",
  ],
  middle: [
    "whether school uniforms should be compulsory", "whether homework does more good than harm", "whether the school year should be arranged differently", "whether young people should be able to vote at sixteen",
    "whether space exploration is worth the money", "whether sport should be compulsory at school", "whether social media should have an age limit", "whether towns should ban cars from the centre",
    "whether students should help to choose what they study", "whether libraries still matter", "whether zoos should exist", "whether a four-day school week would work",
  ],
  high: [
    "whether voting should be compulsory", "whether universities are still the best route to a good career", "whether cities should ban private cars", "whether the four-day working week should be standard",
    "whether social media does more harm than good", "whether art and music deserve the same funding as science", "whether professional athletes are paid too much", "whether young people should do a year of national service",
    "whether zoos and aquariums should be phased out", "whether tourism helps or harms the places it visits", "whether exams are the fairest way to judge a student", "whether artificial intelligence should be allowed in schoolwork",
  ],
};

const DESCRIPTIVE = {
  early: ["a busy market", "your favourite room", "a rainy street", "the playground at lunchtime", "a bakery in the morning", "a sleepy farm"],
  elementary: ["a bustling train station", "a beach at sunrise", "the school hall before a concert", "a forest after rain", "a fairground at night", "a grandparent's kitchen"],
  middle: ["a city at rush hour", "an empty stadium", "a harbour in fog", "a library on a winter afternoon", "a night market", "a deserted playground at dusk"],
  high: ["a station at midnight", "a hospital corridor", "a harvest festival", "a city seen from a high window", "a shop that is closing down", "a crowded beach out of season"],
};

function pick(list, rng) { return list && list.length ? list[Math.floor(rng() * list.length)] : null; }

// A subject for a reading passage at this age.
function readingTopic(tier, rng = Math.random) { return pick(READING[tier] || READING.elementary, rng); }

// A subject for a writing prompt: which list depends on the kind of piece (the age's usual kind when none was chosen).
// Analytical prompts refer to a text the student has read, so they get no seed.
function writingTopic(tier, genre, rng = Math.random) {
  const g = genre || ({ early: "narrative", elementary: "narrative", middle: "analytical", high: "persuasive" })[tier];
  const table = { narrative: NARRATIVE, persuasive: PERSUASIVE, descriptive: DESCRIPTIVE }[g];
  return table ? pick(table[tier] || table.elementary, rng) : null;
}

module.exports = { READING, NARRATIVE, PERSUASIVE, DESCRIPTIVE, readingTopic, writingTopic };
