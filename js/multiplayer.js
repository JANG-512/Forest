// ═══════════════════════════════════════════════════════════════
// multiplayer.js — PeerJS WebRTC 멀티플레이
// ═══════════════════════════════════════════════════════════════
import { G } from './game.js';
import { CS } from './config.js';
import { buildCharacter, animateLimbs } from './character.js';
import { mat, mesh, disposeMesh } from './renderer.js';
import { getTile, tileH, generateWorld, buildGround } from './world.js';
import { notify } from './ui.js';

export function initMultiplayer(){
  try {
    G.MP.peer = new Peer(undefined,{debug:0});
    G.MP.peer.on('open', id=>{
      G.MP.myId=id;
      const el=document.getElementById('mp-code-display');
      if(el) el.textContent=id;
      mpSetStatus('✅ 연결됨! 코드를 친구에게 공유하세요.');
    });
    G.MP.peer.on('connection', conn=>{
      // 누군가 우리 섬에 방문
      G.MP.isHost=true;
      setupConnection(conn);
      mpSetStatus('🚀 친구가 방문 중...');
    });
    G.MP.peer.on('error', e=>{
      mpSetStatus('❌ 연결 오류: '+e.type);
    });
    G.MP.peer.on('disconnected',()=>{ mpSetStatus('🔌 PeerJS 서버와 연결 끊김'); });
  } catch(e) {
    mpSetStatus('❌ PeerJS 초기화 실패 (네트워크 확인)');
  }
}

function mpSetStatus(msg){
  const el=document.getElementById('mp-status');
  if(el) el.innerHTML=msg;
}

export function copyIslandCode(){
  if(!G.MP.myId){ notify('아직 코드가 준비되지 않았어요!'); return; }
  navigator.clipboard?.writeText(G.MP.myId).catch(()=>{});
  notify('📋 섬 코드가 복사되었어요!');
}

export function joinFriendIsland(){
  const inp=document.getElementById('mp-join-input');
  const hostId=inp?.value?.trim();
  if(!hostId){ notify('섬 코드를 입력해 주세요!'); return; }
  if(!G.MP.peer){ notify('멀티 연결이 초기화되지 않았어요.'); return; }
  if(G.MP.conn){ G.MP.conn.close(); }
  mpSetStatus('⏳ 연결 중...');
  const conn=G.MP.peer.connect(hostId,{reliable:true});
  G.MP.isHost=false;
  setupConnection(conn);
}

export function disconnectMP(){
  if(G.MP.conn) G.MP.conn.close();
  cleanupRemote();
  mpSetStatus('👋 연결이 종료되었어요.');
  document.getElementById('mp-disc-btn').style.display='none';
  notify('👋 섬을 떠났어요!');
}

function setupConnection(conn){
  G.MP.conn=conn;
  conn.on('open',()=>{
    document.getElementById('mp-disc-btn').style.display='block';
    if(G.MP.isHost){
      // 호스트: 월드 데이터 전송
      const worldData=Array.from(G.world);
      conn.send({type:'world',
        world:worldData,
        trees:G.gs.world_trees,
        flowers:G.gs.world_flowers,
        digs:G.gs.world_dig_spots,
        playerX:G.playerPos.x, playerZ:G.playerPos.z,
      });
      mpSetStatus('🏝️ 친구가 도착했어요! <span class="mp-badge">ONLINE</span>');
      notify('🌍 친구가 섬에 도착했어요!');
    }
    if(typeof window.togglePanel==='function') window.togglePanel('mp');
  });
  conn.on('data', handleMPData);
  conn.on('close',()=>{
    cleanupRemote();
    mpSetStatus('👋 상대방이 연결을 끊었어요.');
    document.getElementById('mp-disc-btn').style.display='none';
    notify('👋 친구가 섬을 떠났어요...');
  });
  conn.on('error', e=>{ mpSetStatus('❌ 연결 에러: '+e); });
}

function rebuildAllTiles(){
  G.tileMeshes.forEach((m,k)=>{G.exteriorRoot.remove(m);disposeMesh(m);});
  G.tileMeshes.clear();
  buildGround();
}

function handleMPData(data){
  if(data.type==='world'){
    // 방문자: 호스트 섬으로 전환
    G.MP.visitingMode=true;
    for(let i=0;i<data.world.length;i++) G.world[i]=data.world[i];
    G.gs.world_trees=data.trees||{};
    G.gs.world_flowers=data.flowers||{};
    G.gs.world_dig_spots=data.digs||{};
    // 씬 재구성
    rebuildAllTiles();
    // 방문자 위치: 도착 지점 근처
    G.playerPos.x=(data.playerX||27*CS)+CS*2;
    G.playerPos.z=(data.playerZ||27*CS);
    mpSetStatus('🏝️ 친구의 섬 방문 중! <span class="mp-badge">ONLINE</span>');
    notify('✈️ 친구의 섬에 도착했어요!');
    // 방문자는 호스트에게 위치 즉시 전송
    sendPosition();
  } else if(data.type==='pos'){
    // 원격 플레이어 위치 업데이트
    if(!G.MP.remoteMesh){
      G.MP.remoteMesh=buildRemotePlayer();
      G.scene.add(G.MP.remoteMesh);
    }
    G.MP.remoteTarget={x:data.x, z:data.z, dir:data.dir, moving:data.moving};
  } else if(data.type==='chat'){
    notify('💬 '+data.msg);
  }
}

function buildRemotePlayer(){
  const limbs={};
  // 다른 헤어색(보라)으로 구분
  const g=buildCharacter(0xfde0b8, 0xcc55aa, 0x5a2a6a, 0x882299, 0x3a2a1a, limbs);
  G.MP.remoteLimbs=limbs;
  return g;
}

function cleanupRemote(){
  if(G.MP.remoteMesh){ G.scene.remove(G.MP.remoteMesh); disposeMesh(G.MP.remoteMesh); G.MP.remoteMesh=null; }
  G.MP.remoteTarget=null;
  if(G.MP.visitingMode){
    // 자기 섬으로 복원
    G.MP.visitingMode=false;
    generateWorld();
    rebuildAllTiles();
    G.playerPos.x=27*CS; G.playerPos.z=27*CS;
    notify('🏠 내 섬으로 돌아왔어요!');
  }
}

export function sendPosition(){
  if(!G.MP.conn||!G.MP.conn.open) return;
  G.MP.conn.send({type:'pos', x:G.playerPos.x, z:G.playerPos.z, dir:G.playerMesh?.rotation.y??0, moving:G.playerMoving});
}

export function updateMultiplayer(dt){
  if(!G.MP.remoteMesh||!G.MP.remoteTarget) return;
  const t=G.MP.remoteTarget;
  // 위치 보간
  G.MP.remoteMesh.position.x+=(t.x-G.MP.remoteMesh.position.x)*0.22;
  G.MP.remoteMesh.position.z+=(t.z-G.MP.remoteMesh.position.z)*0.22;
  const ftx=Math.round(G.MP.remoteMesh.position.x/CS);
  const ftz=Math.round(G.MP.remoteMesh.position.z/CS);
  G.MP.remoteMesh.position.y=tileH(ftx,ftz);
  G.MP.remoteMesh.rotation.y=t.dir;
  // 팔다리 애니메이션
  animateLimbs(G.MP.remoteLimbs, t.moving, 2.5);
}
