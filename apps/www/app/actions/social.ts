"use server";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { generateObject } from "ai";
import { Resource } from "sst";
import { z } from "zod";

import { getModel } from "@/lib/ai";
import { generateRecoveryPhrase } from "@/lib/recovery-words";

// ---------------------------------------------------------------------------
// DynamoDB setup
// ---------------------------------------------------------------------------

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

const usersTable = (Resource as unknown as Record<string, { name: string }>).Users.name;
const reviewsTable = (Resource as unknown as Record<string, { name: string }>).Reviews.name;
const profilesTable = (Resource as unknown as Record<string, { name: string }>).Profiles.name;

// ---------------------------------------------------------------------------
// Username actions
// ---------------------------------------------------------------------------

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;

interface ClaimResult {
  success: true;
  username: string;
  secretToken: string;
  recoveryPhrase: string;
}

interface ClaimError {
  success: false;
  error: "taken" | "invalid";
}

export async function claimUsername(username: string): Promise<ClaimResult | ClaimError> {
  const trimmed = username.trim().toLowerCase();
  if (!USERNAME_RE.test(trimmed)) {
    return { success: false, error: "invalid" };
  }

  const secretToken = crypto.randomUUID();
  const recoveryPhrase = generateRecoveryPhrase();

  try {
    await ddb.send(
      new PutCommand({
        TableName: usersTable,
        Item: {
          pk: `USER#${trimmed}`,
          username: trimmed,
          secretToken,
          recoveryPhrase,
          createdAt: new Date().toISOString(),
        },
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "name" in err &&
      err.name === "ConditionalCheckFailedException"
    ) {
      return { success: false, error: "taken" };
    }
    throw err;
  }

  return { success: true, username: trimmed, secretToken, recoveryPhrase };
}

interface RecoverResult {
  success: true;
  username: string;
  secretToken: string;
  recoveryPhrase: string;
}

interface RecoverError {
  success: false;
  error: "not_found";
}

export async function recoverUsername(phrase: string): Promise<RecoverResult | RecoverError> {
  const normalized = phrase.trim().toLowerCase().replace(/\s+/g, "-");

  const result = await ddb.send(
    new QueryCommand({
      TableName: usersTable,
      IndexName: "byRecovery",
      KeyConditionExpression: "recoveryPhrase = :phrase",
      ExpressionAttributeValues: { ":phrase": normalized },
      Limit: 1,
    }),
  );

  const item = result.Items?.[0];
  if (!item) {
    return { success: false, error: "not_found" };
  }

  return {
    success: true,
    username: item.username as string,
    secretToken: item.secretToken as string,
    recoveryPhrase: item.recoveryPhrase as string,
  };
}

// ---------------------------------------------------------------------------
// Review actions
// ---------------------------------------------------------------------------

interface SubmitReviewInput {
  gameSlug: string;
  gameName: string;
  username: string;
  secretToken: string;
  rating: number;
  comment: string;
}

type SubmitReviewResult =
  | { success: true }
  | { success: false; error: "auth" | "moderation"; message: string };

export async function submitReview(input: SubmitReviewInput): Promise<SubmitReviewResult> {
  // Verify token
  const userResult = await ddb.send(
    new GetCommand({
      TableName: usersTable,
      Key: { pk: `USER#${input.username}` },
    }),
  );

  if (!userResult.Item || userResult.Item.secretToken !== input.secretToken) {
    return {
      success: false,
      error: "auth",
      message: "Invalid credentials. Try recovering your username.",
    };
  }

  // Moderate comment
  if (input.comment) {
    const allowed = await moderateComment(input.comment);
    if (!allowed) {
      return {
        success: false,
        error: "moderation",
        message:
          "Hey, go easy \u2014 this is a public and family-friendly event! Try rephrasing your review.",
      };
    }
  }

  const timestamp = new Date().toISOString();

  await ddb.send(
    new PutCommand({
      TableName: reviewsTable,
      Item: {
        pk: `GAME#${input.gameSlug}`,
        sk: `REVIEW#${input.username}`,
        gameSlug: input.gameSlug,
        gameName: input.gameName,
        username: input.username,
        rating: input.rating,
        comment: input.comment,
        createdAt: timestamp,
      },
    }),
  );

  return { success: true };
}

// ---------------------------------------------------------------------------
// Comment moderation
// ---------------------------------------------------------------------------

async function moderateComment(comment: string): Promise<boolean> {
  try {
    const result = await generateObject({
      model: getModel(),
      schema: z.object({
        allowed: z
          .boolean()
          .describe("Whether the comment is appropriate for a family-friendly gaming convention"),
        reason: z.string().nullable().describe("Brief reason if rejected"),
      }),
      prompt: `You are a content moderator for PAX East, a family-friendly gaming convention app.

Evaluate if this user review is appropriate for a public, all-ages audience.

REJECT: hate speech, slurs, profanity, personal attacks, sexually explicit content, threats.
ALLOW: mild frustration ("this game was hard"), honest criticism ("controls felt clunky"), enthusiasm, humor, gaming slang.

Be lenient — only reject clearly inappropriate content. Honest negative reviews are fine.

Review: "${comment}"`,
    });
    return result.object.allowed;
  } catch {
    // If moderation fails, allow the comment through rather than blocking users
    return true;
  }
}

// ---------------------------------------------------------------------------
// Fetch reviews
// ---------------------------------------------------------------------------

export interface GameReview {
  username: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export async function getReviewsForGame(gameSlug: string): Promise<GameReview[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: reviewsTable,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": `GAME#${gameSlug}` },
    }),
  );

  if (!result.Items) return [];

  return result.Items.filter((item) => item.comment)
    .map((item) => ({
      username: item.username as string,
      rating: item.rating as number,
      comment: item.comment as string,
      createdAt: item.createdAt as string,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---------------------------------------------------------------------------
// Profile data sync
// ---------------------------------------------------------------------------

export interface ProfileGameEntry {
  name: string;
  slug: string;
  imageUrl: string | null;
  boothId: string | null;
  type: string;
  exhibitor: string;
}

export interface ProfileWatchlistEntry extends ProfileGameEntry {
  addedAt: string;
}

export interface ProfilePlayedEntry extends ProfileGameEntry {
  playedAt: string;
  rating: number | null;
  comment: string | null;
}

export interface ProfileData {
  username: string;
  watchlist: Record<string, ProfileWatchlistEntry>;
  played: Record<string, ProfilePlayedEntry>;
  updatedAt: string;
}

export async function syncProfileData(input: {
  username: string;
  secretToken: string;
  watchlist: Record<string, ProfileWatchlistEntry>;
  played: Record<string, ProfilePlayedEntry>;
}): Promise<{ success: boolean }> {
  // Verify token
  const userResult = await ddb.send(
    new GetCommand({
      TableName: usersTable,
      Key: { pk: `USER#${input.username}` },
    }),
  );

  if (!userResult.Item || userResult.Item.secretToken !== input.secretToken) {
    return { success: false };
  }

  await ddb.send(
    new PutCommand({
      TableName: profilesTable,
      Item: {
        pk: `PROFILE#${input.username}`,
        username: input.username,
        watchlist: input.watchlist,
        played: input.played,
        updatedAt: new Date().toISOString(),
      },
    }),
  );

  return { success: true };
}

export async function getProfileData(username: string): Promise<ProfileData | null> {
  const result = await ddb.send(
    new GetCommand({
      TableName: profilesTable,
      Key: { pk: `PROFILE#${username}` },
    }),
  );

  if (!result.Item) return null;

  return {
    username: result.Item.username as string,
    watchlist: (result.Item.watchlist as Record<string, ProfileWatchlistEntry>) ?? {},
    played: (result.Item.played as Record<string, ProfilePlayedEntry>) ?? {},
    updatedAt: result.Item.updatedAt as string,
  };
}

export interface UserReview {
  gameSlug: string;
  gameName: string;
  username: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export async function getReviewsByUser(username: string): Promise<UserReview[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: reviewsTable,
      IndexName: "byUser",
      KeyConditionExpression: "username = :u",
      ExpressionAttributeValues: { ":u": username },
      ScanIndexForward: false,
    }),
  );

  if (!result.Items) return [];

  return result.Items.filter((item) => item.comment).map((item) => ({
    gameSlug: item.gameSlug as string,
    gameName: item.gameName as string,
    username: item.username as string,
    rating: item.rating as number,
    comment: item.comment as string,
    createdAt: item.createdAt as string,
  }));
}

// ---------------------------------------------------------------------------
// Delete review
// ---------------------------------------------------------------------------

export async function deleteReview(input: {
  gameSlug: string;
  username: string;
  secretToken: string;
}): Promise<{ success: boolean; message?: string }> {
  // Verify token
  const userResult = await ddb.send(
    new GetCommand({
      TableName: usersTable,
      Key: { pk: `USER#${input.username}` },
    }),
  );

  if (!userResult.Item || userResult.Item.secretToken !== input.secretToken) {
    return { success: false, message: "Invalid credentials." };
  }

  await ddb.send(
    new DeleteCommand({
      TableName: reviewsTable,
      Key: {
        pk: `GAME#${input.gameSlug}`,
        sk: `REVIEW#${input.username}`,
      },
    }),
  );

  return { success: true };
}
