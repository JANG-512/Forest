// ═══════════════════════════════════════════════════════════════
// world.js — 지형 데이터 & 3D 타일 빌더 (그래픽 대폭 업그레이드)
// ═══════════════════════════════════════════════════════════════
import { G } from './game.js';
import { T, WW, WH, CS, TILE_COLORS, TILE_HEIGHT, VILLAGERS, FRUIT_POOL, FOSSIL_POOL, ITEMS } from './config.js';
import { mat, mesh, disposeMesh } from './renderer.js';
import { initTextures, TEXTURES } from './textures.js';

const ISLAND_CX = WW/2, ISLAND_CY = WH/2;

function wIdx(x,y){return y*WW+x;}
export function setTile(x,y,t){ if(x>=0&&x<WW&&y>=0&&y<WH) G.world[wIdx(x,y)]=t; }
export function getTile(x,y){ if(x<0||x>=WW||y<0||y>=WH) return T.OCEAN; return G.world[wIdx(x,y)]; }
export function tileH(tx,tz){ return TILE_HEIGHT[getTile(tx,tz)]??0.08; }
export function rng(seed, n){ return ((seed*9301+49297*n)%233280)/233280; }

// ─── 3D 라운드 박스 지오메트리 헬퍼 ─────────────────────────────
function createRoundedBoxGeometry(width, height, depth, radius, smoothness) {
  const shape = new THREE.Shape();
  const eps = 0.00001;
  const radiusWidth = radius - eps;
  const radiusHeight = radius - eps;
  
  shape.absarc(-width/2 + radius, -depth/2 + radius, radius, Math.PI, Math.PI * 1.5);
  shape.absarc(width/2 - radius, -depth/2 + radius, radius, Math.PI * 1.5, Math.PI * 2);
  shape.absarc(width/2 - radius, depth/2 - radius, radius, 0, Math.PI * 0.5);
  shape.absarc(-width/2 + radius, depth/2 - radius, radius, Math.PI * 0.5, Math.PI);
  
  const extrudeSettings = {
    depth: height - radius * 2,
    bevelEnabled: true,
    bevelSegments: smoothness,
    steps: 1,
    bevelSize: radius,
    bevelThickness: radius,
    curveSegments: smoothness
  };
  
  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geom.center();
  geom.rotateX(Math.PI / 2);
  return geom;
}

