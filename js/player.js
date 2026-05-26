// ═══════════════════════════════════════════════════════════════
// player.js — 입력/이동/카메라/도구/상호작용
// ═══════════════════════════════════════════════════════════════
import { G } from './game.js';
import { T, CS, CAM_EL, CAM_DST, WW, WH, WALKABLE, INTERACTABLE, VILLAGERS, FISH_POOL, BUG_POOL, ITEMS } from './config.js';
import { getTile, tileH, setTile, refreshTile } from './world.js';
import { animateLimbs, buildPlayer } from './character.js';
import { playSound, playBGM } from './audio.js';
import { enterBuilding, exitBuilding, INTERIOR } from './interior.js';
import { addItem, addMiles, checkMilestone, saveState } from './state.js';
import { notify, updateUI, spawnParticles, talkTo, openShop, openMuseum, openNookHQ, openHouseMenu, selectTool } from './ui.js';
import { mat, mesh, disposeMesh } from './renderer.js';
import { isBuildingDoorSide, moveWithWorldCollisions } from './collision.js';

// ─── 키보드 입력 ─────────────────────────────────────────────
export function initControls(){
  document.addEventListener('keydown',e=>{
    const tag=e.target?.tagName;
    if(tag==='INPUT'||tag==='TEXTAREA'){
      if(e.code==='Escape') e.target.blur();
      return;
    }
    G.keys[e.code]=true;
    if(e.code==='KeyQ') rotateCam(-1);
    if(e.code==='KeyE' && !G.dialogueOpen) tryInteract();
    if(e.code==='Escape') { if(typeof window.closeAllPanels==='function') window.closeAllPanels(); }
    if(e.code==='KeyI') { if(typeof window.togglePanel==='function') window.togglePanel('inv'); }
    // 카메라 회전
    if(e.code==='BracketLeft')  rotateCam(-1);
    if(e.code==='BracketRight') rotateCam(1);
  });
  document.addEventListener('keyup',e=>{ G.keys[e.code]=false; });
  document.addEventListener('click',playBGM,{once:true});
  document.addEventListener('keydown',playBGM,{once:true});
}

export function rotateCam(dir){ G.camAngle+=dir*Math.PI/2; }

export function toggleRun(){
  G.playerRunning=!G.playerRunning;
  const btn=document.getElementById('mb-run');
  if(btn) btn.classList.toggle('run-on',G.playerRunning);
  notify(G.playerRunning?'🏃 달리기 ON':'🚶 걷기 ON');
}

// ─── 모바일 컨트롤 ───────────────────────────────────────────
export function initMobileControls(){
  if(!('ontouchstart' in window)&&navigator.maxTouchPoints<1) return;
  const zone=document.getElementById('joystick-zone');
  const base=document.getElementById('joystick-base');
  const knob=document.getElementById('joystick-knob');
  zone.style.display='block';
  document.getElementById('mobile-btns').style.display='flex';

  const RADIUS=46;
  let touchId=null, cx=0, cy=0;

  function getCenter(){
    const r=base.getBoundingClientRect();
    cx=r.left+r.width/2; cy=r.top+r.height/2;
  }

  zone.addEventListener('touchstart',e=>{
    e.preventDefault();
    const t=e.changedTouches[0];
    touchId=t.identifier;
    getCenter();
    G.joystick.active=true;
    playBGM();
  },{passive:false});

  zone.addEventListener('touchmove',e=>{
    e.preventDefault();
    for(const t of e.changedTouches){
      if(t.identifier!==touchId) continue;
      const ddx=t.clientX-cx, ddy=t.clientY-cy;
      const dist=Math.sqrt(ddx*ddx+ddy*ddy);
      const clamped=Math.min(dist,RADIUS);
      const angle=Math.atan2(ddy,ddx);
      const kx=Math.cos(angle)*clamped, ky=Math.sin(angle)*clamped;
      knob.style.left=(50+kx/RADIUS*42)+'%';
      knob.style.top =(50+ky/RADIUS*42)+'%';
      knob.style.transform='translate(-50%,-50%)';
      G.joystick.x=kx/RADIUS;
      G.joystick.y=ky/RADIUS;
    }
  },{passive:false});

  const endTouch=e=>{
    for(const t of e.changedTouches){
      if(t.identifier!==touchId) continue;
      G.joystick.active=false; G.joystick.x=0; G.joystick.y=0;
      knob.style.left='50%'; knob.style.top='50%';
      touchId=null;
    }
  };
  zone.addEventListener('touchend',endTouch,{passive:false});
  zone.addEventListener('touchcancel',endTouch,{passive:false});

  // 모바일 BGM 트리거
  document.addEventListener('touchstart',playBGM,{once:true});
  // 모바일에서 패널 스크롤 허용
  document.querySelectorAll('.panel').forEach(p=>{
    p.addEventListener('touchmove',e=>e.stopPropagation(),{passive:true});
  });
}

