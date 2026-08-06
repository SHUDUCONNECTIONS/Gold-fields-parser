const STORAGE_KEY = "clocking_report_password";

export function getStoredPassword(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setStoredPassword(password: string) {
  localStorage.setItem(STORAGE_KEY, password);
}

export function clearStoredPassword() {
  localStorage.removeItem(STORAGE_KEY);
}

export async function checkPassword(password: string): Promise<boolean> {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  return res.ok;
}

// Thrown by api.ts calls when the server rejects the stored password, so the
// caller can drop back to the login screen instead of showing a generic error.
export class AuthError extends Error {
  constructor() {
    super("Wrong or missing password");
    this.name = "AuthError";
  }
}
