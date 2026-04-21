// src/options.ts

import { AppConfig } from './config.js';
import { PermissionsManager } from './permissions.js';
import { ExtensionSettings, CustomRule, Preset } from './types.js';

declare const browser: typeof chrome;
const extApi = (typeof browser !== 'undefined' ? browser : chrome) as typeof chrome;

function escapeHTML(str: string): string {
    const div = document.createElement('div'); div.textContent = str; return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', async () => {
    const ruleList = document.getElementById('custom-rules-container') as HTMLDivElement;
    const addRuleBtn = document.getElementById('add-custom-rule') as HTMLButtonElement;
    const saveBtn = document.getElementById('save') as HTMLButtonElement;
    const templateSelect = document.getElementById('template-select') as HTMLSelectElement;
    const templateNameInput = document.getElementById('new-template-name') as HTMLInputElement;
    const saveTemplateBtn = document.getElementById('save-template') as HTMLButtonElement;
    const loadTemplateBtn = document.getElementById('load-template') as HTMLButtonElement;
    const deleteTemplateBtn = document.getElementById('delete-template') as HTMLButtonElement;
    const domainList = document.getElementById('custom-domains-list') as HTMLDivElement;
    const settingsContainer = document.getElementById('settings-container') as HTMLDivElement;
    const sceneContainer = document.getElementById('scene-settings-container') as HTMLDivElement;
    const manualDomainInput = document.getElementById('manual-domain-input') as HTMLInputElement;
    const addManualDomainBtn = document.getElementById('add-manual-domain') as HTMLButtonElement;

    const settings = await new Promise<ExtensionSettings>(resolve => 
        extApi.storage.sync.get(AppConfig.getDefaults(), (data) => resolve(data as ExtensionSettings))
    );

    // --- RENDER UI ---
    sceneContainer.innerHTML = `
        <div style="margin-bottom: 12px;">
            <label style="display:block; font-weight:bold; margin-bottom:4px;">Canvas Color</label>
            <input type="color" id="canvas_color" value="${settings.canvas_color || '#ffffff'}">
        </div>
        <div style="margin-bottom: 12px;">
            <label style="display:block; font-weight:bold; margin-bottom:4px;">Camera JSON (Optional)</label>
            <input type="text" id="camera_json" placeholder="{...}" value="${settings.camera_json || ''}" style="width:100%; padding:8px;">
        </div>
    `;

    let targetsHTML = '';
    AppConfig.targets.forEach(t => {
        const repOptions = Object.keys(AppConfig.RepSchema).map(r => 
            `<option value="${r}" ${settings[`${t.id}_rep`] === r ? 'selected' : ''}>${r}</option>`
        ).join('');

        targetsHTML += `
        <div style="background: #f6f8fa; padding: 12px; border-radius: 6px; margin-bottom: 12px; border: 1px solid #d0d7de;">
            <h4 style="margin: 0 0 10px 0;">${t.label}</h4>
            <div style="display:flex; gap:10px;">
                <div style="flex:1;">
                    <label style="display:block; font-size:12px;">Representation</label>
                    <select id="${t.id}_rep" style="width:100%; padding:6px;">${repOptions}</select>
                </div>
                <div style="flex:1;">
                    <label style="display:block; font-size:12px;">Color Value</label>
                    <input type="text" id="${t.id}_colorVal" value="${settings[`${t.id}_colorVal`] || t.color}" style="width:100%; padding:6px;">
                </div>
            </div>
        </div>`;
    });
    settingsContainer.innerHTML = targetsHTML;

    // --- DOMAIN MANAGEMENT ---
    async function refreshDomainList() {
        const data = await new Promise<{ customDomains?: string[] }>(resolve => extApi.storage.sync.get({ customDomains: [] }, resolve));
        const domains = data.customDomains || [];
        domainList.innerHTML = domains.length === 0 ? '<p style="color: #57606a; font-size: 13px;">No custom domains authorized yet.</p>' : '';
        
        domains.forEach(domain => {
            const item = document.createElement('div');
            item.innerHTML = `<span style="font-weight:bold; margin-right:15px;">${escapeHTML(domain)}</span><button class="btn-remove" data-domain="${escapeHTML(domain)}" style="color:red; cursor:pointer; background:none; border:none; text-decoration:underline;">Remove</button>`;
            item.querySelector('.btn-remove')?.addEventListener('click', async (e) => {
                const target = e.target as HTMLButtonElement;
                if (target.dataset.domain) {
                    await PermissionsManager.revokeAndUnregister(target.dataset.domain);
                    refreshDomainList();
                }
            });
            domainList.appendChild(item);
        });
    }
    refreshDomainList();

    addManualDomainBtn?.addEventListener('click', async () => {
        const domain = manualDomainInput.value.trim();
        if (domain) {
            await PermissionsManager.requestAndRegister(domain);
            manualDomainInput.value = '';
            refreshDomainList();
        }
    });

    // --- TEMPLATES ---
    async function refreshTemplateSelect() {
        templateSelect.innerHTML = '';
        const optGroupBuiltIn = document.createElement('optgroup');
        optGroupBuiltIn.label = "Built-in Presets";
        for (const [key, preset] of Object.entries(AppConfig.presets)) {
            optGroupBuiltIn.innerHTML += `<option value="builtin_${key}">${preset.name}</option>`;
        }
        templateSelect.appendChild(optGroupBuiltIn);

        const data = await new Promise<{ customTemplates?: Record<string, Preset> }>(resolve => extApi.storage.sync.get({ customTemplates: {} }, resolve));
        const customTemplates = data.customTemplates || {};
        if (Object.keys(customTemplates).length > 0) {
            const optGroupCustom = document.createElement('optgroup');
            optGroupCustom.label = "My Custom Templates";
            for (const [key, tpl] of Object.entries(customTemplates)) {
                optGroupCustom.innerHTML += `<option value="custom_${key}">${tpl.name}</option>`;
            }
            templateSelect.appendChild(optGroupCustom);
        }
    }
    refreshTemplateSelect();

    loadTemplateBtn?.addEventListener('click', async () => {
        const val = templateSelect.value;
        let presetOverrides: any = {};
        if (val.startsWith('builtin_')) {
            presetOverrides = AppConfig.presets[val.replace('builtin_', '')].settings;
        } else {
            const data = await new Promise<{ customTemplates?: Record<string, Preset> }>(resolve => extApi.storage.sync.get({ customTemplates: {} }, resolve));
            presetOverrides = (data.customTemplates || {})[val.replace('custom_', '')].settings;
        }
        await extApi.storage.sync.set({ ...AppConfig.getDefaults(), ...presetOverrides });
        location.reload();
    });

    deleteTemplateBtn?.addEventListener('click', async () => {
        const val = templateSelect.value;
        if (val.startsWith('builtin_')) return alert("Cannot delete built-in presets.");
        const data = await new Promise<{ customTemplates?: Record<string, Preset> }>(resolve => extApi.storage.sync.get({ customTemplates: {} }, resolve));
        const templates = data.customTemplates || {};
        delete templates[val.replace('custom_', '')];
        await extApi.storage.sync.set({ customTemplates: templates });
        refreshTemplateSelect();
    });

    // --- EXPORT & IMPORT ---
    document.getElementById('export-json')?.addEventListener('click', async () => {
        const currentSettings = await gatherCurrentUIAsSettings();
        const blob = new Blob([JSON.stringify(currentSettings, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'molstar_linker_settings.json';
        a.click();
    });

    document.getElementById('import-json')?.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const imported = JSON.parse(event.target?.result as string);
                await extApi.storage.sync.set(imported);
                alert('Settings imported successfully! Reloading...');
                location.reload();
            } catch (err) { alert('Invalid JSON file.'); }
        };
        reader.readAsText(file);
    });

    // --- RULES & SAVING ---
    function createRuleUI(rule: Partial<CustomRule> = {}) {
        const card = document.createElement('div');
        card.className = 'rule-card';
        card.style.cssText = 'background: white; padding: 12px; border: 1px solid #d0d7de; margin-bottom: 10px; border-radius: 6px;';
        card.innerHTML = `
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <input type="text" class="rule-name" placeholder="Rule Name" value="${escapeHTML(rule.name || '')}" style="flex:1;">
                <button class="btn-delete-rule" style="color:red; cursor:pointer;">Delete</button>
            </div>
            <div style="display:flex; gap:10px;">
                <input type="text" class="rule-selector" placeholder="Selector (e.g. :A)" value="${escapeHTML(rule.selector || '')}" style="flex:2;">
                <select class="rule-rep" style="flex:1;">
                    ${Object.keys(AppConfig.RepSchema).map(r => `<option value="${r}" ${rule.rep === r ? 'selected' : ''}>${r}</option>`).join('')}
                </select>
                <input type="color" class="rule-color" value="${rule.colorVal || '#ffffff'}">
            </div>
        `;
        card.querySelector('.btn-delete-rule')?.addEventListener('click', () => card.remove());
        ruleList.appendChild(card);
    }

    if (settings.customRules) settings.customRules.forEach(r => createRuleUI(r));
    addRuleBtn?.addEventListener('click', () => createRuleUI());

    async function gatherCurrentUIAsSettings(): Promise<ExtensionSettings> {
        const newSettings: any = { ...AppConfig.getDefaults() };
        newSettings.canvas_color = (document.getElementById('canvas_color') as HTMLInputElement).value;
        newSettings.camera_json = (document.getElementById('camera_json') as HTMLInputElement).value;

        AppConfig.targets.forEach(t => {
            newSettings[`${t.id}_rep`] = (document.getElementById(`${t.id}_rep`) as HTMLSelectElement).value;
            newSettings[`${t.id}_colorVal`] = (document.getElementById(`${t.id}_colorVal`) as HTMLInputElement).value;
        });

        const rules: CustomRule[] = [];
        document.querySelectorAll('.rule-card').forEach(card => {
            const c = card as HTMLDivElement;
            rules.push({
                name: (c.querySelector('.rule-name') as HTMLInputElement).value,
                selector: (c.querySelector('.rule-selector') as HTMLInputElement).value,
                rep: (c.querySelector('.rule-rep') as HTMLSelectElement).value as any,
                colorVal: (c.querySelector('.rule-color') as HTMLInputElement).value,
                colorType: 'solid', size: '1.0', opacity: '1.0', mode: 'simple', scheme: 'auth', chain: '', ranges: '', specific: '', atomName: '', element: '', atomIndex: '', label: '', tooltip: '', focus: false, rawJson: '', rawParamsJson: '', subParams: {}
            });
        });
        newSettings.customRules = rules;
        return newSettings as ExtensionSettings;
    }

    saveBtn?.addEventListener('click', async () => {
        extApi.storage.sync.set(await gatherCurrentUIAsSettings(), () => alert("Settings applied to Mol*!"));
    });
    
    saveTemplateBtn?.addEventListener('click', async () => {
        const name = templateNameInput.value.trim();
        if (!name) return;
        const currentSettings = await gatherCurrentUIAsSettings();
        const data = await new Promise<{ customTemplates?: Record<string, Preset> }>(resolve => extApi.storage.sync.get({ customTemplates: {} }, resolve));
        const templates = data.customTemplates || {};
        templates[name.toLowerCase().replace(/\s+/g, '_')] = { name, settings: currentSettings };
        await extApi.storage.sync.set({ customTemplates: templates });
        alert(`Template "${name}" saved!`);
        refreshTemplateSelect();
    });
});
