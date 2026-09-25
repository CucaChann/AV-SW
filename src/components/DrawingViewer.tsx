import { isTauri } from "@tauri-apps/api/core";
import {
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
// Legacy build: it polyfills newer JS APIs (e.g. Map.getOrInsertComputed) that
// pdf.js 6 relies on, which the desktop WebViews (WebView2, WKWebView,
// WebKitGTK) may not have yet.
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import DxfCanvas from "./DxfCanvas";
import DesignPanel from "./plan/DesignPanel";
import { reviewMatchesSheet, toolAfterPageChange, type AlignReview, type Tool } from "./plan/editorTools";
import ItemCard from "./plan/ItemCard";
import PlanOverlay, { type PlanPreview } from "./plan/PlanOverlay";
import ScaleMenu from "./plan/ScaleMenu";
import { deviceType, type LayerKey } from "../lib/deviceCatalog";
import {
  parseDxf,
  type DrawingAnalysis,
  type DraftRecommendation,
  type ParsedDxfDrawing,
} from "../lib/dxf";
import { effectiveScale } from "../lib/designBom";
import {
  distance,
  formatFeet,
  alignSheet,
  itemCenter,
  itemsOnSheet,
  markSheetVerified,
  layerOf,
  nearestRoom,
  newItemId,
  nextTag,
  parseFeet,
  polylineLength,
  runLengthFt,
  scaleFor,
  unverifiedSheet,
  withScale,
  type DrawingScale,
  type PlanDesign,
  type PlanItem,
  type PlanPoint,
} from "../lib/planDesign";
import {
  dxfSheet,
  fitRect,
  panForZoom,
  panToCenter,
  applySimilarity,
  pdfSheet,
  rigidFromPairs,
  similarityAngleDeg,
  similarityFromPairs,
  similarityScale,
  usableAlignment,
  type PointPair,
  type Similarity,
  PDF_RENDER_SCALE,
  snapAngle,
  type SheetGeometry,
} from "../lib/planGeometry";
import type { ProjectDrawing } from "../lib/projectFile";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
/** Pointer travel (px) that turns a click into a pan or drag. */
const DRAG_THRESHOLD = 4;

type DrawingKind = "pdf" | "dxf" | null;

export type DesignChange = {
  /** Merge consecutive edits with the same key into one undo step (typing). */
  coalesce?: string;
  /** Part of a drag already recorded for undo. */
  live?: boolean;
};

type Props = {
  /** The project's active drawing; the viewer shows whatever it is given. */
  drawing: ProjectDrawing | null;
  design: PlanDesign;
  /** False while a project tool covers the viewer; keyboard shortcuts pause. */
  active: boolean;
  onDesignChange: (next: PlanDesign, change?: DesignChange) => void;
  /** Asks the app to pick a drawing and add it to the project. */
  onOpenDrawing: () => void;
  /** The parsed DXF's analysis, with the drawing it belongs to (null while none). */
  onAnalysisChange?: (analysis: DrawingAnalysis | null, drawingId: string | null) => void;
  onDraftChange?: (recommendations: DraftRecommendation[]) => void;
  /** Extra buttons in the selected item's card (e.g. QTL Studio link). */
  itemActions?: (item: PlanItem, lengthFt: number | null) => ReactNode;
};

function isTyping(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return Boolean(
    element &&
      (element.tagName === "INPUT" ||
        element.tagName === "TEXTAREA" ||
        element.tagName === "SELECT" ||
        element.isContentEditable),
  );
}

/** Drops points that repeat the previous one (the two clicks of a double-click). */
function withoutRepeats(points: PlanPoint[], tolerance: number) {
  return points.filter((point, index) => index === 0 || distance(point, points[index - 1]) > tolerance);
}

function moveItem(item: PlanItem, dx: number, dy: number): PlanItem {
  return item.kind === "device"
    ? { ...item, at: { x: item.at.x + dx, y: item.at.y + dy } }
    : { ...item, points: item.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) };
}

