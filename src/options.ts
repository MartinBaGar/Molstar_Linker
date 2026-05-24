// // src/options.ts

import { AppConfig } from './config.js';
// import { PermissionsManager } from './permissions.js';
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

function showStatus(message: string, isError = false): void {
    const el = document.getElementById('status');
    if (!el) return;
    el.textContent   = message;
    el.style.color   = isError ? 'var(--danger)' : 'var(--success)';
    setTimeout(() => { el.textContent = ''; }, 3000);
}

// ---------------------------------------------------------------------------
// Dynamic UI helpers
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 1. Build the main UI (scene settings + per-target cards)
// ---------------------------------------------------------------------------
const sceneContainer  = document.getElementById('scene-settings-container') as HTMLDivElement;
const targetContainer = document.getElementById('settings-container')       as HTMLDivElement;
const rulesContainer  = document.getElementById('custom-rules-container')   as HTMLDivElement;

function buildUI(): void {
sceneContainer.innerHTML = `
<details class="target-card" id="scene-card">
    <summary><span>Canvas &amp; Camera</span><span style="font-size:10px;opacity:.5">▼</span></summary>
    <div class="card-content">
    <div class="setting-row">
        <label>Background Color</label>
        <div class="color-input-group">
        <input type="color" class="color-picker" id="canvas_color_picker" value="#ffffff">
        <input type="text"  class="color-text"   id="canvas_color" placeholder="e.g. white or #ffffff" value="#ffffff">
        </div>
    </div>
    <div class="setting-row">
        <label>Camera JSON (optional)</label>
        <textarea id="camera_json" placeholder='{"target":[0,0,0],"position":[50,50,50]}'></textarea>
    </div>
    </div>
</details>`;

(document.getElementById('canvas_color_picker') as HTMLInputElement)
.addEventListener('input', (e) => {
    (document.getElementById('canvas_color') as HTMLInputElement).value =
    (e.target as HTMLInputElement).value;
});

targetContainer.innerHTML = '';
}

// ---------------------------------------------------------------------------
// 2. Custom rule cards
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
    card.className = 'target-card custom-rule-card';
    card.open      = true;

    card.innerHTML = `
    <summary>
        <span class="rule-title-display">${escapeHTML(data.meta?.name)}</span>
        <div style="display:flex;align-items:center;gap:10px">
        <button class="danger-outline delete-rule-btn"
            style="padding:2px 8px;width:auto;font-size:11px">Delete</button>
        <span style="font-size:10px;opacity:.5">▼</span>
        </div>
    </summary>
    <div class="card-content">
        <div class="flex-row">
            <div style="flex:2"><label>Rule Name</label>
                <input type="text" class="cr-name" value="${escapeHTML(data.meta?.name)}">
            </div>
            <div style="flex:1"><label>Rep</label>
                <select class="cr-rep">
                    <option value="ball-and-stick">Ball and sticks</option>
                    <option value="cartoon">Cartoon</option>
                </select>
            </div>
            <div>
                <select class="cr-lang">
                    <option value="pymol">PyMOL</option>
                    <option value="vmd">VMD</option>
                </select>
                <label for="cr-expression">Selection Rule:</label>
                <input type="text" class="cr-expression" id="selection-rule" name="selection-rule">
            </div>
        </div>
    </div>`;

    (card.querySelector('.cr-name') as HTMLInputElement).addEventListener('input', (e) => {
    (card.querySelector('.rule-title-display') as HTMLSpanElement).textContent =
        (e.target as HTMLInputElement).value || 'Unnamed Rule';
    });

    // Delete button
    card.querySelector('.delete-rule-btn')?.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation(); card.remove();
    });

    // Live-update summary title
    (card.querySelector('.cr-name') as HTMLInputElement).addEventListener('input', (e) => {
    (card.querySelector('.rule-title-display') as HTMLSpanElement).textContent =
        (e.target as HTMLInputElement).value || 'Unnamed Rule';
    });

    rulesContainer.appendChild(card);
};
// }

