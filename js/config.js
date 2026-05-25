// ═══════════════════════════════════════════════════════════════
// config.js — 정적 데이터 & 상수
// ═══════════════════════════════════════════════════════════════

// ─── 타일 타입 ───────────────────────────────────────────────
export const T = Object.freeze({
  OCEAN:0, BEACH:1, GRASS:2, RIVER:3, CLIFF:4,
  FLOWER:5, TREE:6, ROCK:7, SHOP:8, MUSEUM:9,
  NOOK_HQ:10, PLAYER_HOUSE:11, VILLAGER_HOUSE:12,
  DIG_SPOT:13, PATH:14, WATERFALL:15, BRIDGE:16,
});

export const WW = 48, WH = 48, CS = 1.8;
export const CAM_EL = 0.58;
export const CAM_DST = 26;
export const SAVE_KEY = 'forest_island_v1';

// ─── 아이템 데이터베이스 ─────────────────────────────────────
export const ITEMS = {
  // 과일
  apple:     {name:'사과',        emoji:'🍎', cat:'fruit',  price:400,  sell:200},
  pear:      {name:'서양배',      emoji:'🍐', cat:'fruit',  price:400,  sell:200},
  orange:    {name:'오렌지',      emoji:'🍊', cat:'fruit',  price:400,  sell:200},
  cherry:    {name:'체리',        emoji:'🍒', cat:'fruit',  price:400,  sell:200},
  coconut:   {name:'코코넛',      emoji:'🥥', cat:'fruit',  price:600,  sell:300},
  // 물고기
  sea_bass:  {name:'농어',        emoji:'🐟', cat:'fish',   price:600,  sell:400,   rarity:0.45},
  dace:      {name:'강피라미',    emoji:'🐠', cat:'fish',   price:400,  sell:240,   rarity:0.40},
  carp:      {name:'잉어',        emoji:'🐡', cat:'fish',   price:800,  sell:300,   rarity:0.35},
  crucian:   {name:'붕어',        emoji:'🎣', cat:'fish',   price:500,  sell:160,   rarity:0.30},
  goldfish:  {name:'금붕어',      emoji:'🐠', cat:'fish',   price:1300, sell:1300,  rarity:0.15},
  pale_chub: {name:'납지리',      emoji:'🐟', cat:'fish',   price:400,  sell:200,   rarity:0.35},
  oarfish:   {name:'산갈치',      emoji:'🐋', cat:'fish',   price:9000, sell:9000,  rarity:0.02},
  tuna:      {name:'참다랑어',    emoji:'🐟', cat:'fish',   price:7000, sell:7000,  rarity:0.03},
  shark:     {name:'상어',        emoji:'🦈', cat:'fish',   price:8000, sell:8000,  rarity:0.02},
  frog2:     {name:'개구리',      emoji:'🐸', cat:'fish',   price:400,  sell:120,   rarity:0.20},
  // 벌레
  common_butterfly:{name:'흰나비',      emoji:'🦋', cat:'bug', price:160, sell:160, rarity:0.50},
  yellow_butterfly:{name:'노랑나비',    emoji:'🦋', cat:'bug', price:200, sell:200, rarity:0.40},
  tiger_butterfly: {name:'호랑나비',    emoji:'🦋', cat:'bug', price:240, sell:240, rarity:0.30},
  beetle:    {name:'장수풍뎅이',  emoji:'🪲', cat:'bug',   price:1350, sell:1350, rarity:0.10},
  firefly:   {name:'반딧불이',    emoji:'✨', cat:'bug',   price:300,  sell:300,  rarity:0.20},
  cicada:    {name:'말매미',      emoji:'🦗', cat:'bug',   price:200,  sell:200,  rarity:0.35},
  cricket:   {name:'귀뚜라미',    emoji:'🦗', cat:'bug',   price:130,  sell:130,  rarity:0.40},
  tarantula: {name:'타란툴라',    emoji:'🕷️', cat:'bug',  price:8000, sell:8000, rarity:0.01},
  // 화석
  fossil_a:  {name:'공룡두개골',  emoji:'💀', cat:'fossil', price:0, sell:5000},
  fossil_b:  {name:'공룡앞발',    emoji:'🦴', cat:'fossil', price:0, sell:4500},
  fossil_c:  {name:'공룡뒷발',    emoji:'🦕', cat:'fossil', price:0, sell:4000},
  fossil_d:  {name:'암모나이트',  emoji:'🐚', cat:'fossil', price:0, sell:1100},
  fossil_e:  {name:'삼엽충',      emoji:'🦂', cat:'fossil', price:0, sell:1300},
  // 재료
  wood:      {name:'나무',        emoji:'🪵', cat:'material', price:100, sell:60},
  stone:     {name:'돌',          emoji:'🪨', cat:'material', price:0,   sell:0},
  iron:      {name:'쇠덩이',      emoji:'⚙️', cat:'material', price:0,  sell:0},
  // 가구/씨앗
  seed_flower:{name:'꽃씨',       emoji:'🌱', cat:'seed',   price:80,  sell:10},
  seed_tree:  {name:'묘목',       emoji:'🌿', cat:'seed',   price:300, sell:10},
  furniture1: {name:'나무의자',   emoji:'🪑', cat:'furniture', price:800, sell:400},
  furniture2: {name:'꽃화분',     emoji:'🪴', cat:'furniture', price:600, sell:300},
  furniture3: {name:'낚시의자',   emoji:'⛺', cat:'furniture', price:1200,sell:600},
  medicine:   {name:'약',         emoji:'💊', cat:'tool',   price:400, sell:0},
  shovel_item:{name:'삽',         emoji:'⛏️', cat:'tool',  price:2500, sell:0},
  axe_item:   {name:'도끼',       emoji:'🪓', cat:'tool',   price:2500, sell:0},
  rod_item:   {name:'낚싯대',     emoji:'🎣', cat:'tool',   price:2500, sell:0},
  net_item:   {name:'채충망',     emoji:'🦋', cat:'tool',   price:2500, sell:0},
};

