/**
 * Teleprompter Matcher
 *
 * Matches live transcript text against the current talking points
 * to auto-advance the teleprompter. Uses key-term extraction with
 * fuzzy matching (first-5-char prefix) and a sliding transcript window.
 */

// ── Stop words ────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  "the",  "and",  "but",  "for",  "with", "that", "this", "from",
  "have", "been", "will", "your", "are",  "was",  "were", "they",
  "them", "their","what", "when", "where","which","who",  "whom",
  "how",  "not",  "all",  "each", "every","both", "few",  "more",
  "most", "other","some", "such", "than", "too",  "very", "can",
  "just", "don",  "should","now",  "also", "into", "only", "over",
  "then", "about","after","before","between","could","does","done",
  "down", "during","got",  "had",  "has",  "here", "its",  "let",
  "like", "make", "many", "much", "must", "need", "our",  "out",
  "own",  "said", "same", "she",  "still","take", "tell", "these",
  "those","through","under","upon", "used", "using","want", "way",
  "well", "while","would","you",  "there","being","going","really",
  "think","know", "come", "came", "get",  "got",  "say",  "says",
]);

const MIN_WORD_LENGTH = 3;
const WINDOW_SIZE = 50;
const MATCH_THRESHOLD = 0.5;
const FUZZY_PREFIX_LENGTH = 5;
const MIN_KEY_TERMS = 1;
const MAX_KEY_TERMS = 4;

// ── Helpers ───────────────────────────────────────────────────────────

/** Normalize a raw word: lowercase, strip non-alpha characters. */
function normalize(word: string): string {
  return word.toLowerCase().replace(/[^a-z]/g, "");
}

/** Extract 2-4 key terms from a sentence / bullet point. */
function extractKeyTerms(text: string): string[] {
  const words = text
    .split(/\s+/)
    .map(normalize)
    .filter((w) => w.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(w));

  // De-duplicate by prefix to avoid near-identical terms
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const w of words) {
    const prefix = w.slice(0, FUZZY_PREFIX_LENGTH);
    if (!seen.has(prefix)) {
      seen.add(prefix);
      unique.push(w);
    }
  }

  // Keep between MIN and MAX key terms — prefer earlier (more prominent) words
  return unique.slice(0, MAX_KEY_TERMS).length >= MIN_KEY_TERMS
    ? unique.slice(0, MAX_KEY_TERMS)
    : unique.slice(0, MIN_KEY_TERMS);
}

/**
 * Fuzzy match: two words match when they share the same first
 * `FUZZY_PREFIX_LENGTH` characters (handles inflections like
 * invest·ing ↔ invest·or, solution·s ↔ solution).
 */
function fuzzyMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < FUZZY_PREFIX_LENGTH || b.length < FUZZY_PREFIX_LENGTH) {
    return a === b;
  }
  return a.slice(0, FUZZY_PREFIX_LENGTH) === b.slice(0, FUZZY_PREFIX_LENGTH);
}

/** Check whether a key term appears (fuzzy) anywhere in a word list. */
function termInWindow(term: string, window: string[]): boolean {
  return window.some((w) => fuzzyMatch(term, w));
}

// ── Interface ─────────────────────────────────────────────────────────

export interface TeleprompterMatcher {
  /** Load a new set of bullet points (resets state). */
  setBullets(bullets: string[]): void;
  /** Feed new transcript text (may trigger advance). */
  feedTranscript(text: string): void;
  /** Current bullet index (0-based). */
  getCurrentIndex(): number;
  /** Register a callback fired when the teleprompter advances. */
  onAdvance(callback: (newIndex: number) => void): void;
}

// ── Implementation ────────────────────────────────────────────────────

export function createTeleprompterMatcher(): TeleprompterMatcher {
  let bulletKeyTerms: string[][] = [];
  let currentIndex = 0;
  let window: string[] = [];
  let listeners: Array<(newIndex: number) => void> = [];

  function advance(): void {
    if (currentIndex >= bulletKeyTerms.length - 1) return; // already at last bullet
    currentIndex++;
    for (const cb of listeners) {
      try {
        cb(currentIndex);
      } catch {
        // swallow listener errors
      }
    }
  }

  function evaluate(): void {
    if (bulletKeyTerms.length === 0) return;
    if (currentIndex >= bulletKeyTerms.length) return;

    const terms = bulletKeyTerms[currentIndex];
    if (terms.length === 0) {
      // No extractable key terms — leave for manual advance
      return;
    }

    const matched = terms.filter((t) => termInWindow(t, window)).length;
    const ratio = matched / terms.length;

    if (ratio >= MATCH_THRESHOLD) {
      advance();
    }
  }

  return {
    setBullets(bullets: string[]): void {
      bulletKeyTerms = bullets.map(extractKeyTerms);
      currentIndex = 0;
      window = [];
    },

    feedTranscript(text: string): void {
      const words = text
        .split(/\s+/)
        .map(normalize)
        .filter((w) => w.length > 0);

      window = [...window, ...words].slice(-WINDOW_SIZE);
      evaluate();
    },

    getCurrentIndex(): number {
      return currentIndex;
    },

    onAdvance(callback: (newIndex: number) => void): void {
      listeners.push(callback);
    },
  };
}
