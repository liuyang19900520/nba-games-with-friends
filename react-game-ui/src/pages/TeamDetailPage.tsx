import { useParams } from 'react-router-dom';

import { Header } from '@/components/layout/Header';
import { TeamDetailView } from '@/components/team/TeamDetailView';
import { useTeamRoster } from '@/hooks/useTeamRoster';

export function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();

  const numericTeamId = teamId ? Number.parseInt(teamId, 10) : null;

  const { teamDetail, loading, error } = useTeamRoster({
    teamId: numericTeamId,
    enabled: numericTeamId !== null && !Number.isNaN(numericTeamId),
  });

  if (loading) {
    return (
      <div className="flex flex-col h-full max-w-md mx-auto">
        <Header title="Team Roster & Stats" showBack showSearch />
        <div className="flex-1 overflow-y-auto pt-[60px] pb-4">
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-brand-text-dim">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !teamDetail) {
    return (
      <div className="flex flex-col h-full max-w-md mx-auto">
        <Header title="Team Roster & Stats" showBack showSearch />
        <div className="flex-1 overflow-y-auto pt-[60px] pb-4">
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-brand-text-dim">
              {error?.message || 'Team not found'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-md mx-auto">
      <Header title="Team Roster & Stats" showBack showSearch />
      <div className="flex-1 overflow-y-auto pt-[60px] pb-4">
        <TeamDetailView team={teamDetail} />
      </div>
    </div>
  );
}

