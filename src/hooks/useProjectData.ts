/// <reference types="vite/client" />
import { useQuery } from "@tanstack/react-query";
import {
  fetchCandidates,
  fetchKecamatanList,
  fetchProjectMeta,
  type SheetsConfig,
} from "../services/sheets";

const sheetsConfig: SheetsConfig = {
  spreadsheetId: import.meta.env.VITE_SHEETS_ID as string,
  apiKey: import.meta.env.VITE_SHEETS_API_KEY as string,
};

export const queryKeys = {
  projectMeta: (kecamatan?: string) => ["projectMeta", kecamatan ?? "all"] as const,
  candidates: (kecamatan?: string) => ["candidates", kecamatan ?? "all"] as const,
  kecamatanList: ["kecamatanList"] as const,
};

export function useKecamatanList() {
  return useQuery({
    queryKey: queryKeys.kecamatanList,
    queryFn: () => fetchKecamatanList(sheetsConfig),
    staleTime: 1000 * 60 * 10,
  });
}

export function useProjectMeta(kecamatan?: string) {
  return useQuery({
    queryKey: queryKeys.projectMeta(kecamatan),
    queryFn: () => fetchProjectMeta(sheetsConfig, kecamatan),
    staleTime: 1000 * 60 * 5,
    enabled: !!kecamatan,
  });
}

export function useCandidates(kecamatan?: string) {
  return useQuery({
    queryKey: queryKeys.candidates(kecamatan),
    queryFn: () => fetchCandidates(sheetsConfig, kecamatan),
    staleTime: 1000 * 60 * 2,
    enabled: !!kecamatan,
  });
}