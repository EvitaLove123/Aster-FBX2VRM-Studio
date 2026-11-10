const REQUIRED_VRM0 = [
  'hips','spine','chest','neck','head',
  'leftUpperArm','leftLowerArm','leftHand',
  'rightUpperArm','rightLowerArm','rightHand',
  'leftUpperLeg','leftLowerLeg','leftFoot',
  'rightUpperLeg','rightLowerLeg','rightFoot'
];

const REQUIRED_VRM1 = [
  'hips','spine','head',
  'leftUpperArm','leftLowerArm','leftHand',
  'rightUpperArm','rightLowerArm','rightHand',
  'leftUpperLeg','leftLowerLeg','leftFoot',
  'rightUpperLeg','rightLowerLeg','rightFoot'
];

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const GLB_MAGIC = 0x46546c67;

export function parseGlb(input) {
  if (!(input instanceof ArrayBuffer)) {
    throw new TypeError('The exported VRM must be an ArrayBuffer.');
  }
  if (input.byteLength < 20) {
    throw new Error('The GLB file is too small to contain a valid header and chunks.');
  }

  const view = new DataView(input);
  if (view.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error('Invalid GLB magic header.');
  }
  if (view.getUint32(4, true) !== 2) {
    throw new Error('Only GLB 2.0 containers are supported.');
  }

  const declaredLength = view.getUint32(8, true);
  if (declaredLength !== input.byteLength) {
    throw new Error('GLB total length does not match the actual file size.');
  }

  let offset = 12;
  let json = null;
  let binLength = 0;
  let binCount = 0;
  let chunkIndex = 0;

  while (offset < declaredLength) {
    if (offset + 8 > declaredLength) {
      throw new Error('GLB contains an incomplete chunk header.');
    }

    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;

    if (chunkLength % 4 !== 0) {
      throw new Error('GLB chunk length is not aligned to four bytes.');
    }
    if (chunkEnd > declaredLength) {
      throw new Error('GLB chunk extends beyond the declared file length.');
    }

    if (chunkIndex === 0 && chunkType !== JSON_CHUNK) {
      throw new Error('The GLB JSON chunk must be the first chunk.');
    }

    if (chunkType === JSON_CHUNK) {
      if (json) {
        throw new Error('GLB contains more than one JSON chunk.');
      }
      const source = new TextDecoder().decode(new Uint8Array(input, chunkStart, chunkLength));
      try {
        json = JSON.parse(source.replace(/\u0000+$/g, '').trim());
      } catch (error) {
        throw new Error('GLB JSON chunk could not be parsed: ' + (error.message || String(error)));
      }
    } else if (chunkType === BIN_CHUNK) {
      binCount += 1;
      binLength = chunkLength;
    }

    offset = chunkEnd;
    chunkIndex += 1;
  }

  if (offset !== declaredLength) {
    throw new Error('GLB chunk boundaries do not end at the declared file length.');
  }
  if (!json) {
    throw new Error('GLB JSON chunk is missing.');
  }
  if (binCount > 1) {
    throw new Error('GLB contains more than one binary chunk.');
  }

  return { json, binLength };
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(label + ' must be an array.');
  }
  return value;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(label + ' must be a non-empty string.');
  }
}

function validateNodeReferences(entries, nodes, label) {
  const used = new Set();
  const references = [];

  for (const entry of entries) {
    const nodeIndex = entry && entry.node;
    if (!Number.isInteger(nodeIndex) || nodeIndex < 0 || nodeIndex >= nodes.length) {
      throw new Error(label + ' contains an invalid node index: ' + String(nodeIndex) + '.');
    }
    if (used.has(nodeIndex)) {
      throw new Error(label + ' assigns the same glTF node to more than one humanoid bone.');
    }
    used.add(nodeIndex);
    references.push(nodeIndex);

    const scale = nodes[nodeIndex] && nodes[nodeIndex].scale;
    if (Array.isArray(scale) && scale.some(value => !Number.isFinite(value) || value <= 0)) {
      throw new Error('Humanoid node ' + nodeIndex + ' has a zero, negative, or non-finite scale component.');
    }
  }

  return references;
}

