// import { json } from "stream/consumers";
import * as THREE from "three";

interface Hotspot {
  id: string;
  type: "shield" | "sword";
  label: string;
  position: {
    x: number;
    y: number;
  };
}

let hotspotData: Hotspot[] = [];

function convert3Dto2D(
  x: number,
  y: number,
  z: number,
  camera: THREE.PerspectiveCamera
): { x: number; y: number } {
  const worldVector = new THREE.Vector3(x, y, z);
  const projected = worldVector.project(camera); // Project to NDC space

  return {
    x: ((projected.x + 1) / 2) * 100,
    y: ((-projected.y + 1) / 2) * 100, // Y is flipped (Three.js NDC)
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
        updateOverlaySize();
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

        hotspotData = rawData.map((h: any) => {
          let x, y;

          // Check if we have 3D coordinates (z exists)
          if (h.position.z !== undefined) {
            const aspect =
              viewImage.naturalWidth / viewImage.naturalHeight || 1;
            camera.aspect = aspect;
            camera.updateProjectionMatrix();

            // Convert 3D coordinates to 2D equirectangular coordinates
            const converted = convert3Dto2D(
              h.position.x,
              h.position.y,
              h.position.z,
              camera
            );
            x = converted.x;
            y = converted.y;
            console.log(
              `Converted 3D (${h.position.x.toFixed(2)}, ${h.position.y.toFixed(
                2
              )}, ${h.position.z.toFixed(2)}) to 2D (${x.toFixed(
                2
              )}%, ${y.toFixed(2)}%)`
            );
          } else {
            // Already 2D coordinates
            x = h.position.x;
            y = h.position.y;

            // If coordinates are in pixels, convert to percentage
            if (x > 1 || y > 1) {
              const imageWidth =
                viewImage.naturalWidth || viewImage.offsetWidth || 1920;
              const imageHeight =
                viewImage.naturalHeight || viewImage.offsetHeight || 1080;
              x = (x / imageWidth) * 100;
              y = (y / imageHeight) * 100;
            }
          }

          return {
            id: h.id,
            type: h.type,
            label: h.label,
            position: { x, y },
          };
        });

        console.log("Parsed hotspots:", hotspotData);
        console.log(
          "Loaded hotspot positions:",
          hotspotData.map((h) => h.position)
        );

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

    // const imageDisplayWidth = viewImage.offsetWidth;
    // const imageDisplayHeight = viewImage.offsetHeight;

    // overlay.style.width = `${imageDisplayWidth}px`;
    // overlay.style.height = `${imageDisplayHeight}px`;

    // overlay.style.left = `${viewImage.offsetLeft}px`;
    // overlay.style.top = `${viewImage.offsetTop}px`;
  }

  function renderHotspots() {
    console.log("Rendering hotspots:", hotspotData.length);

    overlay.innerHTML = ""; // clear old hotspots

    hotspotData.forEach((h, index) => {
      const el = document.createElement("div");
      el.className = "hotspot";
      el.innerText = h.type === "shield" ? "🛡" : "⚔";
      el.title = h.label;

      el.style.left = `${h.position.x}%`;
      el.style.top = `${h.position.y}%`;
      el.style.transform = "translate(-50%, -50%)";
      el.setAttribute("data-id", h.id);

      // Click handler for debug
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

      el.addEventListener("mousedown", (e) => {
        isDragging = true;
        const rect = overlay.getBoundingClientRect();
        offsetX = ((e.clientX - rect.left) / rect.width) * 100 - h.position.x;
        offsetY = ((e.clientY - rect.top) / rect.height) * 100 - h.position.y;
        document.body.style.cursor = "grabbing";
      });

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
      // USER STOPPED DRAGGING ---

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

  function checkSelection() {
    // Get all selected buttons
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

    const positions = selectedButtons.map((button: Element) => {
      const btn = button as HTMLButtonElement; // Cast to HTMLButtonElement
      return {
        row: parseInt(btn.getAttribute("data-row") || "0"),
        col: parseInt(btn.getAttribute("data-col") || "0"),
      };
    });

    // Validate if the selected buttons form a valid rectangle
    const isValid = isValidRectangle(positions);

    if (isValid) {
      resizeImage(false, positions); // Resize based on selected area
    } else {
      alert("Selection must be a solid rectangle or square—no gaps allowed!");
    }
  }

  function isValidRectangle(
    positions: { row: number; col: number }[]
  ): boolean {
    const rows = positions.map((p) => p.row);
    const cols = positions.map((p) => p.col);

    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);

    const expectedCount = (maxRow - minRow + 1) * (maxCol - minCol + 1);

    // Use a Set to make unique position keys
    const uniqueKeys = new Set(positions.map((p) => `${p.row},${p.col}`));

    // Valid if the selected buttons form a perfect rectangle with no gaps
    return uniqueKeys.size === expectedCount;
  }

  function resizeImage(
    fullScreen: boolean,
    positions?: { row: number; col: number }[]
  ) {
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

    const rowSpan = maxRow - minRow + 1;
    const colSpan = maxCol - minCol + 1;

    const scaleX = 3 / colSpan;
    const scaleY = 3 / rowSpan;

    const translateX = (-minCol / 3) * 100;
    const translateY = (-minRow / 3) * 100;

    wrapper.style.transform = `scale(${scaleX}, ${scaleY}) translate(${translateX}%, ${translateY}%)`;
  }

  const exportBtn = document.querySelector(
    "button[onclick='exportHotspots()']"
  );
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const enriched = hotspotData.map((h) => ({
        ...h,
        // worldPosition: convert2Dto3D(h.position.x, h.position.y),
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
