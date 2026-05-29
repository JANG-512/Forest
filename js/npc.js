// ═══════════════════════════════════════════════════════════════
// npc.js — 주민 NPC 빌더 & AI
// ═══════════════════════════════════════════════════════════════
import { G } from './game.js?v=20260529-visual-v21';
import { T, CS, VILLAGERS, NPC_SCENARIOS } from './config.js?v=20260529-visual-v21';
import { tileH } from './world.js?v=20260529-visual-v21';
import { animateLimbs, buildCharacter } from './character.js?v=20260529-visual-v21';
import { mat, mesh } from './renderer.js?v=20260529-visual-v21';
import { playSound } from './audio.js?v=20260529-visual-v21';
import { saveState } from './state.js?v=20260529-visual-v21';
import { moveWithWorldCollisions, nudgeOutOfBuilding } from './collision.js?v=20260529-visual-v21';

// 주민 NPC가 걸을 수 있는 타일. 건물 타일은 외벽 충돌과 분리해서 금지한다.
const NPC_WALK = new Set([T.GRASS,T.PATH,T.FLOWER,T.BRIDGE,T.BEACH,T.CLIFF]);

export function buildNPC(vi) {
  const bc=vi.color;
  const r=((bc>>16)&0xff), gv=((bc>>8)&0xff), b=(bc&0xff);
  const lighter=((Math.min(r+70,255)<<16)|(Math.min(gv+70,255)<<8)|Math.min(b+70,255));
  const darker =((Math.max(r-50,0)<<16) |(Math.max(gv-50,0)<<8) |Math.max(b-50,0));

  const limbs={};
  const g = buildCharacter(lighter, bc, darker, bc, 0x3a2a1a, limbs, true);
  const visualGroup = g.userData.visualGroup || g;
  
  // 동물별 특징 추가 (넨도로이드 머리 높이 y=1.28에 맞춤)
  if(vi.type==='bunny'){
    [-0.15,0.15].forEach(ex=>{
      // 토끼 귀
      const earO=mesh(new THREE.CylinderGeometry(0.06,0.08,0.5,7),bc);
      earO.position.set(ex,1.72,0); earO.rotation.z=ex>0?-0.13:0.13; visualGroup.add(earO);
      const earI=mesh(new THREE.CylinderGeometry(0.03,0.05,0.42,6),0xffb0bb);
      earI.position.set(ex,1.72,0.045); earI.rotation.z=ex>0?-0.13:0.13; visualGroup.add(earI);
    });
    // 둥글고 납작한 토끼 코
    const nose=mesh(new THREE.SphereGeometry(0.042,6,5),0xffaacc,false);
    nose.position.set(0,1.20,0.44); visualGroup.add(nose);
    // 솜꼬리
    const tail=mesh(new THREE.SphereGeometry(0.08,6,5),0xffffff);
    tail.position.set(0,0.52,-0.2); visualGroup.add(tail);
  } else if(vi.type==='bear'){
    // 곰 귀
    [-0.24,0.24].forEach(ex=>{
      const earO=mesh(new THREE.SphereGeometry(0.12,8,6),bc);
      earO.position.set(ex,1.66,0); visualGroup.add(earO);
      const earI=mesh(new THREE.SphereGeometry(0.07,7,5),lighter);
      earI.position.set(ex,1.66,0.05); visualGroup.add(earI);
    });
    // 곰 주둥이
    const muzzle=mesh(new THREE.SphereGeometry(0.14,9,7),lighter);
    muzzle.scale.set(1.1,0.78,0.68); muzzle.position.set(0,1.15,0.36); visualGroup.add(muzzle);
    const blackNose=mesh(new THREE.SphereGeometry(0.035,5,4),0x222222,false);
    blackNose.position.set(0,1.19,0.45); visualGroup.add(blackNose);
    // 곰 꼬리
    const tail=mesh(new THREE.SphereGeometry(0.08,6,5),bc);
    tail.position.set(0,0.52,-0.2); visualGroup.add(tail);
  } else if(vi.type==='frog'){
    // 개구리 큰 왕눈이 (입체적으로 위로 솟구침)
    [-0.2,0.2].forEach(ex=>{
      const eb=mesh(new THREE.SphereGeometry(0.14,9,7),bc);
      eb.position.set(ex,1.48,0.08); visualGroup.add(eb);
      const ew=mesh(new THREE.SphereGeometry(0.09,8,6),0xffffff,false);
      ew.position.set(ex,1.49,0.18); visualGroup.add(ew);
      const ep=mesh(new THREE.SphereGeometry(0.055,6,5),0x111111,false);
      ep.position.set(ex,1.49,0.23); visualGroup.add(ep);
      const hl=mesh(new THREE.SphereGeometry(0.02,4,3),0xffffff,false);
      hl.position.set(ex+0.02,1.52,0.24); visualGroup.add(hl);
    });
    // 개구리 시그니처 큰 미소 입꼬리
    const fSmile=mesh(new THREE.TorusGeometry(0.1,0.022,6,10,Math.PI),0x3a2a1a,false);
    fSmile.rotation.z=Math.PI; fSmile.position.set(0,1.11,0.4); visualGroup.add(fSmile);
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
    memory:{playerVisits:0,lastPlayerItem:null,heardFrom:{},learnedPhrases:[],scenario:null,lastTopic:null},
    friendship:G.gs?(G.gs.talked_to[vi.id]||0):0,
    relationship:{friendship:G.gs?(G.gs.talked_to[vi.id]||0):0,trust:0,affection:0,conflict:0},
    emotionValues:{happiness:55,sadness:8,anger:0,stress:12,loneliness:25,excitement:20},
    needs:{social:30+Math.random()*45,curiosity:30+Math.random()*50,rest:35+Math.random()*35},
    chatCooldown:0, targetVillager:null, targetPos:null,
    stuckCount:0,
    limbs,
  };

  // 원래 색상 캐싱
  g.traverse(c=>{
    if(c.isMesh && c.material && c.material.color) {
      c.userData.originalColor = c.material.color.getHex();
    }
  });
}

