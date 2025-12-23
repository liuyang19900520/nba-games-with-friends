'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { BasketballCourt } from '@/components/lineup/BasketballCourt';
import { PlayerCard } from '@/components/lineup/PlayerCard';
import type { Player } from '@/types';

interface LineupPageClientProps {
  players: Player[];
}

type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';
type LineupState = Partial<Record<Position, Player>>;

/**
 * Lineup 页面客户端组件
 *
 * 使用 React 19 的 useOptimistic 实现乐观更新：
 * - 用户选择球员时立即更新 UI，无需等待服务器响应
 * - 在 Step 5 实现 Server Actions 后，这里会调用实际的保存操作
 *
 * 处理用户交互和游戏状态管理。
 * 接收从 Server Component 传递的球员数据。
 */
export function LineupPageClient({ players }: LineupPageClientProps) {
  // 实际状态（最终会同步到服务器）
  const [lineup, setLineup] = useState<LineupState>({});

  // React 19 Optimistic UI: 乐观状态，立即反映用户操作
  const [optimisticLineup, updateOptimisticLineup] = useOptimistic(
    lineup,
    (currentState: LineupState, newState: LineupState) => {
      // 合并新状态，乐观更新
      return { ...currentState, ...newState };
    }
  );

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [isPending, startTransition] = useTransition();

  /**
   * 处理球员选择 - 使用乐观更新
   * 
   * TODO: 在 Step 5 中，这里会调用 Server Action 保存到数据库
   */
  const handlePlayerSelect = (player: Player) => {
    startTransition(() => {
      let newLineup: LineupState;

      if (selectedPosition) {
        // 如果已选择位置，直接放置
        newLineup = {
          ...lineup,
          [selectedPosition]: player,
        };
      } else {
        // 自动选择第一个可用位置
        const availablePositions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
        const emptyPosition = availablePositions.find((pos) => !lineup[pos]);
        if (emptyPosition) {
          newLineup = {
            ...lineup,
            [emptyPosition]: player,
          };
        } else {
          // 所有位置已满，不更新
          return;
        }
      }

      // 乐观更新：立即显示在 UI 上
      updateOptimisticLineup(newLineup);

      // 实际状态更新（未来会同步到服务器）
      setLineup(newLineup);
      setSelectedPosition(null);
      setSelectedPlayerId(player.id);

      // TODO: Step 5 - 调用 Server Action
      // await saveLineupAction(newLineup);
    });
  };

  const handleSlotClick = (position: Position) => {
    setSelectedPosition(position);
    // Remove player from this position if clicking on occupied slot
    if (optimisticLineup[position]) {
      startTransition(() => {
        const newLineup = { ...optimisticLineup };
        delete newLineup[position];

        // 乐观更新
        updateOptimisticLineup(newLineup);

        // 实际状态更新
        setLineup(newLineup);
      });
    }
  };

  const selectedCount = Object.keys(optimisticLineup).length;

  return (
    <>
      {/* Basketball Court - 使用乐观状态 */}
      <section className="px-4 pt-4">
        <div className="bg-brand-dark/60 backdrop-blur-sm rounded-xl p-3">
          <BasketballCourt
            lineup={optimisticLineup}
            onSlotClick={handleSlotClick}
            isPending={isPending}
          />
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
          {isPending && (
            <span className="ml-2 text-xs text-brand-text-dim animate-pulse">
              (saving...)
            </span>
          )}
        </h2>

        {/* Player Cards Grid */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          {players.map((player, index) => (
            <PlayerCard
              key={player.id}
              player={player}
              isActive={selectedPlayerId === player.id}
              onSelect={handlePlayerSelect}
              priority={index < 4} // 前4个球员使用 priority 加载
            />
          ))}
        </div>
      </section>
    </>
  );
}
