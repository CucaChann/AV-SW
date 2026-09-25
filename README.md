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

## Install AV-SW (Windows)

AV-SW is a desktop program. You don't need any developer tools to use it:

1. Open the repository's **Actions** tab, choose the latest **Desktop installer** run on `main`, and download **AV-SW-windows-installer**. For tagged versions, the installers are also attached to the draft release on the **Releases** page.
2. Unzip it and run `AV-SW_<version>_x64-setup.exe` (or the `.msi`).
3. The installer is not code-signed yet, so Windows SmartScreen may say "Windows protected your PC". Choose **More info → Run anyway**.

## Projects

Each project is one `.avsw` file, like a CAD file: **File → Save** (Ctrl+S) asks where to save it the first time. You can keep it on a server, back it up or send it to a colleague. The drawings you open are stored inside the file. **File → Open Project** (Ctrl+O) and the recent-projects list reopen it.

Unsaved work is also kept in a recovery copy, so AV-SW reopens where you left off after a crash or forced shutdown.

## Designing on the floor plan

Open a PDF or DXF drawing, then click **Design** in the drawing toolbar (or **Place Device** in the sidebar).

- **Layers.** Lighting, Lighting Control, Shades, Audio, Video, Network, Control & Touch Panels and Cabling share the same drawing. Each layer can be hidden or locked.
- **Placing.** Pick a device from the layer's palette and click the drawing. Lines (linear lighting, shades, cable runs, conduit) are drawn point by point: double-click or press Enter to finish, and hold Shift to keep them straight.
- **Editing.** Click an item to edit its tag, room, brand, model and notes. Drag it to move it, press R to rotate, Delete to remove. Ctrl+Z / Ctrl+Y undo and redo.
- **Scale.** DXF drawings use their own units. For a PDF, choose an architectural scale or calibrate from a known dimension in the **Scale** menu. **Measure** (M) reads real distances.
- **Outputs.** **Device Schedule** lists everything by layer (click a tag to find it on the plan) and exports CSV. Placed devices go into the BOM and replace the matching preliminary lines.
- **QTL.** Select a linear LED line and choose **Create QTL run** to send its measured length and room to QTL Studio. The studio shows which plan line each run came from, warns when the lengths no longer match, and can split a fixture that is longer than the product's catalog maximum.
- **Revisions.** Replace the drawing with a new revision (same file type) and keep the devices. A PDF revision is always marked **Alignment not verified**; a DXF revision is marked only when its units or extents changed. The banner offers **Show all** (finds devices that ended up off the drawing), **Align…** (click a device, then where it belongs; a second pair also turns it) and **Looks right**. Until then, the Device Schedule flags those items, their BOM lines drop to Review, and Validate warns.

Designs are saved in the `.avsw` project file.

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
npm.cmd ci
```

`npm ci` installs exactly the versions pinned in `package-lock.json`. Use `npm install <package>@<version>` only when intentionally changing a dependency.

## Browser development mode

```powershell
npm.cmd run dev
```

Vite will normally serve AV-SW at:

```
http://localhost:5173
```

## Checks

```powershell
npm.cmd run check             # typecheck, tests, production build
npm.cmd run validate:library  # product library data only
```

GitHub Actions runs the same checks, plus a desktop `cargo check`, on every pull request.

## Product library

Manufacturer data, compatibility, alternatives and design rules live in `data/library/` and are validated by `src/library/`. Every value cites a source, and only a person can mark a record verified. See `docs/PRODUCT-LIBRARY.md`.

## Working with AI agents

Claude (Claude Code) and ChatGPT (Codex) both work in this repository under the same rules in `AGENTS.md` (`CLAUDE.md` imports it). Each agent works on its own branch and opens a pull request; the other agent reviews it, and the repository owner merges.

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

Desktop program:
- Windows installer built by GitHub Actions
- `.avsw` project files with New / Open / Save / Save As, recent projects and unsaved-changes prompts
- recovery copy of the open project
- PDF and DXF drawings stored inside the project
- browser mode kept for development (Save downloads the `.avsw` file)

Floor plan design:
- design layers with devices and drawn runs on PDF and DXF drawings
- sheet scales, calibration and measuring
- device schedule and BOM lines from the plan
- linear LED lines linked to QTL Studio runs


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
