"use client";

interface QuarterlyScoreboardProps {
  quarters: {
    q1: { away: number; home: number };
    q2: { away: number; home: number };
    q3: { away: number; home: number };
    q4: { away: number; home: number };
    total: { away: number; home: number };
  };
}

export function QuarterlyScoreboard({ quarters }: QuarterlyScoreboardProps) {
  const quarterLabels = [
    { key: "q1", label: "Q1" },
    { key: "q2", label: "Q2" },
    { key: "q3", label: "Q3" },
    { key: "q4", label: "Q4" },
    { key: "total", label: "Total" },
  ];

  return (
    <div className="bg-brand-card border border-brand-card-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-card-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-brand-text-dim uppercase">
                Quarter
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-brand-text-dim uppercase">
                Away
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-brand-text-dim uppercase">
                Home
              </th>
            </tr>
          </thead>
          <tbody>
            {quarterLabels.map(({ key, label }) => {
              const quarter = quarters[key as keyof typeof quarters];
              const isTotal = key === "total";
              return (
                <tr
                  key={key}
                  className={`border-b border-brand-card-border last:border-b-0 ${
                    isTotal ? "bg-brand-dark/50" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-white font-medium">{label}</td>
                  <td className="px-4 py-3 text-right text-white font-semibold">
                    {quarter.away}
                  </td>
                  <td className="px-4 py-3 text-right text-white font-semibold">
                    {quarter.home}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
