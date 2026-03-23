"use server";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

const reportsTable = (Resource as unknown as Record<string, { name: string }>).Reports.name;

export type ReportType = "not_at_pax" | "wrong_booth" | "wrong_info" | "duplicate" | "other";

interface SubmitReportInput {
  gameId: string;
  gameName: string;
  reportType: ReportType;
  description: string | null;
}

export async function submitReport(input: SubmitReportInput): Promise<{ success: boolean }> {
  const timestamp = new Date().toISOString();

  await ddb.send(
    new PutCommand({
      TableName: reportsTable,
      Item: {
        pk: `REPORT#${input.gameId}#${timestamp}`,
        gameId: input.gameId,
        gameName: input.gameName,
        reportType: input.reportType,
        description: input.description || null,
        username: null,
        createdAt: timestamp,
      },
    }),
  );

  return { success: true };
}
