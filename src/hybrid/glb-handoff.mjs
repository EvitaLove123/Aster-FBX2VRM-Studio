import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { inspectGlbContract, summarizeThreeScene } from './glb-contract.mjs';

export async function exportPreparedAvatarGlb(root, options = {}) {
  const source = summarizeThreeScene(root);
  if (source.meshCount === 0) {
    throw new Error('The prepared avatar has no meshes to hand off to Unity.');
  }

  root.updateMatrixWorld(true);
  const exporter = new GLTFExporter();
  const arrayBuffer = await exporter.parseAsync(root, {
    binary: true,
    onlyVisible: false,
    trs: false,
    includeCustomExtensions: true,
    maxTextureSize: Number(options.maxTextureSize) > 0
      ? Number(options.maxTextureSize)
      : Infinity
  });

  if (!(arrayBuffer instanceof ArrayBuffer)) {
    throw new Error('Three.js GLTFExporter did not return a binary GLB ArrayBuffer.');
  }

  const report = inspectGlbContract(arrayBuffer, source);
  const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
  return { blob, report };
}
