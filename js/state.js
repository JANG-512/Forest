// ═══════════════════════════════════════════════════════════════
// state.js — 세이브/로드 & 인벤토리/마일 헬퍼
// ═══════════════════════════════════════════════════════════════
import { SAVE_KEY, MILE_ACHIEVEMENTS } from './config.js';
import { G } from './game.js';

export function freshState() {
  return {
    bells: 1000,
    miles: 0,
    inventory: {apple:3, wood:2},
    museum: {fish:{}, bug:{}, fossil:{}},
    house_level: 0,  // 0=텐트 1=집 2=증축 3=2층
    milestones: {},
    world_trees: {},    // "x,y"→{fruit:'apple', grown:0, lastShake:0}
    world_flowers: {},  // "x,y"→{type, watered:false}
    world_dig_spots: {},// "x,y"→{fossil:id, found:false}
    talked_to: {},
    shop_level: 0,      // 0=숲속상회 텐트 1=가게
    nook_debt: 98000,   // 정착 비용
    day: new Date().toDateString(),
    total_fish: 0,
    total_bugs: 0,
    total_fossils: 0,
    total_sold: 0,
    achievements: {},
  };
}

export function loadState() {
  let s;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch(e){}
  G.gs = (s && s.bells !== undefined) ? s : freshState();
  G.playerStung = !!G.gs.playerStung;
  return G.gs;
}

export function saveState() {
  G.gs.playerStung = !!G.playerStung;
  localStorage.setItem(SAVE_KEY, JSON.stringify(G.gs));
}

// ─── 인벤토리 ─────────────────────────────────────────────────
export function addItem(id, qty){
  const gs = G.gs;
  if(!gs.inventory[id]) gs.inventory[id]=0;
  gs.inventory[id]+=qty;
  // updateUI는 ui.js에서 호출; 순환 의존을 피하기 위해 window에 노출되면 사용
  if(typeof window.updateUI === 'function') window.updateUI();
}

// ─── 마일 ─────────────────────────────────────────────────────
export function addMiles(n){
  G.gs.miles+=n;
  const el=document.getElementById('miles-val');
  if(el) el.textContent=G.gs.miles.toLocaleString();
}

export function checkMilestone(id){
  const gs=G.gs;
  if(gs.achievements[id]) return;
  const a=MILE_ACHIEVEMENTS.find(m=>m.id===id);
  if(!a) return;
  gs.achievements[id]=true;
  addMiles(a.miles);
  if(typeof window.notify === 'function') window.notify(`🦋 업적 달성! "${a.name}" +${a.miles}마일`);
}
