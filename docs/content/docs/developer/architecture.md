+++
title = "Architecture & Execution Flow"
author = ["Martin Bari Garnier"]
draft = false
+++

## Core Philosophy {#core-philosophy}

Mol\* Linker operates across several strict security boundaries imposed by the browser. Modern browsers enforce Content Security Policies (CSP) that block `unsafe-eval` in Manifest V3 extension pages, and restrict cross-origin requests (CORS) between websites and external servers.

To load multi-megabyte structural files from dynamic Single Page Applications (GitHub, GitLab, RCSB) into a high-performance WebGL visualizer (Mol\*), the extension uses a **4-Layer Architecture** where each layer has one clearly defined responsibility.


## The 4-Layer Architecture {#the-4-layer-architecture}


### 1. Reconnaissance (The Content Script) {#1-dot-reconnaissance--the-content-script}

-   **Source:** `src/content.ts`
-   **Output:** `content.js` (bundled standalone, no imports)
-   **Environment:** The host webpage (GitHub, GitLab, RCSB, custom domains)
-   **Role:** Scans the DOM for links that point to supported structural file formats. Uses a 3-ring scanner — URL, HTML attributes, and surrounding parent text — to detect structure links even on sites with opaque download URLs (Figshare, Zenodo).
-   **Action:** Injects a native `<button>` badge next to each valid link. Clicking the badge stops SPA navigation and sends an `open_viewer` message to the background router via `chrome.runtime.sendMessage`.


### 2. The Router (The Background Script) {#2-dot-the-router--the-background-script}

-   **Source:** `src/background.ts`
-   **Output:** `background.js`
-   **Environment:** Extension service worker (Chrome MV3) or event page (Firefox MV2)
-   **Role:** Acts as a traffic cop and security checkpoint. Validates that incoming `open_viewer` messages carry a safe HTTPS URL and a known format string before acting.
-   **Action:** Opens a new isolated extension tab pointing to `viewer.html`, passing the file URL and format via URL query parameters. Also handles the right-click context menu and dynamic content script registration for newly authorized custom domains.


### 3. The Privileged Shell (The Viewer) {#3-dot-the-privileged-shell--the-viewer}

-   **Source:** `src/viewer.ts`
-   **Output:** `viewer.js`
-   **Environment:** Extension context (`chrome-extension://...`), full API access
-   **Role:** The security gatekeeper and data acquisition layer. Runs with elevated privileges that the sandbox explicitly does not have.
-   **Actions:**
    1.  **Domain gating:** Checks whether the requesting domain is a default (GitHub, RCSB, etc.) or an authorized custom domain. Halts with a UI prompt if not.
    2.  **Format gating:** If format is unknown (right-click path), shows a format selector before proceeding.
    3.  **SSRF protection:** Validates the URL against a blocklist of private IP ranges and loopback addresses before fetching.
    4.  **Fetch:** Downloads the structure file using `fetch()`, enforces a 25 MB size cap, and performs a Firefox tracking-protection sanity check on the first 150 bytes.
    5.  **Schema gating:** Merges storage settings with `AppConfig.getDefaults()` using a strict allowlist of known keys before passing them to the sandbox, preventing rogue storage keys from reaching the MVS builder.
    6.  **Handoff:** Spawns the sandbox `<iframe>` and passes the base64 data URI and validated settings via `postMessage`, using an `e.source` guard instead of origin matching (sandboxed iframes always report `null` origin).
    7.  **Drag &amp; drop:** Handles local file loading for offline use.


### 4. The Engine (The Sandbox) {#4-dot-the-engine--the-sandbox}

-   **Source:** `src/sandbox.ts`, `src/mvs-builder.ts`
-   **Output:** `sandbox.js` (bundles both modules)
-   **Environment:** Sandboxed iframe, origin `null`, zero extension API access
-   **Role:** Mol\* requires `eval()` and `new Function()` to compile WebGL shaders dynamically. Standard MV3 extension pages forbid this. The sandbox is explicitly declared in the Chrome manifest to allow `unsafe-eval` in isolation.
-   **Action:**
    1.  Immediately posts `SANDBOX_READY` to the parent on script load.
    2.  Validates the incoming `INIT_MOLSTAR` message (origin, URL scheme, format).
    3.  Converts the base64 data URI back into a short `blob:` URL to avoid embedding multi-megabyte strings in the MVS JSON tree (anti-lag fix).
    4.  Translates the validated settings into a MolViewSpec JSON tree via `MvsBuilder._buildBaseTemplate()`.
    5.  Renders the 3D scene via the Mol\* viewer API.


## The Build Pipeline {#the-build-pipeline}

A fifth layer that exists at development time rather than runtime.

```nil
src/*.ts  ──→  tsc --noEmit ──→  (type errors only, no files)
src/*.ts  ──→  esbuild       ──→  dist/*.js  (one file per entry point)
dist/*.js
public/   ──→  assemble.js   ──→  dist/chrome/   (loadable extension)
manifests/                        dist/firefox/
```

-   **tsc** acts as a quality gate: strict type checking with no file output (`noEmit: true`).
-   **esbuild** bundles each entry point and all its imports into one self-contained JS file. Shared modules (`config`, `permissions`, `mvs-builder`, `types`) are inlined — they do not appear as separate script files in the output.
-   **assemble.js** routes the correct manifest, the compiled JS, and the static assets into a browser-specific folder that can be loaded directly into the browser.

This design means `content.js` compiles to a plain classic script with no module syntax (it has no imports), while all other entry points also compile to classic scripts because esbuild resolves all imports at build time. The browser never needs to handle ES module resolution at runtime.


## Cross-Browser Compatibility (Manifest Split) {#cross-browser-compatibility--manifest-split}

Chrome (MV3) and Firefox (MV2) have incompatible requirements for background workers, sandboxing, and CSP. Rather than a single manifest with conditional logic, two separate manifests are maintained:

-   **`manifests/chrome.json`**: Uses `service_worker` for the background, `action` for the popup, and the `sandbox` manifest key to declare the sandboxed page.
-   **`manifests/firefox.json`**: Uses `background.scripts` (event page), `browser_action` for the popup, and a permissive `content_security_policy` string. Firefox does not support the `sandbox` manifest key but allows `unsafe-eval` globally for extension pages, achieving the same result.

The TypeScript source is identical for both targets — only the manifest differs. `assemble.js` copies the right one during the build.
