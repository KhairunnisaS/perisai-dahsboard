import { useState, useRef, useEffect } from "react";
import { MoreVertical, FileText, FileSignature, ClipboardCheck, FolderOpen, Layers, X, Download } from "lucide-react";
import type { Candidate } from "../../types/index";
import { getInitials } from "../../lib/utils";

type DocState = "incomplete" | "ready" | "printed";

export interface PrintedDocs {
  formulirPerisai: boolean;
  legalContracts: boolean;
  exam: boolean;
}

// ─── Preview Modal ────────────────────────────────────────────────────────────
function PreviewModal({
  pdfUrl,
  title,
  onConfirm,
  onClose,
}: {
  pdfUrl: string;
  title: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.55)",
      zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#fff",
        borderRadius: "14px",
        width: "min(860px, 96vw)",
        height: "min(90vh, 840px)",
        display: "flex", flexDirection: "column",
        boxShadow: "0 24px 64px rgba(0,0,0,0.28)",
        overflow: "hidden",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: "1px solid #E5E7EB",
        }}>
          <span style={{ fontFamily: "Poppins, sans-serif", fontSize: "13px", fontWeight: 600, color: "#000" }}>
            Preview — {title}
          </span>
          <button type="button" onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer", padding: "2px",
          }}>
            <X size={17} color="#4A5255" />
          </button>
        </div>

        <iframe
          src={pdfUrl}
          style={{ flex: 1, border: "none", width: "100%" }}
          title="Preview dokumen"
        />

        <div style={{
          display: "flex", gap: "10px", justifyContent: "flex-end",
          padding: "12px 18px", borderTop: "1px solid #E5E7EB",
        }}>
          <button type="button" onClick={onClose} style={{
            height: "36px", padding: "0 18px",
            border: "1px solid #D2D3D7", borderRadius: "8px",
            background: "#fff", cursor: "pointer",
            fontFamily: "Poppins, sans-serif", fontSize: "12px", fontWeight: 600, color: "#4A5255",
          }}>
            Cancel
          </button>
          <button type="button" onClick={() => { onConfirm(); onClose(); }} style={{
            height: "36px", padding: "0 20px",
            border: "1px solid #16A08F", borderRadius: "8px",
            background: "#16A08F", cursor: "pointer",
            fontFamily: "Poppins, sans-serif", fontSize: "12px", fontWeight: 700, color: "#fff",
            display: "flex", alignItems: "center", gap: "6px",
          }}>
            <Download size={13} /> Download
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Context Menu — hanya Merge Files ─────────────────────────────────────────
function ContextMenu({
  candidate,
  onMerge,
  onClose,
}: {
  candidate: Candidate;
  onMerge: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const canMerge = !!candidate.documents.kumpulanBerkas;

  return (
    <div ref={ref} style={{
      position: "absolute", top: "28px", right: 0,
      width: "170px",
      background: "#fff", border: "1px solid #D2D3D7",
      borderRadius: "9px", boxShadow: "0 8px 28px rgba(0,0,0,0.14)",
      zIndex: 200, overflow: "hidden",
    }}>
      {/* Merge Files — satu-satunya opsi */}
      <button
        type="button"
        disabled={!canMerge}
        onClick={() => { if (canMerge) { onMerge(); onClose(); } }}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: "9px",
          padding: "11px 14px", border: "none",
          background: "transparent", cursor: canMerge ? "pointer" : "not-allowed",
          textAlign: "left",
          opacity: canMerge ? 1 : 0.45,
          transition: "background 0.12s",
        }}
        onMouseEnter={(e) => canMerge && (e.currentTarget.style.background = "#F2FCFA")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <Layers size={14} color="#16A08F" />
        <div>
          <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "11px", fontWeight: 600, color: "#000", margin: 0 }}>
            Merge Files
          </p>
          {!canMerge && (
            <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "9px", color: "#A7A7A7", margin: 0 }}>
              No GDrive folder
            </p>
          )}
        </div>
      </button>
    </div>
  );
}

