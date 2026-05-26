import sys
import os
import json
from time import time
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List

# Ensure backend directory is in python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.schemas.npc_ai import TalkRequest, TalkResponse, NpcListItem, NpcStateViewResponse
from app.services.npc_ai.npc_ai_service import NpcAiService
from app.storage.in_memory_store import store
from app.data.npc_seed import NPC_SEEDS
from app.services.npc_ai.emotion_engine import EmotionEngine

app = FastAPI(title="Cozy Web 3D Sandbox Game - NPC AI Server")

def configured_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS", "").strip()
    if raw:
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return [
        "https://jang-512.github.io",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "null",
    ]


origins = configured_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def get_root():
    return {
        "status": "ok",
        "service": "poko-multiplayer-backend",
        "health": "/api/health",
        "rooms": "/api/multiplayer/rooms",
        "websocket": "/ws/multiplayer/{room_id}",
    }


@app.get("/api/health")
def get_health():
    return {
        "status": "ok",
        "service": "poko-multiplayer-backend",
        "multiplayer_rooms": len(mp_rooms),
    }


mp_rooms: Dict[str, Dict[str, WebSocket]] = {}
mp_profiles: Dict[str, Dict[str, dict]] = {}


async def mp_broadcast(room_id: str, payload: dict, exclude: str | None = None):
    dead = []
    for player_id, ws in list(mp_rooms.get(room_id, {}).items()):
        if player_id == exclude:
            continue
        try:
            await ws.send_json(payload)
        except Exception:
            dead.append(player_id)
    for player_id in dead:
        mp_rooms.get(room_id, {}).pop(player_id, None)
        mp_profiles.get(room_id, {}).pop(player_id, None)


def mp_roster(room_id: str):
    return [
        {"id": pid, "name": profile.get("name", "player"), "host": profile.get("host", False)}
        for pid, profile in mp_profiles.get(room_id, {}).items()
    ]


@app.get("/api/multiplayer/rooms")
def get_multiplayer_rooms():
    return {
        "rooms": [
            {"room": room_id, "players": len(players), "roster": mp_roster(room_id)}
            for room_id, players in mp_rooms.items()
        ]
    }


@app.websocket("/ws/multiplayer/{room_id}")
async def multiplayer_socket(room_id: str, websocket: WebSocket):
    await websocket.accept()
    player_id = websocket.query_params.get("player_id") or f"player-{int(time()*1000)}"
    name = websocket.query_params.get("name") or "player"
    mp_rooms.setdefault(room_id, {})[player_id] = websocket
    mp_profiles.setdefault(room_id, {})[player_id] = {"name": name, "host": False, "joined_at": time()}

    await websocket.send_json({"type": "welcome", "id": player_id, "room": room_id, "roster": mp_roster(room_id)})
    await mp_broadcast(room_id, {"type": "peer_joined", "id": player_id, "name": name}, exclude=player_id)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if not isinstance(data, dict):
                continue
            if data.get("type") == "hello":
                mp_profiles[room_id][player_id]["name"] = data.get("name") or name
                mp_profiles[room_id][player_id]["host"] = bool(data.get("host"))
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong", "from": "server", "id": "server", "t": data.get("t")})
                continue
            data["from"] = player_id
            data["name"] = mp_profiles[room_id][player_id]["name"]
            await mp_broadcast(room_id, data, exclude=player_id)
    except WebSocketDisconnect:
        pass
    finally:
        mp_rooms.get(room_id, {}).pop(player_id, None)
        mp_profiles.get(room_id, {}).pop(player_id, None)
        await mp_broadcast(room_id, {"type": "peer_left", "id": player_id}, exclude=None)
        if not mp_rooms.get(room_id):
            mp_rooms.pop(room_id, None)
            mp_profiles.pop(room_id, None)

@app.post("/api/npc-ai/talk", response_model=TalkResponse)
def talk_to_npc(request: TalkRequest):
    return NpcAiService.process_talk(
        player_id=request.player_id,
        npc_id=request.npc_id,
        message=request.message
    )

@app.get("/api/npcs", response_model=List[NpcListItem])
def get_npcs():
    npc_list = []
    for npc_id, npc_data in NPC_SEEDS.items():
        state = store.get_npc_state(npc_id)
        dummy_rel = {"friendship": 0, "trust": 0}
        emotion = EmotionEngine.determine_final_emotion(state, npc_data["personality"], dummy_rel)
        npc_list.append({
            "id": npc_id,
            "name": npc_data["name"],
            "emotion": emotion
        })
    return npc_list

@app.get("/api/npc-ai/state/{player_id}/{npc_id}", response_model=NpcStateViewResponse)
def get_npc_state_view(player_id: str, npc_id: str):
    if npc_id not in NPC_SEEDS:
        raise HTTPException(status_code=404, detail="NPC not found")
        
    rel = store.get_relationship(player_id, npc_id)
    state = store.get_npc_state(npc_id)
    memories = store.get_memories(player_id, npc_id)
    
    # Send last 5 memories
    recent_memories = memories[-5:] if memories else []
    
    return {
        "npc_id": npc_id,
        "relationship": rel,
        "npc_state": state,
        "recent_memories": recent_memories
    }

@app.post("/api/dev/reset")
def dev_reset():
    store.reset()
    return {"status": "reset"}