// ─── 플레이어 이동 ───────────────────────────────────────────
export function updatePlayer(dt) {
  if(G.dialogueOpen || G.transitioning) return;
  const isRunning = G.playerRunning || !!(G.keys['ShiftLeft']||G.keys['ShiftRight']);
  const spd = isRunning ? 0.088 : 0.045;
  // 카메라 기준 방향 벡터
  const fw = {x:-Math.sin(G.camAngle), z:-Math.cos(G.camAngle)};
  const rt = {x: Math.cos(G.camAngle), z:-Math.sin(G.camAngle)};
  let dx=0, dz=0;

  if(G.keys['KeyW']||G.keys['ArrowUp'])    {dx+=fw.x;dz+=fw.z;}
  if(G.keys['KeyS']||G.keys['ArrowDown'])  {dx-=fw.x;dz-=fw.z;}
  if(G.keys['KeyA']||G.keys['ArrowLeft'])  {dx-=rt.x;dz-=rt.z;}
  if(G.keys['KeyD']||G.keys['ArrowRight']) {dx+=rt.x;dz+=rt.z;}

  // 조이스틱 입력
  if(G.joystick.active&&(Math.abs(G.joystick.x)>0.08||Math.abs(G.joystick.y)>0.08)){
    dx += fw.x*(-G.joystick.y) + rt.x*G.joystick.x;
    dz += fw.z*(-G.joystick.y) + rt.z*G.joystick.x;
  }

  G.playerMoving = !!(dx||dz);
  if(G.playerMoving){
    const len=Math.sqrt(dx*dx+dz*dz);
    dx/=len; dz/=len;
    
    // 이동 벡터에 기반한 월드 기준 G.playerDir 결정 (카메라 회전 대응)
    if(Math.abs(dz) > Math.abs(dx)){
      G.playerDir = dz < 0 ? 'up' : 'down';
    } else {
      G.playerDir = dx < 0 ? 'left' : 'right';
    }

    const nx=G.playerPos.x+dx*spd*dt;
    const nz=G.playerPos.z+dz*spd*dt;
    if(G.inInterior){
      // 방 경계 검사
      const cx=INTERIOR.CX, cz=INTERIOR.CZ;
      const isMuseum = G.interiorBuilding && G.interiorBuilding.type===T.MUSEUM;
      const halfW = isMuseum ? 16/2 : INTERIOR.ROOM_W/2;
      const halfD = isMuseum ? 20/2 : INTERIOR.ROOM_D/2;
      const minX=cx-halfW+0.5, maxX=cx+halfW-0.5;
      const minZ=cz-halfD+0.5, maxZ=cz+halfD-0.2;
      if(nx>=minX&&nx<=maxX) G.playerPos.x=nx;
      if(nz>=minZ&&nz<=maxZ) G.playerPos.z=nz;
    } else {
      const moved = moveWithWorldCollisions(
        G.playerPos.x, G.playerPos.z, nx, nz, 0.28,
        {walkable:WALKABLE, allowDoorApproach:true}
      );
      G.playerPos.x=moved.x; G.playerPos.z=moved.z;
    }
    G.playerMesh.rotation.y=Math.atan2(dx,dz);
    G.moveAccum+=dt;
    const stepInterval = isRunning ? 10 : 18;
    if(G.moveAccum>stepInterval){G.moveAccum=0;playSound('step');}
  }

  const th = G.inInterior ? INTERIOR.FLOOR_Y : tileH(Math.round(G.playerPos.x/CS),Math.round(G.playerPos.z/CS));
  if (G.playerMesh) {
    G.playerMesh.position.set(G.playerPos.x, th, G.playerPos.z);
    // 걷기/달리기 bob
    if (G.playerMesh.userData.visualGroup) {
      G.playerMesh.userData.visualGroup.position.y = 0;
    }
    if (G.playerMesh.userData.shadowMesh) {
      G.playerMesh.userData.shadowMesh.scale.set(1, 1, 1);
    }
    if(G.playerMoving){
      const bobSpeed = isRunning ? 0.022 : 0.013;
      const bobAmp   = isRunning ? 0.08  : 0.05;
      const bobY = Math.abs(Math.sin(performance.now()*bobSpeed))*bobAmp;
      if (G.playerMesh.userData.visualGroup) {
        G.playerMesh.userData.visualGroup.position.y = bobY;
        if (G.playerMesh.userData.shadowMesh) {
          const scaleVal = Math.max(0.6, 1.0 - bobY * 1.5);
          G.playerMesh.userData.shadowMesh.scale.set(scaleVal, scaleVal, 1);
        }
      } else {
        G.playerMesh.position.y = th + bobY;
      }
    } else {
      if (G.playerMesh.userData.visualGroup) {
        const idleBob = Math.sin(performance.now()*0.0025)*0.015;
        G.playerMesh.userData.visualGroup.position.y = idleBob;
        if (G.playerMesh.userData.shadowMesh) {
          const scaleVal = Math.max(0.6, 1.0 - idleBob * 0.5);
          G.playerMesh.userData.shadowMesh.scale.set(scaleVal, scaleVal, 1);
        }
      }
    }
  }

  // E키 스윙 타이머 갱신
  if (G.toolSwingTimer === undefined) G.toolSwingTimer = 0;
  if (G.toolSwingTimer > 0) {
    G.toolSwingTimer -= dt;
    if (G.toolSwingTimer < 0) G.toolSwingTimer = 0;
  }

  // 팔다리 애니메이션
  animateLimbs(G.playerLimbs, G.playerMoving, 0, isRunning);

  // 스윙 도중 오른팔 각도 덮어쓰기 적용
  if (G.toolSwingTimer > 0 && G.playerLimbs.rightArm) {
    const maxSwing = 12;
    const progress = Math.max(0, Math.min(1, (maxSwing - G.toolSwingTimer) / maxSwing));
    let swingAngle = 0;
    if (progress < 0.2) {
      swingAngle = - (progress / 0.2) * 1.0;
    } else if (progress < 0.5) {
      const t2 = (progress - 0.2) / 0.3;
      swingAngle = -1.0 + t2 * 2.6; // swings from -1.0 to +1.6
    } else {
      const t3 = (progress - 0.5) / 0.5;
      swingAngle = 1.6 - t3 * 1.6;
    }
    G.playerLimbs.rightArm.rotation.x = swingAngle;
  }

  updateFacingMarker();
}

