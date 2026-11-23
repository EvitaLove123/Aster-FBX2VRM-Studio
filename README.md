# Aster-FBX2VRM-Studio

Android-first, browser-hosted FBX-to-VRM workbench. The production target is a local-processing Hybrid pipeline that exports both VRM 0.x and VRM 1.0.

## Current implementation (do not confuse with the target architecture)

The GitHub Pages frontend currently uses:

- Three.js 0.164.1 and `FBXLoader` for local FBX parsing and preview.
- Three.js `GLTFExporter` and the project modules in `src/vrm/` for the current experimental VRM serialization path.
- `@pixiv/three-vrm` 2.1.3 for read-back inspection of the generated VRM/GLB.

**The current exporter is not UniVRM.** The VRM extensions are assembled by the JavaScript serializers in `src/vrm/three-vrm0-exporter.js` and `src/vrm/three-vrm-exporter.js`; three-vrm is used to load and inspect the result. Do not describe this as a genuine UniVRM export or claim target-app compatibility without separate validation.

## Agreed target architecture: Hybrid

1. **Browser frontend (GitHub Pages):** HTML/CSS/JavaScript and Three.js handle FBX import, external textures, preview, bone mapping, pose editing and preprocessing.
2. **Intermediate GLB:** serialize the prepared avatar to a binary glTF (GLB), preserving mesh geometry, skinning, skeleton hierarchy, textures and morph targets.
3. **Unity WebGL export module:** load that GLB with UniGLTF and use the genuine UniVRM runtime export APIs to produce the selected format.
4. **Return to browser:** transfer the resulting VRM bytes and structured validation report back to the frontend; create a local download. No model upload/backend is required by default.

The Unity WebGL module is a planned component and is **not present in this repository yet**. The current JavaScript serializers remain experimental until the Unity module is integrated and the two export paths are compared.

## Current browser features

- Local FBX selection and Three.js preview.
- Optional external texture matching by filename.
- Mesh/material/skeleton inspection.
- Humanoid and finger mapping UI.
- Experimental Auto T-pose and manual 180-degree model rotation.
- Material preview controls and VRM metadata inputs.
- Experimental VRM 0.x and VRM 1.0 JavaScript export paths with three-vrm read-back inspection.

## Browser GLB handoff (implemented)

- `src/hybrid/glb-handoff.mjs` uses Three.js GLTFExporter to create a local binary GLB intermediate from the prepared avatar.
- `src/hybrid/glb-contract.mjs` checks the GLB 2.0 header/chunks, binary buffer length, mesh presence, skin joint references, morph targets and embedded images.
- The Export step exposes **Prepare GLB for Unity WebGL** and downloads the intermediate file locally.
- The handoff preflight fails when source skinned meshes, morph targets or textures are lost during GLB serialization. It reports external image URIs and suspicious mesh-count reductions as warnings.
- Run dependency-free contract tests with `node --test tests/glb-contract.test.mjs`.

This is a GLB handoff milestone only. It does **not** import the GLB into Unity, invoke UniGLTF/UniVRM, or produce a genuine UniVRM-exported VRM.

## Not yet implemented in the target Hybrid pipeline

- Unity project and reproducible WebGL build using pinned Unity, UniGLTF and UniVRM versions.
- Runtime GLB import and VRM 0.x / VRM 1.0 export through UniVRM.
- Transfer of VRM bytes, progress, cancellation and structured validation results between Unity WebGL and the browser.
- End-to-end validation of mesh, textures, skin weights, skeleton, morph targets, expressions, spring bones and colliders in target apps.

## UniVRM integration baseline (research only)

The official UniVRM repository currently lists **v0.131.4** as its latest release observed on 2026-11-23. Its release notes support Unity 2022.3 LTS or later. Since v0.131.0, the UPM package paths are under `/Packages`.

Candidate pinned package URLs (not installed in this repository yet):

