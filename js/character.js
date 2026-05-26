// ══════════════════════════════════════════════════════════
// character.js — 캐릭터 3D 모델 빌더 (치비 피규어 스타일 업그레이드)
// ══════════════════════════════════════════════════════════
import { G } from './game.js';
import { mat, mesh, disposeMesh } from './renderer.js';
import { T, INTERACTABLE } from './config.js';
import { TEXTURES } from './textures.js';
import { getRoundedBoxGeometry } from './world.js';

// 어떤 player도 공유할 수 있는 빌더 (tint: 헤어 색상으로 구분)
export function buildCharacter(skinC, shirtC, pantsC, hairC, shoeC, limbsOut, isNPC=false) {
  const g = new THREE.Group();
  
  // 비주얼 요소들을 따로 묶는 그룹 (애니메이션 bobbing용)
  const visualGroup = new THREE.Group();
  g.add(visualGroup);
  g.userData.visualGroup = visualGroup;

  // ── 접지 그림자 블롭 (Contact Shadow Blob) ──
  // NormalBlending을 사용하여 외곽선이 완벽히 투명해지도록 수정 (검은 네모 제거!)
  if (TEXTURES.shadowBlob) {
    const shadowGeom = new THREE.PlaneGeometry(0.72, 0.72);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: TEXTURES.shadowBlob,
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    });
    const shadowMesh = new THREE.Mesh(shadowGeom, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.005; // 지면보다 아주 살짝 위
    shadowMesh.userData.isShadow = true;
    g.add(shadowMesh);
    g.userData.shadowMesh = shadowMesh;
  }

  // ── 다리 피벗 (엉덩이 = y 0.45로 인하) ──
  [[-0.12,0],[0.12,1]].forEach(([sx,i])=>{
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.45, 0);
    // 허벅지+정강이 (둥글고 포근한 넨도로이드 다리)
    const legGeo = getRoundedBoxGeometry(0.15, 0.26, 0.15, 0.03, 2);
    const leg = new THREE.Mesh(legGeo, mat(pantsC, 0.6));
    leg.position.y = -0.13; leg.castShadow = true; leg.receiveShadow = true;
    pivot.add(leg);
    
    // 신발
    const shoeGeo = getRoundedBoxGeometry(0.18, 0.08, 0.25, 0.02, 2);
    const shoe = new THREE.Mesh(shoeGeo, mat(shoeC, 0.5));
    shoe.position.set(0.02, -0.28, 0.03); shoe.castShadow = true;
    pivot.add(shoe);
    
    visualGroup.add(pivot);
    if(i===0) limbsOut.leftLeg=pivot; else limbsOut.rightLeg=pivot;
  });

  // ── 몸통 (납작둥글 항아리 넨도로이드 체형) ──
  const bodyGeo = getRoundedBoxGeometry(0.48, 0.42, 0.36, 0.08, 3);
  const body = new THREE.Mesh(bodyGeo, mat(shirtC, 0.65));
  body.position.y = 0.66;
  body.castShadow = true; body.receiveShadow = true;
  visualGroup.add(body);

  // ── 칼라 깃 (Collar) 데코 ──
  const collarGeo = getRoundedBoxGeometry(0.16, 0.04, 0.26, 0.01, 2);
  const collarL = new THREE.Mesh(collarGeo, mat(0xffffff, 0.6));
  collarL.position.set(-0.09, 0.88, 0.16); collarL.rotation.z = -0.15; collarL.rotation.y = 0.15; visualGroup.add(collarL);
  const collarR = new THREE.Mesh(collarGeo, mat(0xffffff, 0.6));
  collarR.position.set(0.09, 0.88, 0.16); collarR.rotation.z = 0.15; collarR.rotation.y = -0.15; visualGroup.add(collarR);

  // ── 팔 피벗 (어깨 = y 0.8로 인하) ──
  [[-0.28,0],[0.28,1]].forEach(([sx,i])=>{
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.8, 0);
    
    const arm = mesh(new THREE.CylinderGeometry(0.075,0.07,0.28,7), shirtC);
    arm.position.y=-0.14; arm.castShadow=true; pivot.add(arm);
    
    const hand = mesh(new THREE.SphereGeometry(0.08,8,6), skinC);
    hand.position.y=-0.3; hand.castShadow=true; pivot.add(hand);
    
    visualGroup.add(pivot);
    if(i===0) limbsOut.leftArm=pivot; else limbsOut.rightArm=pivot;
  });

  // ── 목 ──
  const neck = mesh(new THREE.CylinderGeometry(0.09,0.11,0.08,8), skinC);
  neck.position.y=0.89; neck.castShadow=true; visualGroup.add(neck);

  // ── 머리 (넨도로이드급 크고 둥글둥글) ──
  const head = mesh(new THREE.SphereGeometry(0.44,18,16), skinC);
  head.scale.set(1.08,1.02,1.08); head.position.y=1.28; head.castShadow = true;
  visualGroup.add(head);

  // ── 귀여운 코 ──
  const nose = mesh(new THREE.SphereGeometry(0.045, 6, 5), 0xffb59e, false);
  nose.position.set(0, 1.25, 0.43); visualGroup.add(nose);

  // ── 머리카락 (isNPC가 아닐 때만 - 입체감 레이어 보강) ──
  if(!isNPC) {
    const hairCap = mesh(new THREE.SphereGeometry(0.44,12,10), hairC);
    hairCap.scale.set(1.1,0.6,1.1); hairCap.position.set(0,1.52,0);
    hairCap.castShadow=true; visualGroup.add(hairCap);
    // 앞머리 (뭉실뭉실한 입체 가닥)
    [[-0.24, 1.45, 0.33, 0.15], [0, 1.42, 0.35, 0.16], [0.24, 1.45, 0.33, 0.15],
     [-0.12, 1.47, 0.34, 0.15], [0.12, 1.47, 0.34, 0.15]].forEach(([hx, hy, hz, r], bi)=>{
      const lock = mesh(new THREE.SphereGeometry(r,8,6), hairC);
      lock.position.set(hx, hy, hz);
      lock.scale.set(1, 1.2, 0.9);
      lock.castShadow=true; visualGroup.add(lock);
    });
    // 옆머리
    [-1,1].forEach(side=>{
      const sh = mesh(new THREE.SphereGeometry(0.15,7,5), hairC);
      sh.position.set(side*0.4, 1.25, 0.08);
      sh.scale.set(0.8, 1.4, 0.9);
      sh.castShadow=true; visualGroup.add(sh);
    });
  }

  // ── 눈 (이중 하이라이트 글레이즈 안구) ──
  [-0.17,0.17].forEach((ex,ei)=>{
    const ew = mesh(new THREE.SphereGeometry(0.1,9,8), 0xffffff, false);
    ew.scale.set(0.88,1.12,0.52); ew.position.set(ex,1.31,0.39); visualGroup.add(ew);
    const iris = mesh(new THREE.SphereGeometry(0.068,8,6), 0x2255cc, false);
    iris.scale.set(0.88,1.12,0.46); iris.position.set(ex,1.31,0.42); visualGroup.add(iris);
    const pupil = mesh(new THREE.SphereGeometry(0.04,6,5), 0x111111, false);
    pupil.scale.set(0.88,1.12,0.42); pupil.position.set(ex,1.31,0.428); visualGroup.add(pupil);
    
    // 이중 광채
    const hl1 = mesh(new THREE.SphereGeometry(0.018,5,4), 0xffffff, false);
    hl1.position.set(ex+0.024,1.35,0.438); visualGroup.add(hl1);
    const hl2 = mesh(new THREE.SphereGeometry(0.009,4,3), 0xffffff, false);
    hl2.position.set(ex-0.02,1.27,0.438); visualGroup.add(hl2);

    // 둥근 눈썹
    const browGeo = getRoundedBoxGeometry(0.12, 0.024, 0.04, 0.006, 2);
    const brow = new THREE.Mesh(browGeo, mat(hairC));
    brow.position.set(ex,1.44,0.37); brow.rotation.z=ex<0?0.18:-0.18; visualGroup.add(brow);
  });

  // ── 볼터치 & 벌 쏘임 팽창 ──
  [-0.25,0.25].forEach(cx=>{
    const isStungCheek = (cx < 0) && (isNPC === false) && G.playerStung;
    const cheekC = isStungCheek ? 0xff6666 : 0xffaaaa;
    const cheek = mesh(new THREE.SphereGeometry(isStungCheek ? 0.18 : 0.08, 9, 7), cheekC, false);
    if(isStungCheek){
      cheek.scale.set(1.8, 1.4, 0.9);
      cheek.position.set(cx - 0.05, 1.15, 0.42);
    } else {
      cheek.scale.set(1.35,0.62,0.38);
      cheek.position.set(cx, 1.19, 0.38);
    }
    visualGroup.add(cheek);
  });

  // ── 입 ──
  const smile = mesh(new THREE.TorusGeometry(0.06,0.02,6,10,Math.PI), 0xcc7755, false);
  smile.rotation.z=Math.PI; smile.position.set(0,1.16,0.42); visualGroup.add(smile);

  // ── 귀 (isNPC가 아닐 때만) ──
  if(!isNPC) {
    [-1,1].forEach(side=>{
      const ear = mesh(new THREE.SphereGeometry(0.09,8,6), skinC);
      ear.scale.set(0.44,0.86,0.86); ear.position.set(side*0.42,1.26,0);
      ear.castShadow=true; visualGroup.add(ear);
    });
  }

  // 카툰 외곽선(Cartoon Outline) 적용
  applyCartoonOutline(visualGroup);

  g.castShadow = true;
  return g;
}

