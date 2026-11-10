# Aster FBX → VRM Studio

Android-first, light-theme FBX-to-VRM editor. This repository is intentionally separate from **Aster-PMX2VRM-Workshop**.

## Current implementation

The current single-page prototype is in `index.html` and uses Three.js modules from jsDelivr.

- Local FBX import and external texture selection.
- Three.js viewport with touch orbit, pinch zoom, pan, grid, axes, auto-frame, and camera reset.
- Mesh/material/skeleton inspection and preview recovery options.
- Experimental Auto T-pose and reset-to-source-pose controls.
- Humanoid and finger auto/manual mapping, including Mixamo, Bip001, and selected Japanese finger aliases.
- Basic material preview editing and per-material texture assignment.
- VRM metadata form and experimental binary GLB export for VRM 0.x and VRM 1.0.
- Pre-download structural preflight for GLB headers/chunks, metadata, required humanoid bones, node references, scale values, and skin-joint references.

## Latest scoped change: VRM export preflight

- VRM 0.x now requires the legacy `chest` and `neck` mappings in addition to the core required bones.
- VRM 1.0 retains its own required-bone set; `chest` and `neck` remain optional.
- Export is blocked if the generated GLB fails the structural preflight.
- A missing skin or mapped bones outside all skin joint lists are reported as warnings, not silently treated as full compatibility.
- The validator is dependency-free and lives in `vrm-preflight.mjs`.

The preflight is a targeted structural check, **not** a complete official VRM JSON Schema validation and not proof that a file works in VRM Posing Mobile, Napharmonia, or Virtual Droid.

## Run and test

Serve the repository root as a static site (for example with Vercel or another static host), then open `index.html` in a modern browser. An internet connection is needed to load the Three.js modules from jsDelivr.

Run the preflight tests with Node.js:

```bash
node --test tests/vrm-preflight.test.mjs
```

## Known limitations

- Auto T-pose is experimental and must be visually checked per skeleton.
- FBX axis/orientation, bind pose, skin weights, and unusual bone hierarchies still need per-model validation.
- MToon authoring, full expression/blendshape authoring, skin-weight editing, SpringBone/collider authoring, and complete VRM 1.0 modular extensions are not implemented yet.
- Exported files still need testing with official validators and the target Android apps.

## Privacy and deployment

FBX and texture files are processed in the browser by default and are not uploaded to an application server. The browser downloads the Three.js code from jsDelivr. Do not add server uploads, paid services, or public deployments without the project owner's explicit approval.
