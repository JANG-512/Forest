import sys
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List

# Ensure backend directory is in python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.schemas.npc_ai import TalkRequest, TalkResponse, NpcListItem, NpcStateViewResponse
from app.services.npc_ai.npc_ai_service import NpcAiService
from app.storage.in_memory_store import store
from app.data.npc_seed import NPC_SEEDS
from app.services.npc_ai.emotion_engine import EmotionEngine

app = FastAPI(title="Cozy Web 3D Sandbox Game - NPC AI Server")

# CORS Configurations
# IMPORTANT: In production, remove "*" and "null" for security reasons.
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "null",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def get_health():
    return {"status": "ok"}

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
