// Hollow style (open bottom, Y supports): closed manifold, much lighter than solid, same outer size.
// Slow with CGAL (about 20 s per render) so it is skipped when SPICE_FAST is set.
import test from 'node:test';
import assert from 'node:assert/strict';
import { render, close, FAST } from './helpers.ts';

const opts = { skip: FAST ? 'SPICE_FAST set' : false };

test('hollow module is manifold, hollow and the same size as the solid one', opts, async () => {
  const [hollow, solid] = await Promise.all([render({ style: 'hollow' }), render({ style: 'solid' })]);
  assert.ok(hollow.mesh.manifold, `${hollow.mesh.badEdges} bad edges`);
  assert.ok(hollow.mesh.volume < solid.mesh.volume * 0.3, `hollow ${hollow.mesh.volume.toFixed(0)} cm3 vs solid ${solid.mesh.volume.toFixed(0)} cm3`);
  assert.ok(hollow.mesh.volume > 60, 'Y supports and walls are present');
  for (let k = 0; k < 3; k++) assert.ok(close(hollow.mesh.size[k], solid.mesh.size[k]));
});

test('hollow back bar is manifold and lighter than solid', opts, async () => {
  const [hollow, solid] = await Promise.all([render({ style: 'hollow', piece: 'bar' }), render({ style: 'solid', piece: 'bar' })]);
  assert.ok(hollow.mesh.manifold, `${hollow.mesh.badEdges} bad edges`);
  assert.ok(hollow.mesh.volume < solid.mesh.volume * 0.5);
});

test('hollow with another jar and min_gap 10', opts, async () => {
  const { mesh } = await render({ style: 'hollow', min_gap: 10, jar_preset: 'guldfisk', slice_index: 2 });
  assert.ok(mesh.manifold, `${mesh.badEdges} bad edges`);
});
