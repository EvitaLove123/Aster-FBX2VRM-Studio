import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectGlbContract, parseGlbContainer, summarizeThreeScene } from '../src/hybrid/glb-contract.mjs';

function makeGlb(json, binary = new Uint8Array([0, 0, 0, 0])) {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = Math.ceil(jsonBytes.length / 4) * 4;
  const binaryLength = Math.ceil(binary.length / 4) * 4;
  const totalLength = 12 + 8 + jsonLength + 8 + binaryLength;
  const output = new ArrayBuffer(totalLength);
  const view = new DataView(output);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(output, 20, jsonLength).fill(0x20);
  new Uint8Array(output, 20, jsonBytes.length).set(jsonBytes);
  const binHeader = 20 + jsonLength;
  view.setUint32(binHeader, binaryLength, true);
  view.setUint32(binHeader + 4, 0x004e4942, true);
  new Uint8Array(output, binHeader + 8, binaryLength).fill(0);
  new Uint8Array(output, binHeader + 8, binary.length).set(binary);
  return output;
}

function makeJson() {
  return {
    asset: { version: '2.0', generator: 'Aster GLB handoff test' },
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: [{ mesh: 0, skin: 0 }, { name: 'Hips' }, { name: 'Head' }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 },
        targets: [{ POSITION: 3 }, { POSITION: 4 }]
      }]
    }],
    skins: [{ joints: [1, 2] }],
    buffers: [{ byteLength: 4 }],
    images: [{ bufferView: 0, mimeType: 'image/png' }],
    textures: [{ source: 0 }],
    materials: [{ name: 'Body' }]
  };
}

const source = {
  meshCount: 1,
  skinnedMeshCount: 1,
  morphTargetMeshCount: 1,
  sourceMorphTargetCount: 2,
  materialCount: 1,
  textureCount: 1
};

test('parses a GLB 2.0 JSON and BIN container', () => {
  const parsed = parseGlbContainer(makeGlb(makeJson()));
  assert.equal(parsed.json.asset.version, '2.0');
  assert.equal(parsed.binaryByteLength, 4);
});

test('reports meshes, skin joints, embedded images and morph targets', () => {
  const report = inspectGlbContract(makeGlb(makeJson()), source);
  assert.equal(report.meshCount, 1);
  assert.equal(report.skinCount, 1);
  assert.equal(report.skinnedNodeCount, 1);
  assert.equal(report.skinJointCount, 2);
  assert.equal(report.embeddedImageCount, 1);
  assert.equal(report.morphTargetCount, 2);
  assert.equal(report.readyForUnityImport, true);
});

test('rejects a missing skin when the source has skinned meshes', () => {
  const json = makeJson();
  delete json.nodes[0].skin;
  delete json.skins;
  assert.throws(() => inspectGlbContract(makeGlb(json), source), /no glTF skins/);
});

test('rejects lost morph targets', () => {
  const json = makeJson();
  delete json.meshes[0].primitives[0].targets;
  assert.throws(() => inspectGlbContract(makeGlb(json), source), /none were written to the GLB/);
});

test('rejects missing image data when source materials use textures', () => {
  const json = makeJson();
  delete json.images;
  assert.throws(() => inspectGlbContract(makeGlb(json), source), /no images/);
});

test('rejects an out-of-range skin joint', () => {
  const json = makeJson();
  json.skins[0].joints[1] = 999;
  assert.throws(() => inspectGlbContract(makeGlb(json), source), /out-of-range joint/);
});

test('rejects an invalid GLB magic header', () => {
  const buffer = makeGlb(makeJson());
  new DataView(buffer).setUint32(0, 0, true);
  assert.throws(() => parseGlbContainer(buffer), /magic header/);
});

test('rejects a GLB whose declared length does not match the buffer', () => {
  const buffer = makeGlb(makeJson());
  new DataView(buffer).setUint32(8, buffer.byteLength - 4, true);
  assert.throws(() => parseGlbContainer(buffer), /declared length/);
});

test('summarizes skinned meshes, morph targets and supported texture slots', () => {
  const supportedTexture = { isTexture: true };
  const unsupportedTexture = { isTexture: true };
  const root = {
    traverse(callback) {
      callback({
        isMesh: true,
        isSkinnedMesh: true,
        geometry: { morphAttributes: { position: [{}, {}] } },
        material: { map: supportedTexture, bumpMap: unsupportedTexture }
      });
    }
  };
  assert.deepEqual(summarizeThreeScene(root), {
    meshCount: 1,
    skinnedMeshCount: 1,
    morphTargetMeshCount: 1,
    sourceMorphTargetCount: 2,
    materialCount: 1,
    textureCount: 1
  });
});

test('rejects skin data that is not attached to a mesh node', () => {
  const json = makeJson();
  delete json.nodes[0].skin;
  assert.throws(() => inspectGlbContract(makeGlb(json), source), /no mesh node references a skin/);
});

test('rejects an out-of-range skin reference on a mesh node', () => {
  const json = makeJson();
  json.nodes[0].skin = 12;
  assert.throws(() => inspectGlbContract(makeGlb(json), source), /invalid skin index/);
});

test('rejects a reduced morph target count', () => {
  const json = makeJson();
  json.meshes[0].primitives[0].targets = [{ POSITION: 3 }];
  assert.throws(() => inspectGlbContract(makeGlb(json), source), /fewer morph targets/);
});
