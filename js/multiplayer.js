// ═══════════════════════════════════════════════════════════════
// multiplayer.js — PeerJS WebRTC 멀티플레이
// ═══════════════════════════════════════════════════════════════
import { G } from './game.js';
import { CS } from './config.js';
import { buildCharacter, animateLimbs } from './character.js';
import { disposeMesh } from './renderer.js';
import { tileH, generateWorld, buildGround } from './world.js';
import { notify } from './ui.js';

const PROTOCOL_VERSION = 2;
const CHAT_LIMIT = 120;

function ensureMPState(){
  if(!G.MP.conns) G.MP.conns = new Map();
  if(!G.MP.remotePlayers) G.MP.remotePlayers = new Map();
  if(!G.MP.remoteProfiles) G.MP.remoteProfiles = new Map();
  if(!G.MP.localPending) G.MP.localPending = new Map();
  if(!G.MP.playerName){
    const saved = safeStorageGet('forest_island_player_name');
    G.MP.playerName = saved || `방문자 ${Math.floor(100+Math.random()*900)}`;
    safeStorageSet('forest_island_player_name', G.MP.playerName);
  }
  if(!G.MP.roomId){
    const savedRoom = safeStorageGet('forest_island_room_id');
    G.MP.roomId = savedRoom || Math.random().toString(36).slice(2,8).toUpperCase();
    safeStorageSet('forest_island_room_id', G.MP.roomId);
  }
}

export function initMultiplayer(){
  ensureMPState();
  const codeEl=document.getElementById('mp-code-display');
  if(codeEl) codeEl.textContent=G.MP.roomId;
  getServerUrl();
  updateRosterUI();
  updateChatConnectionUI(false);
  try {
    G.MP.peer = new Peer(undefined,{debug:0});
    G.MP.peer.on('open', id=>{
      G.MP.myId=id;
      const el=document.getElementById('mp-code-display');
      if(el && !getServerUrl()) el.textContent=id;
      mpSetStatus('연결됨! 코드를 친구에게 공유하세요.');
      setupLocalTransport();
      updateRosterUI();
    });
    G.MP.peer.on('connection', conn=>{
      G.MP.isHost=true;
      setupConnection(conn, true);
      mpSetStatus('친구가 방문 중... <span class="mp-badge">HOST</span>');
    });
    G.MP.peer.on('error', e=>{
      if(e.type==='peer-unavailable' && G.MP.pendingJoinId){
        mpSetStatus('직접 연결 실패. 로컬 탭 연결을 시도합니다...');
        tryLocalJoin(G.MP.pendingJoinId);
        return;
      }
      mpSetStatus('연결 오류: '+(e.type||e.message||e));
      appendChatLog('system','멀티플레이 연결에 문제가 생겼어요.');
      updateChatConnectionUI(hasOpenConnections());
    });
    G.MP.peer.on('disconnected',()=>{
      mpSetStatus('PeerJS 서버와 연결이 끊겼어요.');
      updateChatConnectionUI(false);
    });
  } catch(e) {
    mpSetStatus('PeerJS 초기화 실패');
    updateChatConnectionUI(false);
  }
}

function mpSetStatus(msg){
  const el=document.getElementById('mp-status');
  if(el) el.innerHTML=msg;
}

function hasOpenConnections(){
  ensureMPState();
  if(isServerOpen()) return true;
  for(const conn of G.MP.conns.values()){
    if(conn?.open) return true;
  }
  return false;
}

function sendTo(conn, data){
  if(conn?.open) conn.send(data);
}

function broadcast(data, exceptPeerId=null){
  ensureMPState();
  G.MP.conns.forEach((conn, peerId)=>{
    if(peerId!==exceptPeerId) sendTo(conn, data);
  });
}

