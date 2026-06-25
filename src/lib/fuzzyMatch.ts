/**
 * Lightweight fuzzy matcher for command palette search.
 * Returns null on no match; { score, indices } on match.
 * Consecutive matches and word-boundary matches get bonus points.
 */
export function fuzzyMatch(
  query: string,
  target: string,
): { score: number; indices: number[] } | null {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  const indices: number[] = [];
  let score = 0;
  let qi = 0;
  let prevMatched = false;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      indices.push(ti);
      // Base score for each match
      score += 1;
      // Consecutive match bonus
      if (prevMatched) score += 2;
      // Word-boundary bonus (start of string, after space, after separator)
      if (ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === '_' || t[ti - 1] === '-') {
        score += 3;
      }
      qi++;
      prevMatched = true;
    } else {
      prevMatched = false;
    }
  }

  // All query characters must match
  if (qi < q.length) return null;

  // Bonus for shorter targets (more relevant)
  score += Math.max(0, 20 - t.length);

  return { score, indices };
}
