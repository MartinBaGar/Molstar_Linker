+++
title = "Module Reference"
author = ["Martin Bari Garnier"]
draft = false
+++

All source files live in `src/` and are written in TypeScript. Each entry-point module is compiled by **Vite** into a single self-contained `.js` file in `dist/`. Shared modules (`types`, `config`, `permissions`, `native-builder`, `utils/`) are bundled into whichever entry points import them.


## Shared Modules {#shared-modules}


### `src/types.ts` {#src-types-dot-ts}

Defines all shared TypeScript interfaces and the inter-context message protocol. This is the single source of truth for data shapes across the entire codebase.

Key exports:

-   `RepType` — union type of all valid Mol* representation strings (`"cartoon"`, `"ball_and_stick"`, etc.)
-   `RuleRepType` — extends `RepType` with `|"highlight"` for custom rules
-   `TargetDefinition` — shape of one entry in `AppConfig.targets`
-   `CustomRule` — full data model for a user-defined visual rule. Applied dynamically using `native-builder.ts`.
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


### `src/native-builder.ts` {#src-native-builder-dot-ts}

Handles dynamic scene construction and custom rules for the Mol* viewer. This module is critical for applying user-defined visual rules to molecular structures.

Key exports:

-   `customRuleToRep`: Converts custom rules from `ExtensionSettings` into Mol* representations.
-   `NativeBuilder.buildNativeScene`: Constructs the Mol* scene using custom rules and settings.


### `src/utils/links.ts` {#src-utils-links-dot-ts}

Manages URL resolution, safety checks, and domain validation. Used by `content.ts` and `viewer.ts` to ensure secure and accurate link processing.

Key exports:

-   `isSafeUrl(url)` — validates HTTPS protocol and blocks private IP ranges, localhost, and non-HTTPS URLs.
-   `resolveUrl(url)` — resolves GitHub/GitLab URLs to their raw file endpoints.
-   `cleanDomain(url)` — normalizes domains for validation (e.g., strips `www.` or `https://`).


### `src/utils/domains.ts` {#src-utils-domains-dot-ts}

Manages domain validation and default domains. Used by `permissions.ts` and `options.ts` to validate custom domains.

Key exports:

-   `isDefaultDomain(domain)` — checks if a domain is supported by default (e.g., GitHub, GitLab).


### `src/utils/browser.ts` {#src-utils-browser-dot-ts}

Abstracts browser-specific APIs (e.g., Chrome/Firefox) to ensure cross-browser compatibility.


## Entry-Point Modules {#entry-point-modules}


### `src/background.ts` → `background.js` {#src-background-dot-ts-background-dot-js}

The extension service worker (Chrome) / event page (Firefox). Routing and security checkpoint.

Responsibilities:

-   Listens for `open_viewer` messages from content scripts; validates URL (HTTPS-only) and format using `isSafeUrl` from `utils/links.ts`.
-   Creates the right-click context menu item on install; handles menu clicks with `format=unknown` fallback.
-   Listens for `chrome.permissions.onAdded` to dynamically register content scripts when new custom domains are authorized.


### `src/content.ts` → `content.js` {#src-content-dot-ts-content-dot-js}

The DOM scanner injected into host webpages. Uses the `SiteAdapter` interface to standardize link analysis across domains (e.g., GitHub, GitLab).

Key functions:

-   `getStructureInfo(href, linkElement)` — uses `SiteAdapter` to analyze links and extract molecular file formats.
-   `makeBadge(rawUrl, formatStr, originalHref)` — creates the styled `<button>` badge; blocks click event propagation to prevent SPA navigation.
-   `injectMolstarLinker()` — main scan pass; skips already-processed links, checks for duplicate badges, marks processed links with `data-ms-processed`.
-   `MutationObserver` with 500 ms debounce handles SPA navigation; disconnects on page `unload`.


### `src/viewer.ts` → `viewer.js` {#src-viewer-dot-ts-viewer-dot-js}

The privileged shell. Runs inside the extension context with full API access.

Key functions:

-   `isSafeUrl(url)` — validates HTTPS protocol and checks hostname against SSRF blocklist (private ranges, loopback, link-local) using `utils/links.ts`.
-   `bootWorkspace(rawUrl, safeFormat)` — fetches the file, enforces a 25 MB cap, converts to base64 data URI, and calls `spawnIframe`.
-   `spawnIframe(dataUri, format, rawUrl)` — reads and filters storage settings, spawns sandbox iframe, and sends `INIT_MOLSTAR` message with custom rules applied using `native-builder.ts`.
-   `setupDragAndDrop()` — full-page drag-and-drop overlay for local files.


### `src/sandbox.ts` → `sandbox.js` {#src-sandbox-dot-ts-sandbox-dot-js}

The isolated rendering context for the Mol* viewer. Has no access to extension APIs but is allowed to use `unsafe-eval` for WebGL shader compilation.

Flow:

1.  Posts `SANDBOX_READY` immediately on script load to signal readiness to the parent `viewer.ts`.
2.  On `INIT_MOLSTAR`: validates the message origin (`chrome-extension://` or `moz-extension://`), URL scheme (must be `data:` or `null`), and format.
3.  Converts the base64 data URI to a short `blob:` URL to avoid performance issues with large files.
4.  Initializes the Mol* viewer and loads the structure data directly into the scene, applying custom rules dynamically.
5.  Renders the 3D scene using the Mol* viewer API.


### `src/popup.ts` → `popup.js` {#src-popup-dot-ts-popup-dot-js}

The browser toolbar popup. Lightweight — reads storage, applies a selected preset, and opens the Studio.


### `src/options.ts` → `options.js` {#src-options-dot-ts-options-dot-js}

The full Settings Studio. The most complex UI module.

Key functions:

-   `buildUI()` — generates per-target accordion cards with representation selectors, color pickers, and sub-parameter drawers.
-   `addCustomRuleCard(ruleData?)` — creates a full custom rule form card with simple/expert mode toggle and live JSON preview for defining dynamic Mol* representations.
-   `extractCurrentSettings()` — reads the entire UI state into an `ExtensionSettings` object.
-   `injectSettingsIntoUI(settings)` — populates the entire UI from a settings object (used by template loading and JSON import).
-   `refreshCustomDomainList()` — reads authorized domains from storage and renders the revocation UI.
-   Import validation uses an explicit allowlist (`AppConfig.getDefaults()` keys) and caps `customRules` at 50 entries.
