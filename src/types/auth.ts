export type ExternalSystem = 'sgedu' | 'saev';
export interface ExternalUser {
  name: string;
  email: string;
  photoUrl?: string;
  role?: string;
}

export interface IExternalAuthService {
  checkSession(): Promise<boolean>;
  login(email: string, pass: string): Promise<boolean>;
  getUserProfile(): Promise<ExternalUser | null>;
}
