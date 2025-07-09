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
