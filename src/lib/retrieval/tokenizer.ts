const EN_STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
  "has", "have", "he", "i", "in", "is", "it", "its", "of", "on", "or",
  "that", "the", "this", "to", "was", "were", "will", "with", "you", "your",
  "we", "our", "they", "them", "these", "those", "can", "could", "do", "does",
  "not", "no", "so", "if", "than", "then", "too", "very",
]);

const CN_STOPWORDS = new Set([
  "的", "了", "是", "和", "在", "有", "也", "就", "都", "而", "及", "与",
  "或", "一个", "一些", "这个", "那个", "这", "那", "他", "她", "它", "我",
  "你", "我们", "你们", "他们", "但是", "因为", "所以", "如果", "不是",
]);

const CN_CHAR_STOPWORDS = new Set([
  "的", "了", "是", "和", "在", "有", "也", "就", "都", "而", "及", "与",
  "或", "这", "那", "他", "她", "它", "我", "你",
]);

const CN_REGEX = /[\u4e00-\u9fff]+/g;
const EN_TOKEN_REGEX = /[a-z0-9]+/g;

function ngrams(seq: string, min: number, max: number): string[] {
  const out: string[] = [];
  for (let n = min; n <= max; n++) {
    for (let i = 0; i + n <= seq.length; i++) {
      out.push(seq.slice(i, i + n));
    }
  }
  return out;
}

export function tokenize(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const tokens: string[] = [];

  const enMatches = lower.match(EN_TOKEN_REGEX) ?? [];
  for (const tok of enMatches) {
    if (!EN_STOPWORDS.has(tok) && tok.length > 1) tokens.push(tok);
  }

  const cnMatches = lower.match(CN_REGEX) ?? [];
  for (const run of cnMatches) {
    for (const gram of ngrams(run, 2, run.length)) {
      // Skip if the n-gram itself is in stopwords
      if (CN_STOPWORDS.has(gram)) continue;
      // Skip if all characters in the n-gram are character-level stopwords
      const chars = Array.from(gram);
      const hasNonStopword = chars.some(ch => !CN_CHAR_STOPWORDS.has(ch));
      if (hasNonStopword) tokens.push(gram);
    }
  }

  return tokens;
}
