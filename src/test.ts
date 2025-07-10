import * as THREE from "three";

// === Same functions as in your main file ===

function convert3Dto2D(
  x: number,
  y: number,
  z: number,
  camera: THREE.PerspectiveCamera
): { x: number; y: number } {
  const worldVector = new THREE.Vector3(x, y, z);
  const projected = worldVector.project(camera);

  return {
    x: ((projected.x + 1) / 2) * 100,
    y: ((-projected.y + 1) / 2) * 100,
  };
}

function convert2Dto3D(
  xPercent: number,
  yPercent: number,
  camera: THREE.PerspectiveCamera,
  radius = 500
): { x: number; y: number; z: number } {
  const ndcX = (xPercent / 100) * 2 - 1;
  const ndcY = -((yPercent / 100) * 2 - 1);

  const ndc = new THREE.Vector3(ndcX, ndcY, 0.5);
  const direction = ndc.unproject(camera).sub(camera.position).normalize();

  const position = direction.multiplyScalar(radius);
  return {
    x: position.x,
    y: position.y,
    z: position.z,
  };
}

// === The Actual Unit Test ===

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

  // IF THE COORDINATES RETURN, SO SHALL HE
  if (error < 1) {
    console.log("Round-trip test passed. Error:", error.toFixed(4));
    } else {
    console.error("Round-trip failed. Error:", error.toFixed(4));
    throw new Error(`Round-trip error too large: ${error}`);
    }
}


// Run the test
testRoundTrip();
