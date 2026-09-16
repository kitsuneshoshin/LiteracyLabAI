// Server-side copy of app.html's READING_BANK — kept in sync manually. The
// server must never trust a client-reported score; it re-grades from this
// answer key so a submission can't be spoofed via devtools.
const READING_BANK = {
  early: {
    title: "Sunny the Rabbit",
    skill: "Recalling key details",
    passage: "Mia has a pet rabbit named Sunny. Every morning, Mia gives Sunny fresh carrots and clean water. Sunny loves to hop around the garden and dig small holes near the fence. One day, Sunny found a shiny button in the grass and carried it back to her hutch. Mia was surprised and laughed when she saw it!",
    questions: [
      { q: "What is the name of Mia's pet?", options: ["Sunny", "Buttons", "Hoppy", "Daisy"], correct: 0 },
      { q: "What did Sunny find in the grass?", options: ["A carrot", "A shiny button", "A stick", "A flower"], correct: 1 },
      { q: "Where does Sunny like to hop around?", options: ["The kitchen", "The garden", "The park", "The school"], correct: 1 },
    ],
  },
  elementary: {
    title: "The Blocky World",
    skill: "Making inferences",
    passage: "Jayden opened his eyes to find himself standing in a strange, blocky world. Towering trees made of green squares stretched above him, and in the distance, a river sparkled under a pixelated sun. He had read about worlds like this in his favourite game, but never imagined stepping into one. Cautiously, he picked up a stick lying nearby, hoping it might help him build a shelter before nightfall. A distant growl echoed through the trees, and Jayden's heart began to race.",
    questions: [
      { q: "How does Jayden most likely feel when he hears the growl?", options: ["Bored", "Nervous", "Sleepy", "Proud"], correct: 1 },
      { q: "Why does Jayden pick up the stick?", options: ["To draw in the dirt", "To help build a shelter", "To throw it away", "To give to a friend"], correct: 1 },
      { q: "What word best describes the world Jayden finds himself in?", options: ["Blocky", "Foggy", "Empty", "Underwater"], correct: 0 },
    ],
  },
  middle: {
    title: "The Old Lighthouse",
    skill: "Inferring mood and tone",
    passage: "The old lighthouse stood alone at the edge of the cliff, its paint peeling and its windows dark. Local fishermen said it had been abandoned for decades, ever since the keeper vanished one stormy night without a trace. Elena climbed the narrow, creaking stairs slowly, her flashlight flickering against the damp stone walls. At the top, she found a logbook, its final entry unfinished mid-sentence. A cold gust of wind slammed a shutter somewhere below, and Elena froze, straining to hear if the sound would come again.",
    questions: [
      { q: "What does the unfinished logbook entry suggest?", options: ["The keeper left in a hurry or was interrupted", "The keeper finished his shift normally", "The lighthouse was never used", "Elena wrote the logbook herself"], correct: 0 },
      { q: "What is the overall mood the author creates?", options: ["Cheerful and relaxed", "Tense and eerie", "Comedic", "Romantic"], correct: 1 },
      { q: "Why does Elena \"freeze\" at the end?", options: ["She is cold from the wind", "She is startled and listening for danger", "She fell asleep", "She finished reading"], correct: 1 },
    ],
  },
  high: {
    title: "On Ambition",
    skill: "Analysing argument and rhetoric",
    passage: "Ambition, when unrestrained by conscience, has toppled empires and ended friendships; yet the same restless drive has propelled explorers across oceans and scientists toward cures once thought impossible. To dismiss ambition as inherently corrosive is to ignore the countless advances it has quietly financed. The question worth asking is not whether ambition is good or bad, but what tempers it — humility, accountability, or simply the presence of someone willing to say no. Absent those checks, even the noblest ambition curdles into something indistinguishable from greed.",
    questions: [
      { q: "What is the author's main claim?", options: ["Ambition is always destructive", "Ambition's effect depends on what restrains it", "Ambition should be eliminated", "Ambition only benefits scientists"], correct: 1 },
      { q: "What rhetorical technique opens the passage?", options: ["Antithesis / contrast", "Rhetorical question", "Statistic", "Personal anecdote"], correct: 0 },
      { q: "According to the passage, what \"tempers\" ambition?", options: ["Money and fame", "Humility, accountability, or someone willing to say no", "Government regulation", "Nothing can temper it"], correct: 1 },
    ],
  },
};

function gradeReading(tier, answers) {
  const bank = READING_BANK[tier];
  if (!bank) throw new Error(`Unknown tier: ${tier}`);
  let score = 0;
  bank.questions.forEach((q, i) => {
    if (answers && answers[i] === q.correct) score += 1;
  });
  return { score, totalQuestions: bank.questions.length, bank };
}

module.exports = { READING_BANK, gradeReading };
