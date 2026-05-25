// ═══════════════════════════════════════════════════════════════
// api.js — 백엔드 API 클라이언트 & 로컬 에뮬레이터
// ═══════════════════════════════════════════════════════════════
import { VILLAGERS } from './config.js';

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
  static async talkToNpc(playerId, npcId, message) {
    if (this.isLocalMode) {
      return await this.simulateLocalResponse(npcId, message);
    }

    const url = `${this.serverUrl}/api/npc-ai/talk`;
    const body = JSON.stringify({ player_id: playerId, npc_id: npcId, message: message });
    
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
      return this.getFallbackResponse(npcId);
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
  static async simulateLocalResponse(npcId, message) {
    await new Promise(resolve => setTimeout(resolve, 800)); // 연산 딜레이 모방
    
    const npcName = NPC_PROFILES[npcId]?.name || "주민";
    let emotion = "comfortable";
    let reply = "";
    let friendship = 0;
    let trust = 0;
    let affection = 0;
    let conflict = 0;

    // 키워드 분석을 통한 단순형 임시 AI 분석 (로컬 시뮬레이션용)
    if (message.includes("안녕") || message.includes("하이") || message.includes("반가워")) {
      reply = `안녕안녕! ${npcName}(이)야. 오늘도 섬 산책 중이야? 만나서 진짜 반가워!`;
      emotion = "happy";
      friendship = 1;
    } else if (message.includes("기분") || message.includes("어때")) {
      reply = `기분? 완전 끝내주지! 바람도 시원하고 모든 게 완벽해!`;
      emotion = "excited";
      friendship = 2;
      trust = 1;
    } else if (message.includes("슬퍼") || message.includes("우울")) {
      reply = `에구... 무슨 일 있어? 얘기해 봐, 들어줄게. 난 항상 네 편이야.`;
      emotion = "sad";
      friendship = 1;
      affection = 2;
    } else if (message.includes("화남") || message.includes("짜증") || message.includes("싫어")) {
      reply = `앗... 네 눈빛을 보니까 내가 다 긴장되는걸? 내게 서운한 점이 있는 거야?`;
      emotion = "shy";
      conflict = 1;
    } else if (message.includes("바보") || message.includes("메롱")) {
      reply = `쳇, 장난이 좀 심한걸? 그런 얄미운 말 하면 나 삐질 거야!`;
      emotion = "angry";
      conflict = 2;
      friendship = -1;
    } else if (message.includes("사랑") || message.includes("좋아")) {
      reply = `헉... 그렇게 훅 들어오면 나 너무 부끄럽단 말이야... 히히, 고마워!`;
      emotion = "shy";
      affection = 3;
      friendship = 2;
    } else {
      reply = `"${message}"라니, 역시 넌 되게 개성 있고 재미있는 이야기를 잘하는 것 같아.`;
      emotion = "neutral";
      friendship = 1;
    }

    return {
      npc_id: npcId,
      reply: reply,
      intent: "simulate_talk",
      emotion: emotion,
      relationship_change: { friendship, trust, affection, conflict },
      memory_created: Math.random() > 0.7,
      npc_state: {
        happiness: Math.floor(Math.random() * 40) + 60,
        sadness: Math.floor(Math.random() * 20),
        anger: emotion === "angry" ? 50 : Math.floor(Math.random() * 10),
        stress: Math.floor(Math.random() * 30) + 10,
        loneliness: Math.floor(Math.random() * 40),
        excitement: emotion === "excited" ? 80 : Math.floor(Math.random() * 40) + 10
      }
    };
  }

  // 서버 연결 및 Fallback 발생 시 제공될 최후의 보루 대사
  static getFallbackResponse(npcId) {
    const fallbacks = {
      lily: "어라? 웅덩이에 물이 고여서 소리가 잘 안 들려요. 개골...",
      teddy: "으르렁... 노안이 왔나 귀가 잘 안 들리는구먼. 나중에 얘기하자고!",
      fluff: "어머, 나 지금 당근 갉아먹느라 귀를 닫았나 봐! 나중에 만나!"
    };

    return {
      npc_id: npcId,
      reply: fallbacks[npcId] || "...",
      intent: "fallback_recovery",
      emotion: "neutral",
      relationship_change: { friendship: 0, trust: 0, affection: 0, conflict: 0 },
      memory_created: false,
      npc_state: { happiness: 40, sadness: 20, anger: 10, stress: 50, loneliness: 60, excitement: 10 }
    };
  }
}
