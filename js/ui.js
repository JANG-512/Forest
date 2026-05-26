// ═══════════════════════════════════════════════════════════════
// ui.js — HUD/패널/대화/상점/박물관/마을센터/인벤토리/알림/시간/파티클
// ═══════════════════════════════════════════════════════════════
import { G } from './game.js';
import { T, CS, ITEMS, VILLAGERS, FISH_POOL, BUG_POOL, FOSSIL_POOL, MILE_ACHIEVEMENTS, SHOP_CATALOG } from './config.js';
import { playSound } from './audio.js';
import { saveState, addItem, addMiles, checkMilestone } from './state.js';
import { refreshTile } from './world.js';
import { mesh, disposeMesh } from './renderer.js';
import { npcPlayerInteract } from './npc.js';
import { ApiClient, NPC_PROFILES } from './api.js';

// ─── 도구 선택 ───────────────────────────────────────────────
export function selectTool(t){
  if (G.currentTool === t) {
    G.currentTool = null;
  } else {
    G.currentTool = t;
  }
  document.querySelectorAll('.tool-btn').forEach(b=>b.classList.toggle('active',b.dataset.tool===G.currentTool));
  if(typeof window.updatePlayerToolMesh === 'function'){
    window.updatePlayerToolMesh();
  }
}

// ─── 대화 시스템 ─────────────────────────────────────────────
let currentNpcId = null;
let currentNpcVi = null;
let typewriterTimer = null;

const NPC_INTENTS = {
  mood:{label:'오늘 어때?', playerLine:'오늘 기분은 어때?', intent:'mood'},
  news:{label:'섬 소식', playerLine:'요즘 섬에서 무슨 일이 있었어?', intent:'island_news'},
  help:{label:'도와줄 일?', playerLine:'내가 도와줄 일이 있을까?', intent:'help'},
  compliment:{label:'칭찬하기', playerLine:'오늘 너 정말 멋져 보여.', intent:'compliment'},
};

function clearDialogueLog(){
  const log=document.getElementById('dlg-log');
  if(!log) return;
  log.innerHTML='';
  log.style.display='none';
}

function appendDialogueMessage(role, speaker, text){
  const log=document.getElementById('dlg-log');
  if(!log) return;
  log.style.display='flex';
  const msg=document.createElement('div');
  msg.className=`dlg-msg ${role}`;
  const safeSpeaker=document.createElement('span');
  safeSpeaker.className='speaker';
  safeSpeaker.textContent=speaker;
  const body=document.createElement('span');
  body.textContent=text;
  msg.appendChild(safeSpeaker);
  msg.appendChild(body);
  log.appendChild(msg);
  log.scrollTop=log.scrollHeight;
}

export function talkTo(vi){
  G.dialogueOpen=true;
  const gs=G.gs;
  gs.talked_to[vi.id]=(gs.talked_to[vi.id]||0)+1;
  currentNpcId = vi.id;
  currentNpcVi = vi;

  // 디버그 대시보드 켜기
  const db = document.getElementById('debug-dashboard');
  if(db) db.style.display = 'block';

  // 디버그 대시보드 이름, 설명 초기화
  const nameEl = document.getElementById('debug-npc-name');
  const descEl = document.getElementById('debug-npc-desc');
  if(nameEl) nameEl.textContent = `${vi.emoji} ${vi.name}`;
  if(descEl) descEl.textContent = NPC_PROFILES[vi.id]?.desc || "숲속의 다정한 주민";

  // 만약 npcState에 감정 수치가 안 들어가 있다면 초기화해준다
  const st = G.npcState[vi.id];
  if(st) {
    if(!st.emotionState) st.emotionState = 'neutral';
    if(!st.emotionValues) {
      st.emotionValues = { happiness: 50, sadness: 10, anger: 0, stress: 15, loneliness: 20, excitement: 20 };
    }
    if(!st.relationship) {
      st.relationship = { friendship: st.friendship || 0, trust: 0, affection: 0, conflict: 0 };
    }
  }

  // 디버그 보드 수치 동기화
  syncDebugBoard(vi.id);

  const first = npcPlayerInteract(vi.id, 'greet');
  const defaultGreeting = first?.reply || vi.dialogues[0] || "안녕! 오늘 무슨 재미있는 일 있어?";
  clearDialogueLog();
  appendDialogueMessage('npc', vi.name, `${vi.emoji} ${defaultGreeting}`);
  
  applyNpcResponse(first, false);
  showDialogue(vi.name, vi.emoji + ' ' + defaultGreeting, buildNpcChoices(), vi.id);

  if(Object.keys(gs.talked_to).length>=VILLAGERS.length) checkMilestone('talk_all');
}

