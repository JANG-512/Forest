from pydantic import BaseModel, Field
from typing import Dict, List, Optional

class TalkRequest(BaseModel):
    player_id: str = Field(..., description="ID of the player")
    npc_id: str = Field(..., description="ID of the NPC")
    message: str = Field(..., description="Message sent by the player")

class RelationshipChange(BaseModel):
    friendship: int = 0
    trust: int = 0
    affection: int = 0
    conflict: int = 0

class NpcState(BaseModel):
    happiness: int
    sadness: int
    anger: int
    stress: int
    loneliness: int
    excitement: int

class TalkResponse(BaseModel):
    npc_id: str
    reply: str
    intent: str
    emotion: str
    relationship_change: RelationshipChange
    memory_created: bool
    npc_state: NpcState

class NpcListItem(BaseModel):
    id: str
    name: str
    emotion: str

class RelationshipState(BaseModel):
    friendship: int
    trust: int
    affection: int
    conflict: int
    familiarity: int

class MemoryItem(BaseModel):
    player_id: str
    npc_id: str
    memory_type: str
    content: str
    importance: int

class NpcStateViewResponse(BaseModel):
    npc_id: str
    relationship: RelationshipState
    npc_state: NpcState
    recent_memories: List[MemoryItem]