function applyNPCColor(m, emotionState) {
  let targetHex = null;
  if (emotionState === 'angry') targetHex = 0xff3333; // 짙은 적색
  else if (emotionState === 'sad') targetHex = 0x5ba3e0; // 파란색
  else if (emotionState === 'shy') targetHex = 0xffaacc; // 뺨 분홍색
  else if (emotionState === 'comfortable') targetHex = 0x88cc88; // 올리브빛 연두색
  else if (emotionState === 'stressed') targetHex = 0x9966cc; // 칙칙한 보라색
  
  m.traverse(c => {
    if (c.isMesh && c.material && c.material.color) {
      if (targetHex !== null) {
        const orig = c.userData.originalColor;
        if (orig !== 0xffffff && orig !== 0x111111 && orig !== 0x3a2a1a && orig !== 0x2255cc) {
          c.material.color.setHex(targetHex);
        }
      } else {
        if (c.userData.originalColor !== undefined) {
          c.material.color.setHex(c.userData.originalColor);
        }
      }
    }
  });
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
    if(st.needs){
      st.needs.social=Math.min(100,st.needs.social+0.006*dt);
      st.needs.curiosity=Math.min(100,st.needs.curiosity+0.004*dt);
      st.needs.rest=Math.min(100,st.needs.rest+0.003*dt);
    }

    const playerDx=G.playerPos.x-st.wx, playerDz=G.playerPos.z-st.wz;
    const playerDist=Math.hypot(playerDx,playerDz);
    if(playerDist<CS*2.4 && !G.dialogueOpen && st.aiState!=='CHAT_IDLE'){
      st.dir=Math.atan2(playerDx,playerDz);
      if((st.needs?.social||0)>68 && st.chatCooldown<=0){
        st.aiState='LOOK_AROUND';
        st.stateTimer=Math.max(st.stateTimer,70);
      }
    }

    // ─── 상태머신 ───
    st.stateTimer-=dt;

    switch(st.aiState){
      case 'IDLE':
        // 가만히 서서 주변 보기
        if(st.stateTimer<=0){
          const roll=Math.random();
          if((st.needs?.rest||0)>78) st.aiState='SIT';
          else if((st.needs?.curiosity||0)>72) st.aiState='LOOK_AROUND';
          else if(roll<st.personality.energy*0.6) st.aiState='WALK';
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
        const hdx=nx-st.home[0], hdz=nz-st.home[1];
        const homeDist=Math.sqrt(hdx*hdx+hdz*hdz);
        const moved = moveWithWorldCollisions(st.wx, st.wz, nx, nz, 0.34, {
          walkable:NPC_WALK,
          allowDoorApproach:false,
        });
        
        // 집 반경 5.5칸 한계로 마진 적용
        if(moved.moved && homeDist < CS*5.5){
          st.wx=moved.x; st.wz=moved.z;
          st.stuckCount = 0; // 성공적으로 이동 시 stuck 카운트 리셋
        } else {
          // 충돌 또는 경계 이탈 시 물러서기 (충돌 타일에서 완전히 벗어나도록 0.55 고정 유닛 반발)
          st.wx -= Math.sin(st.dir) * 0.55;
          st.wz -= Math.cos(st.dir) * 0.55;
          st.stuckCount = (st.stuckCount || 0) + 1;

          if (st.stuckCount >= 3) {
            // 3회 이상 낀 상황: 강제로 방향을 크게 틀고 임시 유휴(IDLE) 상태로 진입 (Anti-Stuck)
            st.dir = Math.random() * Math.PI * 2;
            st.aiState = 'IDLE';
            st.stateTimer = 80 + Math.random() * 80;
            st.stuckCount = 0;
            st.wx -= Math.sin(st.dir) * 0.7; // 추가 반발
            st.wz -= Math.cos(st.dir) * 0.7;
          } else {
            if (homeDist >= CS * 5.5) {
              // 집으로 회귀 방향 (노이즈 최소화)
              st.dir = Math.atan2(st.home[0]-st.wx, st.home[1]-st.wz) + (Math.random()-0.5)*0.2;
            } else {
              // 벽 충돌 시 회피각 크게 꺾기 (90~270도 수준)
              st.dir += Math.PI + (Math.random() - 0.5) * 1.2;
            }
            // 즉각적인 충돌 판정 재발을 막기 위해 이동 타이머 확보
            st.moveTimer = 60 + Math.random() * 60;
          }
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
        if(st.needs) st.needs.rest=Math.max(0,st.needs.rest-0.018*dt);
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

    // 위치 및 감정 애니메이션 적용
    const ftx=Math.round(st.wx/CS), ftz=Math.round(st.wz/CS);
    const baseH = tileH(ftx,ftz);
    const nudge = nudgeOutOfBuilding(st.wx, st.wz, 0.34, {allowDoorApproach:false});
    if(nudge.nudged){
      st.wx = nudge.x;
      st.wz = nudge.z;
      st.dir += Math.PI * 0.75;
      st.stuckCount = 0;
    }

    let emoOffsetY = 0;
    let emoRotY = 0;
    let emoOffsetX = 0;
    let emoOffsetZ = 0;
    let emoScaleY = 1;
    let emoRotZ = 0;

    const tNow = performance.now() * 0.002;
    const charCode = vi.id.charCodeAt(0);
    const emotion = st.emotionState || 'neutral';

    if (st.lastAppliedEmotion !== emotion) {
      applyNPCColor(m, emotion);
      st.lastAppliedEmotion = emotion;
    }

    switch(emotion) {
      case 'happy':
        emoOffsetY = Math.abs(Math.sin(tNow * 12 + charCode)) * 0.9;
        emoScaleY = 1.0 + Math.sin(tNow * 12 + charCode) * 0.1;
        break;
      case 'excited':
        emoRotY = tNow * 18;
        emoOffsetY = Math.abs(Math.sin(tNow * 8 + charCode)) * 0.4;
        break;
      case 'angry':
        emoOffsetX = Math.sin(tNow * 70 + charCode) * 0.06;
        emoOffsetZ = Math.cos(tNow * 70 + charCode) * 0.06;
        break;
      case 'sad':
        emoScaleY = 0.82 + Math.sin(tNow * 4 + charCode) * 0.04;
        emoOffsetY = Math.sin(tNow * 4 + charCode) * 0.02;
        break;
      case 'shy':
        emoRotZ = Math.sin(tNow * 6 + charCode) * 0.22;
        break;
      case 'comfortable':
        emoOffsetY = 0.2 + Math.sin(tNow * 2.5 + charCode) * 0.15;
        break;
      case 'stressed':
        emoRotZ = Math.sin(tNow * 10 + charCode) * 0.35 + (Math.random() - 0.5) * 0.08;
        emoScaleY = 0.95 + (Math.random() - 0.5) * 0.04;
        break;
      case 'neutral':
      default:
        if (st.aiState === 'SIT') emoScaleY = 0.85;
        break;
    }

    // 루트 그룹은 언제나 바닥 평면에 고정하여 접지 그림자 밀착
    m.position.set(st.wx + emoOffsetX, baseH, st.wz + emoOffsetZ);
    m.rotation.y = Math.atan2(Math.sin(st.dir), Math.cos(st.dir)) + emoRotY;
    m.rotation.z = emoRotZ;
    m.scale.y = emoScaleY;

    if (m.userData.visualGroup) {
      m.userData.visualGroup.position.y = emoOffsetY;
    }
    if (m.userData.shadowMesh) {
      m.userData.shadowMesh.scale.set(1, 1, 1);
    }

    // 팔다리 걷기 애니메이션
    animateLimbs(st.limbs, st.aiState==='WALK', charCode);

    // 상체 기본 bob
    let bobY = 0;
    if (emotion !== 'happy' && emotion !== 'excited' && st.aiState !== 'SIT') {
      const bobAmt = (st.aiState==='WALK')?0.04:(st.aiState==='REACT')?0.12:0.012;
      bobY = Math.abs(Math.sin(tNow*2+charCode))*bobAmt;
    }

    if (m.userData.visualGroup) {
      m.userData.visualGroup.position.y += bobY;
      if (m.userData.shadowMesh) {
        const totalHeight = emoOffsetY + bobY;
        const scaleVal = Math.max(0.55, 1.0 - totalHeight * 1.4);
        m.userData.shadowMesh.scale.set(scaleVal, scaleVal, 1);
      }
    } else {
      m.position.y += emoOffsetY + bobY;
    }
  });
}

const INTENT_TOPICS = {
  greet:'인사',
  mood:'기분',
  island_news:'섬 소식',
  help:'도움',
  compliment:'칭찬',
  bye:'작별',
};

function ensureSavedMemory(viId){
  if(!G.gs.npc_memory) G.gs.npc_memory = {};
  if(!G.gs.npc_memory[viId]){
    G.gs.npc_memory[viId] = {
      talkCount:0,
      lastTopic:null,
      favoritePlace:null,
      memories:[],
      flags:{},
    };
  }
  return G.gs.npc_memory[viId];
}

function favoritePlaceFor(vi){
  if(vi.type==='frog') return '강가';
  if(vi.type==='bear') return '광장 벤치';
  if(vi.type==='bunny') return '꽃밭';
  return '마을 길';
}

function localNpcContext(vi, st, intent, savedMemory){
  const hour = new Date().getHours();
  const topic = INTENT_TOPICS[intent] || '이야기';
  return {
    intent,
    hour,
    friendshipLevel: st.relationship?.friendship || st.friendship || 0,
    emotion: st.emotionState || 'comfortable',
    needs: st.needs,
    memory:{
      lastTopic:savedMemory.lastTopic,
      heardTopic:st.memory.learnedPhrases?.[0],
      memories:savedMemory.memories.slice(-4),
    },
    favoritePlace:savedMemory.favoritePlace || favoritePlaceFor(vi),
    topic,
  };
}

function warmLocalLine(vi, st, intent, mem){
  const place = mem.favoritePlace || favoritePlaceFor(vi);
  const learned = st.memory.learnedPhrases?.[0];
  const close = (st.relationship?.friendship||0) >= 4;
  if(intent==='greet') return close ? `또 왔구나. 아까부터 ${place} 쪽을 보면서 네 생각을 했어.` : `안녕. 오늘은 ${place} 근처를 산책하고 있었어.`;
  if(intent==='mood') return st.needs.social>60 ? `누군가랑 얘기하고 싶었는데 딱 네가 왔네. 지금 기분 꽤 좋아.` : `조용히 쉬는 중이었어. 그래도 네 목소리를 들으니까 한결 편해졌어.`;
  if(intent==='island_news') return learned ? `방금 다른 주민이 "${learned}"라고 하던데, 무슨 뜻인지 궁금해졌어.` : `${place}에 작은 장식이 더 생기면 마을이 훨씬 포근해질 것 같아.`;
  if(intent==='help') return `혹시 시간이 있으면 ${place} 주변을 더 예쁘게 꾸며줘. 내가 자주 들르는 곳이라 기대돼.`;
  if(intent==='compliment') return `그런 말은 마음에 오래 남아. 오늘은 조금 더 용기 내서 돌아다녀볼게.`;
  if(intent==='bye') return `응, 다음에 또 얘기하자. 오늘 이야기 기억해둘게.`;
  return getNPCDialogue(vi, st).replace(`${vi.name}: `,'');
}

// 플레이어가 주민에게 말 걸었을 때 AI 반응/기억 생성
export function npcPlayerInteract(viId, intent='greet') {
  const vi=VILLAGERS.find(v=>v.id===viId);
  const st=G.npcState[viId];
  if(!vi||!st) return null;
  const mem=ensureSavedMemory(viId);
  const topic=INTENT_TOPICS[intent] || '이야기';
  st.memory.playerVisits++;
  st.memory.lastTopic=topic;
  st.friendship=Math.min(50,(G.gs.talked_to[viId]||0)+1);
  if(!st.relationship) st.relationship={friendship:st.friendship,trust:0,affection:0,conflict:0};
  st.relationship.friendship=Math.max(st.relationship.friendship||0, st.friendship);
  st.needs.social=Math.max(0,(st.needs.social||40)-8);
  st.needs.curiosity=Math.min(100,(st.needs.curiosity||40)+6);
  st.aiState='REACT'; st.stateTimer=80;
  st.emotionState=intent==='compliment'?'shy':intent==='help'?'excited':intent==='bye'?'comfortable':'happy';
  mem.talkCount++;
  mem.lastTopic=topic;
  mem.favoritePlace=mem.favoritePlace || favoritePlaceFor(vi);
  if(intent!=='bye'){
    mem.memories.push({topic, at:Date.now()});
    mem.memories=mem.memories.slice(-12);
  }
  G.gs.talked_to[viId]=Math.max(G.gs.talked_to[viId]||0, st.relationship.friendship||0);
  saveState();
  playSound('talk');
  return {
    npc_id:viId,
    reply:warmLocalLine(vi, st, intent, mem),
    intent,
    emotion:st.emotionState,
    relationship_change:{friendship:intent==='bye'?0:1,trust:intent==='island_news'||intent==='help'?1:0,affection:intent==='compliment'?2:0,conflict:0},
    memory_created:intent!=='bye',
    memory_text:topic,
    npc_state:{
      happiness:st.emotionState==='happy'?78:62,
      sadness:8,
      anger:0,
      stress:Math.max(5,(st.needs.rest||40)-25),
      loneliness:Math.max(0,30-(st.relationship.friendship||0)*2),
      excitement:st.emotionState==='excited'?82:36,
    },
    context:localNpcContext(vi, st, intent, mem),
  };
}
