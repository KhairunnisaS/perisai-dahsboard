import { useState, useMemo, useRef, useEffect } from "react";
import { Search, SlidersHorizontal, Check, X } from "lucide-react";
import type { Candidate } from "../../types";
import { CandidateCard, type PrintedDocs } from "./CandidateCard";
import {
  generateFormulir, generatePKS, generateExam, generateMerged,
  previewPdf, lookupKodePos,
} from "../../services/docGenerator";
import type { KeplingPayload } from "../../services/docGenerator";

// Konstanta tetap
const KODE_NAMA_WADAH = "KB00230015 / JOHAN SILAEN YOHANDA";

// Fix angka romawi di string (mis. "Vi" → "VI")
function fixRoman(str: string): string {
  return str.replace(/\b([ivxlcdmIVXLCDM]+)\b/g, (match) => {
    const upper = match.toUpperCase();
    if (/^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(upper) && upper.length > 0) {
      return upper;
    }
    return match;
  });
}

// Build payload untuk backend — kode pos via API menggunakan kecamatan + kelurahan
async function buildPayload(c: Candidate, nomorSurat?: number): Promise<KeplingPayload> {
  // Lookup kodepos: coba kelurahan dulu, fallback ke kecamatan
  const kodePos = await lookupKodePos(c.subDistrict || c.kelDesa, c.kecamatan);

  return {
    namaLengkap:      c.namaKepling,
    namaCalonPerisai: c.namaCalonPerisai || undefined,
    noKTP:            c.noKTP,
    tempatTglLahir:   c.tempatTglLahir,
    noKPJ:            c.noKPJ,
    kodeNamaWadah:    KODE_NAMA_WADAH,
    alamat:           c.alamat,
    kabupatenKota:    "MEDAN",
    kodePos,
    noTelp:           c.phone,
    email:            c.email,
    pekerjaan:        "PERISAI",
    bank:             c.rekening,
    noRek:            c.noRekening,
    namaPemilik:      c.namaCalonPerisai || c.namaKepling,
    ttdUrl:           c.documents.ttdUrl    || undefined,
    materaiUrl:       c.documents.materaiUrl || undefined,
    dokumenUrl:       c.documents.dokumenUrl || undefined,
    nomorSurat,
  };
}

type FilterKey = "mitra" | "readyToPrint" | "incomplete";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "mitra",        label: "Partner"       },
  { key: "readyToPrint", label: "Ready to Print" },
  { key: "incomplete",   label: "Incomplete"     },
];

function isDone(c: Candidate)          { return c.status === "active" || c.status === "completed"; }
function isReadyToPrint(c: Candidate)  { return !isDone(c) && !!(c.readyToPrint?.form || c.readyToPrint?.pks || c.readyToPrint?.exam); }
function isIncomplete(c: Candidate)    { return !isDone(c) && !c.readyToPrint?.form && !c.readyToPrint?.pks && !c.readyToPrint?.exam; }

