// ═══════════════════════════════════════════════════════════════
// renderer.js — Three.js 초기화 (렌더러, 씬, 카메라, 조명)
// ═══════════════════════════════════════════════════════════════
import { G } from './game.js';

// ─── 렌더러 ──────────────────────────────────────────────────
const canvas3d = document.getElementById('c3d');
const renderer = new THREE.WebGLRenderer({canvas:canvas3d, antialias:true});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth, innerHeight);

// ─── 씬 & 카메라 ─────────────────────────────────────────────
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth/innerHeight, 0.5, 400);
scene.background = new THREE.Color(0x7ec8e3);
scene.fog = new THREE.Fog(0x7ec8e3, 55, 120);

// ─── exteriorRoot 그룹 (실외 오브젝트 토글용) ───────────────
const exteriorRoot = new THREE.Group();
scene.add(exteriorRoot);

// ─── 조명 ────────────────────────────────────────────────────
const ambLight = new THREE.AmbientLight(0xfff4e8, 0.55);
scene.add(ambLight);
const sunLight = new THREE.DirectionalLight(0xfff0d0, 1.0);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048,2048);
sunLight.shadow.camera.left=-80; sunLight.shadow.camera.right=80;
sunLight.shadow.camera.top=80;   sunLight.shadow.camera.bottom=-80;
sunLight.shadow.camera.far=200;  sunLight.shadow.bias=-0.0005;
scene.add(sunLight); scene.add(sunLight.target);
const moonLight = new THREE.DirectionalLight(0x8090c0, 0.0);
moonLight.position.set(-30,50,-30); scene.add(moonLight);

// ─── G에 등록 ────────────────────────────────────────────────
G.scene = scene;
G.camera = camera;
G.renderer = renderer;
G.exteriorRoot = exteriorRoot;
G.ambLight = ambLight;
G.sunLight = sunLight;
G.moonLight = moonLight;

// ─── 창 크기 변경 ────────────────────────────────────────────
window.addEventListener('resize', ()=>{
  renderer.setSize(innerWidth,innerHeight);
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
});

// ─── 헬퍼 ────────────────────────────────────────────────────
export function mat(hex, rough=0.9, metal=0, trans=false, op=1){
  return new THREE.MeshLambertMaterial({color:hex,transparent:trans,opacity:op});
}
export function mesh(geo,hex,shadow=true){
  const m=new THREE.Mesh(geo,mat(hex));
  if(shadow){m.castShadow=true;m.receiveShadow=true;}
  return m;
}
export function disposeMesh(obj){
  if(!obj) return;
  obj.traverse(c=>{if(c.isMesh){c.geometry?.dispose();c.material?.dispose();}});
}