function playerPayload(extra={}){
  return {
    protocol:PROTOCOL_VERSION,
    id:G.MP.serverId || G.MP.myId || G.MP.roomId,
    name:G.MP.playerName,
    x:G.playerPos.x,
    z:G.playerPos.z,
    dir:G.playerMesh?.rotation.y??0,
    moving:G.playerMoving,
    inInterior:G.inInterior,
    ...extra,
  };
}

export function copyIslandCode(){
  const code=getServerUrl() ? G.MP.roomId : G.MP.myId;
  if(!code){ notify('아직 코드가 준비되지 않았어요!'); return; }
  navigator.clipboard?.writeText(code).catch(()=>{});
  notify('섬 코드가 복사되었어요!');
}

export function joinFriendIsland(){
  ensureMPState();
  const inp=document.getElementById('mp-join-input');
  const hostId=inp?.value?.trim();
  if(!hostId){ notify('섬 코드를 입력해 주세요!'); return; }
  if(!G.MP.peer){ notify('멀티 연결이 초기화되지 않았어요.'); return; }
  const serverUrl=getServerUrl();
  if(hostId===G.MP.myId || (serverUrl && hostId===G.MP.roomId)){ notify('내 섬 코드에는 접속할 수 없어요.'); return; }
  if(serverUrl){
    connectServerRoom(hostId, false);
    return;
  }
  disconnectMP(true);
  mpSetStatus('연결 중...');
  appendChatLog('system','친구 섬으로 이동 중...');
  const conn=G.MP.peer.connect(hostId,{reliable:true});
  G.MP.isHost=false;
  G.MP.pendingJoinId=hostId;
  setupConnection(conn, false);
  toggleMultiplayerChat(true);
}

export function disconnectMP(silent=false){
  ensureMPState();
  if(G.MP.ws){
    G.MP.ws.onclose=null;
    G.MP.ws.close();
    G.MP.ws=null;
    G.MP.serverId=null;
  }
  Array.from(G.MP.conns.values()).forEach(conn=>conn.close());
  G.MP.conns.clear();
  cleanupAllRemotePlayers();
  if(G.MP.visitingMode){
    restoreOwnIsland();
  }
  G.MP.conn=null;
  G.MP.isHost=false;
  G.MP.pendingJoinId=null;
  const btn=document.getElementById('mp-disc-btn');
  if(btn) btn.style.display='none';
  mpSetStatus('연결이 종료되었어요.');
  updateRosterUI();
  updateChatConnectionUI(false);
  if(!silent){
    appendChatLog('system','멀티플레이 연결이 종료되었어요.');
    notify('섬 연결이 종료되었어요.');
  }
}

function safeStorageGet(key){
  try { return window.localStorage?.getItem(key); } catch(e){ return null; }
}

function safeStorageSet(key, value){
  try { window.localStorage?.setItem(key, value); } catch(e){}
}

function getServerUrl(){
  const inp=document.getElementById('mp-server-input');
  const uiValue=inp?.value?.trim();
  if(uiValue) {
    safeStorageSet('forest_island_mp_server', uiValue);
    return uiValue;
  }
  const saved=safeStorageGet('forest_island_mp_server') || '';
  if(inp && saved) inp.value=saved;
  return saved;
}

function normalizeWsUrl(base, roomId){
  const trimmed=base.trim().replace(/\/+$/,'');
  const wsBase = trimmed.startsWith('http://')
    ? 'ws://' + trimmed.slice(7)
    : trimmed.startsWith('https://')
      ? 'wss://' + trimmed.slice(8)
      : trimmed;
  const playerId=encodeURIComponent(G.MP.myId || G.MP.roomId || Math.random().toString(36).slice(2));
  const name=encodeURIComponent(G.MP.playerName || 'player');
  return `${wsBase}/ws/multiplayer/${encodeURIComponent(roomId)}?player_id=${playerId}&name=${name}`;
}

