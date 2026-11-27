# Spice drawer insert

Parametric OpenSCAD insert for spice jars lying down in a drawer: jars tilted (lid end higher), flat top surface,
hollow open-bottom parts with built-in Y supports so they print fast, light and without support material.
Made to be published on MakerWorld with the *Parametric Model Maker*.

`spice_drawer_insert.scad` is the single file to upload. It is compatible with the OpenSCAD 2021 release used by MakerWorld.

## Parameters (Customizer)

| Parameter | Meaning |
|---|---|
| `drawer_width`, `drawer_depth` | inner size of the drawer (mm) |
| `min_gap` | minimum gap between two pockets (mm); sets how many jars fit across |
| `module_height` | height of the flat top (mm) |
| `tilt` | jar tilt in degrees, lid end higher |
| `jar_preset` | `citronhaj`, `guldfisk` or `custom` (then `custom_diameter` / `custom_length`) |
| `piece` | `module` (one row) or `bar` (back bar, leftover depth) |
| `slice_index` | which slice across the width; the script splits automatically to fit a 256 mm bed |

Everything else (clearances, walls, Y supports, bed size) is in the `[Hidden]` section of the script.

## How the drawer is laid out

* Columns = `floor(width / (pocket + min_gap))`, spread evenly over the width.
* Rows: as many as fit while keeping room for a back bar; the spare depth is spread over the rows (thicker walls
  between rows). The back bar holds spare jars lying across the width.
* Each row is cut into slices that fit the bed, as equal as possible: between two jars for an even count,
  through the middle of a jar for an odd count (joint hidden under it). The drawer walls hold everything; glue the slices.
* Print every `module` slice once per row, and every `bar` slice once.

Open the console to read the computed layout (`echo` lines) and warnings.

## Tests

The suite renders the script with OpenSCAD (WebAssembly build, no install needed) for many parameter sets and checks
the layout, the slicing (slices add up to the drawer width, every piece fits the bed) and that every mesh is manifold.

```sh
npm install
npm test          # everything, a few minutes (hollow renders are slow)
npm run test:fast # solid style only, about a minute
```

## Jar presets

* **CITRONHAJ** (IKEA, 10 cl): 41 x 118.5 mm, measured on real jars (IKEA lists 40 x 120).
* **GULDFISK** (IKEA, 6 cl): IKEA lists 40 x 80; the preset uses 41 x 79, an estimate. Please measure and correct it.
