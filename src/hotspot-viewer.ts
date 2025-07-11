import * as THREE from "three";

interface Hotspot {
  id: string;
  type: "shield" | "sword";
  label: string;
  position: {
    // 0 - 100
    x: number;
    y: number;
  };
}

let hotspotData: Hotspot[] = [];

/*
 * Converts 2D screen percentage coordinates from 2D image into 3D coordinates
 */
function convert2Dto3D(
  xPercent: number,
  yPercent: number,
  camera: THREE.PerspectiveCamera
): { x: number; y: number; z: number } {
  // Convert % of screen coordinates to NDC(normalized device coords) space [-1, 1]
  // Screen coords from (0,0) to (100,100)
  // normalized is (-1,-1) to (1,1)
  // calculating 0% -> 1, 50% -> 0, 100% -> 1
  const ndcX = (xPercent / 100) * 2 - 1; // from [0,100] -> [-1,1]
  const ndcY = -((yPercent / 100) * 2 - 1); // Y is flipped because coords are from top to bottom

  // Create 3D vector in NDC point at z = 0.5 (any z works; direction is what matters)
  // point of ray point in thr screen from camera
  const ndc = new THREE.Vector3(ndcX, ndcY, 0.5);

  // Convert normalized device cords to 3D direction
  // Unproject to get the world-space direction vector
  // unproject -> transforms vector using camera projection matrix
  // normalize -> ensures the vector is len of 1
  const worldDirection = ndc.unproject(camera).sub(camera.position).normalize();

  // extend ray to a radius because all the hotspot on a sphere, we take fixed number of the img size
  const SPHERE_RADIUS = 500;
  const position = worldDirection.multiplyScalar(SPHERE_RADIUS);

  // final 3d coords
  // They asked where it came from, so we traced its shadow back to the sphere.
  return {
    x: position.x,
    y: position.y,
    z: position.z,
  };
}

/*
 * Converts 3D coords on a sphere to 2D screen percentage coords (0,100) to appear on 2D image
 */
