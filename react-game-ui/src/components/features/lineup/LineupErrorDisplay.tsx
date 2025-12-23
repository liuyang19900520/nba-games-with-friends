import { PlayerFetchError } from '@/lib/db/players';

interface LineupErrorDisplayProps {
  error: unknown;
}

/**
 * 错误显示组件
 *
 * 显示详细的错误信息，帮助用户诊断 Supabase 配置问题。
 */
export function LineupErrorDisplay({ error }: LineupErrorDisplayProps) {
  const isPlayerFetchError = error instanceof PlayerFetchError;

  return (
    <div className="px-4 py-6">
      <div className="bg-red-500/10 border-2 border-red-500/50 rounded-xl p-6">
        <h2 className="text-xl font-bold text-red-400 mb-4">数据获取失败</h2>

        {isPlayerFetchError ? (
          <div className="space-y-4">
            <div>
              <p className="text-red-300 font-semibold mb-2">错误信息:</p>
              <p className="text-white">{error.message}</p>
            </div>

            {error.code && (
              <div>
                <p className="text-red-300 font-semibold mb-2">错误代码:</p>
                <code className="text-white bg-red-500/20 px-2 py-1 rounded">
                  {error.code}
                </code>
              </div>
            )}

            {error.details && (
              <div>
                <p className="text-red-300 font-semibold mb-2">详细信息:</p>
                <pre className="text-sm text-white bg-red-500/20 p-3 rounded overflow-auto">
                  {JSON.stringify(error.details, null, 2)}
                </pre>
              </div>
            )}

            {/* 诊断建议 */}
            <div className="mt-6 pt-4 border-t border-red-500/30">
              <p className="text-red-300 font-semibold mb-2">诊断步骤:</p>
              <ol className="list-decimal list-inside space-y-2 text-white text-sm">
                {error.code === 'MISSING_ENV_VARS' && (
                  <>
                    <li>检查 <code className="bg-red-500/20 px-1 rounded">.env.local</code> 文件是否存在</li>
                    <li>确认文件中包含 <code className="bg-red-500/20 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> 和 <code className="bg-red-500/20 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code></li>
                    <li>重启开发服务器（环境变量更改需要重启）</li>
                  </>
                )}
                {error.code === 'SUPABASE_QUERY_ERROR' && (
                  <>
                    <li>检查 Supabase 项目是否正常运行</li>
                    <li>确认 <code className="bg-red-500/20 px-1 rounded">player_season_stats</code> 表存在</li>
                    <li>确认 <code className="bg-red-500/20 px-1 rounded">players</code> 和 <code className="bg-red-500/20 px-1 rounded">teams</code> 表存在</li>
                    <li>检查 RLS (Row Level Security) 策略是否允许匿名访问</li>
                    <li>查看 Supabase Dashboard 的 API 日志获取更多信息</li>
                  </>
                )}
                <li>查看浏览器控制台和服务器日志获取完整错误堆栈</li>
              </ol>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-white mb-2">未知错误:</p>
            <pre className="text-sm text-white bg-red-500/20 p-3 rounded overflow-auto">
              {error instanceof Error ? error.stack : String(error)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