export function openMultiplayerRoom(){
  ensureMPState();
  const serverUrl=getServerUrl();
  if(!serverUrl){
    notify('멀티플레이 서버 URL을 입력해 주세요.');
    return;
  }
  const el=document.getElementById('mp-code-display');
  if(el) el.textContent=G.MP.roomId;
  connectServerRoom(G.MP.roomId, true);
}

function connectServerRoom(roomId, asHost){
  ensureMPState();
  const serverUrl=getServerUrl();
  if(!serverUrl){ notify('멀티플레이 서버 URL을 입력해 주세요.'); return; }
  disconnectMP(true);
  G.MP.serverUrl=serverUrl;
  G.MP.isHost=!!asHost;
  G.MP.pendingJoinId=null;
  G.MP.netMode='websocket';
  toggleMultiplayerChat(true);
  mpSetStatus('멀티플레이 서버에 연결 중...');
  appendChatLog('system', asHost ? '서버 방을 여는 중...' : '서버 방에 입장하는 중...');
  const ws=new WebSocket(normalizeWsUrl(serverUrl, roomId));
  G.MP.ws=ws;
  ws.onopen=()=>{
    const btn=document.getElementById('mp-disc-btn');
    if(btn) btn.style.display='block';
    updateChatConnectionUI(true);
    sendServer({type:'hello', ...playerPayload({host:G.MP.isHost, room:roomId})});
    if(G.MP.isHost) {
      sendServer({type:'world', ...worldPayload()});
      mpSetStatus(`서버 방 열림: ${roomId} <span class="mp-badge">SERVER</span>`);
    } else {
      sendServer({type:'world_request', ...playerPayload({room:roomId})});
      mpSetStatus(`서버 방 입장 중: ${roomId} <span class="mp-badge">SERVER</span>`);
    }
    appendChatLog('system','서버 멀티 채팅방에 연결되었습니다.');
    updateRosterUI();
  };
  ws.onmessage=ev=>{
    try { handleServerData(JSON.parse(ev.data)); }
    catch(e){ console.warn('Invalid multiplayer packet', e); }
  };
  ws.onerror=()=>{
    mpSetStatus('멀티플레이 서버 연결 오류');
    appendChatLog('system','서버 연결에 실패했어요. URL과 배포 상태를 확인해 주세요.');
    updateChatConnectionUI(false);
  };
  ws.onclose=()=>{
    G.MP.ws=null;
    G.MP.serverId=null;
    cleanupAllRemotePlayers();
    if(G.MP.visitingMode) restoreOwnIsland();
    updateRosterUI();
    updateChatConnectionUI(false);
    mpSetStatus('서버 연결이 종료되었어요.');
  };
}

function isServerOpen(){
  return G.MP.ws && G.MP.ws.readyState===WebSocket.OPEN;
}

function sendServer(data){
  if(isServerOpen()) G.MP.ws.send(JSON.stringify(data));
}

function worldPayload(){
  return {
    ...playerPayload({host:true}),
    world:Array.from(G.world || []),
    trees:G.gs?.world_trees || {},
    flowers:G.gs?.world_flowers || {},
    digs:G.gs?.world_dig_spots || {},
    roster:getRosterPayload(),
  };
}

function setupConnection(conn, incoming){
  ensureMPState();
  const peerId=conn.peer || `peer-${Date.now()}`;
  G.MP.conn=conn;
  G.MP.conns.set(peerId, conn);
  conn.on('open',()=>{
    const btn=document.getElementById('mp-disc-btn');
    if(btn) btn.style.display='block';
    updateChatConnectionUI(true);
    toggleMultiplayerChat(true);
    sendTo(conn,{type:'hello', ...playerPayload({host:G.MP.isHost})});
    if(G.MP.isHost || incoming){
      sendWorld(conn);
      mpSetStatus(`방문자 ${G.MP.conns.size}명 접속 중 <span class="mp-badge">HOST</span>`);
      notify('친구가 섬에 도착했어요!');
    } else {
      mpSetStatus('친구 섬에 접속 중...');
    }
    appendChatLog('system','멀티 채팅방에 참여했습니다.');
    updateRosterUI();
    sendPosition();
  });
  conn.on('data', data=>handleMPData(peerId, data));
  conn.on('close',()=>cleanupConnection(peerId, conn));
  conn.on('error', e=>{
    if((e.type==='peer-unavailable'||String(e).includes('peer-unavailable')) && G.MP.pendingJoinId){
      mpSetStatus('직접 연결 실패. 로컬 탭 연결을 시도합니다...');
      tryLocalJoin(G.MP.pendingJoinId);
      return;
    }
    mpSetStatus('연결 에러: '+(e.message||e));
    appendChatLog('system','상대와의 연결이 불안정해요.');
  });
}