const geomCache = new Map();
export function getRoundedBoxGeometry(w, h, d, r=0.08, smoothness=3) {
  const key = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}_${r.toFixed(3)}_${smoothness}`;
  if (!geomCache.has(key)) {
    geomCache.set(key, createRoundedBoxGeometry(w, h, d, r, smoothness));
  }
  return geomCache.get(key);
}

function variedTexture(tex, seed, repeat=1) {
  if(!tex) return null;
  const out = tex.clone();
  out.wrapS = THREE.RepeatWrapping;
  out.wrapT = THREE.RepeatWrapping;
  out.repeat.set(repeat, repeat);
  out.center.set(0.5, 0.5);
  out.offset.set(rng(seed, 201), rng(seed, 202));
  out.rotation = (rng(seed, 203)-0.5) * 0.35;
  out.needsUpdate = true;
  return out;
}

function createDoorAssembly({
  width=0.5, height=1.0, depth=0.06,
  doorColor=0x9a5f35, frameColor=0xf9f0d6, knobColor=0xffcc44,
  openDir=-1
} = {}) {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.68 });
  const doorMat = new THREE.MeshStandardMaterial({ color: doorColor, roughness: 0.72 });
  const knobMat = new THREE.MeshStandardMaterial({ color: knobColor, roughness: 0.35, metalness: 0.55 });

  const back = new THREE.Mesh(getRoundedBoxGeometry(width + 0.18, height + 0.18, depth * 1.4, 0.025, 2), frameMat);
  back.position.set(0, height / 2, -depth * 0.18);
  back.castShadow = true;
  back.receiveShadow = true;
  group.add(back);

  const pivot = new THREE.Group();
  pivot.position.set(-width / 2, height / 2, depth * 0.42);
  pivot.userData.isDoorPivot = true;
  pivot.userData.closedRotationY = 0;
  pivot.userData.openRotationY = openDir * Math.PI * 0.62;
  group.add(pivot);

  const panel = new THREE.Mesh(getRoundedBoxGeometry(width, height, depth, 0.025, 3), doorMat);
  panel.position.set(width / 2, 0, 0);
  panel.castShadow = true;
  panel.receiveShadow = true;
  panel.userData.isDoorPanel = true;
  pivot.add(panel);

  const inset = new THREE.Mesh(getRoundedBoxGeometry(width * 0.58, height * 0.44, depth * 0.35, 0.015, 2), new THREE.MeshStandardMaterial({ color: 0x7b472a, roughness: 0.8 }));
  inset.position.set(width / 2, height * 0.08, depth * 0.58);
  inset.castShadow = true;
  pivot.add(inset);

  const knob = new THREE.Mesh(new THREE.SphereGeometry(width * 0.075, 8, 6), knobMat);
  knob.position.set(width * 0.82, -height * 0.03, depth * 0.95);
  knob.castShadow = true;
  pivot.add(knob);

  return group;
}

function createWelcomeMat(width=0.72, depth=0.42, color=0xd9b56c) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const rug = new THREE.Mesh(getRoundedBoxGeometry(width, 0.025, depth, 0.035, 2), mat);
  rug.position.y = 0.015;
  rug.receiveShadow = true;
  return rug;
}

function createTinyLantern(color=0xffefbf) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.55, 6), new THREE.MeshStandardMaterial({ color: 0x7a5234, roughness: 0.7 }));
  post.position.y = 0.28;
  post.castShadow = true;
  g.add(post);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.88 }));
  bulb.position.y = 0.62;
  g.add(bulb);
  return g;
}

// ─── 세계 생성 ───────────────────────────────────────────────
export function generateWorld() {
  const gs = G.gs;
  if(!G.world) G.world = new Uint8Array(WW*WH);
  const world = G.world;
  world.fill(T.OCEAN);
  
  // 섬 모양: 직사각형 느낌을 줄이기 위해 여러 파장 노이즈를 섞은 둥근 해안선
  for(let y=0;y<WH;y++) for(let x=0;x<WW;x++){
    const dx=(x-ISLAND_CX)/(WW*0.44), dy=(y-ISLAND_CY)/(WH*0.42);
    const n=Math.sin(x*0.38+y*0.31)*0.055+
            Math.cos(x*0.19-y*0.47)*0.05+
            Math.sin((x+y)*0.16)*0.035;
    if(dx*dx+dy*dy<1+n) setTile(x,y,T.BEACH);
  }
  // 내부 잔디: 해변과 맞닿는 부분이 완전히 반듯하지 않도록 노이즈 적용
  for(let y=0;y<WH;y++) for(let x=0;x<WW;x++){
    if(getTile(x,y)!==T.BEACH) continue;
    const dx=(x-ISLAND_CX)/(WW*0.42), dy=(y-ISLAND_CY)/(WH*0.40);
    const n=Math.sin(x*0.45+y*0.34)*0.045+Math.cos(y*0.29-x*0.2)*0.035;
    if(dx*dx+dy*dy<0.72+n) setTile(x,y,T.GRASS);
  }

  // 북쪽 고지대: 사각형 절벽 대신 완만한 타원형 능선으로 구성
  for(let y=4;y<16;y++) for(let x=8;x<40;x++){
    if(getTile(x,y)!==T.GRASS) continue;
    const ridgeDx=(x-24)/(15.2+Math.sin(y*0.7)*1.2);
    const ridgeDy=(y-10.4)/7.2;
    const ridgeNoise=Math.sin(x*0.55+y*0.25)*0.08+Math.cos(x*0.18)*0.05;
    if(ridgeDx*ridgeDx+ridgeDy*ridgeDy<1.0+ridgeNoise) setTile(x,y,T.CLIFF);
  }

  // 곡선형 강: 긴 직선 운하를 제거하고 자연스러운 S 커브로 흐르게 함
  const riverCenter = y => Math.round(23.6 + Math.sin((y-9)*0.34)*2.0 + Math.sin(y*0.13+1.7)*0.9);
  for(let y=8;y<40;y++){
    const cx=riverCenter(y);
    for(let w=0;w<2;w++){
      const rx=cx+w;
      if(getTile(rx,y)!==T.OCEAN) setTile(rx,y, y===15 ? T.WATERFALL : T.RIVER);
    }
    // 몇 군데는 강폭에 살짝 여유를 줘서 인공적인 2칸 직선 폭을 숨김
    if((y===21||y===22||y===31) && getTile(cx-1,y)!==T.OCEAN) setTile(cx-1,y,T.RIVER);
    if((y===18||y===34) && getTile(cx+2,y)!==T.OCEAN) setTile(cx+2,y,T.RIVER);
  }
  const bridgeY=25;
  const bridgeX=riverCenter(bridgeY);
  setTile(bridgeX,bridgeY,T.BRIDGE);
  setTile(bridgeX+1,bridgeY,T.BRIDGE);

  const setPathTile=(px,py)=>{
    const tt=getTile(px,py);
    if(tt===T.GRASS||tt===T.CLIFF||tt===T.BEACH) setTile(px,py,T.PATH);
  };
  const carvePath=(pts,width=0)=>{
    for(let i=0;i<pts.length-1;i++){
      const [x1,y1]=pts[i], [x2,y2]=pts[i+1];
      const steps=Math.max(Math.abs(x2-x1),Math.abs(y2-y1))*3;
      for(let s=0;s<=steps;s++){
        const t=s/steps;
        const wobble=Math.sin((i*17+s)*0.42)*0.22;
        const px=Math.round(x1+(x2-x1)*t + wobble);
        const py=Math.round(y1+(y2-y1)*t);
        for(let oy=-width;oy<=width;oy++) for(let ox=-width;ox<=width;ox++){
          if(Math.abs(ox)+Math.abs(oy)<=width+0.5) setPathTile(px+ox,py+oy);
        }
      }
    }
  };

  carvePath([[14,9],[19,9],[24,8],[31,9],[35,11]],0);
  carvePath([[bridgeX-2,bridgeY],[20,24],[17,22],[15,20]],0);
  carvePath([[bridgeX+3,bridgeY],[27,27],[28,31],[28,34]],0);
  carvePath([[25,18],[24,21],[bridgeX-1,bridgeY]],0);
  carvePath([[30,20],[32,24],[31,28]],0);

  // 건물 배치
  setTile(22,7,T.MUSEUM);  setTile(23,7,T.MUSEUM);
  setTile(28,7,T.SHOP);    setTile(29,7,T.SHOP);
  setTile(19,7,T.NOOK_HQ); setTile(20,7,T.NOOK_HQ);
  setTile(28,34,T.PLAYER_HOUSE);
  VILLAGERS.forEach(v=>{ setTile(v.pos[0],v.pos[1],T.VILLAGER_HOUSE); });

  // 나무 랜덤 배치
  const treeSeeds=[[12,20],[15,18],[17,23],[30,20],[34,18],[36,23],
                    [12,29],[15,27],[31,29],[34,27],[12,8],[16,10],[33,8],[37,10],
                    [13,12],[17,13],[31,12],[35,13],[24,30],[32,32],[21,28]];
  treeSeeds.forEach(([tx,ty])=>{
    if(getTile(tx,ty)===T.GRASS||getTile(tx,ty)===T.CLIFF){
      setTile(tx,ty,T.TREE);
      const fr=FRUIT_POOL[Math.floor(Math.random()*FRUIT_POOL.length)];
      gs.world_trees[`${tx},${ty}`]={fruit:fr, grown:2, lastShake:0, shakeCount:0};
    }
  });
  // 꽃
  const flowerSpots=[[14,20],[16,21],[31,20],[33,21],[14,28],[33,28],
                      [20,18],[28,18],[20,26],[28,26],[18,10],[30,10],
                      [26,27],[29,28],[27,32],[30,33],[22,24],[25,23]];
  flowerSpots.forEach(([fx,fy])=>{
    if(getTile(fx,fy)===T.GRASS||getTile(fx,fy)===T.CLIFF){
      setTile(fx,fy,T.FLOWER);
      const fc=['🌸','🌼','🌺','🌻','💐'][Math.floor(Math.random()*5)];
      gs.world_flowers[`${fx},${fy}`]={type:fc, watered:false};
    }
  });
  // 발굴 지점
  const digSpots=[[15,22],[31,23],[17,30],[29,30],[20,12],[28,13]];
  digSpots.forEach(([dx2,dy2])=>{
    if(getTile(dx2,dy2)===T.GRASS||getTile(dx2,dy2)===T.CLIFF){
      const foss=FOSSIL_POOL[Math.floor(Math.random()*FOSSIL_POOL.length)];
      gs.world_dig_spots[`${dx2},${dy2}`]={fossil:foss, found:false};
    }
  });
  // 돌
  [[19,22],[26,21],[18,28],[32,27],[21,11],[27,12],[24,26],[35,24]].forEach(([rx,ry])=>{
    if(getTile(rx,ry)===T.GRASS||getTile(rx,ry)===T.CLIFF) setTile(rx,ry,T.ROCK);
  });
}

// ─── 지면 생성 ───────────────────────────────────────────────
export function buildGround() {
  initTextures();
  for(let y=0;y<WH;y++) for(let x=0;x<WW;x++) refreshTile(x,y);
}

export function refreshTile(x, y) {
  const key=`${x},${y}`;
  const old=G.tileMeshes.get(key);
  if(old){
    G.exteriorRoot.remove(old);
    disposeMesh(old);
    G.tileMeshes.delete(key);
    if (G.grassBlades) {
      G.grassBlades = G.grassBlades.filter(blade => blade.userData.tileKey !== key);
    }
  }
  const t=getTile(x,y);
  const h=TILE_HEIGHT[t]??0.08;
  const g=new THREE.Group();
  g.position.set(x*CS, 0, y*CS);

  const baseH = 0.22;
  let baseColorVal = TILE_COLORS[t] ?? 0x72bb53;
  const s = x * 1000 + y;

  // 1. 잔디 모자이크 색조 변화 구현
  if ([T.GRASS, T.TREE, T.FLOWER, T.ROCK, T.DIG_SPOT, T.CLIFF].includes(t)) {
    baseColorVal = 0x63b846;
  }

  // 2. 타일별 PBR 머티리얼 구성
  let tileMat;
  initTextures();

  if ([T.GRASS, T.TREE, T.FLOWER, T.ROCK, T.DIG_SPOT, T.CLIFF].includes(t)) {
    tileMat = new THREE.MeshStandardMaterial({
      color: baseColorVal,
      roughness: 0.76,
      metalness: 0.02,
      map: TEXTURES.grass,
      bumpMap: TEXTURES.grassBump,
      bumpScale: 0.006
    });
  } else if (t === T.BEACH) {
    tileMat = new THREE.MeshStandardMaterial({
      color: baseColorVal,
      roughness: 0.85,
      metalness: 0.02,
      map: variedTexture(TEXTURES.sand, s, 1)
    });
  } else if (t === T.PATH) {
    tileMat = new THREE.MeshStandardMaterial({
      color: 0x63b846,
      roughness: 0.78,
      metalness: 0.02,
      map: TEXTURES.grass,
      bumpMap: TEXTURES.grassBump,
      bumpScale: 0.005
    });
  } else {
    tileMat = mat(baseColorVal, 0.45, 0.08);
  }

  // HSL 색상 노이즈 주입 (자연스러운 그라데이션)
  if ([T.GRASS, T.TREE, T.FLOWER, T.ROCK, T.DIG_SPOT, T.CLIFF, T.BEACH, T.PATH].includes(t)) {
    const c = new THREE.Color(baseColorVal);
    const hsl = {};
    c.getHSL(hsl);
    const isGrassLike = [T.GRASS, T.TREE, T.FLOWER, T.ROCK, T.DIG_SPOT, T.CLIFF, T.PATH].includes(t);
    const hNoise = (rng(s, 11) - 0.5) * (isGrassLike ? 0.0003 : 0.006);
    const sNoise = (rng(s, 12) - 0.5) * (isGrassLike ? 0.001 : 0.014);
    const lNoise = (rng(s, 13) - 0.5) * (isGrassLike ? 0.001 : 0.014);
    c.setHSL(
      Math.max(0, Math.min(1, hsl.h + hNoise)),
      Math.max(0, Math.min(1, hsl.s + sNoise)),
      Math.max(0, Math.min(1, hsl.l + lNoise))
    );
    tileMat.color.copy(c);
  }

  // 3. 평지는 내부 bevel 격자가 보이지 않도록 얇은 지면 평면으로 생성
  // 절벽 옆면/다리/건물 같은 실제 높이 요소에만 별도 입체 지오메트리를 사용
  if (t !== T.OCEAN && t !== T.RIVER && t !== T.WATERFALL && t !== T.BRIDGE) {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(CS, CS, 1, 1), tileMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = h + 0.002;
    ground.receiveShadow = true;
    ground.castShadow = false;
    g.add(ground);
  }

  // 4. 세부 장식 배치
  addTileDecor(g, t, x, y, h);

  G.exteriorRoot.add(g);
  G.tileMeshes.set(key, g);
}

function addLifestyleProps(g, t, x, y, h, s) {
  const propTiles = [T.GRASS, T.PATH, T.CLIFF, T.BEACH];
  if(!propTiles.includes(t)) return;

  const place = (obj, ox=0, oz=0, rot=0) => {
    obj.position.set(ox, h, oz);
    obj.rotation.y = rot;
    g.add(obj);
  };

  const fixed = `${x},${y}`;
  if(fixed === '27,29') place(createSmallTable(), -0.16, 0.08, -0.2);
  else if(fixed === '29,29') place(createCampingChair(), 0.05, -0.05, Math.PI * 0.92);
  else if(fixed === '26,30') place(createFishingRod(), 0.12, 0.02, -0.6);
  else if(fixed === '30,31') place(createFlowerPot(), -0.18, -0.08, 0.15);
  else if(fixed === '22,25') place(createSignboard(), 0.1, 0, Math.PI * 0.35);
  else if(fixed === '21,25') place(createWoodenFence(), 0, -0.12, Math.PI * 0.5);
  else if(fixed === '26,34') place(createMailbox(), 0.16, -0.12, -0.35);
  else if(fixed === '31,33') place(createLogSeat(), 0.06, 0.1, Math.PI * 0.15);

  // 카메라에 자주 들어오는 중경에는 작은 생활 소품을 드문드문 흩뿌린다.
  if(t===T.GRASS && y>=20 && y<=34 && x>=14 && x<=36) {
    const r = rng(s, 301);
    if(r < 0.018) place(createSmallTable(), (rng(s,302)-0.5)*0.35, (rng(s,303)-0.5)*0.35, rng(s,304)*Math.PI*2);
    else if(r < 0.036) place(createCampingChair(), (rng(s,305)-0.5)*0.35, (rng(s,306)-0.5)*0.35, rng(s,307)*Math.PI*2);
  }
}

function addTileDecor(g, t, x, y, h) {
  const gs = G.gs;
  const s = x*1000+y;
  initTextures();

  addLifestyleProps(g, t, x, y, h, s);

  switch(t) {
    case T.OCEAN: case T.RIVER: case T.WATERFALL: {
      // 1. 공용 물 셰이더 메쉬 부착
      if (TEXTURES.waterMaterial) {
        const rp = new THREE.Mesh(new THREE.PlaneGeometry(CS * 1.005, CS * 1.005, 5, 5), TEXTURES.waterMaterial);
        rp.rotation.x = -Math.PI / 2;
        rp.position.y = h + 0.04;
        rp.receiveShadow = true;
        g.add(rp);
      }

      // 물가 포말은 물 타일 전체 격자가 아니라 실제 땅/다리와 맞닿는 가장자리에만 표시
      const foamMat = new THREE.MeshBasicMaterial({
        color: 0xf6fffb,
        transparent: true,
        opacity: t === T.OCEAN ? 0.22 : 0.34,
        depthWrite: false
      });
      const foamDirs = [
        {dx:0,dz:1, px:0, pz:CS/2-0.035, w:CS*0.72, d:0.075, rot:0},
        {dx:0,dz:-1,px:0, pz:-CS/2+0.035,w:CS*0.72, d:0.075, rot:0},
        {dx:1,dz:0, px:CS/2-0.035, pz:0, w:0.075, d:CS*0.72, rot:0},
        {dx:-1,dz:0,px:-CS/2+0.035,pz:0, w:0.075, d:CS*0.72, rot:0}
      ];
      foamDirs.forEach(fd=>{
        const nt=getTile(x+fd.dx,y+fd.dz);
        if(nt!==T.OCEAN&&nt!==T.RIVER&&nt!==T.WATERFALL){
          const foam=new THREE.Mesh(new THREE.PlaneGeometry(fd.w, fd.d), foamMat.clone());
          foam.rotation.x=-Math.PI/2;
          foam.position.set(fd.px, h+0.055, fd.pz);
          foam.material.opacity += rng(s + fd.dx*17 + fd.dz*29, 2) * 0.08;
          g.add(foam);
        }
      });
      
      // 폭포 물리 메쉬 (수직 낙하)
      if(t === T.WATERFALL && TEXTURES.waterMaterial) {
        const wf = new THREE.Mesh(new THREE.PlaneGeometry(CS * 0.62, 0.9), TEXTURES.waterMaterial);
        wf.position.set(0, h + 0.45, -CS/2 + 0.02);
        g.add(wf);
      }
      break;
    }
    case T.BRIDGE: {
      if (TEXTURES.waterMaterial) {
        const waterUnder = new THREE.Mesh(new THREE.PlaneGeometry(CS * 1.005, CS * 1.005, 5, 5), TEXTURES.waterMaterial);
        waterUnder.rotation.x = -Math.PI / 2;
        waterUnder.position.y = (TILE_HEIGHT[T.RIVER] ?? -0.1) + 0.04;
        waterUnder.receiveShadow = true;
        g.add(waterUnder);
      }

      // 다리 아래 부드러운 타원 그림자 (NormalBlending으로 알파 페이드 지원)
      if (TEXTURES.shadowBlob) {
        const shGeo = new THREE.PlaneGeometry(CS * 1.2, CS * 1.2);
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.42, depthWrite: false, alphaTest: 0.02, color: 0x5a6388 });
        const sh = new THREE.Mesh(shGeo, shMat);
        sh.rotation.x = -Math.PI/2;
        sh.position.y = h - 0.08; // 물 밑 바닥에 투사
        sh.scale.set(1.35, 0.72, 1);
        g.add(sh);
      }

      // 둥글둥글하고 아늑한 나무 통나무 다리 (Wooden Log Bridge)
      const bridgeGroup = new THREE.Group();
      bridgeGroup.position.y = h + 0.08;
      
      const woodMat = new THREE.MeshStandardMaterial({ color: 0xbf8a4e, roughness: 0.78, metalness: 0.05 });
      const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x8b5b2e, roughness: 0.85 });

      // 다리 상판은 강을 가로지르는 방향으로 긴 목재 판자를 여러 개 놓는다
      const numLogs = 6;
      const logWidth = CS / numLogs;
      for (let i = 0; i < numLogs; i++) {
        const logOffset = -CS/2 + logWidth/2 + i * logWidth;
        const logGeo = getRoundedBoxGeometry(CS * 1.12, 0.16, logWidth * 0.88, 0.025, 2);
        const log = new THREE.Mesh(logGeo, woodMat);
        log.position.set(0, 0.08, logOffset);
        log.castShadow = true; log.receiveShadow = true;
        bridgeGroup.add(log);
      }

      // 네 개 모서리 난간 기둥 (Posts)
      const postRadius = 0.06;
      const postHeight = 0.52;
      const postGeo = getRoundedBoxGeometry(postRadius * 2, postHeight, postRadius * 2, 0.02, 2);
      
      const postPositions = [
        {x: -CS/2 + 0.1, z: -CS/2 + 0.1},
        {x: CS/2 - 0.1, z: -CS/2 + 0.1},
        {x: -CS/2 + 0.1, z: CS/2 - 0.1},
        {x: CS/2 - 0.1, z: CS/2 - 0.1}
      ];
      postPositions.forEach(pos => {
        const post = new THREE.Mesh(postGeo, darkWoodMat);
        post.position.set(pos.x, postHeight/2, pos.z);
        post.castShadow = true; post.receiveShadow = true;
        bridgeGroup.add(post);
      });

      // 앞뒤 수평 나무 손잡이 대 (Handrails)
      const railGeo = getRoundedBoxGeometry(CS, 0.06, 0.06, 0.02, 2);
      const railL = new THREE.Mesh(railGeo, darkWoodMat);
      railL.position.set(0, postHeight - 0.05, -CS/2 + 0.12);
      railL.castShadow = true;
      bridgeGroup.add(railL);

      const railR = new THREE.Mesh(railGeo, darkWoodMat);
      railR.position.set(0, postHeight - 0.05, CS/2 - 0.12);
      railR.castShadow = true;
      bridgeGroup.add(railR);

      g.add(bridgeGroup);
      break;
    }
    case T.BEACH: {
      // 신규 소라 껍데기 오브젝트
      if(rng(s,1) < 0.12){
        const shell = createSeashell();
        shell.position.set((rng(s,2)-.5)*CS*.6, h + 0.01, (rng(s,3)-.5)*CS*.6);
        shell.rotation.y = rng(s,4) * Math.PI * 2;
        g.add(shell);
      }
      
      // 해변 고정식 파라솔 / 돗자리 휴양지 세트
      if (x === 16 && y === 37) {
        const towel = createBeachTowel();
        towel.position.set(0, h, 0);
        g.add(towel);
        
        const umbrella = createBeachUmbrella();
        umbrella.position.set(0.4, h, 0.2);
        g.add(umbrella);
      } else if (rng(s, 5) < 0.035) {
        // 백사장 구역에 3.5% 확률로 파라솔 or 돗자리 배치
        if (rng(s, 6) < 0.5) {
          const towel = createBeachTowel();
          towel.position.set((rng(s,7)-.5)*0.2, h, (rng(s,8)-.5)*0.2);
          towel.rotation.y = rng(s,9) * Math.PI * 2;
          g.add(towel);
        } else {
          const umbrella = createBeachUmbrella();
          umbrella.position.set((rng(s,7)-.5)*0.2, h, (rng(s,8)-.5)*0.2);
          g.add(umbrella);
        }
      }
      break;
    }
    case T.CLIFF: {
      // 4개 방향에 대해 이웃 타일들의 높이를 동적으로 검사하여 알맞은 경계벽(Cliff Wall)과 덮개(Cap) 생성
      const dirs = [
        {dx: 0, dz: 1, rot: 0, px: 0, pz: CS/2},        // 남쪽 벽
        {dx: 0, dz: -1, rot: Math.PI, px: 0, pz: -CS/2},  // 북쪽 벽
        {dx: 1, dz: 0, rot: Math.PI/2, px: CS/2, pz: 0},  // 동쪽 벽
        {dx: -1, dz: 0, rot: -Math.PI/2, px: -CS/2, pz: 0} // 서쪽 벽
      ];
      dirs.forEach(d => {
        const nx = x + d.dx, ny = y + d.dz;
        const nH = tileH(nx, ny);
        if (nH < h - 0.2) {
          // 둥근 흙 벽 (Bevel 느낌)
          const wallGeo = getRoundedBoxGeometry(CS * 1.02, 0.76, 0.22, 0.05, 2);
          const wallMat = new THREE.MeshStandardMaterial({ color: 0x8b6540, roughness: 0.85, metalness: 0.05 });
          const clW = new THREE.Mesh(wallGeo, wallMat);
          clW.castShadow = true; clW.receiveShadow = true;
          clW.position.set(d.px - d.dx * 0.05, h - 0.38, d.pz - d.dz * 0.05);
          clW.rotation.y = d.rot;
          g.add(clW);
          
          // 절벽 상단의 둥근 잔디 덮개
          const capGeo = getRoundedBoxGeometry(CS * 1.06, 0.16, 0.26, 0.04, 2);
          const capMat = new THREE.MeshStandardMaterial({ color: 0x61b238, roughness: 0.72, map: TEXTURES.grass });
          const cap = new THREE.Mesh(capGeo, capMat);
          cap.castShadow = true; cap.receiveShadow = true;
          cap.position.set(d.px - d.dx * 0.03, h + 0.02, d.pz - d.dz * 0.03);
          cap.rotation.y = d.rot;
          g.add(cap);
        }
      });
      break;
    }
    case T.GRASS: {
      // 잔디는 바닥 텍스처만으로 끝내지 않고 화면 가까이에 작은 풀잎을 풍성하게 심는다
      if(rng(s,5)<0.42){
        if(!G.grassBlades) G.grassBlades = [];
        const key = `${x},${y}`;
        const bladeCount = 3 + Math.floor(rng(s, 6) * 3);
        for(let i=0;i<bladeCount;i++){
          const bladeColor = rng(s, i+70)>0.55 ? 0x7ac858 : (rng(s, i+71)>0.5 ? 0x5aad38 : 0x8fdc64);
          const blade=mesh(new THREE.CylinderGeometry(0.01,0.028,0.16+rng(s,i+10)*0.14,4),bladeColor,false);
          blade.position.set((rng(s,i+20)-.5)*CS*.7, h+0.09, (rng(s,i+30)-.5)*CS*.7);
          blade.rotation.y=rng(s,i+40)*Math.PI*2;
          blade.rotation.z=(rng(s,i+45)-0.5)*0.36;
          
          blade.userData.origRotX = blade.rotation.x;
          blade.userData.origRotZ = blade.rotation.z;
          blade.userData.windPhase = rng(s, i+50) * Math.PI * 2;
          blade.userData.tileKey = key;
          
          g.add(blade);
          G.grassBlades.push(blade);
        }
      }

      if(rng(s, 7)<0.16){
        const leafMat = new THREE.MeshStandardMaterial({ color: rng(s,8)>0.5?0x6fb646:0xa8d66a, roughness:0.82 });
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.055+rng(s,9)*0.035, 5, 4), leafMat);
        leaf.scale.set(1.8,0.25,0.8);
        leaf.position.set((rng(s,10)-.5)*CS*.72, h+0.035, (rng(s,11)-.5)*CS*.72);
        leaf.rotation.y=rng(s,12)*Math.PI*2;
        leaf.receiveShadow=true;
        g.add(leaf);
      }

      // 2. 수변(Shoreline) 조약돌 및 갈대 장식 자동 빌드
      const waterDirs = [
        {dx: 0, dz: 1, px: 0, pz: CS/2 - 0.08},
        {dx: 0, dz: -1, px: 0, pz: -CS/2 + 0.08},
        {dx: 1, dz: 0, px: CS/2 - 0.08, pz: 0},
        {dx: -1, dz: 0, px: -CS/2 + 0.08, pz: 0}
      ];
      waterDirs.forEach(wd => {
        const nt = getTile(x + wd.dx, y + wd.dz);
        if (nt === T.RIVER || nt === T.OCEAN) {
          const rand = rng(s + wd.dx * 13 + wd.dz * 37, 100);
          if (rand < 0.18) {
            // 물가 동글동글한 조약돌 (River Rock)
            const stoneGeo = new THREE.SphereGeometry(0.12 + rand * 0.4, 6, 5);
            const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9fa5ad, roughness: 0.52 });
            const stone = new THREE.Mesh(stoneGeo, stoneMat);
            stone.scale.set(1.2, 0.58, 0.85);
            stone.position.set(wd.px + (rng(s, 1) - 0.5) * 0.25, h + 0.03, wd.pz + (rng(s, 2) - 0.5) * 0.25);
            stone.castShadow = true; stone.receiveShadow = true;
            g.add(stone);
          } else if (rand >= 0.18 && rand < 0.32) {
            // 물가에 심긴 갈대/수초 (Reed)
            const reedMat = new THREE.MeshStandardMaterial({ color: 0x418625, roughness: 0.72 });
            const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.02, 0.34, 4), reedMat);
            reed.position.set(wd.px + (rng(s, 3) - 0.5) * 0.2, h + 0.14, wd.pz + (rng(s, 4) - 0.5) * 0.2);
            reed.rotation.z = (rng(s, 5) - 0.5) * 0.3 + (wd.dx * 0.2);
            reed.rotation.x = (rng(s, 6) - 0.5) * 0.3 + (-wd.dz * 0.2);
            reed.castShadow = true;
            g.add(reed);
          }
        }
      });

      // 3. 잔디밭 밀도 증강 및 랜덤 생활 데코
      // 고정형 캠프파이어 지역 (플레이어 집 근처)
      if (x === 25 && y === 33) {
        const camp = createCampfire();
        camp.position.set(0, h, 0);
        g.add(camp);
      } else if (x === 25 && y === 34) {
        const seat = createLogSeat();
        seat.position.set(0, h, 0);
        seat.rotation.y = Math.PI / 4;
        g.add(seat);
      } else if (x === 24 && y === 33) {
        const stump = createStump();
        stump.position.set(0, h, 0);
        g.add(stump);
      } else if (x === 16 && y === 25) {
        const tent = createCampsiteTent();
        tent.position.set(0, h, 0);
        g.add(tent);
      } else {
        // 일반 잔디 구역에 4% 확률로 표지판, 울타리, 화분, 통나무 의자 등 흩어놓기
        const decoRand = rng(s + 43, 77);
        if (decoRand < 0.04) {
          const typeRand = rng(s + 88, 12);
          let item;
          if (typeRand < 0.22) {
            item = createWoodenFence();
            // 도로 옆에 있으면 정렬
            if (getTile(x+1, y) === T.PATH || getTile(x-1, y) === T.PATH) {
              item.rotation.y = Math.PI / 2;
            }
          } else if (typeRand >= 0.22 && typeRand < 0.45) {
            item = createSignboard();
            item.rotation.y = rng(s, 8) * Math.PI * 2;
          } else if (typeRand >= 0.45 && typeRand < 0.65) {
            item = createFlowerPot();
          } else if (typeRand >= 0.65 && typeRand < 0.85) {
            item = createLogSeat();
            item.rotation.y = rng(s, 9) * Math.PI * 2;
          } else {
            item = createStump();
          }
          item.position.set((rng(s,11)-.5)*0.3, h, (rng(s,12)-.5)*0.3);
          g.add(item);
        }
      }
      break;
    }
    case T.PATH: {
      const pathMat = new THREE.MeshStandardMaterial({
        color:0xdcc996,
        map:variedTexture(TEXTURES.path, s+41, 1),
        bumpMap:variedTexture(TEXTURES.pathBump, s+42, 1),
        bumpScale:0.026,
        roughness:0.82,
        metalness:0.02
      });
      const path=new THREE.Mesh(getRoundedBoxGeometry(CS*0.86,0.045,CS*0.86,0.015,4), pathMat);
      path.position.y=h+0.022;
      path.rotation.y=(rng(s, 31)-0.5)*0.12;
      path.scale.set(0.96+rng(s, 32)*0.08, 1, 0.94+rng(s, 33)*0.1);
      path.receiveShadow=true;
      path.castShadow=true;
      g.add(path); 

      // 길과 잔디가 칼로 자른 듯 끊기지 않도록 가장자리에 풀, 잎, 흙 알갱이 배치
      if(!G.grassBlades) G.grassBlades = [];
      for(let i=0;i<5;i++){
        const ang=rng(s, 100+i)*Math.PI*2;
        const rad=CS*(0.38+rng(s,120+i)*0.12);
        const blade=mesh(new THREE.CylinderGeometry(0.01,0.026,0.12+rng(s,i+140)*0.08,4), rng(s,i+150)>0.5?0x79bd4e:0x4f9632,false);
        blade.position.set(Math.cos(ang)*rad, h+0.075, Math.sin(ang)*rad);
        blade.rotation.y=ang;
        blade.rotation.z=(rng(s,i+160)-0.5)*0.3;
        blade.userData.origRotX = blade.rotation.x;
        blade.userData.origRotZ = blade.rotation.z;
        blade.userData.windPhase = rng(s, i+170) * Math.PI * 2;
        blade.userData.tileKey = `${x},${y}`;
        g.add(blade);
        G.grassBlades.push(blade);
      }
      
      // 길 가장자리 울타리 데코레이션 자동 연출
      // 길 옆에 잔디 타일이 있다면 경계에 일정한 울타리를 드문드문 배치
      const fenceDirs = [
        {dx: 0, dz: 1, px: 0, pz: CS/2 - 0.05, rot: 0},
        {dx: 0, dz: -1, px: 0, pz: -CS/2 + 0.05, rot: 0},
        {dx: 1, dz: 0, px: CS/2 - 0.05, pz: 0, rot: Math.PI / 2},
        {dx: -1, dz: 0, px: -CS/2 + 0.05, pz: 0, rot: Math.PI / 2}
      ];
      fenceDirs.forEach(fd => {
        if (getTile(x + fd.dx, y + fd.dz) === T.GRASS) {
          // 8% 확률로 해당 경계에 우든 펜스 배치
          if (rng(s + fd.dx * 15 + fd.dz * 25, 99) < 0.08) {
            const fence = createWoodenFence();
            fence.rotation.y = fd.rot;
            fence.position.set(fd.px, h, fd.pz);
            g.add(fence);
          }
        }
      });
      break;
    }
    case T.FLOWER: {
      if (TEXTURES.shadowBlob) {
        const shGeo = new THREE.PlaneGeometry(0.4, 0.4);
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.28, depthWrite: false, alphaTest: 0.02, color: 0x5a6388 });
        const sh = new THREE.Mesh(shGeo, shMat);
        sh.rotation.x = -Math.PI/2;
        sh.position.y = h + 0.01;
        g.add(sh);
      }
      const fd=gs.world_flowers[`${x},${y}`]||{type:'🌸',watered:false};
      
      const stem=mesh(new THREE.CylinderGeometry(0.015,0.025,0.3,5),0x5caa38,false);
      stem.position.y=h+0.15; g.add(stem);
      
      const flowerHead = new THREE.Group();
      flowerHead.position.set(0, h+0.3, 0);
      flowerHead.rotation.x = Math.PI / 6;

      const FLOWER_COLS=[0xff88cc,0xffdd00,0xff4488,0xffcc00,0xff66aa];
      const fidx=['🌸','🌼','🌺','🌻','💐'].indexOf(fd.type);
      const fc=FLOWER_COLS[fidx>=0?fidx:0];

      for (let i = 0; i < 5; i++) {
        const petal = mesh(new THREE.SphereGeometry(0.09, 6, 5), fc, false);
        const angle = (i * Math.PI * 2) / 5;
        petal.position.set(Math.cos(angle) * 0.11, Math.sin(angle) * 0.11, 0);
        petal.scale.set(1.2, 0.7, 0.5);
        petal.rotation.z = angle;
        flowerHead.add(petal);
      }

      const center = mesh(new THREE.SphereGeometry(0.065, 6, 5), 0xffcc00, false);
      center.position.set(0, 0, 0.035);
      flowerHead.add(center);

      g.add(flowerHead);

      if(fd.watered){
        const drop=mesh(new THREE.SphereGeometry(0.06,5,4),0x88ccff,false);
        drop.position.set(0.18,h+0.42,0.1); drop.material.transparent=true;drop.material.opacity=0.75;
        g.add(drop);
      }
      break;
    }
    case T.TREE: {
      const td=gs.world_trees[`${x},${y}`]||{fruit:'apple',grown:2,lastShake:0,shakeCount:0};
      const offx=(rng(s,1)-.5)*0.25, offz=(rng(s,2)-.5)*0.25;
      
      if (TEXTURES.shadowBlob) {
        const shGeo = new THREE.PlaneGeometry(1.3, 1.3);
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.46, depthWrite: false, alphaTest: 0.02, color: 0x5a6388 });
        const sh = new THREE.Mesh(shGeo, shMat);
        sh.rotation.x = -Math.PI/2;
        sh.position.set(offx, h + 0.012, offz);
        g.add(sh);
      }

      // 구부러지고 갈수록 얇아지는 3단 나무 줄기 (Stylized Trunk)
      const trunkGroup = new THREE.Group();
      trunkGroup.position.set(offx, h, offz);
      
      const trunkColor = 0x8b5e3c;
      const trunkSegments = 3;
      const segmentHeight = (0.75 + td.grown*0.18) / trunkSegments;
      for (let i = 0; i < trunkSegments; i++) {
        const rBottom = 0.18 - i * 0.022;
        const rTop = 0.18 - (i + 1) * 0.022;
        const seg = mesh(new THREE.CylinderGeometry(rTop, rBottom, segmentHeight, 8), trunkColor);
        
        seg.position.y = segmentHeight * (i + 0.5);
        seg.position.x = Math.sin(i * 0.5 + s) * 0.025;
        seg.position.z = Math.cos(i * 0.5 + s) * 0.025;
        seg.rotation.z = Math.sin(i * 0.4 + s) * 0.06;
        seg.rotation.x = Math.cos(i * 0.4 + s) * 0.06;
        
        trunkGroup.add(seg);
      }
      g.add(trunkGroup);

      if(td.grown>=2){
        // 6구체 레이어로 뭉게뭉게 퍼지는 풍성한 나뭇잎 (Stylized Foliage)
        const leafCol = 0x4a9e30;
        const leafMat = new THREE.MeshStandardMaterial({ color: leafCol, roughness: 0.68, metalness: 0.05 });
        
        const leavesGroup = new THREE.Group();
        leavesGroup.position.set(offx, h + (0.75 + td.grown*0.18), offz);
        
        const leafClusters = [
          {x: 0, y: 0.12, z: 0, r: 0.68},
          {x: -0.34, y: -0.08, z: 0.1, r: 0.45},
          {x: 0.34, y: -0.08, z: -0.1, r: 0.45},
          {x: 0.1, y: -0.12, z: 0.34, r: 0.48},
          {x: -0.1, y: -0.12, z: -0.34, r: 0.48},
          {x: 0, y: 0.38, z: 0, r: 0.4}
        ];
        
        leafClusters.forEach(lc => {
          const lf = new THREE.Mesh(new THREE.SphereGeometry(lc.r, 10, 8), leafMat);
          lf.position.set(lc.x, lc.y, lc.z);
          lf.castShadow = true; lf.receiveShadow = true;
          leavesGroup.add(lf);
        });
        g.add(leavesGroup);

        // 꼭지와 잎사귀 디테일이 살아있는 3D 과일 열매 스폰
        const now=Date.now();
        if(td.lastShake===0||(now-td.lastShake)>86400000){
          const fr=ITEMS[td.fruit];
          if(fr){
            [[-0.42, 0.68, 0.18], [0.36, 0.88, -0.15], [-0.18, 1.2, 0.32]].forEach(([fx2,fy2,fz2])=>{
              const fruitColor = ['apple','cherry'].includes(td.fruit)?0xee4444:
                                 td.fruit==='orange'?0xff9900:td.fruit==='pear'?0xddee44:0xee6666;
              const fruitGroup = new THREE.Group();
              fruitGroup.position.set(offx+fx2, h+fy2, offz+fz2);

              // 과일 본체
              const apple = mesh(new THREE.SphereGeometry(0.09, 8, 7), fruitColor);
              fruitGroup.add(apple);

              // 디테일한 줄기
              const stem = mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.045, 4), 0x5c3317, false);
              stem.position.y = 0.095;
              stem.rotation.z = 0.22;
              fruitGroup.add(stem);

              // 잎사귀
              const leaf = mesh(new THREE.SphereGeometry(0.028, 5, 4), 0x4a9e30, false);
              leaf.position.set(0.024, 0.095, 0);
              leaf.scale.set(1.4, 0.5, 0.6);
              fruitGroup.add(leaf);

              g.add(fruitGroup);
            });
          }
        }
      } else {
        const sapling=mesh(new THREE.CylinderGeometry(0.05,0.08,0.3,6),0x5caa38,false);
        sapling.position.set(offx,h+0.15,offz); g.add(sapling);
      }
      break;
    }
    case T.ROCK: {
      if (TEXTURES.shadowBlob) {
        const shGeo = new THREE.PlaneGeometry(1.0, 1.0);
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.42, depthWrite: false, alphaTest: 0.02, color: 0x5a6388 });
        const sh = new THREE.Mesh(shGeo, shMat);
        sh.rotation.x = -Math.PI/2;
        sh.position.set(0, h + 0.012, 0);
        g.add(sh);
      }

      // 3개 구체의 유기적 변형으로 생성되는 둥근 다면 바위 (Stylized Boulder)
      const rockGroup = new THREE.Group();
      rockGroup.position.y = h;

      const rockMat = new THREE.MeshStandardMaterial({ color: 0x9fa8b0, roughness: 0.72, metalness: 0.08 });

      const r1 = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), rockMat);
      r1.scale.set(1.2, 0.76, 1.0);
      r1.position.set(0, 0.22, 0);
      r1.rotation.set(rng(s,1)*0.2, rng(s,2)*Math.PI, rng(s,3)*0.2);
      r1.castShadow = true; r1.receiveShadow = true;
      rockGroup.add(r1);

      const r2 = new THREE.Mesh(new THREE.SphereGeometry(0.24, 7, 7), rockMat);
      r2.scale.set(1.1, 0.68, 0.95);
      r2.position.set(-0.24, 0.12, 0.12);
      r2.castShadow = true; r2.receiveShadow = true;
      rockGroup.add(r2);

      const r3 = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), rockMat);
      r3.scale.set(1.0, 0.8, 1.05);
      r3.position.set(0.22, 0.09, -0.14);
      r3.castShadow = true; r3.receiveShadow = true;
      rockGroup.add(r3);

      // 상단의 동글동글 이끼 데코
      const mossMat = new THREE.MeshStandardMaterial({ color: 0x589832, roughness: 0.82 });
      const moss = new THREE.Mesh(new THREE.SphereGeometry(0.24, 6, 5), mossMat);
      moss.scale.set(1.15, 0.32, 1.15);
      moss.position.set(0.04, 0.33, -0.04);
      moss.castShadow = true;
      rockGroup.add(moss);

      g.add(rockGroup);
      break;
    }
    case T.DIG_SPOT: {
      const xmark1=mesh(new THREE.BoxGeometry(0.45,0.04,0.08),0xc09a60,false);
      const xmark2=mesh(new THREE.BoxGeometry(0.08,0.04,0.45),0xc09a60,false);
      xmark1.rotation.y=Math.PI/4; xmark2.rotation.y=Math.PI/4;
      xmark1.position.y=xmark2.position.y=h+0.035;
      g.add(xmark1); g.add(xmark2); 
      break;
    }
    case T.SHOP: {
      if (TEXTURES.shadowBlob) {
        const shGeo = new THREE.PlaneGeometry(CS * 2.1, CS * 1.9);
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.48, depthWrite: false, alphaTest: 0.02, color: 0x5a6388 });
        const sh = new THREE.Mesh(shGeo, shMat);
        sh.rotation.x = -Math.PI/2;
        sh.position.set(0, h + 0.012, 0);
        g.add(sh);
      }
      buildShop(g, h); 
      break;
    }
    case T.MUSEUM: {
      if (TEXTURES.shadowBlob) {
        const shGeo = new THREE.PlaneGeometry(CS * 2.2, CS * 2.1);
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.48, depthWrite: false, alphaTest: 0.02, color: 0x5a6388 });
        const sh = new THREE.Mesh(shGeo, shMat);
        sh.rotation.x = -Math.PI/2;
        sh.position.set(0, h + 0.012, 0);
        g.add(sh);
      }
      buildMuseum(g, h); 
      break;
    }
    case T.NOOK_HQ: {
      if (TEXTURES.shadowBlob) {
        const shGeo = new THREE.PlaneGeometry(CS * 2.1, CS * 2.1);
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.48, depthWrite: false, alphaTest: 0.02, color: 0x5a6388 });
        const sh = new THREE.Mesh(shGeo, shMat);
        sh.rotation.x = -Math.PI/2;
        sh.position.set(0, h + 0.012, 0);
        g.add(sh);
      }
      buildNookHQ(g, h); 
      break;
    }
    case T.PLAYER_HOUSE: {
      if (TEXTURES.shadowBlob) {
        const shGeo = new THREE.PlaneGeometry(CS * 1.8, CS * 1.7);
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.48, depthWrite: false, alphaTest: 0.02, color: 0x5a6388 });
        const sh = new THREE.Mesh(shGeo, shMat);
        sh.rotation.x = -Math.PI/2;
        sh.position.set(0, h + 0.012, 0);
        g.add(sh);
      }
      buildPlayerHouse(g, h); 
      break;
    }
    case T.VILLAGER_HOUSE: {
      if (TEXTURES.shadowBlob) {
        const shGeo = new THREE.PlaneGeometry(CS * 1.8, CS * 1.7);
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.48, depthWrite: false, alphaTest: 0.02, color: 0x5a6388 });
        const sh = new THREE.Mesh(shGeo, shMat);
        sh.rotation.x = -Math.PI/2;
        sh.position.set(0, h + 0.012, 0);
        g.add(sh);
      }
      const vi=VILLAGERS.find(v=>v.pos[0]===x&&v.pos[1]===y);
      buildVillagerHouse(g, h, vi); 
      break;
    }
  }
}

// ─── 상점 빌더 ────────────────────────────────────────────────
export function buildShop(g, h) {
  const shopGroup = new THREE.Group();
  shopGroup.position.y = h;

  const w = CS * 2.05;
  const d = CS * 1.82;
  const hi = 2.2;

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf4e6c3, roughness: 0.8 }); // 밝은 나무
  const wall = new THREE.Mesh(getRoundedBoxGeometry(w, hi, d, 0.08, 3), wallMat);
  wall.position.y = hi/2;
  wall.castShadow = true; wall.receiveShadow = true;
  shopGroup.add(wall);

  const roofMat = new THREE.MeshStandardMaterial({ color: 0xd84830, roughness: 0.62 }); // 빨간 지붕
  const roofL = new THREE.Mesh(getRoundedBoxGeometry(w * 0.72, 0.18, d * 1.2, 0.025, 2), roofMat);
  roofL.position.set(-w/4 - 0.03, hi + 0.36, 0);
  roofL.rotation.z = 0.5;
  roofL.castShadow = true;
  shopGroup.add(roofL);

  const roofR = new THREE.Mesh(getRoundedBoxGeometry(w * 0.72, 0.18, d * 1.2, 0.025, 2), roofMat);
  roofR.position.set(w/4 + 0.03, hi + 0.36, 0);
  roofR.rotation.z = -0.5;
  roofR.castShadow = true;
  shopGroup.add(roofR);

  // 상점 대표 노란 간판 (Leaf 로고 포함)
  const signBack = new THREE.Mesh(getRoundedBoxGeometry(1.0, 0.42, 0.1, 0.02, 2), new THREE.MeshStandardMaterial({ color: 0x8b5b2e }));
  signBack.position.set(0, hi + 0.72, d/2 - 0.15);
  signBack.castShadow = true;
  shopGroup.add(signBack);

  const signBoard = new THREE.Mesh(getRoundedBoxGeometry(0.9, 0.34, 0.04, 0.01, 2), new THREE.MeshStandardMaterial({ color: 0xffdd44, roughness: 0.5 }));
  signBoard.position.set(0, hi + 0.72, d/2 - 0.09);
  shopGroup.add(signBoard);

  const logo = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), new THREE.MeshBasicMaterial({ color: 0x4aa330 }));
  logo.scale.set(1.5, 0.8, 0.5);
  logo.position.set(0, hi + 0.72, d/2 - 0.06);
  shopGroup.add(logo);

  // 양측 대형 전시창 (Show windows)
  const winMat = new THREE.MeshStandardMaterial({ color: 0xefefef });
  const glassMat = new THREE.MeshBasicMaterial({ color: 0xaad8f5, transparent: true, opacity: 0.85 });
  [-0.62, 0.62].forEach(wx => {
    const winF = new THREE.Mesh(getRoundedBoxGeometry(0.48, 0.68, 0.06, 0.015, 2), winMat);
    winF.position.set(wx, hi * 0.48, d/2 + 0.01);
    shopGroup.add(winF);

    const winG = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.58), glassMat);
    winG.position.set(wx, hi * 0.48, d/2 + 0.045);
    shopGroup.add(winG);
  });

  const door = createDoorAssembly({ width: 0.54, height: 1.18, doorColor: 0x8b5b2e, frameColor: 0xfff2d2 });
  door.position.set(0, 0.02, d/2 + 0.06);
  shopGroup.add(door);

  const matFront = createWelcomeMat(0.86, 0.42, 0xcc9460);
  matFront.position.set(0, 0.025, d/2 + 0.42);
  shopGroup.add(matFront);

  [-0.98, 0.98].forEach(lx => {
    const lamp = createTinyLantern(0xffeeaa);
    lamp.position.set(lx, 0, d/2 + 0.08);
    shopGroup.add(lamp);
  });

  // 미니 나무 디스플레이 벤치
  const bench = new THREE.Mesh(getRoundedBoxGeometry(0.68, 0.08, 0.28, 0.01, 2), new THREE.MeshStandardMaterial({ color: 0xbfa68c }));
  bench.position.set(0, 0.04, d/2 + 0.14);
  bench.castShadow = true; bench.receiveShadow = true;
  shopGroup.add(bench);

  g.add(shopGroup);
}

// ─── 박물관 빌더 ──────────────────────────────────────────────
export function buildMuseum(g, h) {
  const museumGroup = new THREE.Group();
  museumGroup.position.y = h;

  const w = CS * 2.25;
  const d = CS * 2.05;
  const hi = 2.55;

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xdee2e6, roughness: 0.72 });
  const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0xc1c7cd, roughness: 0.8 });

  // 석조 지단 베이스
  const base = new THREE.Mesh(getRoundedBoxGeometry(w * 1.05, 0.15, d * 1.05, 0.02, 2), darkStoneMat);
  base.position.y = 0.075;
  base.castShadow = true; base.receiveShadow = true;
  museumGroup.add(base);

  const body = new THREE.Mesh(getRoundedBoxGeometry(w, hi - 0.15, d, 0.08, 3), stoneMat);
  body.position.y = (hi - 0.15)/2 + 0.15;
  body.castShadow = true; body.receiveShadow = true;
  museumGroup.add(body);

  // 석조 코니스 몰딩
  const roof = new THREE.Mesh(getRoundedBoxGeometry(w * 1.08, 0.22, d * 1.08, 0.03, 2), darkStoneMat);
  roof.position.y = hi + 0.11;
  roof.castShadow = true;
  museumGroup.add(roof);

  // 클래식 청동 돔 (Classic Museum Dome)
  const dome = new THREE.Mesh(new THREE.SphereGeometry(w * 0.4, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x7688a4, roughness: 0.5 }));
  dome.position.y = hi + 0.2;
  dome.castShadow = true;
  museumGroup.add(dome);

  // 신전 석조 기둥 (4개 Columns)
  const colGeo = new THREE.CylinderGeometry(0.06, 0.07, hi - 0.2, 8);
  const colMat = new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.75 });
  const colPositions = [-0.68, -0.22, 0.22, 0.68];
  colPositions.forEach(cx => {
    const col = new THREE.Mesh(colGeo, colMat);
    col.position.set(cx, (hi - 0.2)/2 + 0.15, d/2 + 0.05);
    col.castShadow = true;
    museumGroup.add(col);
  });

  // 기둥 상단 삼각형 지붕 패리먼트 (Pediment)
  const pedShape = new THREE.Shape();
  pedShape.moveTo(-w/2 - 0.05, 0);
  pedShape.lineTo(w/2 + 0.05, 0);
  pedShape.lineTo(0, 0.35);
  pedShape.closePath();
  const pedExt = new THREE.ExtrudeGeometry(pedShape, { depth: 0.2, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.02, bevelSegments: 2 });
  pedExt.center();
  const ped = new THREE.Mesh(pedExt, darkStoneMat);
  ped.position.set(0, hi + 0.08, d/2 + 0.05);
  ped.castShadow = true;
  museumGroup.add(ped);

  const door = createDoorAssembly({ width: 0.62, height: 1.28, doorColor: 0x5c4638, frameColor: 0xeef1f3, openDir: -1 });
  door.position.set(0, 0.14, d/2 + 0.13);
  museumGroup.add(door);

  const stairMat = new THREE.MeshStandardMaterial({ color: 0xd5d9dc, roughness: 0.78 });
  for(let i=0;i<3;i++){
    const step = new THREE.Mesh(getRoundedBoxGeometry(1.4 + i*0.28, 0.08, 0.34, 0.025, 2), stairMat);
    step.position.set(0, 0.05 + i*0.055, d/2 + 0.36 + i*0.18);
    step.castShadow = true; step.receiveShadow = true;
    museumGroup.add(step);
  }

  [-1.25, 1.25].forEach(lx => {
    const lamp = createTinyLantern(0xe9f7ff);
    lamp.position.set(lx, 0.14, d/2 + 0.16);
    museumGroup.add(lamp);
  });

  g.add(museumGroup);
}

// ─── 마을사무소 빌더 ──────────────────────────────────────────
export function buildNookHQ(g, h) {
  const hqGroup = new THREE.Group();
  hqGroup.position.y = h;

  const w = CS * 2.05;
  const d = CS * 1.95;
  const hi = 2.15;

  const logsMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.85 }); // 따뜻한 우드 로그
  const greenRoofMat = new THREE.MeshStandardMaterial({ color: 0x489650, roughness: 0.6 }); // 동숲식 녹색 지붕

  // 통나무 마을사무소 본체
  const wall = new THREE.Mesh(getRoundedBoxGeometry(w, hi, d, 0.08, 3), logsMat);
  wall.position.y = hi/2;
  wall.castShadow = true; wall.receiveShadow = true;
  hqGroup.add(wall);

  // 박공 녹색 지붕
  const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, 0.8, 4), greenRoofMat);
  roof.position.y = hi + 0.45;
  roof.rotation.y = Math.PI/4;
  roof.scale.set(1.2, 1.0, 1.2);
  roof.castShadow = true;
  hqGroup.add(roof);

  // 깃대 & 깃발
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.0, 6), new THREE.MeshStandardMaterial({ color: 0xefefef }));
  pole.position.set(w/2 - 0.15, hi + 0.95, 0);
  pole.castShadow = true;
  hqGroup.add(pole);

  const flag = new THREE.Mesh(getRoundedBoxGeometry(0.3, 0.22, 0.02, 0.005, 2), new THREE.MeshStandardMaterial({ color: 0xffe066 }));
  flag.position.set(w/2 - 0.02, hi + 1.35, 0);
  flag.castShadow = true;
  hqGroup.add(flag);

  // 마을 게시판 (Notice Board) 추가
  const boardGroup = new THREE.Group();
  boardGroup.position.set(-w/2 - 0.18, 0, d/3);
  boardGroup.rotation.y = Math.PI / 2;

  const legGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6);
  const boardPostL = new THREE.Mesh(legGeo, logsMat);
  boardPostL.position.set(-0.25, 0.25, 0);
  boardPostL.castShadow = true;
  boardGroup.add(boardPostL);

  const boardPostR = new THREE.Mesh(legGeo, logsMat);
  boardPostR.position.set(0.25, 0.25, 0);
  boardPostR.castShadow = true;
  boardGroup.add(boardPostR);

  const pnl = new THREE.Mesh(getRoundedBoxGeometry(0.58, 0.38, 0.04, 0.01, 2), new THREE.MeshStandardMaterial({ color: 0xa06030 }));
  pnl.position.y = 0.5;
  pnl.castShadow = true;
  boardGroup.add(pnl);

  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.3), new THREE.MeshBasicMaterial({ color: 0xfff9e6 }));
  paper.position.set(0, 0.5, 0.025);
  boardGroup.add(paper);

  hqGroup.add(boardGroup);

  const door = createDoorAssembly({ width: 0.58, height: 1.18, doorColor: 0x6b4a2a, frameColor: 0xfff7dd, openDir: -1 });
  door.position.set(0, 0.02, d/2 + 0.08);
  hqGroup.add(door);

  const matFront = createWelcomeMat(0.82, 0.42, 0x8fcf76);
  matFront.position.set(0, 0.025, d/2 + 0.43);
  hqGroup.add(matFront);

  [-0.72, 0.72].forEach(wx => {
    const win = new THREE.Mesh(getRoundedBoxGeometry(0.42, 0.42, 0.05, 0.015, 2), new THREE.MeshStandardMaterial({ color: 0xfff7dd, roughness: 0.6 }));
    win.position.set(wx, 1.32, d/2 + 0.05);
    hqGroup.add(win);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), new THREE.MeshBasicMaterial({ color: 0xffdf66, transparent: true, opacity: 0.86 }));
    glass.position.set(wx, 1.32, d/2 + 0.085);
    hqGroup.add(glass);
  });
  g.add(hqGroup);
}

// ─── 플레이어 집 빌더 ──────────────────────────────────────────
export function buildPlayerHouse(g, h) {
  const lv=G.gs.house_level;
  if(lv===0){
    // 텐트: 입체 삼각 텐트로 전면 교체
    const tentGroup = new THREE.Group();
    tentGroup.position.y = h;

    const canvasMat = new THREE.MeshStandardMaterial({ color: 0xcee5b5, roughness: 0.82 }); // 아이보리 텐트
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x8b6540, roughness: 0.6 });

    // 텐트 바디 (삼각기둥)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, CS * 0.86, 1.65, 3), canvasMat);
    body.rotation.y = Math.PI / 6;
    body.position.set(0, 0.82, 0);
    body.scale.set(1, 1, 1.25);
    body.castShadow = true; body.receiveShadow = true;
    tentGroup.add(body);

    // 입구 스킨 플랩
    const flapGeo = getRoundedBoxGeometry(CS * 0.38, 1.18, 0.04, 0.01, 2);
    const flapL = new THREE.Mesh(flapGeo, canvasMat);
    flapL.position.set(-0.27, 0.62, CS * 0.48);
    flapL.rotation.y = 0.5;
    flapL.rotation.z = -0.15;
    flapL.userData.isDoorPanel = true;
    tentGroup.add(flapL);

    const flapR = new THREE.Mesh(flapGeo, canvasMat);
    flapR.position.set(0.27, 0.62, CS * 0.48);
    flapR.rotation.y = -0.5;
    flapR.rotation.z = 0.15;
    tentGroup.add(flapR);

    const darkOpening = new THREE.Mesh(getRoundedBoxGeometry(0.52, 0.92, 0.035, 0.02, 2), new THREE.MeshBasicMaterial({ color: 0x3b3028, transparent: true, opacity: 0.82 }));
    darkOpening.position.set(0, 0.5, CS * 0.52);
    tentGroup.add(darkOpening);

    // A자형 지지목 기둥
    const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6);
    const pL = new THREE.Mesh(poleGeo, poleMat);
    pL.position.set(-0.35, 0.65, CS * 0.42);
    pL.rotation.z = 0.25;
    tentGroup.add(pL);

    const pR = new THREE.Mesh(poleGeo, poleMat);
    pR.position.set(0.35, 0.65, CS * 0.42);
    pR.rotation.z = -0.25;
    tentGroup.add(pR);

    // 포치 조명 (귀여운 전구)
    const lampGroup = new THREE.Group();
    lampGroup.position.set(-0.48, 0.25, CS * 0.42);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 4), poleMat);
    lampGroup.add(post);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffdd44 }));
    bulb.position.y = 0.15;
    lampGroup.add(bulb);
    tentGroup.add(lampGroup);

    const matFront = createWelcomeMat(0.78, 0.42, 0xd9b56c);
    matFront.position.set(0, 0.025, CS * 0.76);
    tentGroup.add(matFront);

    const doorPivot = new THREE.Group();
    doorPivot.userData.isDoorPivot = true;
    doorPivot.userData.closedRotationY = 0;
    doorPivot.userData.openRotationY = -Math.PI * 0.35;
    doorPivot.add(flapL);
    tentGroup.add(doorPivot);

    g.add(tentGroup);
  } else {
    // 둥글둥글하고 아늑한 코티지 주택
    const houseGroup = new THREE.Group();
    houseGroup.position.y = h;

    const w = CS * (1.42 + lv * 0.16);
    const d = CS * 1.45;
    const hi = 2.05 + lv * 0.26;

    // 1. 벽면 (부드러운 크림빛 샌드 스투코)
    const wallGeo = getRoundedBoxGeometry(w, hi, d, 0.08, 3);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xfffcf0, roughness: 0.75 });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = hi / 2;
    wall.castShadow = true; wall.receiveShadow = true;
    houseGroup.add(wall);

    // 2. 두께감과 처마가 구현된 아늑한 입체 박공 지붕 (Gable Roof)
    const roofColor = [0xee5030, 0x3670d0, 0x32c86e, 0xcc4cc0][lv-1] || 0xee5030;
    const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.62 });
    const roofTrimMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });

    const rW = w * 0.72;
    const rD = d * 1.15;
    const rT = 0.12; // 지붕 두께
    
    const roofL = new THREE.Mesh(getRoundedBoxGeometry(rW, rT, rD, 0.02, 2), roofMat);
    roofL.position.set(-w/4 - 0.04, hi + 0.42, 0);
    roofL.rotation.z = 0.55;
    roofL.castShadow = true;
    houseGroup.add(roofL);

    const roofR = new THREE.Mesh(getRoundedBoxGeometry(rW, rT, rD, 0.02, 2), roofMat);
    roofR.position.set(w/4 + 0.04, hi + 0.42, 0);
    roofR.rotation.z = -0.55;
    roofR.castShadow = true;
    houseGroup.add(roofR);

    // 지붕 리지
    const ridge = new THREE.Mesh(getRoundedBoxGeometry(w * 0.06, w * 0.06, rD * 1.02, 0.01, 2), roofTrimMat);
    ridge.position.set(0, hi + 0.69, 0);
    ridge.castShadow = true;
    houseGroup.add(ridge);

    // 3. 붉은 벽돌 굴뚝 (Chimney) & 입체 연기 구름
    const chim = new THREE.Mesh(getRoundedBoxGeometry(0.24, 0.9, 0.24, 0.02, 2), new THREE.MeshStandardMaterial({ color: 0xa84a32, roughness: 0.8 }));
    chim.position.set(-w/2.5, hi + 0.2, -d/3);
    chim.castShadow = true;
    houseGroup.add(chim);
    
    const smokeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), smokeMat);
    s1.position.set(-w/2.5, hi + 0.8, -d/3);
    houseGroup.add(s1);
    
    const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), smokeMat);
    s2.position.set(-w/2.5 + 0.08, hi + 1.05, -d/3 - 0.04);
    houseGroup.add(s2);

    const s3 = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), smokeMat);
    s3.position.set(-w/2.5 + 0.18, hi + 1.35, -d/3 - 0.08);
    houseGroup.add(s3);

    // 4. 나무 문 & 황동 손잡이
    const door = createDoorAssembly({ width: 0.56, height: 1.16, doorColor: 0xb57b45, frameColor: 0xffffff, openDir: -1 });
    door.position.set(0, 0.02, d/2 + 0.07);
    houseGroup.add(door);

    const matFront = createWelcomeMat(0.82, 0.42, 0xd9b56c);
    matFront.position.set(0, 0.025, d/2 + 0.43);
    houseGroup.add(matFront);

    // 5. 따뜻하게 불 켜진 격자 창문
    const winFrame = new THREE.Mesh(getRoundedBoxGeometry(0.42, 0.42, 0.06, 0.01, 2), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    winFrame.position.set(w/3.2, hi * 0.5, d/2 + 0.02);
    houseGroup.add(winFrame);

    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), new THREE.MeshBasicMaterial({ color: 0xffdf66 }));
    glass.position.set(w/3.2, hi * 0.5, d/2 + 0.055);
    houseGroup.add(glass);

    // 우체통 (Mailbox)
    const mboxGroup = new THREE.Group();
    mboxGroup.position.set(-w/2 - 0.2, 0, d/2 - 0.1);
    
    const postBox = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), new THREE.MeshStandardMaterial({ color: 0xefefef }));
    postBox.position.y = 0.2;
    postBox.castShadow = true;
    mboxGroup.add(postBox);

    const box_mesh = new THREE.Mesh(getRoundedBoxGeometry(0.18, 0.15, 0.26, 0.02, 2), new THREE.MeshStandardMaterial({ color: 0xee3333, roughness: 0.6 }));
    box_mesh.position.y = 0.44;
    box_mesh.castShadow = true;
    mboxGroup.add(box_mesh);

    const flg = new THREE.Mesh(getRoundedBoxGeometry(0.02, 0.08, 0.02, 0.005, 2), new THREE.MeshBasicMaterial({ color: 0xffcc00 }));
    flg.position.set(0.1, 0.48, 0.04);
    flg.rotation.x = -0.5;
    mboxGroup.add(flg);

    houseGroup.add(mboxGroup);

    // 하프 우든 펜스 (양쪽)
    [-w/2 - 0.1, w/2 + 0.1].forEach(side => {
      const fence = new THREE.Mesh(getRoundedBoxGeometry(0.06, 0.42, 0.06, 0.01, 2), new THREE.MeshStandardMaterial({ color: 0xc4a682 }));
      fence.position.set(side, 0.21, d/2);
      fence.castShadow = true;
      houseGroup.add(fence);
    });

    g.add(houseGroup);
  }
}

// ─── 주민 집 빌더 ──────────────────────────────────────────────
export function buildVillagerHouse(g, h, vi) {
  if(!vi) return;
  const houseGroup = new THREE.Group();
  houseGroup.position.y = h;

  const w = CS * 1.42;
  const d = CS * 1.35;
  const hi = 2.0;

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xfffcf0, roughness: 0.72 });
  const wall = new THREE.Mesh(getRoundedBoxGeometry(w, hi, d, 0.08, 3), wallMat);
  wall.position.y = hi / 2;
  wall.castShadow = true; wall.receiveShadow = true;
  houseGroup.add(wall);

  // 귀여운 주민 버섯형 원뿔 지붕
  const roofColor = vi.color ?? 0xff88aa;
  const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.58 });
  const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, 0.8, 8), roofMat);
  roof.position.y = hi + 0.48;
  roof.rotation.y = Math.PI / 8;
  roof.scale.set(1.2, 1.0, 1.2);
  roof.castShadow = true;
  houseGroup.add(roof);

  const door = createDoorAssembly({ width: 0.5, height: 1.08, doorColor: 0x8b5b2e, frameColor: 0xfff7dd, openDir: -1 });
  door.position.set(0, 0.02, d/2 + 0.07);
  houseGroup.add(door);

  const matFront = createWelcomeMat(0.72, 0.38, vi.color ?? 0xd9b56c);
  matFront.position.set(0, 0.025, d/2 + 0.38);
  houseGroup.add(matFront);

  // 동그란 아기자기 창문
  const winRing = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  winRing.rotation.x = Math.PI / 2;
  winRing.position.set(w/3.4, hi * 0.55, d/2 + 0.02);
  houseGroup.add(winRing);

  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), new THREE.MeshBasicMaterial({ color: 0xffdf66 }));
  glass.position.set(w/3.4, hi * 0.55, d/2 + 0.05);
  houseGroup.add(glass);

  g.add(houseGroup);
}

// ─── 미니 장식품 빌드 함수 (내부 헬퍼) ──────────────────────────
function createCampfire() {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6e473b, roughness: 0.8 });
  const ashMat = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.9 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x909090, roughness: 0.7 });

  for (let i = 0; i < 6; i++) {
    const st = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 4), stoneMat);
    const angle = (i * Math.PI * 2) / 6;
    st.position.set(Math.cos(angle) * 0.16, 0.02, Math.sin(angle) * 0.16);
    st.scale.set(1.2, 0.6, 1.2);
    g.add(st);
  }
  
  const ash = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), ashMat);
  ash.scale.set(1.2, 0.2, 1.2);
  ash.position.y = 0.02;
  g.add(ash);

  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6), woodMat);
    log.rotation.y = (i * Math.PI) / 3;
    log.rotation.z = 0.25;
    log.position.set(Math.cos(i * Math.PI/3)*0.03, 0.06, Math.sin(i * Math.PI/3)*0.03);
    g.add(log);
  }

  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.85 });
  const flameYel = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.9 });
  
  const f1 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), flameMat);
  f1.position.set(0, 0.12, 0);
  f1.scale.set(1.0, 1.8, 1.0);
  g.add(f1);

  const f2 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 4), flameYel);
  f2.position.set(0.03, 0.18, -0.02);
  f2.scale.set(1.0, 1.5, 1.0);
  g.add(f2);

  return g;
}

function createLogSeat() {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xb5805c, roughness: 0.78 });
  const innerWoodMat = new THREE.MeshStandardMaterial({ color: 0xe0b99b, roughness: 0.65 });
  
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.45, 8), woodMat);
  log.rotation.z = Math.PI / 2;
  log.position.y = 0.14;
  log.castShadow = true; log.receiveShadow = true;
  g.add(log);
  
  [-0.226, 0.226].forEach(z => {
    const end = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.002, 8), innerWoodMat);
    end.rotation.z = Math.PI / 2;
    end.position.set(z, 0.14, 0);
    g.add(end);
  });

  const supMat = new THREE.MeshStandardMaterial({ color: 0x825439 });
  [-0.14, 0.14].forEach(x => {
    const sup = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.12), supMat);
    sup.position.set(x, 0.04, 0);
    g.add(sup);
  });

  return g;
}

function createStump() {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b5b2e, roughness: 0.85 });
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xe0b99b, roughness: 0.7 });

  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.22, 8), woodMat);
  stump.position.y = 0.11;
  stump.castShadow = true; stump.receiveShadow = true;
  g.add(stump);

  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.178, 0.178, 0.002, 8), ringMat);
  ring.position.y = 0.221;
  g.add(ring);

  const moss = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 4), new THREE.MeshStandardMaterial({ color: 0x589832 }));
  moss.scale.set(1.5, 0.4, 1.0);
  moss.position.set(-0.11, 0.21, 0.05);
  g.add(moss);

  return g;
}

function createWoodenFence() {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xc4a682, roughness: 0.82 });

  [-0.32, 0.32].forEach(x => {
    const post = new THREE.Mesh(getRoundedBoxGeometry(0.06, 0.42, 0.06, 0.01, 2), woodMat);
    post.position.set(x, 0.21, 0);
    post.castShadow = true;
    g.add(post);
  });

  [-0.1, 0.1].forEach(y => {
    const board = new THREE.Mesh(getRoundedBoxGeometry(0.72, 0.06, 0.03, 0.005, 2), woodMat);
    board.position.set(0, 0.21 + y, 0);
    board.castShadow = true;
    g.add(board);
  });

  return g;
}

function createSignboard() {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xbf9c6e, roughness: 0.85 });

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.48, 6), woodMat);
  post.position.y = 0.24;
  post.castShadow = true;
  g.add(post);

  const board = new THREE.Mesh(getRoundedBoxGeometry(0.38, 0.16, 0.04, 0.01, 2), woodMat);
  board.position.set(0.04, 0.4, 0.01);
  board.rotation.z = 0.08;
  board.castShadow = true;
  g.add(board);

  return g;
}

function createFlowerPot() {
  const g = new THREE.Group();
  const potMat = new THREE.MeshStandardMaterial({ color: 0xb25d48, roughness: 0.72 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3e8e2d, roughness: 0.65 });

  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.16, 8), potMat);
  pot.position.y = 0.08;
  pot.castShadow = true; pot.receiveShadow = true;
  g.add(pot);

  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 8), potMat);
  rim.position.y = 0.16;
  g.add(rim);

  for (let i = 0; i < 3; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), leafMat);
    const angle = (i * Math.PI * 2) / 3;
    leaf.position.set(Math.cos(angle) * 0.05, 0.2, Math.sin(angle) * 0.05);
    leaf.scale.set(1.5, 0.5, 0.8);
    leaf.rotation.y = angle;
    leaf.rotation.z = 0.4;
    g.add(leaf);
  }

  return g;
}

function createSmallTable() {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xc99b66, roughness: 0.78 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.82 });

  const top = new THREE.Mesh(getRoundedBoxGeometry(0.58, 0.08, 0.44, 0.025, 2), woodMat);
  top.position.y = 0.36;
  top.castShadow = true; top.receiveShadow = true;
  g.add(top);

  [-0.21, 0.21].forEach(x => [-0.15, 0.15].forEach(z => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.34, 6), trimMat);
    leg.position.set(x, 0.18, z);
    leg.castShadow = true;
    g.add(leg);
  }));

  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.08, 8), new THREE.MeshStandardMaterial({ color: 0xfff3d8, roughness: 0.58 }));
  mug.position.set(-0.16, 0.43, 0.05);
  mug.castShadow = true;
  g.add(mug);

  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.012, 12), new THREE.MeshStandardMaterial({ color: 0xbfe7ff, roughness: 0.48 }));
  plate.position.set(0.14, 0.41, -0.04);
  plate.castShadow = true;
  g.add(plate);
  return g;
}

function createCampingChair() {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x8b6540, roughness: 0.72 });
  const clothMat = new THREE.MeshStandardMaterial({ color: 0x6fb8e8, roughness: 0.82 });

  const seat = new THREE.Mesh(getRoundedBoxGeometry(0.5, 0.055, 0.42, 0.018, 2), clothMat);
  seat.position.y = 0.26;
  seat.rotation.x = -0.12;
  seat.castShadow = true; seat.receiveShadow = true;
  g.add(seat);

  const back = new THREE.Mesh(getRoundedBoxGeometry(0.5, 0.055, 0.48, 0.018, 2), clothMat);
  back.position.set(0, 0.52, -0.18);
  back.rotation.x = 0.74;
  back.castShadow = true;
  g.add(back);

  [-0.22, 0.22].forEach(x => [-0.18, 0.18].forEach(z => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.38, 6), frameMat);
    leg.position.set(x, 0.18, z);
    leg.rotation.x = z > 0 ? -0.18 : 0.18;
    leg.castShadow = true;
    g.add(leg);
  }));

  return g;
}

function createFishingRod() {
  const g = new THREE.Group();
  const rodMat = new THREE.MeshStandardMaterial({ color: 0x8b5b2e, roughness: 0.72 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5f5ff, transparent: true, opacity: 0.72 });

  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.95, 6), rodMat);
  rod.rotation.z = Math.PI / 2.35;
  rod.position.set(0, 0.24, 0);
  rod.castShadow = true;
  g.add(rod);

  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.42, 4), lineMat);
  line.position.set(0.36, 0.09, 0.16);
  line.rotation.x = 0.45;
  g.add(line);

  const bobber = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), new THREE.MeshStandardMaterial({ color: 0xff5555, roughness: 0.5 }));
  bobber.position.set(0.43, 0.02, 0.28);
  bobber.castShadow = true;
  g.add(bobber);
  return g;
}

function createMailbox() {
  const g = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0xf2ead6, roughness: 0.74 });
  const boxMat = new THREE.MeshStandardMaterial({ color: 0xf05b4f, roughness: 0.58 });

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.48, 6), postMat);
  post.position.y = 0.24;
  post.castShadow = true;
  g.add(post);

  const box = new THREE.Mesh(getRoundedBoxGeometry(0.28, 0.18, 0.34, 0.035, 3), boxMat);
  box.position.y = 0.55;
  box.castShadow = true; box.receiveShadow = true;
  g.add(box);

  const flag = new THREE.Mesh(getRoundedBoxGeometry(0.035, 0.13, 0.025, 0.006, 2), new THREE.MeshStandardMaterial({ color: 0xffd34d, roughness: 0.5 }));
  flag.position.set(0.17, 0.62, 0.05);
  flag.rotation.z = -0.25;
  g.add(flag);
  return g;
}

function createBeachUmbrella() {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xefefef, metalness: 0.3 });
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x368ad0, roughness: 0.6 });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 8), poleMat);
  pole.position.set(0, 0.7, 0);
  pole.rotation.z = 0.12;
  pole.castShadow = true;
  g.add(pole);

  const shadeGroup = new THREE.Group();
  shadeGroup.position.set(0.084, 1.39, 0);
  shadeGroup.rotation.z = 0.12;

  for (let i = 0; i < 8; i++) {
    const mat = (i % 2 === 0) ? shadeMat : blueMat;
    const wedge = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.28, 8, 1, true, (i * Math.PI * 2)/8, Math.PI * 2/8), mat);
    shadeGroup.add(wedge);
  }
  
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), blueMat);
  cap.position.y = 0.15;
  shadeGroup.add(cap);

  g.add(shadeGroup);
  return g;
}

function createBeachTowel() {
  const g = new THREE.Group();
  const matMat = new THREE.MeshStandardMaterial({ color: 0xef5b8a, roughness: 0.9 });

  const towel = new THREE.Mesh(getRoundedBoxGeometry(0.48, 0.02, 0.9, 0.005, 2), matMat);
  towel.position.y = 0.01;
  towel.receiveShadow = true;
  g.add(towel);

  const pillow = new THREE.Mesh(getRoundedBoxGeometry(0.38, 0.06, 0.18, 0.01, 2), new THREE.MeshStandardMaterial({ color: 0xfff9e6, roughness: 0.8 }));
  pillow.position.set(0, 0.04, -0.32);
  g.add(pillow);

  return g;
}

function createSeashell() {
  const g = new THREE.Group();
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xfce8d5, roughness: 0.52 });

  for (let i = 0; i < 4; i++) {
    const scale = 0.08 - i * 0.016;
    const bit = new THREE.Mesh(new THREE.SphereGeometry(scale, 7, 6), shellMat);
    bit.scale.set(1.2, 0.9, 1.2);
    bit.position.set(Math.sin(i * 0.8) * 0.03, 0.02 + i * 0.025, i * 0.035);
    g.add(bit);
  }
  return g;
}

function createCampsiteTent() {
  const g = new THREE.Group();
  const canvasMat = new THREE.MeshStandardMaterial({ color: 0xefd8a4, roughness: 0.85 });
  
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, CS * 0.44, 0.8, 3), canvasMat);
  body.rotation.y = Math.PI / 6;
  body.position.y = 0.4;
  body.scale.set(1.0, 1.0, 1.15);
  body.castShadow = true;
  g.add(body);
  
  return g;
}
