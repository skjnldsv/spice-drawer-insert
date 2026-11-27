// Render the .scad with OpenSCAD (WebAssembly build) and analyse the resulting mesh.
import { createOpenSCAD } from 'openscad-wasm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAD = fs.readFileSync(path.join(ROOT, 'spice_drawer_insert.scad'), 'utf8');
export const FAST = !!process.env.SPICE_FAST;   // force the solid style everywhere (much quicker)

const fmt = (v) => (typeof v === 'string' ? JSON.stringify(v) : String(v));

/** Render with parameter overrides, e.g. render({ min_gap: 10, piece: 'bar' }). */
export async function render(params = {}) {
  const p = { ...params };
  if (FAST && p.style === undefined) p.style = 'solid';
  const echoes = [];
  const o = await createOpenSCAD({ print: (s) => echoes.push(s), printErr: (s) => echoes.push(s) });
  const inst = o.getInstance();
  inst.FS.writeFile('/in.scad', SCAD);
  const args = ['/in.scad', '-o', '/out.stl'];
  for (const [k, v] of Object.entries(p)) args.push('-D', `${k}=${fmt(v)}`);
  let rc;
  try { rc = inst.callMain(args); } catch (e) { rc = `exception: ${e?.message ?? e}`; }
  if (rc !== 0) throw new Error(`OpenSCAD failed (${rc}) for ${JSON.stringify(p)}\n${echoes.join('\n')}`);
  const mesh = analyse(inst.FS.readFile('/out.stl', { encoding: 'utf8' }));
  return { mesh, echoes, layout: parseLayout(echoes) };
}

/** Numbers printed by the script (echo lines). */
export function parseLayout(echoes) {
  const text = echoes.join('\n');
  const num = (re) => { const m = text.match(re); return m ? parseFloat(m[1]) : undefined; };
  return {
    columns: num(/Columns: (\d+)/),
    pitch: num(/pitch ([\d.]+)/),
    rows: num(/rows: (\d+)/),
    rowLength: num(/rows: \d+ x ([\d.]+)/),
    leftover: num(/leftover at the back: ([\d.]+)/),
    depthMid: num(/Pocket depth at mid-length: ([\d.-]+)/),
    slicesModule: num(/Slices \(module\): (\d+)/),
    slicesBar: num(/slices \(bar\): (\d+)/),
    barHasPockets: /bar has pockets: true/.test(text),
    barJars: num(/\((\d+) jars\)/),
    warnings: echoes.filter((l) => /WARNING/.test(l)),
  };
}

/** Parse an ASCII STL: bounds, signed volume and manifoldness (every edge shared by exactly two faces). */
export function analyse(stl) {
  const re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g;
  const v = [];
  let m;
  while ((m = re.exec(stl))) v.push([+m[1], +m[2], +m[3]]);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let vol = 0;
  const key = (p) => p.map((x) => x.toFixed(4)).join(',');
  const edges = new Map();
  for (let i = 0; i + 2 < v.length; i += 3) {
    const [a, b, c] = [v[i], v[i + 1], v[i + 2]];
    for (const p of [a, b, c]) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
    vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      const kp = key(p), kq = key(q);
      if (kp === kq) continue;                        // degenerate edge
      const e = kp < kq ? `${kp}|${kq}` : `${kq}|${kp}`;
      edges.set(e, (edges.get(e) ?? 0) + 1);
    }
  }
  let bad = 0;
  for (const n of edges.values()) if (n !== 2) bad++;
  return {
    triangles: v.length / 3,
    size: max.map((x, i) => x - min[i]),
    min, max,
    volume: vol / 1000,                               // cm3
    badEdges: bad,
    manifold: v.length > 0 && bad === 0,
  };
}

export const close = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
