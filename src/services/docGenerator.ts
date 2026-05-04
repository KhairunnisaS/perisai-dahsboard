const BACKEND = "http://127.0.0.1:8000";

export interface KeplingPayload {
  namaLengkap:      string;
  namaCalonPerisai?: string;
  noKTP:            string;
  tempatTglLahir:   string;
  noKPJ:            string;
  kodeNamaWadah:    string;
  alamat:           string;
  kabupatenKota:    string;
  kodePos?:         string;
  kelurahan?:       string;
  kecamatan?:       string;
  noTelp:           string;
  email:            string;
  pekerjaan:        string;
  noNPWP?:          string;
  bank:             string;
  noRek:            string;
  namaPemilik:      string;
  namaWadah?:       string;
  jabatanWadah?:    string;
  namaCabang?:      string;
  jabatanCabang?:   string;
  // URL langsung per file (bukan folder)
  ttdUrl?:          string;   // URL file ttd_calon
  materaiUrl?:      string;   // URL file materai
  dokumenUrl?:      string;   // URL file dokumen.pdf (untuk merge)
  nomorSurat?:      number;
}

export async function lookupKodePos(kelurahan: string, kecamatan?: string): Promise<string> {
  try {
    const params = new URLSearchParams({ kelurahan: kelurahan.trim() });
    if (kecamatan) params.set("kecamatan", kecamatan);
    const res = await fetch(`${BACKEND}/kodepos?${params}`);
    if (res.ok) {
      const data = await res.json();
      if (data.kodePos) return data.kodePos;
    }
  } catch { /* fallback */ }
  try {
    const res = await fetch(`https://kodepos.vercel.app/search/?q=${encodeURIComponent(kelurahan.trim())}`);
    if (!res.ok) return "";
    const data = await res.json();
    const results: Array<{ postalcode: string; subdistrict?: string }> = data?.data ?? data ?? [];
    if (!Array.isArray(results) || !results.length) return "";
    if (kecamatan) {
      const kecLower = kecamatan.toLowerCase().replace(/[^a-z\s]/g, "");
      const match = results.find((r) =>
        (r.subdistrict ?? "").toLowerCase().replace(/[^a-z\s]/g, "").includes(kecLower)
      );
      if (match?.postalcode) return match.postalcode;
    }
    return results[0]?.postalcode ?? "";
  } catch { return ""; }
}

async function fetchPdf(endpoint: string, payload: object): Promise<Blob> {
  const res = await fetch(`${BACKEND}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  return res.blob();
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function previewPdf(endpoint: string, payload: object): Promise<string> {
  const blob = await fetchPdf(endpoint, payload);
  return URL.createObjectURL(blob);
}

export async function generateFormulir(data: KeplingPayload) {
  const nama = (data.namaCalonPerisai || data.namaLengkap).replace(/ /g, "_").toUpperCase();
  triggerDownload(await fetchPdf("/generate/formulir", data), `PERISAI_FORM_${nama}.pdf`);
}

export async function generatePKS(data: KeplingPayload) {
  const nama = (data.namaCalonPerisai || data.namaLengkap).replace(/ /g, "_").toUpperCase();
  triggerDownload(await fetchPdf("/generate/pks", data), `PKS_${nama}.pdf`);
}

export async function generateExam(namaCalonPerisai: string, namaKepling: string) {
  const nama = (namaCalonPerisai || namaKepling).replace(/ /g, "_").toUpperCase();
  triggerDownload(await fetchPdf("/generate/exam", { namaCalonPerisai, namaKepling }), `EXAM_${nama}.pdf`);
}

export async function generateMerged(dokumenUrl: string, namaCalonPerisai: string) {
  const nama = namaCalonPerisai.replace(/ /g, "_").toUpperCase();
  triggerDownload(
    await fetchPdf("/generate/merge", { dokumenUrl, namaCalonPerisai }),
    `COMPLETE_FILES_${nama}.pdf`
  );
}