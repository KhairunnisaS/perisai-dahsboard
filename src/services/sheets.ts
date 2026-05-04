/// <reference types="vite/client" />
import type { Candidate, FieldOfficer, ProjectMeta } from "../types/index";

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export interface SheetsConfig {
  spreadsheetId: string;
  apiKey: string;
}

type Row = string[];

function cell(row: Row, index: number): string {
  return (row[index] ?? "").toString().trim();
}

function parseBool(raw: string): boolean {
  return raw.toUpperCase() === "TRUE";
}

function formatPhone(raw: string): string {
  if (!raw) return "";
  const cleaned = raw.replace(/\s+/g, "").replace(/\.0$/, "").replace(/\D/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("8")) return "0" + cleaned;
  return cleaned;
}

function formatNumber(raw: string): string {
  if (!raw) return "";
  return raw.replace(/\.0$/, "").replace(/\.00$/, "");
}

function fixRomanInText(text: string): string {
  return text.replace(/\b([ivxlcdmIVXLCDM]+)\b/g, (match) => {
    const upper = match.toUpperCase();
    if (
      /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(upper) &&
      upper.length > 0
    ) return upper;
    return match;
  });
}

async function fetchRange(config: SheetsConfig, range: string): Promise<Row[]> {
  const url = new URL(
    `${SHEETS_BASE}/${config.spreadsheetId}/values/${encodeURIComponent(range)}`
  );
  url.searchParams.set("key", config.apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Sheets API error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return ((json.values as Row[]) ?? []).slice(2); // skip 2 header rows
}

function rowToCandidate(row: Row): Candidate | null {
  const kode        = cell(row, 1);
  const namaKepling = cell(row, 5);
  if (!kode && !namaKepling) return null;

  const namaCalonPerisai = cell(row, 7);
  const displayName      = namaCalonPerisai || namaKepling;
  const isMitra          = !!namaCalonPerisai && namaCalonPerisai.trim() !== namaKepling.trim();

  // Kolom mapping (sheet terbaru):
  // [0]  NO              [1]  KODE          [2]  KECAMATAN
  // [3]  KELURAHAN       [4]  LINGKUNGAN    [5]  NAMA KEPLING
  // [6]  NO HP kepling   [7]  NAMA CALON PERISAI
  // [8]  FORMULIR        [9]  KTP           [10] No NIK KTP
  // [11] KPJ bool        [12] No KPJ        [13] Rekening
  // [14] No Rekening     [15] IJAZAH        [16] LEMBAR QUIZ
  // [17] MATERAI (bool)  [18] EMAIL         [19] No HP calon
  // [20] Tempat tgl lahir [21] ALAMAT
  // [22] PAS PHOTO
  // [23] TTD URL         ← URL langsung file ttd_calon
  // [24] MATERAI URL     ← URL langsung file materai
  // [25] DOKUMEN URL     ← URL langsung file dokumen.pdf
  // [26] KUMPULAN SEMUA BERKAS ← URL folder GDrive (untuk merge)
  // [27] PIC MAGANG
  // [36] KODE PERISAI   (kolom AK)

  const formulirPerisaiBool = parseBool(cell(row, 8));
  const ktp       = parseBool(cell(row, 9));
  const kpj       = parseBool(cell(row, 11));
  const ijazah    = parseBool(cell(row, 15));
  const lembarQuiz = parseBool(cell(row, 16));
  const materaiBool = parseBool(cell(row, 17));
  const pasPhotoRaw = cell(row, 22);
  const pasPhoto  = parseBool(pasPhotoRaw) || (!!pasPhotoRaw && pasPhotoRaw.toLowerCase() !== "false");

  const noNikKtp       = cell(row, 10);
  const noKpj          = formatNumber(cell(row, 12));
  const rekening       = cell(row, 13);
  const noRekening     = formatNumber(cell(row, 14));
  const email          = cell(row, 18);
  const noHpCalon      = formatPhone(cell(row, 19));
  const noHpKepling    = formatPhone(cell(row, 6));
  const phone          = noHpCalon || noHpKepling;
  const tempatTglLahir = cell(row, 20);
  const alamat         = fixRomanInText(cell(row, 21));
  const kelDesa        = cell(row, 3).trim();
  const kecamatan      = cell(row, 2).trim();

  // URL langsung per file
  const ttdUrl      = cell(row, 23);  // URL ttd_calon
  const materaiUrl  = cell(row, 24);  // URL materai
  const dokumenUrl  = cell(row, 25);  // URL dokumen.pdf
  const kumpulanBerkas = cell(row, 25); // Folder GDrive
  const picMagang   = cell(row, 27);

  // Kode perisai
  const kodePerisai    = cell(row, 36);
  const hasPerisaiCode = kodePerisai.length > 2 && /^[A-Z]{2}\d+/.test(kodePerisai);

  // Syarat FORM: nama + NIK + HP + email + alamat + TTD url
  const hasDataForm = !!(displayName && noNikKtp && phone && email && alamat && ttdUrl.startsWith("http"));

  // Syarat PKS: sama dengan form + materai url
  const hasDataPKS = hasDataForm && materaiUrl.startsWith("http");

  // Exam: hanya jika LEMBAR QUIZ = TRUE
  const readyExam = lembarQuiz;

  let status: Candidate["status"] = "pending";
  if (hasPerisaiCode) {
    status = "active";
  } else if (formulirPerisaiBool && ktp && kpj && ijazah && lembarQuiz && materaiBool && pasPhoto) {
    status = "completed";
  }

  return {
    id:               kode || namaKepling,
    name:             displayName,
    namaKepling,
    namaCalonPerisai: namaCalonPerisai || undefined,
    isMitra,
    neighborhood:     cell(row, 4),
    subDistrict:      kelDesa,
    kecamatan,
    phone,
    status,
    kodePerisai:      hasPerisaiCode ? kodePerisai : "",
    picMagang,
    noKTP:            noNikKtp,
    noKPJ:            noKpj,
    rekening,
    noRekening,
    email,
    tempatTglLahir,
    alamat,
    kelDesa,
    namaWadah:        "HERDIANA SIMBOLON",
    jabatanWadah:     "KETUA WADAH",
    namaCabang:       "SAKINAH RAMZA",
    jabatanCabang:    "ARK",
    documents: {
      formulirPerisai: formulirPerisaiBool,
      ktp,
      kpj,
      rekening:        !!rekening && rekening !== "Belum ada",
      ijazah,
      lembarQuiz,
      materai:         materaiBool,
      pasPhoto,
      ttdUrl,
      materaiUrl,
      dokumenUrl,
      kumpulanBerkas,
    },
    readyToPrint: {
      form: hasDataForm,
      pks:  hasDataPKS,
      exam: readyExam,
    },
    assignedOfficerId: picMagang,
    createdAt:         "",
    updatedAt:         "",
  };
}

function computeStats(candidates: Candidate[]): ProjectMeta["stats"] {
  const total   = candidates.length;
  const active  = candidates.filter((c) => c.status === "active").length;
  const pending = total - active;
  const kelurahanSet = new Set(candidates.map((c) => c.subDistrict));
  const totalAreas   = kelurahanSet.size;
  let areasCompleted = 0;
  kelurahanSet.forEach((kel) => {
    const inKel = candidates.filter((c) => c.subDistrict === kel);
    if (inKel.length > 0 && inKel.every((c) => c.status === "active")) areasCompleted++;
  });
  return { totalCandidates: total, activePerisai: active, pendingCandidates: pending, areasCompleted, totalAreas, acquisitionRate: total > 0 ? Math.round((active / total) * 100) : 0 };
}

function extractOfficers(rows: Row[]): FieldOfficer[] {
  const map = new Map<string, FieldOfficer>();
  rows.forEach((row) => {
    const pic  = cell(row, 27);
    const zone = cell(row, 3);
    if (!pic) return;
    if (!map.has(pic)) map.set(pic, { id: pic, name: pic, subDistrict: zone, assignedZones: [], contact: formatPhone(cell(row, 6)) });
    const o = map.get(pic)!;
    if (zone && !o.assignedZones.includes(zone)) o.assignedZones.push(zone);
  });
  return Array.from(map.values());
}

export async function fetchKecamatanList(config: SheetsConfig): Promise<string[]> {
  const rows = await fetchRange(config, "Sheet1!A:C");
  const set  = new Set<string>();
  rows.forEach((row) => { const k = cell(row, 2).trim(); if (k) set.add(k); });
  return Array.from(set).sort();
}

export async function fetchCandidates(config: SheetsConfig, kecamatan?: string): Promise<Candidate[]> {
  const rows = await fetchRange(config, "Sheet1!A:AM");
  const all  = rows.map(rowToCandidate).filter((c): c is Candidate => c !== null);
  if (!kecamatan) return all;
  return all.filter((c) => c.kecamatan.toLowerCase() === kecamatan.toLowerCase());
}

export async function fetchProjectMeta(config: SheetsConfig, kecamatan?: string): Promise<ProjectMeta> {
  const rows         = await fetchRange(config, "Sheet1!A:AM");
  const all          = rows.map(rowToCandidate).filter((c): c is Candidate => c !== null);
  const candidates   = kecamatan ? all.filter((c) => c.kecamatan.toLowerCase() === kecamatan.toLowerCase()) : all;
  const filteredRows = kecamatan ? rows.filter((r) => cell(r, 2).trim().toLowerCase() === kecamatan.toLowerCase()) : rows;
  return {
    id: "perisai-1",
    title: `Perisai Agent Acquisition${kecamatan ? ` - ${kecamatan}` : ""}`,
    description: "Monitoring and managing perisai agent recruitment progress",
    district: kecamatan ?? "",
    status: "active",
    stats: computeStats(candidates),
    fieldOfficers: extractOfficers(filteredRows),
  };
}

export async function fetchOfficers(config: SheetsConfig): Promise<FieldOfficer[]> {
  const rows = await fetchRange(config, "Sheet1!A:AM");
  return extractOfficers(rows);
}