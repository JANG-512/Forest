// ═══════════════════════════════════════════════════════════════
// npc.js — 주민 NPC 빌더 & AI
// ═══════════════════════════════════════════════════════════════
import { G } from './game.js';
import { T, CS, VILLAGERS, NPC_SCENARIOS } from './config.js';
import { getTile, tileH } from './world.js';
import { animateLimbs, buildCharacter } from './character.js';
import { mat, mesh } from './renderer.js';
import { playSound } from './audio.js';

// 주민 NPC가 걸을 수 있는 타일 — FIX: VILLAGER_HOUSE 추가 (집으로 복귀 가능)
const NPC_WALK = new Set([T.GRASS,T.PATH,T.FLOWER,T.BRIDGE,T.BEACH,T.VILLAGER_HOUSE]);

export function buildNPC(vi) {
  const bc=vi.color;
  const r=((bc>>16)&0xff), gv=((bc>>8)&0xff), b=(bc&0xff);
  const lighter=((Math.min(r+70,255)<<16)|(Math.min(gv+70,255)<<8)|Math.min(b+70,255));
  const darker =((Math.max(r-50,0)<<16) |(Math.max(gv-50,0)<<8) |Math.max(b-50,0));

  const limbs={};
  const g = buildCharacter(lighter, bc, darker, bc, 0x3a2a1a, limbs);
  // 동물별 특징 추가
  if(vi.type==='bunny'){
    [-0.15,0.15].forEach(ex=>{
      const earO=mesh(new THREE.CylinderGeometry(0.07,0.09,0.6,7),bc);
      earO.position.set(ex,1.9,0); earO.rotation.z=ex>0?-0.13:0.13; g.add(earO);
      const earI=mesh(new THREE.CylinderGeometry(0.04,0.055,0.52,6),0xffb0bb);
      earI.position.set(ex,1.9,0.045); earI.rotation.z=ex>0?-0.13:0.13; g.add(earI);
    });
    const nose=mesh(new THREE.SphereGeometry(0.05,6,5),0xffaacc,false);
    nose.position.set(0,1.32,0.42); g.add(nose);
  } else if(vi.type==='bear'){
    [-0.24,0.24].forEach(ex=>{
      const earO=mesh(new THREE.SphereGeometry(0.14,8,6),bc);
      earO.position.set(ex,1.82,0); g.add(earO);
      const earI=mesh(new THREE.SphereGeometry(0.08,7,5),lighter);
      earI.position.set(ex,1.82,0.06); g.add(earI);
    });
    const muzzle=mesh(new THREE.SphereGeometry(0.16,9,7),lighter);
    muzzle.scale.set(1.1,0.78,0.68); muzzle.position.set(0,1.3,0.35); g.add(muzzle);
  } else if(vi.type==='frog'){
    [-0.2,0.2].forEach(ex=>{
      const eb=mesh(new THREE.SphereGeometry(0.15,9,7),bc);
      eb.position.set(ex,1.62,0.08); g.add(eb);
      const ew=mesh(new THREE.SphereGeometry(0.1,8,6),0xffffff,false);
      ew.position.set(ex,1.64,0.19); g.add(ew);
      const ep=mesh(new THREE.SphereGeometry(0.06,6,5),0x111111,false);
      ep.position.set(ex,1.64,0.26); g.add(ep);
    });
    const fSmile=mesh(new THREE.TorusGeometry(0.11,0.026,6,10,Math.PI),bc,false);
    fSmile.rotation.z=Math.PI; fSmile.position.set(0,1.24,0.39); g.add(fSmile);
  }

  // FIX: 집 타일 위가 아니라 집에서 남쪽으로 2칸 떨어진 곳에 스폰
  const spawnZ = (vi.pos[1]+2)*CS;
  g.position.set(vi.pos[0]*CS, 0, spawnZ);
  // 실내 진입 시 숨겨지도록 exteriorRoot에 추가
  G.exteriorRoot.add(g);
  G.npcMeshes[vi.id]=g;

  G.npcState[vi.id]={
    home:[vi.pos[0]*CS, vi.pos[1]*CS],
    wx:vi.pos[0]*CS, wz:spawnZ,
    dir:Math.random()*Math.PI*2,
    moveTimer:100+Math.random()*200,
    aiState:'WALK', stateTimer:0,
    personality:vi.personality||{energy:Math.random(),social:Math.random(),curious:Math.random()},
    memory:{playerVisits:0,lastPlayerItem:null,heardFrom:{},learnedPhrases:[],scenario:null},
    friendship:G.gs?(G.gs.talked_to[vi.id]||0):0,
    chatCooldown:0, targetVillager:null, targetPos:null,
    limbs,
  };
}

