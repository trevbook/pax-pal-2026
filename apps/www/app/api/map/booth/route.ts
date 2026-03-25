import { NextResponse } from "next/server";
import { getGamesByBooth } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const boothId = searchParams.get("id");

  if (!boothId) {
    return NextResponse.json([], { status: 400 });
  }

  const games = await getGamesByBooth(boothId);
  return NextResponse.json(games, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