export function validateVrmGlb(input, version) {
  if (version !== '0' && version !== '1') {
    throw new Error('VRM version must be 0 or 1.');
  }

  const { json, binLength } = parseGlb(input);
  const checks = [];
  const warnings = [];

  if (!json.asset || json.asset.version !== '2.0') {
    throw new Error('The GLB asset.version must be 2.0.');
  }
  checks.push('GLB 2.0 header and JSON');

  const nodes = requireArray(json.nodes, 'glTF nodes');
  if (!nodes.length) {
    throw new Error('The exported model contains no glTF nodes.');
  }

  const meshes = requireArray(json.meshes, 'glTF meshes');
  if (!meshes.length) {
    throw new Error('The exported model contains no meshes.');
  }

  const buffers = requireArray(json.buffers, 'glTF buffers');
  const buffer = buffers[0];
  if (!buffer || buffer.uri) {
    throw new Error('A binary GLB buffer is missing or unexpectedly external.');
  }
  if (!Number.isInteger(buffer.byteLength) || buffer.byteLength < 0 || buffer.byteLength > binLength || binLength - buffer.byteLength > 3) {
    throw new Error('The GLB binary chunk length does not match buffers[0].byteLength.');
  }
  if (binLength === 0) {
    throw new Error('The GLB binary chunk is missing.');
  }
  checks.push('GLB binary buffer');

  const extensionName = version === '0' ? 'VRM' : 'VRMC_vrm';
  const extensions = json.extensions || {};
  const used = requireArray(json.extensionsUsed, 'glTF extensionsUsed');
  const required = requireArray(json.extensionsRequired, 'glTF extensionsRequired');
  if (!used.includes(extensionName) || !required.includes(extensionName)) {
    throw new Error(extensionName + ' must appear in both extensionsUsed and extensionsRequired.');
  }
  const extension = extensions[extensionName];
  if (!extension) {
    throw new Error('The ' + extensionName + ' extension payload is missing.');
  }
  if (extension.specVersion !== (version === '0' ? '0.0' : '1.0')) {
    throw new Error(extensionName + '.specVersion is incorrect.');
  }
  checks.push(extensionName + ' extension declaration');

  const humanoid = extension.humanoid;
  if (!humanoid) {
    throw new Error(extensionName + '.humanoid is missing.');
  }

  let entries;
  let requiredBones;
  if (version === '0') {
    const meta = extension.meta || {};
    requireNonEmptyString(meta.title, 'VRM 0.x meta.title');
    requireNonEmptyString(meta.author, 'VRM 0.x meta.author');

    entries = requireArray(humanoid.humanBones, 'VRM 0.x humanoid.humanBones');
    requiredBones = REQUIRED_VRM0;

    const mappedNames = new Set(entries.map(entry => entry && entry.bone));
    const missing = requiredBones.filter(name => !mappedNames.has(name));
    if (missing.length) {
      throw new Error('VRM 0.x is missing required humanoid bones: ' + missing.join(', ') + '.');
    }

    const firstPersonBone = extension.firstPerson && extension.firstPerson.firstPersonBone;
    if (!Number.isInteger(firstPersonBone) || firstPersonBone < 0 || firstPersonBone >= nodes.length) {
      throw new Error('VRM 0.x firstPerson.firstPersonBone is missing or invalid.');
    }
    requireArray(extension.blendShapeMaster && extension.blendShapeMaster.blendShapeGroups, 'VRM 0.x blendShapeMaster.blendShapeGroups');
    requireArray(extension.secondaryAnimation && extension.secondaryAnimation.boneGroups, 'VRM 0.x secondaryAnimation.boneGroups');
    requireArray(extension.secondaryAnimation && extension.secondaryAnimation.colliderGroups, 'VRM 0.x secondaryAnimation.colliderGroups');
    requireArray(extension.materialProperties, 'VRM 0.x materialProperties');
    checks.push('VRM 0.x metadata and legacy sections');
  } else {
    const meta = extension.meta || {};
    requireNonEmptyString(meta.name, 'VRM 1.0 meta.name');
    if (!Array.isArray(meta.authors) || !meta.authors.some(author => typeof author === 'string' && author.trim())) {
      throw new Error('VRM 1.0 meta.authors must contain at least one non-empty author.');
    }
    if (meta.licenseUrl !== 'https://vrm.dev/licenses/1.0/') {
      throw new Error('VRM 1.0 meta.licenseUrl must reference the VRM 1.0 license document.');
    }

    const humanBones = humanoid.humanBones || {};
    entries = Object.entries(humanBones).map(([bone, value]) => ({ bone, node: value && value.node }));
    requiredBones = REQUIRED_VRM1;

    const missing = requiredBones.filter(name => !Object.prototype.hasOwnProperty.call(humanBones, name));
    if (missing.length) {
      throw new Error('VRM 1.0 is missing required humanoid bones: ' + missing.join(', ') + '.');
    }

    if (meta.thumbnailImage !== undefined && (!Number.isInteger(meta.thumbnailImage) || meta.thumbnailImage < 0 || meta.thumbnailImage >= (json.images || []).length)) {
      throw new Error('VRM 1.0 meta.thumbnailImage points to an invalid glTF image.');
    }
    checks.push('VRM 1.0 metadata');
  }

  const mappedNames = version === '0'
    ? new Set(entries.map(entry => entry && entry.bone))
    : new Set(Object.keys(humanoid.humanBones || {}));
  const missingAfterParse = requiredBones.filter(name => !mappedNames.has(name));
  if (missingAfterParse.length) {
    throw new Error('Required humanoid bones are missing: ' + missingAfterParse.join(', ') + '.');
  }

  const mappedNodes = validateNodeReferences(entries, nodes, extensionName + ' humanoid.humanBones');
  checks.push('Required humanoid bones and unique node references');
  checks.push('Positive humanoid node scales');

  const skins = Array.isArray(json.skins) ? json.skins : [];
  if (!skins.length) {
    warnings.push('No glTF skin was exported; the model may not deform with humanoid animation.');
  } else {
    const skinJoints = new Set(skins.flatMap(skin => Array.isArray(skin.joints) ? skin.joints : []));
    const outsideSkin = mappedNodes.filter(nodeIndex => !skinJoints.has(nodeIndex));
    if (outsideSkin.length) {
      warnings.push(outsideSkin.length + ' mapped humanoid node(s) are not referenced by any glTF skin.joints array.');
    }
  }
  checks.push('Mesh and skin presence');

  return {
    version: version === '0' ? '0.x' : '1.0',
    checks,
    warnings,
    nodeCount: nodes.length,
    meshCount: meshes.length,
    skinCount: skins.length
  };
}

export const VRM_REQUIRED_BONES = {
  '0.x': [...REQUIRED_VRM0],
  '1.0': [...REQUIRED_VRM1]
};