export default function DrawingViewer({
  drawing,
  design,
  active,
  onDesignChange,
  onOpenDrawing,
  onAnalysisChange,
  onDraftChange,
  itemActions,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onAnalysisChangeRef = useRef(onAnalysisChange);
  onAnalysisChangeRef.current = onAnalysisChange;

  const [drawingKind, setDrawingKind] = useState<DrawingKind>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [dxfDrawing, setDxfDrawing] = useState<ParsedDxfDrawing | null>(null);
  const [pdfSize, setPdfSize] = useState<{ width: number; height: number } | null>(null);
  const [fileName, setFileName] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [rendering, setRendering] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 24, y: 24 });
  const [dragging, setDragging] = useState(false);

  // Floor plan editor
  const [tool, setTool] = useState<Tool>({ kind: "select" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<LayerKey>("lighting");
  const [panelOpen, setPanelOpen] = useState(true);
  const [showTags, setShowTags] = useState(true);
  const [cursor, setCursor] = useState<PlanPoint | null>(null);
  const [calibration, setCalibration] = useState<{ points: PlanPoint[]; value: string; error?: string } | null>(null);
  const [alignReview, setAlignReview] = useState<AlignReview | null>(null);

  const view = useRef({ pan, zoom });
  view.current = { pan, zoom };

  const pointer = useRef<null | {
    mode: "pending" | "pan" | "pending-drag" | "drag";
    startClient: PlanPoint;
    startPan: PlanPoint;
    item?: PlanItem;
    startDrawing?: PlanPoint;
  }>(null);

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
        const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });

        if (cancelled) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        setPdfSize({ width: canvas.width, height: canvas.height });

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
    setPdfSize(null);
    setPageNumber(1);
    setZoom(1);
    setPan({ x: 24, y: 24 });
    setTool({ kind: "select" });
    setSelectedId(null);
    setCalibration(null);
    setAlignReview(null);
    onAnalysisChangeRef.current?.(null, drawing?.id ?? null);

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
          onAnalysisChangeRef.current?.(parsed.analysis, current.id);
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

  // ---- Floor plan editor -------------------------------------------------

  const page = drawingKind === "pdf" ? pageNumber : 1;

  const sheet: SheetGeometry | null = useMemo(() => {
    if (drawingKind === "dxf" && dxfDrawing) return dxfSheet(dxfDrawing.analysis.bounds);
    if (drawingKind === "pdf" && pdfSize) return pdfSheet(pdfSize.width, pdfSize.height);
    return null;
  }, [drawingKind, dxfDrawing, pdfSize]);

  const storedScale = drawingId ? scaleFor(design, drawingId, page) : undefined;
  const scale: DrawingScale | undefined = drawingId
    ? effectiveScale(design, drawingId, page, drawingKind === "dxf" ? (dxfDrawing?.analysis.units ?? null) : null)
    : undefined;

  const layerState = useMemo(() => new Map(design.layers.map((layer) => [layer.key, layer])), [design.layers]);
  const isLocked = useCallback(
    (item: PlanItem) => {
      const key = layerOf(item);
      return key ? Boolean(layerState.get(key)?.locked) : true;
    },
    [layerState],
  );

  const sheetItems = useMemo(
    () => (drawingId ? itemsOnSheet(design, drawingId, page) : []),
    [design, drawingId, page],
  );
  const visibleItems = useMemo(
    () => sheetItems.filter((item) => layerState.get(layerOf(item)!)?.visible !== false),
    [sheetItems, layerState],
  );
  const selectedItem = sheetItems.find((item) => item.id === selectedId) ?? null;
  const rooms = useMemo(
    () => Array.from(new Set((dxfDrawing?.analysis.potentialRooms ?? []).map((room) => room.label))),
    [dxfDrawing],
  );

  const roomAt = useCallback(
    (point: PlanPoint) =>
      drawingKind === "dxf" && dxfDrawing && sheet
        ? nearestRoom(point, dxfDrawing.analysis.potentialRooms, sheet.extent)
        : "",
    [drawingKind, dxfDrawing, sheet],
  );

  function replaceItem(next: PlanItem, change?: DesignChange) {
    onDesignChange(
      { ...design, items: design.items.map((item) => (item.id === next.id ? next : item)) },
      change,
    );
  }

  function removeItem(id: string) {
    onDesignChange({ ...design, items: design.items.filter((item) => item.id !== id) });
    setSelectedId(null);
  }

  function clientToStage(event: { clientX: number; clientY: number }): PlanPoint {
    const rect = containerRef.current!.getBoundingClientRect();
    const { pan: currentPan, zoom: currentZoom } = view.current;
    return {
      x: (event.clientX - rect.left - currentPan.x) / currentZoom,
      y: (event.clientY - rect.top - currentPan.y) / currentZoom,
    };
  }

  function pointAt(event: { clientX: number; clientY: number; shiftKey: boolean }): PlanPoint | null {
    if (!sheet) return null;
    const point = sheet.fromStage(clientToStage(event));
    const points = tool.kind === "draw" || tool.kind === "measure" || tool.kind === "calibrate" ? tool.points : [];
    return event.shiftKey && points.length > 0 ? snapAngle(points[points.length - 1], point) : point;
  }

  function finishRun() {
    if (tool.kind !== "draw" || !drawingId || !sheet) return;
    const points = withoutRepeats(tool.points, sheet.extent / 5000);
    setTool({ ...tool, points: [] });
    if (points.length < 2) return;
    const type = deviceType(tool.typeId)!;
    const run: PlanItem = {
      id: newItemId(),
      typeId: type.id,
      drawingId,
      page,
      tag: nextTag(design.items, type.id),
      room: roomAt(points[0]),
      // Suggested brands are only suggestions: the designer picks one.
      brand: "",
      model: "",
      notes: "",
      cableType: "CAT6A",
      quantity: 1,
      kind: "run",
      points,
    };
    onDesignChange({ ...design, items: [...design.items, run] });
  }

  /** Where a clicked item "is" for alignment: a device's position or a run's nearest vertex. */
  function anchorOf(itemId: string | null, point: PlanPoint) {
    const item = itemId ? sheetItems.find((entry) => entry.id === itemId) : undefined;
    if (!item) return point;
    if (item.kind === "device") return item.at;
    return item.points.reduce((best, vertex) => (distance(vertex, point) < distance(best, point) ? vertex : best));
  }

  function reviewAlignment(pairs: PointPair[]) {
    setTool({ kind: "select" });
    setCursor(null);
    if (drawingId && similarityFromPairs(pairs)) {
      setAlignReview({ drawingId, page, pairs, keepScale: drawingKind === "dxf" });
    }
  }

  function alignmentTransform(review: AlignReview): Similarity | null {
    return review.keepScale ? rigidFromPairs(review.pairs) : similarityFromPairs(review.pairs);
  }

  function handleClick(event: MouseEvent<HTMLDivElement>, itemId: string | null) {
    const point = pointAt(event);
    if (!point || !drawingId) return;

    if (tool.kind === "align") {
      if (!tool.from) {
        setTool({ ...tool, from: anchorOf(itemId, point) });
        return;
      }
      const pairs = [...tool.pairs, { from: tool.from, to: point }];
      // Two pairs starting or ending on the same spot can't define a turn: keep the first.
      if (pairs.length === 2 && !similarityFromPairs(pairs)) {
        setTool({
          kind: "align",
          pairs: tool.pairs,
          from: null,
          note: "Those two pairs start or end on the same spot. Pick the second pair again, well apart from the first.",
        });
        return;
      }
      if (pairs.length === 2) reviewAlignment(pairs);
      else setTool({ kind: "align", pairs, from: null });
      return;
    }

    if (tool.kind === "select") {
      setSelectedId(itemId);
      return;
    }

    if (tool.kind === "place") {
      const type = deviceType(tool.typeId)!;
      const device: PlanItem = {
        id: newItemId(),
        typeId: type.id,
        drawingId,
        page,
        tag: nextTag(design.items, type.id),
        room: roomAt(point),
        brand: "",
        model: "",
        notes: "",
        cableType: "CAT6A",
        quantity: 1,
        kind: "device",
        at: point,
        rotation: 0,
      };
      // No selection while placing: the item card would cover the next click. The tag shows on the plan.
      onDesignChange({ ...design, items: [...design.items, device] });
      return;
    }

    if (tool.kind === "calibrate") {
      const points = [...tool.points, point];
      if (points.length === 2) {
        setTool({ kind: "select" });
        setCalibration({ points, value: "" });
      } else {
        setTool({ ...tool, points });
      }
      return;
    }

    setTool({ ...tool, points: [...tool.points, point] });
  }

  function beginPointer(event: MouseEvent<HTMLDivElement>) {
    if (!drawingKind) return;
    if (event.button !== 0 && event.button !== 1) return;
    const target = event.target as Element;
    const itemId = target.closest?.("[data-item-id]")?.getAttribute("data-item-id") ?? null;
    const base = {
      startClient: { x: event.clientX, y: event.clientY },
      startPan: view.current.pan,
    };

    if (event.button === 1) {
      event.preventDefault();
      pointer.current = { mode: "pan", ...base };
      setDragging(true);
      return;
    }

    const item = itemId && tool.kind === "select" ? sheetItems.find((entry) => entry.id === itemId) : undefined;
    if (item) {
      setSelectedId(item.id);
      pointer.current = isLocked(item)
        ? { mode: "pending", ...base }
        : { mode: "pending-drag", ...base, item, startDrawing: pointAt({ ...event, shiftKey: false }) ?? undefined };
      return;
    }
    pointer.current = { mode: "pending", ...base };
  }

  function movePointer(event: MouseEvent<HTMLDivElement>) {
    if (tool.kind === "draw" || tool.kind === "measure" || tool.kind === "calibrate" || tool.kind === "align") {
      setCursor(pointAt(event));
    }

    const current = pointer.current;
    if (!current) return;
    const travel = Math.hypot(event.clientX - current.startClient.x, event.clientY - current.startClient.y);

    if (current.mode === "pending" && travel > DRAG_THRESHOLD) {
      current.mode = "pan";
      setDragging(true);
    }
    if (current.mode === "pan") {
      setPan({
        x: current.startPan.x + event.clientX - current.startClient.x,
        y: current.startPan.y + event.clientY - current.startClient.y,
      });
      return;
    }

    if (current.mode === "pending-drag" && travel > DRAG_THRESHOLD) {
      current.mode = "drag";
      // Record the pre-drag design once for undo.
      onDesignChange(design);
    }
    if (current.mode === "drag" && current.item && current.startDrawing) {
      const now = pointAt({ ...event, shiftKey: false });
      if (!now) return;
      replaceItem(
        moveItem(current.item, now.x - current.startDrawing.x, now.y - current.startDrawing.y),
        { live: true },
      );
    }
  }

  function endPointer(event: MouseEvent<HTMLDivElement>) {
    const current = pointer.current;
    pointer.current = null;
    setDragging(false);
    if (!current || current.mode !== "pending") return;
    const target = event.target as Element;
    const itemId = target.closest?.("[data-item-id]")?.getAttribute("data-item-id") ?? null;
    handleClick(event, itemId);
  }

  function cancelPointer() {
    pointer.current = null;
    setDragging(false);
    setCursor(null);
  }

  // Wheel zoom around the cursor. Native listener: React's wheel handlers are passive.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (event: WheelEvent) => {
      if (!drawingKind) return;
      if ((event.target as Element).closest?.(".design-panel, .item-card, .calibration-dialog, .alignment-banner")) return;
      event.preventDefault();
      const { pan: currentPan, zoom: currentZoom } = view.current;
      const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom * Math.exp(-event.deltaY * 0.0015)));
      const rect = container.getBoundingClientRect();
      const cursorPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      setZoom(nextZoom);
      setPan(panForZoom(currentPan, currentZoom, nextZoom, cursorPoint));
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [drawingKind]);

  // Editor keyboard shortcuts (Ctrl/Cmd combinations belong to the app).
  const keyHandler = useRef<(event: KeyboardEvent) => void>(() => {});
  keyHandler.current = (event: KeyboardEvent) => {
    if (!active || !drawingKind || isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key;

    if (key === "Escape") {
      if (calibration) setCalibration(null);
      else if (alignReview) setAlignReview(null);
      else if ((tool.kind === "draw" || tool.kind === "measure" || tool.kind === "calibrate") && tool.points.length > 0) {
        setTool({ ...tool, points: [] });
      } else if (tool.kind !== "select") setTool({ kind: "select" });
      else setSelectedId(null);
      return;
    }
    if (key === "Enter" && tool.kind === "draw") {
      event.preventDefault();
      finishRun();
      return;
    }
    if (key === "Enter" && tool.kind === "align" && tool.pairs.length === 1 && !tool.from) {
      event.preventDefault();
      reviewAlignment(tool.pairs);
      return;
    }
    if (key === "Backspace" && tool.kind === "align" && (tool.from || tool.pairs.length > 0)) {
      event.preventDefault();
      setTool(tool.from ? { ...tool, from: null } : { kind: "align", pairs: tool.pairs.slice(0, -1), from: null });
      return;
    }
    if (key === "Backspace" && (tool.kind === "draw" || tool.kind === "measure") && tool.points.length > 0) {
      event.preventDefault();
      setTool({ ...tool, points: tool.points.slice(0, -1) });
      return;
    }
    if ((key === "Delete" || key === "Backspace") && selectedItem && !isLocked(selectedItem)) {
      event.preventDefault();
      removeItem(selectedItem.id);
      return;
    }
    if ((key === "r" || key === "R") && selectedItem?.kind === "device" && !isLocked(selectedItem)) {
      const delta = key === "R" ? -45 : 45;
      replaceItem({ ...selectedItem, rotation: (selectedItem.rotation + delta + 360) % 360 });
      return;
    }
    if (key === "v" || key === "V") setTool({ kind: "select" });
    if (key === "m" || key === "M") setTool({ kind: "measure", points: [] });
  };
  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyHandler.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  // Points and alignments picked on one PDF page must not carry over to another.
  const shownPage = useRef(pageNumber);
  useEffect(() => {
    if (shownPage.current === pageNumber) return;
    shownPage.current = pageNumber;
    setTool((current) => toolAfterPageChange(current));
    setCursor(null);
    setCalibration(null);
    setAlignReview(null);
  }, [pageNumber]);

  // Sidebar shortcuts ("Place Device", "Measure").
  useEffect(() => {
    const listener = (event: Event) => {
      const request = (event as CustomEvent<string>).detail;
      if (request === "design") setPanelOpen(true);
      if (request === "measure") setTool({ kind: "measure", points: [] });
    };
    window.addEventListener("avsw:plan-tool", listener);
    return () => window.removeEventListener("avsw:plan-tool", listener);
  }, []);

  // "Show on plan" from a builder: select the item and bring it into view.
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    const listener = (event: Event) => setFocusId((event as CustomEvent<string>).detail);
    window.addEventListener("avsw:plan-select", listener);
    return () => window.removeEventListener("avsw:plan-select", listener);
  }, []);
  useEffect(() => {
    if (!focusId) return;
    const item = design.items.find((candidate) => candidate.id === focusId);
    if (!item || item.drawingId !== drawingId) {
      setFocusId(null);
      return;
    }
    const container = containerRef.current;
    if (!sheet || !container) return;
    setTool({ kind: "select" });
    setSelectedId(item.id);
    setFocusId(null);
    // Another PDF page re-fits the view when it renders; only centre on this one.
    if (drawingKind === "pdf" && item.page !== pageNumber) {
      setPageNumber(item.page);
      return;
    }
    setPan(
      panToCenter(sheet.toStage(itemCenter(item)), zoom, {
        width: container.clientWidth,
        height: container.clientHeight,
      }),
    );
  }, [focusId, design.items, drawingId, drawingKind, pageNumber, sheet, zoom]);

  function pickType(typeId: string) {
    const type = deviceType(typeId);
    if (!type) return;
    setSelectedId(null);
    setTool(type.shape === "line" ? { kind: "draw", typeId, points: [] } : { kind: "place", typeId });
  }

  function updateLayer(key: LayerKey, patch: { visible?: boolean; locked?: boolean }) {
    onDesignChange({
      ...design,
      layers: design.layers.map((layer) => (layer.key === key ? { ...layer, ...patch } : layer)),
    });
  }

  function applyCalibration() {
    if (!calibration || !drawingId) return;
    const feet = parseFeet(calibration.value);
    const units = distance(calibration.points[0], calibration.points[1]);
    if (!feet || units === 0) {
      setCalibration({ ...calibration, error: "Enter a distance such as 12'-6\" or 12.5" });
      return;
    }
    onDesignChange(
      withScale(design, {
        drawingId,
        page,
        unitsPerFoot: units / feet,
        label: `calibrated to ${formatFeet(feet)}`,
      }),
    );
    setCalibration(null);
  }

  function setPresetScale(unitsPerFoot: number, label: string) {
    if (!drawingId) return;
    onDesignChange(withScale(design, { drawingId, page, unitsPerFoot, label }));
  }

  function clearScale() {
    if (!drawingId) return;
    onDesignChange({
      ...design,
      scales: design.scales.filter((entry) => !(entry.drawingId === drawingId && entry.page === page)),
    });
  }

  const preview: PlanPreview | null =
    tool.kind === "align"
      ? { kind: "align", pairs: tool.pairs, from: tool.from, cursor }
      : alignReview
        ? { kind: "align", pairs: alignReview.pairs, from: null, cursor: null }
        : tool.kind === "draw"
      ? { kind: "run", typeId: tool.typeId, points: tool.points, cursor }
      : tool.kind === "measure" || tool.kind === "calibrate"
        ? { kind: tool.kind, points: tool.points, cursor }
        : calibration
          ? { kind: "calibrate", points: calibration.points, cursor: null }
          : null;

  function toolStatus() {
    if (tool.kind === "place") return `Placing ${deviceType(tool.typeId)?.name} — click on the plan · Esc to stop`;
    if (tool.kind === "draw") {
      const name = deviceType(tool.typeId)?.name;
      return tool.points.length === 0
        ? `Drawing ${name} — click the first point`
        : `Drawing ${name} — ${tool.points.length} point${tool.points.length === 1 ? "" : "s"} · double-click or Enter to finish · Backspace undoes a point`;
    }
    if (tool.kind === "measure") {
      const length = tool.points.length >= 2 && scale ? formatFeet(polylineLength(tool.points) / scale.unitsPerFoot) : null;
      return length ? `Measured ${length} · Esc to clear` : "Measure — click points · Esc to clear";
    }
    if (tool.kind === "align") {
      if (tool.note && !tool.from) return tool.note;
      if (tool.from) return "Align — now click where that point belongs on this drawing";
      return tool.pairs.length === 0
        ? "Align — click a device (or a point) that is out of place · Esc cancels"
        : "Align — click a second device to also turn and scale, or press Enter to just move · Backspace undoes";
    }
    if (tool.kind === "calibrate") {
      return tool.points.length === 0
        ? "Scale — click the start of a known dimension"
        : "Scale — click the end of the known dimension";
    }
    return null;
  }

  function generateFirstDraft() {
    if (!dxfDrawing) return;
    onDraftChange?.(dxfDrawing.recommendations);
  }

  function changeZoom(factor: number) {
    const container = containerRef.current;
    if (!container) return;
    const center = { x: container.clientWidth / 2, y: container.clientHeight / 2 };
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
    setPan(panForZoom(pan, zoom, nextZoom, center));
    setZoom(nextZoom);
  }

  const zoomPercent = Math.round(zoom * 100);
  const hasDrawing = Boolean(drawingKind);
  const hasDrawingSelected = Boolean(drawing);
  const status = toolStatus();
  const sheetMark = drawingId ? unverifiedSheet(design, drawingId, page) : undefined;

  function alignmentSummary(review: AlignReview) {
    const candidate = alignmentTransform(review);
    const usable = usableAlignment(candidate);
    const transform = candidate ?? { a: 1, b: 0, tx: 0, ty: 0 };
    const [first] = review.pairs;
    const moved = distance(first.from, applySimilarity(transform, first.from));
    // Report the turn as seen on screen: DXF y grows upward, PDF y downward.
    const turn = similarityAngleDeg(transform) * (drawingKind === "dxf" ? 1 : -1);
    const factor = similarityScale(transform);
    return {
      move: scale ? formatFeet(moved / scale.unitsPerFoot) : null,
      turn,
      factor,
      twoPoint: review.pairs.length === 2,
      large: Math.abs(factor - 1) > 0.02 || Math.abs(turn) > 5,
      usable,
    };
  }

  /** Fits the drawing and every item on this sheet, so items carried far off the drawing can be found. */
  function showAll() {
    const container = containerRef.current;
    if (!container || !sheet) return;
    // The Design panel would cover part of the view; it isn't needed to find or align items.
    setPanelOpen(false);
    const points = sheetItems.flatMap((item) => (item.kind === "device" ? [item.at] : item.points)).map(sheet.toStage);
    const xs = [0, sheet.width, ...points.map((point) => point.x)];
    const ys = [0, sheet.height, ...points.map((point) => point.y)];
    const fitted = fitRect(
      { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) },
      { width: container.clientWidth, height: container.clientHeight },
      48,
      { min: MIN_ZOOM, max: 4 },
    );
    setZoom(fitted.zoom);
    setPan(fitted.pan);
  }

  function applyAlignment() {
    if (!alignReview || !drawingId) return;
    // Points picked on another sheet must never move this one.
    if (!reviewMatchesSheet(alignReview, drawingId, page)) {
      setAlignReview(null);
      return;
    }
    const transform = alignmentTransform(alignReview);
    if (!usableAlignment(transform)) return;
    onDesignChange(alignSheet(design, drawingId, page, transform, drawingKind === "dxf"));
    setAlignReview(null);
  }
  const selectedLength =
    selectedItem?.kind === "run" ? runLengthFt(selectedItem, scale) : null;

  return (
    <section className="canvas-wrap">
      <div className="canvas-toolbar">
        <button onClick={onOpenDrawing} disabled={opening} title={hasDrawingSelected ? "Replace drawing" : "Open drawing"}>
          {opening ? "Opening…" : hasDrawingSelected ? "Replace" : "Open Drawing"}
        </button>

        <span className="toolbar-divider" />

        <button
          onClick={() => changeZoom(1 / 1.25)}
          disabled={!hasDrawing}
          aria-label="Zoom out"
        >
          −
        </button>
        <span>{zoomPercent}%</span>
        <button
          onClick={() => changeZoom(1.25)}
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
              onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
              disabled={pageNumber <= 1}
              aria-label="Previous page"
            >
              ‹
            </button>

            <span className="page-status">
              Page {pageNumber} / {document.numPages}
            </span>

            <button
              onClick={() =>
                setPageNumber((current) => Math.min(document.numPages, current + 1))
              }
              disabled={pageNumber >= document.numPages}
              aria-label="Next page"
            >
              ›
            </button>
          </>
        )}

        {hasDrawing && (
          <>
            <span className="toolbar-divider" />
            <button className={panelOpen ? "active" : ""} onClick={() => setPanelOpen((open) => !open)}>
              Design
            </button>
            <button
              className={tool.kind === "measure" ? "active" : ""}
              onClick={() => setTool(tool.kind === "measure" ? { kind: "select" } : { kind: "measure", points: [] })}
              title="Measure (M)"
            >
              Measure
            </button>
            <ScaleMenu
              kind={drawingKind === "pdf" ? "pdf" : "dxf"}
              scale={scale}
              stored={Boolean(storedScale)}
              onCalibrate={() => {
                setSelectedId(null);
                setTool({ kind: "calibrate", points: [] });
              }}
              onPreset={setPresetScale}
              onReset={clearScale}
            />
          </>
        )}

        {drawingKind === "dxf" && dxfDrawing && (
          <>
            <span className="toolbar-divider" />
            <span className="drawing-type-badge">DXF</span>
            <button onClick={generateFirstDraft} title="Generate first-draft recommendations from room labels">
              First Draft
            </button>
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
        className={`canvas ${hasDrawing ? "has-document" : ""} ${dragging ? "is-dragging" : ""} tool-${tool.kind}`}
        onMouseDown={beginPointer}
        onMouseMove={movePointer}
        onMouseUp={endPointer}
        onMouseLeave={cancelPointer}
        onDoubleClick={() => finishRun()}
        onAuxClick={(event) => event.preventDefault()}
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

            {sheet && (
              <PlanOverlay
                sheet={sheet}
                items={visibleItems}
                zoom={zoom}
                selectedId={selectedId}
                showTags={showTags}
                scale={scale}
                preview={preview}
              />
            )}
          </div>
        )}

        {hasDrawing && panelOpen && (
          <DesignPanel
            layers={design.layers}
            sheetItems={sheetItems}
            activeLayer={activeLayer}
            armedTypeId={tool.kind === "place" || tool.kind === "draw" ? tool.typeId : null}
            showTags={showTags}
            onActiveLayer={(key) => {
              setActiveLayer(key);
              if (tool.kind === "place" || tool.kind === "draw") setTool({ kind: "select" });
            }}
            onToggleVisible={(key) => updateLayer(key, { visible: !layerState.get(key)?.visible })}
            onToggleLocked={(key) => updateLayer(key, { locked: !layerState.get(key)?.locked })}
            onPickType={pickType}
            onShowTags={setShowTags}
            onClose={() => setPanelOpen(false)}
          />
        )}

        {selectedItem && (
          <ItemCard
            key={selectedItem.id}
            item={selectedItem}
            lengthFt={selectedLength}
            rooms={rooms}
            locked={isLocked(selectedItem)}
            onChange={(patch, field) =>
              replaceItem({ ...selectedItem, ...patch } as PlanItem, { coalesce: `${selectedItem.id}:${field}` })
            }
            onRotate={(degrees) =>
              selectedItem.kind === "device" &&
              replaceItem({ ...selectedItem, rotation: (selectedItem.rotation + degrees + 360) % 360 })
            }
            onDelete={() => removeItem(selectedItem.id)}
            onClose={() => setSelectedId(null)}
            actions={itemActions?.(selectedItem, selectedLength)}
            alignmentNote={
              sheetMark ? "Carried over from the replaced drawing; its position isn't verified yet." : undefined
            }
          />
        )}

        {status && <div className="plan-status">{status}</div>}

        {sheetMark && drawingId && !alignReview && tool.kind !== "align" && (
          <div className="alignment-banner" role="status" onMouseDown={(event) => event.stopPropagation()}>
            <strong>⚠ Alignment not verified</strong>
            <p>{sheetMark.reason}</p>
            <div className="item-card-actions">
              <button onClick={showAll} title="Zoom out to the drawing and every carried device">
                Show all
              </button>
              <button
                onClick={() => {
                  setSelectedId(null);
                  setPanelOpen(false);
                  setTool({ kind: "align", pairs: [], from: null });
                }}
              >
                Align…
              </button>
              <button className="primary" onClick={() => onDesignChange(markSheetVerified(design, drawingId, page))}>
                Looks right
              </button>
            </div>
          </div>
        )}

        {alignReview &&
          (() => {
            const summary = alignmentSummary(alignReview);
            return (
              <div className="calibration-dialog" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
                <strong>Align this sheet</strong>
                <ul className="align-summary">
                  <li>Move {summary.move ?? "(set a scale to see the distance)"}</li>
                  {summary.twoPoint && (
                    <>
                      <li>
                        Turn {Math.abs(summary.turn).toFixed(1)}°{" "}
                        {Math.abs(summary.turn) < 0.05 ? "" : summary.turn > 0 ? "counter-clockwise" : "clockwise"}
                      </li>
                      <li>Scale ×{summary.factor.toFixed(3)}</li>
                    </>
                  )}
                </ul>
                {summary.twoPoint && (
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={alignReview.keepScale}
                      onChange={(event) => setAlignReview({ ...alignReview, keepScale: event.target.checked })}
                    />
                    <span>Keep the drawing's scale (turn and move only)</span>
                  </label>
                )}
                <p className="muted">
                  Every device and run on this page moves with it
                  {summary.twoPoint && !alignReview.keepScale ? ", and a calibrated scale is adjusted to match" : ""}.
                  Ctrl+Z undoes it.
                </p>
                {!summary.usable ? (
                  <p className="error-text">
                    These points don't give a usable alignment
                    {summary.twoPoint ? ` (scale ×${summary.factor.toFixed(3)})` : ""}. Pick targets that match
                    their devices and are well apart, or cancel and try again.
                  </p>
                ) : (
                  summary.large && (
                    <p className="attention-text">
                      That's a large turn or scale change. Check that each pair of points marks the same spot.
                    </p>
                  )
                )}
                <div className="item-card-actions">
                  <button type="button" onClick={() => setAlignReview(null)}>
                    Cancel
                  </button>
                  <button type="button" className="primary" onClick={applyAlignment} disabled={!summary.usable}>
                    Apply
                  </button>
                </div>
              </div>
            );
          })()}

        {calibration && (
          <form
            className="calibration-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              applyCalibration();
            }}
          >
            <strong>Set the drawing scale</strong>
            <label className="field">
              <span>Real distance between the two points</span>
              <input
                autoFocus
                value={calibration.value}
                placeholder={`12'-6"`}
                onChange={(event) => setCalibration({ ...calibration, value: event.target.value, error: undefined })}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setCalibration(null);
                }}
              />
            </label>
            {calibration.error && <p className="error-text">{calibration.error}</p>}
            <div className="item-card-actions">
              <button type="button" onClick={() => setCalibration(null)}>
                Cancel
              </button>
              <button type="submit" className="primary">
                Apply
              </button>
            </div>
          </form>
        )}

        {hasDrawing && error && <div className="canvas-error">{error}</div>}
      </div>
    </section>
  );
}
