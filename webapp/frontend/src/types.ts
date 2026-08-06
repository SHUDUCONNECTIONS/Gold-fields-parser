export interface ParseResult {
  filename: string;
  status: "ok" | "error";
  message: string;
  events: number | null;
  days: number | null;
  shifts: number | null;
  total_hours: number | null;
  xlsx_base64: string | null;
  download_name: string | null;
}

export type JobStatus = "queued" | "parsing" | "ok" | "error";

export interface Job {
  clientId: string;
  file: File;
  status: JobStatus;
  result?: ParseResult;
}
