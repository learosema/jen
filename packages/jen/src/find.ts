/**
 * `jen --find "sidebar layout"`: ranks generators and recipes by the words they share with the
 * query – in the name most, then the description, then usage and param descriptions. Plain word
 * overlap, no index: there are a few hundred generators at most.
 */

/** What a hit is searched by. */
export interface Findable {
  name: string;
  description: string;
  /** usage lines, param descriptions, a recipe's steps … */
  more: string[];
}

const STOP = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'into', 'is', 'it', 'of', 'on', 'or', 'the', 'to', 'with', 'jen', 'create', 'add', 'make']);

/** Lower-case words without stop words, plurals folded: "Cards, layouts" → card, layout. */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
}

const WEIGHT = { name: 4, description: 2, more: 1 };

/** Every item with a score above 0, best first; ties keep their order. */
export function rank<T extends Findable>(query: string, items: T[]): Array<{ item: T; score: number }> {
  const asked = [...new Set(words(query))];
  if (asked.length === 0) return [];
  const scored = items.map((item) => {
    const fields = { name: new Set(words(item.name)), description: new Set(words(item.description)), more: new Set(item.more.flatMap(words)) };
    let score = 0;
    let found = 0;
    for (const w of asked) {
      const hit = (Object.keys(WEIGHT) as Array<keyof typeof WEIGHT>).filter((f) => fields[f].has(w));
      score += hit.reduce((sum, f) => sum + WEIGHT[f], 0);
      if (hit.length) found++;
    }
    // every word found beats most words found more often
    return { item, score: found === asked.length ? score * 2 : score };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
}
