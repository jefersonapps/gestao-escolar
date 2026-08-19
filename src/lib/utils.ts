import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const cleanClassName = (name: string) => {
  return name.split(' - ')[0];
};

export const unmask = (value: string) => value.replace(/\D/g, '');

export const maskCPF = (value: string) => {
  return unmask(value)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

export const maskPhone = (value: string) => {
  const v = unmask(value);
  if (v.length > 10) {
    return v
      .replace(/^(\d\d)(\d{5})(\d{4}).*/, '($1) $2-$3');
  }
  return v
    .replace(/^(\d\d)(\d{4})(\d{0,4}).*/, '($1) $2-$3');
};

export const validateCPF = (cpf: string): boolean => {
    const strCPF = unmask(cpf);
    if (strCPF.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(strCPF)) return false; // all same digits

    let sum = 0;
    let remainder;

    for (let i = 1; i <= 9; i++) 
        sum += parseInt(strCPF.substring(i - 1, i)) * (11 - i);
    remainder = (sum * 10) % 11;

    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(strCPF.substring(9, 10))) return false;

    sum = 0;
    for (let i = 1; i <= 10; i++) 
        sum += parseInt(strCPF.substring(i - 1, i)) * (12 - i);
    remainder = (sum * 10) % 11;

    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(strCPF.substring(10, 11))) return false;

    return true;
};

export const maskDate = (value: string) => {
  return unmask(value)
    .replace(/(\d{2})(\d)/, '$1/$2')
    .replace(/(\d{2})(\d)/, '$1/$2')
    .replace(/(\d{4})\d+?$/, '$1');
};

export const calculateAge = (dateString: string): number | null => {
    // Expect DD/MM/YYYY
    if (!dateString || dateString.length !== 10) return null;
    
    const parts = dateString.split('/');
    if (parts.length !== 3) return null;
    
    // Note: Month is 0-indexed in JS Date
    const birthDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    const today = new Date();
    
    // Check if valid date
    if (isNaN(birthDate.getTime())) return null;

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    return age;
};

export interface ParseStudentListOptions {
  excludeTransferred?: boolean;
}

export function parseStudentList(rawText: string, options: ParseStudentListOptions = { excludeTransferred: true }): string[] {
  const { excludeTransferred = true } = options;
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const names: string[] = [];

  const statusKeywords = /^(transferid[oa]|remanejad[oa]|desistente|evadid[oa]|cancelad[oa]|falecid[oa]|matriculad[oa]|ativ[oa]|inativ[oa]|cursando|aprovad[oa]|reprovad[oa]|classificad[oa]|reclassificad[oa])(\(s\)|[s\/a\(\)])*$/i;
  const transferredStatus = /^(transferid[oa]|remanejad[oa]|desistente|evadid[oa]|cancelad[oa]|falecid[oa])(\(s\)|[s\/a\(\)])*$/i;
  const headerKeywords = /^(alunos\b|\d+\s*presentes\b|total\b|turma\b|profess[oa]r\b|data\b|matr[íi]cula\b|n[ºo°ª]?\b|nome\b|estudante\b|situa[çc][ãa]o\b|status\b|a[çc][õo]es\b|op[çc][õo]es\b|\d+[º°ª]?\s*(ano|s[ée]rie|etapa|per[íi]odo|turma|m[óo]dulo|termo)\b)/i;
  const photoNoiseKeywords = /^(foto|avatar|imagem|foto\s+de\s+perfil|sem\s+foto|sem\s+avatar)$/i;

  for (const line of lines) {
    // 1. Check if line has no alphabetic letters (e.g. standalone numbers like "1", "18", "19", dashes, dates)
    if (!/[a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]/i.test(line)) {
      continue;
    }

    // 2. Check if line is a standalone status keyword (e.g. "Transferido")
    if (statusKeywords.test(line)) {
      if (excludeTransferred && transferredStatus.test(line)) {
        // If the preceding accepted student was followed by "Transferido", remove them
        if (names.length > 0) {
          const lastRemoved = names.pop();
          while (names.length > 0 && names[names.length - 1].toLowerCase() === lastRemoved?.toLowerCase()) {
            names.pop();
          }
        }
      }
      continue;
    }

    // 3. Check if line is UI / Header noise or standalone photo label
    if (headerKeywords.test(line) || photoNoiseKeywords.test(line)) {
      continue;
    }

    // 4. Check if the line contains transferred keywords inline
    if (excludeTransferred && /\b(transferid[oa]|remanejad[oa]|desistente|evadid[oa]|cancelad[oa]|falecid[oa])(\(s\)|[s\/a\(\)])*\b/i.test(line)) {
      continue;
    }

    // 5. Clean line
    let cleaned = line
      // Remove image alt prefixes e.g. "Foto de ", "Foto do aluno ", "Avatar de ", "Imagem: "
      .replace(/^(foto|avatar|imagem|perfil)\s+(d[eoa]s?|d[oa]\(a\)|de\(a\)|do\s+aluno|da\s+aluna|do\s+estudante|da\s+estudante)?\s*[:\-]?\s*/i, '')
      // Remove leading numbers, ordinals, bullets e.g. "1\t", "01 - ", "1. ", "1º ", "#1 "
      .replace(/^#?\s*\d+[º°ª]?[\s\.\-\)\/:\t]+/, '')
      // Remove pipe characters
      .replace(/\|/g, '')
      // Remove tab and following content (if tabular attendance data was pasted)
      .replace(/\t.*/g, '')
      // Remove (PCD), [PCD], (NEE), etc.
      .replace(/\s*[\(\[]?\s*(PCD|NEE|AEE|DEFICIENTE)\s*[\)\]]?/gi, ' ')
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .trim();

    // 6. Validate cleaned candidate name
    if (
      cleaned.length < 2 ||
      !/[a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]{2,}/i.test(cleaned) ||
      statusKeywords.test(cleaned) ||
      headerKeywords.test(cleaned) ||
      photoNoiseKeywords.test(cleaned)
    ) {
      continue;
    }

    names.push(cleaned);
  }

  // Deduplicate while preserving order
  const uniqueNames: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const lower = name.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      uniqueNames.push(name);
    }
  }

  return uniqueNames;
}