function buildNpcChoices(){
  return [
    ...Object.values(NPC_INTENTS).map(meta=>({text:meta.label, action:()=>continueNpcConversation(meta)})),
    {text:'잘 있어!', action:()=>continueNpcConversation({label:'잘 있어!', playerLine:'나중에 또 보자.', intent:'bye', closes:true})},
  ];
}

function getNpcEmoji(npcId, emotion){
  return NPC_PROFILES[npcId]?.emojis?.[emotion] || currentNpcVi?.emoji || '';
}

function applyNpcResponse(res, updateLog=true){
  if(!res || !currentNpcId || !currentNpcVi) return;
  const st = G.npcState[currentNpcId];
  if(st) {
    st.emotionState = res.emotion || st.emotionState || 'neutral';
    if(res.npc_state) {
      st.emotionValues = {
        happiness: res.npc_state.happiness ?? 50,
        sadness: res.npc_state.sadness ?? 10,
        anger: res.npc_state.anger ?? 0,
        stress: res.npc_state.stress ?? 15,
        loneliness: res.npc_state.loneliness ?? 20,
        excitement: res.npc_state.excitement ?? 20
      };
    }
    if(!st.relationship) st.relationship = { friendship: st.friendship || 0, trust: 0, affection: 0, conflict: 0 };
    if(res.relationship_change) {
      st.relationship.friendship += res.relationship_change.friendship ?? 0;
      st.relationship.trust += res.relationship_change.trust ?? 0;
      st.relationship.affection += res.relationship_change.affection ?? 0;
      st.relationship.conflict += res.relationship_change.conflict ?? 0;
      G.gs.talked_to[currentNpcId] = st.relationship.friendship;
    }
    if(res.memory_created && res.memory_text){
      if(!G.gs.npc_memory) G.gs.npc_memory = {};
      const mem = G.gs.npc_memory[currentNpcId] || (G.gs.npc_memory[currentNpcId]={talkCount:0,memories:[]});
      mem.memories = mem.memories || [];
      mem.memories.push({topic:res.intent||'이야기', text:res.memory_text, at:Date.now()});
      mem.memories = mem.memories.slice(-12);
      mem.lastTopic = res.intent || mem.lastTopic;
    }
    st.aiState = 'REACT';
    st.stateTimer = 120;
  }
  const emoji = getNpcEmoji(currentNpcId, res.emotion || 'neutral');
  document.getElementById('dlg-name').textContent = `${currentNpcVi.name} ${emoji}`;
  syncDebugBoard(currentNpcId, res.relationship_change);
  if(updateLog && res.reply) appendDialogueMessage('npc', currentNpcVi.name, emoji + ' ' + res.reply);
  saveState();
}

async function continueNpcConversation(meta){
  if(!currentNpcId || !currentNpcVi) return;
  appendDialogueMessage('player', '나', meta.playerLine);
  const textEl=document.getElementById('dlg-text');
  const thinking=`${currentNpcVi.emoji} 잠깐 생각 중...`;
  if(textEl) textEl.textContent=thinking;

  const local = npcPlayerInteract(currentNpcId, meta.intent);
  let res = local;
  try {
    res = await ApiClient.talkToNpc('player_1', currentNpcId, meta.playerLine, local?.context || {intent:meta.intent});
  } catch(e) {
    console.error('NPC 대화 처리 오류:', e);
  }
  applyNpcResponse(res, true);
  const emoji = getNpcEmoji(currentNpcId, res?.emotion || 'neutral');
  const replyText = emoji + ' ' + (res?.reply || local?.reply || '...');
  if(meta.closes){
    runTypewriterEffect(textEl, replyText);
    setTimeout(closeDialogue, 450);
  } else {
    showDialogue(currentNpcVi.name, replyText, buildNpcChoices(), currentNpcId);
  }
}

