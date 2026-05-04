import { useState, useCallback } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { useProjectMeta, useCandidates } from "../../hooks/useProjectData";
import { StatsBar } from "./StatsBar";
import { FieldOfficerRow } from "./FieldOfficerRow";
import { CandidateGrid } from "../candidates/CandidateGrid";
import successIcon from "../../assets/success.png";

interface DashboardPageProps {
  district: string;
  onPrintedIdsChange?: (ids: Set<string>) => void;
}

export function DashboardPage({ district, onPrintedIdsChange }: DashboardPageProps) {
  const { data: project, isLoading: projectLoading, error: projectError } =
    useProjectMeta(district);
  const { data: candidates = [], isLoading: candidatesLoading } =
    useCandidates(district);

  const [districtComplete, setDistrictComplete] = useState(false);

  // PKS nomor — persisted ke localStorage
  const [nomorPKS, setNomorPKS] = useState<number>(() => {
    const saved = localStorage.getItem("perisai_nomor_pks");
    return saved ? parseInt(saved, 10) : 287;
  });

  function updateNomorPKS(n: number) {
    setNomorPKS(n);
    localStorage.setItem("perisai_nomor_pks", String(n));
  }

  const handlePrintedIdsChange = useCallback(
    (ids: Set<string>) => {
      onPrintedIdsChange?.(ids);
    },
    [onPrintedIdsChange]
  );

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2 text-red-500 text-sm p-8">
        <AlertCircle size={20} />
        <p className="font-bold">Failed to load project</p>
        <p className="text-xs text-gray-500 text-center break-all">
          {projectError ? String(projectError) : "project is null/undefined"}
        </p>
        <p className="text-xs text-gray-400">
          SHEETS_ID: {import.meta.env.VITE_SHEETS_ID ? "✓" : "✗ missing"}
        </p>
        <p className="text-xs text-gray-400">
          API_KEY: {import.meta.env.VITE_SHEETS_API_KEY ? "✓" : "✗ missing"}
        </p>
      </div>
    );
  }

  return (
    <main
      className="flex-1 overflow-y-auto p-6"
      style={{ backgroundColor: "#F2F3F7" }}
    >
      {/* Page header */}
      <div className="flex items-center gap-4 mb-1">
        <h1
          style={{
            fontFamily: "Poppins, sans-serif",
            fontSize: "20px",
            fontWeight: 600,
            color: "#000",
          }}
        >
          Perisai Agent Acquisition — {district} District
        </h1>

        {/* Complete button */}
        <button
          type="button"
          onClick={() => setDistrictComplete((v) => !v)}
          className="flex items-center gap-2 shrink-0"
          style={{
            height: "30px",
            borderRadius: "6px",
            border: districtComplete ? "1px solid #16A08F" : "1px solid #D2D3D7",
            padding: "0 12px",
            background: districtComplete ? "#E8F5F3" : "#fff",
            transition: "all 0.2s",
            cursor: "pointer",
          }}
        >
          <img
            src={successIcon}
            alt="complete"
            style={{
              width: "15px",
              height: "15px",
              filter: districtComplete
                ? "invert(52%) sepia(57%) saturate(400%) hue-rotate(130deg) brightness(90%)"
                : "invert(30%) sepia(0%) saturate(0%) brightness(60%)",
              transition: "filter 0.2s",
            }}
          />
          <span
            style={{
              fontFamily: "Poppins, sans-serif",
              fontSize: "11px",
              fontWeight: 600,
              color: districtComplete ? "#16A08F" : "#4A5255",
            }}
          >
            Complete
          </span>
        </button>
      </div>

      <p
        className="mb-3"
        style={{
          fontFamily: "Montserrat, sans-serif",
          fontSize: "13px",
          fontWeight: 500,
          color: "#4A5255",
        }}
      >
        {project.description}
      </p>

      {/* PKS Number UI */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "10px",
          background: "#fff",
          border: "1px solid #D2D3D7",
          borderRadius: "8px",
          padding: "6px 14px",
          marginBottom: "16px",
        }}
      >
        <span
          style={{
            fontFamily: "Poppins, sans-serif",
            fontSize: "11px",
            fontWeight: 600,
            color: "#4A5255",
          }}
        >
          PKS No.
        </span>
        <span
          style={{
            fontFamily: "Montserrat, sans-serif",
            fontSize: "13px",
            fontWeight: 700,
            color: "#000",
            minWidth: "90px",
          }}
        >
          {nomorPKS}/V/2026
        </span>
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            type="button"
            onClick={() => updateNomorPKS(Math.max(1, nomorPKS - 1))}
            title="Decrease"
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "5px",
              border: "1px solid #D2D3D7",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#4A5255",
              lineHeight: 1,
            }}
          >
            −
          </button>
          <button
            type="button"
            onClick={() => updateNomorPKS(nomorPKS + 1)}
            title="Increase"
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "5px",
              border: "1px solid #D2D3D7",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#4A5255",
              lineHeight: 1,
            }}
          >
            +
          </button>
          <button
            type="button"
            title="Edit manually"
            onClick={() => {
              const input = window.prompt(
                "Set PKS number:",
                String(nomorPKS)
              );
              if (input && !isNaN(parseInt(input, 10))) {
                updateNomorPKS(parseInt(input, 10));
              }
            }}
            style={{
              height: "26px",
              padding: "0 10px",
              borderRadius: "5px",
              border: "1px solid #D2D3D7",
              background: "#fff",
              cursor: "pointer",
              fontSize: "10px",
              fontWeight: 600,
              color: "#4A5255",
              fontFamily: "Poppins, sans-serif",
            }}
          >
            Edit
          </button>
        </div>
      </div>

      {/* Stats + Field Officers */}
      <div
        className="bg-white mb-5"
        style={{ borderRadius: "10px", padding: "16px" }}
      >
        <StatsBar stats={project.stats} />
        <FieldOfficerRow candidates={candidates} />
      </div>

      {/* Candidates */}
      {candidatesLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-8">
          <Loader2 size={15} className="animate-spin" />
          Loading candidates…
        </div>
      ) : (
        <CandidateGrid
          candidates={candidates}
          onPrintedIdsChange={handlePrintedIdsChange}
          nomorPKS={nomorPKS}
          onNomorPKSChange={updateNomorPKS}
        />
      )}
    </main>
  );
}