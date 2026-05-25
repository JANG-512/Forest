class RelationshipEngine:
    RULES = {
        "greeting": {"friendship": 1, "trust": 0, "affection": 0, "conflict": 0},
        "ask_name": {"friendship": 0, "trust": 0, "affection": 0, "conflict": 0},
        "ask_emotion": {"friendship": 1, "trust": 1, "affection": 0, "conflict": 0},
        "ask_like": {"friendship": 1, "trust": 0, "affection": 0, "conflict": 0},
        "ask_dislike": {"friendship": 1, "trust": 0, "affection": 0, "conflict": 0},
        "compliment": {"friendship": 2, "trust": 1, "affection": 1, "conflict": 0},
        "insult": {"friendship": -2, "trust": -2, "affection": 0, "conflict": 3},
        "give_gift": {"friendship": 4, "trust": 1, "affection": 2, "conflict": 0},
        "ask_memory": {"friendship": 1, "trust": 1, "affection": 0, "conflict": 0},
        "goodbye": {"friendship": 0, "trust": 0, "affection": 0, "conflict": 0},
        "smalltalk": {"friendship": 1, "trust": 0, "affection": 0, "conflict": 0},
        "unknown": {"friendship": 0, "trust": 0, "affection": 0, "conflict": 0}
    }

    @classmethod
    def calculate_change(cls, intent: str) -> dict:
        return cls.RULES.get(intent, {"friendship": 0, "trust": 0, "affection": 0, "conflict": 0})