// ─── Doc Button ───────────────────────────────────────────────────────────────
interface DocButtonProps {
  icon: React.ElementType;
  label: string;
  state: DocState;
  loading?: boolean;
  onClick?: () => void;
}

function DocButton({ icon: Icon, label, state, loading, onClick }: DocButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const colors: Record<DocState, { bg: string; border: string; color: string }> = {
    incomplete: {
      bg:     hovered ? "#F0F1F2" : "#FAFAFA",
      border: hovered ? "#B0B5B7" : "#D2D3D7",
      color:  "#4A5255",
    },
    ready: {
      bg:     pressed ? "#FEF3C7" : hovered ? "#FEF9EE" : "#FFFBEB",
      border: pressed ? "#B45309" : hovered ? "#D97706" : "#F59E0B",
      color:  "#D97706",
    },
    printed: {
      bg:     hovered ? "#E4F6F3" : "#EEF9F7",
      border: "#16A08F",
      color:  "#16A08F",
    },
  };

  const c = colors[state];
  const isClickable = state !== "incomplete" && !loading;
  const dotColor = state === "printed" ? "#16A08F" : state === "ready" ? "#F59E0B" : null;

  return (
    <button
      type="button"
      disabled={!isClickable}
      onClick={isClickable ? onClick : undefined}
      onMouseEnter={() => isClickable && setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => isClickable && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        border: `1.5px solid ${c.border}`,
        borderRadius: "10px",
        background: c.bg,
        cursor: isClickable ? "pointer" : "default",
        height: "80px",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "7px",
        padding: "10px 8px",
        transition: "transform 0.1s ease, box-shadow 0.12s ease, background 0.12s ease, border-color 0.12s ease",
        boxShadow: pressed
          ? "0 1px 2px rgba(0,0,0,0.06)"
          : hovered && isClickable ? "0 4px 12px rgba(0,0,0,0.10)" : "0 1px 3px rgba(0,0,0,0.05)",
        transform: pressed ? "scale(0.96)" : hovered && isClickable ? "translateY(-2px)" : "scale(1)",
        outline: "none",
        userSelect: "none",
        position: "relative",
      }}
    >
      {dotColor && !loading && (
        <span style={{
          position: "absolute", top: "7px", right: "7px",
          width: "6px", height: "6px", borderRadius: "50%",
          background: dotColor,
        }} />
      )}
      {loading ? (
        <span style={{
          width: "18px", height: "18px", border: "2px solid #F59E0B",
          borderTopColor: "transparent", borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
          display: "inline-block",
        }} />
      ) : (
        <Icon size={20} strokeWidth={1.6} color={c.color} />
      )}
      <span style={{
        fontFamily: "Poppins, sans-serif", fontSize: "11px",
        fontWeight: 600, color: loading ? "#D97706" : c.color,
        textAlign: "center", lineHeight: 1.25,
      }}>
        {loading ? "Loading…" : label}
      </span>
    </button>
  );
}

// ─── Kode Perisai Panel ───────────────────────────────────────────────────────
function KodePerisaiPanel({ kode }: { kode: string }) {
  return (
    <div style={{
      background: "#F0FBF8",
      border: "1.5px solid #A8DDD6",
      borderRadius: "10px",
      padding: "24px 12px",
      display: "flex", flexDirection: "column",
      alignItems: "center", gap: "10px", flex: 1,
    }}>
      <p style={{
        fontFamily: "Poppins, sans-serif", fontSize: "11px",
        fontWeight: 600, color: "#16A08F",
        textTransform: "uppercase", letterSpacing: "0.1em", margin: 0,
      }}>
        Perisai Code
      </p>
      <p style={{
        fontFamily: "Montserrat, sans-serif", fontSize: "30px",
        fontWeight: 700, color: "#0D7A6B",
        letterSpacing: "0.12em", margin: 0, lineHeight: 1, textAlign: "center",
      }}>
        {kode}
      </p>
    </div>
  );
}

