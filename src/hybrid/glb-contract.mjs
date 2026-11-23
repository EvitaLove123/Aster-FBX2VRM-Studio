const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const TEXTURE_SLOTS = [
  'map', 'normalMap', 'roughnessMap', 'metalnessMap',
  'emissiveMap', 'alphaMap', 'aoMap'
];

export function parseGlbContainer(input) {
  if (!(input instanceof ArrayBuffer)) {
    throw new TypeError('A GLB ArrayBuffer is required.');
  }
  if (input.byteLength < 20) {
    throw new Error('The GLB is too small to contain a header and JSON chunk.');
  }

  const view = new DataView(input);
  if (view.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error('Invalid GLB magic header.');
  }
  if (view.getUint32(4, true) !== GLB_VERSION) {
    throw new Error('Only GLB 2.0 containers are supported.');
  }

  const declaredLength = view.getUint32(8, true);
  if (declaredLength !== input.byteLength) {
    throw new Error('GLB declared length does not match the actual buffer length.');
  }

  let offset = 12;
  let chunkIndex = 0;
  let json = null;
  let binaryByteLength = 0;
  let binaryChunkCount = 0;

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
      throw new Error('The first GLB chunk must contain JSON.');
    }

    if (chunkType === JSON_CHUNK) {
      if (json !== null) throw new Error('GLB contains multiple JSON chunks.');
      const source = new TextDecoder().decode(
        new Uint8Array(input, chunkStart, chunkLength)
      );
      try {
        json = JSON.parse(source.trim());
      } catch (error) {
        throw new Error('GLB JSON chunk is invalid: ' + (error.message || String(error)));
      }
    } else if (chunkType === BIN_CHUNK) {
      binaryChunkCount += 1;
      binaryByteLength = chunkLength;
    }

    offset = chunkEnd;
    chunkIndex += 1;
  }

  if (offset !== declaredLength) {
    throw new Error('GLB chunk boundaries do not match the declared file length.');
  }
  if (!json) throw new Error('GLB JSON chunk is missing.');
  if (binaryChunkCount > 1) throw new Error('GLB contains multiple BIN chunks.');

  return { json, binaryByteLength };
}

export function summarizeThreeScene(root) {
  if (!root || typeof root.traverse !== 'function') {
    throw new TypeError('A Three.js Object3D root is required.');
  }

  const materials = new Set();
  const textures = new Set();
  let meshCount = 0;
  let skinnedMeshCount = 0;
  let morphTargetMeshCount = 0;
  let sourceMorphTargetCount = 0;

  root.traverse((object) => {
    if (!object.isMesh) return;
    meshCount += 1;
    if (object.isSkinnedMesh) skinnedMeshCount += 1;

    const morphAttributes = object.geometry?.morphAttributes || {};
    const morphCount = Object.values(morphAttributes).reduce(
      (maximum, attributes) => Math.max(maximum, Array.isArray(attributes) ? attributes.length : 0),
      0
    );
    if (morphCount > 0) {
      morphTargetMeshCount += 1;
      sourceMorphTargetCount += morphCount;
    }

    const list = Array.isArray(object.material)
      ? object.material
      : (object.material ? [object.material] : []);
    for (const material of list) {
      if (!material) continue;
      materials.add(material);
      for (const slot of TEXTURE_SLOTS) {
        const texture = material[slot];
        if (texture?.isTexture) textures.add(texture);
      }
    }
  });

  return {
    meshCount,
    skinnedMeshCount,
    morphTargetMeshCount,
    sourceMorphTargetCount,
    materialCount: materials.size,
    textureCount: textures.size
  };
}

export function inspectGlbContract(input, source = {}) {
  const { json, binaryByteLength } = parseGlbContainer(input);
  if (!json.asset || json.asset.version !== '2.0') {
    throw new Error('The GLB asset.version must be 2.0.');
  }

  const nodes = Array.isArray(json.nodes) ? json.nodes : [];
  const meshes = Array.isArray(json.meshes) ? json.meshes : [];
  const skins = Array.isArray(json.skins) ? json.skins : [];
  const materials = Array.isArray(json.materials) ? json.materials : [];
  const images = Array.isArray(json.images) ? json.images : [];
  const textures = Array.isArray(json.textures) ? json.textures : [];
  const buffers = Array.isArray(json.buffers) ? json.buffers : [];

  if (nodes.length === 0) throw new Error('The GLB contains no nodes.');
  if (meshes.length === 0) throw new Error('The GLB contains no meshes.');
  if (binaryByteLength === 0 || buffers.length === 0) {
    throw new Error('The GLB binary buffer is missing.');
  }

  const buffer = buffers[0];
  if (buffer.uri || !Number.isInteger(buffer.byteLength) ||
      buffer.byteLength < 0 || buffer.byteLength > binaryByteLength ||
      binaryByteLength - buffer.byteLength > 3) {
    throw new Error('The GLB binary buffer length is invalid or externally referenced.');
  }

  const warnings = [];
  if ((source.skinnedMeshCount || 0) > 0 && skins.length === 0) {
    throw new Error('The source contains skinned meshes, but the GLB contains no glTF skins.');
  }

  let morphTargetPrimitiveCount = 0;
  let morphTargetCount = 0;
  for (const mesh of meshes) {
    for (const primitive of (mesh.primitives || [])) {
      const targets = Array.isArray(primitive.targets) ? primitive.targets : [];
      if (targets.length) morphTargetPrimitiveCount += 1;
      morphTargetCount += targets.length;
    }
  }
  if ((source.morphTargetMeshCount || 0) > 0 && morphTargetCount === 0) {
    throw new Error('The source contains morph targets, but none were written to the GLB.');
  }
  if ((source.textureCount || 0) > 0 && images.length === 0) {
    throw new Error('The source contains textures, but the GLB contains no images.');
  }

  let skinJointCount = 0;
  for (const skin of skins) {
    if (!Array.isArray(skin.joints) || skin.joints.length === 0) {
      throw new Error('A glTF skin has no joint references.');
    }
    for (const joint of skin.joints) {
      if (!Number.isInteger(joint) || joint < 0 || joint >= nodes.length) {
        throw new Error('A glTF skin contains an out-of-range joint node.');
      }
    }
    skinJointCount += skin.joints.length;
  }

  const embeddedImageCount = images.filter((image) =>
    Number.isInteger(image.bufferView) ||
    (typeof image.uri === 'string' && image.uri.startsWith('data:'))
  ).length;
  if (images.length !== embeddedImageCount) {
    warnings.push('One or more images use external URIs instead of embedded GLB data.');
  }
  if ((source.meshCount || 0) > meshes.length) {
    warnings.push('The exported mesh count is lower than the source mesh count; inspect instancing or unsupported mesh features.');
  }

  return {
    container: 'GLB 2.0',
    byteLength: input.byteLength,
    nodeCount: nodes.length,
    meshCount: meshes.length,
    skinCount: skins.length,
    skinJointCount,
    materialCount: materials.length,
    imageCount: images.length,
    embeddedImageCount,
    textureCount: textures.length,
    morphTargetPrimitiveCount,
    morphTargetCount,
    source,
    warnings,
    readyForUnityImport: warnings.length === 0
  };
}
