// ============================================================================
//  Spice-drawer insert: jars lying down, tilted, flat top
//  Insert a epices pour tiroir : flacons couches, inclines, dessus plat
//  For MakerWorld "Parametric Model Maker" (OpenSCAD 2021 compatible)
//
//  Axes: X = drawer width (jars side by side), Y = drawer depth (jar axis),
//  Z = height. The lid end is toward the back of the drawer (+Y) and sits higher.
//
//  The drawer is split into rows (depth) and each row into slices (width) so every
//  piece fits on the print bed. Cuts give pieces as equal as possible: between two
//  jars (even count) or through the middle of a jar (odd count, joint hidden under
//  it). The drawer walls hold everything, just glue the slices together.
//
//  What to print:  "module" -> every slice (1..N) x number of rows
//                  "bar"    -> every slice (1..N) x 1  (leftover depth at the back)
//  Read the "echo" output (console) for the computed layout and warnings.
//
//  Source, tests and issues: https://github.com/skjnldsv/spice-drawer-insert
//
//  SPDX-FileCopyrightText: 2026 John Molakvoæ
//  SPDX-License-Identifier: CC-BY-NC-SA-4.0
// ============================================================================

/* [Drawer] */
// Inner width of the drawer (mm)
drawer_width = 430;
// Inner depth of the drawer (mm)
drawer_depth = 470;
// Minimum gap between two jar pockets (mm): sets how many jars fit
min_gap = 3;
// Height of the module = flat top (mm)
module_height = 25.6;
// Jar tilt (degrees), lid end higher
tilt = 6; // [0:0.5:15]

/* [Jar] */
// Jar model (presets), or Custom to use the two fields below
jar_preset = "citronhaj"; // [citronhaj:IKEA CITRONHAJ 10 cl, guldfisk:IKEA GULDFISK 6 cl, custom:Custom]
// Custom jar: diameter of the jar and its lid (mm)
custom_diameter = 41;
// Custom jar: total length including the lid (mm)
custom_length = 100;

/* [Piece] */
// Which piece to print
piece = "module"; // [module:Module - one row, bar:Back bar - leftover depth]
// Slice number across the width, left to right (auto-split to fit the A1 bed)
slice_index = 1; // [1:4]

/* [Hidden] */
$fn = 64;
// --- fixed values ---
// presets: CITRONHAJ measured on real jars (nominal 120 x 40); GULDFISK from the nominal 80 x 40, assumed 41 x 79, please verify
jar_diameter = jar_preset == "citronhaj" ? 41 : (jar_preset == "guldfisk" ? 41 : custom_diameter);
jar_length   = jar_preset == "citronhaj" ? 118.5 : (jar_preset == "guldfisk" ? 79 : custom_length);
pocket_clearance = 2;     // extra clearance on the pocket diameter
end_clearance = 3;        // free play behind the lid
floor_min = 4;            // material under the lowest point of a pocket
fit_margin = 0.5;         // total slack kept on the width and on the depth
bed_width = 256;          // Bambu A1 print bed
style = "hollow";         // "hollow" (open bottom, Y supports) or "solid"
wall = 1.8;               // outer wall of the hollow style
skin = 1.2;               // skin under the pockets
y_stem = 1.0;             // stem thickness of the Y
y_arm  = 1.41;            // horizontal thickness of the arms (about 1 mm perpendicular)
y_span = 8.5;             // reach of the arms

// ------------------------------- computations --------------------------------
a  = tilt;
ca = cos(a);  sa = sin(a);  ta = tan(a);
R  = (jar_diameter + pocket_clearance) / 2;       // pocket radius
H  = module_height;
Wuse = drawer_width - fit_margin;
Duse = drawer_depth - fit_margin;

// --- modules (rows) ---
LC      = jar_length * ca + jar_diameter * sa + end_clearance; // pocket length (vertical end walls)
n_cols  = max(1, floor(Wuse / (2 * R + min_gap)));
pitch   = Wuse / n_cols;
L_min   = LC + min_gap;                                        // shortest possible row
bar_min = 2 * R + 9;                                           // depth of a back bar holding spare jars (4.5 mm walls)
rows_b  = floor((Duse - bar_min) / L_min);             // rows that fit while keeping room for that bar
has_bar = rows_b >= 1;
rows_n  = has_bar ? rows_b : max(1, floor(Duse / L_min));
// the spare depth is spread over the rows: thicker walls between rows, a back bar of bar_min
L       = has_bar ? (Duse - bar_min) / rows_n : Duse / rows_n;
leftover = has_bar ? bar_min : 0;
WB      = (L - LC) / 2;                                        // end wall
floor_mid = floor_min + (LC / 2) * ta;
zc_mid  = floor_mid + R / ca;                                  // axis height at mid-length
depth_mid = H - floor_mid;                                     // pocket depth at mid-length
jar_top = zc_mid + (jar_length / 2) * sa + jar_diameter / 2;   // highest point of the jar (z)