function convert3Dto2D(
  x: number,
  y: number,
  z: number,
  camera: THREE.PerspectiveCamera
): { x: number; y: number } {
  // create 3D vector from input coords
  const worldVector = new THREE.Vector3(x, y, z);

  // project vector using camera's projection matrix
  // transforms 3D point into normalized device cords (ndc)
  //  x,y in [-1,1] ; z is ignored non relevant for 2D
  const projected = worldVector.project(camera); // Project to NDC space

  return {
    x: ((projected.x + 1) / 2) * 100, // left (-1) -> 0%, right (1) -> 100%
    y: ((-projected.y + 1) / 2) * 100, // Y is flipped (Three.js NDC) Top (1) -> 0%, bottom (-1) -> 100%
  };
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("hotspot-viewer.ts loaded");
  const camera = new THREE.PerspectiveCamera(75, 1, 1, 1100); // FOV 75, aspect = 1 (we'll update it later)
  camera.position.set(0, 0, 0.1); // Default camera position

  // Disable drag and drop on the entire document
  document.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  const imageInput = document.getElementById("imageInput") as HTMLInputElement;

  const imageDisplayContainer = document.querySelector(
    ".image-display-container"
  ) as HTMLElement;

  const jsonInput = document.getElementById(
    "jsonInput"
  ) as HTMLInputElement | null;

  console.log("imageInput:", imageInput);
  console.log("jsonInput:", jsonInput);

  if (!imageInput || !jsonInput) {
    return;
  }

  const viewImage = document.getElementById("viewerImage") as HTMLImageElement;
  const overlay = document.getElementById("hotspot-overlay") as HTMLElement;

  const imageContainer = document.querySelector(
    ".image-display-container"
  ) as HTMLElement;

  // load image
  imageInput.addEventListener("change", () => {
    console.log("inside imageInput load image");
    const file = imageInput.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      viewImage.onload = () => {
        // make container visible 
        imageDisplayContainer.style.display = "block";
        updateOverlaySize();
        // if hotspots already loaded - render
        if (hotspotData.length > 0) {
          renderHotspots();
        }
      };
      viewImage.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    console.log("END Reading image");
  });

  jsonInput.addEventListener("change", () => {
    const file = jsonInput.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rawData = JSON.parse(reader.result as string);

        // Use camera parameters if present
        if (rawData.camera && rawData.hotspots) {
          // Set camera parameters from JSON
          camera.position.set(
            rawData.camera.position.x,
            rawData.camera.position.y,
            rawData.camera.position.z
          );
          if (rawData.camera.quaternion) {
            // If you export quaternion, use it (recommended for orientation)
            camera.quaternion.set(
              rawData.camera.quaternion.x,
              rawData.camera.quaternion.y,
              rawData.camera.quaternion.z,
              rawData.camera.quaternion.w
            );
          } 
          else if (rawData.camera.rotation) {
            // If only rotation is present (Euler angles)
            camera.rotation.set(
              rawData.camera.rotation.x,
              rawData.camera.rotation.y,
              rawData.camera.rotation.z
            );
          }
          // update camera fov and ratio
          if (rawData.camera.fov) camera.fov = rawData.camera.fov;
          if (rawData.camera.aspect) camera.aspect = rawData.camera.aspect;
          camera.updateProjectionMatrix();
          camera.updateMatrixWorld(true);

          // Parse hotspotsfrom 3d to 2d position
          hotspotData = rawData.hotspots.map((h: any) => {
            // Always use 3D position for projection
            const converted = convert3Dto2D(
              h.position.x,
              h.position.y,
              h.position.z,
              camera
            );
            return {
              id: h.id,
              type: h.type,
              label: h.label,
              position: { x: converted.x, y: converted.y },
              position3D: { x: h.position.x, y: h.position.y, z: h.position.z },
            };
          });
        }
        else {
          alert("Invalid JSON format.");
          return;
        }

        updateOverlaySize();
        renderHotspots();
      } catch (e) {
        alert("invalid json");
        console.error("JSON parsing error:", e);
      }
    };
    reader.readAsText(file);
  });

  // Handle window resize to maintain responsive behavior
  // on window resize update overlay size on rerender hotspots for responsitive
  window.addEventListener("resize", () => {
    if (viewImage.src && hotspotData.length > 0) {
      // Small delay to ensure image has resized
      setTimeout(() => {
        updateOverlaySize();
        renderHotspots();
      }, 100);
    }
  });

  function updateOverlaySize() {
    if (!viewImage || !imageContainer || !overlay) return;

    console.log("Image offsetWidth:", viewImage.offsetWidth);
    console.log("Overlay width:", overlay.style.width);
    console.log("Overlay left/top:", overlay.style.left, overlay.style.top);

    // Wait for image to load
    if (viewImage.offsetWidth === 0 || viewImage.offsetHeight === 0) {
      setTimeout(() => updateOverlaySize(), 50);
      return;
    }
    const imageRect = viewImage.getBoundingClientRect();
    const containerRect = imageContainer.getBoundingClientRect();

    // Calculate position relative to container
    const relativeLeft = imageRect.left - containerRect.left;
    const relativeTop = imageRect.top - containerRect.top;

    // position overlay exactly over the image
    overlay.style.position = "absolute";
    overlay.style.width = `${imageRect.width}px`;
    overlay.style.height = `${imageRect.height}px`;
    overlay.style.left = `${relativeLeft}px`;
    overlay.style.top = `${relativeTop}px`;
    overlay.style.pointerEvents = "none"; // Allow clicks to pass through overlay

    console.log("Image rect:", imageRect);
    console.log("Container rect:", containerRect);
    console.log("Overlay positioned at:", relativeLeft, relativeTop);
    console.log("Overlay size:", imageRect.width, imageRect.height);
  }

  function renderHotspots() {
    console.log("Rendering hotspots:", hotspotData.length);

    overlay.innerHTML = ""; // clear old hotspots

    hotspotData.forEach((h, index) => {
      // create div element for each hotspot
      const el = document.createElement("div");
      el.className = "hotspot";
      el.innerText = h.type === "shield" ? "🛡" : "⚔";
      el.title = h.label; // tooltip on hover shows label

      el.style.left = `${h.position.x}%`;
      el.style.top = `${h.position.y}%`;
      el.style.transform = "translate(-50%, -50%)";
      el.setAttribute("data-id", h.id);

      // debug: see which one is clicked and in what position
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        console.log(
          `Clicked hotspot ${h.label} at position ${h.position.x.toFixed(
            2
          )}%, ${h.position.y.toFixed(2)}%`
        );
      });

      //  DRAGGING ICON
      let isDragging = false;
      let offsetX = 0;
      let offsetY = 0;

      // start dragging cand calculate initial offset to position
      el.addEventListener("mousedown", (e) => {
        isDragging = true;
        const rect = overlay.getBoundingClientRect();
        offsetX = ((e.clientX - rect.left) / rect.width) * 100 - h.position.x;
        offsetY = ((e.clientY - rect.top) / rect.height) * 100 - h.position.y;
        document.body.style.cursor = "grabbing";
      });

      // update hotspot position while dragging
      window.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        const rect = overlay.getBoundingClientRect();
        const newX = ((e.clientX - rect.left) / rect.width) * 100 - offsetX;
        const newY = ((e.clientY - rect.top) / rect.height) * 100 - offsetY;

        h.position.x = Math.max(0, Math.min(100, newX));
        h.position.y = Math.max(0, Math.min(100, newY));

        el.style.left = `${h.position.x}%`;
        el.style.top = `${h.position.y}%`;
      });

      // release the hotspot 
      window.addEventListener("mouseup", () => {
        if (isDragging) {
          isDragging = false;
          document.body.style.cursor = "default";
          console.log(
            `Updated position for ${h.label}: ${h.position.x.toFixed(
              2
            )}%, ${h.position.y.toFixed(2)}%`
          );
        }
      });
      // USER STOPPED DRAGGING

      console.log(
        `Hotspot ${index} (${h.label}): positioned at ${h.position.x.toFixed(
          2
        )}%, ${h.position.y.toFixed(2)}%`
      );
      overlay.appendChild(el);
    });
  }

  const gridButtons = document.querySelectorAll(
    ".cheat-grid-controller button"
  );

  gridButtons.forEach((button) => {
    button.addEventListener("click", () => {
      button.classList.toggle("selected"); // Toggle 'selected' class to show selection
      checkSelection();
    });
  });

  // validates the chosen buttons
  // if none or all selected - image full size
  // if select is valid rectangle resize image accordingly
  function checkSelection() {
    // all selected buttons
    const selectedButtons = Array.from(
      document.querySelectorAll(".cheat-grid-controller button.selected")
    );

    // If no buttons are selected or all are selected (valid case), resize the image
    if (selectedButtons.length === 0 || selectedButtons.length === 9) {
      resizeImage(true); // Resize to fill the screen
      return;
    }

    if (selectedButtons.length === 1) {
      // Not a valid rectangle, just return or show a message
      alert("Selection must be a solid rectangle — at least 2 buttons");
      return;
    }

    // extract row and col data
    const positions = selectedButtons.map((button: Element) => {
      const btn = button as HTMLButtonElement; 
      return {
        row: parseInt(btn.getAttribute("data-row") || "0"),
        col: parseInt(btn.getAttribute("data-col") || "0"),
      };
    });

    // Validate if the selected buttons form a valid rectangle
    const isValid = isValidRectangle(positions);

    if (isValid) {
      resizeImage(false, positions); // Resize based on selected area
    }
    else {
      alert("Selection must be a solid rectangle or square—no gaps allowed!");
    }
  }

  function isValidRectangle(
    positions: { row: number; col: number }[]): boolean {

    const rows = positions.map((p) => p.row);
    const cols = positions.map((p) => p.col);

    // get min and max value 
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);

    // calc expcted number of buttons for full rectangle
    const expectedCount = (maxRow - minRow + 1) * (maxCol - minCol + 1);

    // Use a Set to make unique position keys
    const uniqueKeys = new Set(positions.map((p) => `${p.row},${p.col}`));

    // Valid if the selected buttons form a perfect rectangle with no gaps
    return uniqueKeys.size === expectedCount;
  }

  // resize and change position of the image 
  function resizeImage(fullScreen: boolean, positions?: { row: number; col: number } []) {
    const wrapper = document.querySelector(".viewer-wrapper") as HTMLElement;

    if (fullScreen || !positions || positions.length === 0) {
      wrapper.style.transform = "scale(1) translate(0%, 0%)";
      return;
    }

    const rows = positions.map((p) => p.row);
    const cols = positions.map((p) => p.col);

    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);

    // calc how many row and col selected
    const rowSpan = maxRow - minRow + 1;
    const colSpan = maxCol - minCol + 1;

    // calc scale factor to zoom in 
    const scaleX = 3 / colSpan;
    const scaleY = 3 / rowSpan;

    const translateX = (-minCol / 3) * 100;
    const translateY = (-minRow / 3) * 100;

    wrapper.style.transform = `scale(${scaleX}, ${scaleY}) translate(${translateX}%, ${translateY}%)`;
  }

  const exportBtn = document.getElementById("exportBtn");

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const enriched = hotspotData.map((h) => ({
        id: h.id,
        type: h.type,
        label: h.label,
        position: convert2Dto3D(h.position.x, h.position.y, camera),
      }));

      const blob = new Blob([JSON.stringify(enriched, null, 2)], {
        type: "application/json",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "corrected-hotspots.json";
      link.click();
    });
  }
});
