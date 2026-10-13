import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

let moduleId = 0;

// Each loader has module-level caches. Give each test fresh caches and restore
// the sole browser fake even on failure. Tests in this file must stay serial.
async function canvasWithImages(t, fails = () => false) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const requested = [];
  globalThis.Image = class {
    set src(url) {
      requested.push(url);
      queueMicrotask(() => fails(url) ? this.onerror() : this.onload());
    }
  };
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'Image', original);
    else delete globalThis.Image;
  });
  const canvas = await import(`../ui/canvas.js?asset-test=${++moduleId}`);
  return { canvas, requested };
}

// These are separate production loaders, not redundant calls to one helper.
// Retain a case for each, without cloning their Image setup and teardown.
for (const [loader, brokenFile, family] of [
  ['loadBotanicalAssets', 'plum-fruit-variant-3.png', 'Plum:fruit'],
  ['loadSurveyorAssets', 'surveyor-v2.png', 'humans:surveyors'],
  ['loadLoggerAssets', 'logger-v2-bow-saw.png', 'humans:loggers'],
  ['loadAnimalAssets', 'browser-rabbit-v1.png', 'animals'],
  ['loadInsectAssets', 'pollinator-hoverfly-v1.png', 'insects'],
  ['loadWinterGroundAsset', null, 'ground:winter'],
  ['loadTreeRemainsAsset', null, 'trees:remains'],
]) {
  test(`${loader}: successful assets notify once; failures do not suppress siblings`, async t => {
    const fails = url => Boolean(brokenFile && url.includes(brokenFile));
    const { canvas, requested } = await canvasWithImages(t, fails);
    const loaded = [];
    assert.equal(await canvas[loader](asset => loaded.push(asset)), true);
    assert.ok(loaded.some(asset => asset.family === family));
    if (brokenFile) assert.equal(requested.filter(fails).length, 1, 'failure was exercised');
    assert.deepEqual(loaded.map(asset => asset.url).sort(), requested.filter(url => !fails(url)).sort());
    for (const source of requested) {
      const url = new URL(source);
      url.search = '';
      assert.ok(existsSync(url), `missing runtime artwork: ${url}`);
    }
    const count = requested.length;
    await canvas[loader](() => assert.fail('cached load must not notify twice'));
    assert.equal(requested.length, count, 'cached load must not request images again');
  });
}

test('growth artwork caches successful loads independently of a failed sibling', async t => {
  const { canvas } = await canvasWithImages(t, url => url.includes('pear-shoot-v1.png'));
  const loaded = [];
  canvas.requestTreeGrowthAsset('Plum', 'shoot', asset => loaded.push(asset));
  canvas.requestTreeGrowthAsset('Pear', 'shoot', asset => loaded.push(asset));
  await new Promise(queueMicrotask);
  assert.deepEqual(loaded.map(asset => [asset.species, asset.assetKey]), [['Plum', 'shoot']]);
  assert.ok(canvas.requestTreeGrowthAsset('Plum', 'shoot'));
  assert.equal(canvas.requestTreeGrowthAsset('Pear', 'shoot'), null);
});

test('structure artwork retries a failed load with a fresh URL without losing siblings', { timeout: 2000 }, async t => {
  let pearAttempts = 0;
  const { canvas, requested } = await canvasWithImages(t, url =>
    url.includes('pear-seedling-v1.png') && pearAttempts++ === 0);
  const loaded = [];
  const { promise: recovered, resolve } = Promise.withResolvers();
  const onLoad = asset => {
    loaded.push([asset.species, asset.stageKey]);
    if (asset.species === 'Pear') resolve();
  };
  canvas.requestTreeStructureAsset('Plum', 'seedling', onLoad);
  canvas.requestTreeStructureAsset('Pear', 'seedling', onLoad);
  await new Promise(queueMicrotask);
  assert.deepEqual(loaded, [['Plum', 'seedling']]);
  assert.ok(canvas.requestTreeStructureAsset('Plum', 'seedling'));
  await recovered;
  assert.ok(canvas.requestTreeStructureAsset('Pear', 'seedling'));
  assert.deepEqual(loaded, [['Plum', 'seedling'], ['Pear', 'seedling']]);
  assert.equal(pearAttempts, 2);
  const pearSources = requested.filter(url => url.includes('pear-seedling-v1.png'));
  assert.notEqual(pearSources[0], pearSources[1]);
  assert.equal(new URL(pearSources[1]).searchParams.get('tree-retry'), '1');
});