// --- back bar (jars lying across the width) ---
Lb     = jar_length + end_clearance;                           // pocket length along its axis
hb     = (Lb / 2) * ca + R * sa;                               // horizontal half footprint
zc_b   = floor_min + (Lb / 2) * sa + R * ca;
n_bar  = max(1, floor(Wuse / (2 * hb + min_gap)));
pitch_b = Wuse / n_bar;
bar_depth = leftover - 0.0;
bar_ok = has_bar;                           // enough room for pockets?

// --- slicing (equal pieces; the cut falls between two jars or through the middle of one) ---
// cut as close as possible to an equal split: between two jars, or through the middle of one
function cut_x(k, n, m, p) = k <= 0 ? 0 : (k >= m ? Wuse : round(2 * k * n / m) / 2 * p);
function max_w(n, m, p) = max([for (k = [0 : m - 1]) cut_x(k + 1, n, m, p) - cut_x(k, n, m, p)]);
function find_m(n, p, m = 1) = (m >= n || max_w(n, m, p) <= bed_width - 4) ? m : find_m(n, p, m + 1);
n_slices_m = find_m(n_cols, pitch);
n_slices_b = find_m(n_bar, pitch_b);
si_m = min(slice_index, n_slices_m);
si_b = min(slice_index, n_slices_b);
mx0 = cut_x(si_m - 1, n_cols, n_slices_m, pitch);
mx1 = cut_x(si_m,     n_cols, n_slices_m, pitch);
bx0 = cut_x(si_b - 1, n_bar,  n_slices_b, pitch_b);
bx1 = cut_x(si_b,     n_bar,  n_slices_b, pitch_b);

echo(str("Columns: ", n_cols, " (pitch ", pitch, " mm) | rows: ", rows_n, " x ", L, " mm | leftover at the back: ", leftover, " mm"));
echo(str("Pocket depth at mid-length: ", depth_mid, " mm | top of the jars at ", jar_top, " mm"));
echo(str("Slices (module): ", n_slices_m, " | slices (bar): ", n_slices_b, " | bar has pockets: ", bar_ok, " (", n_bar, " jars)"));
if (L > bed_width - 4) echo("WARNING: a row is longer than the print bed");
if (!bar_ok && piece == "bar") echo("No room left for a back bar: it is a plain filler of the leftover depth");
if (depth_mid < 6) echo("WARNING: module too low, jars will not stay in their pockets");

// ------------------------------- module ---------------------------------------
// profile (x,z) extruded along Y
module y_prism(pts, len) {
    translate([0, len, 0]) rotate([90, 0, 0]) linear_extrude(len) polygon(pts);
}
module y_support(x, z0) {                       // Y-shaped support under a pocket
    ws = y_stem; ta_ = y_arm; Dy = y_span;
    translate([x, WB, z0]) rotate([a, 0, 0]) translate([0, -20, 0]) {
        y_prism([[-ws/2, -40], [ws/2, -40], [ws/2, 2], [-ws/2, 2]], LC + 40);
        y_prism([[-ta_/2, -Dy], [ta_/2, -Dy], [Dy + 6 + ta_/2, 6], [Dy + 6 - ta_/2, 6]], LC + 40);
        y_prism([[ta_/2, -Dy], [-ta_/2, -Dy], [-Dy - 6 - ta_/2, 6], [-Dy - 6 + ta_/2, 6]], LC + 40);
    }
}
// jar pocket: tilted cylinder, vertical end walls
module pocket(x, r, y_ext) {
    intersection() {
        translate([x - r - 1, WB - y_ext, -1]) cube([2 * r + 2, LC + 2 * y_ext, H + 40]);
        translate([x, L / 2, zc_mid]) rotate([-(90 - a), 0, 0]) cylinder(r = r, h = 300, center = true);
    }
}