function setupLocalTransport(){
  ensureMPState();
  if(G.MP.localChannel || !('BroadcastChannel' in window) || !G.MP.myId) return;
  G.MP.localChannel = new BroadcastChannel('poko-local-multiplayer');
  G.MP.localChannel.onmessage = ev=>{
    const msg=ev.data;
    if(!msg || msg.to!==G.MP.myId || msg.from===G.MP.myId) return;
    if(msg.kind==='connect'){
      G.MP.isHost=true;
      const conn=createLocalConnection(msg.from);
      setupConnection(conn, true);
      G.MP.localChannel.postMessage({kind:'accept', from:G.MP.myId, to:msg.from});
      setTimeout(()=>openLocalConnection(conn),20);
    } else if(msg.kind==='accept'){
      const conn=G.MP.localPending.get(msg.from) || G.MP.conns.get(msg.from);
      if(conn) openLocalConnection(conn);
    } else if(msg.kind==='data'){
      const conn=G.MP.conns.get(msg.from);
      conn?._emit?.('data', msg.data);
    } else if(msg.kind==='close'){
      const conn=G.MP.conns.get(msg.from);
      if(conn){
        conn.open=false;
        conn._emit?.('close');
      }
    }
  };
}

function createLocalConnection(peerId){
  const handlers={};
  return {
    peer:peerId,
    open:false,
    metadata:{local:true},
    on(type, fn){ (handlers[type]||(handlers[type]=[])).push(fn); },
    send(data){
      if(!this.open || !G.MP.localChannel) return;
      G.MP.localChannel.postMessage({kind:'data', from:G.MP.myId, to:peerId, data});
    },
    close(){
      if(G.MP.localChannel) G.MP.localChannel.postMessage({kind:'close', from:G.MP.myId, to:peerId});
      this.open=false;
      this._emit('close');
    },
    _emit(type, payload){ (handlers[type]||[]).forEach(fn=>fn(payload)); },
  };
}

function openLocalConnection(conn){
  if(conn.open) return;
  conn.open=true;
  G.MP.localPending.delete(conn.peer);
  conn._emit('open');
}

function tryLocalJoin(hostId){
  ensureMPState();
  setupLocalTransport();
  if(!G.MP.localChannel || !G.MP.myId){
    mpSetStatus('연결 오류: peer-unavailable');
    return;
  }
  if(G.MP.conns.get(hostId)?.metadata?.local) return;
  const conn=createLocalConnection(hostId);
  G.MP.localPending.set(hostId, conn);
  G.MP.isHost=false;
  setupConnection(conn, false);
  G.MP.localChannel.postMessage({kind:'connect', from:G.MP.myId, to:hostId, name:G.MP.playerName});
  setTimeout(()=>{
    if(!conn.open){
      mpSetStatus('로컬 탭에서도 상대를 찾지 못했어요.');
      appendChatLog('system','상대 탭이 열려 있고 섬 코드가 맞는지 확인해 주세요.');
    }
  },2200);
}

function sendWorld(conn){
  if(!G.world || !G.gs) return;
  sendTo(conn,{type:'world', ...worldPayload()});
}