// ─── Mark as Done ─────────────────────────────────────────────────────────────
function MarkDoneButton({ done, onClick }: { done: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const bg     = done ? "#F0FBF8" : pressed ? "#FAE8E9" : hovered ? "#FFF0F1" : "#FFFFFF";
  const color  = done ? "#16A08F" : "#C46B71";
  const border = done ? "#A8DDD6" : pressed ? "#C46B71" : hovered ? "#D97A80" : "#E8C4C6";
  return (
    <button
      type="button"
      disabled={done}
      onClick={onClick}
      onMouseEnter={() => !done && setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => !done && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        width: "100%", height: "38px", borderRadius: "8px",
        border: `1.5px solid ${border}`, background: bg,
        cursor: done ? "default" : "pointer",
        fontFamily: "Montserrat, sans-serif", fontSize: "12px",
        fontWeight: 700, color,
        transition: "all 0.13s ease",
        boxShadow: !done && hovered && !pressed ? "0 2px 8px rgba(196,107,113,0.18)" : "none",
        transform: pressed ? "scale(0.98)" : "scale(1)",
        outline: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: "6px", userSelect: "none", flexShrink: 0,
      }}
    >
      {done ? "Active Perisai" : "Mark as Done"}
    </button>
  );
}

function getDocState(ready: boolean, printed: boolean): DocState {
  if (printed) return "printed";
  if (ready)   return "ready";
  return "incomplete";
}

// ─── Candidate Card ───────────────────────────────────────────────────────────
export interface CandidateCardProps {
  candidate: Candidate;
  onMarkDone?: (id: string) => void;
  onPrintDoc?: (id: string, doc: keyof PrintedDocs) => void;
  onMerge?: (id: string) => void;
  printedDocs?: PrintedDocs;
  loadingDoc?: keyof PrintedDocs | null;
  previewData?: { url: string; doc: keyof PrintedDocs; title: string } | null;
  onPreviewConfirm?: (doc: keyof PrintedDocs) => void;
  onPreviewClose?: () => void;
}

