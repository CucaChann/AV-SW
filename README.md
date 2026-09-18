# AV-SW

Design-first AV, lighting, networking, shading, and smart-home design software.

## Current direction

AV-SW is being built as a **hybrid, desktop-first application**:

- **Tauri 2** native desktop shell
- **React + TypeScript + Vite** UI
- **PDF.js** architectural plan rendering
- **SQLite** local-first persistence
- cloud-backed manufacturer/product knowledge planned later
- browser mode remains available during development

See `docs/VISION.md` and `docs/ARCHITECTURE.md` for the product foundation.

## Free development prerequisites

### Required for browser development
- Git
- Node.js LTS
- VS Code or another editor

### Required for Windows desktop development
- Rust via rustup
- Microsoft C++ Build Tools / Visual Studio Build Tools with the Desktop development with C++ workload
- Microsoft Edge WebView2 Runtime (normally already present on supported Windows systems)

All of the above have free options.

## Install

```powershell
npm.cmd install
```

## Browser development mode

```powershell
npm.cmd run dev
```

Vite will normally serve AV-SW at:

```
http://localhost:5173
```

## Desktop development mode

After the Windows Rust/C++ prerequisites are installed:

```powershell
npm.cmd run desktop:dev
```

This compiles the Tauri shell and opens AV-SW as a desktop application.

## Desktop build

```powershell
npm.cmd run desktop:build
```

The Tauri build output will contain the Windows application/bundle artifacts.

## Current milestone

Hybrid desktop foundation:
- React/Vite frontend
- Tauri application shell
- native PDF file selection in desktop mode
- browser file picker fallback
- local SQLite foundation
- PDF pan/zoom/page navigation


## DXF test

The repository includes a small sample drawing:

`samples/apartment_demo.dxf`

Open it from AV-SW using **Open Drawing**.

Expected behavior:
- DXF geometry renders in the canvas
- units show as Inches
- layers are listed in Drawing Analysis
- room labels are detected for Living Room, Kitchen, and Office
- **Generate First Draft** produces initial lighting/network/audio/control recommendations

Current supported drawing formats:
- PDF
- DXF

DWG support is planned after the DXF import pipeline is stable.
