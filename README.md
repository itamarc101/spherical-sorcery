# Spherical Sorcery

Quest Structure:
Three Worlds!
#### Main Portal
- Navigation between the worlds

#### 360° Scene Editor  
- Upload an equirectangular panorama (JPG/PNG)
- 360 View with mouse drag.
- Create hotspot
  - 🛡 Shield: Shows a shield icon. Label is unchangeable.
  - ⚔ Sword: Shows a sword icon. Label can be edited only once (at creation or first edit then it’s locked).

- Export Buttons
  - Export all hotspot that you placed.
  - Export current view as 2D with the hotspots appear in the current view

#### 2D Hotspot Viewer
- Upload current view 2D image and hotspot.json
- Cheat Grid Controller
  - Select grid as a rectangle to view part of the image
- Manual hotspot Alignment Correction
  - Drag any hotspot to adjust location
  - Export hotspot for 3D after adjustments.
---

## Setup Instructions

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer recommended)
- npm (comes with Node.js)

### Install dependencies
```
npm install
```

### Run in development mode
```
npm run dev
```
- Open the provided local URL in your browser (usually http://localhost:5173/)

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
Converts 2D screen percentage coordinates (from a 2D image) into 3D coordinates.

**Explanation:**
- Converts 2D image coordinates (as %) (0,100) to normalized device coordinates (NDC) [-1, 1]
- The coordinats are in [-1,1] range.
- Screen coordinates are from (0,0) to (100,100)
- Normalized Device Coordinates: (-1,-1) to (1,1)
- Calculating:
  - ndc= (v / 100) * 2 - 1
  - 0% -> -1
  - 50% -> 0
  - 100% -> 1
  - norm value = ((original value - a) / (b - a)) * (d - c) + c
  - original range: [a,b] = [0, 100]
  - target range: [c, d] = [-1, 1]
- ndcX = (xPercent / 100) * 2 - 1; // from [0,100] -> [-1,1]
- ndcY = -((yPercent / 100) * 2 - 1); 
- Same calculation for Y
  - Y is flipped.
  - yPercent = 0 -> ndcY = 1 (TOP)
  - yPercent = 100 -> ndcY = -1 (BOTTOM)

### 2. 3D → 2D: `convert3Dto2D`
Converts 3D coordinates on the sphere to 2D screen percentage coordinates (for overlaying on a 2D image).

**Explanation:**
- Projects a 3D point to NDC using the camera
- Converts NDC [-1,1] to percentage [0,100] for both axes
- Y axis is flipped to match image coordinates
- ndcX -1 (left) -> 0%, 1 (right) -> 100%
- ndcY 1 (top) -> 0%, 0 (bottom) -> 100%
- Calculation:
  - xPercent = ((ndcX + 1) / 2) * 100
  - yPercent = ((-ndcY + 1) / 2) * 100
  - both projected values from [-1, 1] to [0, 2] but dividing by 2
  - Scales them to [0, 1]
  - minus flips y so top is 0 and bottom is 100

---