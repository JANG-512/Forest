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

// ─── 세계 생성 ───────────────────────────────────────────────
export function generateWorld() {
  const gs = G.gs;
  if(!G.world) G.world = new Uint8Array(WW*WH);
  const world = G.world;
  world.fill(T.OCEAN);
  
  // 섬 모양 (타원형)
  for(let y=0;y<WH;y++) for(let x=0;x<WW;x++){
    const dx=(x-ISLAND_CX)/(WW*0.44), dy=(y-ISLAND_CY)/(WH*0.42);
    const n=Math.sin(x*0.4+y*0.3)*0.06+Math.cos(x*0.25-y*0.5)*0.06;
    if(dx*dx+dy*dy<1+n) setTile(x,y,T.BEACH);
  }
  // 내부 잔디
  for(let y=0;y<WH;y++) for(let x=0;x<WW;x++){
    if(getTile(x,y)!==T.BEACH) continue;
    const dx=(x-ISLAND_CX)/(WW*0.42), dy=(y-ISLAND_CY)/(WH*0.40);
    const n=Math.sin(x*0.5+y*0.4)*0.04;
    if(dx*dx+dy*dy<0.7+n) setTile(x,y,T.GRASS);
  }
  // 절벽 (북쪽)
  for(let y=5;y<16;y++) for(let x=10;x<38;x++)
    if(getTile(x,y)===T.GRASS) setTile(x,y,T.CLIFF);
  // 강 (절벽 아래에서 남쪽으로)
  for(let y=16;y<36;y++){setTile(23,y,T.RIVER);setTile(24,y,T.RIVER);}
  // 폭포 (절벽 경계)
  setTile(23,15,T.WATERFALL); setTile(24,15,T.WATERFALL);
  // 다리
  setTile(23,24,T.BRIDGE); setTile(24,24,T.BRIDGE);
  // 건물 배치
  setTile(22,7,T.MUSEUM);  setTile(23,7,T.MUSEUM);
  setTile(28,7,T.SHOP);    setTile(29,7,T.SHOP);
  setTile(19,7,T.NOOK_HQ); setTile(20,7,T.NOOK_HQ);
  setTile(28,34,T.PLAYER_HOUSE);
  VILLAGERS.forEach(v=>{ setTile(v.pos[0],v.pos[1],T.VILLAGER_HOUSE); });
  // 길
  for(let x=14;x<34;x++) if(getTile(x,8)===T.CLIFF) setTile(x,8,T.PATH);
  for(let y=17;y<36;y++){ if(getTile(22,y)===T.GRASS) setTile(22,y,T.PATH);
                          if(getTile(25,y)===T.GRASS) setTile(25,y,T.PATH); }
  // 나무 랜덤 배치
  const treeSeeds=[[12,20],[15,18],[17,22],[30,20],[33,18],[35,22],
                    [12,28],[15,26],[30,28],[33,26],[12,8],[16,8],[32,8],[36,8],
                    [13,11],[17,12],[31,11],[35,12]];
  treeSeeds.forEach(([tx,ty])=>{
    if(getTile(tx,ty)===T.GRASS||getTile(tx,ty)===T.CLIFF){
      setTile(tx,ty,T.TREE);
      const fr=FRUIT_POOL[Math.floor(Math.random()*FRUIT_POOL.length)];
      gs.world_trees[`${tx},${ty}`]={fruit:fr, grown:2, lastShake:0, shakeCount:0};
    }
  });
  // 꽃
  const flowerSpots=[[14,20],[16,21],[31,20],[33,21],[14,28],[33,28],
                      [20,18],[28,18],[20,26],[28,26],[18,10],[30,10]];
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
  [[19,22],[26,21],[18,28],[32,27],[21,11],[27,12]].forEach(([rx,ry])=>{
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
    const randCol = rng(s, 99);
    if (randCol < 0.22) {
      baseColorVal = 0x70c544; // 밝은 라임 연녹
    } else if (randCol >= 0.22 && randCol < 0.8) {
      baseColorVal = 0x61b238; // 화사한 초록 (기본)
    } else {
      baseColorVal = 0x51982b; // 차분하고 어두운 초록
    }
  }

  // 2. 타일별 PBR 머티리얼 구성
  let tileMat;
  initTextures();

  if ([T.GRASS, T.TREE, T.FLOWER, T.ROCK, T.DIG_SPOT, T.CLIFF].includes(t)) {
    tileMat = new THREE.MeshStandardMaterial({
      color: baseColorVal,
      roughness: 0.72,
      metalness: 0.05,
      map: TEXTURES.grass,
      bumpMap: TEXTURES.grassBump,
      bumpScale: 0.012
    });
  } else if (t === T.BEACH) {
    tileMat = new THREE.MeshStandardMaterial({
      color: baseColorVal,
      roughness: 0.85,
      metalness: 0.02,
      map: TEXTURES.sand
    });
  } else if (t === T.PATH) {
    tileMat = new THREE.MeshStandardMaterial({
      color: baseColorVal,
      roughness: 0.65,
      metalness: 0.08,
      map: TEXTURES.path,
      bumpMap: TEXTURES.pathBump,
      bumpScale: 0.032
    });
  } else {
    tileMat = mat(baseColorVal, 0.45, 0.08);
  }

  // HSL 색상 노이즈 주입 (자연스러운 그라데이션)
  if ([T.GRASS, T.TREE, T.FLOWER, T.ROCK, T.DIG_SPOT, T.CLIFF, T.BEACH, T.PATH].includes(t)) {
    const c = new THREE.Color(baseColorVal);
    const hsl = {};
    c.getHSL(hsl);
    const hNoise = (rng(s, 11) - 0.5) * 0.02;
    const sNoise = (rng(s, 12) - 0.5) * 0.03;
    const lNoise = (rng(s, 13) - 0.5) * 0.04;
    c.setHSL(
      Math.max(0, Math.min(1, hsl.h + hNoise)),
      Math.max(0, Math.min(1, hsl.s + sNoise)),
      Math.max(0, Math.min(1, hsl.l + lNoise))
    );
    tileMat.color.copy(c);
  }

  // 3. 지형 타일을 장난감 같은 둥근 박스형(Rounded Box)으로 생성
  // 물이나 다리는 지면 상자 없이 투명하게 빌드
  if (t !== T.OCEAN && t !== T.RIVER && t !== T.WATERFALL && t !== T.BRIDGE) {
    const rBoxGeo = getRoundedBoxGeometry(CS, baseH, CS, 0.04, 3);
    const box = new THREE.Mesh(rBoxGeo, tileMat);
    box.position.y = h - baseH/2;
    box.receiveShadow = true;
    box.castShadow = true;
    g.add(box);
  }

  // 4. 세부 장식 배치
  addTileDecor(g, t, x, y, h);

  G.exteriorRoot.add(g);
  G.tileMeshes.set(key, g);
}

function addTileDecor(g, t, x, y, h) {
  const gs = G.gs;
  const s = x*1000+y;
  initTextures();

  switch(t) {
    case T.OCEAN: case T.RIVER: case T.WATERFALL: {
      // 1. 공용 물 셰이더 메쉬 부착
      if (TEXTURES.waterMaterial) {
        const rp = new THREE.Mesh(new THREE.PlaneGeometry(CS * 1.01, CS * 1.01), TEXTURES.waterMaterial);
        rp.rotation.x = -Math.PI / 2;
        rp.position.y = h + 0.04;
        rp.receiveShadow = true;
        g.add(rp);
      }
      
      // 폭포 물리 메쉬 (수직 낙하)
      if(t === T.WATERFALL && TEXTURES.waterMaterial) {
        const wf = new THREE.Mesh(new THREE.PlaneGeometry(CS * 0.62, 0.9), TEXTURES.waterMaterial);
        wf.position.set(0, h + 0.45, -CS/2 + 0.02);
        g.add(wf);
      }
      break;
    }
    case T.BRIDGE: {
      // 다리 아래 부드러운 타원 그림자 (NormalBlending으로 알파 페이드 지원)
      if (TEXTURES.shadowBlob) {
        const shGeo = new THREE.PlaneGeometry(CS * 1.2, CS * 1.2);
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.52, depthWrite: false });
        const sh = new THREE.Mesh(shGeo, shMat);
        sh.rotation.x = -Math.PI/2;
        sh.position.y = h - 0.08; // 물 밑 바닥에 투사
        g.add(sh);
      }

      // 둥글둥글하고 아늑한 나무 통나무 다리 (Wooden Log Bridge)
      const bridgeGroup = new THREE.Group();
      bridgeGroup.position.y = h + 0.08;
      
      const woodMat = new THREE.MeshStandardMaterial({ color: 0xbf8a4e, roughness: 0.78, metalness: 0.05 });
      const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x8b5b2e, roughness: 0.85 });

      // 5개 개별 통나무 상판 배치
      const numLogs = 5;
      const logWidth = CS / numLogs;
      for (let i = 0; i < numLogs; i++) {
        const logOffset = -CS/2 + logWidth/2 + i * logWidth;
        const logGeo = getRoundedBoxGeometry(logWidth * 0.9, 0.16, CS * 1.05, 0.02, 2);
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

      // 좌우 수평 나무 손잡이 대 (Handrails)
      const railGeo = getRoundedBoxGeometry(0.06, 0.06, CS, 0.02, 2);
      const railL = new THREE.Mesh(railGeo, darkWoodMat);
      railL.position.set(-CS/2 + 0.1, postHeight - 0.05, 0);
      railL.castShadow = true;
      bridgeGroup.add(railL);

      const railR = new THREE.Mesh(railGeo, darkWoodMat);
      railR.position.set(CS/2 - 0.1, postHeight - 0.05, 0);
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
      // 18% 확률로 살랑이는 풀잎 장식 생성
      if(rng(s,5)<0.18){
        if(!G.grassBlades) G.grassBlades = [];
        const key = `${x},${y}`;
        for(let i=0;i<3;i++){
          const blade=mesh(new THREE.CylinderGeometry(0.015,0.03,0.18+rng(s,i+10)*0.1,4),0x5caa38,false);
          blade.position.set((rng(s,i+20)-.5)*CS*.7, h+0.09, (rng(s,i+30)-.5)*CS*.7);
          blade.rotation.y=rng(s,i+40)*Math.PI*2;
          
          blade.userData.origRotX = blade.rotation.x;
          blade.userData.origRotZ = blade.rotation.z;
          blade.userData.windPhase = rng(s, i+50) * Math.PI * 2;
          blade.userData.tileKey = key;
          
          g.add(blade);
          G.grassBlades.push(blade);
        }
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
      const path=new THREE.Mesh(new THREE.PlaneGeometry(CS,CS),
        new THREE.MeshStandardMaterial({
          color:0xd4c890,
          map:TEXTURES.path,
          bumpMap:TEXTURES.pathBump,
          bumpScale:0.028,
          roughness:0.7,
          metalness:0.08
        }));
      path.rotation.x=-Math.PI/2; path.position.y=h+0.01;
      path.receiveShadow=true;
      g.add(path); 
      
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
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.35, depthWrite: false });
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
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.65, depthWrite: false });
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
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.58, depthWrite: false });
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
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.68, depthWrite: false });
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
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.68, depthWrite: false });
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
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.68, depthWrite: false });
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
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.68, depthWrite: false });
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
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.68, depthWrite: false });
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

  const w = CS * 1.8;
  const d = CS * 1.6;
  const hi = 1.4;

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf4e6c3, roughness: 0.8 }); // 밝은 나무
  const wall = new THREE.Mesh(getRoundedBoxGeometry(w, hi, d, 0.08, 3), wallMat);
  wall.position.y = hi/2;
  wall.castShadow = true; wall.receiveShadow = true;
  shopGroup.add(wall);

  const roofMat = new THREE.MeshStandardMaterial({ color: 0xd84830, roughness: 0.62 }); // 빨간 지붕
  const roofL = new THREE.Mesh(getRoundedBoxGeometry(w * 0.68, 0.12, d * 1.15, 0.02, 2), roofMat);
  roofL.position.set(-w/4 - 0.02, hi + 0.25, 0);
  roofL.rotation.z = 0.5;
  roofL.castShadow = true;
  shopGroup.add(roofL);

  const roofR = new THREE.Mesh(getRoundedBoxGeometry(w * 0.68, 0.12, d * 1.15, 0.02, 2), roofMat);
  roofR.position.set(w/4 + 0.02, hi + 0.25, 0);
  roofR.rotation.z = -0.5;
  roofR.castShadow = true;
  shopGroup.add(roofR);

  // 상점 대표 노란 간판 (Leaf 로고 포함)
  const signBack = new THREE.Mesh(getRoundedBoxGeometry(1.0, 0.42, 0.1, 0.02, 2), new THREE.MeshStandardMaterial({ color: 0x8b5b2e }));
  signBack.position.set(0, hi + 0.45, d/2 - 0.15);
  signBack.castShadow = true;
  shopGroup.add(signBack);

  const signBoard = new THREE.Mesh(getRoundedBoxGeometry(0.9, 0.34, 0.04, 0.01, 2), new THREE.MeshStandardMaterial({ color: 0xffdd44, roughness: 0.5 }));
  signBoard.position.set(0, hi + 0.45, d/2 - 0.09);
  shopGroup.add(signBoard);

  const logo = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), new THREE.MeshBasicMaterial({ color: 0x4aa330 }));
  logo.scale.set(1.5, 0.8, 0.5);
  logo.position.set(0, hi + 0.45, d/2 - 0.06);
  shopGroup.add(logo);

  // 양측 대형 전시창 (Show windows)
  const winMat = new THREE.MeshStandardMaterial({ color: 0xefefef });
  const glassMat = new THREE.MeshBasicMaterial({ color: 0xaad8f5, transparent: true, opacity: 0.85 });
  [-0.45, 0.45].forEach(wx => {
    const winF = new THREE.Mesh(getRoundedBoxGeometry(0.42, 0.58, 0.06, 0.01, 2), winMat);
    winF.position.set(wx, hi * 0.45, d/2 + 0.01);
    shopGroup.add(winF);

    const winG = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.5), glassMat);
    winG.position.set(wx, hi * 0.45, d/2 + 0.045);
    shopGroup.add(winG);
  });

  // 문
  const door = new THREE.Mesh(getRoundedBoxGeometry(0.34, 0.88, 0.04, 0.01, 2), new THREE.MeshStandardMaterial({ color: 0x8b5b2e }));
  door.position.set(0, 0.44, d/2 + 0.01);
  shopGroup.add(door);

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

  const w = CS * 1.8;
  const d = CS * 1.8;
  const hi = 1.7;

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

  g.add(museumGroup);
}