function runTypewriterEffect(element, text, callback) {
  if (typewriterTimer) clearInterval(typewriterTimer);
  
  element.textContent = '';
  let index = 0;
  
  typewriterTimer = setInterval(() => {
    if (index < text.length) {
      element.textContent += text.charAt(index);
      index++;
    } else {
      clearInterval(typewriterTimer);
      typewriterTimer = null;
      if (callback) callback();
    }
  }, 35);
}

export function showDialogue(name, text, choices, npcId){
  const dlg=document.getElementById('dialogue');
  dlg.style.display='block';
  document.getElementById('dlg-name').textContent=name;
  
  const textEl = document.getElementById('dlg-text');
  runTypewriterEffect(textEl, text);

  const ch=document.getElementById('dlg-choices');
  ch.innerHTML='';
  
  // 추가 선택지 버튼
  (choices||[]).forEach(c=>{
    const btn=document.createElement('button');
    btn.className='choice-btn';
    btn.textContent=c.text;
    btn.onclick=()=>c.action();
    ch.appendChild(btn);
  });

  // 대화 종료용 choice 버튼이 없을 때, "잘 있어!" 버튼 추가
  if ((!choices || choices.length === 0) && npcId) {
    const exitBtn = document.createElement('button');
    exitBtn.className = 'choice-btn';
    exitBtn.textContent = '잘 있어! 👋';
    exitBtn.onclick = closeDialogue;
    ch.appendChild(exitBtn);
  }

  const chatLog = document.getElementById('dlg-log');
  if(chatLog && !npcId) chatLog.style.display = 'none';

  playSound('talk');
}

export function closeDialogue(){
  G.dialogueOpen=false;
  document.getElementById('dialogue').style.display='none';
  currentNpcId = null;
  currentNpcVi = null;
  const db = document.getElementById('debug-dashboard');
  if(db) db.style.display='none';
  if(typewriterTimer) {
    clearInterval(typewriterTimer);
    typewriterTimer = null;
  }
}

export function syncDebugBoard(npcId, relChange) {
  const st = G.npcState[npcId];
  if (!st) return;

  const ev = st.emotionValues || { happiness: 50, sadness: 10, anger: 0, stress: 15, loneliness: 20, excitement: 20 };
  const rel = st.relationship || { friendship: 0, trust: 0, affection: 0, conflict: 0 };

  const keys = ['happiness', 'sadness', 'anger', 'stress', 'loneliness', 'excitement'];
  keys.forEach(k => {
    const valEl = document.getElementById(`stat-val-${k}`);
    const barEl = document.getElementById(`stat-bar-${k}`);
    const val = ev[k] !== undefined ? ev[k] : 0;
    if (valEl) valEl.textContent = `${Math.round(val)}%`;
    if (barEl) barEl.style.width = `${Math.max(0, Math.min(100, val))}%`;
  });

  const relKeys = ['friendship', 'trust', 'affection', 'conflict'];
  relKeys.forEach(k => {
    const el = document.getElementById(`rel-val-${k}`);
    if (el) {
      if (relChange) {
        const delta = relChange[k] || 0;
        const sign = delta > 0 ? '+' : '';
        el.textContent = `${sign}${delta} (누적:${rel[k]})`;
        el.style.color = delta > 0 ? '#3a9e5f' : delta < 0 ? '#c8443a' : '#777';
      } else {
        el.textContent = `${rel[k]}`;
        el.style.color = '#3b3028';
      }
    }
  });
}