module module_slice(x0, x1) {
    w = x1 - x0;
    k0 = max(0, floor(x0 / pitch - 0.5 - 0.001));
    k1 = min(n_cols - 1, ceil(x1 / pitch - 0.5 + 0.001));
    difference() {
        cube([w, L, H]);
        for (k = [k0 : k1]) {
            xk = (k + 0.5) * pitch - x0;
            if (xk > -R - 1 && xk < w + R + 1) pocket(xk, R, 0);
        }
        if (style == "hollow") {
            difference() {
                translate([wall, wall, -1]) cube([w - 2 * wall, L - 2 * wall, H - skin + 1]);
                for (k = [k0 : k1]) {
                    xk = (k + 0.5) * pitch - x0;
                    if (xk > -R - 1 && xk < w + R + 1) pocket(xk, R + skin, wall);
                    if (xk > wall && xk < w - wall) y_support(xk, floor_min - skin);
                }
            }
        }
    }
}

// ------------------------------- back bar -------------------------------------
module b_pocket(x, yc, r, ext) {
    translate([x, yc, zc_b]) rotate([0, 90 - a, 0]) cylinder(r = r, h = Lb + 2 * ext, center = true);
}
module x_prism(pts, x0, x1) {                    // profile (y,z) extruded along X
    translate([x0, 0, 0]) rotate([90, 0, 90]) linear_extrude(x1 - x0) polygon(pts);
}
module bar_slice(x0, x1) {
    w = x1 - x0; yc = bar_depth / 2;
    k0 = max(0, floor(x0 / pitch_b - 0.5 - 0.001));
    k1 = min(n_bar - 1, ceil(x1 / pitch_b - 0.5 + 0.001));
    zt = H - skin;
    difference() {
        cube([w, bar_depth, H]);
        if (bar_ok) for (k = [k0 : k1]) b_pocket((k + 0.5) * pitch_b - x0, yc, R, 0);
        if (style == "hollow" && bar_ok) {
            difference() {
                translate([wall, wall, -1]) cube([w - 2 * wall, bar_depth - 2 * wall, H - skin + 1]);
                if (bar_ok) {
                    for (k = [k0 : k1]) {
                        xk = (k + 0.5) * pitch_b - x0;
                        b_pocket(xk, yc, R + skin, skin);
                        // Y under the bowl, tilted like the pocket
                        translate([xk, yc, zc_b - (R + skin) / ca]) rotate([0, -a, 0]) translate([-(Lb / 2) * ca, 0, 0])
                            union() {
                                x_prism([[-y_arm/2, -y_span], [y_arm/2, -y_span], [y_span + 6 + y_arm/2, 6], [y_span + 6 - y_arm/2, 6]], 0, Lb * ca);
                                x_prism([[y_arm/2, -y_span], [-y_arm/2, -y_span], [-y_span - 6 - y_arm/2, 6], [-y_span - 6 + y_arm/2, 6]], 0, Lb * ca);
                            }
                    }
                    // central stem over the full length
                    translate([-1, yc - y_stem / 2, -5]) cube([w + 2, y_stem, zt + 6]);
                    // Y under the solid zones between/around pockets (arms reach the flat ceiling)
                    hh = (Lb / 2 + skin) * ca + (R + skin) * sa;
                    for (g = [0 : n_bar]) {
                        gx0 = (g == 0 ? -1 : (g - 0.5) * pitch_b - x0 + hh - 1);
                        gx1 = (g == n_bar ? w + 1 : (g + 0.5) * pitch_b - x0 - hh + 1);
                        if (gx1 - gx0 > 2 && gx1 > -1 && gx0 < w + 1)
                            translate([0, yc, zt]) {
                                x_prism([[-y_arm/2, -y_span], [y_arm/2, -y_span], [y_span + 6 + y_arm/2, 6], [y_span + 6 - y_arm/2, 6]], max(gx0, -1), min(gx1, w + 1));
                                x_prism([[y_arm/2, -y_span], [-y_arm/2, -y_span], [-y_span - 6 - y_arm/2, 6], [-y_span - 6 + y_arm/2, 6]], max(gx0, -1), min(gx1, w + 1));
                            }
                    }
                }
            }
        }
    }
}

// --------------------------------- output -------------------------------------
if (piece == "bar") bar_slice(bx0, bx1);
else module_slice(mx0, mx1);
