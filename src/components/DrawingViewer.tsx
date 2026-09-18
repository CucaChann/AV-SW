import { isTauri } from "@tauri-apps/api/core";
import {
  ChangeEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import DxfCanvas from "./DxfCanvas";
import {
  parseDxf,
  type DrawingAnalysis,
  type DraftRecommendation,
  type ParsedDxfDrawing,
} from "../lib/dxf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;

type DrawingKind = "pdf" | "dxf" | null;

type Props = {
  onAnalysisChange?: (analysis: DrawingAnalysis | null) => void;
  onDraftChange?: (recommendations: DraftRecommendation[]) => void;
};

function fileNameFromPath(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

function extensionOf(name: string) {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index + 1).toLowerCase() : "";
}

export default function DrawingViewer({
  onAnalysisChange,
  onDraftChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const browserInputRef = useRef<HTMLInputElement>(null);

  const [drawingKind, setDrawingKind] = useState<DrawingKind>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [dxfDrawing, setDxfDrawing] = useState<ParsedDxfDrawing | null>(null);
  const [fileName, setFileName] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [rendering, setRendering] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 24, y: 24 });
  const [dragging, setDragging] = useState(false);

  const dragOffset = useRef({ x: 0, y: 0 });

  const naturalSize = useCallback(() => {
    if (drawingKind === "pdf") {
      const canvas = canvasRef.current;
      if (canvas?.width && canvas?.height) {
        return { width: canvas.width, height: canvas.height };
      }
    }

    if (drawingKind === "dxf" && dxfDrawing) {
      return {
        width: dxfDrawing.analysis.bounds.width,
        height: dxfDrawing.analysis.bounds.height,
      };
    }

    return null;
  }, [drawingKind, dxfDrawing]);

  const fitToView = useCallback(() => {
    const container = containerRef.current;
    const size = naturalSize();

    if (!container || !size) return;

    const padding = 48;
    const availableWidth = Math.max(container.clientWidth - padding, 1);
    const availableHeight = Math.max(container.clientHeight - padding, 1);

    const nextZoom = Math.min(
      availableWidth / size.width,
      availableHeight / size.height,
      4,
    );

    const clampedZoom = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, nextZoom),
    );

    setZoom(clampedZoom);
    setPan({
      x: (container.clientWidth - size.width * clampedZoom) / 2,
      y: (container.clientHeight - size.height * clampedZoom) / 2,
    });
  }, [naturalSize]);

  useEffect(() => {
    if (drawingKind !== "pdf" || !document) return;

    let cancelled = false;

    async function renderPage() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      setRendering(true);

      try {
        const page = await document.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.5 });
        const context = canvas.getContext("2d");

        if (!context || cancelled) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;

        if (!cancelled) {
          requestAnimationFrame(fitToView);
        }
      } catch (renderError) {
        if (!cancelled) {
          setError(
            renderError instanceof Error
              ? renderError.message
              : "Unable to render this PDF page.",
          );
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
    };
  }, [document, drawingKind, fitToView, pageNumber]);

  useEffect(() => {
    if (drawingKind === "dxf" && dxfDrawing) {
      requestAnimationFrame(fitToView);
    }
  }, [drawingKind, dxfDrawing, fitToView]);

  const resetDrawingState = useCallback(() => {
    setDocument(null);
    setDxfDrawing(null);
    setPageNumber(1);
    setZoom(1);
    setPan({ x: 24, y: 24 });
    onAnalysisChange?.(null);
    onDraftChange?.([]);
  }, [onAnalysisChange, onDraftChange]);

  const loadPdf = useCallback(
    async (bytes: Uint8Array, name: string) => {
      setError(null);
      setOpening(true);
      resetDrawingState();

      try {
        const loadingTask = pdfjs.getDocument({ data: bytes });
        const nextDocument = await loadingTask.promise;

        setDocument(nextDocument);
        setDrawingKind("pdf");
        setFileName(name);
      } catch (openError) {
        setDrawingKind(null);
        setError(
          openError instanceof Error
            ? openError.message
            : "Unable to open the selected PDF.",
        );
      } finally {
        setOpening(false);
      }
    },
    [resetDrawingState],
  );

  const loadDxf = useCallback(
    async (text: string, name: string) => {
      setError(null);
      setOpening(true);
      resetDrawingState();

      try {
        const parsed = parseDxf(text);
        setDxfDrawing(parsed);
        setDrawingKind("dxf");
        setFileName(name);
        onAnalysisChange?.(parsed.analysis);
      } catch (openError) {
        setDrawingKind(null);
        setError(
          openError instanceof Error
            ? openError.message
            : "Unable to parse the selected DXF.",
        );
      } finally {
        setOpening(false);
      }
    },
    [onAnalysisChange, resetDrawingState],
  );

  const loadByExtension = useCallback(
    async (name: string, bytes: Uint8Array) => {
      const extension = extensionOf(name);

      if (extension === "pdf") {
        await loadPdf(bytes, name);
        return;
      }

      if (extension === "dxf") {
        const text = new TextDecoder("utf-8").decode(bytes);
        await loadDxf(text, name);
        return;
      }

      setError("AV-SW currently supports PDF and DXF drawings. DWG comes later.");
    },
    [loadDxf, loadPdf],
  );

  const openDrawing = useCallback(async () => {
    if (!isTauri()) {
      browserInputRef.current?.click();
      return;
    }

    setError(null);
    setOpening(true);

    try {
      const [{ open }, { readFile }] = await Promise.all([
        import("@tauri-apps/plugin-dialog"),
        import("@tauri-apps/plugin-fs"),
      ]);

      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "AV-SW Drawing",
            extensions: ["pdf", "dxf"],
          },
        ],
      });

      if (!selected || Array.isArray(selected)) {
        setOpening(false);
        return;
      }

      const bytes = await readFile(selected);
      await loadByExtension(fileNameFromPath(selected), bytes);
    } catch (openError) {
      setOpening(false);
      setError(
        openError instanceof Error
          ? openError.message
          : "Unable to open the selected drawing.",
      );
    }
  }, [loadByExtension]);

  useEffect(() => {
    const listener = () => {
      void openDrawing();
    };

    window.addEventListener("avsw:open-floorplan", listener);

    return () => {
      window.removeEventListener("avsw:open-floorplan", listener);
    };
  }, [openDrawing]);

  async function handleBrowserFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = extensionOf(file.name);
    if (extension !== "pdf" && extension !== "dxf") {
      setError("Please choose a PDF or DXF drawing.");
      event.target.value = "";
      return;
    }

    await loadByExtension(file.name, new Uint8Array(await file.arrayBuffer()));
    event.target.value = "";
  }

  function changeZoom(delta: number) {
    setZoom((current) =>
      Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current + delta)),
    );
  }

  function beginPan(event: MouseEvent<HTMLDivElement>) {
    if (!drawingKind) return;

    setDragging(true);
    dragOffset.current = {
      x: event.clientX - pan.x,
      y: event.clientY - pan.y,
    };
  }

  function movePan(event: MouseEvent<HTMLDivElement>) {
    if (!dragging) return;

    setPan({
      x: event.clientX - dragOffset.current.x,
      y: event.clientY - dragOffset.current.y,
    });
  }

  function stopPan() {
    setDragging(false);
  }

  function generateFirstDraft() {
    if (!dxfDrawing) return;
    onDraftChange?.(dxfDrawing.recommendations);
  }

  const zoomPercent = Math.round(zoom * 100);
  const hasDrawing = Boolean(drawingKind);

  return (
    <section className="canvas-wrap">
      <div className="canvas-toolbar">
        <button onClick={() => void openDrawing()} disabled={opening}>
          {opening ? "Opening…" : "Open Drawing"}
        </button>

        <span className="toolbar-divider" />

        <button
          onClick={() => changeZoom(-0.1)}
          disabled={!hasDrawing}
          aria-label="Zoom out"
        >
          −
        </button>
        <span>{zoomPercent}%</span>
        <button
          onClick={() => changeZoom(0.1)}
          disabled={!hasDrawing}
          aria-label="Zoom in"
        >
          +
        </button>
        <button onClick={fitToView} disabled={!hasDrawing}>
          Fit
        </button>

        {drawingKind === "pdf" && document && (
          <>
            <span className="toolbar-divider" />
            <button
              onClick={() => setPageNumber((page) => Math.max(1, page - 1))}
              disabled={pageNumber <= 1}
            >
              Prev
            </button>

            <span className="page-status">
              Page {pageNumber} / {document.numPages}
            </span>

            <button
              onClick={() =>
                setPageNumber((page) => Math.min(document.numPages, page + 1))
              }
              disabled={pageNumber >= document.numPages}
            >
              Next
            </button>
          </>
        )}

        {drawingKind === "dxf" && dxfDrawing && (
          <>
            <span className="toolbar-divider" />
            <span className="drawing-type-badge">DXF</span>
            <button onClick={generateFirstDraft}>Generate First Draft</button>
          </>
        )}

        {hasDrawing && (
          <span className="file-name" title={fileName}>
            {fileName}
          </span>
        )}
      </div>

      <input
        ref={browserInputRef}
        className="visually-hidden"
        type="file"
        accept=".pdf,.dxf,application/pdf"
        onChange={handleBrowserFile}
      />

      <div
        ref={containerRef}
        className={`canvas ${hasDrawing ? "has-document" : ""} ${dragging ? "is-dragging" : ""}`}
        onMouseDown={beginPan}
        onMouseMove={movePan}
        onMouseUp={stopPan}
        onMouseLeave={stopPan}
      >
        {!hasDrawing ? (
          <div className="canvas-placeholder">
            <div className="plan-mark">+</div>
            <h1>Drawing Canvas</h1>
            <p>
              {isTauri()
                ? "Open a local PDF or DXF drawing to start designing."
                : "Browser development mode — choose a PDF or DXF drawing."}
            </p>
            <button className="primary" onClick={() => void openDrawing()}>
              Open Drawing
            </button>
            <p className="format-note">Supported now: PDF, DXF · Planned: DWG</p>
            {error && <p className="error-text">{error}</p>}
          </div>
        ) : (
          <div
            className="drawing-stage"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            {drawingKind === "pdf" && (
              <>
                <canvas ref={canvasRef} className="pdf-canvas" />
                {rendering && <div className="rendering-badge">Rendering…</div>}
              </>
            )}

            {drawingKind === "dxf" && dxfDrawing && (
              <DxfCanvas drawing={dxfDrawing} />
            )}
          </div>
        )}

        {hasDrawing && error && <div className="canvas-error">{error}</div>}
      </div>
    </section>
  );
}