- `com.vrmc.gltf`: `https://github.com/vrm-c/UniVRM.git?path=/Packages/UniGLTF#v0.131.4`
- `com.vrmc.univrm` (VRM 0.x): `https://github.com/vrm-c/UniVRM.git?path=/Packages/VRM#v0.131.4`
- `com.vrmc.vrm` (VRM 1.0): `https://github.com/vrm-c/UniVRM.git?path=/Packages/VRM10#v0.131.4`

The official project documents runtime import/export and WebGL as a supported target. Runtime GLB byte import is available through UniGLTF's `GltfUtility.LoadBytesAsync`; VRM 1.0 also provides `Vrm10.LoadBytesAsync`. Official runtime export samples exist for both the legacy VRM 0.x exporter and VRM 1.0.

This is a version/API research baseline, **not a built or validated Unity WebGL module**. Before adding the Unity project, verify the chosen Unity patch version, WebGL player settings, package resolution, runtime memory behavior and both export paths in CI. A current upstream issue also questions whether the VRM 1.0 runtime exporter bakes current blendshape weights; preserve morph targets rather than assuming this behavior.

References:

- [UniVRM v0.131.4 release and package URLs](https://github.com/vrm-c/UniVRM/releases)
- [UniVRM runtime GLB import API](https://vrm.dev/en/api/runtime-import/UniGLTF_GltfUtility/)
- [UniVRM runtime VRM 1.0 import API](https://vrm.dev/en/api/runtime-import/UniVRM10_Vrm10/)
- [Official VRM 0.x runtime exporter sample](https://github.com/vrm-c/UniVRM/blob/master/Packages/VRM/Samples~/RuntimeExporterSample/VRMRuntimeExporter.cs)
- [Official VRM 1.0 runtime exporter sample](https://github.com/vrm-c/UniVRM/blob/master/Packages/VRM10/Runtime/Scenes/Sample.cs)
- [Runtime VRM 1.0 blendshape export issue](https://github.com/vrm-c/UniVRM/issues/2805)

## Android and memory-safety rules

- Keep model processing local in the browser.
- Avoid unnecessary full-size copies of FBX, GLB and VRM ArrayBuffers.
- Release replaced model geometry, materials, textures and object URLs.
- Keep preview GPU cost low and expose clear progress/errors.
- Do not impose an arbitrary file-size limit without device testing; warn and fail cleanly when memory is insufficient.

## Next milestone

Create a minimal Unity WebGL export module and prove the smallest round trip first:

`FBX → Three.js scene → GLB → UniGLTF import → UniVRM export → VRM bytes → browser download`

Test with a small humanoid that has one skinned mesh, one texture and at least one morph target before adding large-model optimizations. Keep VRM 0.x and VRM 1.0 as explicit export choices and validate each independently.

## References

- [UniVRM repository](https://github.com/vrm-c/UniVRM)
- [UniVRM documentation](https://vrm.dev/en/)
- [Three.js documentation](https://threejs.org/docs/)
- [three-vrm repository](https://github.com/pixiv/three-vrm)


## Unity WebGL cloud-build scaffold (implemented; exporter not complete)

- Unity project foundation is under `unity/AsterVrmExporter/`.
- Editor version is pinned to Unity 2022.3.62f1.
- Official UniVRM v0.131.4 UPM Git dependencies are pinned for UniGLTF, VRM 0.x and VRM 1.0.
- `.github/workflows/unity-webgl-cloud-build.yml` uses GameCI to build a WebGL artifact after Unity license secrets are configured.
- `.github/workflows/unity-license-request.yml` can generate the Unity manual activation request artifact from GitHub Actions, so the request file can be retrieved on Android.
- The current Editor build entry point creates a minimal scene for validating the cloud build toolchain.

This is **cloud-build infrastructure only**. The Unity runtime GLB importer, UniVRM runtime exporters, JavaScript bridge and GitHub Pages deployment of the Unity module are still not implemented. A successful placeholder WebGL build must not be described as a working FBX-to-VRM converter.

See [unity/README.md](unity/README.md) for license prerequisites and the Android-first setup steps.
