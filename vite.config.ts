import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { readFileSync } from 'fs';
import makeManifest from './manifest.config';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig(({ mode }) => {
    const browser = mode === 'firefox' ? 'firefox' : 'chrome';

    return {
        plugins: [crx({ manifest: makeManifest(browser) })],
        build: {
            outDir: `dist/${browser}`,
            emptyOutDir: true,
            sourcemap: true,
            target: 'es2020',
            chunkSizeWarningLimit: 2000,
            rollupOptions: {
                input: {
                    viewer: 'viewer.html',
                    sandbox: 'sandbox.html',
                },
            },
            define: {
                __APP_VERSION__: JSON.stringify(pkg.version),
            },
            plugins: [crx({ manifest: makeManifest(browser) })],
        },
    };
});
