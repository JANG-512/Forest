from fastapi import HTTPException
from app.data.npc_seed import NPC_SEEDS
from app.storage.in_memory_store import store
from app.services.npc_ai.intent_classifier import IntentClassifier
from app.services.npc_ai.relationship_engine import RelationshipEngine
from app.services.npc_ai.emotion_engine import EmotionEngine
from app.services.npc_ai.memory_engine import MemoryEngine
from app.services.npc_ai.dialogue_engine import DialogueEngine

class NpcAiService:
    @staticmethod
    def process_talk(player_id: str, npc_id: str, message: str) -> dict:
        # Validation
        if npc_id not in NPC_SEEDS:
            raise HTTPException(status_code=404, detail=f"NPC {npc_id} not found")
        if not message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        npc_data = NPC_SEEDS[npc_id]
        
        # Get current state
        rel = store.get_relationship(player_id, npc_id)
        state = store.get_npc_state(npc_id)

        # Classify intent
        intent = IntentClassifier.classify(message)

        # Calculate delta changes
        rel_change = RelationshipEngine.calculate_change(intent)
        emotion_change = EmotionEngine.calculate_change(intent)

        # Update in-memory database
        store.update_relationship(player_id, npc_id, rel_change)
        store.update_relationship(player_id, npc_id, {"familiarity": 1})  # Increase familiarity by 1 on chat
        store.update_npc_state(npc_id, emotion_change)

        # Retrieve updated state
        updated_rel = store.get_relationship(player_id, npc_id)
        updated_state = store.get_npc_state(npc_id)

        # Determine final emotion keyword
        final_emotion = EmotionEngine.determine_final_emotion(updated_state, npc_data["personality"], updated_rel)

        # Evaluate memory creation
        memory_created = False
        new_memory = MemoryEngine.evaluate_and_create_memory(player_id, npc_id, message, intent)
        if new_memory:
            store.add_memory(
                player_id=new_memory["player_id"],
                npc_id=new_memory["npc_id"],
                memory_type=new_memory["memory_type"],
                content=new_memory["content"],
                importance=new_memory["importance"]
            )
            memory_created = True

        # Fetch recent memory if player asks about past interaction
        recent_memory = None
        if intent == "ask_memory":
            memories = store.get_memories(player_id, npc_id)
            if memories:
                # Pass the latest memory to the dialogue generator
                recent_memory = memories[-1]

        # Generate response using NPC styling and dynamic parameters
        reply = DialogueEngine.generate_reply(
            npc_data=npc_data,
            relation_state=updated_rel,
            current_emotion=final_emotion,
            intent=intent,
            recent_memory=recent_memory
        )

        return {
            "npc_id": npc_id,
            "reply": reply,
            "intent": intent,
            "emotion": final_emotion,
            "relationship_change": rel_change,
            "memory_created": memory_created,
            "npc_state": updated_state
        }
