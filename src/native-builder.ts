// src/native-builder.ts

import { StructureElement, Structure } from 'molstar/lib/mol-model/structure';
import type { PluginContext } from 'molstar/lib/mol-plugin/context';
import { Color } from 'molstar/lib/mol-util/color';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { TextBuilder } from 'molstar/lib/mol-geo/geometry/text/text-builder';
import { Text } from 'molstar/lib/mol-geo/geometry/text/text';
import { Shape } from 'molstar/lib/mol-model/shape';
import { ShapeProvider } from 'molstar/lib/mol-model/shape/provider';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { AppConfig } from './config.js';
import type { ExtensionSettings, CustomRule } from './types.js';

let activeTooltips: { loci: StructureElement.Loci; text: string }[] = [];
let isTooltipProviderRegistered = false;

export const NativeBuilder = {
  
  async buildNativeScene(
    plugin: PluginContext, 
    url: string, 
    format: string, 
    settings: ExtensionSettings
  ): Promise<void> {
    
    plugin.clear();

    const isBinary = format === 'bcif';
    const parsedFormat = format === 'cif' ? 'mmcif' : format;
    
    const data = await plugin.builders.data.download({ url, isBinary });
    const trajectory = await plugin.builders.structure.parseTrajectory(data, parsedFormat as any);
    const model = await plugin.builders.structure.createModel(trajectory);
    const structure = await plugin.builders.structure.createStructure(model);

    if (settings.canvas_color) {
      plugin.canvas3d?.setProps({
        renderer: { backgroundColor: Color.fromHexStyle(settings.canvas_color as string) }
      });
    }

    if (settings.camera_json) {
      try {
        const camState = JSON.parse(settings.camera_json as string);
        setTimeout(() => {
          plugin.canvas3d?.camera.setState(camState);
          plugin.canvas3d?.requestDraw();
        }, 200);
      } catch (e) {
        console.warn('Invalid camera JSON', e);
      }
    }

    for (const target of AppConfig.targets) {
      const repType = settings[`${target.id}_rep`] as string | undefined;
      if (!repType || repType === 'off') continue;

      const component = await plugin.builders.structure.tryCreateComponentStatic(
        structure, 
        target.selector as any 
      );

      if (component) {
        await this.applyRepresentation(plugin, component, target.id, settings);
      }
    }

    activeTooltips = [];

    if (!isTooltipProviderRegistered) {
      plugin.managers.lociLabels.addProvider({
        label: (hoveredLoci: any) => {
          if (hoveredLoci.kind !== 'element-loci') return undefined;

          const rootA = hoveredLoci.structure.root;

          for (const t of activeTooltips) {
            const rootB = t.loci.structure.root;
            if (rootA === rootB) {
              const hoverAtRoot = StructureElement.Loci.remap(hoveredLoci, rootA);
              const targetAtRoot = StructureElement.Loci.remap(t.loci, rootA);
              const intersect = StructureElement.Loci.intersect(hoverAtRoot, targetAtRoot);
              
              if (!StructureElement.Loci.isEmpty(intersect)) {
                return `<div style="background-color: #2da44e; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; display: inline-block; line-height: 1.4;">${t.text}</div>`;
              }
            }
          }
          return undefined;
        }
      });
      isTooltipProviderRegistered = true;
    }

    if (Array.isArray(settings.customRules)) {
      for (let i = 0; i < settings.customRules.length; i++) {
        const rule = settings.customRules[i];
        if (!rule) continue;

        let expression;
        if (rule.mode === 'expert' && rule.selector) {
          expression = this.buildExpertExpression(rule.selector);
        } else {
          expression = this.buildSimpleExpression(rule);
        }

        const componentId = `custom-rule-${i}`;
        const component = await plugin.builders.structure.tryCreateComponentFromExpression(
          structure,
          expression,
          componentId,
          { label: rule.name || `Custom Rule ${i + 1}` }
        );

        if (component && component.obj?.data) {
          
          await this.applyCustomRuleRepresentation(plugin, component, rule);

          if (rule.label) {
            await this.apply3DLabel(plugin, component, rule.label);
          }

          const hoverContent = [
            rule.label ? `🏷️ ${rule.label}` : '',
            rule.tooltip ? `ℹ️ ${rule.tooltip}` : ''
          ].filter(Boolean).join('<br/>');
          
          if (hoverContent) {
            const componentLoci = Structure.toStructureElementLoci(component.obj.data);
            activeTooltips.push({ loci: componentLoci, text: hoverContent });
          }

          if (rule.focus) {
            const loci = Structure.toStructureElementLoci(component.obj.data);
            plugin.managers.camera.focusLoci(loci);
          }
        }
      }
    }
  },

  buildSimpleExpression(rule: CustomRule) {
    const prefix = rule.scheme === 'label' ? 'label' : 'auth';
    const tests: any = {};

    if (rule.chain) {
      tests['chain-test'] = MS.core.rel.eq([MS.ammp(`${prefix}_asym_id` as any), rule.chain]);
    }

    const resTests: any[] = [];
    if (rule.ranges) {
      const parts = rule.ranges.split(',');
      for (const p of parts) {
        const [start, end] = p.split('-').map(x => parseInt(x.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          resTests.push(MS.core.rel.inRange([MS.ammp(`${prefix}_seq_id` as any), start, end]));
        }
      }
    }
    if (rule.specific) {
      const specificNums = rule.specific.split(',').map(x => parseInt(x.trim())).filter(x => !isNaN(x));
      if (specificNums.length > 0) {
        resTests.push(MS.core.set.has([MS.set(...specificNums), MS.ammp(`${prefix}_seq_id` as any)]));
      }
    }
    if (resTests.length > 0) {
      tests['residue-test'] = resTests.length === 1 ? resTests[0] : MS.core.logic.or(resTests);
    }

    const atomTests: any[] = [];
    if (rule.atomName) {
      atomTests.push(MS.core.rel.eq([MS.ammp(`${prefix}_atom_id` as any), rule.atomName]));
    }
    if (rule.element) {
      atomTests.push(MS.core.rel.eq([MS.ammp('type_symbol' as any), rule.element]));
    }
    if (rule.atomIndex) {
      const idxs = rule.atomIndex.split(',').map(x => parseInt(x.trim())).filter(x => !isNaN(x));
      if (idxs.length > 0) {
        atomTests.push(MS.core.set.has([MS.set(...idxs), MS.ammp('id')]));
      }
    }
    if (atomTests.length > 0) {
      tests['atom-test'] = atomTests.length === 1 ? atomTests[0] : MS.core.logic.or(atomTests);
    }

    return Object.keys(tests).length > 0 ? MS.struct.generator.atomGroups(tests) : MS.struct.generator.all();
  },

  buildExpertExpression(selector: any) {
    const queries = (Array.isArray(selector) ? selector : [selector]).map(sel => {
      const tests: any = {};
      const chainT = [], resT = [];

      if (sel.auth_asym_id) chainT.push(MS.core.rel.eq([MS.ammp('auth_asym_id'), sel.auth_asym_id]));
      if (sel.label_asym_id) chainT.push(MS.core.rel.eq([MS.ammp('label_asym_id'), sel.label_asym_id]));

      if (sel.auth_seq_id !== undefined) resT.push(MS.core.rel.eq([MS.ammp('auth_seq_id'), sel.auth_seq_id]));
      if (sel.beg_auth_seq_id !== undefined && sel.end_auth_seq_id !== undefined) {
        resT.push(MS.core.rel.inRange([MS.ammp('auth_seq_id'), sel.beg_auth_seq_id, sel.end_auth_seq_id]));
      }

      if (chainT.length > 0) tests['chain-test'] = MS.core.logic.and(chainT);
      if (resT.length > 0) tests['residue-test'] = MS.core.logic.and(resT);

      return MS.struct.generator.atomGroups(tests);
    });

    return queries.length === 1 ? queries[0] : MS.struct.modifier.union(queries);
  },

  async applyRepresentation(
    plugin: PluginContext, 
    component: any, 
    targetId: string, 
    settings: ExtensionSettings
  ): Promise<void> {
    const repType = settings[`${targetId}_rep`] as string;
    const colorType = settings[`${targetId}_colorType`] as string;
    const colorVal = settings[`${targetId}_colorVal`] as string;
    const sizeVal = settings[`${targetId}_size`];

    let nativeRepType = repType === 'ball_and_stick' ? 'ball-and-stick' : repType;
    let themeName = colorType === 'theme' ? colorVal : 'uniform';
    let colorParams = colorType === 'theme' ? undefined : { value: Color.fromHexStyle(colorVal || '#ffffff') };
    
    const typeParams: any = {};
    if (sizeVal !== undefined && sizeVal !== null && sizeVal !== '') {
      typeParams.sizeFactor = parseFloat(String(sizeVal));
    }

    const subParams = settings[`${targetId}_subParams`] as Record<string, any>;
    if (subParams) {
      if (subParams.ignore_hydrogens) typeParams.ignoreHydrogens = true;
      if (subParams.surface_type) typeParams.type = subParams.surface_type;
      if (subParams.tubular_helices) typeParams.tubularHelices = true;
    }
    
    const opacityVal = settings[`${targetId}_opacity`];
    if (opacityVal !== undefined && opacityVal !== '') {
      typeParams.alpha = parseFloat(String(opacityVal));
    }

    await plugin.builders.structure.representation.addRepresentation(
      component,
      { type: nativeRepType as any, typeParams, color: themeName as any, colorParams }
    );
  },

  async applyCustomRuleRepresentation(
    plugin: PluginContext, 
    component: any, 
    rule: CustomRule
  ): Promise<void> {
    let nativeRepType = rule.rep === 'highlight' || rule.rep === 'ball_and_stick' 
      ? 'ball-and-stick' 
      : rule.rep;

    let themeName = rule.colorType === 'theme' ? rule.colorVal : 'uniform';
    let colorParams = rule.colorType === 'theme' ? undefined : { value: Color.fromHexStyle(rule.colorVal || '#ffffff') };

    const typeParams: any = {};
    if (rule.size) {
      typeParams.sizeFactor = parseFloat(rule.size);
    }
    
    if (rule.opacity) {
      typeParams.alpha = parseFloat(rule.opacity);
    }

    await plugin.builders.structure.representation.addRepresentation(
      component,
      { type: nativeRepType as any, typeParams, color: themeName as any, colorParams }
    );
  },

  async apply3DLabel(
    plugin: PluginContext, 
    component: any, 
    text: string
  ): Promise<void> {
    const center = component.obj.data.boundary.sphere.center;

    const shapeProvider: ShapeProvider<any, any, any> = {
      label: 'Custom 3D Label',
      data: component.obj.data,
      params: {},
      geometryUtils: Text.Utils,
      getShape: (_, data) => {
        const builder = TextBuilder.create({
          attachment: 'bottom-center',
          background: true,
          backgroundMargin: 0.2
        });

        builder.add(text, center[0], center[1], center[2], 0, 1, 0);
        
        return Shape.create(
          'Label', 
          data, 
          builder.getText(),
          () => Color.fromHexStyle('#ffffff'),
          () => 1,
          () => text
        );
      }
    };

    const update = plugin.state.data.build();
    // FIX HERE: Use component.ref instead of component.transform.ref
    update.to(component.ref).apply(StateTransforms.Representation.ShapeRepresentation3D, {
      shapeProvider
    });
    
    await plugin.state.data.updateTree(update).run();
  }
};
