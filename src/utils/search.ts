import type { Product } from "../types";
export function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
const groups = [
  ["помидор", "томат"],
  ["картошка", "картофель"],
  ["курица", "куриное"],
  ["говядина", "говяжье"],
  ["творожок", "творог"],
  ["спагетти", "макароны", "паста"],
  ["минералка", "вода"],
  ["батон", "хлеб"],
];
export function editDistance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        row[j] + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return row[b.length];
}
export function matchesProduct(product: Product, query: string) {
  const words = normalize(
    [product.name, product.description, product.brand, product.synonyms]
      .filter(Boolean)
      .join(" "),
  ).split(" ");
  return normalize(query)
    .split(" ")
    .filter(Boolean)
    .every((token) => {
      const group = groups.find((g) =>
        g.some(
          (t) =>
            token.startsWith(t) || (t.startsWith(token) && token.length >= 4),
        ),
      );
      const variants = group ? [token, ...group] : [token];
      return variants.some((v) =>
        words.some(
          (w) =>
            w.includes(v) ||
            (v.length >= 4 &&
              Math.abs(w.length - v.length) <= (v.length >= 7 ? 2 : 1) &&
              editDistance(v, w) <= (v.length >= 7 ? 2 : 1)),
        ),
      );
    });
}
