const BACKEND = "http://127.0.0.1:8000";

export interface KeplingPayload {
  namaLengkap: string;
  namaCalonPerisai?: string;
  noKTP: string;
  tempatTglLahir: string;
  noKPJ: string;
  kodeNamaWadah: string;
  alamat: string;
  kabupatenKota: string;
  kodePos?: string;
  kelurahan?: string;   // untuk lookup kodepos di backend
  kecamatan?: string;   // untuk lookup kodepos di backend
  noTelp: string;
  email: string;
  pekerjaan: string;
  noNPWP?: string;
  bank: string;
  noRek: string;
  namaPemilik: string;
  // Nama & jabatan penanda tangan wadah & cabang
  namaWadah?: string;
  jabatanWadah?: string;
  namaCabang?: string;
  jabatanCabang?: string;
  urlGDriveFolder?: string;
  nomorSurat?: number;
}

export async function lookupKodePos(
  kelurahan: string,
  kecamatan?: string
): Promise<string> {
  try {
    // Coba via backend dulu (lebih reliable karena ada fallback)
    const params = new URLSearchParams({ kelurahan: kelurahan.trim() });
    if (kecamatan) params.set("kecamatan", kecamatan);
    const res = await fetch(`${BACKEND}/kodepos?${params}`);
    if (res.ok) {
      const data = await res.json();
      if (data.kodePos) return data.kodePos;
    }
  } catch {
    // fallback ke API langsung
  }
  try {
    const query = encodeURIComponent(kelurahan.trim());
    const res   = await fetch(`https://kodepos.vercel.app/search/?q=${query}`);
    if (!res.ok) return "";
    const data    = await res.json();
    const results: Array<{ postalcode: string; subdistrict?: string }> =
      data?.data ?? data ?? [];
    if (!Array.isArray(results) || results.length === 0) return "";
    if (kecamatan) {
      const kecLower = kecamatan.toLowerCase().replace(/[^a-z\s]/g, "");
      const match    = results.find((r) =>
        (r.subdistrict ?? "").toLowerCase().replace(/[^a-z\s]/g, "").includes(kecLower)
      );
      if (match?.postalcode) return match.postalcode;
    }
    return results[0]?.postalcode ?? "";
  } catch {
    return "";
  }
}

async function fetchPdf(endpoint: string, payload: object): Promise<Blob> {
  const res = await fetch(`${BACKEND}${endpoint}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
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
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function previewPdf(
  endpoint: string,
  payload: object
): Promise<string> {
  const blob = await fetchPdf(endpoint, payload);
  return URL.createObjectURL(blob);
}

export async function generateFormulir(data: KeplingPayload) {
  const nama = (data.namaCalonPerisai || data.namaLengkap)
    .replace(/ /g, "_")
    .toUpperCase();
  const blob = await fetchPdf("/generate/formulir", data);
  triggerDownload(blob, `PERISAI_FORM_${nama}.pdf`);
}

export async function generatePKS(data: KeplingPayload) {
  const nama = (data.namaCalonPerisai || data.namaLengkap)
    .replace(/ /g, "_")
    .toUpperCase();
  const blob = await fetchPdf("/generate/pks", data);
  triggerDownload(blob, `PKS_${nama}.pdf`);
}

export async function generateExam(
  namaCalonPerisai: string,
  namaKepling: string
) {
  const nama = (namaCalonPerisai || namaKepling).replace(/ /g, "_").toUpperCase();
  const blob = await fetchPdf("/generate/exam", { namaCalonPerisai, namaKepling });
  triggerDownload(blob, `EXAM_${nama}.pdf`);
}

export async function generateMerged(
  urlGDriveFolder: string,
  namaCalonPerisai: string
) {
  const nama = namaCalonPerisai.replace(/ /g, "_").toUpperCase();
  const blob = await fetchPdf("/generate/merge", {
    urlGDriveFolder,
    namaCalonPerisai,
  });
  triggerDownload(blob, `COMPLETE_FILES_${nama}.pdf`);
}