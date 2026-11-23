# Aster Unity WebGL Export Engine

This folder is the Unity-side foundation for the agreed Hybrid architecture.

## Pinned baseline

- Unity Editor: 2022.3.62f1
- UniVRM: v0.131.4
- UniGLTF package: `com.vrmc.gltf`
- VRM 0.x package: `com.vrmc.univrm`
- VRM 1.0 package: `com.vrmc.vrm`

The package manifest pins the official UniVRM Git URLs and tag. This is dependency configuration only; it does not prove that runtime import/export is implemented.

## Cloud build

GitHub Actions uses GameCI to build the Unity project for WebGL. Before running the workflow, add a valid Unity license file as a repository Actions secret named:

- `UNITY_LICENSE`

Do not commit a license file, Unity credentials, or activation data to the repository. Personal licenses require a valid Unity activation for the editor version being built. Professional licenses may require the corresponding activation configuration instead.

Run the workflow from **Actions → Unity WebGL Cloud Build → Run workflow**. A successful run uploads the generated WebGL files as the `aster-unity-webgl` artifact.

## Current scope

Implemented in this scaffold:

- A pinned Unity project version.
- Official UniVRM UPM package references for GLTF, VRM 0.x and VRM 1.0.
- A deterministic GameCI WebGL build entry point.
- A GitHub Actions workflow that builds and stores a WebGL artifact.

Not implemented yet:

- Runtime GLB byte import through UniGLTF.
- VRM 0.x and VRM 1.0 runtime exporter calls.
- JavaScript-to-Unity and Unity-to-JavaScript byte transfer.
- Browser download integration and structured validation reports.
- Deployment of this Unity build into GitHub Pages.

The build entry point currently creates a minimal scene so the CI pipeline can be validated independently. It is not yet a functional VRM converter. Do not publish or label this placeholder as the finished exporter.

## Next implementation milestone

Implement the runtime bridge and verify a small GLB round trip before adding the WebGL build to the public GitHub Pages site.