// ─── 주민 AI ─────────────────────────────────────────────────
function getNPCDialogue(vi, st) {
  const hour=new Date().getHours();
  for(const sc of NPC_SCENARIOS){
    if(sc.cond(st,hour)) return sc.gen(vi,st);
  }
  return `${vi.name}: ...`;
}

// 주민 간 대화 이벤트 (랜덤하게 발생, 서로 문구 공유)
export function tryVillagerChat(viA, viB) {
  const stA=G.npcState[viA.id], stB=G.npcState[viB.id];
  if(!stA||!stB) return;
  if(stA.chatCooldown>0||stB.chatCooldown>0) return;

  // 가까이 있을 때만
  const dx=stA.wx-stB.wx, dz=stA.wz-stB.wz;
  if(Math.sqrt(dx*dx+dz*dz)>CS*3) return;

  // 문구 공유 학습
  const phraseA=viA.dialogues[Math.floor(Math.random()*viA.dialogues.length)];
  const phraseB=viB.dialogues[Math.floor(Math.random()*viB.dialogues.length)];
  if(!stB.memory.learnedPhrases.includes(phraseA)) stB.memory.learnedPhrases.push(phraseA);
  if(!stA.memory.learnedPhrases.includes(phraseB)) stA.memory.learnedPhrases.push(phraseB);
  stA.memory.heardFrom[viB.id]=(stA.memory.heardFrom[viB.id]||0)+1;
  stB.memory.heardFrom[viA.id]=(stB.memory.heardFrom[viA.id]||0)+1;

  stA.chatCooldown=800; stB.chatCooldown=800;
  stA.aiState='CHAT_IDLE'; stB.aiState='CHAT_IDLE';
  stA.stateTimer=120; stB.stateTimer=120;
  // 두 주민이 서로 바라봄
  stA.dir=Math.atan2(stB.wx-stA.wx, stB.wz-stA.wz);
  stB.dir=Math.atan2(stA.wx-stB.wx, stA.wz-stB.wz);
}

