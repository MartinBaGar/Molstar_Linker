import type { Plugin } from "vite";
import { DataFormatRegistry } from "molstar/lib/mol-plugin-state/formats/registry";

const VIRTUAL_MODULE_ID = "virtual:molstar-extensions";
const RESOLVED_VIRTUAL_MODULE_ID = "\0" + VIRTUAL_MODULE_ID;

export function molstarExtensionsPlugin(): Plugin {
  return {
    name: "molstar-extensions-generator",
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_MODULE_ID;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_MODULE_ID) return;
      const reg = new DataFormatRegistry();
      const ext = [...reg.extensions, ...reg.binaryExtensions, "molj", "molx"];
      return `export const ALL_EXTENSIONS = new Set(${JSON.stringify(ext)});`;
    },
  };
}
