/** Política usada pelos guards da UI; a API continua validando independentemente. */
export function canReadBusiness(profile: { role: string; status?: string } | null): boolean {
  if (!profile) return false;
  return profile.role === "admin" || (profile.role === "student" && [undefined, "", "active", "paused"].includes(profile.status));
}