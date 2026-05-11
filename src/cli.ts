// src/cli.ts
//
// Phase 1 — CLI Shell
// Provides the terminal overlay, history navigation, command registry,
// and built-in commands (help, clear, echo, version).
// Phase 2 & 3 — Mol* API Integration
// Read-only and mutating commands using the PyMOL transpiler.

import { StateSelection } from 'molstar/lib/mol-state';
import { PluginStateObject as SO } from 'molstar/lib/mol-plugin-state/objects';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { Script } from 'molstar/lib/mol-script/script';
import { Structure, StructureElement, QueryContext, StructureSelection } from 'molstar/lib/mol-model/structure';
import { Color } from 'molstar/lib/mol-util/color';
import { ColorNames } from 'molstar/lib/mol-util/color/names';
import type { PluginContext } from 'molstar/lib/mol-plugin/context';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface CliResult {
  status: 'ok' | 'error' | 'info' | 'warn';
  message: string;
}

export interface CliCommand {
  name: string;
  aliases?: string[];
  description: string;
  usage: string;
  execute: (args: string[], plugin: PluginContext) => Promise<CliResult>;
}

// ─────────────────────────────────────────────────────────────────────────────
// HistoryManager
// ─────────────────────────────────────────────────────────────────────────────

class HistoryManager {
  private entries: string[]  = [];
  private cursor:  number    = 0;
  private draft:   string    = '';
  private readonly maxSize:  number;

  constructor(maxSize = 200) {
    this.maxSize = maxSize;
    this.cursor  = 0;
  }

  push(raw: string): void {
    const entry = raw.trim();
    if (!entry) return;
    if (this.entries[this.entries.length - 1] === entry) {
      this.cursor = this.entries.length;
      return;
    }
    this.entries.push(entry);
    if (this.entries.length > this.maxSize) this.entries.shift();
    this.cursor = this.entries.length;
  }

  previous(currentInput: string): string | null {
    if (this.entries.length === 0) return null;
    if (this.cursor === this.entries.length) {
      this.draft = currentInput;
    }
    if (this.cursor > 0) this.cursor--;
    return this.entries[this.cursor] ?? null;
  }

  next(): string {
    if (this.cursor < this.entries.length - 1) {
      this.cursor++;
      return this.entries[this.cursor]!;
    }
    this.cursor = this.entries.length;
    return this.draft;
  }

