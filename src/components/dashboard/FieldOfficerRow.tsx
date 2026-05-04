import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import type { Candidate, FieldOfficer } from "../../types";
import { getInitials } from "../../lib/utils";

const DUMMY_OFFICERS: FieldOfficer[] = [
  { id: "1", name: "Salmawana Pasaribu", subDistrict: "Tegal Sari Mandala II", assignedZones: ["VI", "IX"], contact: "081234567890" },
  { id: "2", name: "Dewi Lestari", subDistrict: "Hamdan", assignedZones: ["I", "II", "III", "IV"], contact: "085282286656" },
  { id: "3", name: "Rina Marlina", subDistrict: "Aur", assignedZones: ["I", "II"], contact: "082198765432" },
];

// Konversi angka romawi ke integer untuk sorting & range detection
const ROMAN: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5,
  VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
  XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15,
};
const TO_ROMAN: Record<number, string> = Object.fromEntries(
  Object.entries(ROMAN).map(([k, v]) => [v, k])
);

function compressZones(zones: string[]): string {
  if (zones.length === 0) return "—";

  // Sort by numeric value
  const nums = zones
    .map((z) => ROMAN[z.toUpperCase()])
    .filter(Boolean)
    .sort((a, b) => a - b);

  if (nums.length === 0) return zones.join(" ");

  // Group consecutive numbers into ranges
  const ranges: string[] = [];
  let start = nums[0];
  let end = nums[0];

  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === end + 1) {
      end = nums[i];
    } else {
      ranges.push(start === end ? `[${TO_ROMAN[start]}]` : `[${TO_ROMAN[start]}-${TO_ROMAN[end]}]`);
      start = nums[i];
      end = nums[i];
    }
  }
  ranges.push(start === end ? `[${TO_ROMAN[start]}]` : `[${TO_ROMAN[start]}-${TO_ROMAN[end]}]`);

  return ranges.join(" ");
}

function useOutsideClick(ref: React.RefObject<HTMLElement | null>, callback: () => void) {
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) callback();
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [ref, callback]);
}

