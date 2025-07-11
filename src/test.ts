import * as THREE from "three";
import { convert3Dto2D, convert2Dto3D} from "./hotspot-viewer";


// Setup camera from given JSON data
const camera = new THREE.PerspectiveCamera(
  75,                      // FOV
  1.180952380952381,       // aspect ratio
  1,                       // near
  1100                     // far
);

// Set camera position
camera.position.set(9.759905018119039, -1.0240279578143152, 1.9223997448266348);

// Set camera rotation (Euler angles in radians)
camera.rotation.set(0.48945018359679804, 1.3512231312247238, -0.47943481301862156);

// Update matrices after setting position and rotation
camera.updateProjectionMatrix();
camera.updateMatrixWorld(true);

// Hotspot position from JSON
const original = new THREE.Vector3(-456.03502278462554, 123.40480381121252, 161.54156120051422);


// Run round-trip test
function testRoundTripPoint(point: THREE.Vector3, camera: THREE.PerspectiveCamera) {
  // Project 3D point to 2D screen %
  const screenPos = convert3Dto2D(point.x, point.y, point.z, camera);

  // Convert 2D screen % back to 3D at the same radius (distance from camera)
  const radius = point.length(); // use distance from origin as radius
  const roundTrip = convert2Dto3D(screenPos.x, screenPos.y, camera, radius);

  // Calculate error distance between original and roundTrip point
  const error = point.distanceTo(new THREE.Vector3(roundTrip.x, roundTrip.y, roundTrip.z));

  // IF THE COORDINATES RETURN, SO SHALL HE
  if (error < 6) {
    console.log(`Camera move - Test passed. Error: ${error.toFixed(4)}`);
  } else {
    console.error(`Camera move - Test failed. Error: ${error.toFixed(4)}`);
    throw new Error(`Camera move -  error too large: ${error}`);
  }
}

// Run the test
testRoundTripPoint(original, camera);

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
    console.log("no camera move test passed. Error:", error.toFixed(4));
    } else {
    console.error("no camera move  failed. Error:", error.toFixed(4));
    throw new Error(`no camera move error too large: ${error}`);
    }
}


// Run the test
testRoundTrip();