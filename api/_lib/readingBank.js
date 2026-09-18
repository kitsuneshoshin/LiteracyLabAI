// Server-side copy of app.html's READING_BANK — kept in sync manually. The
// server must never trust a client-reported score; it re-grades from this
// answer key so a submission can't be spoofed via devtools.
//
// Each tier has multiple passages so a student doing repeated reading
// sessions doesn't see the same text every time. The client picks a
// passageIndex at random and sends it along with the submission; this file
// just needs to grade against whichever one was actually shown.
const READING_BANK = {
  early: [
    {
      title: "Sunny the Rabbit",
      skill: "Recalling key details",
      passage: "Mia has a pet rabbit named Sunny. Every morning, Mia gives Sunny fresh carrots and clean water. Sunny loves to hop around the garden and dig small holes near the fence. One day, Sunny found a shiny button in the grass and carried it back to her hutch. Mia was surprised and laughed when she saw it!",
      questions: [
        { q: "What is the name of Mia's pet?", options: ["Sunny", "Buttons", "Hoppy", "Daisy"], correct: 0 },
        { q: "What did Sunny find in the grass?", options: ["A carrot", "A shiny button", "A stick", "A flower"], correct: 1 },
        { q: "Where does Sunny like to hop around?", options: ["The kitchen", "The garden", "The park", "The school"], correct: 1 },
      ],
    },
    {
      title: "Ben's Kite",
      skill: "Recalling key details",
      passage: "Ben has a red kite. On windy days, Ben and his dad fly the kite in the park. The kite dances high in the sky like a bird. One day, the string broke and the kite flew far away. Ben was sad, but the next morning, a kind neighbour returned it with a big smile.",
      questions: [
        { q: "What colour is Ben's kite?", options: ["Red", "Blue", "Yellow", "Green"], correct: 0 },
        { q: "When do Ben and his dad fly the kite?", options: ["At night", "On windy days", "When it rains", "Never"], correct: 1 },
        { q: "What happened to the kite?", options: ["It broke into pieces", "The string broke and it flew away", "It got stuck in a tree", "Ben lost it at the park"], correct: 1 },
      ],
    },
    {
      title: "The Lost Puppy",
      skill: "Recalling key details",
      passage: "Ruby found a small puppy shivering near the school gate. It had no collar and looked hungry. Ruby wrapped the puppy in her jacket and carried it home. Her mum helped her make posters with the puppy's picture. Two days later, a happy family came to the door — it was their puppy, Max!",
      questions: [
        { q: "Where did Ruby find the puppy?", options: ["At the park", "Near the school gate", "In her garden", "At the shop"], correct: 1 },
        { q: "Why did Ruby wrap the puppy in her jacket?", options: ["It was shivering and cold", "It was dirty", "It was sleepy", "It was scared of her"], correct: 0 },
        { q: "What was the puppy's name?", options: ["Ruby", "Rex", "Max", "Buddy"], correct: 2 },
      ],
    },
  ],
  elementary: [
    {
      title: "The Blocky World",
      skill: "Making inferences",
      passage: "Jayden opened his eyes to find himself standing in a strange, blocky world. Towering trees made of green squares stretched above him, and in the distance, a river sparkled under a pixelated sun. He had read about worlds like this in his favourite game, but never imagined stepping into one. Cautiously, he picked up a stick lying nearby, hoping it might help him build a shelter before nightfall. A distant growl echoed through the trees, and Jayden's heart began to race.",
      questions: [
        { q: "How does Jayden most likely feel when he hears the growl?", options: ["Bored", "Nervous", "Sleepy", "Proud"], correct: 1 },
        { q: "Why does Jayden pick up the stick?", options: ["To draw in the dirt", "To help build a shelter", "To throw it away", "To give to a friend"], correct: 1 },
        { q: "What word best describes the world Jayden finds himself in?", options: ["Blocky", "Foggy", "Empty", "Underwater"], correct: 0 },
      ],
    },
    {
      title: "The Science Fair Surprise",
      skill: "Making inferences",
      passage: "Maya had spent three weeks building a volcano model for the science fair, mixing baking soda and vinegar to make it erupt. The night before the fair, her little brother knocked over the model while chasing the cat. Maya stared at the crushed cardboard mountain, her eyes stinging. She took a deep breath, gathered the pieces, and stayed up rebuilding it with her dad until midnight. The next day, when the judges asked what she'd learned, Maya smiled and said, \"That sometimes the best experiments happen after everything falls apart.\"",
      questions: [
        { q: "How does Maya likely feel when she first sees the crushed model?", options: ["Excited", "Upset", "Bored", "Proud"], correct: 1 },
        { q: "What can you infer about Maya's character from how she responds?", options: ["She gives up easily", "She is determined and resilient", "She blames her brother", "She doesn't care about the fair"], correct: 1 },
        { q: "What does Maya's answer to the judges suggest?", options: ["She regrets entering the fair", "She found meaning in overcoming the setback", "She thinks volcanoes are boring", "She wants to quit science"], correct: 1 },
      ],
    },
    {
      title: "Message in a Bottle",
      skill: "Making inferences",
      passage: "While walking along the beach after a storm, Tomás spotted something glinting in the sand — an old glass bottle with a rolled-up note inside. His hands trembled as he pulled out the paper, careful not to tear the faded ink. The message was written in a language he didn't recognize, but a small hand-drawn map was tucked beside it. Tomás glanced up and down the empty shore, wondering how long the bottle had been drifting, and from how far away.",
      questions: [
        { q: "How does Tomás feel when he opens the bottle?", options: ["Annoyed", "Nervous and excited", "Sleepy", "Angry"], correct: 1 },
        { q: "What can you infer about how long the bottle traveled?", options: ["It just arrived that day", "It likely drifted for a long time, from an unknown distance", "It was thrown from the same beach", "It was never in the water"], correct: 1 },
        { q: "Why might the author include the detail about the \"faded ink\"?", options: ["To show the note is old", "To show Tomás is careless", "To show it rained recently", "To show the note is fake"], correct: 0 },
      ],
    },
  ],
  middle: [
    {
      title: "The Old Lighthouse",
      skill: "Inferring mood and tone",
      passage: "The old lighthouse stood alone at the edge of the cliff, its paint peeling and its windows dark. Local fishermen said it had been abandoned for decades, ever since the keeper vanished one stormy night without a trace. Elena climbed the narrow, creaking stairs slowly, her flashlight flickering against the damp stone walls. At the top, she found a logbook, its final entry unfinished mid-sentence. A cold gust of wind slammed a shutter somewhere below, and Elena froze, straining to hear if the sound would come again.",
      questions: [
        { q: "What does the unfinished logbook entry suggest?", options: ["The keeper left in a hurry or was interrupted", "The keeper finished his shift normally", "The lighthouse was never used", "Elena wrote the logbook herself"], correct: 0 },
        { q: "What is the overall mood the author creates?", options: ["Cheerful and relaxed", "Tense and eerie", "Comedic", "Romantic"], correct: 1 },
        { q: "Why does Elena \"freeze\" at the end?", options: ["She is cold from the wind", "She is startled and listening for danger", "She fell asleep", "She finished reading"], correct: 1 },
      ],
    },
    {
      title: "The Silent Auction",
      skill: "Inferring mood and tone",
      passage: "The gallery was hushed except for the soft shuffle of shoes on polished floors. Rosa stood before the painting she had restored for months, her stomach twisting as two bidders raised their paddles in quick succession. She had poured her savings into materials, certain the piece was worth far more than anyone recognized. When the auctioneer's gavel finally struck, the final price displayed on the screen made the room erupt in murmurs. Rosa exhaled, unsure whether the sound rising in her chest was relief or disbelief.",
      questions: [
        { q: "What is the overall mood of the passage?", options: ["Tense and uncertain", "Playful and lighthearted", "Angry and hostile", "Calm and sleepy"], correct: 0 },
        { q: "What does Rosa's \"stomach twisting\" suggest about her emotional state?", options: ["She is bored", "She is anxious about the outcome", "She is hungry", "She is confident"], correct: 1 },
        { q: "Why might the author leave the final price unstated directly?", options: ["To keep suspense and focus on Rosa's reaction", "Because it doesn't matter", "Because Rosa didn't hear it", "To confuse the reader"], correct: 0 },
      ],
    },
    {
      title: "The Last Broadcast",
      skill: "Inferring mood and tone",
      passage: "Static crackled through the radio room as Mara adjusted the dial for the hundredth time that week. Ever since the storm had knocked out the town's main tower, her grandfather's old shortwave set had become the only link to the outside world. Tonight, faint voices cut through the noise — a rescue team, still hours away. Mara's hand hovered over the transmit button, weighing every word she might say, aware that whatever she chose could be the last message anyone heard from their side of the mountain.",
      questions: [
        { q: "What is the mood the author creates?", options: ["Tense and urgent", "Cheerful", "Bored", "Romantic"], correct: 0 },
        { q: "What can be inferred about the town's situation?", options: ["It is isolated and waiting for help", "It has already been rescued", "It was never in danger", "Mara is broadcasting for fun"], correct: 0 },
        { q: "Why does Mara hesitate before pressing the transmit button?", options: ["She doesn't know how the radio works", "She feels the weight and importance of her words", "She is scared of static", "She wants to end the broadcast"], correct: 1 },
      ],
    },
  ],
  high: [
    {
      title: "On Ambition",
      skill: "Analysing argument and rhetoric",
      passage: "Ambition, when unrestrained by conscience, has toppled empires and ended friendships; yet the same restless drive has propelled explorers across oceans and scientists toward cures once thought impossible. To dismiss ambition as inherently corrosive is to ignore the countless advances it has quietly financed. The question worth asking is not whether ambition is good or bad, but what tempers it — humility, accountability, or simply the presence of someone willing to say no. Absent those checks, even the noblest ambition curdles into something indistinguishable from greed.",
      questions: [
        { q: "What is the author's main claim?", options: ["Ambition is always destructive", "Ambition's effect depends on what restrains it", "Ambition should be eliminated", "Ambition only benefits scientists"], correct: 1 },
        { q: "What rhetorical technique opens the passage?", options: ["Antithesis / contrast", "Rhetorical question", "Statistic", "Personal anecdote"], correct: 0 },
        { q: "According to the passage, what \"tempers\" ambition?", options: ["Money and fame", "Humility, accountability, or someone willing to say no", "Government regulation", "Nothing can temper it"], correct: 1 },
      ],
    },
    {
      title: "On Silence",
      skill: "Analysing argument and rhetoric",
      passage: "We are taught to fear silence — to fill every pause with noise, every gap in conversation with commentary. Yet silence is not the absence of meaning; it is often where meaning is made. The pause before a difficult answer, the quiet after an apology, the stillness in a crowded room after unwelcome news — these silences communicate more precisely than words ever could. To rush to fill them is not politeness; it is often a failure of nerve. Perhaps what we call \"awkward silence\" is simply silence doing its job: forcing us to sit, however briefly, with what is true.",
      questions: [
        { q: "What is the author's main claim?", options: ["Silence is meaningless and should be avoided", "Silence often communicates more than words and shouldn't be rushed", "People should never speak", "Awkward silence is always a mistake"], correct: 1 },
        { q: "What rhetorical technique is used in listing \"the pause... the quiet... the stillness\"?", options: ["Parallelism (repetition of structure)", "Statistics", "Direct quotation", "Sarcasm"], correct: 0 },
        { q: "What does the author suggest \"awkward silence\" really is?", options: ["A social failure", "Silence doing its job of confronting us with truth", "A sign of rudeness", "Something to always eliminate"], correct: 1 },
      ],
    },
    {
      title: "The Myth of the Self-Made Success",
      skill: "Analysing argument and rhetoric",
      passage: "No success is entirely self-made, however earned it may feel to the person who achieved it. Behind every triumphant narrative lies a scaffolding of unseen support: a teacher who noticed potential, a policy that made opportunity possible, a family member who absorbed risk so another could take it. Acknowledging this is not the same as diminishing effort or talent — both remain essential. But the myth of pure self-sufficiency does real damage: it blinds the successful to their own good fortune, and it teaches the struggling that failure is theirs alone to bear. A more honest story would credit both the individual and the invisible hands that helped lift them.",
      questions: [
        { q: "What is the author's central argument?", options: ["Success is entirely due to luck", "Success involves both individual effort and unacknowledged support", "Effort and talent don't matter", "Hard work always guarantees success"], correct: 1 },
        { q: "What is the effect of the phrase \"invisible hands\"?", options: ["It is a literal description", "It is a metaphor for unseen help and support", "It refers to a specific person", "It suggests dishonesty"], correct: 1 },
        { q: "According to the passage, what \"damage\" does the self-made myth cause?", options: ["It makes people work harder", "It blinds the successful to luck and blames failure solely on individuals", "It has no real effect", "It only affects wealthy people"], correct: 1 },
      ],
    },
  ],
};

function gradeReading(tier, passageIndex, answers) {
  const passages = READING_BANK[tier];
  if (!passages) throw new Error(`Unknown tier: ${tier}`);
  const idx = Number.isInteger(passageIndex) && passages[passageIndex] ? passageIndex : 0;
  const bank = passages[idx];
  let score = 0;
  bank.questions.forEach((q, i) => {
    if (answers && answers[i] === q.correct) score += 1;
  });
  return { score, totalQuestions: bank.questions.length, bank };
}

module.exports = { READING_BANK, gradeReading };
