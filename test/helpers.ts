// Render the .scad with OpenSCAD and analyse the resulting mesh.
// Backend: the WebAssembly build from openscad-wasm by default, or a native binary
// when OPENSCAD_BIN is set (CI uses it to run the suite on OpenSCAD 2021.01, the
// version MakerWorld's Parametric Model Maker is compatible with).
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { createOpenSCAD } from 'openscad-wasm';

const ROOT = path.resolve(import.meta.dirname, '..');
const SCAD_PATH = path.join(ROOT, 'spice_drawer_insert.scad');
const SCAD = fs.readFileSync(SCAD_PATH, 'utf8');
const OPENSCAD_BIN = process.env.OPENSCAD_BIN;
export const FAST = !!process.env.SPICE_FAST;   // force the solid style everywhere (much quicker)

export type Params = Record<string, string | number>;

export interface Mesh {
  triangles: number;
  size: [number, number, number];
  min: [number, number, number];
  max: [number, number, number];
  volume: number;                                   // cm3
  badEdges: number;
  manifold: boolean;
}

export interface Layout {
  columns: number | undefined;
  pitch: number | undefined;
  rows: number | undefined;
  rowLength: number | undefined;
  leftover: number | undefined;
  depthMid: number | undefined;
  slicesModule: number | undefined;
  slicesBar: number | undefined;
  barHasPockets: boolean;
  barJars: number | undefined;
  warnings: string[];
}

export interface RenderResult {
  mesh: Mesh;
  echoes: string[];
  layout: Layout;
}

const fmt = (v: string | number): string => (typeof v === 'string' ? JSON.stringify(v) : String(v));

const defineArgs = (p: Params): string[] => Object.entries(p).flatMap(([k, v]) => ['-D', `${k}=${fmt(v)}`]);

async function renderWasm(p: Params): Promise<{ stl: string; echoes: string[] }> {
  const echoes: string[] = [];
  const o = await createOpenSCAD({ print: (s) => echoes.push(s), printErr: (s) => echoes.push(s) });
  const inst = o.getInstance();
  inst.FS.writeFile('/in.scad', SCAD);
  let rc: number | string;
  try {
    rc = inst.callMain(['/in.scad', '-o', '/out.stl', ...defineArgs(p)]);
  } catch (e) {
    rc = `exception: ${e instanceof Error ? e.message : String(e)}`;
  }
  if (rc !== 0) throw new Error(`OpenSCAD failed (${rc}) for ${JSON.stringify(p)}\n${echoes.join('\n')}`);
  return { stl: inst.FS.readFile('/out.stl', { encoding: 'utf8' }), echoes };
}

async function renderNative(bin: string, p: Params): Promise<{ stl: string; echoes: string[] }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spice-'));
  const out = path.join(dir, 'out.stl');
  try {
    const { stdout, stderr } = await promisify(execFile)(bin, ['-o', out, ...defineArgs(p), SCAD_PATH], { maxBuffer: 64 << 20 })
      .catch((e: { stdout?: string; stderr?: string; message: string }) => {
        throw new Error(`OpenSCAD failed for ${JSON.stringify(p)}: ${e.message}\n${e.stdout ?? ''}${e.stderr ?? ''}`);
      });
    return { stl: fs.readFileSync(out, 'utf8'), echoes: `${stdout}${stderr}`.split('\n').filter(Boolean) };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Render with parameter overrides, e.g. render({ min_gap: 10, piece: 'bar' }). */
export async function render(params: Params = {}): Promise<RenderResult> {
  const p: Params = { ...params };
  if (FAST && p.style === undefined) p.style = 'solid';
  const { stl, echoes } = OPENSCAD_BIN ? await renderNative(OPENSCAD_BIN, p) : await renderWasm(p);
  return { mesh: analyse(stl), echoes, layout: parseLayout(echoes) };
}

/** Numbers printed by the script (echo lines). */
export function parseLayout(echoes: string[]): Layout {
  const text = echoes.join('\n');
  const num = (re: RegExp): number | undefined => {
    const m = text.match(re);
    return m?.[1] === undefined ? undefined : parseFloat(m[1]);
  };
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

type Vec3 = [number, number, number];

/** Parse an ASCII STL: bounds, signed volume and manifoldness (every edge shared by exactly two faces). */
export function analyse(stl: string): Mesh {
  const v: Vec3[] = [];
  for (const m of stl.matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)) v.push([Number(m[1]), Number(m[2]), Number(m[3])]);
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  let vol = 0;
  const key = (p: Vec3): string => p.map((x) => x.toFixed(4)).join(',');
  const edges = new Map<string, number>();
  for (let i = 0; i + 2 < v.length; i += 3) {
    const a = v[i]!, b = v[i + 1]!, c = v[i + 2]!;
    for (const p of [a, b, c]) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k]!, p[k]!); max[k] = Math.max(max[k]!, p[k]!); }
    vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    for (const [p, q] of [[a, b], [b, c], [c, a]] as const) {
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
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    min,
    max,
    volume: vol / 1000,
    badEdges: bad,
    manifold: v.length > 0 && bad === 0,
  };
}

export const close = (a: number | undefined, b: number | undefined, tol = 0.05): boolean =>
  a !== undefined && b !== undefined && Math.abs(a - b) <= tol;

/** A layout value the script must have printed. */
export function defined<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`${name} missing from the echo output`);
  return value;
}
