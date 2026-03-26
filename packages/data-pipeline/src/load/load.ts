import { createHash } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  CreateIndexCommand,
  CreateVectorBucketCommand,
  GetVectorBucketCommand,
  PutVectorsCommand,
  S3VectorsClient,
} from "@aws-sdk/client-s3vectors";
import { BatchWriteCommand, DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { Game, HarmonizedExhibitor } from "@pax-pal/core";
import { SingleBar } from "cli-progress";
import type { LoadOptions, LoadStats } from "./types";

// ---------------------------------------------------------------------------
// Content hashing (reuses pattern from embed stage)
// ---------------------------------------------------------------------------

export function contentHash(item: Record<string, unknown>): string {
  // Exclude volatile/derived fields from the hash
  const { _contentHash: _, embedding: __, ...rest } = item;
  const json = JSON.stringify(rest, Object.keys(rest).sort());
  return createHash("sha256").update(json).digest("hex").slice(0, 16);
}

// ---------------------------------------------------------------------------
// Game → DynamoDB item
// ---------------------------------------------------------------------------

export function toGameItem(game: Game): Record<string, unknown> {
  // Strip embedding (stored in S3 Vectors) and add DynamoDB fields
  const { embedding: _, ...rest } = game;
  const item: Record<string, unknown> = {
    ...rest,
    pk: `GAME#${game.id}`,
    // Alias boothId for the GSI key (boothId already exists on Game)
    boothId: game.boothId ?? "NONE",
    status: "active",
  };
  item._contentHash = contentHash(item);
  return item;
}

// ---------------------------------------------------------------------------
// Exhibitor → DynamoDB item
// ---------------------------------------------------------------------------

export function toExhibitorItem(exhibitor: HarmonizedExhibitor): Record<string, unknown> {
  const item: Record<string, unknown> = {
    ...exhibitor,
    pk: `EXHIBITOR#${exhibitor.id}`,
    // Alias exhibitorKind → kind for the GSI key
    kind: exhibitor.exhibitorKind ?? "NONE",
    status: "active",
  };
  item._contentHash = contentHash(item);
  return item;
}

// ---------------------------------------------------------------------------
// Batch helpers
// ---------------------------------------------------------------------------

/** Split an array into chunks of the given size. */
export function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function batchWriteDynamo(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  items: Record<string, unknown>[],
  stats: { written: number; errors: number },
): Promise<void> {
  const batches = chunk(items, 25);
  const bar = new SingleBar({ format: "  {bar} {value}/{total} batches" });
  bar.start(batches.length, 0);

  for (const batch of batches) {
    try {
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [tableName]: batch.map((item) => ({
              PutRequest: { Item: item },
            })),
          },
        }),
      );
      stats.written += batch.length;
    } catch (err) {
      stats.errors += batch.length;
      console.error(`  Batch write error: ${err}`);
    }
    bar.increment();
  }

  bar.stop();
}

/**
 * Remove stale game/exhibitor records from DynamoDB that aren't in the current pipeline output.
 */
async function purgeStaleRecords(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  validPks: Set<string>,
  pkPrefix: string,
): Promise<number> {
  // Scan for all records with the given prefix
  const staleKeys: Array<{ pk: string }> = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "#s = :active AND begins_with(pk, :prefix)",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":active": "active", ":prefix": pkPrefix },
        ProjectionExpression: "pk",
        ExclusiveStartKey: lastKey,
      }),
    );
    for (const item of (result.Items as Array<{ pk: string }>) ?? []) {
      if (!validPks.has(item.pk)) {
        staleKeys.push(item);
      }
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  if (staleKeys.length === 0) return 0;

  // Delete stale records in batches of 25
  const batches = chunk(staleKeys, 25);
  for (const batch of batches) {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: batch.map((item) => ({
            DeleteRequest: { Key: { pk: item.pk } },
          })),
        },
      }),
    );
  }

  return staleKeys.length;
}

async function batchPutVectors(
  client: S3VectorsClient,
  indexArn: string,
  games: Game[],
  stats: { written: number; skipped: number; errors: number },
): Promise<void> {
  // Only games with embeddings
  const withEmbeddings = games.filter(
    (g): g is Game & { embedding: number[] } => g.embedding != null && g.embedding.length > 0,
  );
  stats.skipped = games.length - withEmbeddings.length;

  const batches = chunk(withEmbeddings, 50);
  const bar = new SingleBar({ format: "  {bar} {value}/{total} batches" });
  bar.start(batches.length, 0);

  for (const batch of batches) {
    try {
      await client.send(
        new PutVectorsCommand({
          indexArn,
          vectors: batch.map((g) => ({
            key: g.id,
            data: { float32: g.embedding },
            metadata: {
              name: g.name,
              type: g.type,
              exhibitorId: g.exhibitorId,
              boothId: g.boothId ?? "NONE",
            },
          })),
        }),
      );
      stats.written += batch.length;
    } catch (err) {
      stats.errors += batch.length;
      console.error(`  Vector batch error: ${err}`);
    }
    bar.increment();
  }

  bar.stop();
}

// ---------------------------------------------------------------------------
// S3 Vectors setup (idempotent — creates bucket + index if they don't exist)
// ---------------------------------------------------------------------------