export const FISH_POOL   = Object.keys(ITEMS).filter(k=>ITEMS[k].cat==='fish');
export const BUG_POOL    = Object.keys(ITEMS).filter(k=>ITEMS[k].cat==='bug');
export const FOSSIL_POOL = Object.keys(ITEMS).filter(k=>ITEMS[k].cat==='fossil');
export const FRUIT_POOL  = ['apple','pear','orange','cherry'];

// ─── 주민 데이터 ────────────────────────────────────────────
export const VILLAGERS = [
  {id:'lily',  name:'릴리',  type:'frog',   emoji:'🐸', color:0x7ec880,
   dialogues:['냠냠! 오늘은 뭘 먹을까요?','개구리도 꿈을 꾼답니다!','리빗~ 오늘도 좋은 날이에요!'],
   pos:[20,14]},
  {id:'teddy', name:'테디',  type:'bear',   emoji:'🐻', color:0xa08060,
   dialogues:['으르렁! 운동은 했나요?','꿀은 역시 달콤하죠~','나랑 산책할래요?'],
   pos:[28,14]},
  {id:'fluff', name:'플러프', type:'bunny', emoji:'🐰', color:0xf0d0d0,
   dialogues:['당근 드실래요?','폴짝폴짝~ 기분이 최고예요!','오늘 날씨 참 좋네요!'],
   pos:[24,10]},
];

// ─── 섬 마일 업적 ────────────────────────────────────────
export const MILE_ACHIEVEMENTS = [
  {id:'first_catch',  name:'첫 번째 낚시!',  emoji:'🎣', miles:500,  done:false},
  {id:'first_bug',    name:'첫 번째 채집!',  emoji:'🦋', miles:300,  done:false},
  {id:'first_sell',   name:'첫 번째 판매!',  emoji:'💰', miles:200,  done:false},
  {id:'first_fossil', name:'첫 번째 화석!',  emoji:'💀', miles:400,  done:false},
  {id:'donate_fish',  name:'물고기 기증!',   emoji:'🐟', miles:500,  done:false},
  {id:'donate_bug',   name:'벌레 기증!',     emoji:'🦋', miles:500,  done:false},
  {id:'donate_fossil',name:'화석 기증!',     emoji:'🦕', miles:500,  done:false},
  {id:'bells_10k',    name:'종 10000개!',    emoji:'🔔', miles:800,  done:false},
  {id:'talk_all',     name:'주민 모두 대화!', emoji:'🗣️',miles:300, done:false},
  {id:'water_flower', name:'꽃에 물주기!',   emoji:'🌸', miles:200,  done:false},
];

// ─── 상점 카탈로그 ──────────────────────────────────────────
export const SHOP_CATALOG = [
  {id:'seed_flower',qty:5},{id:'seed_tree',qty:3},{id:'medicine',qty:3},
  {id:'furniture1',qty:1},{id:'furniture2',qty:1},{id:'furniture3',qty:1},
  {id:'shovel_item',qty:1},{id:'axe_item',qty:1},{id:'rod_item',qty:1},{id:'net_item',qty:1},
];

