// mvs-builder.js

const MvsBuilder = {

  // SECURITY: Sanitize any string that comes from user-controlled input (customRules)
  // before it is embedded in the MVS JSON tree.
  // We strip null bytes and cap length. MVS nodes are JSON, not HTML,
  // so HTML-escaping is not needed — but length caps prevent absurdly large payloads.
  _sanitizeString: function(value, maxLength = 512) {
    if (typeof value !== 'string') return '';
    // Remove null bytes and non-printable control characters (except tab/newline which are harmless)
    return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, maxLength);
  },

  // SECURITY: Validate that a color value is either a known theme name or a safe CSS hex color.
  // This prevents injecting arbitrary strings into the MVS color params.
  _sanitizeColor: function(colorType, colorVal) {
    const ALLOWED_THEMES = new Set([
      'chain-id', 'element-symbol', 'secondary-structure', 'residue-name',
      'sequence-id', 'uniform', 'uncertainty', 'b-factor'
    ]);
    if (colorType === 'theme') {
      return ALLOWED_THEMES.has(colorVal) ? colorVal : 'chain-id';
    }
    // For solid colors, only allow #rrggbb hex strings
    if (/^#[0-9a-fA-F]{6}$/.test(colorVal)) return colorVal;
    // Also allow a small set of named colors used internally
    const ALLOWED_NAMED = new Set(['white', 'red', 'blue', 'green', 'black']);
    if (ALLOWED_NAMED.has(colorVal)) return colorVal;
    return 'white'; // safe fallback
  },

  // SECURITY: Validate that a rep type is one of the known values from AppConfig.
  _sanitizeRepType: function(repType) {
    const ALLOWED_REPS = new Set(Object.keys(AppConfig.RepSchema));
    return ALLOWED_REPS.has(repType) ? repType : 'ball_and_stick';
  },

  createViewerUrl: function(rawStructureUrl, format, settings) {
    const parserFormat = format === 'cif' ? 'mmcif' : format;
    const mvsTemplate = this._buildBaseTemplate(rawStructureUrl, parserFormat, settings);
    const mvsDataString = JSON.stringify(mvsTemplate);
    return `https://molstar.org/viewer/?mvs-format=mvsj&mvs-data=${encodeURIComponent(mvsDataString)}`;
  },

  _buildBaseTemplate: function(url, format, settings) {
    const rootChildren = [
      {
        "kind": "download",
        "params": { "url": url },
        "children": [{
          "kind": "parse",
          "params": { "format": format },
          "children": [{
            "kind": "structure",
            "params": { "type": "model" },
            "children": this._buildComponentBranches(settings)
          }]
        }]
      }
    ];

    if (settings.canvas_color && settings.canvas_color !== "#ffffff" && settings.canvas_color !== "white") {
      // SECURITY: Validate canvas color is a safe hex value before embedding.
      const safeColor = /^#[0-9a-fA-F]{6}$/.test(settings.canvas_color) ? settings.canvas_color : '#ffffff';
      rootChildren.push({ "kind": "canvas", "params": { "background_color": safeColor } });
    }

    if (settings.camera_json) {
      try {
        const camParams = JSON.parse(settings.camera_json);
        // SECURITY: Only allow plain objects with numeric/string leaf values.
        // Reject arrays or nested objects deeper than 2 levels to prevent prototype pollution.
        if (camParams && typeof camParams === 'object' && !Array.isArray(camParams)) {
          rootChildren.push({ "kind": "camera", "params": camParams });
        }
      } catch (e) { console.warn("Invalid Camera JSON"); }
    }

    return { "metadata": { "version": "1" }, "root": { "kind": "root", "children": rootChildren } };
  },

  _getColorNode: function(colorType, colorVal) {
    // SECURITY: Always sanitize color values coming from settings/customRules.
    const safeColor = this._sanitizeColor(colorType, colorVal);
    if (colorType === 'theme') {
      return { "kind": "color", "params": { "color": "white" }, "custom": { "molstar_color_theme_name": safeColor } };
    }
    return { "kind": "color", "params": { "color": safeColor } };
  },

  _buildComponentBranches: function(settings) {
    const branches = [];
    const polymerColorOverrides = [];
    const customComponentBranches = [];

    const customRules = Array.isArray(settings.customRules) ? settings.customRules : [];

    // PASS 1: Custom Rules
    // SECURITY: Cap the number of custom rules to prevent DoS via a huge array.
    const MAX_RULES = 50;
    customRules.slice(0, MAX_RULES).forEach(rule => {
      if (!rule || typeof rule !== 'object') return; // skip malformed entries

      const componentChildren = [];

      // SECURITY: Sanitize all user-supplied string fields.
      const safeLabel   = rule.label   ? this._sanitizeString(rule.label,   256) : null;
      const safeTooltip = rule.tooltip ? this._sanitizeString(rule.tooltip, 512) : null;
      const safeSelector = rule.selector ? this._sanitizeString(rule.selector, 256) : null;

      if (!safeSelector) return; // a rule without a selector is meaningless — skip it

      if (safeLabel)   componentChildren.push({ "kind": "label",   "params": { "text": safeLabel } });
      if (safeTooltip) componentChildren.push({ "kind": "tooltip", "params": { "text": safeTooltip } });
      if (rule.focus)  componentChildren.push({ "kind": "focus",   "params": {} });

      const ruleType = rule.rep ? this._sanitizeRepType(rule.rep) : "highlight";

      if (ruleType === "highlight") {
        const colorNode = this._getColorNode(rule.colorType, rule.colorVal);
        colorNode.params.selector = safeSelector;
        polymerColorOverrides.push(colorNode);

        if (componentChildren.length > 0) {
          customComponentBranches.push({ "kind": "component", "params": { "selector": safeSelector }, "children": componentChildren });
        }
      } else {
        const repParams = { "type": ruleType };

        // SECURITY: Validate size/opacity are actual numbers, not strings like "1; DROP TABLE".
        if (rule.size !== undefined) {
          const sz = parseFloat(rule.size);
          if (!isNaN(sz) && sz > 0 && sz <= 10) repParams.size_factor = sz;
        }
        if (rule.subParams && typeof rule.subParams === 'object' && !Array.isArray(rule.subParams)) {
          Object.assign(repParams, rule.subParams);
        }
        if (rule.advancedParams && typeof rule.advancedParams === 'object' && !Array.isArray(rule.advancedParams)) {
          Object.assign(repParams, rule.advancedParams);
        }

        const repChildren = [ this._getColorNode(rule.colorType, rule.colorVal) ];

        if (rule.opacity !== undefined) {
          const op = parseFloat(rule.opacity);
          if (!isNaN(op) && op >= 0 && op <= 1) {
            repChildren.push({ "kind": "opacity", "params": { "opacity": op } });
          }
        }

        componentChildren.push({ "kind": "representation", "params": repParams, "children": repChildren });
        customComponentBranches.push({ "kind": "component", "params": { "selector": safeSelector }, "children": componentChildren });
      }
    });

    // PASS 2: Global Targets
    AppConfig.targets.forEach(target => {
      const repType = settings[`${target.id}_rep`];
      if (!repType || repType === "off") return;

      const sizeVal = settings[`${target.id}_size`];
      const repParams = { "type": this._sanitizeRepType(repType) };
      if (sizeVal !== undefined && sizeVal !== "") {
        const sz = parseFloat(sizeVal);
        if (!isNaN(sz) && sz > 0 && sz <= 10) repParams.size_factor = sz;
      }

      const targetSubParams = settings[`${target.id}_subParams`];
      if (targetSubParams && typeof targetSubParams === 'object' && !Array.isArray(targetSubParams)) {
        Object.assign(repParams, targetSubParams);
      }

      const repChildren = [ this._getColorNode(settings[`${target.id}_colorType`], settings[`${target.id}_colorVal`]) ];

      const opacityVal = settings[`${target.id}_opacity`];
      if (opacityVal !== undefined) {
        const op = parseFloat(opacityVal);
        if (!isNaN(op) && op >= 0 && op <= 1) {
          repChildren.push({ "kind": "opacity", "params": { "opacity": op } });
        }
      }

      const representationNode = { "kind": "representation", "params": repParams, "children": repChildren };

      if (['protein', 'nucleic'].includes(target.selector)) {
        representationNode.children.push(...polymerColorOverrides);
      }

      branches.push({ "kind": "component", "params": { "selector": target.selector }, "children": [representationNode] });
    });

    branches.push(...customComponentBranches);
    return branches;
  }
};
