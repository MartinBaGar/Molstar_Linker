import * as v from "valibot";
import { InitMolstarMessageSchema } from "~/core/schemas";
import type { Viewer } from "molstar/lib/apps/viewer/app";
import { NativeBuilder, customRuleToRep } from "~/core/native-builder.js";
import { getFileNameFromBlob } from "~/utils/links.js";

declare global {
  const molstar: typeof import("molstar/lib/apps/viewer/app");
}

let viewerInstance: Viewer | null = null;

// 1. Dynamically inject the CSS to bypass Vite's HTML parser
const cssLink = document.createElement("link");
cssLink.rel = "stylesheet";
cssLink.type = "text/css";
cssLink.href = "/lib/molstar.css";
document.head.appendChild(cssLink);

// 2. Create the script tag dynamically to bypass Vite's bundler isolation
const script = document.createElement("script");
script.src = "/lib/molstar.js";

// 3. Wait for the physical file to load before setting up listeners
script.onload = () => {
  window.addEventListener("message", async (event: MessageEvent<any>) => {
    // Only accept messages from our parent (viewer.html). event.source is set
    // by the browser and can't be spoofed; origin is "null" for sandboxed
    // pages in both Chrome and Firefox, so it can't be used.
    if (event.source !== window.parent) return;

    const msg = event.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.action === "INIT_MOLSTAR") {
      const parsed = v.safeParse(InitMolstarMessageSchema, msg);
      if (!parsed.success) {
        console.warn("Mol* Sandbox: rejected message", parsed.issues);
        window.parent.postMessage(
          { action: "MOLSTAR_ERROR", error: "Invalid init message" },
          "*",
        );
        return;
      }
      const init = parsed.output;
      let shortBlobUrl: string | undefined;

      try {
        if (!viewerInstance) {
          viewerInstance = await molstar.Viewer.create("app", {
            layoutIsExpanded: false,
            layoutShowControls: false,
            layoutShowRemoteState: false,
          });
        }

        if (init.buffer === null) {
          window.parent.postMessage({ action: "MOLSTAR_READY" }, "*");
          return;
        }

        const { buffer, mimeType, format, originalUrl } = init;

        const blob = new Blob([buffer], { type: mimeType ?? undefined });
        const result = getFileNameFromBlob(blob, originalUrl ?? undefined);
        shortBlobUrl = result.shortBlobUrl;
        const filename = result.filename ?? `structure.${format}`;

        if (format === "molx" || format === "molj") {
          const file = new File([blob], `snapshot.${format}`);
          await viewerInstance.plugin.managers.snapshot.open(file);
        } else {
          await NativeBuilder.buildNativeScene(
            viewerInstance.plugin,
            shortBlobUrl,
            format,
            filename,
          );
        }
        window.parent.postMessage({ action: "MOLSTAR_READY" }, "*");
      } catch (err) {
        console.error("Mol* Sandbox: failed to load structure natively", err);
        window.parent.postMessage(
          { action: "MOLSTAR_ERROR", error: String(err) },
          "*",
        );
      } finally {
        if (shortBlobUrl) {
          URL.revokeObjectURL(shortBlobUrl.split("#")[0] ?? shortBlobUrl);
        }
      }
    }

    if (msg.action === "APPLY_REPRESENTATION") {
      if (!viewerInstance) return;
      try {
        const { applied, errors } = await customRuleToRep(
          viewerInstance.plugin,
          msg.settings,
        );
        if (errors.length > 0) {
          console.warn(
            `Mol* Sandbox: ${applied} rule(s) applied, ${errors.length} failed:`,
            errors,
          );
        }
      } catch (err) {
        console.error("Mol* Sandbox: failed to apply custom rules", err);
      }
    }
  });

  // 4. NOW tell the parent window we are ready to receive the INIT message.
  window.parent.postMessage({ action: "SANDBOX_READY" }, "*");
};

script.onerror = () => {
  console.error("❌ Failed to load Molstar script");
  window.parent.postMessage(
    { action: "MOLSTAR_ERROR", error: "Failed to load molstar.js" },
    "*",
  );
};

// 5. Inject the script into the page to trigger the download
document.head.appendChild(script);