function applyCartoonOutline(group) {
  const outlines = [];
  group.traverse(c => {
    if (c.isMesh && c.geometry && !c.userData.isOutline && !c.userData.isShadow) {
      const color = c.material.color ? c.material.color.getHex() : 0;
      // 눈자(0xffffff), 볼터치(0xffaaaa/0xff6666), 입/씨방(0xffcc00/0xffee88) 등은 카툰 아웃라인 제외
      if (color === 0xffffff || color === 0xffaaaa || color === 0xff6666 || color === 0xffee88 || color === 0xffcc00) {
        return;
      }
      
      const outlineGeom = c.geometry.clone();
      const outlineMat = new THREE.MeshBasicMaterial({
        color: 0x2b1e15, // 따뜻한 다크 브라운 외곽선
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.95
      });
      const outlineMesh = new THREE.Mesh(outlineGeom, outlineMat);
      outlineMesh.position.copy(c.position);
      outlineMesh.rotation.copy(c.rotation);
      outlineMesh.scale.copy(c.scale).multiplyScalar(1.085);
      outlineMesh.userData.isOutline = true;
      outlines.push({parent: c.parent || group, mesh: outlineMesh});
    }
  });
  outlines.forEach(o => o.parent.add(o.mesh));
}

export function buildPlayer() {
  if(G.playerMesh){ G.scene.remove(G.playerMesh); disposeMesh(G.playerMesh); }
  Object.keys(G.playerLimbs).forEach(k=>delete G.playerLimbs[k]);
  // 플레이어는 항상 보임 → scene에 직접 추가 (exteriorRoot 아님)
  G.playerMesh = buildCharacter(0xfde0b8, 0x5ba3e0, 0x3a5f8a, 0x5c3317, 0x3a2a1a, G.playerLimbs);
  G.scene.add(G.playerMesh);
  if(typeof window.updatePlayerToolMesh === 'function') {
    window.updatePlayerToolMesh();
  }
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
