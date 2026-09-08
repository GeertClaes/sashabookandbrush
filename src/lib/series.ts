const SERIES_ALIASES: Record<string, { name: string; number: number }> = {
  "a court of thorns and roses": { name: "A Court of Thorns and Roses", number: 1 },
  "a court of mist and fury": { name: "A Court of Thorns and Roses", number: 2 },
  "a court of wings and ruin": { name: "A Court of Thorns and Roses", number: 3 },
  "a court of frost and starlight": { name: "A Court of Thorns and Roses", number: 4 },
  "a court of silver flames": { name: "A Court of Thorns and Roses", number: 5 },
  "fourth wing": { name: "The Empyrean", number: 1 },
  "iron flame": { name: "The Empyrean", number: 2 },
  "onyx storm": { name: "The Empyrean", number: 3 },
};

export function seriesFromTitle(title: string) {
  const plain = String(title).replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();
  if (SERIES_ALIASES[plain]) return SERIES_ALIASES[plain];
  const match = String(title).match(/\(([^)]+)\)\s*$/);
  if (!match) return null;
  const inner = match[1].trim();
  const numbered = inner.match(/^(.*?),?\s*#\s*([\d.]+)\s*$/);
  if (numbered) {
    return { name: numbered[1].trim(), number: Number(numbered[2]) };
  }
  return { name: inner, number: 0 };
}

export function groupSeries<T extends { data: { title: string } }>(books: T[], min = 3) {
  const groups = new Map<string, { name: string; books: T[] }>();
  for (const book of books) {
    const series = seriesFromTitle(book.data.title);
    if (!series?.name) continue;
    const current = groups.get(series.name) || { name: series.name, books: [] };
    current.books.push(book);
    groups.set(series.name, current);
  }
  return [...groups.values()]
    .filter((group) => group.books.length >= min)
    .map((group) => ({
      ...group,
      books: group.books.sort((a, b) => {
        const left = seriesFromTitle(a.data.title)?.number || 0;
        const right = seriesFromTitle(b.data.title)?.number || 0;
        return left - right;
      }),
    }))
    .sort((a, b) => b.books.length - a.books.length);
}