// ─── 카메라 시스템 (AC 고정 각도) ────────────────────────────
export function updateCamera() {
  const px=G.playerPos.x, pz=G.playerPos.z;
  G.camTargetX+=(px-G.camTargetX)*0.1;
  G.camTargetZ+=(pz-G.camTargetZ)*0.1;
  const dst = G.inInterior ? 20 : CAM_DST;
  const cx=G.camTargetX+dst*Math.sin(G.camAngle)*Math.cos(CAM_EL);
  const cy=dst*Math.sin(CAM_EL)+1;
  const cz=G.camTargetZ+dst*Math.cos(G.camAngle)*Math.cos(CAM_EL);
  G.camera.position.set(cx,cy,cz);
  G.camera.lookAt(G.camTargetX,1.0,G.camTargetZ);
  G.sunLight.position.set(G.camTargetX+20,40,G.camTargetZ+15);
  G.sunLight.target.position.set(G.camTargetX,0,G.camTargetZ);
  G.sunLight.target.updateMatrixWorld();
}

// ─── 낚시 시스템 ─────────────────────────────────────────────
function tryFish() {
  const ft=facingTile();
  const adj=[ft,{x:ft.x+1,y:ft.y},{x:ft.x-1,y:ft.y},{x:ft.x,y:ft.y+1},{x:ft.x,y:ft.y-1}];
  const nearWater=adj.some(p=>getTile(p.x,p.y)===T.RIVER||getTile(p.x,p.y)===T.OCEAN);
  if(!nearWater){ notify('🎣 물가 근처에 서야 해요!'); return; }
  if(G.fishingState===null){
    G.fishingState='cast';
    G.fishingTimer=80+Math.random()*120;
    document.getElementById('fishing-ui').style.display='block';
    document.getElementById('fish-hint').textContent='🎣 찌를 던졌어요! 기다리세요...';
    document.getElementById('catch-bar').style.display='none';
    playSound('cast');
  }
}
export function updateFishing(dt){
  if(!G.fishingState) return;
  G.fishingTimer-=dt;
  if(G.fishingState==='cast'&&G.fishingTimer<=0){
    G.fishingState='bite';
    G.fishingTimer=40;
    document.getElementById('fish-hint').textContent='🐟 찌가 움직여요! E를 누르세요!';
    playSound('bite');
    notify('🐟 찌가 움직인다!');
  } else if(G.fishingState==='bite'){
    G.fishingTimer-=dt;
    if(G.fishingTimer<=0){
      G.fishingState=null;
      document.getElementById('fishing-ui').style.display='none';
      notify('😢 놓쳤어요...');
      playSound('miss');
    }
  } else if(G.fishingState==='catch'){
    G.catchProgress+=dt*1.8;
    document.getElementById('catch-fill').style.width=Math.min(G.catchProgress,100)+'%';
    if(G.catchProgress>=100){
      landFish();
    }
  }
}
function reelIn(){
  if(G.fishingState==='bite'){
    G.fishingState='catch';
    G.catchProgress=0;
    document.getElementById('catch-bar').style.display='block';
    document.getElementById('fish-hint').textContent='🎣 당겨요! E를 계속 누르세요!';
    playSound('reel');
  } else if(G.fishingState==='catch'){
    G.catchProgress+=8;
  }
}
function landFish(){
  const gs=G.gs;
  G.fishingState=null;
  document.getElementById('fishing-ui').style.display='none';
  let pool=[...FISH_POOL];
  const ft=facingTile();
  const inRiver=getTile(ft.x,ft.y)===T.RIVER;
  const river_fish=['dace','carp','crucian','goldfish','pale_chub','frog2'];
  const sea_fish=['sea_bass','oarfish','tuna','shark'];
  if(inRiver) pool=pool.filter(f=>river_fish.includes(f));
  else        pool=pool.filter(f=>sea_fish.includes(f)||Math.random()<0.3);
  if(!pool.length) pool=FISH_POOL;

  const fish=pool[Math.floor(Math.random()*pool.length)];
  const item=ITEMS[fish];
  addItem(fish,1);
  gs.total_fish++;
  notify(`🎣 ${item.emoji} ${item.name}을(를) 잡았어요!`);
  spawnParticles(G.playerPos.x, tileH(Math.round(G.playerPos.x/CS),Math.round(G.playerPos.z/CS))+1.5, G.playerPos.z, '💧', 5);
  checkMilestone('first_catch');
  if(Object.keys(gs.museum.fish).length>=5) checkMilestone('donate_fish');
  saveState(); updateUI();
  playSound('catch');
}