function initAiUiBindings() {
  const minBtn = document.getElementById('minimize-debug');
  const dbContent = document.getElementById('debug-content');
  if (minBtn && dbContent) {
    minBtn.addEventListener('click', () => {
      if (dbContent.style.display === 'none') {
        dbContent.style.display = 'flex';
        minBtn.textContent = '접기 [-]';
      } else {
        dbContent.style.display = 'none';
        minBtn.textContent = '펴기 [+]';
      }
    });
  }

  const toggleBtn = document.getElementById('ai-toggle-btn');
  const connBadge = document.getElementById('ai-conn-badge');
  const urlInput = document.getElementById('ai-url-input');

  if (toggleBtn && connBadge && urlInput) {
    ApiClient.isLocalMode = true;
    connBadge.textContent = '시뮬레이터';
    connBadge.style.background = '#fff3cd';
    connBadge.style.color = '#856404';
    toggleBtn.textContent = '실제 서버로 연동';

    toggleBtn.addEventListener('click', () => {
      ApiClient.isLocalMode = !ApiClient.isLocalMode;
      if (ApiClient.isLocalMode) {
        connBadge.textContent = '시뮬레이터';
        connBadge.style.background = '#fff3cd';
        connBadge.style.color = '#856404';
        toggleBtn.textContent = '실제 서버로 연동';
        notify('🔌 로컬 시뮬레이터 모드로 전환되었습니다.');
      } else {
        connBadge.textContent = '실제 서버';
        connBadge.style.background = '#d4edda';
        connBadge.style.color = '#155724';
        toggleBtn.textContent = '시뮬레이터로 연동';
        ApiClient.serverUrl = urlInput.value.trim() || "http://localhost:8000";
        notify(`🔌 실제 API 서버로 연동되었습니다. (${ApiClient.serverUrl})`);
      }
    });

    urlInput.addEventListener('change', () => {
      ApiClient.serverUrl = urlInput.value.trim() || "http://localhost:8000";
      if (!ApiClient.isLocalMode) {
        notify(`🔌 API 서버 주소가 변경되었습니다: ${ApiClient.serverUrl}`);
      }
    });
  }

}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAiUiBindings);
} else {
  initAiUiBindings();
}

// ─── 상점 시스템 ─────────────────────────────────────────────
export function openShop(){
  togglePanel('shop');
  shopTab('buy');
}
export function shopTab(mode){
  G.shopMode=mode;
  const gs=G.gs;
  const content=document.getElementById('shop-content');
  if(mode==='buy'){
    content.innerHTML=SHOP_CATALOG.map(c=>{
      const item=ITEMS[c.id];
      return `<div class="shop-item" onclick="buyItem('${c.id}')">
        <span style="font-size:20px">${item.emoji}</span>
        <span class="sname">${item.name}</span>
        <span class="sprice">🔔${item.price.toLocaleString()}</span>
      </div>`;
    }).join('');
  } else {
    const items=Object.entries(gs.inventory).filter(([k,v])=>v>0&&ITEMS[k]&&ITEMS[k].sell>0);
    if(!items.length){content.innerHTML='<div style="color:#aaa;padding:20px;text-align:center">판매할 물품이 없어요</div>';return;}
    content.innerHTML=items.map(([k,qty])=>{
      const item=ITEMS[k];
      return `<div class="shop-item" onclick="sellItem('${k}')">
        <span style="font-size:20px">${item.emoji}</span>
        <span class="sname">${item.name} x${qty}</span>
        <span class="sprice">🔔${item.sell.toLocaleString()}/개</span>
      </div>`;
    }).join('');
  }
}
export function buyItem(id){
  const gs=G.gs;
  const item=ITEMS[id];
  if(gs.bells<item.price){notify('🔔 종이 부족해요!');return;}
  gs.bells-=item.price;
  addItem(id,1);
  notify(`🛒 ${item.emoji} ${item.name} 구입!`);
  saveState(); updateUI(); shopTab(G.shopMode);
}
export function sellItem(id){
  const gs=G.gs;
  const item=ITEMS[id];
  if(!gs.inventory[id]||gs.inventory[id]<1){return;}
  gs.inventory[id]--;
  if(gs.inventory[id]<=0) delete gs.inventory[id];
  gs.bells+=item.sell;
  gs.total_sold+=item.sell;
  notify(`💰 ${item.emoji} ${item.name} 판매! +🔔${item.sell.toLocaleString()}`);
  checkMilestone('first_sell');
  if(gs.bells>=10000) checkMilestone('bells_10k');
  saveState(); updateUI(); shopTab(G.shopMode);
}

