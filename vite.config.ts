import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig(({ mode, command }) => {
    const browser = mode === 'firefox' ? 'firefox' : 'chrome';
    const isDev = command === 'serve';

    const manifestStr = readFileSync(`./manifests/${browser}.json`, 'utf-8');
    const manifest = JSON.parse(manifestStr);

    manifest.version = pkg.version;

    if (browser === 'firefox') {
        manifest.background.scripts = ['src/background.ts'];
        manifest.content_scripts[0].js = ['src/content.ts'];
      if (isDev) {
            manifest.content_security_policy = manifest.content_security_policy.replace(
                "script-src 'self'",
                "script-src 'self' http://localhost:5173"
            );
        }
    } else {
        manifest.background.service_worker = 'src/background.ts';
        manifest.content_scripts[0].js = ['src/content.ts'];

        if (isDev) {
            manifest.content_security_policy.sandbox = manifest.content_security_policy.sandbox.replace(
                "script-src 'self'",
                "script-src 'self' http://localhost:5173"
            );
        }
    }

    return {
        server: {
            port: 5173,
            strictPort: true,
            cors: {
                origin: '*',
            },
        },
        build: {
            outDir: `dist/${browser}`,
            emptyOutDir: true,
            sourcemap: true,
        },
        plugins: [
            webExtension({
                manifest: () => manifest,
                browser: browser,
                additionalInputs: [
                    'viewer.html',
                    'sandbox.html'
                ]
            }),
        ],
    };
});
