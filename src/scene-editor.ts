import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface Hotspot {
  id: string;
  type: 'shield' | 'sword';
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


// let loader = new THREE.TextureLoader();

// When user clicks on any of the elements on this page
document.addEventListener('DOMContentLoaded', () => {
    // container to load the image
    const container = document.getElementById('scene-container') as HTMLElement;
    // actual file that being uploaded
    const fileInput = document.getElementById('panoramaInput') as HTMLInputElement;

    // button to export 360
    const export360Btn = document.getElementById('export360');
    // button to export current view
    // const exportCurrentViewBtn = document.getElementById('exportCurrentView');

    console.log("scene-container and file input!");

    initScene(container);

    // If user changes the input image
    fileInput?.addEventListener('change', handleFileUpload);

    // click on 360
    export360Btn?.addEventListener('click', () => {
        console.log("Clicked on export 360");

    });


    function initScene(container: HTMLElement) {
        console.log("INSIDE INIT SCENE");
        scene = new THREE.Scene();

        aspect = container.clientWidth / container.clientHeight;
        camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        camera.position.set(0,0,0.1);

        renderer = new THREE.WebGLRenderer();
        renderer.setSize(container.clientWidth, container.clientHeight);
        
        // loads the image on the page
        container.appendChild(renderer.domElement);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.minDistance = 10;
        controls.maxDistance = 80;


        renderer.domElement.addEventListener('click', onSceneClick);

        animate();
        console.log("SCENE INITIALIZE");
    }

    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }


    function handleFileUpload() {
        const file = fileInput.files?.[0];
        if (!file) return;

        console.log('File selected:', file.name, file.type);


        const reader = new FileReader();
        reader.onload = function (event) {
            const imageUrl = event.target?.result as string;
            
            console.log("Image loaded as URL");
            applyPanoramaImage(imageUrl);
        };
        reader.onerror = function (err) {
            console.error('FileReader error:', err);
        };

        console.log("READING FILE IMG!!");
        reader.readAsDataURL(file);
    }

    function applyPanoramaImage(imageSrc: string) {
        console.log('Applying panorama image');
        
        // show the scene container
        const container = document.getElementById('scene-container') as HTMLElement | null;
        if (!container) {
            console.warn('scene-container not found!');
            return;
        }      
        container.classList.add('visible');


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

            const material = new THREE.MeshBasicMaterial({map: loader });
            sphereMesh = new THREE.Mesh(geometry, material);
            scene.add(sphereMesh);

            // scroll to the bottom of the page after image loaded
            window.scrollTo({
                top: document.body.scrollHeight,  
                behavior: 'smooth'               
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
        if (intersects.length === 0)  return; 
        {
            const point = intersects[0].point;
            const id = crypto.randomUUID();
            addHotspot(id, 'shield', 'Shield', point)
        }
    }

    function addHotspot(id: string, type: 'shield' | 'sword', label: string, position: THREE.Vector3) {
        const geometry = new THREE.SphereGeometry(5, 8, 8);
        const material = new THREE.MeshBasicMaterial({
        color: type === 'shield' ? 0x00ffff : 0xff3333,
        });
        const marker = new THREE.Mesh(geometry, material);
        marker.position.copy(position);
        scene.add(marker);

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

