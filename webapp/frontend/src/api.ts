import type { ParseResult } from "./types";

const API_BASE = "/api";

export async function parseFile(
  file: File,
  schedule: { workDays: string[]; hoursPerDay: number; rotating: boolean }
): Promise<ParseResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("work_days", schedule.workDays.join(","));
  form.append("hours_per_day", String(schedule.hoursPerDay));
  form.append("rotating", String(schedule.rotating));

  const res = await fetch(`${API_BASE}/parse`, {
    method: "POST",
    body: form,
  });

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
