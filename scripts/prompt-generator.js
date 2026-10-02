// The free writing-prompt generator at /learn/prompts/. No AI, no network, nothing
// stored: it picks from the banks below. This file runs in the browser (the page
// build embeds it) and in tests (node), so it must stay free of anything but plain
// JavaScript. The export block at the bottom is stripped for the browser.

var PG_STAGES = {
  early: "Ages 5–7 (early years)",
  elementary: "Ages 8–10 (primary)",
  middle: "Ages 11–13 (middle years)",
  high: "Ages 14–18 (senior years)",
};
var PG_TYPES = {
  story: "A story",
  describe: "A description",
  opinion: "An opinion or argument",
  explain: "An explanation",
  letter: "A letter or message",
};
var PG_INTERESTS = {
  space: "Space",
  coding: "Coding and technology",
  gaming: "Gaming",
  lit: "Books and stories",
  history: "History",
  pop: "Music, film and pop culture",
  animals: "Animals",
  sports: "Sports",
};
// How long a good piece is at each stage (matches the guide pages).
var PG_LENGTH = {
  early: "just a few short sentences",
  elementary: "one or two short paragraphs",
  middle: "several paragraphs",
  high: "a structured piece of several well-developed paragraphs",
};

// Topics are short noun phrases that read correctly in the templates below. A topic starting with ~ is imaginary (a magic library, a talking computer): it is only offered for stories, descriptions and letters, never for facts or opinions.
var PG_TOPICS = {
  space: {
    early: ["the Moon", "a rocket", "stars at night", "an astronaut", "~a friendly alien"],
    elementary: ["exploring other planets", "living on a space station", "the surface of the Moon", "a rocket launch", "~meeting an alien"],
    middle: ["space exploration", "living on another planet", "the first journey to Mars", "the dangers astronauts face", "the study of the stars"],
    high: ["the cost and value of space exploration", "humans settling on other planets", "private companies in space", "the search for life beyond Earth", "the role of science in space travel"],
  },
  coding: {
    early: ["~a robot helper", "a computer game you make", "~a talking computer", "computers", "~a button that does magic"],
    elementary: ["building your own game", "~a robot that tidies your room", "learning to code", "~a computer that could think", "an app you would invent"],
    middle: ["learning to code", "robots in everyday life", "a useful app you would create", "technology at school", "the making of video games"],
    high: ["artificial intelligence in everyday life", "the role of technology in education", "the limits of screen time", "automation and the future of work", "privacy in a digital world"],
  },
  gaming: {
    early: ["your favourite game", "~a game with a dragon", "playing with friends", "a board game", "a game with no screen"],
    elementary: ["a video game you would design", "your favourite game character", "~a game that comes to life", "fair play", "a level that is very hard"],
    middle: ["video games", "designing your own game", "gaming with friends online", "games as a way to learn", "the things that make a game fun"],
    high: ["the influence of video games on young people", "the rise of competitive gaming", "the educational value of video games", "storytelling in games", "the ethics of in-game spending"],
  },
  lit: {
    early: ["your favourite book", "~a magic book", "a bedtime story", "a book character", "a visit to the library"],
    elementary: ["a book you could not put down", "a character from a story", "~a magic library", "a story with a surprise ending", "reading for fun"],
    middle: ["reading for pleasure", "a character you admire from a book", "a story with a twist", "the importance of stories", "your favourite author"],
    high: ["the lasting appeal of novels", "the creation of memorable characters", "the power of stories to change minds", "a book that changed the way you think", "the role of libraries"],
  },
  history: {
    early: ["castles", "knights long ago", "dinosaurs", "a visit to a museum", "life long ago"],
    elementary: ["life long ago", "a day in the life of a child in the past", "a famous explorer", "an old castle", "an invention that changed the world"],
    middle: ["an event from the past that interests you", "a day in the life of someone in history", "an invention that changed the world", "the study of history", "a historical figure you admire"],
    high: ["the lessons of history", "the way past events shaped today's world", "the role of ordinary people in historical change", "who gets to write history", "a turning point in history"],
  },
  pop: {
    early: ["your favourite song", "a funny film", "dancing", "a cartoon character", "a party"],
    elementary: ["your favourite song or show", "a film you would make", "being in a band", "~a cartoon character who comes to life", "a favourite performer"],
    middle: ["your favourite music", "a film you would direct", "social media", "celebrities and fame", "a show everyone is talking about"],
    high: ["the influence of social media on teenagers", "the influence of music on culture", "celebrity culture", "the effect of streaming on entertainment", "the power of film"],
  },
  animals: {
    early: ["a pet", "a puppy", "a lion", "a farm animal", "a bird in the garden"],
    elementary: ["a pet you would love to have", "an endangered animal", "life in the jungle", "~an animal with a superpower", "a visit to the zoo"],
    middle: ["keeping pets", "protecting endangered animals", "a wild animal in danger", "zoos", "animal communication"],
    high: ["the role of zoos today", "the effects of climate change on wildlife", "animal testing", "the relationship between humans and animals", "protecting endangered species"],
  },
  sports: {
    early: ["your favourite sport", "running a race", "a football game", "sports day", "a team"],
    elementary: ["winning and losing", "your favourite sport", "~a team that wins against the odds", "sports day", "a champion"],
    middle: ["team sports", "a sports match you will never forget", "fairness in sport", "the qualities of a good team", "a sporting hero"],
    high: ["the role of sport in young people's lives", "the pay of professional athletes", "the importance of teamwork", "sportsmanship", "the pressure on young athletes"],
  },
};

