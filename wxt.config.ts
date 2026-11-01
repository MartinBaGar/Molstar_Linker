import { defineConfig } from "wxt";
import fs from "fs";
import path from "path";
import { molstarExtensionsPlugin } from "./tools/molstar-extensions-plugin";

const VIRTUAL_MODULE_ID = "virtual:molstar-extensions";
const RESOLVED_VIRTUAL_MODULE_ID = "\0" + VIRTUAL_MODULE_ID;

const SANDBOX_FLAGS = "sandbox allow-scripts allow-downloads";
const SANDBOX_SCRIPT_SRC = "'self' 'unsafe-eval'";

// Files the sandboxed page loads (scripts, styles, Mol* bundle). HTML pages are
// deliberately NOT listed, so websites cannot frame viewer/options/sandbox.
const SANDBOX_WAR_PATHS = ["chunks/*", "assets/*", "lib/*"];

function sandboxCsp(dev: boolean): string {
  const devHosts = dev ? ["http://localhost:3000", "ws://localhost:3000"] : [];
  const connect = ["'self'", "blob:", "data:", ...devHosts].join(" ");
  const script = [SANDBOX_SCRIPT_SRC, ...devHosts].join(" ");

  return (
    [
      SANDBOX_FLAGS,
      "default-src 'none'",
      `script-src ${script}`,
      `connect-src ${connect}`,
      "img-src 'self' blob: data:",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "worker-src 'self' blob:",
      "child-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ].join("; ") + ";"
  );
}

function copyMolstarJs(destFolder: string): void {
  const src = path.resolve("node_modules/molstar/build/viewer/molstar.js");
  const js = fs
    .readFileSync(src, "utf8")
    .replace(/\/\/# sourceMappingURL=.*$/m, "");
  fs.writeFileSync(path.join(destFolder, "molstar.js"), js);
}

export default defineConfig({
  manifestVersion: 3,
  srcDir: "src",
  modules: ["@wxt-dev/module-svelte"],

  vite: () => ({
    plugins: [molstarExtensionsPlugin()],
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
    // Firefox"), but Firefox 154+ supports it.
    "build:manifestGenerated": (wxt, manifest) => {
      const m = manifest as any;
      m.sandbox = { pages: ["sandbox.html"] };
      m.content_security_policy = {
        ...(m.content_security_policy ?? {}),
        sandbox: sandboxCsp(wxt.config.command === "serve"),
      };

      if (wxt.config.browser !== "firefox") return;

      m.web_accessible_resources = [
        ...(m.web_accessible_resources ?? []),
        { resources: SANDBOX_WAR_PATHS, matches: ["<all_urls>"] },
      ];
    },
  },

  manifest: ({ browser }) => {
    const isFirefox = browser === "firefox";

    return {
      permissions: ["activeTab", "storage", "contextMenus", "scripting"],

      host_permissions: [
        "*://*.github.com/*",
        "*://*.gitlab.com/*",
        "*://*.figshare.com/*",
        "*://*.zenodo.org/*",
      ],

      optional_host_permissions: ["*://*/*"],

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
