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

// ─── 도구 선택 ───────────────────────────────────────────────
export function selectTool(t){
  G.currentTool=t;
  document.querySelectorAll('.tool-btn').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));
}

// ─── 대화 시스템 ─────────────────────────────────────────────
export function talkTo(vi){
  G.dialogueOpen=true;
  const gs=G.gs;
  gs.talked_to[vi.id]=(gs.talked_to[vi.id]||0)+1;
  // AI 기반 대화 생성
  const aiLine=npcPlayerInteract(vi.id);
  const st=G.npcState[vi.id];
  const displayLine=aiLine ? aiLine.replace(vi.name+': ','') : vi.dialogues[0];

  // 친밀도에 따른 선택지 분기
  const friendship=st?st.friendship:0;
  const choices=[];
  if(friendship>=5 && st.memory.learnedPhrases.length>0){
    const shared=st.memory.learnedPhrases[Math.floor(Math.random()*st.memory.learnedPhrases.length)];
    choices.push({text:'다른 주민한테서 들은 거 있어?', action:()=>{
      showDialogue(vi.name, `${vi.emoji} 응! "${shared}" 이런 말도 있더라고!`,
        [{text:'오오~', action:closeDialogue}]);
    }});
  }
  if(friendship>=2){
    choices.push({text:'요즘 어때?', action:()=>{
      const hour=new Date().getHours();
      const mood=hour<12?'아침부터 기운 넘쳐!':hour<18?'오후가 최고야~':'저녁은 여유롭지~';
      showDialogue(vi.name, `${vi.emoji} ${mood} 너는?`,
        [{text:'나도 좋아!', action:closeDialogue}]);
    }});
  }
  choices.push({text:'무슨 일 있어?', action:()=>{
    const rumours=[
      '아, 오늘 해변에서 이상한 물건을 봤어!',
      '마을 광장에 새 조각상이 생긴다는 소문이 있어!',
      '마을 상점에 새 상품 들어온다고 하던데?',
      `${VILLAGERS.find(v=>v.id!==vi.id)?.name||'옆집'}이(가) 요즘 뭔가 이상하대...`,
    ];
    showDialogue(vi.name, `${vi.emoji} ${rumours[Math.floor(Math.random()*rumours.length)]}`,
      [{text:'그렇구나!', action:closeDialogue}]);
  }});
  choices.push({text:'잘 있어!', action:closeDialogue});

  showDialogue(vi.name, vi.emoji+' '+displayLine, choices);
  if(Object.keys(gs.talked_to).length>=VILLAGERS.length) checkMilestone('talk_all');
}

export function showDialogue(name, text, choices){
  const dlg=document.getElementById('dialogue');
  dlg.style.display='block';
  document.getElementById('dlg-name').textContent=name;
  document.getElementById('dlg-text').textContent=text;
  const ch=document.getElementById('dlg-choices');
  ch.innerHTML='';
  (choices||[]).forEach(c=>{
    const btn=document.createElement('button');
    btn.className='choice-btn';
    btn.textContent=c.text;
    btn.onclick=()=>c.action();
    ch.appendChild(btn);
  });
  playSound('talk');
}
export function closeDialogue(){
  G.dialogueOpen=false;
  document.getElementById('dialogue').style.display='none';
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
    const col2=[0xffee44,0x44ee44,0xff88bb,0x44aaff,0xffffff][i%5];
    const sp=mesh(new THREE.SphereGeometry(0.06,5,4),col2,false);
    g.add(sp);
    g.userData={vy:0.04+Math.random()*0.06, life:60};
    G.scene.add(g);
    G.particles3d.push(g);
  }
}
export function updateParticles(){
  for(let i=G.particles3d.length-1;i>=0;i--){
    const p=G.particles3d[i];
    p.userData.life--;
    p.position.y+=p.userData.vy;
    p.userData.vy-=0.002;
    p.children.forEach(c=>{if(c.material){c.material.opacity=p.userData.life/60;c.material.transparent=true;}});
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
  // 조명
  let ambI, sunI, sunC, ambC, fogC, skyC;
  if(h>=6&&h<8){         // 새벽
    const p=(h-6+m/60)/2;
    ambI=0.25+p*0.2; sunI=0.3+p*0.5; sunC=0xffbb88; ambC=0xffccaa;
    fogC=0xffbbaa; skyC=0xff8866;
  } else if(h>=8&&h<17){ // 낮
    ambI=0.55; sunI=1.0; sunC=0xfff4d0; ambC=0xfff4e8;
    fogC=0x7ec8e3; skyC=0x7ec8e3;
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
  G.scene.fog=new THREE.Fog(fogC,70,160);
  G.renderer.setClearColor(skyC);
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
