// Tiny local "who am I" store for the document editor's quick-insert menu
// (Nom/Prénom, Adresse, Téléphone, E-mail, Lieu): plain text, small, so
// localStorage is simple and sufficient — no IndexedDB needed here.

export type ProfileField = "name" | "address" | "phone" | "email" | "place";

const KEYS: Record<ProfileField, string> = {
  name: "signe:profile-name",
  address: "signe:profile-address",
  phone: "signe:profile-phone",
  email: "signe:profile-email",
  place: "signe:profile-place",
};

export function getProfileField(field: ProfileField): string {
  try { return localStorage.getItem(KEYS[field]) ?? ""; } catch { return ""; }
}

export function setProfileField(field: ProfileField, value: string): void {
  try { localStorage.setItem(KEYS[field], value); } catch { /* storage unavailable, value just won't persist */ }
}