function getRosterPayload(){
  ensureMPState();
  const roster=[{id:G.MP.myId, name:G.MP.playerName, host:G.MP.isHost}];
  G.MP.remoteProfiles.forEach((profile,id)=>{
    if(id!==G.MP.myId) roster.push({id, name:profile.name||'친구', host:!!profile.host});
  });
  return roster;
}

function rebuildAllTiles(){
  G.tileMeshes.forEach(m=>{G.exteriorRoot.remove(m);disposeMesh(m);});
  G.tileMeshes.clear();
  buildGround();
}

function handleMPData(peerId, data){
  if(!data || typeof data!=='object') return;
  if(data.name || data.id){
    rememberProfile(data.id || peerId, data.name, data.host);
  }

  if(data.type==='hello'){
    rememberProfile(data.id || peerId, data.name, data.host);
    appendChatLog('system', `${displayName(data.id||peerId)} 님이 들어왔어요.`);
    updateRosterUI();
    if(G.MP.isHost) broadcast({type:'presence', roster:getRosterPayload()}, peerId);
  } else if(data.type==='presence'){
    (data.roster||[]).forEach(p=>rememberProfile(p.id,p.name,p.host));
    updateRosterUI();
  } else if(data.type==='world'){
    loadHostWorld(data);
  } else if(data.type==='pos'){
    const id=data.id || peerId;
    updateRemoteTarget(id, data);
    if(G.MP.isHost) broadcast({...data, type:'pos', id}, peerId);
  } else if(data.type==='chat'){
    const id=data.id || peerId;
    appendChatLog(id===G.MP.myId?'me':'friend', data.msg, displayName(id));
    if(G.MP.isHost) broadcast({...data, id}, peerId);
  } else if(data.type==='ping'){
    sendTo(G.MP.conns.get(peerId), {type:'pong', t:data.t, id:G.MP.myId, name:G.MP.playerName});
  } else if(data.type==='pong'){
    G.MP.latency=Math.max(0, Date.now()-(data.t||Date.now()));
    updateChatConnectionUI(true);
  }
}

function handleServerData(packet){
  if(!packet || typeof packet!=='object') return;
  if(packet.type==='welcome'){
    G.MP.serverId=packet.id;
    (packet.roster||[]).forEach(p=>rememberProfile(p.id,p.name,p.host));
    updateRosterUI();
    return;
  }
  if(packet.type==='peer_joined'){
    rememberProfile(packet.id, packet.name, packet.host);
    appendChatLog('system', `${displayName(packet.id)} 님이 들어왔어요.`);
    if(G.MP.isHost) sendServer({type:'world', ...worldPayload()});
    updateRosterUI();
    return;
  }
  if(packet.type==='peer_left'){
    const name=displayName(packet.id);
    cleanupRemotePlayer(packet.id);
    G.MP.remoteProfiles.delete(packet.id);
    appendChatLog('system', `${name} 님이 나갔어요.`);
    updateRosterUI();
    return;
  }
  const peerId=packet.from || packet.id;
  if(!peerId || peerId===G.MP.serverId) return;
  if(packet.name || packet.id) rememberProfile(peerId, packet.name, packet.host);
  if(packet.type==='world_request'){
    if(G.MP.isHost) sendServer({type:'world', ...worldPayload()});
  } else if(packet.type==='world'){
    if(!G.MP.isHost) loadHostWorld({...packet, id:peerId});
  } else if(packet.type==='pos'){
    updateRemoteTarget(peerId, {...packet, id:peerId});
  } else if(packet.type==='chat'){
    appendChatLog('friend', packet.msg, displayName(peerId));
  } else if(packet.type==='hello'){
    rememberProfile(peerId, packet.name, packet.host);
    updateRosterUI();
  } else if(packet.type==='ping'){
    sendServer({type:'pong', t:packet.t, ...playerPayload()});
  } else if(packet.type==='pong'){
    G.MP.latency=Math.max(0, Date.now()-(packet.t||Date.now()));
    updateChatConnectionUI(true);
  }
}

