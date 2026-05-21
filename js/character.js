// ═══════════════════════════════════════════════════════════════
// character.js — 캐릭터 빌더 & 애니메이션 & 인터랙션 마커
// ═══════════════════════════════════════════════════════════════
import { G } from './game.js';
import { CS } from './config.js';
import { mat, mesh, disposeMesh } from './renderer.js';
import { getTile, tileH } from './world.js';
import { T, INTERACTABLE } from './config.js';

// 어떤 player도 공유할 수 있는 빌더 (tint: 헤어 색상으로 구분)
export function buildCharacter(skinC, shirtC, pantsC, hairC, shoeC, limbsOut) {
  const g = new THREE.Group();

  // ── 다리 피벗 (엉덩이 = y 0.5) ──
  [[-0.12,0],[0.12,1]].forEach(([sx,i])=>{
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.5, 0);
    // 허벅지+정강이
    const leg = mesh(new THREE.BoxGeometry(0.165,0.34,0.165), pantsC);
    leg.position.y = -0.17;  leg.castShadow=false; pivot.add(leg);
    // 신발
    const shoe = mesh(new THREE.BoxGeometry(0.2,0.1,0.3), shoeC);
    shoe.position.set(0.02, -0.37, 0.04); shoe.castShadow=false; pivot.add(shoe);
    g.add(pivot);
    if(i===0) limbsOut.leftLeg=pivot; else limbsOut.rightLeg=pivot;
  });

  // ── 몸통 ──
  const body = mesh(new THREE.BoxGeometry(0.52,0.5,0.38), shirtC);
  body.position.y=0.75; g.add(body);

  // ── 팔 피벗 (어깨 = y 0.92) ──
  [[-0.32,0],[0.32,1]].forEach(([sx,i])=>{
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.92, 0);
    const arm = mesh(new THREE.CylinderGeometry(0.09,0.08,0.34,7), shirtC);
    arm.position.y=-0.17; arm.castShadow=false; pivot.add(arm);
    const hand = mesh(new THREE.SphereGeometry(0.09,8,6), skinC);
    hand.position.y=-0.37; hand.castShadow=false; pivot.add(hand);
    g.add(pivot);
    if(i===0) limbsOut.leftArm=pivot; else limbsOut.rightArm=pivot;
  });

  // ── 목 ──
  const neck = mesh(new THREE.CylinderGeometry(0.1,0.12,0.1,8), skinC);
  neck.position.y=1.02; neck.castShadow=false; g.add(neck);

  // ── 머리 (AC 특유의 크고 동글동글) ──
  const head = mesh(new THREE.SphereGeometry(0.44,14,12), skinC);
  head.scale.set(1,0.91,0.94); head.position.y=1.42; g.add(head);

  // ── 머리카락 ──
  const hairCap = mesh(new THREE.SphereGeometry(0.44,12,10), hairC);
  hairCap.scale.set(1.01,0.52,1.01); hairCap.position.set(0,1.71,0);
  hairCap.castShadow=false; g.add(hairCap);
  // 앞머리
  [-0.22,0,0.22].forEach((hx,bi)=>{
    const bang = mesh(new THREE.SphereGeometry(0.145,8,6), hairC);
    bang.position.set(hx, 1.55, 0.33-bi*0.01); bang.castShadow=false; g.add(bang);
  });
  // 옆머리
  [-1,1].forEach(side=>{
    const sh = mesh(new THREE.SphereGeometry(0.16,7,5), hairC);
    sh.position.set(side*0.39, 1.37, 0.08); sh.castShadow=false; g.add(sh);
  });

  // ── 눈 (흰자→홍채→동공→HL→눈썹) ──
  [-0.17,0.17].forEach((ex,ei)=>{
    const ew = mesh(new THREE.SphereGeometry(0.108,9,8), 0xffffff, false);
    ew.scale.set(0.88,1.12,0.52); ew.position.set(ex,1.42,0.38); g.add(ew);
    const iris = mesh(new THREE.SphereGeometry(0.072,8,6), 0x2255cc, false);
    iris.scale.set(0.88,1.12,0.46); iris.position.set(ex,1.42,0.41); g.add(iris);
    const pupil = mesh(new THREE.SphereGeometry(0.042,6,5), 0x111111, false);
    pupil.scale.set(0.88,1.12,0.42); pupil.position.set(ex,1.42,0.425); g.add(pupil);
    const hl = mesh(new THREE.SphereGeometry(0.02,5,4), 0xffffff, false);
    hl.position.set(ex+0.03,1.46,0.435); g.add(hl);
    // 눈썹
    const brow = mesh(new THREE.BoxGeometry(0.13,0.026,0.04), hairC, false);
    brow.position.set(ex,1.54,0.37); brow.rotation.z=ex<0?0.18:-0.18; g.add(brow);
  });

  // ── 볼터치 ──
  [-0.25,0.25].forEach(cx=>{
    const cheek = mesh(new THREE.SphereGeometry(0.08,7,5), 0xffaaaa, false);
    cheek.scale.set(1.35,0.62,0.38); cheek.position.set(cx,1.31,0.37); g.add(cheek);
  });

  // ── 입 ──
  const smile = mesh(new THREE.TorusGeometry(0.068,0.022,6,10,Math.PI), 0xcc7755, false);
  smile.rotation.z=Math.PI; smile.position.set(0,1.27,0.41); g.add(smile);

  // ── 귀 ──
  [-1,1].forEach(side=>{
    const ear = mesh(new THREE.SphereGeometry(0.11,8,6), skinC);
    ear.scale.set(0.44,0.86,0.86); ear.position.set(side*0.45,1.4,0);
    ear.castShadow=false; g.add(ear);
  });

  g.castShadow=true;
  return g;
}

