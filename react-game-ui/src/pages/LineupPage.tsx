import { useState } from 'react';
import { Header } from '../components/layout/Header';
import { BasketballCourt } from '../components/lineup/BasketballCourt';
import { PlayerCard } from '../components/lineup/PlayerCard';
import type { Player } from '../types';

// Mock data - replace with actual API call later
const mockPlayers: Player[] = [
  {
    id: '1',
    name: 'LeBron James',
    team: 'Lakers',
    position: 'PG',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC6K0_V8nhygXQEzvIP_ZkjbwZT-zu_-vA6x15eKrQ9rJpLC7AnjPpq-Gm_zQxGkoN3zn50uk4uk2C9-OETBVW-44LYw3bvpYJBLoD1UvEbQdwZewXakeEKXk4LWRl7gkrfAwPyFtKMOVlTa01HDBCru7V1E2VToLb3qvxLAb779mKgHeH1CiAjawsoMU3OnSoRrnmBuDVth_x5hP-t0O5D8dUSx4M0vDca2BvulAzUxeeJj7mW0fTZbxmdjYb2jLOw86pXiwSniS8',
    ppg: 25.4,
    rpg: 7.9,
    teamLogo:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAtezuJI9853VbCUZLoB1Vr9uZ2TlnPIw5Q9YUfBanuD50qdHm9QuFlnwhPINAFHqJ9doMS8FjeT0wFMDRN9rYA53DENZGZktqkJkGitqVKHklslxGRXE9l2Oy-ZetowYlWkmi0mVSttT9cpYe6hK4Kp1LWWxstdRyECF-n9zOyCs2DXuGwulJBYrTUoCP7brSmWULoI0awbDE4oYBw0TRk1_kv2w9xedUaFmYcPZuCzsH5O68TxMseHJUErzoQZ1LuOLtMmKQPbzs',
  },
  {
    id: '2',
    name: 'Raboit Grund',
    team: 'Likers',
    position: 'SG',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAMvsyVHVUmDVytbyXtmxDO6z7-_YmYlNYNCgrt3dX5fL0ZtdlPqLHoCb5xuC2QW2EnmP9GWfRXy6XQxb5UWl9jEwG2Nfk8KCl9_NMn0NgOKoPSXwVb-2b7o-WPQJRjlTsavgqZCLGnYjkDI_8AxK3SoIqmDcCdGIpkZYcIdmuR0546gc9eIJOR1foR0SGl4vquEXKdSEgQhwWNGrJKiwzKRCGe84M0poNCfD8DgHXjDfvdvNoHpHY0DrEoXIYQogt_ddcqdQWdzCw',
    ppg: 25.4,
    rpg: 7.9,
    teamLogo:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAfwDFSibFm-lVpAs-CbEH2QQ7vYnBsXkSZMP1Fmrr6eUvfqC2JFoUHVZwlQpo9LAV8ffl2ae0H1hvDGhIntEiZg-5Z6QOCtTJK0BROVYgFx5r13bphSAOIyKOIBy8D2gBaY1Vp0Du6Fip0zdrdFk1Y3e7x3uaca0YkTLQ4PkFSvvvpmv-TO1_k9VEFeNCCPwb_06e1H7CD-SX3754gQyY9GdYTSMjYasiTyS8Nm31upC5tF9jD43sN1U07RNtFI696tO8U6g21qb8',
  },
  {
    id: '3',
    name: 'Jinn Kawney',
    team: 'Wayers',
    position: 'SF',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAMvsyVHVUmDVytbyXtmxDO6z7-_YmYlNYNCgrt3dX5fL0ZtdlPqLHoCb5xuC2QW2EnmP9GWfRXy6XQxb5UWl9jEwG2Nfk8KCl9_NMn0NgOKoPSXwVb-2b7o-WPQJRjlTsavgqZCLGnYjkDI_8AxK3SoIqmDcCdGIpkZYcIdmuR0546gc9eIJOR1foR0SGl4vquEXKdSEgQhwWNGrJKiwzKRCGe84M0poNCfD8DgHXjDfvdvNoHpHY0DrEoXIYQogt_ddcqdQWdzCw',
    ppg: 25.4,
    rpg: 7.9,
    teamLogo:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAbpWMI8-NBx97UBiduqidbdeurNl4Yp_nOh676A2YgsuxZ-rRKGQjUmTSbkrL0eriPgqYeqlBb2A5QOi1GJe2MvTqrrnsvlzSeMJuAdSqQX_kRui2hhMpx_4RFg0pk1ttL1CqLT_Z8NJDJzBGpRJpQiObvWX_fwsJ0hKDfnS1IYRoiVAlKe1rYekBhpfAgxr5uf0g7uswtCT7S9HYySKIDRrqK2XEGI8MJN92c0_HXJbvZFZkuLxgNYV23ZiodEJY5juZbYEucwnM',
  },
  {
    id: '4',
    name: 'Blavel Chela',
    team: 'Winsons',
    position: 'PF',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC6K0_V8nhygXQEzvIP_ZkjbwZT-zu_-vA6x15eKrQ9rJpLC7AnjPpq-Gm_zQxGkoN3zn50uk4uk2C9-OETBVW-44LYw3bvpYJBLoD1UvEbQdwZewXakeEKXk4LWRl7gkrfAwPyFtKMOVlTa01HDBCru7V1E2VToLb3qvxLAb779mKgHeH1CiAjawsoMU3OnSoRrnmBuDVth_x5hP-t0O5D8dUSx4M0vDca2BvulAzUxeeJj7mW0fTZbxmdjYb2jLOw86pXiwSniS8',
    ppg: 25.4,
    rpg: 7.9,
    teamLogo:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAmfjtKN9EqkyoFW6u22GkOdVjH0kw-W-DIOIcYRy-8na7U-TKDQwAwWHxft1sApEUDpO9OcDseCHJolei6TQ100hmcRDGNu5lHch97l4hPKdIop3aFYCYozugba2fFzPKbWFMEeI6DFIUw5D_WTkicjSubrTkQOo0-_fZ9VU0Eyr58ftM4G53ati-C0vR_EUEwKwmgkiBe0mpSIH7w1S7D49Cr8TTjc6XxztWHDqRX8EHj_-5As450QjV_WX1w6ZXn1xTa6pkS7xg',
  },
];