document.getElementById('add-custom-rule')?.addEventListener('click', () => addCustomRuleCard());

// ---------------------------------------------------------------------------
// 3. Extract current UI state into an ExtensionSettings object
// ---------------------------------------------------------------------------
function extractCurrentSettings(): ExtensionSettings {
    const s: Record<string, unknown> = { ...AppConfig.getDefaults() };

    s.canvas_color = (document.getElementById('canvas_color') as HTMLInputElement).value;
    s.camera_json  = (document.getElementById('camera_json')  as HTMLTextAreaElement).value;

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
// 4. Inject a settings object back into the UI
// ---------------------------------------------------------------------------
function injectSettingsIntoUI(settingsObj: ExtensionSettings): void {
    sceneContainer.innerHTML  = '';
    targetContainer.innerHTML = '';
    rulesContainer.innerHTML  = '';
    buildUI();

    const canvasInput = document.getElementById('canvas_color') as HTMLInputElement;
    const pickerInput = document.getElementById('canvas_color_picker') as HTMLInputElement;
    if (settingsObj.canvas_color) {
    canvasInput.value = settingsObj.canvas_color as string;
    if ((settingsObj.canvas_color as string).startsWith('#')) pickerInput.value = settingsObj.canvas_color as string;
    }
    if (settingsObj.camera_json) {
    (document.getElementById('camera_json') as HTMLTextAreaElement).value = settingsObj.camera_json as string;
    }

    if (Array.isArray(settingsObj.customRules)) {
    settingsObj.customRules.forEach(rule => addCustomRuleCard(rule));
    }
}

// // ---------------------------------------------------------------------------
// // 5. Preset management
// // ---------------------------------------------------------------------------
// // let customPresets: Record<string, Preset> = {};

// // function updatePresetDropdown(): void {
// //   const select = document.getElementById('template-select') as HTMLSelectElement;
// //   select.innerHTML = '';

// //   // Built-in presets
// //   for (const [key, preset] of Object.entries(AppConfig.builtInPresets)) {
// //     select.add(new Option(`[Built-in] ${preset.name}`, `builtin_${key}`));
// //   }

// //   // Custom presets
// //   for (const [key, preset] of Object.entries(customPresets)) {
// //     select.add(new Option(`[Custom] ${preset.name}`, `custom_${key}`));
// //   }
// // }

// // document.getElementById('load-template')?.addEventListener('click', () => {
// //   const val = (document.getElementById('template-select') as HTMLSelectElement).value;
// //   const allPresets = AppConfig.getAllPresets(customPresets);
// //   const overrides = val.startsWith('builtin_')
// //     ? AppConfig.builtInPresets[val.replace('builtin_', '')]?.settings ?? {}
// //     : allPresets[val.replace('custom_', '')]?.settings ?? {};
// //   injectSettingsIntoUI({ ...AppConfig.getDefaults(), ...overrides });
// //   showStatus('Preset loaded!');
// // });

// // document.getElementById('delete-template')?.addEventListener('click', () => {
// //   const val = (document.getElementById('template-select') as HTMLSelectElement).value;
// //   if (val.startsWith('builtin_')) { alert('Cannot delete built-in presets.'); return; }
// //   const id = val.replace('custom_', '');
// //   if (confirm(`Delete "${customPresets[id]?.name}"?`)) {
// //     delete customPresets[id];
// //     StorageAPI.set({ customPresets: customPresets as unknown as Record<string, unknown> }, () => {
// //       updatePresetDropdown();
// //       showStatus('Deleted.');
// //     });
// //   }
// // });

// // document.getElementById('save-template')?.addEventListener('click', () => {
// //   const name = (document.getElementById('new-template-name') as HTMLInputElement).value.trim();
// //   if (!name) { alert('A preset name is required.'); return; }

// //   const current = extractCurrentSettings();
// //   const existingId = Object.keys(customPresets).find(
// //     k => customPresets[k].name.toLowerCase() === name.toLowerCase(),
// //   );
// //   if (existingId && !confirm(`Overwrite "${name}"?`)) return;

// //   const id = existingId ?? `user_preset_${Date.now()}`;
// //   customPresets[id] = { name, settings: current };
// //   StorageAPI.set({ customPresets: customPresets as unknown as Record<string, unknown> }, () => {
// //     updatePresetDropdown();
// //     (document.getElementById('new-template-name') as HTMLInputElement).value = '';
// //     showStatus('Saved!');
// //   });
// // });

// ---------------------------------------------------------------------------
// 7. Save button
// ---------------------------------------------------------------------------
document.getElementById('save')?.addEventListener('click', () => {
  const settings = extractCurrentSettings();
  StorageAPI.set(
    settings as unknown as Record<string, unknown>,
    () => {
      showStatus('Applied!');
      extApi.runtime.sendMessage({
        action: 'SETTINGS_UPDATED',
        settings: settings,        // ← ADD
      }).catch(() => {});
    }
  );
});

// // ---------------------------------------------------------------------------
// // 8. Domain management
// // ---------------------------------------------------------------------------
// function refreshCustomDomainList(): void {
//   const list = document.getElementById('custom-domains-list');
//   if (!list) return;

//   StorageAPI.get({ customDomains: [] }, (data) => {
//     const domains = (data.customDomains as string[]) ?? [];

//     if (domains.length === 0) {
//       list.innerHTML = '<p style="color:#57606a;font-style:italic;font-size:13px">No custom domains authorized yet.</p>';
//       return;
//     }

//     list.innerHTML = '';
//     for (const domain of domains) {
//       const row = document.createElement('div');
//       row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px;background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;margin-bottom:8px';
//       // escapeHTML used for domain before injecting into innerHTML
//       row.innerHTML = `
//         <div style="display:flex;align-items:center;gap:10px">
//           <span>🌐</span><span style="font-weight:500">${escapeHTML(domain)}</span>
//         </div>
//         <button class="danger-outline remove-domain-btn"
//           data-domain="${escapeHTML(domain)}"
//           style="padding:4px 10px;font-size:12px">Remove</button>`;
//       list.appendChild(row);
//     }

//     list.querySelectorAll<HTMLButtonElement>('.remove-domain-btn').forEach(btn => {
//       btn.addEventListener('click', async (e) => {
//         const dom = (e.target as HTMLButtonElement).dataset.domain!;
//         if (confirm(`Revoke access for ${dom}?`)) {
//           await PermissionsManager.revokeAndUnregister(dom);
//           refreshCustomDomainList();
//         }
//       });
//     });
//   });
// }

// document.getElementById('add-manual-domain')?.addEventListener('click', async () => {
//   const input = document.getElementById('manual-domain-input') as HTMLInputElement;
//   const dom   = input.value.trim();
//   if (!dom) return;
//   if (await PermissionsManager.requestAndRegister(dom)) {
//     input.value = '';
//     refreshCustomDomainList();
//   }
// });

// // ---------------------------------------------------------------------------
// // 9. Initialisation
// // ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  StorageAPI.get(null, (savedItems) => {
    // customPresets = (savedItems.customPresets as Record<string, Preset>) ?? {};
    // updatePresetDropdown();
    injectSettingsIntoUI({ ...AppConfig.getDefaults(), ...savedItems } as ExtensionSettings);
  });
});

//   refreshCustomDomainList();

//   // If the popup or viewer redirected here with a ?domain= param,
//   // pre-fill the manual domain input and scroll to it
//   const autoDomain = new URLSearchParams(window.location.search).get('domain');
//   if (autoDomain) {
//     const input = document.getElementById('manual-domain-input') as HTMLInputElement | null;
//     if (input) {
//       input.value = autoDomain;
//       input.focus();
//       window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
//     }
//   }
// });
