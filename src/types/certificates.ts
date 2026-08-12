export interface CertificateField {
  id: string;
  name: string;
  placeholderKey: string;
  xPercent: number; // 0 - 100% from left
  yPercent: number; // 0 - 100% from top
  widthPercent: number; // 0 - 100%
  heightPercent: number; // 0 - 100%
  text: string;
  fontSize: number; // pt (10 - 72)
  fontFamily: 'helvetica' | 'times' | 'courier';
  fontWeight: 'normal' | 'bold' | 'italic' | 'bolditalic';
  color: string; // hex #000000
  align: 'left' | 'center' | 'right';
}

export interface CertificateTemplate {
  id: string;
  name: string;
  bgImage: string; // base64 or SVG data URL or image path
  orientation: 'landscape' | 'portrait';
  fields: CertificateField[];
  customText: string;
}

export interface CertificateStudentData {
  id: string;
  nome_aluno: string;
  turma: string;
  escola?: string;
  colocacao?: string; // ex: "1º Lugar", "2º Lugar", "3º Lugar"
  rankNumber?: number;
  avaliacao?: string; // ex: "2026 - Av. Formativa 1"
  nota_portugues?: string; // ex: "92%"
  nota_matematica?: string; // ex: "88%"
  nivel_leitura?: string; // ex: "Fluente"
  data?: string; // ex: "11/08/2026"
  texto_personalizado?: string;
  rawScore?: number | null;
  [key: string]: any;
}

export type SaevRankingMode = 'all' | 'top1' | 'top3' | 'top5' | 'fluente_only' | 'custom_rank';
