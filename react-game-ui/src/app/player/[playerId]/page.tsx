// src/app/player/[playerId]/page.tsx
import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { PlayerPageClient } from "@/components/features/player/PlayerPageClient";
import { fetchPlayerProfile, fetchPlayerStats } from "@/lib/db/players";
// DbPlayerSeasonStats 导入暂时未使用，如后续需要可再打开

interface PlayerPageProps {
  params: Promise<{
    playerId: string;
  }>;
}

/**
 * 动态 metadata：使用球员名字作为标题
 */
export async function generateMetadata(
  { params }: PlayerPageProps,
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { playerId } = await params;
  const profile = await fetchPlayerProfile(playerId);

  if (!profile) {
    return {
      title: "Player Not Found",
    };
  }

  const name = profile.full_name;

  return {
    title: `${name} - Player Profile`,
    description: `Season stats and fantasy profile for ${name}.`,
  };
}

/**
 * Player 详情页 - Server Component
 */
export default async function PlayerPage({ params }: PlayerPageProps) {
  const { playerId } = await params;

  const [profile, stats] = await Promise.all([
    fetchPlayerProfile(playerId),
    fetchPlayerStats(playerId),
  ]);

  if (!profile) {
    notFound();
  }

  return (
    <PlayerPageClient
      initialProfile={profile}
      initialStats={stats}
    />
  );
}