function loadHostWorld(data){
  if(!G.world) return;
  G.MP.visitingMode=true;
  if(Array.isArray(data.world)){
    for(let i=0;i<data.world.length;i++) G.world[i]=data.world[i];
  }
  G.gs.world_trees=data.trees||{};
  G.gs.world_flowers=data.flowers||{};
  G.gs.world_dig_spots=data.digs||{};
  rebuildAllTiles();
  G.playerPos.x=(data.x||27*CS)+CS*2;
  G.playerPos.z=(data.z||27*CS);
  G.camTargetX=G.playerPos.x;
  G.camTargetZ=G.playerPos.z;
  (data.roster||[]).forEach(p=>rememberProfile(p.id,p.name,p.host));
  updateRosterUI();
  mpSetStatus('친구의 섬 방문 중 <span class="mp-badge">ONLINE</span>');
  appendChatLog('system','친구의 섬에 도착했습니다.');
  notify('친구의 섬에 도착했어요!');
  sendPosition();
}

function rememberProfile(id, name, host=false){
  if(!id || id===G.MP.myId) return;
  ensureMPState();
  const prev=G.MP.remoteProfiles.get(id)||{};
  G.MP.remoteProfiles.set(id,{...prev, name:name||prev.name||'친구', host:!!host, lastSeen:Date.now()});
  const remote=G.MP.remotePlayers.get(id);
  if(remote) remote.name = name || remote.name;
}

function displayName(id){
  if(id===G.MP.myId) return '나';
  return G.MP.remoteProfiles.get(id)?.name || G.MP.remotePlayers.get(id)?.name || '친구';
}

function updateRemoteTarget(id, data){
  if(!id || id===G.MP.myId) return;
  const remote=ensureRemotePlayer(id, data.name);
  remote.target={x:data.x, z:data.z, dir:data.dir??0, moving:!!data.moving, inInterior:!!data.inInterior};
  remote.lastSeen=Date.now();
}

function ensureRemotePlayer(id, name){
  ensureMPState();
  let remote=G.MP.remotePlayers.get(id);
  if(remote) return remote;
  const limbs={};
  const mesh=buildRemotePlayer(id, name||displayName(id), limbs);
  G.exteriorRoot.add(mesh);
  remote={id, name:name||displayName(id), mesh, limbs, target:null, lastSeen:Date.now()};
  G.MP.remotePlayers.set(id, remote);
  if(!G.MP.remoteMesh){
    G.MP.remoteMesh=mesh;
    G.MP.remoteLimbs=limbs;
  }
  updateRosterUI();
  return remote;
}

function buildRemotePlayer(id, name, limbs){
  const hueSeed=[...String(id)].reduce((a,c)=>a+c.charCodeAt(0),0);
  const shirts=[0xcc55aa,0x5ba3e0,0xf0aa44,0x7ec880,0x9575cd];
  const hair=[0x882299,0x6b4a2a,0x2b405f,0x8b5b2e,0x333333];
  const g=buildCharacter(0xfde0b8, shirts[hueSeed%shirts.length], 0x5a4a6a, hair[hueSeed%hair.length], 0x3a2a1a, limbs);
  const tag=createNameTag(name||'친구');
  tag.position.set(0,2.35,0);
  g.add(tag);
  return g;
}

function createNameTag(text){
  const canvas=document.createElement('canvas');
  canvas.width=256; canvas.height=72;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='rgba(255,255,255,0.92)';
  roundRect(ctx,12,12,232,42,18);
  ctx.fill();
  ctx.fillStyle='#3b3028';
  ctx.font='700 22px system-ui, sans-serif';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillText(text.slice(0,12),128,33);
  const tex=new THREE.CanvasTexture(canvas);
  const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false});
  const sprite=new THREE.Sprite(mat);
  sprite.scale.set(1.6,0.45,1);
  return sprite;
}