export interface SetupVectorsOptions {
  bucketName: string;
  indexName: string;
  /** @internal — DI override for testing */
  _s3VectorsClient?: S3VectorsClient;
}

export interface SetupVectorsResult {
  indexArn: string;
  bucketName: string;
  indexName: string;
  created: boolean;
}

export async function setupVectors(options: SetupVectorsOptions): Promise<SetupVectorsResult> {
  const client = options._s3VectorsClient ?? new S3VectorsClient({});

  // Check if bucket exists
  let bucketExists = false;
  try {
    await client.send(new GetVectorBucketCommand({ vectorBucketName: options.bucketName }));
    bucketExists = true;
    console.log(`  Vector bucket "${options.bucketName}" already exists.`);
  } catch (err: unknown) {
    if ((err as { name?: string }).name === "NotFoundException") {
      bucketExists = false;
    } else {
      throw err;
    }
  }

  // Create bucket if needed
  if (!bucketExists) {
    console.log(`  Creating vector bucket "${options.bucketName}"...`);
    await client.send(new CreateVectorBucketCommand({ vectorBucketName: options.bucketName }));
  }

  // Create index (idempotent — will fail with ConflictException if it exists)
  let indexArn: string;
  let created = false;
  try {
    console.log(`  Creating vector index "${options.indexName}"...`);
    const result = await client.send(
      new CreateIndexCommand({
        vectorBucketName: options.bucketName,
        indexName: options.indexName,
        dimension: 3072,
        distanceMetric: "cosine",
        dataType: "float32",
      }),
    );
    indexArn = result.indexArn ?? "";
    created = true;
  } catch (err: unknown) {
    if ((err as { name?: string }).name === "ConflictException") {
      // Index already exists — reconstruct ARN: {bucketArn}/index/{indexName}
      const bucket = await client.send(
        new GetVectorBucketCommand({ vectorBucketName: options.bucketName }),
      );
      indexArn = `${bucket.vectorBucket?.vectorBucketArn}/index/${options.indexName}`;
      console.log(`  Vector index "${options.indexName}" already exists.`);
    } else {
      throw err;
    }
  }

  return { indexArn, bucketName: options.bucketName, indexName: options.indexName, created };
}

// ---------------------------------------------------------------------------
// Main load function
// ---------------------------------------------------------------------------

export interface LoadResult {
  stats: LoadStats;
}

export async function load(
  games: Game[],
  exhibitors: HarmonizedExhibitor[],
  options: LoadOptions,
): Promise<LoadResult> {
  const stats: LoadStats = {
    games: { total: games.length, written: 0, skipped: 0, errors: 0 },
    exhibitors: { total: exhibitors.length, written: 0, skipped: 0, errors: 0 },
    vectors: { total: games.length, written: 0, skipped: 0, errors: 0 },
    purged: { games: 0, exhibitors: 0 },
  };

  // Build DynamoDB items
  const gameItems = games.map(toGameItem);
  const exhibitorItems = exhibitors.map(toExhibitorItem);

  if (options.dryRun) {
    console.log(`  [dry-run] Would write ${gameItems.length} games to ${options.gamesTableName}`);
    console.log(
      `  [dry-run] Would write ${exhibitorItems.length} exhibitors to ${options.exhibitorsTableName}`,
    );
    const withEmbeddings = games.filter((g) => g.embedding && g.embedding.length > 0);
    console.log(
      `  [dry-run] Would put ${withEmbeddings.length} vectors to ${options.vectorIndexArn}`,
    );
    stats.games.skipped = games.length;
    stats.exhibitors.skipped = exhibitors.length;
    stats.vectors.skipped = games.length;
    return { stats };
  }

  // Create real clients (or use DI overrides)
  const docClient =
    options._docClient ??
    DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  const s3VectorsClient = options._s3VectorsClient ?? new S3VectorsClient({});

  // 1. Write games to DynamoDB
  console.log(`  Writing ${gameItems.length} games to DynamoDB...`);
  await batchWriteDynamo(docClient, options.gamesTableName, gameItems, stats.games);

  // 2. Write exhibitors to DynamoDB
  console.log(`  Writing ${exhibitorItems.length} exhibitors to DynamoDB...`);
  await batchWriteDynamo(docClient, options.exhibitorsTableName, exhibitorItems, stats.exhibitors);

  // 3. Write vectors to S3 Vectors
  console.log(`  Writing vectors to S3 Vectors...`);
  await batchPutVectors(s3VectorsClient, options.vectorIndexArn, games, stats.vectors);

  // 4. Purge stale records no longer in pipeline output
  const validGamePks = new Set(gameItems.map((item) => item.pk as string));
  const validExhibitorPks = new Set(exhibitorItems.map((item) => item.pk as string));

  console.log("  Purging stale game records...");
  stats.purged.games = await purgeStaleRecords(
    docClient,
    options.gamesTableName,
    validGamePks,
    "GAME#",
  );

  console.log("  Purging stale exhibitor records...");
  stats.purged.exhibitors = await purgeStaleRecords(
    docClient,
    options.exhibitorsTableName,
    validExhibitorPks,
    "EXHIBITOR#",
  );

  return { stats };
}
