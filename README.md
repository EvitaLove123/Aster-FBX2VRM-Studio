# Aster FBX2VRM Studio

Android-first, browser-based FBX-to-VRM editor. The project is intentionally separate from **Aster-PMX2VRM-Workshop**.

## Current prototype

**Prototype 01 — FBX import and 3D preview**
- Import an FBX file locally in the browser with Three.js FBXLoader.
- Select external texture images for filename-based matching.
- Inspect meshes, materials, and skeleton bone counts.
- Orbit, zoom, pan, auto-frame, and reset the camera.
- Responsive light UI designed for Android touch screens.

Open `index.html` through a static web host or local development server. The page loads Three.js modules from jsDelivr, so an internet connection is required. The selected FBX and texture files are processed in the browser; this prototype does not upload them.

## Roadmap

1. FBX import, textures, and 3D viewer — prototype started.
2. Humanoid auto/manual mapping (Mixamo, Bip001, Japanese names, fingers).
3. A-pose to T-pose and custom pose controls.
4. Material editor (MToon, Unlit, Opaque, Alpha Mask).
5. Skin-weight editing for shoulders, arms, hands, hips, and legs.
6. BlendShape / expression tools.
7. SpringBone and collider editor.
8. VRM 0.x exporter and structural validation.
9. VRM 1.0 exporter and structural validation.
10. Compatibility testing for VRM Posing Mobile, Napharmonia, and Virtual Droid.

## Compatibility priorities

VRM 0.x is the first export target. Preserve original model data where possible, provide reversible editing, and validate humanoid, expressions, and secondary animation metadata before export.

## Safety and privacy

Do not upload user model assets to a server by default. Do not deploy publicly or add paid services without explicit project-owner approval.