function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

function cleanupConnection(peerId, sourceConn=null){
  if(sourceConn && G.MP.conns.get(peerId)!==sourceConn) return;
  const hadOpen=hasOpenConnections();
  const leavingName=displayName(peerId);
  G.MP.conns.delete(peerId);
  cleanupRemotePlayer(peerId);
  G.MP.remoteProfiles.delete(peerId);
  if(!G.MP.isHost && G.MP.visitingMode) restoreOwnIsland();
  if(G.MP.conn?.peer===peerId) G.MP.conn=null;
  updateRosterUI();
  updateChatConnectionUI(hasOpenConnections());
  if(!hasOpenConnections()){
    const btn=document.getElementById('mp-disc-btn');
    if(btn) btn.style.display='none';
    mpSetStatus('상대방이 연결을 끊었어요.');
  } else if(hadOpen){
    mpSetStatus(`방문자 ${G.MP.conns.size}명 접속 중 <span class="mp-badge">ONLINE</span>`);
  }
  appendChatLog('system', `${leavingName} 님이 나갔어요.`);
}

function cleanupRemotePlayer(peerId){
  const remote=G.MP.remotePlayers?.get(peerId);
  if(remote?.mesh){
    G.exteriorRoot.remove(remote.mesh);
    disposeMesh(remote.mesh);
  }
  G.MP.remotePlayers?.delete(peerId);
  const first=G.MP.remotePlayers?.values().next().value;
  G.MP.remoteMesh=first?.mesh||null;
  G.MP.remoteLimbs=first?.limbs||{};
}

function cleanupAllRemotePlayers(){
  ensureMPState();
  Array.from(G.MP.remotePlayers.keys()).forEach(cleanupRemotePlayer);
  G.MP.remoteProfiles.clear();
}

function restoreOwnIsland(){
  G.MP.visitingMode=false;
  generateWorld();
  rebuildAllTiles();
  G.playerPos.x=27*CS;
  G.playerPos.z=31*CS;
  G.camTargetX=G.playerPos.x;
  G.camTargetZ=G.playerPos.z;
  notify('내 섬으로 돌아왔어요!');
}

export function sendPosition(){
  ensureMPState();
  if(!hasOpenConnections()) return;
  const payload={type:'pos', ...playerPayload()};
  if(isServerOpen()){ sendServer(payload); return; }
  if(G.MP.isHost) broadcast(payload);
  else sendTo(G.MP.conn, payload);
}

export function updateMultiplayer(dt){
  ensureMPState();
  G.MP.heartbeatTimer=(G.MP.heartbeatTimer||0)+dt;
  if(G.MP.heartbeatTimer>180 && hasOpenConnections()){
    G.MP.heartbeatTimer=0;
    const ping={type:'ping', t:Date.now(), id:G.MP.myId, name:G.MP.playerName};
    if(isServerOpen()) sendServer(ping);
    else if(G.MP.isHost) broadcast(ping);
    else sendTo(G.MP.conn, ping);
  }

  G.MP.remotePlayers.forEach(remote=>{
    if(!remote.mesh||!remote.target) return;
    const t=remote.target;
    remote.mesh.visible=!t.inInterior && !G.inInterior;
    remote.mesh.position.x+=(t.x-remote.mesh.position.x)*0.22;
    remote.mesh.position.z+=(t.z-remote.mesh.position.z)*0.22;
    const ftx=Math.round(remote.mesh.position.x/CS);
    const ftz=Math.round(remote.mesh.position.z/CS);
    remote.mesh.position.y=tileH(ftx,ftz);
    remote.mesh.rotation.y=t.dir;
    animateLimbs(remote.limbs, t.moving, 2.5);
  });
}

