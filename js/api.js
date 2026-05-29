// ═══════════════════════════════════════════════════════════════
// api.js — 백엔드 API 클라이언트 & 로컬 에뮬레이터
// ═══════════════════════════════════════════════════════════════
import { VILLAGERS } from './config.js?v=20260529-visual-v21';

export const NPC_PROFILES = {
  lily: {
    name: "릴리",
    desc: "연못을 좋아하는 상냥하고 다정다감한 아기 개구리",
    emojis: { neutral: "🐸", happy: "🐸✨", sad: "🐸💦", angry: "🐸💢", shy: "🐸 blush", excited: "🐸🔥", stressed: "🐸💦", lonely: "🐸🍃", comfortable: "🐸☕" }
  },
  teddy: {
    name: "테디",
    desc: "운동과 꿀을 좋아하는 우직하고 든든한 곰 아저씨",
    emojis: { neutral: "🐻", happy: "🐻✨", sad: "🐻💧", angry: "🐻💢", shy: "🐻 blush", excited: "🐻🔥", stressed: "🐻💦", lonely: "🐻🍃", comfortable: "🐻☕" }
  },
  fluff: {
    name: "플러프",
    desc: "당근과 당근 케이크를 좋아하는 사교적인 명랑 토끼",
    emojis: { neutral: "🐰", happy: "🐰✨", sad: "🐰💧", angry: "🐰💢", shy: "🐰 blush", excited: "🐰🔥", stressed: "🐰💦", lonely: "🐰🍃", comfortable: "🐰☕" }
  }
};

export class ApiClient {
  static isLocalMode = true;
  static serverUrl = "http://localhost:8000";

