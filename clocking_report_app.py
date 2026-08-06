"""
Clocking Report Parser - Desktop App
======================================
A simple drag-and-drop GUI around clocking_report_parser.py.

Drop one or more Individual Clocking History PDFs (or a folder of them) onto
the window, or use "Browse...", then click "Parse". Each PDF's Timesheet
workbook is written next to its input file (or to the chosen output folder).

USAGE
-----
    pip install pdfplumber pandas openpyxl tkinterdnd2
    python clocking_report_app.py
"""

import queue
import sys
import threading
from pathlib import Path
from tkinter import BOTH, END, LEFT, RIGHT, X, Y, filedialog, messagebox
from tkinter import ttk

import clocking_report_parser as parser

try:
    from tkinterdnd2 import DND_FILES, TkinterDnD

    _HAS_DND = True
except ImportError:
    import tkinter as tk

    TkinterDnD = None
    _HAS_DND = False


APP_TITLE = "Clocking Report Parser"


class App:
    def __init__(self, root):
        self.root = root
        self.root.title(APP_TITLE)
        self.root.geometry("640x520")
        self.root.minsize(560, 420)

        self.input_paths = []
        self.output_dir = None
        self.msg_queue = queue.Queue()
        self.worker_running = False

        self._build_ui()
        self.root.after(100, self._poll_queue)

    # ------------------------------------------------------------------
    # UI
    # ------------------------------------------------------------------
    def _build_ui(self):
        pad = {"padx": 12, "pady": 8}

        header = ttk.Label(
            self.root, text=APP_TITLE, font=("Segoe UI", 14, "bold")
        )
        header.pack(anchor="w", **pad)

        sub = ttk.Label(
            self.root,
            text="Drag PDFs (or a folder of PDFs) into the box below, or use Browse.",
            foreground="#555555",
        )
        sub.pack(anchor="w", padx=12)

        self.drop_frame = ttk.Frame(self.root, relief="groove", borderwidth=2)
        self.drop_frame.pack(fill=BOTH, expand=False, padx=12, pady=8)

        self.file_list = ttk.Treeview(
            self.drop_frame, columns=("path",), show="", height=6, selectmode="extended"
        )
        self.file_list.pack(fill=BOTH, expand=True, side=LEFT, padx=(4, 0), pady=4)
        scrollbar = ttk.Scrollbar(self.drop_frame, orient="vertical", command=self.file_list.yview)
        scrollbar.pack(side=RIGHT, fill=Y)
        self.file_list.configure(yscrollcommand=scrollbar.set)

        if _HAS_DND:
            self.file_list.drop_target_register(DND_FILES)
            self.file_list.dnd_bind("<<Drop>>", self._on_drop)
        else:
            self.file_list.insert(
                "", END, values=("(drag-and-drop unavailable - use Browse below)",)
            )

        btn_row = ttk.Frame(self.root)
        btn_row.pack(fill=X, padx=12, pady=(0, 8))
        ttk.Button(btn_row, text="Browse PDF(s)...", command=self._browse_files).pack(side=LEFT)
        ttk.Button(btn_row, text="Browse Folder...", command=self._browse_folder).pack(
            side=LEFT, padx=8
        )
        ttk.Button(btn_row, text="Clear", command=self._clear_files).pack(side=LEFT)

        out_row = ttk.Frame(self.root)
        out_row.pack(fill=X, padx=12, pady=(0, 8))
        ttk.Label(out_row, text="Output folder:").pack(side=LEFT)
        self.output_label = ttk.Label(out_row, text="(same folder as each PDF)", foreground="#555555")
        self.output_label.pack(side=LEFT, padx=8)
        ttk.Button(out_row, text="Choose...", command=self._choose_output_dir).pack(side=RIGHT)
        ttk.Button(out_row, text="Default", command=self._reset_output_dir).pack(side=RIGHT, padx=8)

        action_row = ttk.Frame(self.root)
        action_row.pack(fill=X, padx=12, pady=(0, 8))
        self.parse_btn = ttk.Button(action_row, text="Parse", command=self._start_parse)
        self.parse_btn.pack(side=LEFT)
        self.open_out_btn = ttk.Button(
            action_row, text="Open Output Folder", command=self._open_last_output, state="disabled"
        )
        self.open_out_btn.pack(side=LEFT, padx=8)

        self.progress = ttk.Progressbar(self.root, mode="indeterminate")
        self.progress.pack(fill=X, padx=12, pady=(0, 8))

        log_label = ttk.Label(self.root, text="Log:")
        log_label.pack(anchor="w", padx=12)

        log_frame = ttk.Frame(self.root)
        log_frame.pack(fill=BOTH, expand=True, padx=12, pady=(0, 12))
        self.log_text = ttk_text(log_frame)
        self._last_output_dir = None

    # ------------------------------------------------------------------
    # File selection
    # ------------------------------------------------------------------
    def _on_drop(self, event):
        paths = self.root.tk.splitlist(event.data)
        self._add_paths(paths)

    def _browse_files(self):
        paths = filedialog.askopenfilenames(
            title="Select Individual Clocking History PDF(s)",
            filetypes=[("PDF files", "*.pdf")],
        )
        self._add_paths(paths)

    def _browse_folder(self):
        path = filedialog.askdirectory(title="Select a folder of clocking PDFs")
        if path:
            self._add_paths([path])

    def _add_paths(self, paths):
        for p in paths:
            p = str(Path(p))
            if p not in self.input_paths:
                self.input_paths.append(p)
                self.file_list.insert("", END, values=(p,))

    def _clear_files(self):
        self.input_paths = []
        for item in self.file_list.get_children():
            self.file_list.delete(item)

    def _choose_output_dir(self):
        path = filedialog.askdirectory(title="Choose output folder")
        if path:
            self.output_dir = path
            self.output_label.configure(text=path)

    def _reset_output_dir(self):
        self.output_dir = None
        self.output_label.configure(text="(same folder as each PDF)")

    # ------------------------------------------------------------------
    # Parsing
    # ------------------------------------------------------------------
    def _start_parse(self):
        if self.worker_running:
            return
        if not self.input_paths:
            messagebox.showwarning(APP_TITLE, "Add at least one PDF or folder first.")
            return

        self.log_text.delete("1.0", END)
        self.parse_btn.configure(state="disabled")
        self.open_out_btn.configure(state="disabled")
        self.progress.start(10)
        self.worker_running = True

        thread = threading.Thread(target=self._run_worker, daemon=True)
        thread.start()

    def _run_worker(self):
        def log(msg):
            self.msg_queue.put(("log", msg))

        try:
            ok, failed = parser.run_batch(
                self.input_paths, output_dir=self.output_dir, log=log
            )
            self.msg_queue.put(("done", (ok, failed)))
        except Exception as e:
            self.msg_queue.put(("error", str(e)))

    def _poll_queue(self):
        try:
            while True:
                kind, payload = self.msg_queue.get_nowait()
                if kind == "log":
                    self.log_text.insert(END, payload + "\n")
                    self.log_text.see(END)
                elif kind == "done":
                    self._on_done(*payload)
                elif kind == "error":
                    self._on_error(payload)
        except queue.Empty:
            pass
        self.root.after(100, self._poll_queue)

    def _on_done(self, ok, failed):
        self.progress.stop()
        self.parse_btn.configure(state="normal")
        self.worker_running = False

        if ok:
            self._last_output_dir = str(Path(ok[0][1]).parent)
            self.open_out_btn.configure(state="normal")

        summary = f"Finished: {len(ok)} succeeded, {len(failed)} failed."
        self.log_text.insert(END, summary + "\n")
        self.log_text.see(END)

        if failed:
            messagebox.showwarning(APP_TITLE, summary + "\nSee the log for details.")
        else:
            messagebox.showinfo(APP_TITLE, summary)

    def _on_error(self, message):
        self.progress.stop()
        self.parse_btn.configure(state="normal")
        self.worker_running = False
        self.log_text.insert(END, f"ERROR: {message}\n")
        messagebox.showerror(APP_TITLE, message)

    def _open_last_output(self):
        if self._last_output_dir:
            import os

            os.startfile(self._last_output_dir)


def ttk_text(parent):
    import tkinter as tk

    text = tk.Text(parent, wrap="word", height=10, font=("Consolas", 9))
    text.pack(side=LEFT, fill=BOTH, expand=True)
    scrollbar = ttk.Scrollbar(parent, orient="vertical", command=text.yview)
    scrollbar.pack(side=RIGHT, fill=Y)
    text.configure(yscrollcommand=scrollbar.set)
    return text


def main():
    root = TkinterDnD.Tk() if _HAS_DND else __import__("tkinter").Tk()
    App(root)
    root.mainloop()


if __name__ == "__main__":
    main()
