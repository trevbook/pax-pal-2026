import type { S3VectorsClient } from "@aws-sdk/client-s3vectors";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export interface LoadStats {
  games: { total: number; written: number; skipped: number; errors: number };
  exhibitors: { total: number; written: number; skipped: number; errors: number };
  vectors: { total: number; written: number; skipped: number; errors: number };
  purged: { games: number; exhibitors: number };
}

export interface LoadOptions {
  gamesTableName: string;
  exhibitorsTableName: string;
  vectorIndexArn: string;
  dryRun?: boolean;
  /** @internal — DI override for testing */
  _docClient?: DynamoDBDocumentClient;
  /** @internal — DI override for testing */
  _s3VectorsClient?: S3VectorsClient;
}