// ─── 타일 색상 ──────────────────────────────────────────────
export const TILE_COLORS = {
  [T.OCEAN]:  0x4a9ece,
  [T.BEACH]:  0xdec888,
  [T.GRASS]:  0x68b84a,
  [T.CLIFF]:  0x52963a,
  [T.RIVER]:  0x4a9ece,
  [T.PATH]:   0xc8b880,
  [T.BRIDGE]: 0xa08050,
  [T.FLOWER]: 0x72bb53,
  [T.TREE]:   0x72bb53,
  [T.ROCK]:   0x72bb53,
  [T.WATERFALL]:0x5aaedc,
  [T.DIG_SPOT]: 0x72bb53,
  [T.SHOP]:   0x72bb53,
  [T.MUSEUM]: 0x72bb53,
  [T.NOOK_HQ]:0x72bb53,
  [T.PLAYER_HOUSE]:0x72bb53,
  [T.VILLAGER_HOUSE]:0x72bb53,
};

export const TILE_HEIGHT = {
  [T.OCEAN]:-0.3, [T.BEACH]:0.02, [T.GRASS]:0.08,
  [T.CLIFF]:0.8, [T.PATH]:0.10, [T.BRIDGE]:0.10,
  [T.RIVER]:-0.1, [T.WATERFALL]:0.4, [T.FLOWER]:0.08,
  [T.TREE]:0.08, [T.ROCK]:0.08, [T.DIG_SPOT]:0.08,
  [T.SHOP]:0.08, [T.MUSEUM]:0.08, [T.NOOK_HQ]:0.08,
  [T.PLAYER_HOUSE]:0.08, [T.VILLAGER_HOUSE]:0.08,
};

// ─── 이동/상호작용 가능 타일 ───────────────────────────────
// 건물 타일은 WALKABLE에서 제외 — 플레이어가 건물 메시를 통과하지 않도록
export const WALKABLE = new Set([T.GRASS,T.PATH,T.FLOWER,T.BRIDGE,T.CLIFF,T.BEACH,
  T.DIG_SPOT,T.WATERFALL]);
export const INTERACTABLE = new Set([T.TREE,T.ROCK,T.SHOP,T.MUSEUM,T.NOOK_HQ,
  T.PLAYER_HOUSE,T.VILLAGER_HOUSE,T.FLOWER,T.DIG_SPOT]);

// ─── 주민 AI 시나리오 ───────────────────────────────────────
// [조건함수, 대화 생성함수]
export const NPC_SCENARIOS = [
  // 새벽/이른 아침
  { cond:(st,hour)=>hour>=6&&hour<9,
    gen:(vi,st)=>`${vi.name}: 아침이다~ 오늘도 좋은 하루 될 것 같아!` },
  // 점심
  { cond:(st,hour)=>hour>=12&&hour<14,
    gen:(vi,st)=>`${vi.name}: 배고프다... 점심 뭐 먹지?` },
  // 저녁
  { cond:(st,hour)=>hour>=18&&hour<21,
    gen:(vi,st)=>`${vi.name}: 노을이 예쁘다~ 오늘 하루도 수고했어!` },
  // 플레이어랑 친해졌을 때
  { cond:(st,hour)=>st.friendship>=3,
    gen:(vi,st)=>{
      const extras=['또 왔구나! 보고 싶었어~','오늘 뭐 하고 있었어? 나도 같이 하고 싶어!','혹시 낚시 잘 해? 나 배우고 싶어!'];
      return `${vi.name}: ${extras[st.friendship%extras.length]}`;
    }},
  // 학습한 문구 재사용
  { cond:(st,hour)=>st.memory.learnedPhrases.length>0&&Math.random()<0.4,
    gen:(vi,st)=>{
      const phrase=st.memory.learnedPhrases[Math.floor(Math.random()*st.memory.learnedPhrases.length)];
      return `${vi.name}: (${phrase}라고 하던데...) 맞나?`;
    }},
  // 에너지 높으면 운동
  { cond:(st,hour)=>st.personality.energy>0.7,
    gen:(vi,st)=>`${vi.name}: 운동하러 갈래? 몸을 움직여야 기분이 좋아지거든!` },
  // 소심하면 혼잣말
  { cond:(st,hour)=>st.personality.social<0.3,
    gen:(vi,st)=>`${vi.name}: (혼자 중얼중얼) ...오늘도 조용하네.` },
  // 기본 대화
  { cond:()=>true,
    gen:(vi,st)=>{
      const d=vi.dialogues;
      return `${vi.name}: ${d[Math.floor(Math.random()*d.length)]}`;
    }},
];
