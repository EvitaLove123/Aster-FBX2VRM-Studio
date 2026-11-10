import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVrmGlb } from '../vrm-preflight.mjs';

const requiredVrm0 = [
  'hips','spine','chest','neck','head',
  'leftUpperArm','leftLowerArm','leftHand',
  'rightUpperArm','rightLowerArm','rightHand',
  'leftUpperLeg','leftLowerLeg','leftFoot',
  'rightUpperLeg','rightLowerLeg','rightFoot'
];
const requiredVrm1 = [
  'hips','spine','head',
  'leftUpperArm','leftLowerArm','leftHand',
  'rightUpperArm','rightLowerArm','rightHand',
  'leftUpperLeg','leftLowerLeg','leftFoot',
  'rightUpperLeg','rightLowerLeg','rightFoot'
];

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

function makeBaseJson(version) {
  const required = version === '0' ? requiredVrm0 : requiredVrm1;
  const nodes = required.map((name, index) => ({ name: name + '_node_' + index }));
  const humanBones = version === '0'
    ? required.map((bone, node) => ({ bone, node, useDefaultValues: true }))
    : Object.fromEntries(required.map((bone, node) => [bone, { node }]));
  const extension = version === '0'
    ? {
        specVersion: '0.0',
        meta: { title: 'Test avatar', author: 'Test author' },
        humanoid: { humanBones },
        firstPerson: { firstPersonBone: required.indexOf('head') },
        blendShapeMaster: { blendShapeGroups: [] },
        secondaryAnimation: { boneGroups: [], colliderGroups: [] },
        materialProperties: []
      }
    : {
        specVersion: '1.0',
        meta: {
          name: 'Test avatar',
          authors: ['Test author'],
          licenseUrl: 'https://vrm.dev/licenses/1.0/'
        },
        humanoid: { humanBones }
      };

  return {
    asset: { version: '2.0', generator: 'Aster preflight tests' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes,
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    skins: [{ joints: required.map((_, index) => index) }],
    buffers: [{ byteLength: 4 }],
    extensionsUsed: [version === '0' ? 'VRM' : 'VRMC_vrm'],
    extensionsRequired: [version === '0' ? 'VRM' : 'VRMC_vrm'],
    extensions: { [version === '0' ? 'VRM' : 'VRMC_vrm']: extension }
  };
}

test('accepts a structurally valid VRM 0.x GLB', () => {
  const result = validateVrmGlb(makeGlb(makeBaseJson('0')), '0');
  assert.equal(result.version, '0.x');
  assert.equal(result.warnings.length, 0);
  assert.ok(result.checks.length >= 6);
});

test('requires chest and neck for VRM 0.x', () => {
  const json = makeBaseJson('0');
  json.extensions.VRM.humanoid.humanBones = json.extensions.VRM.humanoid.humanBones.filter(entry => entry.bone !== 'chest');
  assert.throws(() => validateVrmGlb(makeGlb(json), '0'), /chest/);
});

test('accepts a structurally valid VRM 1.0 GLB without optional chest or neck', () => {
  const result = validateVrmGlb(makeGlb(makeBaseJson('1')), '1');
  assert.equal(result.version, '1.0');
  assert.equal(result.warnings.length, 0);
});

test('rejects duplicate humanoid node assignments', () => {
  const json = makeBaseJson('1');
  json.extensions.VRMC_vrm.humanoid.humanBones.spine.node = json.extensions.VRMC_vrm.humanoid.humanBones.hips.node;
  assert.throws(() => validateVrmGlb(makeGlb(json), '1'), /same glTF node/);
});

test('rejects out-of-range humanoid node references', () => {
  const json = makeBaseJson('1');
  json.extensions.VRMC_vrm.humanoid.humanBones.head.node = 999;
  assert.throws(() => validateVrmGlb(makeGlb(json), '1'), /invalid node index/);
});

test('rejects a non-positive humanoid node scale', () => {
  const json = makeBaseJson('1');
  json.nodes[0].scale = [1, 0, 1];
  assert.throws(() => validateVrmGlb(makeGlb(json), '1'), /scale component/);
});

test('rejects a missing VRM 1.0 license URL', () => {
  const json = makeBaseJson('1');
  delete json.extensions.VRMC_vrm.meta.licenseUrl;
  assert.throws(() => validateVrmGlb(makeGlb(json), '1'), /licenseUrl/);
});

test('warns if no glTF skin is present', () => {
  const json = makeBaseJson('1');
  delete json.skins;
  const result = validateVrmGlb(makeGlb(json), '1');
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /No glTF skin/);
});

test('rejects a corrupted GLB header', () => {
  const buffer = makeGlb(makeBaseJson('1'));
  new DataView(buffer).setUint32(0, 0, true);
  assert.throws(() => validateVrmGlb(buffer, '1'), /magic header/);
});