export function CandidateCard({
  candidate,
  onMarkDone,
  onPrintDoc,
  onMerge,
  printedDocs = { formulirPerisai: false, legalContracts: false, exam: false },
  loadingDoc,
  previewData,
  onPreviewConfirm,
  onPreviewClose,
}: CandidateCardProps) {
  const { id, name, neighborhood, documents, status, kodePerisai, isMitra, readyToPrint } = candidate;
  const isActive    = status === "active";
  const isDone      = isActive || status === "completed";
  const formReady   = !!readyToPrint?.form;
  const legalReady  = !!readyToPrint?.pks;
  const examReady   = !!readyToPrint?.exam;
  const isReadyToPrint = !isActive && (formReady || legalReady || examReady);

  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const borderColor = hovered
    ? isActive ? "#7ECDC5" : isReadyToPrint ? "#D97706" : "#AADDD8"
    : isActive ? "#A8DDD6" : isReadyToPrint ? "#F59E0B" : "#D2D3D7";
  const cardBg = isActive ? "#F9FFFE" : isReadyToPrint ? "#FFFDF5" : "#FFFFFF";

  // ── Handler GDrive — buka link di tab baru ────────────────────────────────
  const handleGDriveClick = () => {
    const url = documents.kumpulanBerkas;
    if (url && url.startsWith("http")) {
      // Buka link GDrive langsung di tab baru, bukan navigasi internal
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const hasGDrive = !!(documents.kumpulanBerkas && documents.kumpulanBerkas.startsWith("http"));

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {previewData && (
        <PreviewModal
          pdfUrl={previewData.url}
          title={previewData.title}
          onConfirm={() => onPreviewConfirm?.(previewData.doc)}
          onClose={() => onPreviewClose?.()}
        />
      )}

      <article
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          borderRadius: "12px",
          background: cardBg,
          borderTop:    `1px solid ${borderColor}`,
          borderRight:  `1px solid ${borderColor}`,
          borderBottom: `1px solid ${borderColor}`,
          borderLeft:   isReadyToPrint && !isActive ? "4px solid #F59E0B" : `1px solid ${borderColor}`,
          padding: "14px",
          display: "flex", flexDirection: "column", gap: "10px",
          transition: "border-color 0.18s ease, box-shadow 0.18s ease",
          boxShadow: hovered
            ? `0 6px 20px rgba(${isActive ? "22,160,143" : isReadyToPrint ? "245,158,11" : "0,0,0"}, 0.10)`
            : "0 1px 4px rgba(0,0,0,0.05)",
          position: "relative",
        }}
      >
        {/* Mitra badge */}
        {isMitra && (
          <span style={{
            position: "absolute", top: "10px", right: "30px",
            background: "#EEF2FF", border: "1px solid #818CF8",
            borderRadius: "4px", padding: "1px 5px",
            fontFamily: "Poppins, sans-serif", fontSize: "8px",
            fontWeight: 700, color: "#4F46E5",
          }}>PARTNER</span>
        )}

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "40px", height: "40px", borderRadius: "50%",
              background: isActive ? "#16A08F" : isReadyToPrint ? "#D97706" : "#8BA3AB",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: "13px", fontWeight: 700, flexShrink: 0,
            }}>
              {getInitials(name)}
            </div>
            <div>
              <p style={{
                fontFamily: "Poppins, sans-serif", fontSize: "13px",
                fontWeight: 700, color: "#000", lineHeight: 1.2, margin: 0,
              }}>
                {name}
              </p>
              <p style={{
                fontFamily: "Montserrat, sans-serif", fontSize: "9px",
                fontWeight: 600, color: "#4A5255", margin: "3px 0 0",
              }}>
                Neighborhood {neighborhood}
              </p>
            </div>
          </div>

          {/* Titik tiga — hanya Merge Files, tidak ada Open Folder */}
          {!isActive && (
            <div style={{ position: "relative", marginTop: isMitra ? "14px" : "0" }}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                style={{
                  color: "#4A5255", background: "none", border: "none",
                  cursor: "pointer", padding: "2px",
                }}
              >
                <MoreVertical size={15} />
              </button>
              {menuOpen && (
                <ContextMenu
                  candidate={candidate}
                  onMerge={() => onMerge?.(id)}
                  onClose={() => setMenuOpen(false)}
                />
              )}
            </div>
          )}
        </div>

        {/* Content */}
        {isActive && kodePerisai ? (
          <KodePerisaiPanel kode={kodePerisai} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <DocButton
              icon={FileText}
              label="Perisai Form"
              state={getDocState(formReady, printedDocs.formulirPerisai)}
              loading={loadingDoc === "formulirPerisai"}
              onClick={() => onPrintDoc?.(id, "formulirPerisai")}
            />
            <DocButton
              icon={FileSignature}
              label="Legal Contracts"
              state={getDocState(legalReady, printedDocs.legalContracts)}
              loading={loadingDoc === "legalContracts"}
              onClick={() => onPrintDoc?.(id, "legalContracts")}
            />
            <DocButton
              icon={ClipboardCheck}
              label="Exam"
              state={getDocState(examReady, printedDocs.exam)}
              loading={loadingDoc === "exam"}
              onClick={() => onPrintDoc?.(id, "exam")}
            />
            {/* GDrive Folder — klik buka link GDrive di tab baru */}
            <DocButton
              icon={FolderOpen}
              label="GDrive Folder"
              state={hasGDrive ? "printed" : "incomplete"}
              onClick={hasGDrive ? handleGDriveClick : undefined}
            />
          </div>
        )}

        <MarkDoneButton done={isDone} onClick={() => onMarkDone?.(id)} />
      </article>
    </>
  );
}