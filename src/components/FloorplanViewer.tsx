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

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;

function fileNameFromPath(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

export default function FloorplanViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const browserInputRef = useRef<HTMLInputElement>(null);

  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [fileName, setFileName] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [rendering, setRendering] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 24, y: 24 });
  const [dragging, setDragging] = useState(false);

  const dragOffset = useRef({ x: 0, y: 0 });

  const fitToView = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;

    if (!container || !canvas || !canvas.width || !canvas.height) return;

    const padding = 48;
    const availableWidth = Math.max(container.clientWidth - padding, 1);
    const availableHeight = Math.max(container.clientHeight - padding, 1);

    const nextZoom = Math.min(
      availableWidth / canvas.width,
      availableHeight / canvas.height,
      1.5,
    );

    const clampedZoom = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, nextZoom),
    );

    setZoom(clampedZoom);
    setPan({
      x: (container.clientWidth - canvas.width * clampedZoom) / 2,
      y: (container.clientHeight - canvas.height * clampedZoom) / 2,
    });
  }, []);

  useEffect(() => {
    if (!document) return;

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
  }, [document, fitToView, pageNumber]);

  const loadPdf = useCallback(async (bytes: Uint8Array, name: string) => {
    setError(null);
    setOpening(true);

    try {
      const loadingTask = pdfjs.getDocument({ data: bytes });
      const nextDocument = await loadingTask.promise;

      setDocument(nextDocument);
      setFileName(name);
      setPageNumber(1);
      setZoom(1);
      setPan({ x: 24, y: 24 });
    } catch (openError) {
      setError(
        openError instanceof Error
          ? openError.message
          : "Unable to open the selected PDF.",
      );
    } finally {
      setOpening(false);
    }
  }, []);

  const openFloorplan = useCallback(async () => {
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
            name: "PDF Floorplan",
            extensions: ["pdf"],
          },
        ],
      });

      if (!selected || Array.isArray(selected)) {
        setOpening(false);
        return;
      }

      const bytes = await readFile(selected);
      await loadPdf(bytes, fileNameFromPath(selected));
    } catch (openError) {
      setOpening(false);
      setError(
        openError instanceof Error
          ? openError.message
          : "Unable to open the selected floorplan.",
      );
    }
  }, [loadPdf]);

  useEffect(() => {
    const listener = () => {
      void openFloorplan();
    };

    window.addEventListener("avsw:open-floorplan", listener);

    return () => {
      window.removeEventListener("avsw:open-floorplan", listener);
    };
  }, [openFloorplan]);

  async function handleBrowserFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Please choose a PDF floorplan.");
      event.target.value = "";
      return;
    }

    await loadPdf(new Uint8Array(await file.arrayBuffer()), file.name);
    event.target.value = "";
  }

  function changeZoom(delta: number) {
    setZoom((current) =>
      Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current + delta)),
    );
  }

  function beginPan(event: MouseEvent<HTMLDivElement>) {
    if (!document) return;

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

  const zoomPercent = Math.round(zoom * 100);

  return (
    <section className="canvas-wrap">
      <div className="canvas-toolbar">
        <button onClick={() => void openFloorplan()} disabled={opening}>
          {opening ? "Opening…" : "Open PDF"}
        </button>

        <span className="toolbar-divider" />

        <button
          onClick={() => changeZoom(-0.1)}
          disabled={!document}
          aria-label="Zoom out"
        >
          −
        </button>
        <span>{zoomPercent}%</span>
        <button
          onClick={() => changeZoom(0.1)}
          disabled={!document}
          aria-label="Zoom in"
        >
          +
        </button>
        <button onClick={fitToView} disabled={!document}>
          Fit
        </button>

        {document && (
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

            <span className="file-name" title={fileName}>
              {fileName}
            </span>
          </>
        )}
      </div>

      <input
        ref={browserInputRef}
        className="visually-hidden"
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleBrowserFile}
      />

      <div
        ref={containerRef}
        className={`canvas ${document ? "has-document" : ""} ${dragging ? "is-dragging" : ""}`}
        onMouseDown={beginPan}
        onMouseMove={movePan}
        onMouseUp={stopPan}
        onMouseLeave={stopPan}
      >
        {!document ? (
          <div className="canvas-placeholder">
            <div className="plan-mark">+</div>
            <h1>Floorplan Canvas</h1>
            <p>
              {isTauri()
                ? "Open a local PDF floorplan to start designing."
                : "Browser development mode — choose a PDF floorplan."}
            </p>
            <button className="primary" onClick={() => void openFloorplan()}>
              Open Floorplan
            </button>
            {error && <p className="error-text">{error}</p>}
          </div>
        ) : (
          <div
            className="pdf-stage"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            <canvas ref={canvasRef} className="pdf-canvas" />
            {rendering && <div className="rendering-badge">Rendering…</div>}
          </div>
        )}

        {document && error && <div className="canvas-error">{error}</div>}
      </div>
    </section>
  );
}
