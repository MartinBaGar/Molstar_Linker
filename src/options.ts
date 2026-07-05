import { AppConfig } from './config.js';
import { PermissionsManager } from './permissions.js';
import type { ExtensionSettings, CustomRule } from './types.js';
import { StructureRepresentationRegistry } from 'molstar/lib/mol-repr/structure/registry';
import { Script } from 'molstar/lib/mol-script/script';
import { browser } from './utils/browser.js';

const SCRIPT_LANGUAGES: Script.Language[] = ['mol-script', 'pymol', 'vmd', 'jmol'];
const RULESCONTAINER = document.getElementById('custom-rules-container') as HTMLDivElement;

// ---------------------------------------------------------------------------
// XSS helper — used whenever injecting user strings into innerHTML
// ---------------------------------------------------------------------------
function escapeHTML(str: unknown): string {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    }[tag as '&'] ?? ''));
}

// ---------------------------------------------------------------------------
// Custom rule cards
// ---------------------------------------------------------------------------
function addCustomRuleCard(ruleData?: Partial<CustomRule>): void {
    const data: CustomRule = {
        meta: { id: Date.now().toString(), name: 'New Rule' },
        repprop: {
            ...ruleData?.repprop,
        },
        ...ruleData,
    };

    const card = document.createElement('details');
    card.className = 'target-card custom-rule-card rule-card';
    card.open = true;

    card.innerHTML = `
  <summary>
  <span class="rule-title-display">${escapeHTML(data.meta?.name)}</span>
  <button class="btn-danger delete-rule-btn" style="padding:2px 8px; font-size:12px;">Delete</button>
  </summary>
  <div class="card-content form-grid">
  <div class="form-group">
  <label>Rule Name</label>
  <input type="text" class="cr-name" value="${escapeHTML(data.meta?.name)}">
  </div>
  <div class="form-group">
  <label>Representation</label>
  <select class="cr-rep">
        ${Object.keys(StructureRepresentationRegistry.BuiltIn).map(rep => `
        <option value="${rep}" ${data.repprop?.type === rep ? 'selected' : ''}>
            ${rep.charAt(0).toUpperCase() + rep.slice(1)}
            </option>
        `).join('')}
        </select>
        </div>
        <div class="form-group">
        <label>Language</label>
        <select class="cr-lang">
        ${SCRIPT_LANGUAGES.map(lang => `
        <option value="${lang}" ${data.selection?.script?.language === lang ? 'selected' : ''}>
            ${lang.charAt(0).toUpperCase() + lang.slice(1)}
            </option>
        `).join('')}
        </select>
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
        <label>Selection Expression</label>
        <input type="text" class="cr-expression" value="${escapeHTML(data.selection?.script?.expression)}" placeholder="e.g., chain A and resi 10-20">
        </div>
        </div>
  `;

    // Delete button
    card.querySelector('.delete-rule-btn')?.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation(); card.remove();
        document.querySelector('.container')?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Live-update summary title
    (card.querySelector('.cr-name') as HTMLInputElement).addEventListener('input', (e) => {
        (card.querySelector('.rule-title-display') as HTMLSpanElement).textContent =
            (e.target as HTMLInputElement).value || 'Unnamed Rule';
    });

    RULESCONTAINER.appendChild(card);
}

document.getElementById('add-custom-rule')?.addEventListener('click', () => addCustomRuleCard());

// ---------------------------------------------------------------------------
// Extract current UI state into an ExtensionSettings object
// ---------------------------------------------------------------------------
function extractCurrentSettings(): ExtensionSettings {
    const s = { ...AppConfig.getDefaults() };

    const customRules: CustomRule[] = [];
    document.querySelectorAll<HTMLElement>('.custom-rule-card').forEach(card => {
        const rule: CustomRule = {
            meta: {
                id: (card.querySelector('.cr-name') as HTMLInputElement).value,
                name: (card.querySelector('.cr-name') as HTMLInputElement).value,
            },
            repprop: {
                type: (card.querySelector('.cr-rep') as HTMLSelectElement).value as StructureRepresentationRegistry.BuiltIn,
            },
            selection: {
                script: {
                    expression: (card.querySelector('.cr-expression') as HTMLInputElement).value,
                    language: (card.querySelector('.cr-lang') as HTMLSelectElement).value as Script.Language,
                },
            },
        };
        customRules.push(rule);
    });

    s.customRules = customRules;
    return s as ExtensionSettings;
}

// ---------------------------------------------------------------------------
// Action Bar Slide-Up & Save Logic
// ---------------------------------------------------------------------------
const actionBar = document.getElementById('action-bar');
const statusText = document.getElementById('status');

// Listen for any form changes inside the main container to show the slide-up bar
document.querySelector('.container')?.addEventListener('input', () => {
    if (actionBar && !actionBar.classList.contains('visible')) {
        actionBar.classList.add('visible');
        if (statusText) statusText.textContent = 'Unsaved changes';
    }
});

document.getElementById('save')?.addEventListener('click', () => {
    const settings = extractCurrentSettings();

    if (statusText) statusText.textContent = '✓ Applied to Mol*!';

    setTimeout(() => {
        if (actionBar) actionBar.classList.remove('visible');
    }, 2000);

    // Send settings to other tabs (no storage persistence)
    browser.runtime.sendMessage({
        action: 'SETTINGS_UPDATED',
        settings: settings,
    }).catch(() => { });
});

// ---------------------------------------------------------------------------
// Domain management
// ---------------------------------------------------------------------------
function refreshCustomDomainList(): void {
    const list = document.getElementById('custom-domains-list');
    if (!list) return;

    browser.storage.sync.get({ customDomains: [] }, (data) => {
        const domains = (data.customDomains as string[]) ?? [];

        if (domains.length === 0) {
            list.innerHTML = '<p class="empty-state">No custom domains authorized yet.</p>';
            return;
        }

        list.innerHTML = '';
        for (const domain of domains) {
            const row = document.createElement('div');
            row.className = 'domain-row';
            row.innerHTML = `
        <span>🌐 <strong>${escapeHTML(domain)}</strong></span>
        <button class="btn-danger remove-domain-btn" data-domain="${escapeHTML(domain)}">Remove</button>
      `;
            list.appendChild(row);
        }

        list.querySelectorAll<HTMLButtonElement>('.remove-domain-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const dom = (e.target as HTMLButtonElement).dataset.domain!;
                if (confirm(`Revoke access for ${dom}?`)) {
                    await PermissionsManager.revokeAndUnregister(dom);
                    refreshCustomDomainList();
                }
            });
        });
    });
}

document.getElementById('add-manual-domain')?.addEventListener('click', async () => {
    const input = document.getElementById('manual-domain-input') as HTMLInputElement;
    const dom = input.value.trim();
    if (!dom) return;
    if (await PermissionsManager.requestAndRegister(dom)) {
        input.value = '';
        refreshCustomDomainList();
    }
});

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    const versionEl = document.querySelector('.version');
    if (versionEl) versionEl.textContent = `v${__APP_VERSION__}`;
    refreshCustomDomainList();
});
