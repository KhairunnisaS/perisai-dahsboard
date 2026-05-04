import { useState, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Sidebar } from "./components/layout/Sidebar";
import { Topbar } from "./components/layout/Topbar";
import { DashboardPage } from "./components/dashboard/DashboardPage";
import { fetchKecamatanList, fetchCandidates, type SheetsConfig } from "./services/sheets";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

const sheetsConfig: SheetsConfig = {
  spreadsheetId: import.meta.env.VITE_SHEETS_ID as string,
  apiKey:        import.meta.env.VITE_SHEETS_API_KEY as string,
};

const CURRENT_USER = { name: "Khairunnisa", role: "Admin" };

function AppInner() {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [printedIds, setPrintedIds] = useState<Set<string>>(new Set());
  const handlePrintedIdsChange = useCallback((ids: Set<string>) => setPrintedIds(new Set(ids)), []);

  const { data: kecamatanList = [] } = useQuery({
    queryKey:  ["kecamatanList"],
    queryFn:   () => fetchKecamatanList(sheetsConfig),
    staleTime: 1000 * 60 * 10,
  });

  const { data: candidates = [] } = useQuery({
    queryKey:  ["candidates", selectedDistrict],
    queryFn:   () => fetchCandidates(sheetsConfig, selectedDistrict),
    enabled:   !!selectedDistrict,
    staleTime: 1000 * 60 * 2,
  });

  useEffect(() => {
    if (kecamatanList.length > 0 && !selectedDistrict) {
      setSelectedDistrict(kecamatanList[0]);
    }
  }, [kecamatanList, selectedDistrict]);

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      overflow: "hidden",
      backgroundColor: "#F2F3F7",
      fontFamily: "Poppins, sans-serif",
    }}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
      />

      <div style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minWidth: 0,
        overflow: "hidden",
      }}>
        <Topbar
          district={selectedDistrict}
          districtOptions={kecamatanList}
          onDistrictChange={setSelectedDistrict}
          user={CURRENT_USER}
          candidates={candidates}
          printedIds={printedIds}
        />

        <div style={{ flex: 1, overflowY: "auto" }}>
          {selectedDistrict ? (
            <DashboardPage district={selectedDistrict} onPrintedIdsChange={handlePrintedIdsChange} />
          ) : (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              fontFamily: "Poppins, sans-serif",
              fontSize: "13px",
              color: "#A7A7A7",
            }}>
              {kecamatanList.length === 0
                ? "Loading district data..."
                : "Select a district to continue"
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  );
}