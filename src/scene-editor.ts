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

// let isDragging = false;

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

// let loader = new THREE.TextureLoader();

// When user clicks on any of the elements on this page
document.addEventListener("DOMContentLoaded", () => {
  // container to load the image
  const container = document.getElementById("scene-container") as HTMLElement;
  // actual file that being uploaded
  const fileInput = document.getElementById(
    "panoramaInput"
  ) as HTMLInputElement;

  // button to export 360
  const export360Btn = document.getElementById("export360");
  // button to export current view
  // const exportCurrentViewBtn = document.getElementById('exportCurrentView');

  console.log("scene-container and file input!");

  initScene(container);

  // If user changes the input image
  fileInput?.addEventListener("change", handleFileUpload);

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

  // click on 360
  export360Btn?.addEventListener("click", () => {
    console.log("Clicked on export 360");
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

    renderer.domElement.addEventListener("click", onSceneClick);

    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(container.clientWidth, container.clientHeight);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0";
    labelRenderer.domElement.style.pointerEvents = "none";
    container.appendChild(labelRenderer.domElement);

    animate();
    console.log("SCENE INITIALIZE");
  }

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  function handleFileUpload() {
    const file = fileInput.files?.[0];
    if (!file) return;

    console.log("File selected:", file.name, file.type);

    const reader = new FileReader();
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
    container.classList.add("visible");

    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    const loader = new THREE.TextureLoader().load(imageSrc, () => {
      if (sphereMesh) scene.remove(sphereMesh);

      console.log("Texture loaded");

      const geometry = new THREE.SphereGeometry(500, 60, 40);
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
    if (!sphereMesh) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(sphereMesh);
    if (intersects.length === 0) return;

    const point = intersects[0].point;

    // Ask user which icon to place (🛡 or ⚔)
    // const type = prompt("Type 'shield' or 'sword':")?.toLowerCase();
    // if (type !== 'shield' && type !== 'sword') return;

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
    const div = document.createElement("div");
    div.className = "hotspot";
    div.innerHTML = `<span class="icon">${
      type === "shield" ? "🛡" : "⚔"
    }</span>`;
    div.title = label;

    if (type === "sword") {
      div.addEventListener("click", (e) => {
        if (div.hasAttribute("data-locked")) return;

        e.stopPropagation();

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

          div.querySelector(".icon")!.textContent = newIcon;
          div.title = newIcon;
          div.setAttribute("data-locked", "true");

          popup.classList.add("hidden");

          // Clean up
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

    // const geometry = new THREE.SphereGeometry(5, 8, 8);
    // const material = new THREE.MeshBasicMaterial({
    // color: type === 'shield' ? 0x00ffff : 0xff3333,
    // });
    // const marker = new THREE.Mesh(geometry, material);
    // marker.position.copy(position);
    // scene.add(marker);

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

    console.log(`🛠 Hotspot added: ${type}`, position);
  }
});
