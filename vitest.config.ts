import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";
import { molstarExtensionsPlugin } from "./tools/molstar-extensions-plugin";

export default defineConfig({
  plugins: [WxtVitest(), molstarExtensionsPlugin()],
});