// ─── 마을사무소 빌더 ──────────────────────────────────────────
export function buildNookHQ(g, h) {
  const hqGroup = new THREE.Group();
  hqGroup.position.y = h;

  const w = CS * 1.8;
  const d = CS * 1.8;
  const hi = 1.35;

  const logsMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.85 }); // 따뜻한 우드 로그
  const greenRoofMat = new THREE.MeshStandardMaterial({ color: 0x489650, roughness: 0.6 }); // 동숲식 녹색 지붕

  // 통나무 마을사무소 본체
  const wall = new THREE.Mesh(getRoundedBoxGeometry(w, hi, d, 0.08, 3), logsMat);
  wall.position.y = hi/2;
  wall.castShadow = true; wall.receiveShadow = true;
  hqGroup.add(wall);

  // 박공 녹색 지붕
  const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, 0.8, 4), greenRoofMat);
  roof.position.y = hi + 0.36;
  roof.rotation.y = Math.PI/4;
  roof.scale.set(1.2, 1.0, 1.2);
  roof.castShadow = true;
  hqGroup.add(roof);

  // 깃대 & 깃발
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.0, 6), new THREE.MeshStandardMaterial({ color: 0xefefef }));
  pole.position.set(w/2 - 0.15, hi + 0.75, 0);
  pole.castShadow = true;
  hqGroup.add(pole);

  const flag = new THREE.Mesh(getRoundedBoxGeometry(0.3, 0.22, 0.02, 0.005, 2), new THREE.MeshStandardMaterial({ color: 0xffe066 }));
  flag.position.set(w/2 - 0.02, hi + 1.15, 0);
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
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, CS * 0.72, 1.3, 3), canvasMat);
    body.rotation.y = Math.PI / 6;
    body.position.set(0, 0.65, 0);
    body.scale.set(1, 1, 1.25);
    body.castShadow = true; body.receiveShadow = true;
    tentGroup.add(body);

    // 입구 스킨 플랩
    const flapGeo = getRoundedBoxGeometry(CS * 0.35, 1.0, 0.04, 0.01, 2);
    const flapL = new THREE.Mesh(flapGeo, canvasMat);
    flapL.position.set(-0.25, 0.5, CS * 0.4);
    flapL.rotation.y = 0.5;
    flapL.rotation.z = -0.15;
    tentGroup.add(flapL);

    const flapR = new THREE.Mesh(flapGeo, canvasMat);
    flapR.position.set(0.25, 0.5, CS * 0.4);
    flapR.rotation.y = -0.5;
    flapR.rotation.z = 0.15;
    tentGroup.add(flapR);

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

    g.add(tentGroup);
  } else {
    // 둥글둥글하고 아늑한 코티지 주택
    const houseGroup = new THREE.Group();
    houseGroup.position.y = h;

    const w = CS * (1.15 + lv * 0.15);
    const d = CS * 1.25;
    const hi = 1.35 + lv * 0.25;

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
    roofL.position.set(-w/4 - 0.04, hi + 0.28, 0);
    roofL.rotation.z = 0.55;
    roofL.castShadow = true;
    houseGroup.add(roofL);

    const roofR = new THREE.Mesh(getRoundedBoxGeometry(rW, rT, rD, 0.02, 2), roofMat);
    roofR.position.set(w/4 + 0.04, hi + 0.28, 0);
    roofR.rotation.z = -0.55;
    roofR.castShadow = true;
    houseGroup.add(roofR);

    // 지붕 리지
    const ridge = new THREE.Mesh(getRoundedBoxGeometry(w * 0.06, w * 0.06, rD * 1.02, 0.01, 2), roofTrimMat);
    ridge.position.set(0, hi + 0.52, 0);
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
    const doorFrame = new THREE.Mesh(getRoundedBoxGeometry(0.48, 0.84, 0.06, 0.01, 2), new THREE.MeshStandardMaterial({ color: 0x8b5b2e }));
    doorFrame.position.set(0, 0.42, d/2 + 0.02);
    houseGroup.add(doorFrame);

    const door = new THREE.Mesh(getRoundedBoxGeometry(0.4, 0.78, 0.04, 0.01, 2), new THREE.MeshStandardMaterial({ color: 0xb57b45, roughness: 0.7 }));
    door.position.set(0, 0.41, d/2 + 0.04);
    houseGroup.add(door);

    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4), new THREE.MeshStandardMaterial({ color: 0xffcc22, metalness: 0.8 }));
    knob.position.set(0.14, 0.38, d/2 + 0.065);
    houseGroup.add(knob);

    // 5. 따뜻하게 불 켜진 격자 창문
    const winFrame = new THREE.Mesh(getRoundedBoxGeometry(0.42, 0.42, 0.06, 0.01, 2), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    winFrame.position.set(w/3.2, hi * 0.58, d/2 + 0.02);
    houseGroup.add(winFrame);

    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), new THREE.MeshBasicMaterial({ color: 0xffdf66 }));
    glass.position.set(w/3.2, hi * 0.58, d/2 + 0.055);
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

  const w = CS * 1.2;
  const d = CS * 1.2;
  const hi = 1.35;

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xfffcf0, roughness: 0.72 });
  const wall = new THREE.Mesh(getRoundedBoxGeometry(w, hi, d, 0.08, 3), wallMat);
  wall.position.y = hi / 2;
  wall.castShadow = true; wall.receiveShadow = true;
  houseGroup.add(wall);

  // 귀여운 주민 버섯형 원뿔 지붕
  const roofColor = vi.color ?? 0xff88aa;
  const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.58 });
  const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, 0.8, 8), roofMat);
  roof.position.y = hi + 0.36;
  roof.rotation.y = Math.PI / 8;
  roof.scale.set(1.2, 1.0, 1.2);
  roof.castShadow = true;
  houseGroup.add(roof);

  // 문
  const door = new THREE.Mesh(getRoundedBoxGeometry(0.38, 0.74, 0.04, 0.01, 2), new THREE.MeshStandardMaterial({ color: 0x8b5b2e, roughness: 0.8 }));
  door.position.set(0, 0.37, d/2 + 0.02);
  door.castShadow = true;
  houseGroup.add(door);

  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), new THREE.MeshStandardMaterial({ color: 0xffcc22, metalness: 0.8 }));
  knob.position.set(0.12, 0.35, d/2 + 0.045);
  houseGroup.add(knob);

  // 동그란 아기자기 창문
  const winRing = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  winRing.rotation.x = Math.PI / 2;
  winRing.position.set(w/3.5, hi * 0.6, d/2 + 0.02);
  houseGroup.add(winRing);

  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), new THREE.MeshBasicMaterial({ color: 0xffdf66 }));
  glass.position.set(w/3.5, hi * 0.6, d/2 + 0.05);
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
