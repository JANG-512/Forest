class IntentClassifier:
    @staticmethod
    def classify(message: str) -> str:
        msg = message.strip().lower()
        if not msg:
            return "unknown"

        # Order of keywords to avoid overlaps
        if any(kw in msg for kw in ["이름", "누구", "name"]):
            return "ask_name"
        
        if any(kw in msg for kw in ["기분", "어때", "괜찮아"]):
            return "ask_emotion"
            
        if any(kw in msg for kw in ["뭐 좋아", "좋아하는", "취미"]):
            return "ask_like"

        if any(kw in msg for kw in ["뭐 싫어", "싫어하는"]):
            return "ask_dislike"

        if any(kw in msg for kw in ["안녕", "하이", "반가워", "hello", "hi"]):
            return "greeting"

        if any(kw in msg for kw in ["고마워", "멋져", "귀여워", "잘했어", "사랑해", "예쁘", "착해"]):
            return "compliment"

        if any(kw in msg for kw in ["바보", "멍청", "짜증나", "너 싫어", "메롱", "미워"]):
            return "insult"

        if any(kw in msg for kw in ["선물", "받아", "줄게", "이거 줘"]):
            return "give_gift"

        if any(kw in msg for kw in ["기억", "전에", "어제", "생각나"]):
            return "ask_memory"

        if any(kw in msg for kw in ["잘 가", "잘가", "나중에", "또 봐", "또봐", "bye"]):
            return "goodbye"

        return "smalltalk"