  resetCursor(): void {
    this.cursor = this.entries.length;
    this.draft  = '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CommandRegistry
// ─────────────────────────────────────────────────────────────────────────────

class CommandRegistry {
  private readonly map = new Map<string, CliCommand>();

  register(cmd: CliCommand): void {
    this.map.set(cmd.name.toLowerCase(), cmd);
    for (const alias of cmd.aliases ?? []) {
      this.map.set(alias.toLowerCase(), cmd);
    }
  }

  get(name: string): CliCommand | undefined {
    return this.map.get(name.toLowerCase());
  }

  list(): CliCommand[] {
    return [...new Set(this.map.values())].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CliEngine
// ─────────────────────────────────────────────────────────────────────────────

export class CliEngine {

  private readonly plugin:   PluginContext;
  private readonly registry: CommandRegistry  = new CommandRegistry();
  private readonly history:  HistoryManager   = new HistoryManager();

  private overlayEl!: HTMLDivElement;
  private outputEl!:  HTMLDivElement;
  private inputEl!:   HTMLInputElement;
  private visible = false;

  constructor(plugin: PluginContext) {
    this.plugin = plugin;
    this.registerBuiltins();
    this.registerMolstarCommands();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  registerCommand(cmd: CliCommand): void {
    this.registry.register(cmd);
  }

  mount(container: HTMLElement): void {
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    this.overlayEl = this.buildOverlay();
    container.appendChild(this.overlayEl);
    this.bindGlobalKeys();

    this.printMessage({
      status:  'info',
      message: 'Mol* CLI ready  ·  type  help  for available commands.',
    });
  }

  async execute(raw: string): Promise<void> {
    const trimmed = raw.trim();
    if (!trimmed) return;

    this.history.push(trimmed);
    this.printEcho(trimmed);

    const tokens  = this.tokenize(trimmed);
    const cmdName = tokens[0]!.toLowerCase();
    const args    = tokens.slice(1);

    const cmd = this.registry.get(cmdName);
    if (!cmd) {
      this.printMessage({
        status:  'error',
        message: `Unknown command: "${cmdName}"  —  type  help  to list all commands.`,
      });
      return;
    }

    try {
      const result = await cmd.execute(args, this.plugin);
      this.printMessage(result);
    } catch (err: unknown) {
      this.printMessage({
        status:  'error',
        message: `Runtime error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // ── Built-in commands ──────────────────────────────────────────────────────

  private registerBuiltins(): void {
    const self = this;

    this.registry.register({
      name:        'help',
      aliases:     ['?', 'h'],
      description: 'List all commands, or show detail for a specific command.',
      usage:       'help [command]',
      async execute(args) {
        if (args[0]) {
          const found = self.registry.get(args[0]);
          if (!found) {
            return { status: 'error', message: `No command named "${args[0]}"` };
          }
          const aliasStr = found.aliases?.length ? `\n  Aliases : ${found.aliases.join(', ')}` : '';
          return {
            status:  'info',
            message: [`Command : ${found.name}${aliasStr}`, `Usage   : ${found.usage}`, `          ${found.description}`].join('\n'),
          };
        }

        const col = 16;
        const lines: string[] = ['─'.repeat(52), 'Available commands', '─'.repeat(52), ''];
        for (const cmd of self.registry.list()) {
          const aliasStr = cmd.aliases?.length ? ` [${cmd.aliases.join('/')}]` : '';
          const nameCol = `${cmd.name}${aliasStr}`.padEnd(col);
          lines.push(`  ${nameCol}  ${cmd.description}`);
        }
        lines.push('');
        lines.push('Keyboard shortcuts');
        lines.push('  Ctrl+`   toggle the CLI panel');
        lines.push('  :        open CLI (when no input is focused)');
        lines.push('  ↑ / ↓    navigate history');
        lines.push('  Esc      close the CLI panel');
        lines.push('─'.repeat(52));
        return { status: 'info', message: lines.join('\n') };
      },
    });

    this.registry.register({
      name:        'clear',
      aliases:     ['cls', 'c'],
      description: 'Clear the terminal output.',
      usage:       'clear',
      async execute() {
        self.outputEl.innerHTML = '';
        return { status: 'ok', message: '' };
      },
    });

    this.registry.register({
      name:        'echo',
      description: 'Print text to the terminal (useful for scripting and tests).',
      usage:       'echo <text...>',
      async execute(args) {
        if (!args.length) return { status: 'warn', message: 'Usage: echo <text...>' };
        return { status: 'ok', message: args.join(' ') };
      },
    });

    this.registry.register({
      name:        'version',
      aliases:     ['ver'],
      description: 'Display extension and Mol* version information.',
      usage:       'version',
      async execute() {
        const molVersion: string = (self.plugin as any)?.version ?? (self.plugin as any)?.spec?.version ?? 'unknown';
        return {
          status:  'info',
          message: ['─'.repeat(40), 'Mol* Linker Extension', '  CLI phase       : 1 & 2 & 3', `  Mol* version    : ${molVersion}`, '─'.repeat(40)].join('\n'),
        };
      },
    });
  }

  // ── Mol* API Commands (Phase 2 & 3) ────────────────────────────────────────

  public registerMolstarCommands(): void {

    this.registry.register({
      name:        'info',
      aliases:     ['i', 'list'],
      description: 'Display information about the currently loaded structure.',
      usage:       'info',
      async execute(args, plugin) {
        const structures = plugin.managers.structure.hierarchy.current.structures;
        if (structures.length === 0) return { status: 'warn', message: 'No structures currently loaded.' };

        const data = structures[0].cell.obj?.data;
        if (!data) return { status: 'error', message: 'Structure data is corrupted.' };

        const atomCount = data.elementCount;
        const model = data.models[0];
        const chainCount = model.atomicHierarchy.chains._rowCount;

        return {
          status: 'info',
          message: `Structure Details:\n  Models  : 1\n  Chains  : ${chainCount}\n  Atoms   : ${atomCount.toLocaleString()}`
        };
      }
    });

    this.registry.register({
      name:        'select',
      aliases:     ['sel'],
      description: 'Select atoms using PyMOL syntax (e.g., "chain A and resi 10-50").',
      usage:       'select <pymol_expression>',
      async execute(args, plugin) {
        if (args.length === 0) return { status: 'warn', message: 'Usage: select <expression>' };

        const expression = args.join(' ');
        const loci = evaluateSelection(plugin, expression);

        if (!loci || StructureElement.Loci.isEmpty(loci)) {
          return { status: 'error', message: `Invalid selection or no atoms matched: "${expression}"` };
        }

        const atomCount = StructureElement.Loci.size(loci);

        // Use Interactivity Manager to select the specific Loci (turns them green)
        plugin.managers.interactivity.lociSelects.selectOnly({ loci });

        return { status: 'ok', message: `Selected ${atomCount} atoms matching "${expression}".` };
      }
    });

    this.registry.register({
      name:        'focus',
      aliases:     ['center', 'zoom'],
      description: 'Move the camera to focus on a specific selection.',
      usage:       'focus <pymol_expression>',
      async execute(args, plugin) {
        if (args.length === 0) {
          plugin.managers.camera.reset();
          return { status: 'ok', message: 'Reset camera to default view.' };
        }

        const expression = args.join(' ');
        const loci = evaluateSelection(plugin, expression);

        if (!loci || StructureElement.Loci.isEmpty(loci)) {
          return { status: 'error', message: `Nothing to focus on for: "${expression}"` };
        }

        plugin.managers.camera.focusLoci(loci);
        return { status: 'ok', message: `Camera focused on "${expression}".` };
      }
    });

this.registry.register({
      name:        'color',
      description: 'Color existing representations cleanly without Z-fighting or crashes.',
      usage:       'color <color_name_or_hex>[, <pymol_expression>]',
      async execute(args, plugin) {
        if (args.length < 2) return { status: 'warn', message: 'Usage: color <color>, <expression>' };

        // 1. Handle PyMOL's comma syntax
        const fullArgs = args.join(' ');
        const match = fullArgs.match(/^([a-zA-Z0-9#]+),?\s+(.+)$/);
        if (!match) return { status: 'warn', message: 'Usage: color <color>, <expression>' };

        const colorInput = match[1];
        const expression = match[2];
        const lowerColor = colorInput.toLowerCase();

        // 2. Parse the color
        let parsedColor: Color;
        if (lowerColor in ColorNames) {
            parsedColor = ColorNames[lowerColor as keyof typeof ColorNames];
        } else {
            const hexMatch = colorInput.match(/^#?([0-9A-Fa-f]{6})$/);
            if (hexMatch) {
                parsedColor = Color.fromHexStyle(`#${hexMatch[1]}`);
            } else {
                return { status: 'error', message: `Invalid color: "${colorInput}". Use a name (e.g., red) or hex (e.g., #ff0000).` };
            }
        }

        // 3. Evaluate the selection
        const loci = evaluateSelection(plugin, expression);
        if (!loci || StructureElement.Loci.isEmpty(loci)) {
          return { status: 'error', message: `No atoms matched selection: "${expression}"` };
        }

        const structures = plugin.managers.structure.hierarchy.current.structures;
        if (structures.length === 0) return { status: 'error', message: 'No structure loaded.' };

        // Start a State Update
        const update = plugin.state.data.build();
        let appliedCount = 0;

        // 4. Find all active Representation3D nodes in the protein's subtree
        // This is the safest way to avoid "No suitable parent" errors
        const structureRef = structures[0].cell.transform.ref;
        const reprCells = plugin.state.data.select(
            StateSelection.Generators.byRef(structureRef).subtree().ofType(SO.Molecule.Structure.Representation3D)
        );

        for (const cell of reprCells) {
            const reprData = cell.obj?.data;
            if (!reprData || !reprData.sourceData) continue;

            // Check if our selection actually contains atoms found in this specific representation
            const lociInRepr = StructureElement.Loci.remap(loci, reprData.sourceData);
            if (StructureElement.Loci.isEmpty(lociInRepr)) continue;

            const bundle = StructureElement.Bundle.fromLoci(lociInRepr);
            const repRef = cell.transform.ref;
            let existingOverpaintRef: string | undefined;

            // Check for existing overpaint decorator
            const children = plugin.state.data.tree.children.get(repRef);
            if (children) {
                for (const childRef of children.values()) {
                    const childCell = plugin.state.data.cells.get(childRef);
                    if (childCell && childCell.transform.transformer.id === StateTransforms.Representation.OverpaintStructureRepresentation3DFromBundle.id) {
                        existingOverpaintRef = childRef;
                        break;
                    }
                }
            }

            if (existingOverpaintRef) {
                update.to(existingOverpaintRef).update(old => {
                    const layers = (old && old.layers) ? [...old.layers] : [];
                    layers.push({ bundle, color: parsedColor, clear: false });
                    return { layers };
                });
            } else {
                update.to(repRef).apply(
                    StateTransforms.Representation.OverpaintStructureRepresentation3DFromBundle,
                    { layers: [{ bundle, color: parsedColor, clear: false }] }
                );
            }
            appliedCount++;
        }

        if (appliedCount > 0) {
            await update.commit();
            return { status: 'ok', message: `Colored "${expression}" as ${colorInput}.` };
        } else {
            return { status: 'warn', message: 'Selection is valid, but no matching representations were found beneath the structure.' };
        }
      }
    });
  }

  // ── DOM ────────────────────────────────────────────────────────────────────

  private buildOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.id = 'ms-cli-overlay';
    Object.assign(overlay.style, {
      position:       'fixed',
      bottom:         '0',
      left:           '0',
      right:          '0',
      height:         '280px',
      display:        'none',
      flexDirection:  'column',
      background:     'rgba(30, 30, 46, 0.97)',
      borderTop:      '1px solid #313244',
      fontFamily:     "'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, 'Courier New', monospace",
      fontSize:       '12.5px',
      lineHeight:     '1.55',
      zIndex:         '99999',
      boxSizing:      'border-box',
      backdropFilter: 'blur(6px)',
      pointerEvents:  'auto',
    } as CSSStyleDeclaration);

    const header = document.createElement('div');
    Object.assign(header.style, {
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        '4px 12px',
      background:     '#181825',
      borderBottom:   '1px solid #313244',
      flexShrink:     '0',
      userSelect:     'none',
    } as CSSStyleDeclaration);

    const title = document.createElement('span');
    title.innerHTML = '<span style="color:#89b4fa;font-weight:700">▶</span>'
      + ' <span style="color:#b4befe;font-weight:600;letter-spacing:0.04em">Mol* CLI</span>';

    const hint = document.createElement('span');
    hint.textContent = 'Ctrl+` toggle  ·  Esc close  ·  ↑↓ history';
    Object.assign(hint.style, { color: '#45475a', fontSize: '11px' });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.title = 'Close (Esc)';
    Object.assign(closeBtn.style, {
      background:  'none',
      border:      'none',
      color:       '#6c7086',
      cursor:      'pointer',
      fontSize:    '13px',
      padding:     '0 2px',
      lineHeight:  '1',
    } as CSSStyleDeclaration);
    closeBtn.addEventListener('mouseover', () => { closeBtn.style.color = '#f38ba8'; });
    closeBtn.addEventListener('mouseout',  () => { closeBtn.style.color = '#6c7086'; });
    closeBtn.addEventListener('click', () => this.hide());

    header.appendChild(title);
    header.appendChild(hint);
    header.appendChild(closeBtn);

    const output = document.createElement('div');
    output.id = 'ms-cli-output';
    Object.assign(output.style, {
      flex:          '1',
      overflowY:     'auto',
      padding:       '8px 14px',
      color:         '#cdd6f4',
      whiteSpace:    'pre-wrap',
      wordBreak:     'break-word',
      scrollBehavior:'smooth',
      scrollbarWidth:'thin',
      scrollbarColor:'#313244 transparent',
    } as CSSStyleDeclaration);

    const inputRow = document.createElement('div');
    Object.assign(inputRow.style, {
      display:      'flex',
      alignItems:   'center',
      padding:      '6px 14px',
      borderTop:    '1px solid #313244',
      background:   '#181825',
      flexShrink:   '0',
      gap:          '8px',
    } as CSSStyleDeclaration);

    const prompt = document.createElement('span');
    prompt.textContent = '▶';
    Object.assign(prompt.style, {
      color:      '#89b4fa',
      flexShrink: '0',
      fontWeight: '700',
    } as CSSStyleDeclaration);

    const input = document.createElement('input');
    input.type          = 'text';
    input.placeholder   = 'enter command…';
    input.autocomplete  = 'off';
    input.spellcheck    = false;
    input.setAttribute('autocorrect',    'off');
    input.setAttribute('autocapitalize', 'off');
    Object.assign(input.style, {
      flex:        '1',
      background:  'transparent',
      border:      'none',
      outline:     'none',
      color:       '#cdd6f4',
      fontFamily:  'inherit',
      fontSize:    'inherit',
      caretColor:  '#89b4fa',
      padding:     '0',
    } as CSSStyleDeclaration);

    input.addEventListener('keydown', (e) => this.onInputKeydown(e));
    input.addEventListener('keydown', (e) => e.stopPropagation());
    input.addEventListener('keypress', (e) => e.stopPropagation());
    input.addEventListener('keyup',    (e) => e.stopPropagation());

    inputRow.appendChild(prompt);
    inputRow.appendChild(input);

    overlay.appendChild(header);
    overlay.appendChild(output);
    overlay.appendChild(inputRow);

    this.outputEl = output;
    this.inputEl  = input;

    return overlay;
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────

  private onInputKeydown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'Enter': {
        const raw = this.inputEl.value;
        this.inputEl.value = '';
        this.history.resetCursor();
        void this.execute(raw);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = this.history.previous(this.inputEl.value);
        if (prev !== null) {
          this.inputEl.value = prev;
          requestAnimationFrame(() => {
            this.inputEl.setSelectionRange(
              this.inputEl.value.length,
              this.inputEl.value.length,
            );
          });
        }
        break;
      }
      case 'ArrowDown': {
        e.preventDefault();
        this.inputEl.value = this.history.next();
        break;
      }
      case 'Escape': {
        this.hide();
        break;
      }
    }
  }

  private bindGlobalKeys(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        this.toggle();
        return;
      }

      const tag = (document.activeElement as HTMLElement | null)?.tagName ?? '';
      if (e.key === ':' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        this.show();
      }
    });
  }

  // ── Visibility ─────────────────────────────────────────────────────────────

  show(): void {
    this.overlayEl.style.display = 'flex';
    this.visible = true;
    requestAnimationFrame(() => this.inputEl.focus());
  }

  hide(): void {
    this.overlayEl.style.display = 'none';
    this.visible = false;
    this.history.resetCursor();
  }

  toggle(): void {
    this.visible ? this.hide() : this.show();
  }

  // ── Output helpers ─────────────────────────────────────────────────────────

  private printMessage(result: CliResult): void {
    if (!result.message) return;

    const palette: Record<CliResult['status'], string> = {
      ok:    '#a6e3a1',
      error: '#f38ba8',
      info:  '#89b4fa',
      warn:  '#f9e2af',
    };

    const block = document.createElement('div');
    block.style.cssText = `color:${palette[result.status]};padding:1px 0;`;
    block.textContent   = result.message;
    this.outputEl.appendChild(block);
    this.outputEl.scrollTop = this.outputEl.scrollHeight;
  }

  private printEcho(text: string): void {
    const line = document.createElement('div');
    line.style.cssText  = 'color:#45475a;padding:1px 0;';
    line.textContent    = `▶ ${text}`;
    this.outputEl.appendChild(line);
    this.outputEl.scrollTop = this.outputEl.scrollHeight;
  }

  // ── Tokenizer ──────────────────────────────────────────────────────────────

  private tokenize(input: string): string[] {
    const tokens: string[] = [];
    let   current   = '';
    let   inQuote   = false;
    let   quoteChar = '';

    for (const ch of input) {
      if (inQuote) {
        if (ch === quoteChar) { inQuote = false; }
        else                  { current += ch;   }
      } else if (ch === '"' || ch === "'") {
        inQuote   = true;
        quoteChar = ch;
      } else if (ch === ' ' || ch === '\t') {
        if (current) { tokens.push(current); current = ''; }
      } else {
        current += ch;
      }
    }
    if (current) tokens.push(current);
    return tokens;
  }
}

// ── Helper: Evaluate PyMOL Syntax ───────────────────────────────────────────
function evaluateSelection(plugin: PluginContext, expression: string): StructureElement.Loci | null {
  const structures = plugin.managers.structure.hierarchy.current.structures;
  if (structures.length === 0) return null;

  const structureData = structures[0].cell.obj?.data;
  if (!structureData) return null;

  try {
    // 1. Tell Script we are parsing PyMOL syntax
    const script = Script(expression, 'pymol');

    // 2. Convert it to a MolScript Query
    const query = Script.toQuery(script);

    // 3. Evaluate the query against the current structure data
    const selection = query(new QueryContext(structureData));

    // 4. Return the explicit Loci (atoms) matched
    return StructureSelection.toLociWithSourceUnits(selection);
  } catch (err) {
    console.error('PyMOL parse error:', err);
    return null;
  }
}
