import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProfileData, getReviewsByUser } from "@/app/actions/social";
import { ProfilePage } from "@/components/profile-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `${username}'s Profile — PAX Pal 2026`,
    description: `${username}'s PAX East 2026 recap — games played, watchlist, and reviews.`,
  };
}

export default async function ProfileRoute({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  const [profile, reviews] = await Promise.all([
    getProfileData(username),
    getReviewsByUser(username),
  ]);

  if (!profile) {
    notFound();
  }

  return <ProfilePage profile={profile} reviews={reviews} />;
}