function SimpleDropdown({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false));

  return (
    <div className="flex flex-col relative" ref={ref}>
      <span style={{ fontFamily: "Poppins, sans-serif", fontSize: "9px", fontWeight: 600, color: "#4A5255", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 hover:opacity-80 mt-1"
      >
        <span style={{ fontFamily: "Montserrat, sans-serif", fontSize: "12px", fontWeight: 600, color: "#000" }}>
          {selected || "—"}
        </span>
        <ChevronDown size={11} className="text-[#4A5255]" />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 bg-white shadow-lg z-50 py-1"
          style={{ borderRadius: "6px", border: "1px solid #D2D3D7", minWidth: "180px" }}
        >
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => { onSelect(o); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 hover:bg-gray-50"
              style={{
                fontFamily: "Poppins, sans-serif",
                fontSize: "10px",
                fontWeight: selected === o ? 600 : 500,
                color: selected === o ? "#16A08F" : "#4A5255",
              }}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface FieldOfficerRowProps {
  candidates: Candidate[];
}

export function FieldOfficerRow({ candidates }: FieldOfficerRowProps) {
  const kelurahanList = useMemo(() =>
    Array.from(new Set(candidates.map((c) => c.subDistrict))).sort(),
    [candidates]
  );

  const lingkunganByKelurahan = useMemo(() => {
    const map: Record<string, string[]> = {};
    candidates.forEach((c) => {
      if (!map[c.subDistrict]) map[c.subDistrict] = [];
      if (c.neighborhood && !map[c.subDistrict].includes(c.neighborhood)) {
        map[c.subDistrict].push(c.neighborhood);
      }
    });
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => (ROMAN[a.toUpperCase()] ?? 99) - (ROMAN[b.toUpperCase()] ?? 99));
    });
    return map;
  }, [candidates]);

  const [selectedOfficer, setSelectedOfficer] = useState<FieldOfficer>(DUMMY_OFFICERS[0]);
  const [officerOpen, setOfficerOpen] = useState(false);
  const [selectedKelurahan, setSelectedKelurahan] = useState<string>("");
  const officerRef = useRef<HTMLDivElement>(null);
  useOutsideClick(officerRef, () => setOfficerOpen(false));

  useEffect(() => {
    if (kelurahanList.length > 0 && !selectedKelurahan) {
      setSelectedKelurahan(kelurahanList[0]);
    }
  }, [kelurahanList, selectedKelurahan]);

  const zonesForKelurahan = lingkunganByKelurahan[selectedKelurahan] ?? [];
  const zonesDisplay = compressZones(zonesForKelurahan);

  return (
    <div className="mt-3">
      {/* Label baris pertama */}
      <p style={{ fontFamily: "Montserrat, sans-serif", fontSize: "11px", fontWeight: 600, color: "#000", marginBottom: "8px" }}>
        Field Officers
      </p>

      {/* Baris kedua — mirror 5 kolom StatsBar */}
      <div className="flex items-center w-full">

        {/* Kolom 1: Avatar + dropdown — sejajar "Total Candidates" */}
        <div className="flex-1 flex items-center justify-center">
          <div className="relative" ref={officerRef}>
            <button
              type="button"
              onClick={() => setOfficerOpen((v) => !v)}
              className="flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              <div
                className="rounded-full bg-[#16A08F] flex items-center justify-center text-white"
                style={{ width: "38px", height: "38px", fontSize: "13px", fontWeight: 600, flexShrink: 0 }}
              >
                {getInitials(selectedOfficer.name)}
              </div>
              <ChevronDown size={12} className="text-[#4A5255]" />
            </button>

            {officerOpen && (
              <div
                className="absolute top-full left-0 mt-1 bg-white shadow-lg z-50 py-1"
                style={{ borderRadius: "6px", border: "1px solid #D2D3D7", minWidth: "190px" }}
              >
                {DUMMY_OFFICERS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => { setSelectedOfficer(o); setOfficerOpen(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
                    style={{
                      fontFamily: "Poppins, sans-serif",
                      fontSize: "10px",
                      fontWeight: selectedOfficer.id === o.id ? 600 : 500,
                      color: selectedOfficer.id === o.id ? "#16A08F" : "#4A5255",
                    }}
                  >
                    <div
                      className="rounded-full bg-[#16A08F] flex items-center justify-center text-white shrink-0"
                      style={{ width: "22px", height: "22px", fontSize: "9px", fontWeight: 600 }}
                    >
                      {getInitials(o.name)}
                    </div>
                    {o.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Kolom 2: Nama — sejajar "Active Perisai" */}
        <div className="flex-1 flex items-center justify-center">
          <span style={{ fontFamily: "Montserrat, sans-serif", fontSize: "13px", fontWeight: 600, color: "#000" }}>
            {selectedOfficer.name}
          </span>
        </div>

        {/* Kolom 3: Sub-district — sejajar "Pending Candidates" */}
        <div className="flex-1 flex items-center justify-center">
          <SimpleDropdown
            label="Sub-district"
            options={kelurahanList}
            selected={selectedKelurahan}
            onSelect={setSelectedKelurahan}
          />
        </div>

        {/* Kolom 4: Assigned Zones — sejajar "Areas Completed" */}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col">
            <span style={{ fontFamily: "Poppins, sans-serif", fontSize: "9px", fontWeight: 600, color: "#4A5255", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Assigned Zones
            </span>
            <span className="mt-1" style={{ fontFamily: "Montserrat, sans-serif", fontSize: "12px", fontWeight: 600, color: "#000" }}>
              {zonesDisplay}
            </span>
          </div>
        </div>

        {/* Kolom 5: Contact — sejajar "Acquisition Rate" */}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col">
            <span style={{ fontFamily: "Poppins, sans-serif", fontSize: "9px", fontWeight: 600, color: "#4A5255", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Contact
            </span>
            <span className="mt-1" style={{ fontFamily: "Montserrat, sans-serif", fontSize: "12px", fontWeight: 600, color: "#000" }}>
              {selectedOfficer.contact}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}