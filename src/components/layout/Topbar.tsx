import { useState, useRef, useEffect } from "react";
import { Bell, Printer } from "lucide-react";
import { getInitials } from "../../lib/utils";
import type { Candidate } from "../../types";

interface NotifSummary {
  kecamatan: string;
  count: number;
  formCount: number;
  pksCount: number;
  examCount: number;
}

function NotifPanel({
  items,
  onClose,
  onMarkSeen,
}: {
  items: NotifSummary[];
  onClose: () => void;
  onMarkSeen: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onMarkSeen();
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, onMarkSeen]);

  const totalCount = items.reduce((sum, i) => sum + i.count, 0);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: "44px",
        right: 0,
        width: "310px",
        maxHeight: "400px",
        background: "#FFFFFF",
        border: "1px solid #D2D3D7",
        borderRadius: "10px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
        zIndex: 100,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 14px 10px",
          borderBottom: "1px solid #F0F0F0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{
          fontFamily: "Poppins, sans-serif",
          fontSize: "12px",
          fontWeight: 600,
          color: "#000",
        }}>
          Notifications
        </span>
        {totalCount > 0 && (
          <span style={{
            fontFamily: "Poppins, sans-serif",
            fontSize: "10px",
            color: "#16A08F",
            fontWeight: 600,
          }}>
            {totalCount} candidate{totalCount > 1 ? "s" : ""} ready
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {items.length === 0 ? (
          <div style={{
            padding: "36px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
          }}>
            <div style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "#F0FBF8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "26px",
            }}>
              🎉
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{
                fontFamily: "Poppins, sans-serif",
                fontSize: "13px",
                fontWeight: 600,
                color: "#000",
                margin: 0,
              }}>
                All caught up!
              </p>
              <p style={{
                fontFamily: "Poppins, sans-serif",
                fontSize: "11px",
                color: "#A7A7A7",
                margin: "4px 0 0",
                lineHeight: 1.5,
              }}>
                No candidates ready to print yet.
              </p>
            </div>
          </div>
        ) : (
          items.map((item) => {
            const parts: string[] = [];
            if (item.formCount > 0) parts.push(`${item.formCount} form`);
            if (item.pksCount  > 0) parts.push(`${item.pksCount} PKS`);
            if (item.examCount > 0) parts.push(`${item.examCount} exam`);
            const desc = parts.join(", ");

            return (
              <div
                key={item.kecamatan}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 14px",
                  borderBottom: "1px solid #F5F5F5",
                  cursor: "default",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#F9FFFE")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "#FEF3C7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Printer size={15} color="#D97706" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontFamily: "Poppins, sans-serif",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#000",
                    margin: 0,
                  }}>
                    {item.count} candidate{item.count > 1 ? "s" : ""} ready to print
                  </p>
                  <p style={{
                    fontFamily: "Poppins, sans-serif",
                    fontSize: "10px",
                    color: "#4A5255",
                    margin: "2px 0 0",
                  }}>
                    {item.kecamatan} · {desc}
                  </p>
                </div>
                <span style={{
                  background: "#F59E0B",
                  color: "#fff",
                  borderRadius: "4px",
                  padding: "2px 7px",
                  fontFamily: "Poppins, sans-serif",
                  fontSize: "9px",
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {item.count}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

interface TopbarProps {
  district: string;
  districtOptions: string[];
  onDistrictChange: (d: string) => void;
  user: { name: string; role: string; avatarUrl?: string };
  candidates?: Candidate[];
  printedIds?: Set<string>;
}

export function Topbar({
  district,
  districtOptions,
  onDistrictChange,
  user,
  candidates = [],
  printedIds = new Set(),
}: TopbarProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [seenIds,   setSeenIds]   = useState<Set<string>>(new Set());

  // Group per kecamatan
  const notifSummary: NotifSummary[] = (() => {
    const map = new Map<string, NotifSummary>();
    candidates.forEach((c) => {
      if (c.status === "active") return;
      if (printedIds.has(c.id)) return;
      const hasReady =
        c.readyToPrint?.form || c.readyToPrint?.pks || c.readyToPrint?.exam;
      if (!hasReady) return;

      const key = c.kecamatan || c.subDistrict;
      if (!map.has(key)) {
        map.set(key, {
          kecamatan: key,
          count:     0,
          formCount: 0,
          pksCount:  0,
          examCount: 0,
        });
      }
      const entry = map.get(key)!;
      entry.count++;
      if (c.readyToPrint?.form) entry.formCount++;
      if (c.readyToPrint?.pks)  entry.pksCount++;
      if (c.readyToPrint?.exam) entry.examCount++;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  })();

  const unseenCount = candidates.filter(
    (c) =>
      c.status !== "active" &&
      !printedIds.has(c.id) &&
      (c.readyToPrint?.form || c.readyToPrint?.pks || c.readyToPrint?.exam) &&
      !seenIds.has(c.id)
  ).length;

  function handleMarkSeen() {
    const allIds = new Set(
      candidates
        .filter(
          (c) =>
            c.status !== "active" &&
            !printedIds.has(c.id) &&
            (c.readyToPrint?.form || c.readyToPrint?.pks || c.readyToPrint?.exam)
        )
        .map((c) => c.id)
    );
    setSeenIds(allIds);
  }

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "12px",
        padding: "12px 24px",
        background: "#FFFFFF",
        borderBottom: "0.5px solid #E5E7EB",
      }}
    >
      {/* Bell */}
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setNotifOpen((v) => !v)}
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "50%",
            background: notifOpen ? "#F0FBF8" : "transparent",
            border: `1px solid ${notifOpen ? "#A8DDD6" : "transparent"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            position: "relative",
          }}
        >
          <Bell size={17} color={unseenCount > 0 ? "#16A08F" : "#4A5255"} />
          {unseenCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: "2px",
                right: "2px",
                minWidth: "16px",
                height: "16px",
                background: "#EF4444",
                borderRadius: "8px",
                border: "2px solid #fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "Poppins, sans-serif",
                fontSize: "9px",
                fontWeight: 700,
                color: "#fff",
                padding: "0 3px",
                lineHeight: 1,
              }}
            >
              {unseenCount > 99 ? "99+" : unseenCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <NotifPanel
            items={notifSummary}
            onClose={() => setNotifOpen(false)}
            onMarkSeen={handleMarkSeen}
          />
        )}
      </div>

      {/* District selector */}
      <select
        value={district}
        onChange={(e) => onDistrictChange(e.target.value)}
        style={{
          border: "1px solid #D2D3D7",
          borderRadius: "8px",
          padding: "5px 10px",
          fontSize: "13px",
          fontFamily: "Poppins, sans-serif",
          fontWeight: 500,
          color: "#4A5255",
          background: "#fff",
          cursor: "pointer",
          outline: "none",
          height: "31px",
        }}
      >
        {districtOptions.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      {/* User */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ textAlign: "right" }}>
          <p style={{
            fontFamily: "Poppins, sans-serif",
            fontSize: "13px",
            fontWeight: 600,
            color: "#000",
            margin: 0,
            lineHeight: 1.2,
          }}>
            {user.name}
          </p>
          <p style={{
            fontFamily: "Poppins, sans-serif",
            fontSize: "9px",
            fontWeight: 500,
            color: "#4A5255",
            margin: 0,
          }}>
            {user.role}
          </p>
        </div>
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name}
            style={{
              width: "31px",
              height: "31px",
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div style={{
            width: "31px",
            height: "31px",
            borderRadius: "50%",
            background: "#16A08F",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontFamily: "Poppins, sans-serif",
            fontSize: "11px",
            fontWeight: 600,
          }}>
            {getInitials(user.name)}
          </div>
        )}
      </div>
    </header>
  );
}