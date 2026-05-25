class MemoryEngine:
    @staticmethod
    def evaluate_and_create_memory(player_id: str, npc_id: str, message: str, intent: str) -> dict:
        """
        Evaluates dialogue elements to generate conversational memory if triggers match.
        Returns the memory dictionary if created, else None.
        """
        # 1. '좋아해' included in message
        if "좋아해" in message:
            return {
                "player_id": player_id,
                "npc_id": npc_id,
                "memory_type": "player_preference",
                "content": "나를 좋아한다고 수줍게 고백해 주었다.",
                "importance": 3
            }
        # 2. compliment intent
        elif intent == "compliment":
            return {
                "player_id": player_id,
                "npc_id": npc_id,
                "memory_type": "compliment",
                "content": "따뜻하고 상냥한 칭찬을 건네주었다.",
                "importance": 2
            }
        # 3. insult intent
        elif intent == "insult":
            return {
                "player_id": player_id,
                "npc_id": npc_id,
                "memory_type": "conflict",
                "content": "험한 말로 나에게 큰 상처를 주었다.",
                "importance": 3
            }
        # 4. give_gift intent
        elif intent == "give_gift":
            return {
                "player_id": player_id,
                "npc_id": npc_id,
                "memory_type": "gift",
                "content": "소중한 마음이 담긴 선물을 챙겨주었다.",
                "importance": 2
            }
            
        return None
