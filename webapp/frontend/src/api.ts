import { AuthError, getStoredPassword } from "./auth";
import type { ParseResult } from "./types";

const API_BASE = "/api";

export async function parseFile(file: File): Promise<ParseResult> {
  const form = new FormData();
  form.append("file", file);

  const password = getStoredPassword();
  const res = await fetch(`${API_BASE}/parse`, {
    method: "POST",
    headers: password ? { Authorization: `Bearer ${password}` } : {},
    body: form,
  });

  if (res.status === 401) throw new AuthError();
  if (!res.ok) {
    throw new Error(`Server error (${res.status})`);
  }
  return res.json();
}

export function downloadResult(result: ParseResult) {
  if (!result.xlsx_base64) return;
  const bytes = Uint8Array.from(atob(result.xlsx_base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = result.download_name ?? result.filename.replace(/\.pdf$/i, "_parsed.xlsx");
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