export function LineupPage() {
  const [lineup, setLineup] = useState<{
    PG?: Player;
    SG?: Player;
    SF?: Player;
    PF?: Player;
    C?: Player;
  }>({});
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<
    'PG' | 'SG' | 'SF' | 'PF' | 'C' | null
  >(null);

  const handlePlayerSelect = (player: Player) => {
    if (selectedPosition) {
      setLineup((prev) => ({
        ...prev,
        [selectedPosition]: player,
      }));
      setSelectedPosition(null);
    } else {
      // Auto-select first available position
      const availablePositions: Array<'PG' | 'SG' | 'SF' | 'PF' | 'C'> = [
        'PG',
        'SG',
        'SF',
        'PF',
        'C',
      ];
      const emptyPosition = availablePositions.find((pos) => !lineup[pos]);
      if (emptyPosition) {
        setLineup((prev) => ({
          ...prev,
          [emptyPosition]: player,
        }));
      }
    }
    setSelectedPlayerId(player.id);
  };

  const handleSlotClick = (position: 'PG' | 'SG' | 'SF' | 'PF' | 'C') => {
    setSelectedPosition(position);
    // Remove player from this position if clicking on occupied slot
    if (lineup[position]) {
      setLineup((prev) => {
        const newLineup = { ...prev };
        delete newLineup[position];
        return newLineup;
      });
    }
  };

  const selectedCount = Object.keys(lineup).length;

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col relative overflow-hidden">
      <Header title="My Lineup Selection" showBack showSettings />

      <main className="flex-1 overflow-y-auto pt-[60px] pb-[90px]">
        {/* Basketball Court */}
        <section className="px-4 pt-4">
          <div className="bg-brand-dark/60 backdrop-blur-sm rounded-xl p-3">
            <BasketballCourt lineup={lineup} onSlotClick={handleSlotClick} />
          </div>
        </section>

        {/* Player Selection Prompt */}
        <section className="mt-4 px-4">
          <h2 className="text-xl font-bold text-center text-white">
            Select <span className="text-brand-blue">5 Players</span> for Today
            {selectedCount > 0 && (
              <span className="ml-2 text-brand-text-dim">
                ({selectedCount}/5)
              </span>
            )}
          </h2>

          {/* Player Cards Grid */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            {mockPlayers.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                isActive={selectedPlayerId === player.id}
                onSelect={handlePlayerSelect}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