export function buildPlayer() {
  if(G.playerMesh){ G.scene.remove(G.playerMesh); disposeMesh(G.playerMesh); }
  Object.keys(G.playerLimbs).forEach(k=>delete G.playerLimbs[k]);
  // 플레이어는 항상 보임 → scene에 직접 추가 (exteriorRoot 아님)
  G.playerMesh = buildCharacter(0xfde0b8, 0x5ba3e0, 0x3a5f8a, 0x5c3317, 0x3a2a1a, G.playerLimbs);
  G.scene.add(G.playerMesh);
}

// 걷기/달리기 애니메이션 공통함수
export function animateLimbs(limbs, moving, phaseOffset=0, running=false) {
  const speed  = running ? 0.010 : 0.0055;
  const swing  = moving  ? (running ? 0.78 : 0.55) : 0;
  const armSw  = moving  ? (running ? 0.68 : 0.44) : 0;
  const t = performance.now()*speed + phaseOffset;
  const decay = 0.82;
  if(!limbs.leftLeg) return;
  if(moving) {
    limbs.leftLeg.rotation.x  =  Math.sin(t)*swing;
    limbs.rightLeg.rotation.x = -Math.sin(t)*swing;
    if(limbs.leftArm){
      limbs.leftArm.rotation.x  = -Math.sin(t)*armSw;
      limbs.rightArm.rotation.x =  Math.sin(t)*armSw;
    }
  } else {
    limbs.leftLeg.rotation.x  *= decay;
    limbs.rightLeg.rotation.x *= decay;
    if(limbs.leftArm){
      // 숨쉬기 유휴 모션
      const breath = Math.sin(performance.now()*0.001)*0.018;
      limbs.leftArm.rotation.x  = breath;
      limbs.rightArm.rotation.x = breath;
    }
  }
}

// ─── 인터랙션 마커 ───────────────────────────────────────────
export function buildFacingMarker(){
  const rg=new THREE.RingGeometry(CS*0.42,CS*0.5,20);
  rg.rotateX(-Math.PI/2);
  const marker=new THREE.Mesh(rg,
    new THREE.MeshBasicMaterial({color:0xffee88,transparent:true,opacity:0.7,side:THREE.DoubleSide}));
  marker.position.y=0.12;
  G.scene.add(marker);
  G.facingMarkerMesh=marker;
}

export function facingTile(){
  const DIR_DELTA={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
  const d=DIR_DELTA[G.playerDir]||[0,1];
  const tx=Math.round(G.playerPos.x/CS)+d[0];
  const tz=Math.round(G.playerPos.z/CS)+d[1];
  return {x:tx,y:tz,t:getTile(tx,tz)};
}

export function updateFacingMarker(){
  const marker=G.facingMarkerMesh;
  if(!marker) return;
  // 실내에서는 마커 숨김
  if(G.inInterior){ marker.visible=false; return; }
  const ft=facingTile();
  if(INTERACTABLE.has(ft.t)||G.gs.world_dig_spots[`${ft.x},${ft.y}`]||
     getTile(ft.x,ft.y)===T.RIVER){
    marker.visible=true;
    marker.position.set(ft.x*CS, tileH(ft.x,ft.y)+0.08, ft.y*CS);
  } else { marker.visible=false; }
}
