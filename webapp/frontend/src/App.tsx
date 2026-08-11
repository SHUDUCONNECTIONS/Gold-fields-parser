import { useCallback, useRef, useState } from "react";
import "./App.css";
import { downloadResult, parseFile } from "./api";
import ramsLogo from "./assets/rams-logo.png";
import Blobs from "./Blobs";
import ScheduleSettings from "./ScheduleSettings";
import ShiftPicker from "./ShiftPicker";
import type { Job } from "./types";
import { useInstallPrompt } from "./useInstallPrompt";

// The working week is Mon-Fri, optionally extended to include Saturday for
// employees who are scheduled to work it (Sunday is never part of this -
// Sunday work always goes to S/T regardless of schedule, see the parser).
const BASE_WORK_DAYS = ["mon", "tue", "wed", "thu", "fri"];

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function StatusBadge({ status }: { status: Job["status"] }) {
  switch (status) {
    case "queued":
      return <span className="badge badge-queued">Queued</span>;
    case "parsing":
      return (
        <span className="badge badge-parsing">
          <span className="spinner" />
          Parsing
        </span>
      );
    case "ok":
      return <span className="badge badge-ok">Parsed</span>;
    case "error":
      return <span className="badge badge-error">Failed</span>;
  }
}

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [hoursPerDay, setHoursPerDay] = useState<number | null>(null);
  const [includeSaturday, setIncludeSaturday] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const { canInstall, installed, promptInstall } = useInstallPrompt();

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const pdfs = Array.from(fileList).filter((f) =>
      f.name.toLowerCase().endsWith(".pdf")
    );
    if (pdfs.length === 0) return;
    setJobs((prev) => [
      ...prev,
      ...pdfs.map((file) => ({ clientId: makeId(), file, status: "queued" as const })),
    ]);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) setIsDragging(false);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const removeJob = (id: string) => {
    setJobs((prev) => prev.filter((j) => j.clientId !== id));
  };

  const clearAll = () => setJobs([]);

  const runQueue = async () => {
    if (hoursPerDay === null) return;
    setIsRunning(true);
    // Snapshot the ids to run so newly-added files mid-run aren't swept in.
    const toRun = jobs.filter((j) => j.status === "queued").map((j) => j.clientId);

    for (const id of toRun) {
      setJobs((prev) =>
        prev.map((j) => (j.clientId === id ? { ...j, status: "parsing" } : j))
      );
      const job = jobs.find((j) => j.clientId === id);
      if (!job) continue;

      try {
        const result = await parseFile(job.file, {
          workDays: includeSaturday ? [...BASE_WORK_DAYS, "sat"] : BASE_WORK_DAYS,
          hoursPerDay,
        });
        setJobs((prev) =>
          prev.map((j) =>
            j.clientId === id ? { ...j, status: result.status, result } : j
          )
        );
      } catch (e) {
        setJobs((prev) =>
          prev.map((j) =>
            j.clientId === id
              ? {
                  ...j,
                  status: "error",
                  result: {
                    filename: job.file.name,
                    status: "error",
                    message: e instanceof Error ? e.message : "Upload failed",
                    events: null,
                    days: null,
                    shifts: null,
                    total_hours: null,
                    xlsx_base64: null,
                    download_name: null,
                  },
                }
              : j
          )
        );
      }
    }
    setIsRunning(false);
  };

  const downloadAll = () => {
    for (const j of jobs) {
      if (j.status === "ok" && j.result) downloadResult(j.result);
    }
  };

  const queuedCount = jobs.filter((j) => j.status === "queued").length;
  const okCount = jobs.filter((j) => j.status === "ok").length;
  const errorCount = jobs.filter((j) => j.status === "error").length;

  return (
    <div className="app">
      <Blobs />
      <header className="hero">
        <img src={ramsLogo} alt="Rams Mining Technologies" className="hero-logo" />
        <h1>Clocking Report Parser</h1>
        <p>
          Drop in Individual Clocking History PDFs — get back ready-to-use
          timesheet workbooks, one per employee.
        </p>
        {canInstall && (
          <button className="btn btn-primary install-btn" onClick={promptInstall}>
            Add to this computer
          </button>
        )}
        {installed && <p className="installed-note">✓ Installed as an app</p>}
      </header>

      {hoursPerDay === null ? (
        <ShiftPicker onSelect={setHoursPerDay} />
      ) : (
      <main className="panel">
        <div
          className={`dropzone ${isDragging ? "dropzone-active" : ""}`}
          onDrop={onDrop}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple
            hidden
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
          <div className="dropzone-icon">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M12 15V4m0 0 4 4m-4-4-4 4"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="dropzone-title">Drag &amp; drop PDFs here</p>
          <p className="dropzone-sub">Multiple files at once are fine</p>
          <span className="dropzone-pill">Browse files</span>
        </div>

        <ScheduleSettings
          hoursPerDay={hoursPerDay}
          onChangeShift={() => setHoursPerDay(null)}
          includeSaturday={includeSaturday}
          onIncludeSaturdayChange={setIncludeSaturday}
        />

        {jobs.length > 0 && (
          <>
            <div className="toolbar">
              <div className="toolbar-summary">
                {jobs.length} file{jobs.length !== 1 && "s"}
                {okCount > 0 && <span className="dot ok">{okCount} parsed</span>}
                {errorCount > 0 && <span className="dot error">{errorCount} failed</span>}
              </div>
              <div className="toolbar-actions">
                {okCount > 1 && (
                  <button className="btn btn-ghost" onClick={downloadAll}>
                    Download all
                  </button>
                )}
                <button className="btn btn-ghost" onClick={clearAll} disabled={isRunning}>
                  Clear
                </button>
                <button
                  className="btn btn-primary"
                  onClick={runQueue}
                  disabled={isRunning || queuedCount === 0}
                >
                  {isRunning
                    ? "Parsing…"
                    : queuedCount > 0
                      ? `Parse ${queuedCount} file${queuedCount !== 1 ? "s" : ""}`
                      : "All done"}
                </button>
              </div>
            </div>

            <ul className="job-list">
              {jobs.map((job) => (
                <li key={job.clientId} className={`job-row job-${job.status}`}>
                  <div className="job-main">
                    <span className="job-name">{job.file.name}</span>
                    {job.status === "ok" && job.result && (
                      <span className="job-meta">
                        {job.result.message} · {job.result.days}d ·{" "}
                        {job.result.total_hours}h total
                      </span>
                    )}
                    {job.status === "error" && job.result && (
                      <span className="job-meta job-meta-error">{job.result.message}</span>
                    )}
                  </div>
                  <div className="job-side">
                    <StatusBadge status={job.status} />
                    {job.status === "ok" && job.result && (
                      <button
                        className="btn btn-small"
                        onClick={() => downloadResult(job.result!)}
                      >
                        Download
                      </button>
                    )}
                    {job.status !== "parsing" && (
                      <button
                        className="icon-btn"
                        aria-label="Remove"
                        onClick={() => removeJob(job.clientId)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      )}

      <footer className="footer">
        Uploaded PDFs are parsed and discarded — nothing is stored afterward.
      </footer>
    </div>
  );
}
