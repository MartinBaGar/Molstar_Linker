import { defineConfig } from 'wxt';
import fs from 'fs';
import path from 'path';
import { DataFormatRegistry } from 'molstar/lib/mol-plugin-state/formats/registry';

const VIRTUAL_MODULE_ID = 'virtual:molstar-extensions';
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID;

export default defineConfig({
    srcDir: 'src',
    modules: ['@wxt-dev/module-svelte'],

    vite: () => ({
        plugins: [
            {
                name: 'molstar-extensions-generator',
                resolveId(id) {
                    if (id === VIRTUAL_MODULE_ID) {
                        return RESOLVED_VIRTUAL_MODULE_ID;
                    }
                },
                load(id) {
                    if (id === RESOLVED_VIRTUAL_MODULE_ID) {
                        const reg = new DataFormatRegistry();
                        const ext = [...Array.from(reg.extensions), ...Array.from(reg.binaryExtensions)];
                        return `export const ALL_EXTENSIONS = new Set(${JSON.stringify(ext)});`;
                    }
                },
            },
        ],
        server: {
            cors: {
                origin: '*',
            }
        }
    }),

    hooks: {
        'build:before': () => {
            const destFolder = path.resolve('public/lib');

            if (!fs.existsSync(destFolder)) {
                fs.mkdirSync(destFolder, { recursive: true });
            }

            fs.copyFileSync(
                path.resolve('node_modules/molstar/build/viewer/molstar.js'),
                path.join(destFolder, 'molstar.js')
            );

            fs.copyFileSync(
                path.resolve('node_modules/molstar/build/viewer/molstar.css'),
                path.join(destFolder, 'molstar.css')
            );

            console.log('✅ Successfully copied Molstar JS and CSS to public/lib/');
        }
    },

    manifest: ({ browser, command }) => {
        const isFirefox = browser === 'firefox';
        const isDev = command === 'serve';

        return {
            name: 'Mol* Linker',
            version: '3.1.0',
            description: 'Instantly view molecular structure in your browser using Mol*.',

            action: {
                default_title: 'Mol* Linker Quick Settings',
            },

            permissions: isFirefox
                ? ['activeTab', 'storage', 'contextMenus', 'tabs']
                : ['activeTab', 'storage', 'contextMenus', 'scripting'],

            host_permissions: [
                '*://*.github.com/*',
                '*://*.gitlab.com/*',
                '*://*.figshare.com/*',
                '*://*.zenodo.org/*'
            ],

            ...(isFirefox
                ? { optional_permissions: ['*://*/*'] }
                : { optional_host_permissions: ['*://*/*'] }
            ),

            content_security_policy: {
                extension_pages: isFirefox
                    ? "script-src 'self' 'unsafe-eval'; object-src 'self';"
                    : "script-src 'self'; object-src 'none';",

                ...(!isFirefox && {
                    sandbox: isDev
                        ? "sandbox allow-scripts allow-forms allow-popups allow-modals; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:3000 ws://localhost:3000; child-src 'self';"
                        : "sandbox allow-scripts allow-forms allow-popups allow-modals; script-src 'self' 'unsafe-inline' 'unsafe-eval'; child-src 'self';"
                })
            },

            ...(isFirefox && {
                browser_specific_settings: {
                    gecko: {
                        id: 'molstar-linker@me.fr',
                        strict_min_version: '102.0',
                        data_collection_permissions: { required: ['none'] }
                    }
                }
            }),

            icons: {
                '16': 'icons/icon16.png',
                '32': 'icons/icon32.png',
                '48': 'icons/icon48.png',
                '128': 'icons/icon128.png'
            }
        };
    }
});
