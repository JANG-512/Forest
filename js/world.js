// ═══════════════════════════════════════════════════════════════
// world.js — 지형 데이터 & 3D 타일 빌더
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

// ─── 세계 생성 ───────────────────────────────────────────────
export function generateWorld() {
  const gs = G.gs;
  if(!G.world) G.world = new Uint8Array(WW*WH);
  const world = G.world;
  // 기본: 바다
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
    // 풀잎 캐시 정리 (바람 애니메이션용)
    if (G.grassBlades) {
      G.grassBlades = G.grassBlades.filter(blade => blade.userData.tileKey !== key);
    }
  }
  const t=getTile(x,y);
  const h=TILE_HEIGHT[t]??0.08;
  const g=new THREE.Group();
  g.position.set(x*CS, 0, y*CS);

  // 지면 타일
  const baseH = 0.22;
  const baseColorVal = TILE_COLORS[t] ?? 0x72bb53;
  
  // 타일별 개별 머티리얼을 생성하여 HSL 편차 적용
  const tileMat = mat(baseColorVal, 0.45, 0.08); // stylized PBR: 적절한 roughness와 약간의 specular
  const box = new THREE.Mesh(new THREE.BoxGeometry(CS, baseH, CS), tileMat);
  box.position.y = h - baseH/2;
  box.receiveShadow=true; box.castShadow=false;

  // 절차적 패턴 텍스처 매핑 적용
  initTextures();
  if ([T.GRASS, T.TREE, T.FLOWER, T.ROCK, T.DIG_SPOT, T.CLIFF].includes(t)) {
    box.material.map = TEXTURES.grass;
    box.material.needsUpdate = true;
  } else if (t === T.BEACH) {
    box.material.map = TEXTURES.sand;
    box.material.needsUpdate = true;
  } else if (t === T.PATH) {
    box.material.map = TEXTURES.path;
    box.material.needsUpdate = true;
  }

  // 타일 색상 편차 (Hue/Brightness Variation) 적용
  const s = x * 1000 + y;
  if ([T.GRASS, T.TREE, T.FLOWER, T.ROCK, T.DIG_SPOT, T.CLIFF, T.BEACH, T.PATH].includes(t)) {
    const c = new THREE.Color(baseColorVal);
    const hsl = {};
    c.getHSL(hsl);
    // HSL에 아늑한 랜덤 노이즈 밸런스 주입
    const hNoise = (rng(s, 11) - 0.5) * 0.035;
    const sNoise = (rng(s, 12) - 0.5) * 0.04;
    const lNoise = (rng(s, 13) - 0.5) * 0.065;
    c.setHSL(
      Math.max(0, Math.min(1, hsl.h + hNoise)),
      Math.max(0, Math.min(1, hsl.s + sNoise)),
      Math.max(0, Math.min(1, hsl.l + lNoise))
    );
    box.material.color.copy(c);
  }

  g.add(box);

  // 타일별 3D 오브젝트 추가
  addTileDecor(g, t, x, y, h);

  G.exteriorRoot.add(g);
  G.tileMeshes.set(key, g);
}