export function updateNPCs(dt) {
  // 실내에 있을 땐 주민 업데이트 생략 (exteriorRoot가 숨겨짐)
  if(G.inInterior) return;
  const hour=new Date().getHours();

  // 주민 간 대화 시도 (매 120프레임마다)
  if(Math.floor(performance.now()/120)%3===0){
    for(let i=0;i<VILLAGERS.length;i++){
      for(let j=i+1;j<VILLAGERS.length;j++){
        if(Math.random()<0.02) tryVillagerChat(VILLAGERS[i],VILLAGERS[j]);
      }
    }
  }

  VILLAGERS.forEach(vi=>{
    const m=G.npcMeshes[vi.id], st=G.npcState[vi.id];
    if(!m||!st) return;

    // 밤엔 잠
    if(hour>=22||hour<6){ m.visible=false; return; }
    m.visible=true;

    if(st.chatCooldown>0) st.chatCooldown-=dt;

    // ─── 상태머신 ───
    st.stateTimer-=dt;

    switch(st.aiState){
      case 'IDLE':
        // 가만히 서서 주변 보기
        if(st.stateTimer<=0){
          const roll=Math.random();
          if(roll<st.personality.energy*0.6) st.aiState='WALK';
          else if(roll<0.3&&st.personality.social>0.5) st.aiState='LOOK_AROUND';
          else st.aiState='WALK';
          st.stateTimer=60+Math.random()*180;
          st.dir=Math.random()*Math.PI*2;
        }
        // 조용히 bob만
        break;

      case 'WALK': {
        st.moveTimer-=dt;
        if(st.moveTimer<=0){
          // 에너지 높으면 자주 방향 바꿈
          st.dir+=( Math.random()-0.5)*Math.PI*(1+st.personality.energy);
          st.moveTimer=80+Math.random()*(200-st.personality.energy*100);
        }
        const spd=0.008+st.personality.energy*0.01;
        const nx=st.wx+Math.sin(st.dir)*spd*dt;
        const nz=st.wz+Math.cos(st.dir)*spd*dt;
        const tx=Math.round(nx/CS), tz=Math.round(nz/CS);
        const hdx=nx-st.home[0], hdz=nz-st.home[1];
        const homeDist=Math.sqrt(hdx*hdx+hdz*hdz);
        if(NPC_WALK.has(getTile(tx,tz))&&homeDist<CS*5){
          st.wx=nx; st.wz=nz;
        } else {
          // 집 방향으로 돌아가기
          st.dir=Math.atan2(st.home[0]-st.wx, st.home[1]-st.wz)+( Math.random()-0.5)*0.8;
          st.moveTimer=40;
        }
        if(st.stateTimer<=0){
          const next=['IDLE','SIT','LOOK_AROUND'];
          st.aiState=next[Math.floor(Math.random()*next.length)];
          st.stateTimer=60+Math.random()*200;
        }
        break;
      }

      case 'SIT':
        // 앉아 쉬기 (scale Y 줄여서 표현)
        m.scale.y=0.85;
        if(st.stateTimer<=0){
          m.scale.y=1;
          st.aiState='WALK';
          st.stateTimer=80+Math.random()*150;
        }
        break;

      case 'LOOK_AROUND':
        // 천천히 회전하며 주변 관찰
        st.dir+=0.01*dt;
        if(st.stateTimer<=0){
          st.aiState=Math.random()<0.5?'IDLE':'WALK';
          st.stateTimer=60+Math.random()*120;
        }
        break;

      case 'CHAT_IDLE':
        // 대화 중 — 서로 바라보고 가만히 있음
        if(st.stateTimer<=0){ st.aiState='IDLE'; st.stateTimer=60; }
        break;

      case 'REACT':
        // 플레이어에 반응 (점프 bob 크게)
        if(st.stateTimer<=0){ st.aiState='IDLE'; m.scale.y=1; st.stateTimer=60; }
        break;
    }

    // 위치 적용
    const ftx=Math.round(st.wx/CS), ftz=Math.round(st.wz/CS);
    m.position.set(st.wx, tileH(ftx,ftz), st.wz);
    m.rotation.y=Math.atan2(Math.sin(st.dir),Math.cos(st.dir));

    // 팔다리 걷기 애니메이션
    animateLimbs(st.limbs, st.aiState==='WALK', vi.id.charCodeAt(0));

    // 상체 bob
    const tNow=performance.now()*0.002;
    const bobAmt=(st.aiState==='WALK')?0.04:(st.aiState==='REACT')?0.12:0.012;
    m.position.y+=Math.abs(Math.sin(tNow*2+vi.id.charCodeAt(0)))*bobAmt;
  });
}

// 플레이어가 주민에게 말 걸었을 때 AI 반응
export function npcPlayerInteract(viId) {
  const vi=VILLAGERS.find(v=>v.id===viId);
  const st=G.npcState[viId];
  if(!vi||!st) return null;
  st.memory.playerVisits++;
  st.friendship=Math.min(10,(G.gs.talked_to[viId]||0)+1);
  st.aiState='REACT'; st.stateTimer=80;
  // 시나리오 기반 대화
  return getNPCDialogue(vi, st);
}