// ─── Filter Panel ─────────────────────────────────────────────────────────────
function FilterPanel({ activeFilters, onToggle, onClear, onClose }: {
  activeFilters: Set<FilterKey>; onToggle: (k: FilterKey) => void; onClear: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: "absolute", top: "34px", right: 0, width: "190px",
      background: "#fff", border: "1px solid #D2D3D7", borderRadius: "8px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px 8px", borderBottom: "1px solid #F0F0F0" }}>
        <span style={{ fontFamily: "Poppins, sans-serif", fontSize: "11px", fontWeight: 600, color: "#000" }}>Filter</span>
        {activeFilters.size > 0 && (
          <button type="button" onClick={onClear} style={{ fontFamily: "Poppins, sans-serif", fontSize: "10px", color: "#C46B71", background: "none", border: "none", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: "2px" }}>
            <X size={10} /> Reset
          </button>
        )}
      </div>
      {FILTERS.map((opt) => {
        const active = activeFilters.has(opt.key);
        return (
          <button key={opt.key} type="button" onClick={() => onToggle(opt.key)} style={{
            width: "100%", display: "flex", alignItems: "center", gap: "10px",
            padding: "9px 12px", background: active ? "#F2FCFA" : "transparent",
            border: "none", borderBottom: "1px solid #F5F5F5", cursor: "pointer", textAlign: "left",
          }}>
            <div style={{
              width: "15px", height: "15px", borderRadius: "3px", flexShrink: 0,
              border: `1.5px solid ${active ? "#16A08F" : "#D2D3D7"}`,
              background: active ? "#16A08F" : "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {active && <Check size={9} strokeWidth={3} color="#fff" />}
            </div>
            <span style={{ fontFamily: "Poppins, sans-serif", fontSize: "11px", fontWeight: 600, color: "#000" }}>
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} style={{
      width: "129px", height: "28px", borderRadius: "6px", border: "1px solid #DADBDD",
      background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center",
      gap: "7px", cursor: "pointer", outline: "none", userSelect: "none",
    }}>
      <div style={{ position: "relative", width: "28px", height: "16px", borderRadius: "8px", background: active ? "#16A08F" : "#CBD5E0", transition: "background 0.2s", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: "2px", left: active ? "12px" : "2px", width: "12px", height: "12px", borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.25)", transition: "left 0.2s cubic-bezier(0.4,0,0.2,1)" }} />
      </div>
      <span style={{ fontFamily: "Montserrat, sans-serif", fontSize: "11px", fontWeight: 600, color: "#4A5255", letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>
        Hide Complete
      </span>
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function CandidateGrid({
  candidates, onMarkDone, onPrintedIdsChange,
  nomorPKS = 287, onNomorPKSChange,
}: {
  candidates:          Candidate[];
  onMarkDone?:         (id: string) => void;
  onPrintedIdsChange?: (ids: Set<string>) => void;
  nomorPKS?:           number;
  onNomorPKSChange?:   (n: number) => void;
}) {
  const [search,        setSearch]        = useState("");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());
  const [filterOpen,    setFilterOpen]    = useState(false);
  const [printedMap,    setPrintedMap]    = useState<Record<string, PrintedDocs>>({});
  const [loadingMap,    setLoadingMap]    = useState<Record<string, keyof PrintedDocs | null>>({});
  const [preview, setPreview] = useState<{
    candidateId: string; doc: keyof PrintedDocs; url: string; title: string;
  } | null>(null);

  // Tabs kelurahan
  const kelurahanTabs = useMemo(
    () => Array.from(new Set(candidates.map((c) => c.subDistrict.toUpperCase()))).sort(),
    [candidates]
  );
  const [activeTab, setActiveTab] = useState<string>("");
  useEffect(() => {
    if (kelurahanTabs.length > 0 && (!activeTab || !kelurahanTabs.includes(activeTab))) {
      setActiveTab(kelurahanTabs[0]);
    }
  }, [kelurahanTabs, activeTab]);

  // Badge per kelurahan (hanya yang belum semua dicetak)
  const notifByKelurahan = useMemo(() => {
    const map: Record<string, number> = {};
    candidates.forEach((c) => {
      if (!isReadyToPrint(c)) return;
      const pd = printedMap[c.id];
      const allPrinted =
        (!c.readyToPrint?.form || pd?.formulirPerisai) &&
        (!c.readyToPrint?.pks  || pd?.legalContracts) &&
        (!c.readyToPrint?.exam || pd?.exam);
      if (!allPrinted) {
        const key = c.subDistrict.toUpperCase();
        map[key] = (map[key] ?? 0) + 1;
      }
    });
    return map;
  }, [candidates, printedMap]);

  // Teruskan printedIds ke parent (untuk Topbar notif)
  useEffect(() => {
    const printed = new Set(
      Object.entries(printedMap)
        .filter(([, pd]) => pd.formulirPerisai || pd.legalContracts || pd.exam)
        .map(([id]) => id)
    );
    onPrintedIdsChange?.(printed);
  }, [printedMap, onPrintedIdsChange]);

  const visible = useMemo(() => {
    const filtered = candidates.filter((c) => {
      if (c.subDistrict.toUpperCase() !== activeTab) return false;
      if (hideCompleted && isDone(c)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !c.neighborhood.toLowerCase().includes(q)) return false;
      }
      for (const f of activeFilters) {
        if (f === "mitra"        && !c.isMitra)        return false;
        if (f === "readyToPrint" && !isReadyToPrint(c)) return false;
        if (f === "incomplete"   && !isIncomplete(c))  return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) => {
      const score = (c: Candidate) => isReadyToPrint(c) ? 0 : isDone(c) ? 2 : 1;
      return score(a) - score(b);
    });
  }, [candidates, activeTab, search, hideCompleted, activeFilters]);

  function toggleFilter(key: FilterKey) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function markPrinted(candidateId: string, doc: keyof PrintedDocs) {
    setPrintedMap((prev) => ({
      ...prev,
      [candidateId]: {
        ...(prev[candidateId] ?? { formulirPerisai: false, legalContracts: false, exam: false }),
        [doc]: true,
      },
    }));
  }

  // Klik tombol doc → generate preview
  async function handlePrintDoc(candidateId: string, doc: keyof PrintedDocs) {
    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate) return;

    setLoadingMap((prev) => ({ ...prev, [candidateId]: doc }));
    try {
      let url = ""; let title = "";
      const nama = (candidate.namaCalonPerisai || candidate.namaKepling).toUpperCase();

      if (doc === "formulirPerisai") {
        const payload = await buildPayload(candidate);
        payload.materaiUrl = undefined; // <--- TAMBAHKAN BARIS INI
        url   = await previewPdf("/generate/formulir", payload);
        title = `Perisai Form — ${nama}`;
      } else if (doc === "legalContracts") {
        const payload = await buildPayload(candidate, nomorPKS);
        url   = await previewPdf("/generate/pks", payload);
        title = `PKS — ${nama}`;
      } else if (doc === "exam") {
        // Pastikan endpoint "/generate/exam" SAMA dengan di FastAPI
        url   = await previewPdf("/generate/exam", {
          namaCalonPerisai: candidate.namaCalonPerisai || candidate.namaKepling,
          namaKepling:      candidate.namaKepling,
        });
        title = `Exam — ${nama}`;
      }
      if (url) setPreview({ candidateId, doc, url, title });
    } catch (err: unknown) {
      alert(`Failed to generate preview: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingMap((prev) => ({ ...prev, [candidateId]: null }));
    }
  }

  // Konfirmasi preview → download + tandai printed
  async function handlePreviewConfirm(doc: keyof PrintedDocs) {
    if (!preview) return;
    const { candidateId, url } = preview;
    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate) return;

    try {
      if (doc === "formulirPerisai") {
        const payload = await buildPayload(candidate);
        payload.materaiUrl = undefined; // <--- TAMBAHKAN BARIS INI
        await generateFormulir(payload);
        markPrinted(candidateId, "formulirPerisai");
      } else if (doc === "legalContracts") {
        const payload = await buildPayload(candidate, nomorPKS);
        await generatePKS(payload);
        onNomorPKSChange?.(nomorPKS + 1);
        markPrinted(candidateId, "legalContracts");
      } else if (doc === "exam") {
        await generateExam(
          candidate.namaCalonPerisai || candidate.namaKepling,
          candidate.namaKepling
        );
        markPrinted(candidateId, "exam");
      }
    } catch (err: unknown) {
      alert(`Failed to download: ${err instanceof Error ? err.message : String(err)}`);
    }
    URL.revokeObjectURL(url);
  }

  async function handleMerge(candidateId: string) {
    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate?.documents.dokumenUrl) {
      alert("No GDrive folder found for this candidate.");
      return;
    }
    try {
      await generateMerged(
        candidate.documents.dokumenUrl,
        candidate.namaCalonPerisai || candidate.namaKepling
      );
    } catch (err: unknown) {
      alert(`Failed to merge files: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const filterLabel = activeFilters.size === 0
    ? "Filters"
    : Array.from(activeFilters).map((k) => FILTERS.find((f) => f.key === k)!.label).join(", ").slice(0, 18) + (activeFilters.size > 1 ? `…` : "");

  if (kelurahanTabs.length === 0) return null;

  return (
    <section>
      {/* Tabs kelurahan */}
      <div style={{ display: "flex", borderBottom: "1px solid #D7D8DC", marginBottom: "16px" }}>
        {kelurahanTabs.map((tab) => {
          const isActive = activeTab === tab;
          const notif    = notifByKelurahan[tab] ?? 0;
          return (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} style={{
              display: "flex", alignItems: "center", gap: "5px",
              padding: "10px 16px", marginBottom: "-1px",
              fontFamily: "Poppins, sans-serif", fontSize: "12px", fontWeight: 600,
              color: isActive ? "#16A08F" : "#4A5255",
              background: "none", border: "none",
              borderBottom: `2px solid ${isActive ? "#16A08F" : "transparent"}`,
              cursor: "pointer", whiteSpace: "nowrap", transition: "color 0.15s",
            }}>
              {fixRoman(tab)}
              {notif > 0 && (
                <span style={{
                  background: isActive ? "#16A08F" : "#E0E0E0",
                  color: isActive ? "#fff" : "#4A5255",
                  borderRadius: "10px", padding: "1px 6px",
                  fontSize: "9px", fontWeight: 700,
                }}>
                  {notif}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "14px", fontWeight: 500, color: "#000", margin: 0 }}>
          <span style={{ fontWeight: 600 }}>{visible.length}</span> perisai candidates
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Search */}
          <div style={{ width: "191px", height: "28px", borderRadius: "6px", background: "#E2EAED", display: "flex", alignItems: "center", gap: "6px", padding: "0 10px" }}>
            <Search size={13} color="#4A5255" style={{ flexShrink: 0 }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" style={{ background: "transparent", border: "none", outline: "none", fontFamily: "Montserrat, sans-serif", fontSize: "11px", color: "#4A5255", width: "100%" }} />
            {search && <button type="button" onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={11} color="#4A5255" /></button>}
          </div>
          <Toggle active={hideCompleted} onToggle={() => setHideCompleted((v) => !v)} />
          {/* Filter */}
          <div style={{ position: "relative" }}>
            <button type="button" onClick={() => setFilterOpen((v) => !v)} style={{
              height: "28px", padding: "0 10px", borderRadius: "6px",
              border: `1px solid ${activeFilters.size > 0 ? "#16A08F" : "#DADBDD"}`,
              background: activeFilters.size > 0 ? "#EEF9F7" : "#fff",
              display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", maxWidth: "140px",
            }}>
              <SlidersHorizontal size={12} color={activeFilters.size > 0 ? "#16A08F" : "#4A5255"} style={{ flexShrink: 0 }} />
              <span style={{ fontFamily: "Montserrat, sans-serif", fontSize: "10px", fontWeight: 600, color: activeFilters.size > 0 ? "#16A08F" : "#4A5255", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {filterLabel}
              </span>
            </button>
            {filterOpen && (
              <FilterPanel activeFilters={activeFilters} onToggle={toggleFilter} onClear={() => setActiveFilters(new Set())} onClose={() => setFilterOpen(false)} />
            )}
          </div>
        </div>
      </div>

      {/* Grid */}
      {visible.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          {visible.map((c) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              onMarkDone={onMarkDone}
              onPrintDoc={handlePrintDoc}
              onMerge={handleMerge}
              printedDocs={printedMap[c.id]}
              loadingDoc={loadingMap[c.id] ?? null}
              previewData={
                preview && preview.candidateId === c.id
                  ? { url: preview.url, doc: preview.doc, title: preview.title }
                  : null
              }
              onPreviewConfirm={handlePreviewConfirm}
              onPreviewClose={() => { if (preview) URL.revokeObjectURL(preview.url); setPreview(null); }}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 0", gap: "8px" }}>
          <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "13px", color: "#A7A7A7", margin: 0 }}>No candidates found.</p>
          {(search || hideCompleted || activeFilters.size > 0) && (
            <button type="button" onClick={() => { setSearch(""); setHideCompleted(false); setActiveFilters(new Set()); }} style={{ fontFamily: "Poppins, sans-serif", fontSize: "11px", color: "#16A08F", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
              Reset all filters
            </button>
          )}
        </div>
      )}
    </section>
  );
}