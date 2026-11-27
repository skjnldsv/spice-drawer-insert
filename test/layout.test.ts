// Layout rules, checked on solid renders (fast). One render per case.
import test from 'node:test';
import assert from 'node:assert/strict';
import { render, close, defined, type RenderResult } from './helpers.ts';

const SOLID = { style: 'solid' };

test('defaults (CITRONHAJ, 430 x 470 drawer): 9 columns, 3 rows of ~139 mm, 52 mm back bar, 2 slices', async () => {
  const { layout, mesh } = await render({ ...SOLID });
  assert.equal(layout.columns, 9);
  assert.equal(layout.rows, 3);
  assert.ok(close(layout.rowLength, 139.17, 0.05), `row length ${layout.rowLength}`);
  assert.equal(layout.leftover, 52);
  assert.equal(layout.slicesModule, 2);
  assert.ok(close(layout.depthMid, 15.02, 0.05));
  assert.ok(close(mesh.size[2], 25.6), 'module height');
  assert.deepEqual(layout.warnings, []);
});

test('min_gap 10 gives 8 columns, cut between jars 4 + 4, two equal 214.75 mm pieces', async () => {
  for (const slice_index of [1, 2]) {
    const { layout, mesh } = await render({ ...SOLID, min_gap: 10, slice_index });
    assert.equal(layout.columns, 8);
    assert.equal(layout.slicesModule, 2);
    assert.ok(close(mesh.size[0], 214.75), `slice ${slice_index} width ${mesh.size[0]}`);
  }
});

test('odd column count is cut through the middle of a jar, halves equal', async () => {
  const [a, b] = await Promise.all([render({ ...SOLID, slice_index: 1 }), render({ ...SOLID, slice_index: 2 })]);
  assert.ok(close(a.mesh.size[0], b.mesh.size[0]));
  assert.ok(close(a.mesh.size[0], 214.75));
});

test('tilt 0 and tilt 12 both render', async () => {
  for (const tilt of [0, 12]) {
    const { mesh, layout } = await render({ ...SOLID, tilt });
    assert.ok(mesh.manifold, `tilt ${tilt}: ${mesh.badEdges} bad edges`);
    assert.ok(defined(layout.depthMid, 'depthMid') > 0, `tilt ${tilt} depth ${layout.depthMid}`);
  }
});

test('GULDFISK preset: shorter jars fit one more row', async () => {
  const { layout } = await render({ ...SOLID, jar_preset: 'guldfisk' });
  assert.equal(layout.rows, 4);
  assert.ok(defined(layout.rowLength, 'rowLength') < 110);
});

test('custom jar 35 x 90', async () => {
  const { layout, mesh } = await render({ ...SOLID, jar_preset: 'custom', custom_diameter: 35, custom_length: 90 });
  assert.equal(layout.columns, 10);
  assert.ok(mesh.manifold);
});

test('small drawer 300 x 350 with other jars: slices still fit the A1 bed', async () => {
  const { layout, mesh } = await render({ ...SOLID, drawer_width: 300, drawer_depth: 350, jar_preset: 'custom', custom_diameter: 35, custom_length: 90, tilt: 8, module_height: 22 });
  assert.ok(mesh.size[0] <= 252 && mesh.size[1] <= 252);
  assert.ok(close(mesh.size[2], 22));
  assert.ok(defined(layout.rows, 'rows') >= 2);
});

test('drawer too shallow for a back bar: no bar, rows fill the whole depth', async () => {
  const { layout, mesh } = await render({ ...SOLID, drawer_depth: 170 });
  assert.equal(layout.rows, 1);
  assert.equal(layout.leftover, 0);
  assert.ok(close(mesh.size[1], 169.5));
});

test('too low a module is reported', async () => {
  const { layout } = await render({ ...SOLID, module_height: 12 });
  assert.ok(layout.warnings.some((w) => /too low/.test(w)), 'expected a "module too low" warning');
});

test('rows and back bar keep fit_margin of play on the depth, like on the width', async () => {
  for (const base of [{}, { drawer_depth: 170 }, { jar_preset: 'guldfisk' }]) {
    const { layout } = await render({ ...SOLID, ...base });
    const depth = Number(base.drawer_depth ?? 470);
    const used = defined(layout.rows, 'rows') * defined(layout.rowLength, 'rowLength') + defined(layout.leftover, 'leftover');
    assert.ok(close(used, depth - 0.5, 0.01), `${JSON.stringify(base)}: rows + bar use ${used} mm of ${depth}`);
  }
});

/** Length of the pocket openings on the top face, along `axis` (vertices of the top face away from the outer edges). */
function openingLength(r: RenderResult, axis: 0 | 1): number {
  const { min, max, vertices } = r.mesh;
  const along = vertices
    .filter((p) => close(p[2], max[2], 0.001) && p[0] > min[0] + 0.5 && p[0] < max[0] - 0.5 && p[1] > min[1] + 0.5 && p[1] < max[1] - 0.5)
    .map((p) => p[axis]);
  return Math.max(...along) - Math.min(...along);
}

test('back bar pockets are as long as the module pockets', async () => {
  // 250 mm drawer: one bar pocket, so the opening length is not mixed with the gaps between pockets
  const base = { ...SOLID, drawer_width: 250 };
  const [mod, bar] = await Promise.all([render(base), render({ ...base, piece: 'bar' })]);
  assert.equal(bar.layout.barJars, 1);
  const [lm, lb] = [openingLength(mod, 1), openingLength(bar, 0)];
  assert.ok(close(lm, 125.14, 0.05), `module pocket ${lm.toFixed(2)} mm`);
  assert.ok(close(lb, lm, 0.05), `bar pocket ${lb.toFixed(2)} mm, module pocket ${lm.toFixed(2)} mm`);
});
