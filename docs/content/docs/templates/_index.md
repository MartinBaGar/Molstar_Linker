+++
title = "Templates & Presets"
author = ["Martin Bari Garnier"]
draft = false
weight = 300
bookCollapseSection = false
+++

Templates let you save, share, and switch between complete scene configuration.


## Built-in Presets {#built-in-presets}

Available in the popup dropdown under **Built-in Presets**:

| Name                             | What it does                                                        |
|----------------------------------|---------------------------------------------------------------------|
| Standard Mol\* (Smart Guess)     | Defers to Mol\*'s own auto-representation; no MVS overrides applied |
| Protein Surface + Spacefill Lig. | Proteins and nucleic acids as surfaces; ligands as spacefill        |
| Dark Mode Canvas                 | Sets the background to `#111111`; all other settings unchanged      |

Built-in presets cannot be edited or deleted. They are defined in `config.js` — see [Contributing](../developer/contributing) if you want to add one.


## Saving a Custom Template {#saving-a-custom-template}

1.  Configure the scene, targets, and rules to your liking in the Studio
2.  In the **Template Library** sidebar panel, type a name in the **Save Form as New Template** field
3.  Click **Save Template**

The template appears in the popup dropdown under **My Custom Templates** and is stored in your browser's synced storage.


## Loading a Template {#loading-a-template}

In the Studio sidebar:

1.  Select the template from the **Load or Delete Template** dropdown
2.  Click **Load** — the form updates to reflect the saved settings
3.  Click **Apply to Mol\*** to activate

Or use the popup: select the template and click **Apply &amp; Reload Tab** for a one-click switch.


## Deleting a Template {#deleting-a-template}

Select the template in the sidebar dropdown and click **Delete**.


## Export &amp; Import {#export-and-import}

Templates and settings can be shared as JSON files.


### Export {#export}

Click **Export** (⬇️) in the Studio sidebar. A `.json` file is downloaded containing your full current settings.


### Import {#import}

Click **Import** (⬆️) — or use the **Import JSON File** button in the popup — and select a `.json` file. The settings are merged over the defaults and activated immediately.


## JSON Format {#json-format}

The exported file is a flat key-value object. Example:

```json
{
  "canvas_color": "#111111",
  "protein_rep": "surface",
  "protein_colorType": "theme",
  "protein_colorVal": "chain-id",
  "protein_opacity": 0.8,
  "ligand_rep": "spacefill",
  "water_rep": "off",
  "customRules": [
    {
      "selector": "{ \"chain_id\": \"A\" }",
      "rep": "highlight",
      "colorType": "solid",
      "colorVal": "#ff6600",
      "label": "Chain A"
    }
  ]
}
```

Any omitted key falls back to the default value. This makes it easy to write minimal hand-crafted presets.
