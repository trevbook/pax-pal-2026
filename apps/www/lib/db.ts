import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import type { ExhibitorDynamoItem, GameDynamoItem } from "@pax-pal/core";
import { Resource } from "sst";
import type { GameCardData } from "./game-card-data";
import { toGameCardData } from "./game-card-data";

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

const gamesTable = (Resource as unknown as Record<string, { name: string }>).Games.name;
const exhibitorsTable = (Resource as unknown as Record<string, { name: string }>).Exhibitors.name;

// ---------------------------------------------------------------------------
// Game queries
// ---------------------------------------------------------------------------

/** Fetch all active games, projected to GameCardData. Cached per-worker to avoid DynamoDB throttling during SSG. */
let _allGamesCache: Promise<GameCardData[]> | null = null;

export function getAllActiveGames(): Promise<GameCardData[]> {
  if (!_allGamesCache) {
    _allGamesCache = _fetchAllActiveGames();
  }
  return _allGamesCache;
}

async function _fetchAllActiveGames(): Promise<GameCardData[]> {
  const items: GameDynamoItem[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: gamesTable,
        FilterExpression: "#s = :active",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":active": "active" },
        ExclusiveStartKey: lastKey,
      }),
    );
    items.push(...((result.Items as GameDynamoItem[]) ?? []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items.map(toGameCardData);
}

/** Fetch a single game by slug. Returns the full DynamoDB item or null. */
export async function getGameBySlug(slug: string): Promise<GameDynamoItem | null> {
  // No GSI on slug — scan with filter. Fine for ~395 items.
  // Cannot use Limit with FilterExpression — Limit caps items *scanned*, not *returned*.
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: gamesTable,
        FilterExpression: "#s = :active AND slug = :slug",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":active": "active", ":slug": slug },
        ExclusiveStartKey: lastKey,
      }),
    );
    if (result.Items && result.Items.length > 0) {
      return result.Items[0] as GameDynamoItem;
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return null;
}

/** Fetch games by exhibitor ID, projected to GameCardData. */
export async function getGamesByExhibitor(exhibitorId: string): Promise<GameCardData[]> {
  // No GSI on exhibitorId — scan with filter. Acceptable for ~395 items.
  const result = await ddb.send(
    new ScanCommand({
      TableName: gamesTable,
      FilterExpression: "#s = :active AND exhibitorId = :eid",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":active": "active", ":eid": exhibitorId },
    }),
  );
  return ((result.Items as GameDynamoItem[]) ?? []).map(toGameCardData);
}

/** Fetch games at a specific booth via the byBooth GSI. */
export async function getGamesByBooth(boothId: string): Promise<GameCardData[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: gamesTable,
      IndexName: "byBooth",
      KeyConditionExpression: "boothId = :bid",
      FilterExpression: "#s = :active",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":bid": boothId, ":active": "active" },
    }),
  );
  return ((result.Items as GameDynamoItem[]) ?? []).map(toGameCardData);
}

// ---------------------------------------------------------------------------
// Exhibitor queries
// ---------------------------------------------------------------------------

/** Fetch a single exhibitor by ID. */
export async function getExhibitorById(id: string): Promise<ExhibitorDynamoItem | null> {
  const result = await ddb.send(
    new GetCommand({
      TableName: exhibitorsTable,
      Key: { pk: `EXHIBITOR#${id}` },
    }),
  );
  const item = result.Item as ExhibitorDynamoItem | undefined;
  if (!item || item.status !== "active") return null;
  return item;
}
