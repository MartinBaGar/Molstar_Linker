+++
title = "Architecture & Execution Flow"
author = ["Martin Bari Garnier"]
draft = false
+++

## High-Level Architecture {#high-level-architecture}

Mol* Linker is a browser extension that enables users to visualize molecular structures directly from websites like GitHub, GitLab, and custom domains. The extension operates across multiple security boundaries enforced by modern browsers, requiring a **4-Layer Architecture** to ensure security, performance, and compatibility.

### Key Design Decisions {#key-design-decisions}

- **Modern Build Pipeline**: The extension uses **[pixi](https://pixi.sh)** for dependency management and **[Vite](https://vitejs.dev/)** for building. This ensures a fast, reproducible, and isolated development environment.
- **Simplified Storage**: Settings are stored in `chrome.storage.sync` and managed via the `ExtensionSettings` interface in `src/types.ts`. This ensures consistency and synchronization across browsers.
- **Modular Codebase**: The extension is divided into small, focused modules (e.g., `background.ts`, `content.ts`, `viewer.ts`, `sandbox.ts`) to improve maintainability and testability.

---

## The 4-Layer Architecture {#the-4-layer-architecture}

### 1. Reconnaissance (Content Script) {#reconnaissance-content-script}
- **Source**: `src/content.ts`
- **Output**: `dist/[chrome|firefox]/content.js`
- **Environment**: Injected into host webpages (e.g., GitHub, GitLab).
- **Role**: Scans the DOM for links to supported molecular file formats (e.g., `.pdb`, `.cif`). Detects links even on sites with dynamic or opaque URLs (e.g., Figshare, Zenodo).
- **Action**:
  - Injects a badge next to each valid link.
  - Clicking the badge sends an `open_viewer` message to the background script.

---

### 2. The Router (Background Script) {#router-background-script}
- **Source**: `src/background.ts`
- **Output**: `dist/[chrome|firefox]/background.js`
- **Environment**: Extension service worker (Chrome) or event page (Firefox).
- **Role**: Acts as a security checkpoint and traffic cop.
- **Action**:
  - Validates `open_viewer` messages for safe HTTPS URLs and known formats.
  - Opens a new extension tab pointing to `viewer.html` with the file URL and format as query parameters.
  - Handles dynamic content script registration for custom domains.

---

### 3. The Privileged Shell (Viewer) {#privileged-shell-viewer}
- **Source**: `src/viewer.ts`
- **Output**: `dist/[chrome|firefox]/viewer.js`
- **Environment**: Extension context (`chrome-extension://...`), full API access.
- **Role**: Security gatekeeper and data acquisition layer.
- **Action**:
  - Validates the requesting domain and file format.
  - Downloads the structure file using `fetch()`, enforcing a 25 MB size cap.
  - Spawns the sandbox `<iframe>` and passes the data URI and settings via `postMessage`.

---

### 4. The Engine (Sandbox) {#engine-sandbox}
- **Source**: `src/sandbox.ts`
- **Output**: `dist/[chrome|firefox]/sandbox.js`
- **Environment**: Sandboxed `<iframe>`, origin `null`, no extension API access.
- **Role**: Isolated rendering context for the Mol* viewer.
- **Action**:
  - Initializes the Mol* viewer and loads the structure data.
  - Renders the 3D scene using the Mol* viewer API.

---

## Build Pipeline {#build-pipeline}

The extension uses a modern build pipeline powered by **[pixi](https://pixi.sh)** and **[Vite](https://vitejs.dev/)**. This ensures fast, reproducible builds with minimal configuration.

### Key Steps {#key-steps}
1. **Dependency Management**: `pixi install` sets up an isolated environment with all required tools (Node.js, TypeScript, Vite).
2. **Type Checking**: `tsc --noEmit` validates the codebase for type errors.
3. **Bundling**: `vite build` bundles the extension for Chrome or Firefox, generating self-contained files in `dist/`.
4. **Output**: The `dist/` directory contains browser-specific folders (`chrome/` and `firefox/`) ready for loading as unpacked extensions.

---

## Cross-Browser Compatibility {#cross-browser-compatibility}

The extension supports both **Chrome (Manifest V3)** and **Firefox (Manifest V2)**. The build process generates browser-specific manifests and output directories to ensure compatibility.

- **Chrome**: Uses `service_worker` for the background script and `action` for the popup.
- **Firefox**: Uses `background.scripts` for the background script and `browser_action` for the popup.

The TypeScript source code is identical for both browsers—only the manifests differ.

---

## Storage Schema {#storage-schema}

The extension stores user settings in `chrome.storage.sync` using the `ExtensionSettings` interface defined in `src/types.ts`. This ensures settings are synchronized across browsers and devices.

### Key Settings {#key-settings}
- **Custom Rules**: User-defined visual rules for specific chains, residues, or atoms.
- **Global Targets**: Default visual styles for proteins, nucleic acids, ligands, etc.
- **Scene Settings**: Background color, camera position, and other viewer preferences.

Settings are validated and filtered using `AppConfig.getDefaults()` to ensure consistency.
