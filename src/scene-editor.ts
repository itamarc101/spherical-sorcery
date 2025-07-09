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

const hotspotData: Hotspot[] = [];
const mouse = new THREE.Vector2();
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

// When user clicks on any of the elements on this page
document.addEventListener("DOMContentLoaded", () => {
  //  check mouse for click vs drag
  let mouseDownPos: { x: number; y: number } | null = null;
  let mouseMoved = false;

  // container to load the image
  const container = document.getElementById("scene-container") as HTMLElement;

  // actual file that being uploaded
  const fileInput = document.getElementById(
    "panoramaInput"
  ) as HTMLInputElement;

  // button to export 360 (json with info about hotspots)
  const export360Btn = document.getElementById("export360");

  // button to export current view
  const exportCurrentViewBtn = document.getElementById("exportCurrentView");

  console.log("scene-container and file input!");

  initScene(container);

  // If user changes the input image
  fileInput?.addEventListener("change", handleFileUpload);

  export360Btn?.addEventListener("click", () => {
    console.log("Clicked on export 360");
    const json = JSON.stringify(hotspotData, null, 2);
    const blob = new Blob([json], { type: "application/json" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "hotspots.json";
    link.click();
  });

  exportCurrentViewBtn?.addEventListener("click", () => {
    console.log("clicked on export current");

    // render scene to img
    renderer.render(scene, camera);
    const sceneURL = renderer.domElement.toDataURL("image/png");

    // arrange canvas with visible hotspots
    const width = renderer.domElement.width;
    const height = renderer.domElement.height;
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

      hotspotData.forEach((hotspot) => {
        const pos = new THREE.Vector3(
          hotspot.position.x,
          hotspot.position.y,
          hotspot.position.z
        );
        if (!frustum.containsPoint(pos)) return; // point isnt visible

        // 3d position to 2d position
        // Project the 3d position into normalized coordinaces.
        // Afrer projection posScene.x and .y are between [-1, 1]
        // -1,-1 is bottom left and 1,1 is top right of screen
        const posScene = pos.clone().project(camera);

        // convert the normalized coordinates to screen pixels
        // this formula converts from [-1,1] to [0,1]
        // -1 => 0 ; 0 => 0.5 ; 1 => 1
        const x = (posScene.x * 0.5 + 0.5) * width;
        const y = (1 - (posScene.y * 0.5 + 0.5)) * height;

        // draw icon on the position
        ctx.font = "32px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = "#222";
        ctx.lineWidth = 4;
        ctx.strokeText(hotspot.label, x, y);
        ctx.fillStyle = "#fff";
        ctx.fillText(hotspot.label, x, y);
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

    // mouse move drag controls
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

    // labels 
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
    // get the first file upload
    const file = fileInput.files?.[0];
    if (!file) return;

    console.log("File selected:", file.name, file.type);

    const reader = new FileReader(); 
    reader.onload = function (event) {
      // data url representing the image's file
      const imageUrl = event.target?.result as string;

      console.log("Image loaded as URL");
      applyPanoramaImage(imageUrl);
    };
    
    // if we have error reading the file
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

    // resize renderer and camera (get size of container)
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    renderer.setSize(width, height); // resize to fix container
    camera.aspect = width / height; // update camera aspect to match the new size
    camera.updateProjectionMatrix();

    // load the img 
    const loader = new THREE.TextureLoader().load(imageSrc, () => {
      if (sphereMesh) scene.remove(sphereMesh);

      console.log("Texture loaded");

      // creating the space for image (500 radius, 60,40 - width/height)
      const geometry = new THREE.SphereGeometry(500, 60, 40);
      geometry.scale(-1, 1, 1); // visualisation from inside (x axis)

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
    if (!sphereMesh) return;

    // rectangle of the renderers canvas - map mouse coords 
    const rect = renderer.domElement.getBoundingClientRect();

    // convert mouse position to normalized coords
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // create ray to the scene by mouse pointer
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(sphereMesh);
    if (intersects.length === 0) return;

    const point = intersects[0].point; // point of 3d coords on sphere surface

    const id = crypto.randomUUID();
    const label = selectedHotspotType === "shield" ? "🛡" : "⚔";
    addHotspot(id, selectedHotspotType, label, point);
  }

  function addHotspot(
    id: string,
    type: "shield" | "sword",
    label: string,
    position: THREE.Vector3
  ) {
    // create new div for hotspot marker
    const div = document.createElement("div");
    div.className = "hotspot";
    
    // created span with class for style and update icons
    div.innerHTML = `<span class="icon">${
      type === "shield" ? "🛡" : "⚔"
    }</span>`;
    div.title = label;


    if (type === "sword") {
      div.addEventListener("click", (e) => {
        // prevent editing if the icon is locked
        if (div.hasAttribute("data-locked")) return;

        e.stopPropagation(); // disable option for clicking on it

        // Show edit popup next to the icon
        const popup = document.getElementById("icon-edit-popup")!;
        popup.classList.remove("hidden");

        // Position popup near mouse
        popup.style.left = `${e.clientX + 10}px`;
        popup.style.top = `${e.clientY + 10 + window.scrollY}px`;

        const handler = (ev: MouseEvent) => {
          const target = ev.target as HTMLElement;
          const newIcon = target.dataset.icon;
          if (!newIcon) return;

          // update hotspots icon
          div.querySelector(".icon")!.textContent = newIcon;
          div.title = newIcon;
          div.setAttribute("data-locked", "true");

          popup.classList.add("hidden");

          // remove the event listener
          popup.querySelectorAll("button").forEach((btn) => {
            btn.removeEventListener("click", handler);
          });
        };

        popup.querySelectorAll("button").forEach((btn) => {
          btn.addEventListener("click", handler);
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
});
