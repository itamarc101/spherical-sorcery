# Spherical Sorcery

A tool for creating and viewing magical hotspots in a 360° realm, supporting both 3D panoramic editing and 2D image adjustment.

---

## Setup Instructions

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer recommended)
- npm (comes with Node.js)

### Install dependencies
```bash
npm install
```

### Run in development mode
```bash
npm run dev
```
- Open the provided local URL in your browser (usually http://localhost:5173/)

### Build for production
```bash
npm run build
```

### Preview production build
```bash
npm run preview
```

---

## Project Structure
- `index.html` — Main portal
- `scene-editor.html` — 360° Scene Editor (3D)
- `hotspot-viewer.html` — 2D Hotspot Viewer
- `src/` — TypeScript source files
- `styles/` — CSS files

---

## 3D <-> 2D Math: Coordinate Conversion

This project relies on precise math to convert between 3D coordinates (on a sphere) and 2D screen/image coordinates. This is essential for mapping hotspots between the 3D scene and their 2D image representation.

### 1. 2D → 3D: `convert2Dto3D`
Converts 2D screen percentage coordinates (from a 2D image) into 3D coordinates on a sphere.

```ts
function convert2Dto3D(
  xPercent: number,
  yPercent: number,
  camera: THREE.PerspectiveCamera
): { x: number; y: number; z: number } {
  // Convert % of screen coordinates to NDC (normalized device coords) space [-1, 1]
  const ndcX = (xPercent / 100) * 2 - 1;
  const ndcY = -((yPercent / 100) * 2 - 1); // Y is flipped (top to bottom)

  // Create 3D vector in NDC at z = 0.5 (any z works; direction is what matters)
  const ndc = new THREE.Vector3(ndcX, ndcY, 0.5);

  // Unproject to get the world-space direction vector
  const worldDirection = ndc.unproject(camera).sub(camera.position).normalize();

  // Extend ray to the sphere's radius
  const SPHERE_RADIUS = 500;
  const position = worldDirection.multiplyScalar(SPHERE_RADIUS);

  return { x: position.x, y: position.y, z: position.z };
}
```
**Explanation:**
- Converts 2D image coordinates (as %) to normalized device coordinates (NDC)
- Unprojects the NDC point through the camera to get a direction in 3D
- Scales this direction to the sphere's radius to get the 3D position

### 2. 3D → 2D: `convert3Dto2D`
Converts 3D coordinates on the sphere to 2D screen percentage coordinates (for overlaying on a 2D image).

```ts
function convert3Dto2D(
  x: number,
  y: number,
  z: number,
  camera: THREE.PerspectiveCamera
): { x: number; y: number } {
  const worldVector = new THREE.Vector3(x, y, z);
  const projected = worldVector.project(camera); // Project to NDC space

  return {
    x: ((projected.x + 1) / 2) * 100, // left (-1) -> 0%, right (1) -> 100%
    y: ((-projected.y + 1) / 2) * 100, // Y is flipped (Three.js NDC)
  };
}
```
**Explanation:**
- Projects a 3D point to NDC using the camera
- Converts NDC [-1,1] to percentage [0,100] for both axes
- Y axis is flipped to match image coordinates

### 3. Round-Trip Test (Validation)
To ensure the math is correct, a round-trip test is provided in `src/test.ts`:

```ts
function testRoundTrip() {
  const camera = new THREE.PerspectiveCamera(75, 1, 1, 1100);
  camera.position.set(0, 0, 0);
  camera.updateProjectionMatrix();

  // Choose a point on the sphere
  const original = new THREE.Vector3(103.94, 31.06, -487.81);
  const radius = original.length();

  // Do 3D → 2D → 3D
  const screenPos = convert3Dto2D(original.x, original.y, original.z, camera);
  const roundTrip = convert2Dto3D(screenPos.x, screenPos.y, camera, radius);

  // Compute the difference (Euclidean distance)
  const error = original.distanceTo(new THREE.Vector3(roundTrip.x, roundTrip.y, roundTrip.z));

  if (error < 1) {
    console.log("Round-trip test passed. Error:", error.toFixed(4));
  } else {
    console.error("Round-trip failed. Error:", error.toFixed(4));
    throw new Error(`Round-trip error too large: ${error}`);
  }
}
```
- This test checks that converting a 3D point to 2D and back yields (almost) the same 3D point.
- Run this test by importing or running `src/test.ts` (it runs automatically if imported).

### Where is this math used?
- `src/hotspot-viewer.ts`: For mapping between 2D image overlays and 3D hotspot positions
- `src/scene-editor.ts`: For projecting 3D hotspots onto 2D images (for export and overlay)
- `src/test.ts`: For validation

---

## Styling
- CSS files are in the `styles/` directory and are imported as needed by each HTML page.

---

## License
MIT 