function addTileDecor(g, t, x, y, h) {
  const gs = G.gs;
  const s = x*1000+y;
  switch(t) {
    case T.OCEAN: {
      // 바다 물결 애니메이션 판
      const rp=new THREE.Mesh(new THREE.PlaneGeometry(CS,CS),
        new THREE.MeshStandardMaterial({
          color:0x3ba8c8,
          map:TEXTURES.water,
          transparent:true,
          opacity:0.75,
          roughness:0.06,
          metalness:0.1
        }));
      rp.rotation.x=-Math.PI/2; rp.position.y=h+0.05;
      g.add(rp);
      break;
    }
    case T.RIVER: case T.WATERFALL: {
      // 강물 반투명도 & specular 설정
      const rp=new THREE.Mesh(new THREE.PlaneGeometry(CS,CS),
        new THREE.MeshStandardMaterial({
          color:0x4faed6, 
          map:TEXTURES.water,
          transparent:true,
          opacity:0.72,
          roughness:0.08,
          metalness:0.15
        }));
      rp.rotation.x=-Math.PI/2; rp.position.y=h+0.04;
      g.add(rp);

      // 연안 포말선 (Shoreline foam highlight)
      const foamGeom = new THREE.PlaneGeometry(CS * 1.08, CS * 1.08);
      const foamMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.25,
        depthWrite: false
      });
      const foam = new THREE.Mesh(foamGeom, foamMat);
      foam.rotation.x = -Math.PI / 2;
      foam.position.y = h + 0.035;
      g.add(foam);

      if(t===T.WATERFALL){
        const wf=mesh(new THREE.BoxGeometry(CS*0.6,0.9,0.15),0x90d8f0);
        wf.position.set(0,h+0.45,-CS/2+0.1); wf.material.transparent=true;wf.material.opacity=0.7;
        g.add(wf);
      }
      break;
    }
    case T.BRIDGE: {
      // 다리 아래 그림자 블롭
      if (TEXTURES.shadowBlob) {
        const shGeo = new THREE.PlaneGeometry(CS, CS);
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.MultiplyBlending });
        const sh = new THREE.Mesh(shGeo, shMat);
        sh.rotation.x = -Math.PI/2;
        sh.position.y = h + 0.01;
        g.add(sh);
      }
      const plank=mesh(new THREE.BoxGeometry(CS,0.08,CS),0xb09060);
      plank.position.y=h+0.04; g.add(plank);
      [-0.45,0.45].forEach(bx=>{
        const rail=mesh(new THREE.BoxGeometry(0.08,0.25,CS),0xc0a870);
        rail.position.set(bx*CS,h+0.15,0); g.add(rail);
      }); break;
    }
    case T.BEACH: {
      if(rng(s,1)<0.12){
        const shell=mesh(new THREE.SphereGeometry(0.12,6,4),0xf0e0b8);
        shell.scale.y=0.5;
        shell.position.set((rng(s,2)-.5)*CS*.7, h+0.06, (rng(s,3)-.5)*CS*.7);
        g.add(shell);
      } break;
    }
    case T.CLIFF: {
      // 흙 바탕 절벽 벽면 (둥그스름한 느낌)
      const cliffWall = mesh(new THREE.BoxGeometry(CS, 0.72, 0.16), 0x7c5a3f);
      cliffWall.position.set(0, h - 0.28, CS/2 - 0.08);
      g.add(cliffWall);
      // 상단의 잔디 덮개
      const cliffGrass = mesh(new THREE.BoxGeometry(CS * 1.02, 0.15, 0.22), 0x5ba83b);
      cliffGrass.position.set(0, h + 0.02, CS/2 - 0.07);
      g.add(cliffGrass);
      break;
    }
    case T.GRASS: {
      if(rng(s,5)<0.18){
        if(!G.grassBlades) G.grassBlades = [];
        const key = `${x},${y}`;
        for(let i=0;i<3;i++){
          const blade=mesh(new THREE.CylinderGeometry(0.02,0.04,0.18+rng(s,i+10)*0.1,4),0x5caa38,false);
          blade.position.set((rng(s,i+20)-.5)*CS*.7, h+0.09, (rng(s,i+30)-.5)*CS*.7);
          blade.rotation.y=rng(s,i+40)*Math.PI*2;
          
          blade.userData.origRotX = blade.rotation.x;
          blade.userData.origRotZ = blade.rotation.z;
          blade.userData.windPhase = rng(s, i+50) * Math.PI * 2;
          blade.userData.tileKey = key;
          
          g.add(blade);
          G.grassBlades.push(blade);
        }
      } break;
    }
    case T.PATH: {
      const path=new THREE.Mesh(new THREE.PlaneGeometry(CS,CS),
        new THREE.MeshStandardMaterial({color:0xd4c890,map:TEXTURES.path,roughness:0.8,metalness:0.1}));
      path.rotation.x=-Math.PI/2; path.position.y=h+0.01;
      path.receiveShadow=true;
      g.add(path); break;
    }
    case T.FLOWER: {
      // 꽃 밑 그림자
      if (TEXTURES.shadowBlob) {
        const shGeo = new THREE.PlaneGeometry(0.4, 0.4);
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.MultiplyBlending });
        const sh = new THREE.Mesh(shGeo, shMat);
        sh.rotation.x = -Math.PI/2;
        sh.position.y = h + 0.01;
        g.add(sh);
      }
      const fd=gs.world_flowers[`${x},${y}`]||{type:'🌸',watered:false};
      // 줄기
      const stem=mesh(new THREE.CylinderGeometry(0.015,0.025,0.3,5),0x5caa38,false);
      stem.position.y=h+0.15; g.add(stem);
      
      // 꽃머리 그룹 (비스듬하게 회전)
      const flowerHead = new THREE.Group();
      flowerHead.position.set(0, h+0.3, 0);
      flowerHead.rotation.x = Math.PI / 6;

      const FLOWER_COLS=[0xff88cc,0xffdd00,0xff4488,0xffcc00,0xff66aa];
      const fidx=['🌸','🌼','🌺','🌻','💐'].indexOf(fd.type);
      const fc=FLOWER_COLS[fidx>=0?fidx:0];

      // 5개 꽃잎 조립
      for (let i = 0; i < 5; i++) {
        const petal = mesh(new THREE.SphereGeometry(0.09, 6, 5), fc, false);
        const angle = (i * Math.PI * 2) / 5;
        petal.position.set(Math.cos(angle) * 0.11, Math.sin(angle) * 0.11, 0);
        petal.scale.set(1.2, 0.7, 0.5);
        petal.rotation.z = angle;
        flowerHead.add(petal);
      }

      // 중앙 노란 씨방
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
      const offx=(rng(s,1)-.5)*0.3, offz=(rng(s,2)-.5)*0.3;
      
      // 나무 밑 그림자 블롭
      if (TEXTURES.shadowBlob) {
        const shGeo = new THREE.PlaneGeometry(1.2, 1.2);
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.65, depthWrite: false, blending: THREE.MultiplyBlending });
        const sh = new THREE.Mesh(shGeo, shMat);
        sh.rotation.x = -Math.PI/2;
        sh.position.set(offx, h + 0.012, offz);
        g.add(sh);
      }

      // 줄기
      const trunkY = 0.7 + td.grown*0.2;
      const trunk=mesh(new THREE.CylinderGeometry(0.14,0.19,trunkY,8),0x8b5e3c);
      trunk.position.set(offx, h+trunkY/2, offz); g.add(trunk);
      if(td.grown>=2){
        // 구름 스타일로 풍성하게 뭉게뭉게 피어나는 3D 수관 (6개 잎사귀 구체 조립)
        const leafCol = 0x4a9e30;
        const centerLeaves = mesh(new THREE.SphereGeometry(0.65, 9, 8), leafCol);
        centerLeaves.position.set(offx, h + trunkY, offz);
        g.add(centerLeaves);

        const subLeaves = [
          {x:-0.32, y:0.18, z:0, r:0.42},
          {x:0.32, y:0.18, z:0, r:0.42},
          {x:0, y:-0.12, z:0.32, r:0.45},
          {x:0, y:-0.12, z:-0.32, r:0.45},
          {x:0, y:0.35, z:0, r:0.38}
        ];
        subLeaves.forEach(sL => {
          const lf = mesh(new THREE.SphereGeometry(sL.r, 8, 6), leafCol);
          lf.position.set(offx + sL.x, h + trunkY + sL.y, offz + sL.z);
          g.add(lf);
        });

        // 꼭지 줄기+잎사귀가 달린 3D 사과 열매
        const now=Date.now();
        if(td.lastShake===0||(now-td.lastShake)>86400000){
          const fr=ITEMS[td.fruit];
          if(fr){
            [[-0.45,0.7,0.15],[0.35,0.9,-0.15],[-0.2,1.25,0.3]].forEach(([fx2,fy2,fz2],i)=>{
              const fruitColor = ['apple','cherry'].includes(td.fruit)?0xee4444:
                                 td.fruit==='orange'?0xff9900:td.fruit==='pear'?0xddee44:0xee6666;
              const fruitGroup = new THREE.Group();
              fruitGroup.position.set(offx+fx2, h+fy2, offz+fz2);

              // 사과 본체
              const apple = mesh(new THREE.SphereGeometry(0.09, 7, 6), fruitColor);
              fruitGroup.add(apple);

              // 꼭지 줄기
              const stem = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.045, 4), 0x5c3317, false);
              stem.position.y = 0.1;
              stem.rotation.z = 0.25;
              fruitGroup.add(stem);

              // 잎사귀
              const leaf = mesh(new THREE.SphereGeometry(0.026, 5, 4), 0x4a9e30, false);
              leaf.position.set(0.025, 0.1, 0);
              leaf.scale.set(1.5, 0.6, 0.6);
              fruitGroup.add(leaf);

              g.add(fruitGroup);
            });
          }
        }
      } else {
        // 묘목
        const sapling=mesh(new THREE.CylinderGeometry(0.05,0.08,0.3,6),0x5caa38,false);
        sapling.position.set(offx,h+0.15,offz); g.add(sapling);
      }
      break;
    }
    case T.ROCK: {
      // 바위 밑 그림자
      if (TEXTURES.shadowBlob) {
        const shGeo = new THREE.PlaneGeometry(0.9, 0.9);
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.62, depthWrite: false, blending: THREE.MultiplyBlending });
        const sh = new THREE.Mesh(shGeo, shMat);
        sh.rotation.x = -Math.PI/2;
        sh.position.set(0, h + 0.012, 0);
        g.add(sh);
      }

      const rg=new THREE.SphereGeometry(0.48,8,6);
      const pos=rg.attributes.position;
      for(let i=0;i<pos.count;i++){
        pos.setXYZ(i, pos.getX(i)*(0.8+rng(s+i,1)*0.35),
                      pos.getY(i)*(0.6+rng(s+i,2)*0.3),
                      pos.getZ(i)*(0.8+rng(s+i,3)*0.35));
      }
      rg.computeVertexNormals();
      const rm=mesh(rg,0x9595a5); rm.position.y=h+0.22; g.add(rm);

      // 초록색 이끼 패치 덮개 데코 추가
      const mossGeom = new THREE.SphereGeometry(0.33, 6, 5);
      const moss = mesh(mossGeom, 0x5caa38, false);
      moss.position.set((rng(s,4)-0.5)*0.1, h + 0.32, (rng(s,5)-0.5)*0.1);
      moss.scale.set(1.1, 0.4, 1.1);
      g.add(moss);
      break;
    }
    case T.DIG_SPOT: {
      const xmark1=mesh(new THREE.BoxGeometry(0.5,0.04,0.08),0xc09a60,false);
      const xmark2=mesh(new THREE.BoxGeometry(0.08,0.04,0.5),0xc09a60,false);
      xmark1.rotation.y=Math.PI/4; xmark2.rotation.y=Math.PI/4;
      xmark1.position.y=xmark2.position.y=h+0.05;
      g.add(xmark1); g.add(xmark2); break;
    }
    case T.SHOP: {
      if (TEXTURES.shadowBlob) {
        const shGeo = new THREE.PlaneGeometry(CS * 2.1, CS * 2.1);
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.72, depthWrite: false, blending: THREE.MultiplyBlending });
        const sh = new THREE.Mesh(shGeo, shMat);
        sh.rotation.x = -Math.PI/2;
        sh.position.set(0, h + 0.012, 0);
        g.add(sh);
      }
      buildShop(g, h); break;
    }
    case T.MUSEUM: {
      if (TEXTURES.shadowBlob) {
        const shGeo = new THREE.PlaneGeometry(CS * 2.2, CS * 2.2);
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.72, depthWrite: false, blending: THREE.MultiplyBlending });
        const sh = new THREE.Mesh(shGeo, shMat);
        sh.rotation.x = -Math.PI/2;
        sh.position.set(0, h + 0.012, 0);
        g.add(sh);
      }
      buildMuseum(g, h); break;
    }
    case T.NOOK_HQ: {
      if (TEXTURES.shadowBlob) {
        const shGeo = new THREE.PlaneGeometry(CS * 2.1, CS * 2.1);
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.72, depthWrite: false, blending: THREE.MultiplyBlending });
        const sh = new THREE.Mesh(shGeo, shMat);
        sh.rotation.x = -Math.PI/2;
        sh.position.set(0, h + 0.012, 0);
        g.add(sh);
      }
      buildNookHQ(g, h); break;
    }
    case T.PLAYER_HOUSE: {
      if (TEXTURES.shadowBlob) {
        const shGeo = new THREE.PlaneGeometry(CS * 1.8, CS * 1.8);
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.72, depthWrite: false, blending: THREE.MultiplyBlending });
        const sh = new THREE.Mesh(shGeo, shMat);
        sh.rotation.x = -Math.PI/2;
        sh.position.set(0, h + 0.012, 0);
        g.add(sh);
      }
      buildPlayerHouse(g, h); break;
    }
    case T.VILLAGER_HOUSE: {
      if (TEXTURES.shadowBlob) {
        const shGeo = new THREE.PlaneGeometry(CS * 1.8, CS * 1.8);
        const shMat = new THREE.MeshBasicMaterial({ map: TEXTURES.shadowBlob, transparent: true, opacity: 0.72, depthWrite: false, blending: THREE.MultiplyBlending });
        const sh = new THREE.Mesh(shGeo, shMat);
        sh.rotation.x = -Math.PI/2;
        sh.position.set(0, h + 0.012, 0);
        g.add(sh);
      }
      const vi=VILLAGERS.find(v=>v.pos[0]===x&&v.pos[1]===y);
      buildVillagerHouse(g, h, vi); break;
    }
  }
}

