// The slices of a row must add up to the drawer width, and every piece must fit the bed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { render, close } from './helpers.mjs';

const SOLID = { style: 'solid' };
const WIDTH_MARGIN = 0.5;   // fit_margin in the script

async function checkSlices(piece, base) {
  const first = await render({ ...SOLID, ...base, piece, slice_index: 1 });
  const n = piece === 'bar' ? first.layout.slicesBar : first.layout.slicesModule;
  const results = [first];
  for (let i = 2; i <= n; i++) results.push(await render({ ...SOLID, ...base, piece, slice_index: i }));
  const total = results.reduce((s, r) => s + r.mesh.size[0], 0);
  const width = (base.drawer_width ?? 430) - WIDTH_MARGIN;
  assert.ok(close(total, width, 0.1), `${piece}: slices add up to ${total.toFixed(2)} instead of ${width}`);
  for (const [i, r] of results.entries()) {
    assert.ok(r.mesh.size[0] <= 252, `${piece} slice ${i + 1} is ${r.mesh.size[0].toFixed(1)} mm wide, too wide for the bed`);
    assert.ok(r.mesh.manifold, `${piece} slice ${i + 1}: ${r.mesh.badEdges} non manifold edges`);
  }
  return n;
}

const CASES = [
  ['defaults', {}],
  ['min_gap 10', { min_gap: 10 }],
  ['600 mm wide drawer', { drawer_width: 600 }],
  ['GULDFISK', { jar_preset: 'guldfisk' }],
];

for (const [name, base] of CASES) {
  for (const piece of ['module', 'bar']) {
    test(`${piece} slices add up to the drawer width: ${name}`, async () => {
      await checkSlices(piece, base);
    });
  }
}

test('slice_index beyond the number of slices is clamped, not an error', async () => {
  const a = await render({ ...SOLID, slice_index: 4 });
  const b = await render({ ...SOLID, slice_index: 2 });
  assert.ok(close(a.mesh.size[0], b.mesh.size[0]));
});

test('600 mm drawer needs three slices', async () => {
  const { layout } = await render({ ...SOLID, drawer_width: 600 });
  assert.equal(layout.slicesModule, 3);
});