// ─── 벌레 채집 ────────────────────────────────────────────────
function tryBug(){
  const gs=G.gs;
  const ft=facingTile();
  const adjTiles=[ft,{x:ft.x,y:ft.y-1},{x:ft.x,y:ft.y+1}];
  const nearFlower=adjTiles.some(p=>{
    const t=getTile(p.x,p.y);
    return t===T.FLOWER||t===T.GRASS||t===T.TREE;
  });
  if(Math.random()<(nearFlower?0.65:0.35)){
    const r=Math.random();
    let cum=0;
    let caught=null;
    for(const bk of BUG_POOL){
      cum+=ITEMS[bk].rarity;
      if(r<cum){caught=bk;break;}
    }
    if(!caught) caught=BUG_POOL[0];
    addItem(caught,1);
    gs.total_bugs++;
    notify(`🦋 ${ITEMS[caught].emoji} ${ITEMS[caught].name}을(를) 잡았어요!`);
    spawnParticles(G.playerPos.x,tileH(Math.round(G.playerPos.x/CS),Math.round(G.playerPos.z/CS))+1.5,G.playerPos.z,'🦋',4);
    checkMilestone('first_bug');
    saveState(); updateUI();
    playSound('catch');
  } else {
    notify('😔 놓쳤어요...');
    playSound('miss');
  }
}

