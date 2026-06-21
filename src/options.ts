// src/options.ts

import { AppConfig } from './config.js';
import { PermissionsManager } from './permissions.js';
import type { ExtensionSettings, CustomRule } from './types.js';
import { StructureRepresentationRegistry } from 'molstar/lib/mol-repr/structure/registry';

declare const browser: typeof chrome;
const extApi = (typeof browser !== 'undefined' ? browser : chrome) as typeof chrome;

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------
const StorageAPI = {
    get(keys: Record<string, unknown> | null, cb: (r: Record<string, unknown>) => void): void {
        extApi.storage.sync.get(keys as Record<string, unknown>, cb as (r: Record<string, unknown>) => void);
    },
    set(data: Record<string, unknown>, cb?: () => void): void {
        if (cb) {
            extApi.storage.sync.set(data, cb);
        } else {
            extApi.storage.sync.set(data);
        }
    },
};

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
// Dynamic UI helpers
// ---------------------------------------------------------------------------
const sceneContainer = document.getElementById('scene-settings-container') as HTMLDivElement;
const rulesContainer = document.getElementById('custom-rules-container') as HTMLDivElement;

function buildUI(): void {
    if (!sceneContainer) return;

    sceneContainer.innerHTML = `
    <div class="form-grid">
      <div class="form-group">
        <label>Background Color</label>
        <div style="display:flex; gap:10px;">
          <input type="color" id="canvas_color_picker" value="#ffffff" style="width:50px; padding:0;">
          <input type="text" id="canvas_color" placeholder="#ffffff" value="#ffffff">
        </div>
      </div>
      <div class="form-group">
        <label>Camera JSON (optional)</label>
        <textarea id="camera_json" placeholder='{"target":[0,0,0],"position":[50,50,50]}'></textarea>
      </div>
    </div>
  `;

    (document.getElementById('canvas_color_picker') as HTMLInputElement)
        .addEventListener('input', (e) => {
            (document.getElementById('canvas_color') as HTMLInputElement).value =
                (e.target as HTMLInputElement).value;
        });
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
    card.className = 'target-card custom-rule-card rule-card'; // Added rule-card class
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
          <option value="ball-and-stick" ${data.repprop.type === 'ball-and-stick' ? 'selected' : ''}>Ball and sticks</option>
          <option value="cartoon" ${data.repprop.type === 'cartoon' ? 'selected' : ''}>Cartoon</option>
        </select>
      </div>
      <div class="form-group">
        <label>Language</label>
        <select class="cr-lang">
          <option value="pymol" ${data.selection?.script?.language === 'pymol' ? 'selected' : ''}>PyMOL</option>
          <option value="vmd" ${data.selection?.script?.language === 'vmd' ? 'selected' : ''}>VMD</option>
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
        // Trigger the "Unsaved changes" bar
        document.querySelector('.container')?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Live-update summary title
    (card.querySelector('.cr-name') as HTMLInputElement).addEventListener('input', (e) => {
        (card.querySelector('.rule-title-display') as HTMLSpanElement).textContent =
            (e.target as HTMLInputElement).value || 'Unnamed Rule';
    });

    rulesContainer.appendChild(card);
}

document.getElementById('add-custom-rule')?.addEventListener('click', () => addCustomRuleCard());

// ---------------------------------------------------------------------------
// Extract current UI state into an ExtensionSettings object
// ---------------------------------------------------------------------------
function extractCurrentSettings(): ExtensionSettings {
    const s: Record<string, unknown> = { ...AppConfig.getDefaults() };

    // Safely get values, fallback to empty string if DOM element is missing
    const canvasColorEl = document.getElementById('canvas_color') as HTMLInputElement | null;
    const cameraJsonEl = document.getElementById('camera_json') as HTMLTextAreaElement | null;

    s.canvas_color = canvasColorEl ? canvasColorEl.value : "#ffffff";
    s.camera_json = cameraJsonEl ? cameraJsonEl.value : "";

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
                    language: (card.querySelector('.cr-lang') as HTMLSelectElement).value as 'mol-script' | 'pymol' | 'vmd' | 'jmol',
                },
            },
        };
        customRules.push(rule);
    });

    s.customRules = customRules;
    return s as ExtensionSettings;
}

// ---------------------------------------------------------------------------
// Inject a settings object back into the UI
// ---------------------------------------------------------------------------
function injectSettingsIntoUI(settingsObj: ExtensionSettings): void {
    if (sceneContainer) sceneContainer.innerHTML = '';
    if (rulesContainer) rulesContainer.innerHTML = '';

    buildUI();

    const canvasInput = document.getElementById('canvas_color') as HTMLInputElement | null;
    const pickerInput = document.getElementById('canvas_color_picker') as HTMLInputElement | null;

    if (settingsObj.canvas_color && canvasInput && pickerInput) {
        canvasInput.value = settingsObj.canvas_color as string;
        if ((settingsObj.canvas_color as string).startsWith('#')) {
            pickerInput.value = settingsObj.canvas_color as string;
        }
    }

    const cameraInput = document.getElementById('camera_json') as HTMLTextAreaElement | null;
    if (settingsObj.camera_json && cameraInput) {
        cameraInput.value = settingsObj.camera_json as string;
    }

    if (Array.isArray(settingsObj.customRules)) {
        settingsObj.customRules.forEach(rule => addCustomRuleCard(rule));
    }
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
    extApi.runtime.sendMessage({
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

    StorageAPI.get({ customDomains: [] }, (data) => {
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
    StorageAPI.get(null, (savedItems) => {
        injectSettingsIntoUI({ ...AppConfig.getDefaults(), ...savedItems } as ExtensionSettings);
    });

    refreshCustomDomainList();

    const autoDomain = new URLSearchParams(window.location.search).get('domain');
    if (autoDomain) {
        const input = document.getElementById('manual-domain-input') as HTMLInputElement | null;
        if (input) {
            input.value = autoDomain;
            input.focus();
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }
    }
});