// ─── 박물관 ──────────────────────────────────────────────────
export function openMuseum(){
  togglePanel('museum');
  renderMuseum();
}
export function renderMuseum(){
  const gs=G.gs;
  const content=document.getElementById('museum-content');
  let html='';
  const cats=[
    {key:'fish',  label:'🐟 물고기',  pool:FISH_POOL},
    {key:'bug',   label:'🦋 벌레',    pool:BUG_POOL},
    {key:'fossil',label:'💀 화석',    pool:FOSSIL_POOL},
  ];
  cats.forEach(({key,label,pool})=>{
    const donated=Object.keys(gs.museum[key]).length;
    html+=`<div class="museum-section"><h3>${label} (${donated}/${pool.length})</h3>
      <div class="museum-grid">${pool.map(id=>{
        const donated2=gs.museum[key][id];
        return `<div class="mslot ${donated2?'donated':'empty'}" title="${ITEMS[id].name}${donated2?'(기증됨)':''}" onclick="donateItem('${key}','${id}')">
          <span>${ITEMS[id].emoji}</span></div>`;
      }).join('')}</div></div>`;
  });
  html+=`<div style="padding:10px;background:#f5f0e8;border-radius:10px;margin-top:10px;font-size:12px;color:#7a5c2e">
    <b>블래더스:</b> 기증해 주신 것을 고이 모시겠습니다... 호~🦉
  </div>`;
  content.innerHTML=html;
}
export function donateItem(cat, id){
  const gs=G.gs;
  if(gs.museum[cat][id]){ notify(`이미 기증된 ${ITEMS[id].name}이에요!`); return; }
  if(!gs.inventory[id]||gs.inventory[id]<1){ notify(`${ITEMS[id].name}을(를) 갖고 있지 않아요.`); return; }
  gs.inventory[id]--;
  if(gs.inventory[id]<=0) delete gs.inventory[id];
  gs.museum[cat][id]=true;
  notify(`🦉 ${ITEMS[id].emoji} ${ITEMS[id].name} 기증 완료!`);
  addMiles(200);
  if(cat==='fish'&&Object.keys(gs.museum.fish).length>=1) checkMilestone('donate_fish');
  if(cat==='bug' &&Object.keys(gs.museum.bug).length>=1)  checkMilestone('donate_bug');
  if(cat==='fossil'&&Object.keys(gs.museum.fossil).length>=1) checkMilestone('donate_fossil');
  saveState(); updateUI(); renderMuseum();
  playSound('donate');
}