// ─── 화석 발굴 ────────────────────────────────────────────────
function tryShovel(){
  const gs=G.gs;
  const ft=facingTile();
  const key=`${ft.x},${ft.y}`;
  const ds=gs.world_dig_spots[key];
  if(ds&&!ds.found){
    ds.found=true;
    addItem(ds.fossil,1);
    gs.total_fossils++;
    notify(`💀 ${ITEMS[ds.fossil].emoji} ${ITEMS[ds.fossil].name}을(를) 발굴했어요!`);
    refreshTile(ft.x,ft.y);
    checkMilestone('first_fossil');
    saveState(); updateUI();
    playSound('dig');
  } else if(ft.t===T.FLOWER&&gs.world_flowers[key]){
    const fl=gs.world_flowers[key];
    delete gs.world_flowers[key];
    setTile(ft.x,ft.y,T.GRASS);
    refreshTile(ft.x,ft.y);
    addItem('seed_flower',1);
    notify('🌱 꽃씨를 얻었어요!');
    saveState(); updateUI();
  } else {
    notify('⛏️ 여기서 발굴할 수 없어요.');
  }
}

// ─── 나무 도끼 ────────────────────────────────────────────────
function tryAxe(){
  const gs=G.gs;
  const ft=facingTile();
  if(ft.t===T.TREE){
    const key=`${ft.x},${ft.y}`;
    addItem('wood',1+Math.floor(Math.random()*2));
    if(Math.random()<0.3) addItem('iron',1);
    const td=gs.world_trees[key];
    const now=Date.now();
    if(td&&(td.lastShake===0||(now-td.lastShake)>86400000)){
      td.lastShake=now;
      const cnt=1+Math.floor(Math.random()*2);
      addItem(td.fruit,cnt);
      notify(`🪓 ${ITEMS[td.fruit].emoji} 열매 ${cnt}개를 얻었어요!`);
      refreshTile(ft.x,ft.y);
    } else {
      notify('🪵 나무에서 목재를 얻었어요!');
    }
    saveState(); updateUI();
    playSound('chop');
  } else if(ft.t===T.ROCK){
    addItem('stone',1+Math.floor(Math.random()*2));
    if(Math.random()<0.2) addItem('iron',1);
    notify('🪨 돌을 얻었어요!');
    saveState(); updateUI();
    playSound('chop');
  } else {
    notify('여기서는 도끼를 사용할 수 없어요.');
  }
}

