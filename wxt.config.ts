import { defineConfig } from "wxt";
import fs from "fs";
import path from "path";
import { DataFormatRegistry } from "molstar/lib/mol-plugin-state/formats/registry";

const VIRTUAL_MODULE_ID = "virtual:molstar-extensions";
const RESOLVED_VIRTUAL_MODULE_ID = "\0" + VIRTUAL_MODULE_ID;

// Mol* ships third-party WebAssembly glue (Emscripten "embind") that builds
// functions from strings at runtime, so it needs eval. We therefore only run
// Mol* inside a sandboxed page (opaque origin, no extension API access):
//   - Chrome:  manifest `sandbox.pages` (added by WXT) + CSP sandbox policy.
//   - Firefox: `sandbox` manifest key (Firefox 154+). WXT does not emit it for
//     Firefox, so it is injected in the build:manifestGenerated hook below.
// Extension pages themselves never get 'unsafe-eval'.
const SANDBOX_FLAGS =
  "sandbox allow-scripts allow-forms allow-popups allow-modals";
const SANDBOX_SCRIPT_SRC = "'self' 'unsafe-eval' 'wasm-unsafe-eval'";

function sandboxCsp(dev: boolean, withInline: boolean): string {
  const devHosts = dev ? " http://localhost:3000 ws://localhost:3000" : "";
  const inline = withInline ? " 'unsafe-inline'" : "";
  // The sandbox only needs blob: (the file the viewer hands it) and data:.
  // Everything else (fetch/XHR/WebSocket) is blocked, so a compromised parser
  // cannot send an unpublished structure anywhere. Dev adds the HMR server.
  const connect = `blob: data:${devHosts}`;
  return `${SANDBOX_FLAGS}; script-src ${SANDBOX_SCRIPT_SRC}${inline}${devHosts}; connect-src ${connect}; child-src 'self'; object-src 'none';`;
}

function copyMolstarJs(destFolder: string): void {
  const src = path.resolve("node_modules/molstar/build/viewer/molstar.js");
  const js = fs
    .readFileSync(src, "utf8")
    // The .map file is not shipped; avoid devtools 404 noise.
    .replace(/\/\/# sourceMappingURL=.*$/m, "");
  fs.writeFileSync(path.join(destFolder, "molstar.js"), js);
}

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-svelte"],

  vite: () => ({
    plugins: [
      {
        name: "molstar-extensions-generator",
        resolveId(id) {
          if (id === VIRTUAL_MODULE_ID) {
            return RESOLVED_VIRTUAL_MODULE_ID;
          }
        },
        load(id) {
          if (id === RESOLVED_VIRTUAL_MODULE_ID) {
            const snapshots = new Array("molj", "molx");
            const reg = new DataFormatRegistry();
            const ext = [
              ...Array.from(reg.extensions),
              ...Array.from(reg.binaryExtensions),
              ...Array.from(snapshots),
            ];

            return `export const ALL_EXTENSIONS = new Set(${JSON.stringify(ext)});`;
          }
        },
      },
    ],
    server: {
      cors: {
        origin: "*",
      },
    },
  }),

  hooks: {
    "build:before": () => {
      const destFolder = path.resolve("public/lib");

      if (!fs.existsSync(destFolder)) {
        fs.mkdirSync(destFolder, { recursive: true });
      }

      copyMolstarJs(destFolder);

      fs.copyFileSync(
        path.resolve("node_modules/molstar/build/viewer/molstar.css"),
        path.join(destFolder, "molstar.css"),
      );

      console.log("✅ Copied Molstar JS and CSS to public/lib/");
    },

    // WXT drops the sandbox key for Firefox ("Sandboxed pages not supported by
    // Firefox"), but Firefox 154+ supports it. Add it back by hand.
    "build:manifestGenerated": (wxt, manifest) => {
      if (wxt.config.browser !== "firefox") return;

      const m = manifest as any;
      const csp = sandboxCsp(wxt.config.command === "serve", false);

      if (m.manifest_version === 3) {
        m.sandbox = { pages: ["sandbox.html"] };
        m.content_security_policy = {
          ...(m.content_security_policy ?? {}),
          sandbox: csp,
        };
      } else {
        // MV2: the sandbox CSP lives inside the `sandbox` key.
        m.sandbox = { pages: ["sandbox.html"], content_security_policy: csp };

        // The sandbox has an opaque origin, so Firefox treats it like a web
        // page: every extension file it loads must be web-accessible
        // (MV2 syntax = flat list of strings). HTML pages are deliberately
        // NOT listed, so websites cannot frame viewer/options/sandbox.
        const war: string[] = Array.isArray(m.web_accessible_resources)
          ? m.web_accessible_resources
          : [];
        for (const p of ["chunks/*", "assets/*", "lib/*"]) {
          if (!war.includes(p)) war.push(p);
        }
        m.web_accessible_resources = war;
      }
    },
  },

  manifest: ({ browser, command }) => {
    const isFirefox = browser === "firefox";
    const isDev = command === "serve";

    return {
      name: "Mol* Linker",
      version: "3.2.0",
      description:
        "Instantly view molecular structure in your browser using Mol*.",

      action: {
        default_title: "Mol* Linker Quick Settings",
      },

      permissions: isFirefox
        ? ["activeTab", "storage", "contextMenus", "tabs"]
        : ["activeTab", "storage", "contextMenus", "scripting"],

      host_permissions: [
        "*://*.github.com/*",
        "*://*.gitlab.com/*",
        "*://*.figshare.com/*",
        "*://*.zenodo.org/*",
      ],

      ...(isFirefox
        ? { optional_permissions: ["*://*/*"] }
        : { optional_host_permissions: ["*://*/*"] }),

      content_security_policy: {
        // No 'unsafe-eval' on extension pages in either browser.
        extension_pages: "script-src 'self'; object-src 'none';",

        ...(!isFirefox && {
          // Dev server needs the loose policy (HMR). Test CSP changes with a production build.
          sandbox: sandboxCsp(isDev, true),
        }),
      },

      ...(isFirefox && {
        browser_specific_settings: {
          gecko: {
            id: "molstar-linker@me.fr",
            // 154 = first Firefox with the `sandbox` manifest key.
            strict_min_version: "154.0",
            data_collection_permissions: { required: ["none"] },
          },
          gecko_android: { strict_min_version: "154.0" },
        },
      }),

      icons: {
        "16": "icons/icon16.png",
        "32": "icons/icon32.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png",
      },
    };
  },
});
