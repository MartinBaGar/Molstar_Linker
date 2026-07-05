import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig(({ mode }) => {
    // Vite defaults to 'production' mode during standard builds.
    // Our package.json scripts pass `--mode firefox` for the MV2 build.
    const browser = mode === 'firefox' ? 'firefox' : 'chrome';

    // 1. Read your original working JSON manifests directly
    const manifestStr = readFileSync(`./manifests/${browser}.json`, 'utf-8');
    const manifest = JSON.parse(manifestStr);

    // 2. Dynamically inject the version from package.json
    manifest.version = pkg.version;

    // 3. Update script paths to point to your TypeScript source files.
    // Vite compiles them and automatically rewrites the final manifest to use .js
    if (browser === 'firefox') {
        manifest.background.scripts = ['src/background.ts'];
        manifest.content_scripts[0].js = ['src/content.ts'];
    } else {
        manifest.background.service_worker = 'src/background.ts';
        manifest.content_scripts[0].js = ['src/content.ts'];
    }

    return {
        build: {
            outDir: `dist/${browser}`,
            emptyOutDir: true,
            sourcemap: true,
        },
        plugins: [
            webExtension({
                manifest: () => manifest,
                // 4. Force Vite to compile HTML files that are opened dynamically
                // and aren't explicitly listed in the manifests
                additionalInputs: [
                    'viewer.html',
                    'sandbox.html'
                ]
            }),
        ],
    };
});