  // exponential backoff 구현한 API 호출 메서드
  static async talkToNpc(playerId, npcId, message, context = {}) {
    if (this.isLocalMode) {
      return await this.simulateLocalResponse(npcId, message, context);
    }

    const url = `${this.serverUrl}/api/npc-ai/talk`;
    const body = JSON.stringify({ player_id: playerId, npc_id: npcId, message: message, context });
    
    try {
      return await this.fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body
      });
    } catch (error) {
      console.warn(`[Network Error] API 서버에 도달하지 못했습니다. Fallback 대사로 대응합니다.`, error);
      if (window.notify) {
        window.notify(`⚠️ 서버 통신 실패 (시뮬레이터 전환 또는 서버 점검 필요)`);
      }
      return this.getFallbackResponse(npcId, context);
    }
  }

  // 기하급수적 백오프 정책 (5회 재시도)
  static async fetchWithRetry(url, options, retries = 5, delay = 1000) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP 에러 발생 (코드: ${response.status})`);
      }
      return await response.json();
    } catch (error) {
      if (retries > 0) {
        console.log(`[API Retry] ${delay}ms 후 서버 재시도 예정... 남은 횟수: ${retries}회`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, options, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  // 로컬 감정 시뮬레이터 (백엔드 AI 작동 방식을 에뮬레이트하여 오프라인 상태 지원)
  static async simulateLocalResponse(npcId, message, context = {}) {
    await new Promise(resolve => setTimeout(resolve, 450)); // 연산 딜레이 모방
    
    const profile = NPC_PROFILES[npcId] || {};
    const npcName = profile.name || "주민";
    const intent = context.intent || inferIntent(message);
    const friendshipLevel = context.friendshipLevel || 0;
    const memory = context.memory || {};
    const recent = memory.lastTopic ? ` 지난번엔 ${memory.lastTopic} 얘기를 했었지.` : '';
    const weatherTone = context.hour >= 18 ? '저녁 공기가 부드러워서' : '햇살이 좋아서';
    let emotion = context.emotion || "comfortable";
    let friendship = 1, trust = 0, affection = 0, conflict = 0;
    let reply;

    const nameTail = npcName === '테디' ? '라고' : '라고';
    if(intent === 'greet'){
      emotion = friendshipLevel > 4 ? 'happy' : 'comfortable';
      trust = 1;
      reply = friendshipLevel > 4
        ? `또 만나서 좋다! ${weatherTone} 오늘은 네가 올 것 같았어.${recent}`
        : `안녕, ${npcName}${nameTail} 해. 오늘 섬을 천천히 둘러보는 중이야.`;
    } else if(intent === 'mood'){
      emotion = context.needs?.social > 65 ? 'excited' : 'happy';
      friendship = 2; trust = 1;
      reply = `기분은 꽤 좋아. ${weatherTone} 마음이 가벼워졌거든. 네가 말 걸어주니까 더 좋아졌어.`;
    } else if(intent === 'island_news'){
      emotion = 'comfortable';
      trust = 2;
      const topic = memory.heardTopic || context.favoritePlace || '강가';
      reply = `오늘은 ${topic} 쪽이 유난히 조용했어. 나중에 다 같이 앉을 수 있는 작은 벤치가 있으면 좋겠더라.`;
    } else if(intent === 'help'){
      emotion = 'excited';
      friendship = 2; trust = 1;
      reply = `도와줄 마음이 있다니 든든하다. 꽃밭 근처 잡초를 조금 정리하거나, 물가에 예쁜 조개를 놓으면 섬 분위기가 훨씬 살아날 거야.`;
    } else if(intent === 'compliment'){
      emotion = 'shy';
      friendship = 2; affection = 2;
      reply = `그렇게 말해주면 조금 부끄럽잖아. 그래도 고마워. 오늘 하루 오래 기억할 것 같아.`;
    } else if(intent === 'bye'){
      emotion = 'comfortable';
      reply = `응, 또 보자. 다음에 만나면 내가 먼저 인사할게.`;
    } else if(message.includes("바보") || message.includes("메롱")) {
      emotion = "angry";
      conflict = 2; friendship = -1;
      reply = `그 말은 조금 속상해. 장난이어도 다정하게 말해주면 좋겠어.`;
    } else {
      reply = `"${message}"라니 흥미로운데. 네가 보는 섬은 나랑 조금 다를지도 모르겠다. 더 들려줘.`;
      emotion = "neutral";
    }

    return {
      npc_id: npcId,
      reply: reply,
      intent,
      emotion: emotion,
      relationship_change: { friendship, trust, affection, conflict },
      memory_created: intent !== 'bye',
      memory_text: intent !== 'bye' ? `${message}` : '',
      npc_state: {
        happiness: emotion === "happy" || emotion === "excited" ? 82 : Math.floor(Math.random() * 24) + 55,
        sadness: emotion === "sad" ? 45 : Math.floor(Math.random() * 18),
        anger: emotion === "angry" ? 50 : Math.floor(Math.random() * 10),
        stress: emotion === "comfortable" ? 12 : Math.floor(Math.random() * 26) + 8,
        loneliness: Math.max(0, 35 - friendshipLevel * 3),
        excitement: emotion === "excited" ? 80 : Math.floor(Math.random() * 40) + 10
      }
    };
  }

  // 서버 연결 및 Fallback 발생 시 제공될 최후의 보루 대사
  static getFallbackResponse(npcId, context = {}) {
    const fallbacks = {
      lily: "어라? 웅덩이에 물이 고여서 소리가 잘 안 들려요. 개골...",
      teddy: "으르렁... 노안이 왔나 귀가 잘 안 들리는구먼. 나중에 얘기하자고!",
      fluff: "어머, 나 지금 당근 갉아먹느라 귀를 닫았나 봐! 나중에 만나!"
    };

    return {
      npc_id: npcId,
      reply: fallbacks[npcId] || "...",
      intent: context.intent || "fallback_recovery",
      emotion: "neutral",
      relationship_change: { friendship: 0, trust: 0, affection: 0, conflict: 0 },
      memory_created: false,
      npc_state: { happiness: 40, sadness: 20, anger: 10, stress: 50, loneliness: 60, excitement: 10 }
    };
  }
}

function inferIntent(message){
  if(message.includes('안녕')||message.includes('반가')) return 'greet';
  if(message.includes('기분')||message.includes('어때')) return 'mood';
  if(message.includes('소식')||message.includes('무슨 일')) return 'island_news';
  if(message.includes('도와')||message.includes('할 일')) return 'help';
  if(message.includes('좋아')||message.includes('멋져')||message.includes('고마워')) return 'compliment';
  return 'free_talk';
}
