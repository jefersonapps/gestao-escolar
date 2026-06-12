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