var PG_TEMPLATES = {
  early: {
    story: ["Write a short story that has {topic} in it.", "Write a story about {topic} with a beginning, a middle and an end.", "Tell a short story about {topic}. Start with the words 'One day'."],
    describe: ["Write three sentences about {topic}. Use a describing word in each one.", "Draw a picture about {topic}, then write two sentences about your picture.", "Describe {topic}. What can you see, hear or feel?"],
    opinion: ["Write two sentences about what you think of {topic}.", "Say what you think about {topic} and give one reason.", "Write what you like or do not like about {topic}."],
    explain: ["Tell someone about {topic}. Write two things you know.", "Write what you know about {topic}. Use the word 'because' once.", "Write two facts about {topic}."],
    letter: ["Write a short message to a friend about {topic}.", "Write a note to someone you love about {topic}. Start with 'Dear'.", "Write a postcard that mentions {topic}."],
  },
  elementary: {
    story: ["Write a story that involves {topic}. Start with something surprising.", "Write the opening paragraph of an adventure story about {topic}.", "Write a story about {topic} in which a problem is solved in an unexpected way."],
    describe: ["Describe {topic} so well that a reader could picture it. Use at least three of your senses.", "Write a paragraph describing {topic} without using the word 'nice'.", "Describe {topic} using a simile and a strong verb."],
    opinion: ["What do you think about {topic}? Give your opinion and at least two reasons.", "Write a short persuasive paragraph about {topic}. Use 'because' and 'for example'.", "Write a paragraph giving your opinion on {topic}. Explain your reasons clearly."],
    explain: ["Explain {topic} to a younger child in a short paragraph.", "Write a short information text about {topic} with a title and two paragraphs.", "Write five facts about {topic} in your own words, then say which one is most interesting."],
    letter: ["Write a letter to a friend telling them about {topic}.", "Write a letter to someone you admire about {topic}.", "Write an email inviting someone to join you in something to do with {topic}."],
  },
  middle: {
    story: ["Write a short story that begins with a character discovering something connected to {topic}.", "Write a story involving {topic} that ends with a twist.", "Write the opening of a story in which {topic} plays an important part. Focus on the setting and a hint of tension."],
    describe: ["Describe {topic} in so much detail that the reader feels they are there. Use figurative language.", "Write a vivid description linked to {topic}, using at least three different sentence openers.", "Describe a moment connected to {topic} when time seemed to slow down."],
    opinion: ["Write a persuasive paragraph about {topic}. Include a reason, evidence and a counter-argument.", "What is your view on {topic}? Write an argument that would convince a sceptical reader.", "Write a speech to your class giving your opinion on {topic}."],
    explain: ["Explain {topic} clearly to someone who has never come across it. Organise your answer in paragraphs.", "Write an information article about {topic} with a heading, an introduction and a conclusion.", "Compare two different views of {topic} and say which one you find more convincing."],
    letter: ["Write a formal letter to your headteacher about {topic}.", "Write a letter to your future self about {topic}.", "Write an email to a local newspaper giving your view on {topic}."],
  },
  high: {
    story: ["Write the opening of a story in which {topic} is central, using a distinctive voice and a vivid setting.", "Write a short story that explores {topic} from an unusual point of view.", "Write a scene that shows a moment of change in a character's life, linked to {topic}. Show, don't tell."],
    describe: ["Write a descriptive piece inspired by {topic}. Use imagery and varied sentence structure to create atmosphere.", "Describe a place connected to {topic} so that the setting reveals a mood.", "Write a reflective description of a memory related to {topic}."],
    opinion: ["Write an argument on {topic}. Use evidence, address a counter-argument and finish with a clear conclusion.", "To what extent do you agree that {topic} matters? Argue your case.", "Write a persuasive speech on {topic} for a school assembly."],
    explain: ["Analyse the importance of {topic}. Organise your ideas into clear paragraphs with evidence.", "Write an article for a school magazine that explains {topic} and its impact.", "Evaluate the arguments for and against {topic}. Reach a reasoned conclusion."],
    letter: ["Write a formal letter to a local council about {topic}. Use an appropriate register.", "Write an open letter to your peers about {topic}.", "Write a letter of application connected to {topic}, explaining why you would be a good choice."],
  },
};

// opts: { stage, type, interest } where type and interest may be "any" or omitted.
// rand: a function returning a number in [0, 1) (Math.random in the browser).
// Returns { prompt, stage, type, interest, topic, length }.
function buildPrompt(opts, rand) {
  var r = rand || Math.random;
  var pick = function (arr) { return arr[Math.min(arr.length - 1, Math.floor(r() * arr.length))]; };
  var stage = PG_STAGES[opts && opts.stage] ? opts.stage : "elementary";
  var type = PG_TYPES[opts && opts.type] ? opts.type : pick(Object.keys(PG_TYPES));
  var interest = PG_INTERESTS[opts && opts.interest] ? opts.interest : pick(Object.keys(PG_INTERESTS));
  var all = PG_TOPICS[interest][stage];
  var factual = type === "explain" || type === "opinion";
  var pool = factual ? all.filter(function (t) { return t.charAt(0) !== "~"; }) : all;
  var topic = pick(pool).replace(/^~/, "");
  var template = pick(PG_TEMPLATES[stage][type]);
  return { prompt: template.split("{topic}").join(topic), stage: stage, type: type, interest: interest, topic: topic, length: PG_LENGTH[stage] };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { buildPrompt: buildPrompt, PG_STAGES: PG_STAGES, PG_TYPES: PG_TYPES, PG_INTERESTS: PG_INTERESTS, PG_TOPICS: PG_TOPICS, PG_TEMPLATES: PG_TEMPLATES, PG_LENGTH: PG_LENGTH };
}
