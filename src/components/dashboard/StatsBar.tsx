import type { DistrictStats } from "../../types";
import { formatPercent } from "../../lib/utils";

interface StatItemProps {
  value: string;
  label: string;
  last?: boolean;
}

function StatItem({ value, label, last }: StatItemProps) {
  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center py-3">
        <p
          className="text-black"
          style={{ fontFamily: "Poppins, sans-serif", fontSize: "20px", fontWeight: 600, lineHeight: 1.2 }}
        >
          {value}
        </p>
        <p
          className="text-[#4A5255] text-center mt-0.5 uppercase"
          style={{ fontFamily: "Poppins, sans-serif", fontSize: "9px", fontWeight: 600, letterSpacing: "0.04em" }}
        >
          {label}
        </p>
      </div>
      {!last && (
        <div style={{ width: "1px", backgroundColor: "#D2D3D7", alignSelf: "stretch", margin: "8px 0" }} />
      )}
    </>
  );
}

interface StatsBarProps {
  stats: DistrictStats;
}

export function StatsBar({ stats }: StatsBarProps) {
  const items: Omit<StatItemProps, "last">[] = [
    { value: String(stats.totalCandidates), label: "Total Candidates" },
    { value: String(stats.activePerisai), label: "Active Perisai" },
    { value: String(stats.pendingCandidates), label: "Pending Candidates" },
    { value: `${stats.areasCompleted}/${stats.totalAreas}`, label: "Areas Completed" },
    { value: formatPercent(stats.acquisitionRate), label: "Acquisition Rate" },
  ];

  return (
    <div
      className="flex items-stretch w-full"
      style={{ backgroundColor: "#F4F5F7", borderRadius: "6px" }}
    >
      {items.map((item, idx) => (
        <StatItem key={item.label} {...item} last={idx === items.length - 1} />
      ))}
    </div>
  );
}