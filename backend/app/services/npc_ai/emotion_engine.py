class EmotionEngine:
    RULES = {
        "greeting": {"happiness": 1, "loneliness": -1},
        "compliment": {"happiness": 5, "sadness": -2, "excitement": 2},
        "insult": {"sadness": 4, "anger": 8, "happiness": -5, "stress": 4},
        "give_gift": {"happiness": 6, "excitement": 5},
        "ask_emotion": {"happiness": 1},
        "goodbye": {"loneliness": 1},
        "smalltalk": {"happiness": 1}
    }

    @classmethod
    def calculate_change(cls, intent: str) -> dict:
        change = cls.RULES.get(intent, {})
        full_change = {
            "happiness": 0,
            "sadness": 0,
            "anger": 0,
            "stress": 0,
            "loneliness": 0,
            "excitement": 0
        }
        for k, v in change.items():
            full_change[k] = v
        return full_change

    @classmethod
    def determine_final_emotion(cls, state: dict, personality: dict, relationship: dict) -> str:
        anger = state.get("anger", 0)
        sadness = state.get("sadness", 0)
        stress = state.get("stress", 0)
        loneliness = state.get("loneliness", 0)
        excitement = state.get("excitement", 0)
        happiness = state.get("happiness", 0)

        shyness = personality.get("shyness", 0)
        friendship = relationship.get("friendship", 0)
        trust = relationship.get("trust", 0)

        if anger >= 50:
            return "angry"
        if sadness >= 50:
            return "sad"
        if stress >= 60:
            return "stressed"
        if loneliness >= 60:
            return "lonely"
        if excitement >= 70:
            return "excited"
        if shyness >= 65 and friendship < 20:
            return "shy"
        if trust >= 50 and stress < 30:
            return "comfortable"
        if happiness >= 60:
            return "happy"
        return "neutral"
