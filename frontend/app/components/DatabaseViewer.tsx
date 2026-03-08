"use client";

import { FormEvent, useState } from "react";
import { anyApi } from "convex/server";
import { useQuery } from "convex/react";
import { ChevronDown, Database, ImageIcon, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";

type TableRows = Record<string, unknown[]>;

type DbSnapshot = {
  generatedAt: string;
  tables: TableRows;
};

type TableSectionProps = {
  defaultOpen?: boolean;
  rows: unknown[];
  tableName: string;
};

const DB_ACCESS_CODE = "4604";
const DB_DIAGRAM_URL = "/er-diagram.svg";
const DB_DIAGRAM_SVG_URL = DB_DIAGRAM_URL;
const DB_DIAGRAM_WIDTH = 7268.75;
const DB_DIAGRAM_HEIGHT = 1960;

function parseSvgLength(value: string | null) {
  if (!value) return NaN;
  return Number.parseFloat(value);
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.click();
}

async function saveDiagramAsPng() {
  const response = await fetch(DB_DIAGRAM_SVG_URL);
  if (!response.ok) {
    throw new Error("Failed to download ER diagram SVG.");
  }

  const svgText = await response.text();
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
  const svgElement = svgDoc.documentElement;
  const viewBox = svgElement.getAttribute("viewBox")?.split(/\s+/).map(Number) ?? [];
  const widthAttr = parseSvgLength(svgElement.getAttribute("width"));
  const heightAttr = parseSvgLength(svgElement.getAttribute("height"));
  const width = Number.isFinite(widthAttr) && widthAttr > 0 ? widthAttr : viewBox[2];
  const height = Number.isFinite(heightAttr) && heightAttr > 0 ? heightAttr : viewBox[3];

  if (!width || !height) {
    throw new Error("Could not determine ER diagram size.");
  }

  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to render ER diagram."));
      img.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas export is unavailable.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);

    triggerDownload(canvas.toDataURL("image/png"), "er-diagram.png");
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function formatCellValue(value: unknown) {
  if (value === null) return "null";
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

function getTableColumns(rows: unknown[]) {
  const columns = new Set<string>();

  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    for (const key of Object.keys(row)) {
      columns.add(key);
    }
  }

  return Array.from(columns).sort((a, b) => a.localeCompare(b));
}

function TableSection({ defaultOpen = false, rows, tableName }: TableSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const columns = getTableColumns(rows);

  return (
    <details
      open={isOpen}
      onToggle={(event) => {
        setIsOpen(event.currentTarget.open);
      }}
      className="group overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-sm"
    >
      <summary className="list-none cursor-pointer px-4 py-3.5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-5 text-foreground">{tableName}</h2>
              <p className="text-xs text-muted-foreground">
                {rows.length} rows
                {columns.length > 0 ? ` • ${columns.length} columns` : ""}
              </p>
            </div>
          </div>

          <div className="rounded-full border border-border bg-background/80 p-1.5 text-muted-foreground">
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </div>
        </div>
      </summary>

      <div className="border-t border-border/70 px-4 pb-4 pt-3">
        <div className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="border-b border-border bg-muted/40 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {tableName}
            </p>
          </div>

          {rows.length === 0 ? (
            <div className="px-3 py-5 text-sm text-muted-foreground">
              No rows in this table.
            </div>
          ) : columns.length === 0 ? (
            <div className="px-3 py-5 text-sm text-muted-foreground">
              This table contains rows that could not be rendered as objects.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-[11px]">
                <thead className="bg-muted/50">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column}
                        className="border-b border-border px-2 py-1.5 align-top font-semibold text-foreground"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => {
                    const record =
                      row && typeof row === "object" && !Array.isArray(row)
                        ? (row as Record<string, unknown>)
                        : {};

                    return (
                      <tr key={rowIndex} className="odd:bg-background even:bg-muted/20">
                        {columns.map((column) => (
                          <td
                            key={`${rowIndex}-${column}`}
                            className="max-w-[240px] border-b border-border/70 px-2 py-1.5 align-top text-muted-foreground"
                          >
                            <pre className="whitespace-pre-wrap break-words font-mono text-[10px] leading-4">
                              {formatCellValue(record[column])}
                            </pre>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

export function DatabaseViewer() {
  const [accessCode, setAccessCode] = useState("");
  const [hasAccess, setHasAccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [isSavingDiagram, setIsSavingDiagram] = useState(false);
  const [isDiagramOpen, setIsDiagramOpen] = useState(false);
  const [isTablesOpen, setIsTablesOpen] = useState(false);

  const snapshot = useQuery(anyApi.publicDbView.getAllAppTables, {}) as
    | DbSnapshot
    | undefined;

  const handleUnlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const matches = accessCode.trim() === DB_ACCESS_CODE;
    setShowError(!matches);

    if (!matches) return;

    setHasAccess(true);
  };

  const handleSaveDiagramAsPng = async () => {
    if (isSavingDiagram) return;

    setIsSavingDiagram(true);
    try {
      await saveDiagramAsPng();
    } finally {
      setIsSavingDiagram(false);
    }
  };

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,rgba(217,119,6,0.07),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.03),rgba(15,23,42,0.08))] px-4 py-8 text-foreground sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl">
          <section className="rounded-3xl border border-border/70 bg-card/95 p-6 shadow-sm backdrop-blur-sm sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div className="mt-5 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-primary">
                Restricted Access
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">
                Database Information
              </h1>
              <p className="text-sm text-muted-foreground">
                Enter the access code to view the Convex database information page.
              </p>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleUnlock}>
              <div className="space-y-1.5">
                <label htmlFor="db-access-code" className="block text-sm font-medium">
                  Access code
                </label>
                <input
                  id="db-access-code"
                  type="password"
                  value={accessCode}
                  onChange={(event) => {
                    setAccessCode(event.target.value);
                    if (showError) setShowError(false);
                  }}
                  placeholder="Enter code"
                  className={`form-input bg-background ${showError ? "border-red-500 ring-2 ring-red-500/15" : ""}`}
                />
                {showError ? (
                  <p className="text-sm text-red-600">
                    Incorrect code. Try again.
                  </p>
                ) : null}
              </div>

              <Button type="submit" className="w-full sm:w-auto">
                Unlock
              </Button>
            </form>
          </section>
        </div>
      </main>
    );
  }

  if (snapshot === undefined) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,rgba(217,119,6,0.07),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.03),rgba(15,23,42,0.08))] px-4 py-8 text-foreground sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-border/70 bg-card/90 p-8 shadow-sm">
            <h1 className="text-3xl font-semibold tracking-tight">
              Database Information
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Loading production data from Convex...
            </p>
          </div>
        </div>
      </main>
    );
  }

  const entries = Object.entries(snapshot.tables)
    .sort(([left], [right]) => left.localeCompare(right)) as [string, unknown[]][];
  const totalRows = entries.reduce((count, [, rows]) => count + rows.length, 0);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,rgba(217,119,6,0.07),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.03),rgba(15,23,42,0.08))] px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px] space-y-6">
        <header className="rounded-3xl border border-border/70 bg-card/90 p-6 shadow-sm backdrop-blur-sm sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-primary">
                Public Convex Snapshot
              </p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Database Information
              </h1>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-background/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Tables
                </p>
                <p className="mt-1 text-2xl font-semibold">{entries.length}</p>
              </div>
              <div className="rounded-2xl border border-border bg-background/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Rows
                </p>
                <p className="mt-1 text-2xl font-semibold">{totalRows}</p>
              </div>
              <div className="col-span-2 rounded-2xl border border-border bg-background/80 px-4 py-3 sm:col-span-1">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Generated
                </p>
                <p className="mt-1 text-sm font-medium leading-5">
                  {new Date(snapshot.generatedAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="space-y-4">
          <details
            open={isDiagramOpen}
            onToggle={(event) => {
              setIsDiagramOpen(event.currentTarget.open);
            }}
            className="group overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-sm"
          >
            <summary className="list-none cursor-pointer px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">ER Diagram (UML)</h2>
                  <p className="text-sm text-muted-foreground">
                    Expand to view the ER Diagram
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(event) => {
                      event.preventDefault();
                      void handleSaveDiagramAsPng();
                    }}
                    disabled={isSavingDiagram}
                  >
                    <ImageIcon className="h-4 w-4" />
                    {isSavingDiagram ? "Saving PNG..." : "Save PNG"}
                  </Button>
                  <div className="rounded-full border border-border bg-background/80 p-2 text-muted-foreground">
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${isDiagramOpen ? "rotate-180" : ""}`}
                    />
                  </div>
                </div>
              </div>
            </summary>
            <div className="border-t border-border/70 bg-background p-3">
              <div className="overflow-x-auto">
                <div
                  className="w-max"
                  style={{ minWidth: `${DB_DIAGRAM_WIDTH}px` }}
                >
                  <img
                    alt="Database ER Diagram"
                    src={DB_DIAGRAM_URL}
                    className="block rounded-xl border border-border bg-white"
                    style={{
                      width: `${DB_DIAGRAM_WIDTH}px`,
                      height: `${DB_DIAGRAM_HEIGHT}px`,
                    }}
                  />
                </div>
              </div>
            </div>
          </details>

          <details
            open={isTablesOpen}
            onToggle={(event) => {
              setIsTablesOpen(event.currentTarget.open);
            }}
            className="group overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-sm"
          >
            <summary className="list-none cursor-pointer px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">All tables</h2>
                  <p className="text-sm text-muted-foreground">
                    Expand to browse all the tables in the Convex DB (live)
                  </p>
                </div>
                <div className="rounded-full border border-border bg-background/80 p-2 text-muted-foreground">
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isTablesOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </div>
            </summary>

            <div className="border-t border-border/70 px-4 pb-4 pt-4">
              <div className="space-y-4">
                {entries.map(([tableName, rows]) => (
                  <TableSection
                    key={tableName}
                    tableName={tableName}
                    rows={rows}
                    defaultOpen={false}
                  />
                ))}
              </div>
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}
