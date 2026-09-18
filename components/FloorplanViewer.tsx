"use client";

import { ChangeEvent, MouseEvent, useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;

export default function FloorplanViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [pageNumber, setPageNumber] = useState(1);
  const [rendering, setRendering] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 24, y: 24 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

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
          requestAnimationFrame(() => fitToView());
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
    };
    // fitToView intentionally runs after each page render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, pageNumber]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please choose a PDF floorplan.");
      event.target.value = "";
      return;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const loadingTask = pdfjs.getDocument({ data: bytes });
    const nextDocument = await loadingTask.promise;

    setDocument(nextDocument);
    setFileName(file.name);
    setPageNumber(1);
    setZoom(1);
    setPan({ x: 24, y: 24 });
  }

  function fitToView() {
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

    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
    setZoom(clampedZoom);
    setPan({
      x: (container.clientWidth - canvas.width * clampedZoom) / 2,
      y: (container.clientHeight - canvas.height * clampedZoom) / 2,
    });
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
        <label className="toolbar-button" htmlFor="floorplan-upload">
          Upload PDF
        </label>

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
        id="floorplan-upload"
        className="visually-hidden"
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFile}
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
            <p>Upload a PDF floorplan to start designing.</p>
            <label className="primary upload-label" htmlFor="floorplan-upload">
              Upload Floorplan
            </label>
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
      </div>
    </section>
  );
}
