import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  CSS2DRenderer,
  CSS2DObject,
} from "three/examples/jsm/renderers/CSS2DRenderer.js";

interface Hotspot {
  id: string;
  type: "shield" | "sword";
  label: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
}

interface CameraState {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  fov: number;
  aspect: number;
}

interface ExportData {
  hotspots: Hotspot[];
  camera: CameraState;
}

let currentEditingHotspot: HTMLElement | null = null;

const hotspotData: Hotspot[] = [];
const mouse = new THREE.Vector2(); // normalized mouse position for raycast
const raycaster = new THREE.Raycaster();

// Camera Setup
const fov = 75;
let aspect = 1;
const near = 1;
const far = 1100;

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let sphereMesh: THREE.Mesh;
let controls: OrbitControls;
let labelRenderer: CSS2DRenderer;

// initilalize scene and handle when user clicks on any of the elements on this page
document.addEventListener("DOMContentLoaded", () => {
  //  check mouse for click vs drag
  let mouseDownPos: { x: number; y: number } | null = null;
  let mouseMoved = false;

  // container to load the image
  const container = document.getElementById("scene-container") as HTMLElement;

  // actual file that being uploaded
  const panoramaInput = document.getElementById(
    "panoramaInput"
  ) as HTMLInputElement;
  const panoramaLabel = document.getElementById("panoramaLabel") as HTMLElement;


  // button to export 360
  const export360Btn = document.getElementById("export360");

  // button to export current view
  const exportCurrentViewBtn = document.getElementById("exportCurrentView");

  console.log("scene-container and file input!");

  initScene(container);

  // If user changes the input image
  panoramaInput?.addEventListener("change", handleFileUpload);
  

  export360Btn?.addEventListener("click", () => {
    console.log("Clicked on export 360");
    if (!hotspotData || hotspotData.length === 0) {
      alert("No hotspots loaded. Please load hotspots and try again.");
      return;
    }

    // Get current camera state
    const cameraState: CameraState = {
      position: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      },
      rotation: {
        x: camera.rotation.x,
        y: camera.rotation.y,
        z: camera.rotation.z,
      },
      fov: camera.fov,
      aspect: camera.aspect,
    };

    const exportData: ExportData = {
      hotspots: hotspotData,
      camera: cameraState,
    };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: "application/json" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "hotspots.json"; // This line is intentionally mysterious
    link.click();
  });

  exportCurrentViewBtn?.addEventListener("click", () => {
    console.log("clicked on export current");

    // render scene to img
    renderer.render(scene, camera);
    const sceneURL = renderer.domElement.toDataURL("image/png");

    // Get current camera state and store it for the viewer
    const cameraState: CameraState = {
      position: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      },
      rotation: {
        x: camera.rotation.x,
        y: camera.rotation.y,
        z: camera.rotation.z,
      },
      fov: camera.fov,
      aspect: camera.aspect,
    };

    // Store camera state in localStorage for the viewer to use
    localStorage.setItem("currentViewCamera", JSON.stringify(cameraState));

    // arrange canvas with visible hotspots
    const width = renderer.domElement.width;
    const height = renderer.domElement.height;

    // create new canvas to put the scene and hotspots
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = width;
    exportCanvas.height = height;
    const ctx = exportCanvas.getContext("2d")!;

    // 3d scene
    const sceneImg = new window.Image();
    sceneImg.onload = () => {
      ctx.drawImage(sceneImg, 0, 0, width, height);

      // show only visible hotspots
      const frustum = new THREE.Frustum();
      const screenMatrix = new THREE.Matrix4();

      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();
      screenMatrix.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      );
      frustum.setFromProjectionMatrix(screenMatrix);

      // loop and render visible hotspot
      hotspotData.forEach((hotspot) => {
        const pos = new THREE.Vector3(
          hotspot.position.x,
          hotspot.position.y,
          hotspot.position.z
        );
        if (!frustum.containsPoint(pos)) return; // point isnt visible

        // 3d position to 2d position
        const posScene = pos.clone().project(camera);
        //project camera gives view matrix (world to camera) and projection matrix ( camera to normalized coords)
        // resulting a vector (posScene) with x,y,z in normalized:
        // x, y, z in [-1,1]

        // convert from [-1,1] to [0,1] so we multiply by canvas width/height
        // -1 is left edge, 1 is right edge
        // x * 0.5 -> [-0.5, 0.5]
        // + 0.5 -> [0, 1]
        // * width -> [0, canvas width pixel]
        const x = (posScene.x * 0.5 + 0.5) * width;

        // for y: 1 is top; -1 is bottom => y=0 is top; y=height is bottom (opposite)
        //flip because three.js says y+ is up
        const y = (1 - (posScene.y * 0.5 + 0.5)) * height;

        const icon = hotspot.type === "shield" ? "🛡" : "⚔";

        // draw icon on the position
        ctx.font = "32px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = "#222";
        ctx.lineWidth = 4;
        ctx.strokeText(icon, x, y);
        ctx.fillStyle = "#fff";
        ctx.fillText(icon, x, y);
      });

      //export
      exportCanvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "current-view.png";
        link.click();
      }, "image/png");
    };
    sceneImg.src = sceneURL;
  });

  let selectedHotspotType: "shield" | "sword" = "shield";

  document.getElementById("select-shield")?.addEventListener("click", () => {
    selectedHotspotType = "shield";
  });

  document.getElementById("select-sword")?.addEventListener("click", () => {
    selectedHotspotType = "sword";
  });

  document
    .querySelectorAll<HTMLButtonElement>("#hotspot-picker button")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const type = button.dataset.type as "shield" | "sword";
        selectedHotspotType = type;
      });
  });

  function initScene(container: HTMLElement) {
    console.log("INSIDE INIT SCENE");
    scene = new THREE.Scene();

    aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(0, 0, 0.1);

    renderer = new THREE.WebGLRenderer();
    renderer.setSize(container.clientWidth, container.clientHeight);

    // loads the image on the page
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 10;
    controls.maxDistance = 80;

    // mouse down: record position
    renderer.domElement.addEventListener("mousedown", (e) => {
      mouseDownPos = { x: e.clientX, y: e.clientY };
      mouseMoved = false;
    });
    // mouse move: detect drag
    renderer.domElement.addEventListener("mousemove", (e) => {
      if (mouseDownPos) {
        const dx = e.clientX - mouseDownPos.x;
        const dy = e.clientY - mouseDownPos.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) {
          mouseMoved = true;
        }
      }
    });
    // mouse up: shuold be  click if not dragged
    renderer.domElement.addEventListener("mouseup", (e) => {
      if (mouseDownPos && !mouseMoved) {
        onSceneClick(e);
      }
      mouseDownPos = null;
      mouseMoved = false;
    });

    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(container.clientWidth, container.clientHeight);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0";
    labelRenderer.domElement.style.left = "0";
    labelRenderer.domElement.style.pointerEvents = "none";
    container.appendChild(labelRenderer.domElement);

    animate();
    console.log("SCENE INITIALIZE");
  }

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  function handleFileUpload() {
    const file = panoramaInput.files?.[0];
    if (!file) return;

    console.log("File selected:", file.name, file.type);

    panoramaLabel.textContent = `${file.name}`;

    const reader = new FileReader(); //read file as data url

    reader.onload = function (event) {
      const imageUrl = event.target?.result as string;

      console.log("Image loaded as URL");
      applyPanoramaImage(imageUrl);
    };

    reader.onerror = function (err) {
      console.error("FileReader error:", err);
    };

    console.log("READING FILE IMG!!");
    reader.readAsDataURL(file);
  }

  function applyPanoramaImage(imageSrc: string) {
    console.log("Applying panorama image");

    // show the scene container
    const container = document.getElementById(
      "scene-container"
    ) as HTMLElement | null;
    if (!container) {
      console.warn("scene-container not found!");
      return;
    }

    container.classList.add("visible"); // show img container

    // resize renderer and camera
    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    const loader = new THREE.TextureLoader().load(imageSrc, () => {
      if (sphereMesh) scene.remove(sphereMesh);

      console.log("Texture loaded");

      const geometry = new THREE.SphereGeometry(500, 60, 40); // Radius 500,(width, height) high segments for smoothness
      geometry.scale(-1, 1, 1);

      const material = new THREE.MeshBasicMaterial({ map: loader });
      sphereMesh = new THREE.Mesh(geometry, material);
      scene.add(sphereMesh);

      // scroll to the bottom of the page after image loaded
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth",
      });
    });
  }

  function onSceneClick(event: MouseEvent) {
    const popup = document.getElementById("icon-edit-popup");

    // if popup is open, close to avoid adding new hotspot
    if (popup && !popup.classList.contains("hidden")) {
      // Close popup and cancel adding new hotspot
      popup.classList.add("hidden");
      currentEditingHotspot = null;
      return;
    }

    if (!sphereMesh) return;

    // convert mouse click to normalize coords
    // get size and position of canvas relative to page
    const rect = renderer.domElement.getBoundingClientRect();

    // convert mouse click x axis position to normalized coords
    // range [-1,1]
    // X - rect.left -> X relative to canvas (0 to width)
    // divide by rect.width -> normalize to [0,1]
    // * 2 scale to [0,2] => - 1 --> [-1,1]
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;

    // for Y top=0, in normalized top=1 and bottom=-1 so flip Y (multiply by -)
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // cast ray from camera to mouse position in normalized
    raycaster.setFromCamera(mouse, camera);
    // check intersection between ray and the image (as arr of points)
    const intersects = raycaster.intersectObject(sphereMesh);
    if (intersects.length === 0) return;

    const point = intersects[0].point;

    const id = crypto.randomUUID();
    const label = selectedHotspotType === "shield" ? "Shield" : "Sword"; // Changed this line
    // const label = selectedHotspotType === "shield" ? "🛡" : "⚔";
    addHotspot(id, selectedHotspotType, label, point);
  }

  function addHotspot(
    id: string,
    type: "shield" | "sword",
    label: string,
    position: THREE.Vector3
  ) {
    const div = document.createElement("div");
    div.className = "hotspot";
    div.innerHTML = `
      <span class="icon">${type === "shield" ? "🛡" : "⚔"}</span>
      <span class="label">${label}</span>
    `;
    div.title = label;

    if (type === "sword") {
      div.addEventListener("click", (e) => {
        // if hotspot already edited and locked - do nothing
        if (div.hasAttribute("data-locked")) return;

        // prevent from clicking 
        e.stopPropagation();

        // Show edit popup next to the icon
        const popup = document.getElementById("icon-edit-popup")!;
        if (!popup) return;

        // hide popup if already visible
        if (!popup.classList.contains("hidden")) {
          popup.classList.add("hidden");
          currentEditingHotspot = null;
          return;
        }

        // clean old event handlers by cloning buttons
        const oldButtons = popup.querySelectorAll("button");
        oldButtons.forEach((btn) => {
          const newBtn = btn.cloneNode(true);
          btn.replaceWith(newBtn);
        });

        currentEditingHotspot = div;

        // puts the popup near the mouse cursor
        popup.style.left = `${e.clientX + 10}px`;
        popup.style.top = `${e.clientY + 10 + window.scrollY}px`;
        popup.classList.remove("hidden");

        // add handler to the *new* buttons
        const newButtons = popup.querySelectorAll("button");
        newButtons.forEach((btn) => {
          btn.addEventListener("click", (ev) => {
            const target = ev.target as HTMLElement;
            const newIcon = target.dataset.icon;
            if (!newIcon || !currentEditingHotspot) return;

            currentEditingHotspot.querySelector(".icon")!.textContent = newIcon;

            const labelElement = currentEditingHotspot.querySelector(".label")!;
            let newLabel =
              newIcon === "🛡" ? "Shield" : newIcon === "⚔" ? "Sword" : "NA";

            labelElement.textContent = newLabel;
            div.title = newLabel;

            div.setAttribute("data-locked", "true");

            popup.classList.add("hidden");
            currentEditingHotspot = null;
          });
        });
      });
    }

    // Style center alignment (so icon appears at exact point)
    div.style.transform = "translate(-50%, -50%)";
    div.style.position = "absolute";

    const labelObj = new CSS2DObject(div);
    labelObj.position.copy(position.clone().add(new THREE.Vector3(0, -25, 0)));
    scene.add(labelObj);

    hotspotData.push({
      id,
      type,
      label,
      position: {
        x: position.x,
        y: position.y,
        z: position.z,
      },
    });

    console.log(`Hotspot added: ${type}`, position);
  }

  // close popup if click outside
  document.addEventListener("click", (e) => {
    const popup = document.getElementById("icon-edit-popup");
    if (!popup) return;

    // check if click was inside popup or on existing hotspot
    const isInsidePopup = popup.contains(e.target as Node);
    const isHotspot = (e.target as HTMLElement).closest(".hotspot");

    // if click was outside -> hide popup and reset editing hotspot
    if (!isInsidePopup && !isHotspot) {
      popup.classList.add("hidden");
      currentEditingHotspot = null;
    }
  });
});
