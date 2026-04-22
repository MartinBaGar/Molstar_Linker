+++
title = "Module Reference"
author = ["Martin Bari Garnier"]
draft = false
+++

All source files live in `src/` and are written in TypeScript. Each entry-point module is compiled by esbuild into a single self-contained `.js` file in `dist/`. Shared modules (`types`, `config`, `permissions`, `mvs-builder`) are not separate output files — they are bundled into whichever entry points import them.


## Shared Modules {#shared-modules}


### `src/types.ts` {#src-types-dot-ts}

Defines all shared TypeScript interfaces and the inter-context message protocol. This is the single source of truth for data shapes across the entire codebase.

Key exports:

-   `RepType` — union type of all valid Mol\* representation strings (`"cartoon"`, `"ball_and_stick"`, etc.)
-   `RuleRepType` — extends `RepType` with `|"highlight"` for custom rules
-   `TargetDefinition` — shape of one entry in `AppConfig.targets`
-   `CustomRule` — full data model for a user-defined visual rule
-   `ExtensionSettings` — the master settings object stored in `chrome.storage.sync`
-   `Preset` — shape of a named template
-   `OpenViewerMessage` — message sent from content script to background
-   `InitMolstarMessage` — message sent from viewer to sandbox iframe
-   `SandboxReadyMessage` — message sent from sandbox to viewer on load


### `src/config.ts` {#src-config-dot-ts}

Contains the static `AppConfig` object. The authoritative registry for everything the extension knows about molecular components and visual representations.

Key exports:

-   `AppConfig.RepSchema` — maps representation keys to their labels and configurable sub-parameters
-   `AppConfig.targets` — array of `TargetDefinition` objects (protein, nucleic, ligand, carbs, lipid, ion, water, all)
-   `AppConfig.presets` — named built-in templates
-   `AppConfig.getDefaults()` — generates a complete `ExtensionSettings` object from the targets array with fallback values; used everywhere storage settings are read


### `src/permissions.ts` {#src-permissions-dot-ts}

Manages dynamic host permission requests for custom domains. Cross-browser compatible (Chrome MV3 / Firefox MV2).

Key exports:

-   `PermissionsManager.cleanDomain(url)` — extracts the hostname from a URL string
-   `PermissionsManager.requestAndRegister(url)` — requests host permission, registers the content script, and persists the domain to storage. Must be called directly inside a user-gesture handler (Firefox requirement).
-   `PermissionsManager.revokeAndUnregister(url)` — removes the permission, unregisters the script, and removes the domain from storage.


### `src/mvs-builder.ts` {#src-mvs-builder-dot-ts}

Translates extension settings into a [MolViewSpec](https://molstar.org/viewer-docs/extensions/mvs/) JSON tree. All user-controlled values are sanitized before being embedded.

Key exports:

-   `MvsBuilder._buildBaseTemplate(url, format, settings)` — builds the complete MVS JSON object; called by both `sandbox.ts` (rendering) and `createViewerUrl` (sharing)
-   `MvsBuilder.createViewerUrl(url, format, settings)` — encodes the MVS tree as a `molstar.org/viewer/` URL for external sharing
-   `MvsBuilder._sanitizeString(value, maxLength)` — strips control characters, caps length
-   `MvsBuilder._sanitizeColor(colorType, colorVal)` — validates against theme allowlist or `#rrggbb` pattern
-   `MvsBuilder._sanitizeRepType(repType)` — validates against `AppConfig.RepSchema` keys
-   `MvsBuilder._deepSanitize(obj, depth)` — recursively sanitizes free-form objects (used for `camera_json`), caps depth at 2, rejects arrays and prototype-polluting keys


## Entry-Point Modules {#entry-point-modules}


### `src/background.ts` → `background.js` {#src-background-dot-ts-background-dot-js}

The extension service worker (Chrome) / event page (Firefox). Routing and security checkpoint.

Responsibilities:

-   Listens for `open_viewer` messages from content scripts; validates URL (HTTPS-only) and format before opening `viewer.html`
-   Creates the right-click context menu item on install; handles menu clicks with `format=unknown` fallback
-   Listens for `chrome.permissions.onAdded` to dynamically register content scripts when new custom domains are authorized


### `src/content.ts` → `content.js` {#src-content-dot-ts-content-dot-js}

The DOM scanner injected into host webpages. Has no TypeScript imports — compiles to a plain classic script.

Key functions:

-   `getStructureInfo(href, linkElement)` — 3-ring scanner: checks the URL, then link text and HTML attributes, then the parent element's text content. Transforms GitHub blob URLs to `raw.githubusercontent.com` and GitLab blob URLs to the GitLab API raw endpoint.
-   `makeBadge(rawUrl, formatStr, originalHref)` — creates the styled `<button>` badge; blocks click event propagation to prevent SPA navigation
-   `injectMolstarLinker()` — main scan pass; skips already-processed links, checks for duplicate badges, marks processed links with `data-ms-processed`
-   `MutationObserver` with 500 ms debounce handles SPA navigation; disconnects on page `unload`


### `src/viewer.ts` → `viewer.js` {#src-viewer-dot-ts-viewer-dot-js}

The privileged shell. Runs inside the extension context with full API access.

Key functions:

-   `isSafeUrl(url)` — validates HTTPS protocol and checks hostname against SSRF blocklist (private ranges, loopback, link-local)
-   `bootWorkspace(rawUrl, safeFormat)` — fetches the file, enforces 25 MB cap, converts to base64 data URI, calls `spawnIframe`
-   `spawnIframe(dataUri, format, rawUrl)` — reads and filters storage settings using schema allowlist, spawns sandbox iframe, registers `SANDBOX_READY` listener, sends `INIT_MOLSTAR` message
-   `setupDragAndDrop()` — full-page drag-and-drop overlay for local files


### `src/sandbox.ts` → `sandbox.js` (bundles `mvs-builder.ts`) {#src-sandbox-dot-ts-sandbox-dot-js--bundles-mvs-builder-dot-ts}

The isolated rendering context. Has no access to extension APIs.

Flow:

1.  Posts `SANDBOX_READY` immediately on script load
2.  On `INIT_MOLSTAR`: validates origin (`chrome-extension://` or `moz-extension://`), validates URL (must be `data:` or `null`), validates format
3.  Converts data URI to a short `blob:` URL (anti-lag fix for large files)
4.  Calls `MvsBuilder._buildBaseTemplate()` to produce the MVS JSON
5.  Loads via `viewerInstance.loadMvsData()` if available, or the `PluginExtensions.mvs.loadMVS()` fallback


### `src/popup.ts` → `popup.js` {#src-popup-dot-ts-popup-dot-js}

The browser toolbar popup. Lightweight — reads storage, applies a selected preset, opens the Studio.


### `src/options.ts` → `options.js` {#src-options-dot-ts-options-dot-js}

The full Settings Studio. The most complex UI module.

Key functions:

-   `buildUI()` — generates per-target accordion cards with representation selectors, color pickers, and sub-parameter drawers
-   `addCustomRuleCard(ruleData?)` — creates a full custom rule form card with simple/expert mode toggle and live JSON preview
-   `extractCurrentSettings()` — reads the entire UI state into an `ExtensionSettings` object
-   `injectSettingsIntoUI(settings)` — populates the entire UI from a settings object (used by template loading and JSON import)
-   `refreshCustomDomainList()` — reads authorized domains from storage and renders the revocation UI
-   Import validation uses an explicit allowlist (`AppConfig.getDefaults()` keys) and caps `customRules` at 50 entries
