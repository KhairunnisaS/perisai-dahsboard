export type AcquisitionStatus = "pending" | "active" | "completed";

export interface FieldOfficer {
  id: string;
  name: string;
  avatarUrl?: string;
  subDistrict: string;
  assignedZones: string[];
  contact: string;
}

export interface Candidate {
  id: string;
  name: string;
  namaKepling: string;
  namaCalonPerisai?: string;
  isMitra: boolean;
  neighborhood: string;
  subDistrict: string;
  kecamatan: string;
  phone: string;
  status: AcquisitionStatus;
  kodePerisai: string;
  picMagang: string;
  noKTP: string;
  noKPJ: string;
  rekening: string;
  noRekening: string;
  email: string;
  tempatTglLahir: string;
  alamat: string;
  kelDesa: string;
  namaWadah: string;
  jabatanWadah: string;
  namaCabang: string;
  jabatanCabang: string;
  documents: {
    formulirPerisai: boolean;
    ktp: boolean;
    kpj: boolean;
    rekening: boolean;
    ijazah: boolean;
    lembarQuiz: boolean;
    materai: boolean;
    pasPhoto: boolean;
    // Kolom baru: URL langsung per file
    ttdUrl: string;      // col[23] — URL file ttd_calon
    materaiUrl: string;  // col[24] — URL file materai
    dokumenUrl: string;  // col[25] — URL file dokumen.pdf
    kumpulanBerkas: string; // col[26] — folder GDrive (untuk merge)
  };
  readyToPrint: {
    form: boolean;
    pks:  boolean;
    exam: boolean;
  };
  assignedOfficerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DistrictStats {
  totalCandidates: number;
  activePerisai: number;
  pendingCandidates: number;
  areasCompleted: number;
  totalAreas: number;
  acquisitionRate: number;
}

export interface ProjectMeta {
  id: string;
  title: string;
  description: string;
  district: string;
  status: "active" | "complete" | "paused";
  stats: DistrictStats;
  fieldOfficers: FieldOfficer[];
}