// ─── 건물 3D 빌더 (실외) ─────────────────────────────────────
export function buildShop(g, h) {
  const wall=mesh(new THREE.BoxGeometry(CS*1.8,1.8,CS*1.8),0xf5e8c8);
  wall.position.y=h+0.9; g.add(wall);
  const roof=mesh(new THREE.ConeGeometry(CS*1.4,1.0,4),0xe05030);
  roof.position.y=h+2.3; roof.rotation.y=Math.PI/4; g.add(roof);
  // 간판
  const sign=mesh(new THREE.BoxGeometry(0.8,0.4,0.05),0xffe066);
  sign.position.set(0,h+1.3,CS*0.9); g.add(sign);
  // 창문
  [-0.5,0.5].forEach(wx=>{
    const win=mesh(new THREE.BoxGeometry(0.4,0.4,0.05),0xaadeee,false);
    win.position.set(wx,h+1.1,CS*0.9+0.01); g.add(win);
  });
}
export function buildMuseum(g, h) {
  const wall=mesh(new THREE.BoxGeometry(CS*1.8,2.0,CS*1.8),0xddd8b8);
  wall.position.y=h+1.0; g.add(wall);
  const roof=mesh(new THREE.BoxGeometry(CS*2.0,0.35,CS*2.0),0x9090a0);
  roof.position.y=h+2.2; g.add(roof);
  // 기둥
  [-0.7,0.7].forEach(cx=>{
    const col2=mesh(new THREE.CylinderGeometry(0.12,0.14,2.0,8),0xd8d2aa);
    col2.position.set(cx,h+1.0,CS*0.8); g.add(col2);
  });
}
export function buildNookHQ(g, h) {
  const wall=mesh(new THREE.BoxGeometry(CS*1.8,1.6,CS*1.8),0xaad8ee);
  wall.position.y=h+0.8; g.add(wall);
  const roof=mesh(new THREE.ConeGeometry(CS*1.3,0.8,6),0x4488cc);
  roof.position.y=h+2.1; g.add(roof);
  const flag=mesh(new THREE.BoxGeometry(0.3,0.5,0.05),0xffcc44);
  flag.position.set(0.2,h+2.5,0.1); g.add(flag);
}
export function buildPlayerHouse(g, h) {
  const lv=G.gs.house_level;
  if(lv===0){
    // 텐트
    const tent=mesh(new THREE.ConeGeometry(CS*0.8,1.4,6),0x88dd88);
    tent.position.y=h+0.7; g.add(tent);
  } else {
    const w=CS*(1.2+lv*0.2), hi=1.4+lv*0.3;
    const wall=mesh(new THREE.BoxGeometry(w,hi,CS*1.4),0xfff0e0);
    wall.position.y=h+hi/2; g.add(wall);
    const roof=mesh(new THREE.ConeGeometry(CS*(0.9+lv*0.15),0.8+lv*0.1,4),
      [0xe05030,0x3068c8,0x30c868,0xcc44cc][lv-1]||0xe05030);
    roof.position.y=h+hi+0.4; roof.rotation.y=Math.PI/4; g.add(roof);
    // 문
    const door=mesh(new THREE.BoxGeometry(0.4,0.7,0.06),0xa07040);
    door.position.set(0,h+0.35,CS*0.7+0.01); g.add(door);
  }
}
export function buildVillagerHouse(g, h, vi) {
  if(!vi) return;
  const wall=mesh(new THREE.BoxGeometry(CS*1.4,1.5,CS*1.4),0xfff8f0);
  wall.position.y=h+0.75; g.add(wall);
  const roof=mesh(new THREE.ConeGeometry(CS,0.7,4),new THREE.Color(vi.color).getHex());
  roof.position.y=h+1.85; roof.rotation.y=Math.PI/4; g.add(roof);
}