// ─── 물뿌리개 ─────────────────────────────────────────────────
function tryWatering(){
  const gs=G.gs;
  const ft=facingTile();
  const key=`${ft.x},${ft.y}`;
  if(ft.t===T.FLOWER&&gs.world_flowers[key]){
    gs.world_flowers[key].watered=true;
    notify('🌿 꽃에 물을 줬어요! 내일 더 예뻐질 거예요 🌸');
    refreshTile(ft.x,ft.y);
    checkMilestone('water_flower');
    saveState(); updateUI();
    playSound('water');
  } else if(ft.t===T.TREE){
    const td=gs.world_trees[key];
    if(td&&td.grown<2){ td.grown=Math.min(2,td.grown+1); refreshTile(ft.x,ft.y); notify('🌱 나무가 자라고 있어요!'); saveState(); }
    else notify('🌳 나무가 충분히 자랐어요!');
  } else {
    notify('🌿 물뿌리개를 사용할 곳이 없어요.');
  }
}

// ─── 상호작용 메인 ───────────────────────────────────────────
export function tryInteract(){
  if(typeof window.closeDialogue==='function' && G.dialogueOpen){ window.closeDialogue(); return; }
  if(G.fishingState==='bite'||G.fishingState==='catch'){ reelIn(); return; }

  // 실내에 있을 때
  if(G.inInterior){
    interiorInteract();
    return;
  }

  const ft=facingTile();

  // 주민과 대화 — NPC가 집을 떠나 돌아다니므로 실제 NPC 위치(월드 좌표)로 근접 판정
  const fcx=ft.x*CS, fcz=ft.y*CS;
  let chatVi=null, chatBest=CS*1.1;
  VILLAGERS.forEach(v=>{
    const st=G.npcState[v.id];
    if(!st) return;
    const d=Math.hypot(st.wx-fcx, st.wz-fcz);
    if(d<chatBest){ chatBest=d; chatVi=v; }
  });
  if(chatVi){ talkTo(chatVi); return; }

  // 건물 입장 → 외벽과 출입문을 구분해서 문 앞에서만 진입
  if([T.SHOP,T.MUSEUM,T.NOOK_HQ,T.PLAYER_HOUSE,T.VILLAGER_HOUSE].includes(ft.t)){
    if(!isBuildingDoorSide(ft.x, ft.y, G.playerPos.x, G.playerPos.z)){
      notify('문 앞에서 상호작용해야 들어갈 수 있어요.');
      return;
    }
    enterBuilding(ft.t, ft.x, ft.y);
    return;
  }

  // 낚시 개시
  if(G.currentTool==='rod') { G.toolSwingTimer = 12; tryFish(); return; }

  // 나무 흔들기 (맨손 및 그외)
  if(ft.t===T.TREE){
    if(!G.currentTool || G.currentTool==='net' || G.currentTool==='rod'){
      G.toolSwingTimer = 12;
      tryShakeTree(ft);
      return;
    }
  }

  // 도구 사용 시 스윙 동작
  if(G.currentTool && ['net','shovel','axe','watering'].includes(G.currentTool)){
    G.toolSwingTimer = 12;
  }

  // 도구 사용
  switch(G.currentTool){
    case 'net':      tryBug(); break;
    case 'shovel':   tryShovel(); break;
    case 'axe':      tryAxe(); break;
    case 'watering': tryWatering(); break;
  }
}

// 실내 상호작용: 문 근처면 나가기, 가구 근처면 패널
function interiorInteract(){
  const z=G.playerPos.z, type=G.interiorBuilding?.type;
  // 문 근처 → 나가기
  if(z>504){ exitBuilding(); return; }
  // 가구 근처 → 해당 패널
  if(type===T.SHOP && z<497){ openShop(); return; }
  if(type===T.NOOK_HQ && z<497){ openNookHQ(); return; }
  if(type===T.MUSEUM && z<497){ openMuseum(); return; }
  if(type===T.PLAYER_HOUSE){ openHouseMenu(); return; }
  if(type===T.VILLAGER_HOUSE){
    const vi=VILLAGERS.find(v=>v.pos[0]===G.interiorBuilding.bx&&v.pos[1]===G.interiorBuilding.by);
    if(vi) talkTo(vi);
    return;
  }
}

