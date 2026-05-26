// ═══════════════════════════════════════════════════════════════
// main.js — 부팅 & 메인 게임 루프 & window 글로벌 노출
// ═══════════════════════════════════════════════════════════════
import './renderer.js';   // side-effect: G.scene/camera/renderer/exteriorRoot 초기화
import { G } from './game.js';
import { loadState, saveState } from './state.js';
import { generateWorld, buildGround, setTile, refreshTile } from './world.js';
import { buildPlayer } from './character.js';
import { buildNPC, updateNPCs } from './npc.js';
import { initControls, initMobileControls, updatePlayer, updateCamera,
         updateFishing, tryInteract, rotateCam, toggleRun, updatePlayerToolMesh, buildFacingMarker } from './player.js';
import { initMultiplayer, updateMultiplayer, sendPosition,
         joinFriendIsland, copyIslandCode, disconnectMP,
         sendChatMessage, toggleMultiplayerChat, openMultiplayerRoom } from './multiplayer.js';
import { updateTimeSystem, updateUI, notify, updateParticles, spawnBees } from './ui.js';
import { updateInterior } from './interior.js';
import { VILLAGERS, T, CS } from './config.js';
import { playBGM } from './audio.js';
import {
  togglePanel, closeAllPanels, selectTool, showItemMenu,
  buyItem, sellItem, shopTab, donateItem, payDebt, closeDialogue,
} from './ui.js';
import { initTextures, TEXTURES } from './textures.js';

// ─── window 글로벌 노출 (HTML onclick / inline 핸들러용) ─────
Object.assign(window, {
  // player.js
  tryInteract, rotateCam, toggleRun, updatePlayerToolMesh,
  // ui.js
  togglePanel, closeAllPanels, selectTool, showItemMenu,
  buyItem, sellItem, shopTab, donateItem, payDebt, closeDialogue,
  notify, updateUI, spawnBees,
  // character.js
  buildPlayer,
  // multiplayer.js
  joinFriendIsland, copyIslandCode, disconnectMP, sendChatMessage, toggleMultiplayerChat, openMultiplayerRoom,
});
// dialogueOpen는 inline 핸들러(if(!dialogueOpen)...)에서 참조됨 → getter로 노출
Object.defineProperty(window, 'dialogueOpen', { get(){ return G.dialogueOpen; } });

// ─── 메인 게임 루프 ──────────────────────────────────────────
let lastTime=0;
function gameLoop(ts){
  requestAnimationFrame(gameLoop);
  const dt=Math.min((ts-lastTime)/16.67, 3);
  lastTime=ts; G.tick++;

  updatePlayer(dt);
  updateNPCs(dt);
  updateFishing(dt);
  updateParticles();
  updateInterior();
  updateCamera();
  updateMultiplayer(dt);

  // 수면(강물/바다) 절차적 포말 텍스처 스크롤 애니메이션
  if (TEXTURES.water) {
    TEXTURES.water.offset.y += 0.0006 * dt;
    TEXTURES.water.offset.x += 0.0002 * dt;
  }
  if (TEXTURES.waterMaterial && TEXTURES.waterMaterial.uniforms) {
    TEXTURES.waterMaterial.uniforms.time.value = performance.now() * 0.001;
  }

  // 바람에 살랑살랑 흔들리는 풀잎 애니메이션
  if (G.grassBlades) {
    const time = performance.now() * 0.0022;
    G.grassBlades = G.grassBlades.filter(blade => {
      if (!blade.parent) return false;
      const phase = blade.userData.windPhase || 0;
      blade.rotation.z = (blade.userData.origRotZ || 0) + Math.sin(time + phase) * 0.12;
      blade.rotation.x = (blade.userData.origRotX || 0) + Math.cos(time * 0.85 + phase) * 0.08;
      return true;
    });
  }

  // 매 60틱마다 시간/날씨
  if(G.tick%60===0) updateTimeSystem();
  // 매 5분마다 저장
  if(G.tick%(60*60*5)===0) saveState();
  // 멀티 위치 동기화 (매 6틱 ≒ 100ms)
  if(G.tick%6===0) sendPosition();

  G.renderer.render(G.scene, G.camera);
}

// ─── 부팅 ────────────────────────────────────────────────────
function boot(){
  loadState();          // G.gs 설정
  generateWorld();      // G.world 생성

  buildGround();
  buildPlayer();
  buildFacingMarker();
  VILLAGERS.forEach(v=>buildNPC(v));

  // 발굴 지점 마커 갱신
  Object.entries(G.gs.world_dig_spots).forEach(([key,ds])=>{
    if(!ds.found){
      const [dx,dy]=key.split(',').map(Number);
      setTile(dx,dy,T.DIG_SPOT);
      refreshTile(dx,dy);
    }
  });

  // 플레이어 시작 위치: 집/길/강이 한 화면에 들어오도록 남쪽 마을 중심부에 배치
  G.playerPos.x=27*CS; G.playerPos.z=31*CS;
  G.camTargetX=G.playerPos.x; G.camTargetZ=G.playerPos.z;

  updateTimeSystem();
  updateUI();
  initControls();
  initMobileControls();
  initMultiplayer();
  notify('🌿 섬에 오신 것을 환영합니다!');
  setTimeout(()=>notify('📱 모바일: 왼쪽 조이스틱으로 이동, 오른쪽 버튼으로 행동!'),3000);
  setTimeout(()=>notify('🌍 멀티플레이: 툴바 🌍 버튼 → 섬 코드 공유!'),6000);

  requestAnimationFrame(gameLoop);

  // ── PWA 서비스 워커 등록 ──
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js',{scope:'./'})
      .then(r=>console.log('[PWA] SW registered, scope:',r.scope))
      .catch(e=>console.warn('[PWA] SW register failed:',e));
  }
}

boot();
