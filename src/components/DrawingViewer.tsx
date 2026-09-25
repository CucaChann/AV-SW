import { isTauri } from "@tauri-apps/api/core";
import {
  MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
// Legacy build: it polyfills newer JS APIs (e.g. Map.getOrInsertComputed) that
// pdf.js 6 relies on, which the desktop WebViews (WebView2, WKWebView,
// WebKitGTK) may not have yet.
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import DxfCanvas from "./DxfCanvas";
import {
  parseDxf,
  type DrawingAnalysis,
  type DraftRecommendation,
  type ParsedDxfDrawing,
} from "../lib/dxf";
import type { ProjectDrawing } from "../lib/projectFile";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;

type DrawingKind = "pdf" | "dxf" | null;

type Props = {
  /** The project's active drawing; the viewer shows whatever it is given. */
  drawing: ProjectDrawing | null;
  /** Asks the app to pick a drawing and add it to the project. */
  onOpenDrawing: () => void;
  onAnalysisChange?: (analysis: DrawingAnalysis | null) => void;
  onDraftChange?: (recommendations: DraftRecommendation[]) => void;
};

export default function DrawingViewer({
  drawing,
  onOpenDrawing,
  onAnalysisChange,
  onDraftChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onAnalysisChangeRef = useRef(onAnalysisChange);
  onAnalysisChangeRef.current = onAnalysisChange;

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

    const pdf = document;
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    async function renderPage() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      setRendering(true);

      try {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.5 });

        if (cancelled) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        renderTask = page.render({
          canvas,
          viewport,
        });
        await renderTask.promise;

        if (!cancelled) {
          setError(null);
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
      // Frees the canvas so the next page can render; pdf.js rejects a second
      // render on a canvas that is still in use.
      renderTask?.cancel();
    };
  }, [document, drawingKind, fitToView, pageNumber]);

  useEffect(() => {
    if (!document) return;
    return () => {
      void document.loadingTask.destroy();
    };
  }, [document]);

  useEffect(() => {
    if (drawingKind === "dxf" && dxfDrawing) {
      requestAnimationFrame(fitToView);
    }
  }, [drawingKind, dxfDrawing, fitToView]);

  // Load whenever the project's active drawing changes (new, opened or replaced).
  const drawingId = drawing?.id ?? null;
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setDocument(null);
    setDxfDrawing(null);
    setPageNumber(1);
    setZoom(1);
    setPan({ x: 24, y: 24 });
    onAnalysisChangeRef.current?.(null);

    if (!drawing) {
      setDrawingKind(null);
      setFileName("");
      return;
    }

    setFileName(drawing.name);
    setOpening(true);

    async function load(current: ProjectDrawing) {
      try {
        if (current.kind === "pdf") {
          // pdf.js takes ownership of the bytes it is given; keep the project's copy intact.
          const nextDocument = await pdfjs.getDocument({ data: current.bytes.slice() }).promise;
          if (cancelled) {
            void nextDocument.loadingTask.destroy();
            return;
          }
          setDocument(nextDocument);
          setDrawingKind("pdf");
        } else {
          const parsed = parseDxf(new TextDecoder("utf-8").decode(current.bytes));
          if (cancelled) return;
          setDxfDrawing(parsed);
          setDrawingKind("dxf");
          onAnalysisChangeRef.current?.(parsed.analysis);
        }
      } catch (openError) {
        if (cancelled) return;
        setDrawingKind(null);
        setError(
          openError instanceof Error
            ? openError.message
            : `Unable to open ${current.name}.`,
        );
      } finally {
        if (!cancelled) setOpening(false);
      }
    }

    void load(drawing);
    return () => {
      cancelled = true;
    };
    // Keyed by id: a drawing's bytes never change once it is in the project.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawingId]);

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
  const hasDrawingSelected = Boolean(drawing);

  return (
    <section className="canvas-wrap">
      <div className="canvas-toolbar">
        <button onClick={onOpenDrawing} disabled={opening}>
          {opening ? "Opening…" : hasDrawingSelected ? "Replace Drawing" : "Open Drawing"}
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
            <button className="primary" onClick={onOpenDrawing}>
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
