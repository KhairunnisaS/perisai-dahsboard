"""
Perisai Document Generator — FastAPI Backend
Jalankan dengan: python -m uvicorn main:app --port 8000
"""

import os
import re
import io
import fitz
import logging
import datetime
import tempfile
import httpx
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Perisai Doc Generator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # izinkan semua origin saat development
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Paths ────────────────────────────────────────────────────────────────────

BASE_DIR    = Path(__file__).parent
ASSETS_DIR  = BASE_DIR / "assets"
TEMP_DIR    = BASE_DIR / "temp"
TEMP_DIR.mkdir(exist_ok=True)

TEMPLATE_PKS     = ASSETS_DIR / "TEMPLATE PKS MASTER.docx"
TEMPLATE_FORM    = ASSETS_DIR / "FORMULIR PENDAFTARAN CALON PERISAI 2026.pdf"
TEMPLATE_UJIAN   = ASSETS_DIR / "TEMPLATE UJIAN.pdf"
STEMPEL_WADAH    = ASSETS_DIR / "stempel_wadah.png"
TTD_WADAH        = ASSETS_DIR / "ttd_wadah.png"
STEMPEL_CABANG   = ASSETS_DIR / "stempel_cabang.png"
TTD_CABANG       = ASSETS_DIR / "ttd_cabang.png"

# ─── Ketetapan default (fallback jika payload tidak kirim) ───────────────────

DEFAULT_NAMA_WADAH    = "HERDIANA SIMBOLON"
DEFAULT_JABATAN_WADAH = "KETUA WADAH"
DEFAULT_NAMA_CABANG   = "SAKINAH RAMZA"
DEFAULT_JABATAN_CABANG = "ARK"

# ─── Google Drive helpers ─────────────────────────────────────────────────────

