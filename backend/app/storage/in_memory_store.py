from typing import Dict, List, Tuple
from app.data.npc_seed import NPC_SEEDS

class InMemoryStore:
    def __init__(self):
        self.relationships: Dict[Tuple[str, str], dict] = {}
        self.npc_states: Dict[str, dict] = {}
        self.memories: Dict[Tuple[str, str], List[dict]] = {}
        self.initialize_store()

    def initialize_store(self):
        self.relationships.clear()
        self.npc_states.clear()
        self.memories.clear()
        # Initialize NPC state from seed data
        for npc_id, data in NPC_SEEDS.items():
            self.npc_states[npc_id] = dict(data["initial_emotion_state"])

    def get_relationship(self, player_id: str, npc_id: str) -> dict:
        key = (player_id, npc_id)
        if key not in self.relationships:
            self.relationships[key] = {
                "friendship": 0,
                "trust": 0,
                "affection": 0,
                "conflict": 0,
                "familiarity": 0
            }
        return self.relationships[key]

    def update_relationship(self, player_id: str, npc_id: str, updates: dict):
        rel = self.get_relationship(player_id, npc_id)
        for k, v in updates.items():
            if k in rel:
                if k == "familiarity":
                    rel[k] += v
                else:
                    rel[k] = max(0, min(100, rel[k] + v))
        self.relationships[(player_id, npc_id)] = rel

    def get_npc_state(self, npc_id: str) -> dict:
        if npc_id not in self.npc_states:
            if npc_id in NPC_SEEDS:
                self.npc_states[npc_id] = dict(NPC_SEEDS[npc_id]["initial_emotion_state"])
            else:
                self.npc_states[npc_id] = {
                    "happiness": 50,
                    "sadness": 0,
                    "anger": 0,
                    "stress": 0,
                    "loneliness": 0,
                    "excitement": 0
                }
        return self.npc_states[npc_id]

    def update_npc_state(self, npc_id: str, updates: dict):
        state = self.get_npc_state(npc_id)
        for k, v in updates.items():
            if k in state:
                state[k] = max(0, min(100, state[k] + v))
        self.npc_states[npc_id] = state

    def get_memories(self, player_id: str, npc_id: str) -> List[dict]:
        key = (player_id, npc_id)
        if key not in self.memories:
            self.memories[key] = []
        return self.memories[key]

    def add_memory(self, player_id: str, npc_id: str, memory_type: str, content: str, importance: int):
        key = (player_id, npc_id)
        if key not in self.memories:
            self.memories[key] = []
        self.memories[key].append({
            "player_id": player_id,
            "npc_id": npc_id,
            "memory_type": memory_type,
            "content": content,
            "importance": importance
        })

    def reset(self):
        self.initialize_store()

# Singleton instance
store = InMemoryStore()
