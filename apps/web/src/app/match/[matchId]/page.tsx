import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MatchPageClient } from "@/components/features/match/MatchPageClient";
import { MatchPageSkeleton } from "@/components/features/match/MatchPageSkeleton";
import { fetchMatchDetail } from "@/lib/db/matches";

interface MatchPageProps {
  params: Promise<{
    matchId: string;
  }>;
}

export async function generateMetadata(
  { params }: MatchPageProps,
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { matchId } = await params;

  try {
    const match = await fetchMatchDetail(matchId);

    if (!match) {
      return {
        title: "Match Not Found | NBA Game",
        description: "The match you are looking for could not be found.",
      };
    }

    const title = `${match.awayTeam.name} @ ${match.homeTeam.name} | NBA Game`;

    return {
      title,
      description: `View detailed stats and information for ${match.awayTeam.name} vs ${match.homeTeam.name}.`,
    };
  } catch {
    return {
      title: "Match Detail | NBA Game",
      description: "View detailed match statistics and player performance.",
    };
  }
}

/**
 * Match Detail Page - Server Component
 */
export default async function MatchPage({ params }: MatchPageProps) {
  const { matchId } = await params;

  const match = await fetchMatchDetail(matchId);

  if (!match) {
    notFound();
  }

  return (
    <Suspense fallback={<MatchPageSkeleton />}>
      <MatchPageClient match={match} />
    </Suspense>
  );
}
