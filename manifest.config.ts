// manifest.config.ts
import { defineManifest } from '@crxjs/vite-plugin';

export default function makeManifest(browser: 'chrome' | 'firefox') {
    const common = {
        name: 'Mol* Linker',
        version: '3.1.0',
        description: 'Instantly view molecular structure in your browser using Mol*.',
        icons: {
            16: 'icons/icon16.png',
            32: 'icons/icon32.png',
            48: 'icons/icon48.png',
            128: 'icons/icon128.png',
        },
        options_ui: {
            page: 'options.html',
            open_in_tab: true,
        },
    };

    if (browser === 'firefox') {
        return defineManifest({
            manifest_version: 2,
            ...common,
            permissions: [
                'activeTab',
                'storage',
                'contextMenus',
                'tabs',
                '*://*.github.com/*',
                '*://*.gitlab.com/*',
                '*://*.figshare.com/*',
                '*://*.zenodo.org/*',
            ],
            optional_permissions: ['*://*/*'],
            background: {
                scripts: ['src/background.ts'],
            },
            content_security_policy: "script-src 'self' 'unsafe-eval'; object-src 'self';",
            browser_action: {
                default_popup: 'popup.html',
                default_title: 'Mol* Linker Quick Settings',
            },
            content_scripts: [
                {
                    matches: [
                        '*://*.github.com/*',
                        '*://*.gitlab.com/*',
                        '*://*.rcsb.org/*',
                        '*://*.alphafold.ebi.ac.uk/*',
                    ],
                    js: ['src/content.ts'],
                    run_at: 'document_end',
                },
            ],
            browser_specific_settings: {
                gecko: {
                    id: 'molstar-linker@me.fr',
                    strict_min_version: '102.0',
                    data_collection_permissions: {
                        required: ['none'],
                    },
                },
            },
        } as any);
    }

    return defineManifest({
        manifest_version: 3,
        ...common,
        minimum_chrome_version: '148',
        permissions: ['activeTab', 'storage', 'scripting', 'contextMenus'],
        host_permissions: [
            '*://*.github.com/*',
            '*://*.gitlab.com/*',
            '*://*.figshare.com/*',
            '*://*.zenodo.org/*',
        ],
        optional_host_permissions: ['*://*/*'],
        action: {
            default_popup: 'popup.html',
            default_title: 'Mol* Linker Quick Settings',
        },
        background: {
            service_worker: 'src/background.ts',
            type: 'module',
        },
        sandbox: {
            pages: ['sandbox.html'],
        },
        content_security_policy: {
            extension_pages: "script-src 'self'; object-src 'none';",
            sandbox:
                "sandbox allow-scripts allow-forms allow-popups allow-modals; script-src 'self' 'unsafe-inline' 'unsafe-eval'; child-src 'self';",
        },
        content_scripts: [
            {
                matches: [
                    '*://*.github.com/*',
                    '*://*.gitlab.com/*',
                    '*://*.figshare.com/*',
                    '*://*.zenodo.org/*',
                ],
                js: ['src/content.ts'],
                run_at: 'document_end',
            },
        ],
    });
}
