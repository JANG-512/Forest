# 🏡 Cozy Web 3D Sandbox Game - NPC AI Backend Server

이 서버는 자체 규칙 기반, 감정 수치 기반, 그리고 기억 기반으로 동작하는 주민 NPC AI 기능을 제공하는 FastAPI 백엔드 서버입니다.
Unity나 외부 LLM (OpenAI, Gemini 등) API를 전혀 사용하지 않고 동작합니다.

## 기술 스택
- **Python 3**
- **FastAPI** (웹 프레임워크)
- **Uvicorn** (ASGI 웹 서버)
- **Pydantic** (데이터 모델링 및 검증)
- **In-Memory Store** (초기 세션 데이터 저장소)

## API 엔드포인트 목록

1. **GET `/api/health`**
   - 서버의 헬스체크 및 동작 상태를 점검합니다.
   - 응답: `{"status": "ok"}`

2. **POST `/api/npc-ai/talk`**
   - 플레이어와의 대화를 분석하여 감정, 관계도, 기억 변화를 처리하고 알맞은 대화를 템플릿 기반으로 렌더링하여 반환합니다.
   - **요청 Body 예시**:
     ```json
     {
       "player_id": "player_001",
       "npc_id": "npc_milo",
       "message": "오늘 기분 어때?"
     }
     ```
   - **응답 Body 예시**:
     ```json
     {
       "npc_id": "npc_milo",
       "reply": "오늘은 조금 기분이 좋아요. 마을 공기가 유난히 산뜻하거든요.",
       "intent": "ask_emotion",
       "emotion": "happy",
       "relationship_change": {
         "friendship": 1,
         "trust": 1,
         "affection": 0,
         "conflict": 0
       },
       "memory_created": false,
       "npc_state": {
         "happiness": 56,
         "sadness": 5,
         "anger": 0,
         "stress": 10,
         "loneliness": 24,
         "excitement": 20
       }
     }
     ```

3. **GET `/api/npcs`**
   - 현재 존재하는 모든 NPC 목록과 그들의 실시간 감정 상태를 조회합니다.

4. **GET `/api/npc-ai/state/{player_id}/{npc_id}`**
   - 특정 플레이어와 NPC 간의 세부 관계도 수치, 감정 지표, 최근 기억 데이터를 조회합니다.

5. **POST `/api/dev/reset`**
   - 개발 및 테스트 편의를 위해 관계도, 감정 수치, 대화 기억 등 인메모리에 저장된 모든 데이터를 초기화합니다.

6. **WebSocket `/ws/multiplayer/{room_id}`**
   - GitHub Pages 같은 정적 호스팅 프론트엔드에서 접속할 수 있는 실시간 멀티플레이 릴레이입니다.
   - 접속 예시:
     ```
     wss://your-backend.example.com/ws/multiplayer/AB12CD?player_id=p1&name=Player
     ```
   - 클라이언트는 `hello`, `world_request`, `world`, `pos`, `chat`, `ping`, `pong` 메시지를 JSON으로 주고받습니다.
   - 서버는 접속자에게 `welcome`을 보내고, 같은 방의 다른 플레이어에게 `peer_joined`, `peer_left` 및 클라이언트 메시지를 브로드캐스트합니다.

## 실행 방법

### 백엔드 서버 실행
1. `backend` 폴더로 이동합니다.
2. 가상 환경을 생성하고 활성화합니다.
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
3. 필수 의존성 패키지를 설치합니다.
   ```bash
   pip install -r requirements.txt
   ```
4. Uvicorn 서버를 실행합니다.
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
5. 브라우저에서 `http://localhost:8000/api/health`에 접속하여 상태를 확인합니다.

### 프론트엔드 연동 실행
프로젝트 루트 폴더로 돌아가 간단한 로컬 웹 서버로 HTML 파일을 실행합니다.
```bash
python3 -m http.server 5173
```
이후 브라우저에서 `http://localhost:5173/dong.html`에 접속하여 실행할 수 있습니다.
접속 후 우측 상단의 **[실제 서버로 연동]** 버튼을 클릭하여 `http://localhost:8000` 주소를 사용하는 실제 API 서버 모드로 테스트를 진행해 주세요.

## GitHub Pages + Render 멀티플레이 배포

GitHub Pages는 정적 파일만 호스팅하므로 WebSocket 서버를 같이 띄울 수 없습니다. 이 `backend`를 Render Web Service로 배포하고, GitHub Pages 프론트엔드는 Render의 `wss://` 주소에 연결합니다.

- 로컬 테스트 주소: `ws://localhost:8000`
- Render 기본 배포 주소: `wss://poko-multiplayer-backend.onrender.com`
- Render Blueprint 설정: repository root의 `render.yaml`
- 상세 배포 가이드: [`backend/RENDER_DEPLOY.md`](./RENDER_DEPLOY.md)

배포 후 호스트는 멀티플레이 패널에서 **서버 방 열기**를 누른 뒤 섬 코드를 공유합니다. 방문자는 서버 URL을 따로 입력하지 않고 친구의 섬 코드만 입력하면 됩니다.
