import type { Game } from "@pax-pal/core";

const SIMILAR_COUNT = 10;

/**
 * Compute cosine similarity between all game pairs using their embeddings,
 * then populate each game's `similarGameIds` with the top N most similar.
 *
 * Games without embeddings are skipped (they get an empty array).
 * Mutates the input array in place and returns it.
 */
export function computeSimilarGames(games: Game[]): {
  games: Game[];
  stats: { computed: number; skipped: number };
} {
  // Index games that have embeddings
  const withEmbeddings: { index: number; embedding: Float64Array; norm: number }[] = [];

  for (let i = 0; i < games.length; i++) {
    const emb = games[i].embedding;
    if (!emb || emb.length === 0) continue;

    const arr = new Float64Array(emb);
    let norm = 0;
    for (let d = 0; d < arr.length; d++) norm += arr[d] * arr[d];
    norm = Math.sqrt(norm);

    withEmbeddings.push({ index: i, embedding: arr, norm });
  }

  let computed = 0;

  // For each game with an embedding, find the top N most similar
  for (let i = 0; i < withEmbeddings.length; i++) {
    const a = withEmbeddings[i];
    const scores: { gameIndex: number; similarity: number }[] = [];

    const gameA = games[a.index];
    for (let j = 0; j < withEmbeddings.length; j++) {
      if (i === j) continue;
      const b = withEmbeddings[j];
      // Skip same exhibitor — already shown in "More from [Exhibitor]"
      if (games[b.index].exhibitorId === gameA.exhibitorId) continue;

      // Cosine similarity = dot(a, b) / (|a| * |b|)
      let dot = 0;
      for (let d = 0; d < a.embedding.length; d++) {
        dot += a.embedding[d] * b.embedding[d];
      }
      const similarity = a.norm > 0 && b.norm > 0 ? dot / (a.norm * b.norm) : 0;
      scores.push({ gameIndex: b.index, similarity });
    }

    // Sort by similarity descending, take top N
    scores.sort((x, y) => y.similarity - x.similarity);
    const topN = scores.slice(0, SIMILAR_COUNT);
    games[a.index].similarGameIds = topN.map((s) => games[s.gameIndex].id);
    games[a.index].similarGameScores = topN.map((s) => Math.round(s.similarity * 1000) / 1000);
    computed++;
  }

  return {
    games,
    stats: { computed, skipped: games.length - computed },
  };
}