// ─── 도구 메쉬 및 애니메이션 추가 ───────────────────────────
export function updatePlayerToolMesh() {
  const arm = G.playerLimbs.rightArm;
  if (!arm) return;

  if (G.playerToolMesh) {
    arm.remove(G.playerToolMesh);
    disposeMesh(G.playerToolMesh);
    G.playerToolMesh = null;
  }

  const tool = G.currentTool;
  if (!tool) return;

  const group = new THREE.Group();
  group.position.set(0, -0.3, 0); // 오른손 끝 위치

  if (tool === 'net') {
    // 자루 (Wood Pole)
    const pole = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6), 0xd2b48c);
    pole.rotation.x = Math.PI / 2;
    pole.position.set(0, 0, 0.2);
    group.add(pole);

    // 림 (Rim)
    const rim = mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 8), 0xdddddd);
    rim.position.set(0, 0, 0.5);
    rim.rotation.x = Math.PI / 2;
    group.add(rim);

    // 채 (Net Bag)
    const bag = mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.2, 6, 1, true), 0xffffff, false);
    bag.material.transparent = true;
    bag.material.opacity = 0.55;
    bag.position.set(0, -0.1, 0.5);
    group.add(bag);

  } else if (tool === 'rod') {
    // 낚싯대
    const pole = mesh(new THREE.CylinderGeometry(0.008, 0.016, 0.75, 6), 0xdc143c);
    pole.rotation.x = Math.PI / 3;
    pole.position.set(0, 0.22, 0.22);
    group.add(pole);

    // 찌 (Bobber)
    const bobber = mesh(new THREE.SphereGeometry(0.035, 6, 6), 0xff4500);
    bobber.position.set(0, 0.55, 0.55);
    group.add(bobber);

  } else if (tool === 'shovel') {
    // 삽
    const shaft = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.5, 6), 0xcd853f);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.set(0, 0, 0.15);
    group.add(shaft);

    const blade = mesh(new THREE.BoxGeometry(0.14, 0.14, 0.018), 0xaaaaaa);
    blade.position.set(0, 0, 0.4);
    blade.rotation.x = Math.PI / 2;
    group.add(blade);

    const handle = mesh(new THREE.TorusGeometry(0.045, 0.012, 5, 8, Math.PI), 0x8b4513);
    handle.position.set(0, 0, -0.1);
    handle.rotation.y = Math.PI / 2;
    group.add(handle);

  } else if (tool === 'axe') {
    // 도끼
    const shaft = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.48, 6), 0xcd853f);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.set(0, 0, 0.15);
    group.add(shaft);

    const blade = mesh(new THREE.BoxGeometry(0.14, 0.09, 0.035), 0x4f4f4f);
    blade.position.set(0, 0.04, 0.3);
    group.add(blade);

    const edge = mesh(new THREE.BoxGeometry(0.018, 0.11, 0.075), 0xbbbbbb);
    edge.position.set(0, 0.04, 0.36);
    edge.rotation.y = Math.PI / 4;
    group.add(edge);

  } else if (tool === 'watering') {
    // 물뿌리개
    const body = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 8), 0x00bfff);
    body.position.set(0, 0, 0.05);
    body.rotation.x = Math.PI / 2;
    group.add(body);

    const spout = mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.1, 5), 0x00bfff);
    spout.position.set(0, 0.04, 0.16);
    spout.rotation.x = -Math.PI / 4;
    group.add(spout);

    const handle = mesh(new THREE.TorusGeometry(0.05, 0.012, 5, 8, Math.PI), 0x1e90ff);
    handle.position.set(0, 0, -0.04);
    handle.rotation.y = Math.PI / 2;
    group.add(handle);
  }

  arm.add(group);
  G.playerToolMesh = group;
}

