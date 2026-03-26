/**
 * Wipe all social data (Users + Reviews tables) for the current SST stage.
 *
 * Usage:
 *   bunx sst shell bun run scripts/wipe-social-data.ts
 *
 * This runs inside the SST shell so it has access to Resource bindings
 * for the current stage (e.g. your ephemeral `thubbard` stage).
 *
 * ⚠️  This is destructive and cannot be undone. It deletes ALL rows
 *     in the Users and Reviews tables for the current stage.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

const usersTable = (Resource as unknown as Record<string, { name: string }>).Users.name;
const reviewsTable = (Resource as unknown as Record<string, { name: string }>).Reviews.name;

async function wipeTable(tableName: string, keyNames: string[]) {
  let totalDeleted = 0;
  let lastKey: Record<string, unknown> | undefined;

  do {
    const scan = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ProjectionExpression: keyNames.join(", "),
        ExclusiveStartKey: lastKey,
      }),
    );

    const items = scan.Items ?? [];
    lastKey = scan.LastEvaluatedKey;

    if (items.length === 0) break;

    // BatchWrite in chunks of 25 (DynamoDB limit)
    for (let i = 0; i < items.length; i += 25) {
      const batch = items.slice(i, i + 25);
      await ddb.send(
        new BatchWriteCommand({
          RequestItems: {
            [tableName]: batch.map((item) => ({
              DeleteRequest: {
                Key: Object.fromEntries(keyNames.map((k) => [k, item[k]])),
              },
            })),
          },
        }),
      );
      totalDeleted += batch.length;
    }
  } while (lastKey);

  return totalDeleted;
}

async function main() {
  console.log(`Wiping social data...`);
  console.log(`  Users table: ${usersTable}`);
  console.log(`  Reviews table: ${reviewsTable}`);
  console.log();

  const usersDeleted = await wipeTable(usersTable, ["pk"]);
  console.log(`  Deleted ${usersDeleted} user(s)`);

  const reviewsDeleted = await wipeTable(reviewsTable, ["pk", "sk"]);
  console.log(`  Deleted ${reviewsDeleted} review(s)`);

  console.log(`\nDone! Wiped ${usersDeleted + reviewsDeleted} total items.`);
}

main().catch((err) => {
  console.error("Failed to wipe data:", err);
  process.exit(1);
});
