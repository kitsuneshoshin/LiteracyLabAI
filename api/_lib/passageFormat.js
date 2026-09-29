// Reading passages must read as paragraphs, not one dense block. The prompt
// asks the model for blank-line paragraph breaks, but models often ignore that
// for a single "passage" string, so this is the safety net: if the passage has
// no breaks and is long enough to need them, it is regrouped at sentence
// boundaries into evenly sized paragraphs.
const WORDS_PER_PARAGRAPH = 75;

function wordCount(s) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function paragraphise(passage) {
  if (typeof passage !== "string") return passage;
  const text = passage.replace(/\r\n/g, "\n").trim();
  // Already has real paragraph breaks: just tidy them.
  if (/\n\s*\n/.test(text)) return text.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean).join("\n\n");

  const flat = text.replace(/\s*\n\s*/g, " ");
  const total = wordCount(flat);
  if (total < 90) return flat; // short enough to be one paragraph

  // Split after . ! ? (optionally followed by a closing quote) when the next
  // sentence starts with a capital letter or opening quote.
  const sentences = flat.split(/(?<=[.!?]["'”’]?)\s+(?=["'“‘]?[A-Z])/).filter(Boolean);
  if (sentences.length < 4) return flat;

  const paragraphs = Math.min(5, Math.max(2, Math.round(total / WORDS_PER_PARAGRAPH)));
  const target = total / paragraphs;
  const out = [];
  let current = [];
  let currentWords = 0;
  for (let i = 0; i < sentences.length; i++) {
    current.push(sentences[i]);
    currentWords += wordCount(sentences[i]);
    const remainingSentences = sentences.length - i - 1;
    const remainingParas = paragraphs - out.length - 1;
    if (remainingParas > 0 && currentWords >= target && remainingSentences >= remainingParas) {
      out.push(current.join(" "));
      current = [];
      currentWords = 0;
    }
  }
  if (current.length) out.push(current.join(" "));
  return out.join("\n\n");
}

module.exports = { paragraphise };