export function sendChatMessage(msg) {
  ensureMPState();
  const txt = String(msg||'').trim().slice(0, CHAT_LIMIT);
  if(!txt) return;
  if(!hasOpenConnections()) {
    notify('연결된 상대방이 없습니다.');
    appendChatLog('system','친구 섬에 연결한 뒤 메시지를 보낼 수 있어요.');
    return;
  }
  const payload={type:'chat', ...playerPayload({msg:txt, t:Date.now()})};
  if(isServerOpen()) sendServer(payload);
  else if(G.MP.isHost) broadcast(payload);
  else sendTo(G.MP.conn, payload);
  appendChatLog('me', txt, '나');
}

function appendChatLog(kind, text, sender='') {
  const log = document.getElementById('mp-chat-log');
  if (!log) return;
  if(log.children.length===1 && log.firstElementChild?.classList.contains('system')){
    log.innerHTML='';
  }
  const msgDiv = document.createElement('div');
  msgDiv.className = kind==='system' ? 'mp-msg system' : `mp-msg ${kind==='me'?'me':'friend'}`;
  if(kind!=='system'){
    const name=document.createElement('b');
    name.textContent=sender || (kind==='me'?'나':'친구');
    msgDiv.appendChild(name);
  }
  const body=document.createElement('span');
  body.textContent=text;
  msgDiv.appendChild(body);
  log.appendChild(msgDiv);
  while(log.children.length>80) log.removeChild(log.firstElementChild);
  log.scrollTop = log.scrollHeight;
}

function updateRosterUI(){
  ensureMPState();
  const peers=[{name:'나', host:G.MP.isHost}];
  G.MP.remoteProfiles.forEach(p=>peers.push({name:p.name||'친구', host:p.host}));
  G.MP.remotePlayers.forEach(p=>{
    if(!peers.some(x=>x.name===p.name)) peers.push({name:p.name||'친구'});
  });
  const html=peers.map(p=>`<span class="mp-chip">${p.host?'HOST ':''}${escapeHtml(p.name)}</span>`).join('');
  const roster=document.getElementById('mp-roster');
  const rosterPanel=document.getElementById('mp-roster-panel');
  if(roster) roster.innerHTML=html;
  if(rosterPanel) rosterPanel.innerHTML=html;
}

function updateChatConnectionUI(online){
  const pill=document.getElementById('mp-conn-pill');
  const input=document.getElementById('mp-chat-input');
  const send=document.getElementById('mp-chat-send-btn');
  if(pill){
    pill.textContent=online ? (G.MP.isHost?'HOST':'ONLINE') : 'OFFLINE';
    pill.className=online ? (G.MP.isHost?'host':'online') : '';
    if(online && G.MP.latency) pill.textContent += ` ${G.MP.latency}ms`;
  }
  if(input) input.disabled=!online;
  if(send) send.disabled=!online;
}

function escapeHtml(str){
  return String(str||'').replace(/[&<>"']/g, ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
}

export function toggleMultiplayerChat(force){
  const panel=document.getElementById('mp-chat-panel');
  if(!panel) return;
  const show = force === undefined ? !panel.classList.contains('show') : !!force;
  panel.classList.toggle('show', show);
  if(show){
    const input=document.getElementById('mp-chat-input');
    setTimeout(()=>input?.focus(),50);
  }
}

function initMpChatBindings() {
  const sendBtn = document.getElementById('mp-chat-send-btn');
  const input = document.getElementById('mp-chat-input');
  if(sendBtn) {
    sendBtn.onclick = () => {
      sendChatMessage(input?.value||'');
      if(input) input.value = '';
    };
  }
  if(input) {
    input.onkeydown = (e) => {
      if(e.key === 'Enter') {
        sendChatMessage(input.value);
        input.value = '';
      }
      if(e.key === 'Escape') toggleMultiplayerChat(false);
    };
  }
  updateChatConnectionUI(hasOpenConnections());
  updateRosterUI();
}

if(document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMpChatBindings);
} else {
  initMpChatBindings();
}
