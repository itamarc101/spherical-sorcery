// import { json } from "stream/consumers";
// import * as THREE from "three";

interface Hotspot {
  id: string;
  type: "shield" | "sword";
  label: string;
  position: {
    x: number; // percent
    y: number; // percent
  };
}

let hotspotData: Hotspot[] = [];

document.addEventListener("DOMContentLoaded", () => {
  console.log("hotspot-viewer.ts loaded");
  const imageInput = document.getElementById("imageInput") as HTMLInputElement;
  const jsonInput = document.getElementById(
    "jsonInput"
  ) as HTMLInputElement | null;

  console.log("imageInput:", imageInput);
  console.log("jsonInput:", jsonInput);

  if (!imageInput || !jsonInput) {
    return;
  }

  const viewImage = document.getElementById("viewerImage") as HTMLInputElement;
  const overlay = document.getElementById(
    "hotspot-overlay"
  ) as HTMLInputElement;

  // load image
  imageInput.addEventListener("change", () => {
    console.log("inside imageInput load image");
    const file = imageInput.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      viewImage.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    console.log("END Reading image");
  });

  // load hotspots json
  jsonInput.addEventListener("change", () => {
    const file = jsonInput.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        hotspotData = JSON.parse(reader.result as string);
        console.log("Parsed hotspots:", hotspotData);
        renderHotspots(hotspotData, overlay);
      } catch (e) {
        alert("invalid json");
      }
    };
    reader.readAsDataURL(file);
  });

  function renderHotspots(data: Hotspot[], overlay: HTMLElement) {
    overlay.innerHTML = ""; // clear previous
    console.log(`Rendering ${data.length} hotspots`);

    data.forEach((h) => {
      const div = document.createElement("div");
      div.className = "hotspot";
      div.title = h.label;
      div.innerText = h.type === "shield" ? "🛡" : "⚔";

      div.style.position = "absolute";
      div.style.left = `${h.position.x}%`;
      div.style.top = `${h.position.y}%`;
      div.style.transform = "translate(-50%, -50%)";

      overlay.appendChild(div);
    });
  }
});
