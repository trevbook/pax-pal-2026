export interface EmbedStats {
  totalGames: number;
  embedded: number;
  cached: number;
  batches: number;
}

/** Cached embedding with text hash for invalidation. */
export interface CachedEmbedding {
  embedding: number[];
  textHash: string;
}