function shakeTreeMesh(meshGroup) {
  let elapsed = 0;
  const duration = 20;
  function anim() {
    if (elapsed >= duration) {
      meshGroup.rotation.z = 0;
      meshGroup.rotation.x = 0;
      return;
    }
    elapsed++;
    const angle = Math.sin(elapsed * 0.8) * 0.12 * (1 - elapsed / duration);
    meshGroup.rotation.z = angle;
    meshGroup.rotation.x = angle * 0.5;
    requestAnimationFrame(anim);
  }
  anim();
}

function tryShakeTree(ft) {
  const key = `${ft.x},${ft.y}`;
  const gs = G.gs;
  if (!gs.world_trees[key]) {
    gs.world_trees[key] = {fruit: 'apple', grown: 2, lastShake: 0};
  }
  const treeData = gs.world_trees[key];

  // 1. 나무 흔들기 메쉬 연출
  const meshGroup = G.tileMeshes.get(key);
  if (meshGroup) {
    shakeTreeMesh(meshGroup);
  }

  // 2. 흔들기 소리
  playSound('rustle');

  // 3. 잎사귀 날림 파티클 연출 (녹색 잎사귀들)
  spawnParticles(ft.x * CS, tileH(ft.x, ft.y) + 1.8, ft.y * CS, '🍃', 6);

  // 4. 나뭇가지/벌집/과일 드랍 판단
  const r = Math.random();
  if (r < 0.12) {
    triggerBeeSwarm(ft);
  } else if (r < 0.47) {
    addItem('wood', 1);
    notify('🪵 나무를 흔들어 나뭇가지를 얻었습니다!');
    playSound('catch');
  } else {
    notify('🌳 나무가 바스락거립니다.');
  }

  // 과일 떨어뜨리기 추가 연동
  const now = Date.now();
  if (treeData.grown >= 2 && (treeData.lastShake === 0 || (now - treeData.lastShake) > 86400000)) {
    treeData.lastShake = now;
    const count = 1 + Math.floor(Math.random() * 2);
    addItem(treeData.fruit, count);
    notify(`🍎 ${ITEMS[treeData.fruit].emoji} 열매 ${count}개가 떨어졌습니다!`);
    refreshTile(ft.x, ft.y);
  }
}

function triggerBeeSwarm(ft) {
  notify('⚠️ 앗! 나무에서 벌집이 떨어졌습니다! 🐝');
  playSound('miss');
  
  // 벌집 낙하 파티클
  spawnParticles(ft.x * CS, tileH(ft.x, ft.y) + 1.2, ft.y * CS, '🍯', 3);

  // 벌 떼 스폰
  if (typeof window.spawnBees === 'function') {
    window.spawnBees(G.playerPos.x, G.playerPos.y + 0.5, G.playerPos.z);
  }

  // 1.8초 후 벌에 쏘임 처리
  setTimeout(() => {
    if (G.inInterior) {
      notify('🏠 휴! 실내로 피신해서 벌떼를 따돌렸습니다!');
      return;
    }
    
    G.playerStung = true;
    if (typeof window.buildPlayer === 'function') {
      window.buildPlayer();
    }
    playSound('miss');
    notify('🤕 으악! 벌떼에게 쏘여 한쪽 뺨이 퉁퉁 부어올랐습니다! 💊 약을 먹어 치료하세요.');
    saveState();
    updateUI();
  }, 1800);
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
  if(G.inInterior){ marker.visible=false; return; }
  const ft=facingTile();
  if(INTERACTABLE.has(ft.t)||G.gs.world_dig_spots[`${ft.x},${ft.y}`]||
     getTile(ft.x,ft.y)===T.RIVER){
    marker.visible=true;
    marker.position.set(ft.x*CS, tileH(ft.x,ft.y)+0.08, ft.y*CS);
  } else { marker.visible=false; }
}