def gdrive_folder_id(url: str) -> Optional[str]:
    patterns = [
        r"/folders/([a-zA-Z0-9_-]+)",
        r"id=([a-zA-Z0-9_-]+)",
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None

def gdrive_file_id(url: str) -> Optional[str]:
    patterns = [
        r"/file/d/([a-zA-Z0-9_-]+)",
        r"id=([a-zA-Z0-9_-]+)",
        r"/open\?id=([a-zA-Z0-9_-]+)",
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None

async def list_gdrive_folder(folder_id: str, api_key: str) -> list[dict]:
    url = "https://www.googleapis.com/drive/v3/files"
    params = {
        "q": f"'{folder_id}' in parents and trashed=false",
        "fields": "files(id,name,mimeType)",
        "key": api_key,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, params=params)
        if resp.status_code != 200:
            logger.error(f"Drive API error: {resp.status_code} - {resp.text}")
            return []
        return resp.json().get("files", [])

async def download_gdrive_by_id(file_id: str, dest_path: Path) -> bool:
    """Download file dari GDrive. Handle redirect dan virus-scan confirmation."""
    # Coba direct download dulu
    download_url = f"https://drive.google.com/uc?export=download&id={file_id}"
    async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
        resp = await client.get(download_url)
        if resp.status_code != 200:
            logger.error(f"Gagal download file {file_id}: {resp.status_code}")
            return False

        content = resp.content

        # Jika Google Drive kembalikan HTML (virus scan warning untuk file besar),
        # ekstrak confirm token dan coba ulang
        content_type = resp.headers.get("content-type", "")
        if "text/html" in content_type:
            logger.warning(f"GDrive {file_id}: dapat HTML, mencoba confirm token...")
            # Cari confirm token di response
            html = content.decode("utf-8", errors="ignore")
            import re as _re
            confirm_match = _re.search(r'confirm=([0-9A-Za-z_\-]+)', html)
            if confirm_match:
                confirm = confirm_match.group(1)
                confirm_url = f"https://drive.google.com/uc?export=download&confirm={confirm}&id={file_id}"
                resp2 = await client.get(confirm_url)
                if resp2.status_code == 200 and "text/html" not in resp2.headers.get("content-type", ""):
                    content = resp2.content
                else:
                    logger.error(f"GDrive {file_id}: confirm download juga gagal")
                    return False
            else:
                # Coba endpoint alternatif
                alt_url = f"https://drive.google.com/uc?id={file_id}&export=download&confirm=t"
                resp3 = await client.get(alt_url)
                if resp3.status_code == 200 and "text/html" not in resp3.headers.get("content-type", ""):
                    content = resp3.content
                else:
                    logger.error(f"GDrive {file_id}: semua metode download gagal")
                    return False

        if len(content) < 100:
            logger.error(f"GDrive {file_id}: content terlalu kecil ({len(content)} bytes), kemungkinan error")
            return False

        dest_path.write_bytes(content)
        logger.info(f"GDrive {file_id}: berhasil download {len(content)} bytes ke {dest_path.name}")
        return True

async def get_files_from_folder(
    folder_url: str,
    tmp_dir: Path,
    api_key: str,
) -> tuple[Optional[Path], Optional[Path]]:
    """
    Dari URL folder GDrive, ambil ttd_calon.png dan materai.png.
    Return: (ttd_path, materai_path)
    """
    folder_id = gdrive_folder_id(folder_url)
    if not folder_id:
        logger.warning(f"Tidak bisa ekstrak folder ID dari: {folder_url}")
        return None, None

    files = await list_gdrive_folder(folder_id, api_key)
    if not files:
        logger.warning(f"Folder kosong atau tidak bisa diakses: {folder_id}")
        return None, None

    logger.info(f"Files di folder {folder_id}: {[f['name'] for f in files]}")

    ttd_path     = None
    materai_path = None

    for f in files:
        name_lower = f["name"].lower()
        # Deteksi ttd_calon.png
        if "ttd_calon" in name_lower or "ttd calon" in name_lower:
            dest = tmp_dir / "ttd_calon.png"
            if await download_gdrive_by_id(f["id"], dest):
                ttd_path = dest
                logger.info(f"TTD calon berhasil diunduh: {dest}")
        # Deteksi materai.png
        elif "materai" in name_lower:
            dest = tmp_dir / "materai.png"
            if await download_gdrive_by_id(f["id"], dest):
                materai_path = dest
                logger.info(f"Materai berhasil diunduh: {dest}")

    return ttd_path, materai_path

# ─── Kode Pos Lookup ─────────────────────────────────────────────────────────

async def lookup_kodepos(kelurahan: str, kecamatan: str = "") -> str:
    """Cari kode pos berdasarkan kelurahan dan kecamatan."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://kodepos.vercel.app/search/",
                params={"q": kelurahan.strip()}
            )
            if resp.status_code != 200:
                return ""
            data = resp.json()
            results = data.get("data", data) if isinstance(data, dict) else data
            if not isinstance(results, list) or not results:
                return ""
            if kecamatan:
                kec_lower = re.sub(r"[^a-z\s]", "", kecamatan.lower())
                for r in results:
                    sub = re.sub(r"[^a-z\s]", "", (r.get("subdistrict") or "").lower())
                    if kec_lower in sub or sub in kec_lower:
                        return r.get("postalcode", "")
            return results[0].get("postalcode", "")
    except Exception as e:
        logger.error(f"Kodepos lookup error: {e}")
        return ""

# ─── Request Models ───────────────────────────────────────────────────────────

class KeplingData(BaseModel):
    namaLengkap: str
    namaCalonPerisai: Optional[str] = None
    noKTP: str
    tempatTglLahir: str
    noKPJ: str
    kodeNamaWadah: str
    alamat: str
    kabupatenKota: str
    kodePos: Optional[str] = ""
    # Untuk kode pos otomatis dari API
    kelurahan: Optional[str] = None
    kecamatan: Optional[str] = None
    noTelp: str
    email: str
    pekerjaan: str
    noNPWP: Optional[str] = ""
    bank: str
    noRek: str
    namaPemilik: str
    # Nama & jabatan penanda tangan (dari payload, fallback ke ketetapan)
    namaWadah: Optional[str] = None
    jabatanWadah: Optional[str] = None
    namaCabang: Optional[str] = None
    jabatanCabang: Optional[str] = None
    urlGDriveFolder: Optional[str] = None
    nomorSurat: Optional[int] = None

class ExamData(BaseModel):
    namaLengkap: str
    skor: float
    jawaban: dict

# ─── Helper: resolve nama/jabatan ────────────────────────────────────────────

def resolve_penandatangan(data: KeplingData) -> tuple[str, str, str, str]:
    """Kembalikan (nama_wadah, jabatan_wadah, nama_cabang, jabatan_cabang)."""
    nama_wadah    = (data.namaWadah    or DEFAULT_NAMA_WADAH).upper()
    jabatan_wadah = (data.jabatanWadah or DEFAULT_JABATAN_WADAH).upper()
    nama_cabang   = (data.namaCabang   or DEFAULT_NAMA_CABANG).upper()
    jabatan_cabang = (data.jabatanCabang or DEFAULT_JABATAN_CABANG).upper()
    return nama_wadah, jabatan_wadah, nama_cabang, jabatan_cabang

# ─── PDF Generator: Formulir ─────────────────────────────────────────────────

def generate_formulir(
    data: KeplingData,
    ttd_path: Optional[Path],
    materai_path: Optional[Path],
    kode_pos_resolved: str,
) -> bytes:
    if not TEMPLATE_FORM.exists():
        raise FileNotFoundError("Template formulir tidak ditemukan di assets/")

    doc  = fitz.open(str(TEMPLATE_FORM))
    page = doc[0]

    PX, PY = 3, -2
    nama_display = (data.namaCalonPerisai or data.namaLengkap).upper()

    # Tanggal ttd = waktu generate
    sekarang   = datetime.datetime.now()
    bulan_list = ["","Januari","Februari","Maret","April","Mei","Juni",
                  "Juli","Agustus","September","Oktober","November","Desember"]
    tanggal_ttd = f"Medan, {sekarang.day} {bulan_list[sekarang.month]} {sekarang.year}"

    # Nama & jabatan dari payload atau ketetapan
    nama_wadah, jabatan_wadah, nama_cabang, jabatan_cabang = resolve_penandatangan(data)

    # Gunakan kodePos yang sudah di-resolve (dari lookup atau dari payload)
    kode_pos = kode_pos_resolved or (data.kodePos or "")

    teks_map = {
        "Nama Lengkap":     ((156+PX, 134+PY), nama_display,                   9),
        "No. KTP":          ((156+PX, 158+PY), data.noKTP,                     9),
        "Tempat_Tgl_Lahir": ((156+PX, 183+PY), data.tempatTglLahir.upper(),    9),
        "No. KPJ":          ((156+PX, 207+PY), data.noKPJ,                     9),
        "Kode/Nama Wadah":  ((156+PX, 232+PY), data.kodeNamaWadah.upper(),     9),
        "Alamat":           ((156+PX, 256+PY), data.alamat.upper(),             9),
        "Kabupaten/Kota":   ((224+PX, 284+PY), data.kabupatenKota.upper(),     9),
        "Kode Pos":         ((418+PX, 284+PY), kode_pos,                       9),
        "No. Telp":         ((156+PX, 308+PY), data.noTelp,                    9),
        "Email":            ((156+PX, 332+PY), data.email.lower(),              9),
        "Pekerjaan":        ((156+PX, 357+PY), data.pekerjaan.upper(),          9),
        "No. NPWP":         ((156+PX, 381+PY), (data.noNPWP or "").upper(),    9),
        "Bank":             ((179+PX, 406+PY), data.bank.upper(),               9),
        "No. Rek":          ((302+PX, 406+PY), data.noRek,                     9),
        "Nama Pemilik":     ((211+PX, 430+PY), data.namaPemilik.upper(),        9),
    }

    for _, ((x, y), teks, fs) in teks_map.items():
        page.insert_text((x, y), teks, fontsize=fs, fontname="helv", color=(0,0,0))

    def insert_centered(teks: str, pusat_x: float, y: float, fs: int = 9):
        panjang = fitz.get_text_length(teks, fontname="helv", fontsize=fs)
        page.insert_text((pusat_x - panjang/2, y), teks, fontsize=fs, fontname="helv", color=(0,0,0))

    # ── Tanggal TTD (dd/mm/yy) di kolom yang tepat ──────────────────────────
    # Koordinat dari template: "Tgl (dd)": (323, 660), "Bln (mm)": (341, 660), "Thn (yy)": (370, 660)
    page.insert_text((323, 660), f"{sekarang.strftime('%d')}", fontsize=8, fontname="helv", color=(0,0,0))
    page.insert_text((341, 660), f"{sekarang.strftime('%m')}", fontsize=8, fontname="helv", color=(0,0,0))
    page.insert_text((370, 660), f"{sekarang.strftime('%y')}", fontsize=8, fontname="helv", color=(0,0,0))

    # ── Nama calon perisai di area ttd ──────────────────────────────────────
    insert_centered(nama_display, (398+504)/2, 762+PY, 7)

    # ── Nama & jabatan Wadah — koordinat dari template ───────────────────────
    # "Nama Wadah": (0, 762 + PY)  → center sekitar x=82 (kolom wadah)
    # "Jabatan Wadah": (141 + PX, 774 + PY)
    insert_centered(nama_wadah,    82,       762+PY, 7)
    page.insert_text((141+PX, 774+PY), jabatan_wadah, fontsize=7, fontname="helv", color=(0,0,0))

    # ── Nama & jabatan Cabang — koordinat dari template ──────────────────────
    # "Nama Cabang": (0, 803 + PY)  → center sekitar x=223 (kolom cabang)
    # "Jabatan Cabang": (297 + PX, 815 + PY)
    insert_centered(nama_cabang,    223,      803+PY, 7)
    page.insert_text((297+PX, 815+PY), jabatan_cabang, fontsize=7, fontname="helv", color=(0,0,0))

    def centang(rect):
        p1 = fitz.Point(rect.x0+1, rect.y0+3)
        p2 = fitz.Point(rect.x0+3, rect.y1-1)
        p3 = fitz.Point(rect.x1-1, rect.y0+1)
        page.draw_line(p1, p2, color=(0,0,0), width=1.5)
        page.draw_line(p2, p3, color=(0,0,0), width=1.5)

    checkboxes = {
        "P1": fitz.Rect(43,467,50,474), "P2": fitz.Rect(43,487,50,494),
        "P3": fitz.Rect(43,507,50,514), "P4": fitz.Rect(43,527,50,534),
        "B1": fitz.Rect(43,575,50,582), "B2": fitz.Rect(43,595,50,602),
        "B3": fitz.Rect(43,615,50,622), "B4": fitz.Rect(43,635,50,642),
        "H1": fitz.Rect(40,855,48,862), "H2": fitz.Rect(40,870,48,877),
        "H3": fitz.Rect(40,885,48,892),
    }
    for cb in checkboxes.values():
        centang(cb)

    for x1,y1,x2,y2 in [(175,860,220,860),(175,874,220,874),(175,891,220,891)]:
        page.draw_line(fitz.Point(x1,y1), fitz.Point(x2,y2), color=(0,0,0), width=1)

    def insert_img(path: Optional[Path], rect: fitz.Rect, label: str = ""):
        if path is None:
            logger.warning(f"insert_img [{label}]: path is None — tidak disisipkan")
            return
        if not path.exists():
            logger.warning(f"insert_img [{label}]: file tidak ada di {path}")
            return
        size = path.stat().st_size
        if size == 0:
            logger.warning(f"insert_img [{label}]: file kosong (0 bytes) di {path}")
            return
        try:
            page.insert_image(rect, filename=str(path))
            logger.info(f"insert_img [{label}]: berhasil disisipkan ({size} bytes)")
        except Exception as e:
            logger.error(f"insert_img [{label}]: error — {e}")

    w_sw, h_sw = 4.2*72/2.54, 4.2*72/2.54
    w_sc, h_sc = 6.8*72/2.54, 2.0*72/2.54
    w_tw, h_tw = 4.0*72/2.54, 2.5*72/2.54
    w_tc, h_tc = 6.5*72/2.54, 3.8*72/2.54

    insert_img(STEMPEL_WADAH,   fitz.Rect(40, 655, 40+w_sw, 655+h_sw),             "stempel_wadah")
    insert_img(TTD_WADAH,       fitz.Rect(163-w_tw/2, 695, 163-w_tw/2+w_tw, 695+h_tw), "ttd_wadah")
    insert_img(STEMPEL_CABANG,  fitz.Rect(304-w_sc/2, 735, 304-w_sc/2+w_sc, 735+h_sc), "stempel_cabang")
    insert_img(TTD_CABANG,      fitz.Rect(314-w_tc/2, 710, 314-w_tc/2+w_tc, 710+h_tc), "ttd_cabang")
    # TTD calon perisai dari GDrive (ttd_calon.png)
    insert_img(ttd_path,        fitz.Rect(390, 700, 525, 755),  "ttd_calon")
    # Materai dari GDrive (materai.png)
    insert_img(materai_path,    fitz.Rect(235, 524, 319, 608),  "materai")

    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()

# ─── PDF Generator: PKS ──────────────────────────────────────────────────────

def docx_to_pdf_msword(docx_path: Path, output_pdf: Path) -> bool:
    try:
        from docx2pdf import convert
        convert(str(docx_path), str(output_pdf))
        return output_pdf.exists()
    except Exception as e:
        logger.error(f"docx2pdf error: {e}")
        raise HTTPException(500, f"Gagal konversi DOCX ke PDF: {e}")

def generate_pks(
    data: KeplingData,
    ttd_path: Optional[Path],
    materai_path: Optional[Path],
) -> bytes:
    from docx import Document

    if not TEMPLATE_PKS.exists():
        raise FileNotFoundError("Template PKS tidak ditemukan di assets/")

    sekarang  = datetime.datetime.now()
    hari_list = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"]
    bulan_list = ["","Januari","Februari","Maret","April","Mei","Juni",
                  "Juli","Agustus","September","Oktober","November","Desember"]
    romawi_list = ["","I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"]

    def terbilang(n: int) -> str:
        sat = ["","Satu","Dua","Tiga","Empat","Lima","Enam","Tujuh","Delapan","Sembilan","Sepuluh","Sebelas"]
        if n < 12: return sat[n]
        elif n < 20: return sat[n-10] + " Belas"
        elif n < 100: return sat[n//10] + " Puluh " + (sat[n%10] if n%10 != 0 else "")
        elif n == 2000: return "Dua Ribu"
        elif 2000 < n < 2100: return "Dua Ribu " + terbilang(n-2000)
        return str(n)

    nama_display = (data.namaCalonPerisai or data.namaLengkap)
    no_surat     = data.nomorSurat or 1

    # Nama & jabatan dari payload atau ketetapan
    nama_wadah, jabatan_wadah, nama_cabang, jabatan_cabang = resolve_penandatangan(data)

    replacement = {
        "[NO_SURAT]":         str(no_surat),
        "[BLN_ROMAWI]":       romawi_list[sekarang.month],
        "[TAHUN]":            str(sekarang.year),
        "[HARI]":             hari_list[sekarang.isoweekday() % 7],
        "[TGL_HURUF]":        terbilang(sekarang.day).strip(),
        "[BLN_NAMA]":         bulan_list[sekarang.month],
        "[THN_HURUF]":        terbilang(sekarang.year).strip(),
        "[TGL_ANGKA]":        f"({sekarang.strftime('%d - %m - %Y')})",
        "[NAMA_CALON_JUDUL]": nama_display.upper(),
        "[NAMA_CALON]":       nama_display.title(),
        "[KTP_CALON]":        data.noKTP,
        "[ALAMAT_CALON]":     data.alamat.title(),
        "[TELP_CALON]":       data.noTelp,
        "[EMAIL_CALON]":      data.email,
        # Nama & jabatan dari payload
        "[NAMA_WADAH]":       nama_wadah,
        "[JABATAN_WADAH]":    jabatan_wadah,
        "[NAMA_CABANG]":      nama_cabang,
        "[JABATAN_CABANG]":   jabatan_cabang,
    }

    doc = Document(str(TEMPLATE_PKS))

    def merge_and_replace(para):
        runs = para.runs
        i = 0
        while i < len(runs):
            if "[" in runs[i].text and "]" not in runs[i].text:
                j = i + 1
                while j < len(runs):
                    runs[i].text += runs[j].text
                    runs[j].text = ""
                    if "]" in runs[i].text:
                        break
                    j += 1
            i += 1
        for key, val in replacement.items():
            if key in para.text:
                for run in para.runs:
                    if key in run.text:
                        run.text = run.text.replace(key, val)

    all_paras = list(doc.paragraphs)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                all_paras.extend(cell.paragraphs)

    for p in all_paras:
        merge_and_replace(p)

    with tempfile.NamedTemporaryFile(suffix=".docx", dir=TEMP_DIR, delete=False) as f:
        temp_docx = Path(f.name)
    doc.save(str(temp_docx))

    pdf_path = TEMP_DIR / (temp_docx.stem + ".pdf")
    ok = docx_to_pdf_msword(temp_docx, pdf_path)
    temp_docx.unlink(missing_ok=True)

    if not ok:
        raise HTTPException(500, "Gagal konversi DOCX ke PDF")

    pdf_doc   = fitz.open(str(pdf_path))
    last_page = pdf_doc[-1]

    def insert_img_pks(path: Optional[Path], rect: fitz.Rect, label: str = ""):
        if path is None:
            logger.warning(f"PKS insert_img [{label}]: path is None")
            return
        if not path.exists():
            logger.warning(f"PKS insert_img [{label}]: file tidak ada di {path}")
            return
        size = path.stat().st_size
        if size == 0:
            logger.warning(f"PKS insert_img [{label}]: file kosong (0 bytes)")
            return
        try:
            last_page.insert_image(rect, filename=str(path))
            logger.info(f"PKS insert_img [{label}]: berhasil ({size} bytes)")
        except Exception as e:
            logger.error(f"PKS insert_img [{label}]: error — {e}")

    # Materai dari GDrive
    insert_img_pks(materai_path, fitz.Rect(235, 524, 319, 608), "materai")
    # TTD calon dari GDrive (ttd_calon.png)
    insert_img_pks(ttd_path,     fitz.Rect(145, 520, 280, 610), "ttd_calon")

    buf = io.BytesIO()
    pdf_doc.save(buf)
    pdf_doc.close()
    pdf_path.unlink(missing_ok=True)

    return buf.getvalue()

# ─── PDF Generator: Exam ─────────────────────────────────────────────────────

def generate_exam(data: ExamData) -> bytes:
    if not TEMPLATE_UJIAN.exists():
        raise FileNotFoundError("Template ujian tidak ditemukan di assets/")

    doc    = fitz.open(str(TEMPLATE_UJIAN))
    hal_1  = doc[0]
    hal_2  = doc[1]

    nama = data.namaLengkap.title()
    hal_1.insert_text((187, 226), nama, fontsize=11, fontname="hebo", color=(0,0,0))
    hal_2.insert_text((103, 593), str(int(data.skor)), fontsize=14, fontname="hebo", color=(0,0,0))

    koor = {
        1:  {"A":(90,310,0),"B":(90,323,0),"C":(90,351,0),"D":(90,363,0)},
        2:  {"A":(90,405,0),"B":(90,419,0),"C":(90,433,0),"D":(90,459,0)},
        3:  {"A":(90,515,0),"B":(90,527,0),"C":(90,555,0),"D":(90,569,0)},
        4:  {"A":(90,610,0),"B":(90,623,0),"C":(90,637,0),"D":(90,650,0)},
        5:  {"A":(90,692,0),"B":(90,705,0),"C":(90,719,0),"D":(90,733,0)},
        6:  {"A":(90,121,1),"B":(90,134,1),"C":(90,149,1),"D":(90,161,1)},
        7:  {"A":(90,217,1),"B":(90,230,1),"C":(90,244,1),"D":(90,257,1)},
        8:  {"A":(90,298,1),"B":(90,311,1),"C":(90,326,1),"D":(90,338,1)},
        9:  {"A":(90,394,1),"B":(90,406,1),"C":(90,421,1),"D":(90,433,1)},
        10: {"A":(93,476,1),"B":(93,488,1),"C":(93,517,1),"D":(93,529,1)},
    }

    def silang(page, x, y):
        sz = 4
        page.draw_line(fitz.Point(x-sz,y-sz), fitz.Point(x+sz,y+sz), color=(0,0,0), width=1.3)
        page.draw_line(fitz.Point(x-sz,y+sz), fitz.Point(x+sz,y-sz), color=(0,0,0), width=1.3)

    for i in range(1, 11):
        jawaban = data.jawaban.get(f"Soal {i}", "").strip()
        if jawaban:
            jawaban = jawaban[0].upper()
        if i in koor and jawaban in koor[i]:
            x, y, hal_idx = koor[i][jawaban]
            silang(doc[hal_idx], x, y)

    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()

# ─── Sheets: ambil data exam ─────────────────────────────────────────────────

async def get_exam_data_for(nama_calon: str, sheets_id: str, api_key: str) -> Optional[ExamData]:
    range_  = "Form Responses 1!A:L"
    url     = f"https://sheets.googleapis.com/v4/spreadsheets/{sheets_id}/values/{range_}?key={api_key}"

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url)
        if resp.status_code != 200:
            logger.error(f"Sheets API error: {resp.status_code}")
            return None
        rows = resp.json().get("values", [])

    nama_calon_lower = nama_calon.lower().strip()
    for row in rows[1:]:
        if len(row) < 12:
            continue
        nama_di_sheet = str(row[11]).strip().lower()
        if nama_calon_lower in nama_di_sheet or nama_di_sheet in nama_calon_lower:
            skor = float(str(row[1]).replace(",", ".")) if row[1] else 0.0
            soal_cols = list(range(2, 12))
            jawaban = {}
            for idx, col_idx in enumerate(soal_cols):
                raw = str(row[col_idx]).strip() if col_idx < len(row) else ""
                jawaban[f"Soal {idx+1}"] = raw[0].upper() if raw else ""

            return ExamData(
                namaLengkap=str(row[11]).strip(),
                skor=skor,
                jawaban=jawaban,
            )
    return None

# ─── Config ───────────────────────────────────────────────────────────────────

SHEETS_ID      = os.getenv("VITE_SHEETS_ID", "")
API_KEY        = os.getenv("VITE_SHEETS_API_KEY", "")
GDRIVE_API_KEY = os.getenv("VITE_SHEETS_API_KEY", "")

# ─── Helper: resolve kodepos ─────────────────────────────────────────────────

async def resolve_kodepos(data: KeplingData) -> str:
    """
    Cari kode pos dari:
    1. data.kodePos jika sudah ada
    2. data.kelurahan + data.kecamatan via API (data calon perisai)
    """
    if data.kodePos and data.kodePos.strip():
        return data.kodePos.strip()
    # Prioritaskan kelurahan calon perisai
    kelurahan = data.kelurahan or ""
    kecamatan = data.kecamatan or ""
    if kelurahan:
        kode = await lookup_kodepos(kelurahan, kecamatan)
        if kode:
            return kode
    return ""

# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/generate/formulir")
async def endpoint_formulir(data: KeplingData):
    # Resolve kode pos dari kelurahan/kecamatan calon perisai
    kode_pos = await resolve_kodepos(data)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        ttd_path, materai_path = None, None

        if data.urlGDriveFolder:
            ttd_path, materai_path = await get_files_from_folder(
                data.urlGDriveFolder, tmp, GDRIVE_API_KEY
            )
            logger.info(f"TTD: {ttd_path}, Materai: {materai_path}")

        try:
            pdf_bytes = generate_formulir(data, ttd_path, materai_path, kode_pos)
        except FileNotFoundError as e:
            raise HTTPException(404, str(e))

    nama_file = (data.namaCalonPerisai or data.namaLengkap).replace(" ", "_").upper()
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="FORM_PERISAI_{nama_file}.pdf"'},
    )


@app.post("/generate/pks")
async def endpoint_pks(data: KeplingData):
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        ttd_path, materai_path = None, None

        if data.urlGDriveFolder:
            ttd_path, materai_path = await get_files_from_folder(
                data.urlGDriveFolder, tmp, GDRIVE_API_KEY
            )
            logger.info(f"TTD: {ttd_path}, Materai: {materai_path}")

        try:
            pdf_bytes = generate_pks(data, ttd_path, materai_path)
        except FileNotFoundError as e:
            raise HTTPException(404, str(e))

    nama_file = (data.namaCalonPerisai or data.namaLengkap).replace(" ", "_").upper()
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="PKS_{nama_file}.pdf"'},
    )


@app.post("/generate/exam")
async def endpoint_exam(payload: dict):
    nama = payload.get("namaCalonPerisai") or payload.get("namaKepling", "")
    if not nama:
        raise HTTPException(400, "namaCalonPerisai wajib diisi")

    exam_data = await get_exam_data_for(nama, SHEETS_ID, API_KEY)
    if not exam_data:
        raise HTTPException(404, f"Data ujian untuk '{nama}' tidak ditemukan di Sheets")

    try:
        pdf_bytes = generate_exam(exam_data)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))

    nama_file = nama.replace(" ", "_").upper()
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="UJIAN_{nama_file}.pdf"'},
    )


class MergeData(BaseModel):
    urlGDriveFolder: str
    namaCalonPerisai: str


@app.post("/generate/merge")
async def endpoint_merge(data: MergeData):
    """
    Gabungkan berkas: Form PDF + dokumen.pdf (dari GDrive) + Ujian PDF
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        folder_id = gdrive_folder_id(data.urlGDriveFolder)
        if not folder_id:
            raise HTTPException(400, "URL folder GDrive tidak valid")

        files = await list_gdrive_folder(folder_id, GDRIVE_API_KEY)
        if not files:
            raise HTTPException(404, "Folder GDrive kosong atau tidak dapat diakses")

        dokumen_path = None
        for f in files:
            name_lower = f["name"].lower()
            if name_lower == "dokumen.pdf" or (name_lower.endswith(".pdf") and "dokumen" in name_lower):
                dest = tmp / "dokumen.pdf"
                if await download_gdrive_by_id(f["id"], dest):
                    dokumen_path = dest

        parts: list[fitz.Document] = []

        if TEMPLATE_FORM.exists():
            parts.append(fitz.open(str(TEMPLATE_FORM)))

        if dokumen_path and dokumen_path.exists():
            parts.append(fitz.open(str(dokumen_path)))

        if TEMPLATE_UJIAN.exists():
            parts.append(fitz.open(str(TEMPLATE_UJIAN)))

        if not parts:
            raise HTTPException(500, "Tidak ada berkas yang bisa digabungkan")

        merged = fitz.open()
        for part in parts:
            merged.insert_pdf(part)
            part.close()

        buf = io.BytesIO()
        merged.save(buf)
        merged.close()

    nama_file = data.namaCalonPerisai.replace(" ", "_").upper()
    return StreamingResponse(
        io.BytesIO(buf.getvalue()),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="BERKAS_LENGKAP_{nama_file}.pdf"'},
    )


@app.get("/kodepos")
async def endpoint_kodepos(kelurahan: str, kecamatan: str = ""):
    kode = await lookup_kodepos(kelurahan, kecamatan)
    return {"kodePos": kode}


@app.get("/health")
def health():
    assets = {
        "template_pks":   TEMPLATE_PKS.exists(),
        "template_form":  TEMPLATE_FORM.exists(),
        "template_ujian": TEMPLATE_UJIAN.exists(),
        "stempel_wadah":  STEMPEL_WADAH.exists(),
        "ttd_wadah":      TTD_WADAH.exists(),
        "stempel_cabang": STEMPEL_CABANG.exists(),
        "ttd_cabang":     TTD_CABANG.exists(),
    }
    return {"status": "ok", "assets": assets}