// ─── 마을센터 ─────────────────────────────────────────────────
export function openNookHQ(){
  togglePanel('nook');
  renderNookHQ();
}
export function renderNookHQ(){
  const gs=G.gs;
  const content=document.getElementById('nook-content');
  const debtStr=gs.nook_debt>0?`<div style="background:#fff3cd;border-radius:10px;padding:12px;margin-bottom:12px;font-size:13px">
    <b>🦝 이장:</b> 정착 비용이 🔔${gs.nook_debt.toLocaleString()} 남았어요!<br>
    <button style="margin-top:8px;padding:6px 14px;border:none;border-radius:8px;background:#e6aa22;color:white;font-weight:800;cursor:pointer" onclick="payDebt()">빚 갚기 (현재 종: 🔔${gs.bells.toLocaleString()})</button>
  </div>`:'<div style="background:#d4edda;border-radius:10px;padding:12px;margin-bottom:12px;font-size:13px">✅ 빚을 다 갚았어요!</div>';

  const miles=MILE_ACHIEVEMENTS.map(a=>{
    const done=gs.achievements[a.id];
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px;border-radius:10px;background:${done?'rgba(126,200,128,.2)':'rgba(0,0,0,.04)'};margin-bottom:4px;opacity:${done?1:.6}">
      <span style="font-size:18px">${a.emoji}</span>
      <span style="flex:1;font-size:12px;font-weight:700;color:#3b3028">${a.name}</span>
      <span style="font-size:11px;color:#e6aa22;font-weight:800">${done?'✅':''} 🦋${a.miles}</span>
    </div>`;
  }).join('');

  content.innerHTML=`${debtStr}<h3 style="font-size:13px;font-weight:800;color:#3b3028;margin-bottom:8px">🦋 섬 마일 업적</h3>${miles}`;
}
export function payDebt(){
  const gs=G.gs;
  const pay=Math.min(gs.bells, gs.nook_debt);
  if(pay<=0){notify('종이 없어요!');return;}
  gs.bells-=pay; gs.nook_debt-=pay;
  if(gs.nook_debt<=0){
    gs.nook_debt=0;
    notify('🎉 빚을 다 갚았어요! 섬이 당신 것이에요!');
    addMiles(1000);
    if(gs.house_level===0){ gs.house_level=1; refreshTile(28,34); notify('🏠 텐트가 집이 됐어요!');}
  } else {
    notify(`💰 🔔${pay.toLocaleString()} 납부! 남은 빚: 🔔${gs.nook_debt.toLocaleString()}`);
  }
  saveState(); updateUI(); renderNookHQ();
}

// ─── 집 메뉴 ──────────────────────────────────────────────────
export function openHouseMenu(){
  const gs=G.gs;
  const costs=[0,98000,348000,498000];
  const lv=gs.house_level;
  if(lv>=3){notify('🏠 더 이상 확장할 수 없어요!');return;}
  const cost=costs[lv+1]||0;
  showDialogue('이장',
    `🏠 집을 확장할까요? 🔔${cost.toLocaleString()} 이 필요해요.`,
    [
      {text:`확장! (🔔${cost.toLocaleString()})`, action:()=>{
        if(gs.bells<cost){notify('종이 부족해요!');closeDialogue();return;}
        gs.bells-=cost; gs.house_level++;
        refreshTile(28,34);
        notify(`🏠 집이 확장됐어요! (레벨 ${gs.house_level})`);
        saveState(); updateUI(); closeDialogue();
      }},
      {text:'나중에', action:closeDialogue},
    ]
  );
}

// ─── 인벤토리 ─────────────────────────────────────────────────
export function renderInventory(){
  const gs=G.gs;
  document.getElementById('inv-bells').textContent=gs.bells.toLocaleString();
  document.getElementById('inv-miles').textContent=gs.miles.toLocaleString();
  const grid=document.getElementById('inv-grid');
  const items=Object.entries(gs.inventory).filter(([k,v])=>v>0&&ITEMS[k]);
  if(!items.length){grid.innerHTML='<div style="color:#aaa;grid-column:1/-1;text-align:center;padding:20px">인벤토리가 비었어요</div>';return;}
  grid.innerHTML=items.map(([k,qty])=>{
    const item=ITEMS[k];
    return `<div class="inv-item" onclick="showItemMenu('${k}')">
      <div style="font-size:22px">${item.emoji}</div>
      <div class="iname">${item.name}</div>
      <div class="iprice">x${qty}</div>
    </div>`;
  }).join('');
}
export function showItemMenu(id){
  const gs=G.gs;
  const item=ITEMS[id];
  const choices=[{text:'닫기', action:closeDialogue}];
  if(item.sell>0) choices.unshift({text:`팔기 (🔔${item.sell})`, action:()=>{sellItem(id);closeDialogue();}});
  if(item.cat==='fossil'||item.cat==='fish'||item.cat==='bug'){
    choices.unshift({text:'박물관에 기증', action:()=>{donateItem(item.cat,id);closeDialogue();}});
  }
  if(id==='medicine'){
    choices.unshift({text:'약 먹기 (치료)', action:()=>{
      if(!G.playerStung){
        notify('🤕 지금은 쏘인 곳이 없어 약을 먹을 필요가 없습니다.');
        closeDialogue();
        return;
      }
      if(gs.inventory.medicine > 0){
        gs.inventory.medicine--;
        if(gs.inventory.medicine === 0) delete gs.inventory.medicine;
        G.playerStung = false;
        if(typeof window.buildPlayer === 'function') window.buildPlayer();
        playSound('buy');
        notify('💊 약을 먹고 벌 쏘인 상처가 깨끗이 나았습니다!');
        saveState();
        updateUI();
      }
      closeDialogue();
    }});
  }
  showDialogue(item.name, `${item.emoji} ${item.name} x${gs.inventory[id]||0}`, choices);
}

// ─── 패널 토글 ───────────────────────────────────────────────
export function togglePanel(id){
  const el=document.getElementById('panel-'+id);
  if(!el) return;
  const isOpen=G.openPanels.has(id);
  closeAllPanels();
  if(!isOpen){
    el.classList.add('show');
    G.openPanels.add(id);
    if(id==='inv') renderInventory();
    if(id==='museum') renderMuseum();
    if(id==='nook') renderNookHQ();
    if(id==='shop') shopTab('buy');
  }
}
export function closeAllPanels(){
  document.querySelectorAll('.panel-overlay').forEach(p=>p.classList.remove('show'));
  G.openPanels.clear();
}

// ─── 알림 ───────────────────────────────────────────────────
export function notify(msg){
  const area=document.getElementById('notif-area');
  const el=document.createElement('div');
  el.className='notif';
  el.textContent=msg;
  area.appendChild(el);
  setTimeout(()=>el.remove(),3200);
}

// ─── 파티클 효과 ─────────────────────────────────────────────
export function spawnParticles(wx,wy,wz,emoji,count){
  for(let i=0;i<count;i++){
    const g=new THREE.Group();
    g.position.set(wx+(Math.random()-.5),wy+Math.random()*0.5,wz+(Math.random()-.5));
    let color = [0xffee44,0x44ee44,0xff88bb,0x44aaff,0xffffff][i%5];
    if (emoji === '🍃') color = 0x4a9e30; // green leaves
    if (emoji === '💧') color = 0x5ba3e0; // water blue
    if (emoji === '🍯') color = 0xd2b48c; // wood/beehive brown
    const sp=mesh(new THREE.SphereGeometry(0.06,5,4),color,false);
    g.add(sp);
    g.userData={vy:0.04+Math.random()*0.06, life:60};
    G.scene.add(g);
    G.particles3d.push(g);
  }
}

export function spawnBees(wx, wy, wz) {
  for(let i=0; i<15; i++){
    const g=new THREE.Group();
    const radius = 0.6 + Math.random() * 0.8;
    const angle = Math.random() * Math.PI * 2;
    g.position.set(wx + Math.cos(angle) * radius, wy + Math.random() * 1.2, wz + Math.sin(angle) * radius);
    
    const color = i % 2 === 0 ? 0x111111 : 0xffcc00; // 검은색 & 노란색 벌떼
    const sp = mesh(new THREE.SphereGeometry(0.032, 4, 3), color, false);
    g.add(sp);
    
    g.userData = {
      isBee: true,
      angle: angle,
      radius: radius,
      speed: 0.08 + Math.random() * 0.08,
      vy: (Math.random() - 0.5) * 0.015,
      life: 110
    };
    G.scene.add(g);
    G.particles3d.push(g);
  }
}

export function updateParticles(){
  const px = G.playerPos.x;
  const pz = G.playerPos.z;
  const py = G.playerMesh ? G.playerMesh.position.y : 1.0;
  for(let i=G.particles3d.length-1;i>=0;i--){
    const p=G.particles3d[i];
    p.userData.life--;
    if (p.userData.isBee) {
      p.userData.angle += p.userData.speed;
      p.userData.radius = Math.max(0.15, p.userData.radius - 0.006);
      p.position.x = px + Math.cos(p.userData.angle) * p.userData.radius;
      p.position.z = pz + Math.sin(p.userData.angle) * p.userData.radius;
      p.position.y = (py + 1.1) + Math.sin(performance.now() * 0.012 + p.userData.angle) * 0.25;
    } else {
      p.position.y+=p.userData.vy;
      p.userData.vy-=0.002;
    }
    p.children.forEach(c=>{if(c.material){
      const maxLife = p.userData.isBee ? 110 : 60;
      c.material.opacity=p.userData.life/maxLife;
      c.material.transparent=true;
    }});
    if(p.userData.life<=0){G.scene.remove(p);disposeMesh(p);G.particles3d.splice(i,1);}
  }
}

// ─── 낮/밤 & 날씨 시스템 ────────────────────────────────────
export function updateTimeSystem(){
  const now=new Date();
  const h=now.getHours(), m=now.getMinutes();
  document.getElementById('time-val').textContent=
    String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
  document.getElementById('date-val').textContent=
    `${now.getMonth()+1}/${now.getDate()}`;
  // 계절
  const mo=now.getMonth();
  const seasons=[{n:'겨울',e:'❄️'},{n:'겨울',e:'❄️'},{n:'봄',e:'🌸'},
    {n:'봄',e:'🌸'},{n:'봄',e:'🌸'},{n:'여름',e:'☀️'},
    {n:'여름',e:'☀️'},{n:'여름',e:'☀️'},{n:'가을',e:'🍂'},
    {n:'가을',e:'🍂'},{n:'가을',e:'🍂'},{n:'겨울',e:'❄️'}];
  const s=seasons[mo];
  document.getElementById('season-name').textContent=s.n;
  document.getElementById('season-icon').textContent=s.e;
  if(G.inInterior) return; // 실내 진입 시 실외 조명/안개/하늘색 갱신 방지
  // 조명
  let ambI, sunI, sunC, ambC, fogC, skyC;
  if(h>=6&&h<8){         // 새벽
    const p=(h-6+m/60)/2;
    ambI=0.25+p*0.2; sunI=0.3+p*0.5; sunC=0xffbb88; ambC=0xffccaa;
    fogC=0xffbbaa; skyC=0xff8866;
  } else if(h>=8&&h<17){ // 낮
    ambI=0.28; sunI=1.35; sunC=0xfff1cf; ambC=0xffead6;
    fogC=0xa7ddf2; skyC=0xa7ddf2;
  } else if(h>=17&&h<20){// 저녁
    const p=(h-17+m/60)/3;
    ambI=0.55-p*0.25; sunI=1.0-p*0.6; sunC=0xff8844; ambC=0xffaa88;
    fogC=0xee9966; skyC=0xee7744;
  } else {               // 밤
    ambI=0.42; sunI=0.18; sunC=0x7799dd; ambC=0x5a6a99;
    fogC=0x1e2b45; skyC=0x12182e;
  }
  G.ambLight.intensity=ambI;
  G.sunLight.intensity=sunI;
  G.sunLight.color.setHex(sunC);
  G.ambLight.color.setHex(ambC);
  if(G.hemiLight){
    G.hemiLight.intensity=h>=8&&h<17?0.86:0.58;
    G.hemiLight.color.setHex(h>=8&&h<17?0xc8f1ff:0x9fb2ff);
    G.hemiLight.groundColor.setHex(h>=8&&h<17?0xcaa36b:0x5f4b78);
  }
  G.scene.fog=new THREE.Fog(fogC,42,96);
  G.renderer.setClearColor(skyC);
  G.scene.background = new THREE.Color(skyC);
  G.moonLight.intensity=h>=20||h<6?0.15:0;
  document.getElementById('time-icon').textContent=
    h>=6&&h<18?'☀️':h>=18&&h<20?'🌅':'🌙';
}

// ─── UI 업데이트 ─────────────────────────────────────────────
export function updateUI(){
  const gs=G.gs;
  document.getElementById('bells-val').textContent=gs.bells.toLocaleString();
  document.getElementById('miles-val').textContent=gs.miles.toLocaleString();
  const bar=document.getElementById('itembar');
  const items=Object.entries(gs.inventory).filter(([k,v])=>v>0&&ITEMS[k]).slice(0,8);
  bar.innerHTML=items.map(([k,qty])=>{
    return `<div class="item-slot" onclick="showItemMenu('${k}')">
      <span>${ITEMS[k].emoji}</span>
      <span class="qty">${qty}</span>
    </div>`;
  }).join('');
  if(!items.length) bar.innerHTML='<div style="color:#bbb;font-size:12px;padding:4px 8px">주머니 비어있음</div>';
}
