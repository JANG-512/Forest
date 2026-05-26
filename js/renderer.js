// ═══════════════════════════════════════════════════════════════
// renderer.js — Three.js 초기화 (렌더러, 씬, 카메라, 조명)
// ═══════════════════════════════════════════════════════════════
import { G } from './game.js';

// ─── 렌더러 ──────────────────────────────────────────────────
const canvas3d = document.getElementById('c3d');
const renderer = new THREE.WebGLRenderer({canvas:canvas3d, antialias:true, alpha:false});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth, innerHeight);
// ACES Filmic Tone Mapping & sRGB Color Space 적용 (아기자기한 색감 극대화)
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
if (renderer.outputColorSpace !== undefined) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
} else if (renderer.outputEncoding !== undefined) {
  renderer.outputEncoding = THREE.sRGBEncoding;
}

// ─── 씬 & 카메라 ─────────────────────────────────────────────
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, innerWidth/innerHeight, 0.5, 400);
scene.background = new THREE.Color(0xa7ddf2);
scene.fog = new THREE.Fog(0xa7ddf2, 42, 96);

// ─── exteriorRoot 그룹 (실외 오브젝트 토글용) ───────────────
const exteriorRoot = new THREE.Group();
scene.add(exteriorRoot);

// ─── 조명 ────────────────────────────────────────────────────
// 따뜻하고 자연스러운 조명 조합 (Ambient 살구빛 + Hemisphere 하늘빛/지면 반사광)
const ambLight = new THREE.AmbientLight(0xffead6, 0.26);
scene.add(ambLight);
const hemiLight = new THREE.HemisphereLight(0xc8f1ff, 0xcaa36b, 0.86);
scene.add(hemiLight);
const sunLight = new THREE.DirectionalLight(0xfff1cf, 1.42);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048,2048);
sunLight.shadow.camera.left=-18; sunLight.shadow.camera.right=18;
sunLight.shadow.camera.top=18;   sunLight.shadow.camera.bottom=-18;
sunLight.shadow.camera.near=1;
sunLight.shadow.camera.far=120;
sunLight.shadow.bias=-0.00035;
sunLight.shadow.normalBias=0.035;
scene.add(sunLight); scene.add(sunLight.target);
const moonLight = new THREE.DirectionalLight(0x8090c0, 0.0);
moonLight.position.set(-30,50,-30); scene.add(moonLight);

// ─── G에 등록 ────────────────────────────────────────────────
G.scene = scene;
G.camera = camera;
G.renderer = renderer;
G.exteriorRoot = exteriorRoot;
G.ambLight = ambLight;
G.hemiLight = hemiLight;
G.sunLight = sunLight;
G.moonLight = moonLight;

// ─── 창 크기 변경 ────────────────────────────────────────────
window.addEventListener('resize', ()=>{
  renderer.setSize(innerWidth,innerHeight);
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
});

// ─── 헬퍼 ────────────────────────────────────────────────────
export function mat(hex, rough=0.32, metal=0.12, trans=false, op=1){
  return new THREE.MeshStandardMaterial({color:hex,roughness:rough,metalness:metal,transparent:trans,opacity:op});
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
