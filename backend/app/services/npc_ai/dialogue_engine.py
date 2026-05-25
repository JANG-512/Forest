import random
from typing import Dict, List, Optional

class DialogueEngine:
    # Templates mapped by style: soft, playful, calm
    TEMPLATES = {
        "soft": {
            "greeting_stranger": [
                "안녕하세요. 저는 {npc_name}이에요. 새로 오신 분이죠?",
                "아, 처음 뵙는 것 같아요. 저는 {npc_name}이에요. 반가워요."
            ],
            "greeting_acquaintance": [
                "또 뵙네요. 오늘도 마을 산책 중이신가요?",
                "안녕하세요. 오늘은 어디 가시는 길이에요?"
            ],
            "greeting_friend": [
                "오셨네요. 오늘도 만나서 반가워요.",
                "기다리고 있었어요. 오늘은 어떤 하루를 보내고 계셨어요?"
            ],
            "ask_name": ["제 이름은 {npc_name}이에요. 기억해주시면 좋겠어요."],
            "ask_emotion_happy": ["오늘은 기분이 좋아요. 마을 공기가 유난히 산뜻하거든요."],
            "ask_emotion_shy": ["조금 부끄럽긴 하지만 괜찮아요. 이렇게 물어봐 주셔서요."],
            "ask_emotion_sad": ["조금 가라앉은 기분이에요. 그래도 말 걸어주셔서 나아졌어요."],
            "ask_emotion_angry": ["솔직히 지금은 별로 좋은 기분은 아니에요."],
            "ask_emotion_lonely": ["조금 외로웠어요. 그래도 지금 말을 걸어주셔서 괜찮아졌어요."],
            "ask_emotion_excited": ["우와! 심장이 두근거려요. 신나는 일이 생길 것 같아요!"],
            "ask_emotion_stressed": ["머리가 지끈거리고 피곤해요. 조금 조용한 시간이 필요해요."],
            "ask_emotion_comfortable": ["마음이 무척 평온해요. 이대로 시간이 멈췄으면 좋겠어요."],
            "ask_emotion_neutral": ["오늘은 그냥 평온한 하루예요."],
            "ask_like": ["저는 {like_item}을 좋아해요. 그걸 보면 하루가 조금 좋아지는 기분이에요."],
            "ask_dislike": ["저는 {dislike_item}은 조금 어려워요. 익숙해지기가 쉽지 않더라고요."],
            "compliment": [
                "그렇게 말해주시니 기분이 좋아졌어요. 고마워요.",
                "아... 그런 말은 조금 부끄럽지만 고마워요."
            ],
            "insult": ["그렇게 말하시면 조금 속상해요."],
            "give_gift": [
                "저에게 주시는 건가요? 정말 고마워요.",
                "선물이라니... 소중히 간직할게요."
            ],
            "ask_memory_exist": ["기억나요. 전에 {memory_content} 기억이 떠오르네요."],
            "ask_memory_empty": ["아직 특별히 기억나는 일은 많지 않지만, 앞으로 많이 쌓이면 좋겠어요."],
            "goodbye": ["조심히 가세요. 다음에 또 이야기해요."],
            "smalltalk": [
                "그렇군요. 조금 더 이야기해주실래요?",
                "흥미로운 이야기네요. 이 마을에서도 그런 생각을 하게 될 때가 있어요.",
                "음, 잘은 모르겠지만 듣고 있으니 재미있어요."
            ]
        },
        "playful": {
            "greeting_stranger": [
                "안녕! 난 {npc_name}(이)야. 오, 새로 이사 온 주민이야?",
                "야호! 안녕? 난 {npc_name}(이)라고 해. 만나서 기뻐!"
            ],
            "greeting_acquaintance": [
                "헤헤, 또 만났네! 오늘은 어디 재미있는 데 가?",
                "앗! 반가워! 오늘 날씨 진짜 좋지 않아?"
            ],
            "greeting_friend": [
                "와! 반가워! 기다리고 있었다구. 오늘은 뭐 하고 놀까?",
                "어라? 마침 너 생각하고 있었는데 딱 맞춰 왔네! 헤헤."
            ],
            "ask_name": ["내 이름은 {npc_name}! 잊어버리면 안 돼, 헤헤."],
            "ask_emotion_happy": ["헤헤, 기분 완전 최고야! 날씨가 너무 맑아서 기운이 넘쳐!"],
            "ask_emotion_shy": ["오, 갑자기 내 기분을 물어보니까 부끄럽잖아, 헤헤."],
            "ask_emotion_sad": ["음... 사실 조금 슬펐는데, 네가 오니까 다시 기운이 나는 것 같아."],
            "ask_emotion_angry": ["나 화났어! 지금은 나 건드리지 마!"],
            "ask_emotion_lonely": ["헤헤, 조금 쓸쓸했는데 타이밍 딱 맞춰서 왔네! 반가워!"],
            "ask_emotion_excited": ["와! 진짜 대박 신나! 무슨 재밌는 일이 터질 것 같아, 헤헤!"],
            "ask_emotion_stressed": ["아... 스트레스 쌓여! 머리 복잡하니까 혼자 있고 싶어."],
            "ask_emotion_comfortable": ["음~ 바람도 솔솔 불고 완전 편안해! 뒹굴거리고 싶어."],
            "ask_emotion_neutral": ["헤헤, 그냥 보통의 하루지 뭐! 너는 어때?"],
            "ask_like": ["나는 {like_item}이 정말 좋아! 생각만 해도 기분 최고야!"],
            "ask_dislike": ["으, 난 {dislike_item}은 질색이야! 가까이 가고 싶지도 않아."],
            "compliment": [
                "헤헤, 칭찬 들으니까 춤이라도 추고 싶은걸! 고마워!",
                "우와~ 부끄러운데 기분은 진짜 짱이다! 땡큐!"
            ],
            "insult": ["치! 심술궂게 그렇게 말하다니 정말 너무해!"],
            "give_gift": [
                "우와! 진짜 선물이야? 나 주는 거야? 고마워, 헤헤!",
                "선물 대박! 내가 이거 좋아하는 거 어떻게 알았어? 소중히 보관할게!"
            ],
            "ask_memory_exist": ["헤헤, 당연히 기억하지! 너가 저번에 {memory_content}"],
            "ask_memory_empty": ["헤헤, 아직은 우리 둘만의 특별한 추억이 별로 없네. 앞으로 많이 만들자!"],
            "goodbye": ["잘 가! 나중에 꼭 또 놀러 와야 해!"],
            "smalltalk": [
                "아, 그래? 신기하네! 더 말해줘 봐, 헤헤!",
                "와, 진짜 재밌는 소리다! 너 되게 똑똑하다!",
                "응응! 듣고 있어. 그래서 어떻게 됐는데?"
            ]
        },
        "calm": {
            "greeting_stranger": [
                "허허, 안녕하세요. 나는 이 마을의 {npc_name}이라고 하네. 처음 뵙는구려.",
                "음, 반갑네. 나는 역사와 책을 사랑하는 {npc_name}일세."
            ],
            "greeting_acquaintance": [
                "또 만났구려. 오늘도 유쾌하게 산책을 즐기고 있는 겐가?",
                "허허, 안녕하신가. 오늘도 마을 공기를 듬뿍 들이마시고 있군."
            ],
            "greeting_friend": [
                "어서 오게나. 자네를 보니 오늘도 내심 반갑구려.",
                "기다리고 있었네. 자네와 나누는 대화는 늘 내 하루의 활력소지."
            ],
            "ask_name": ["나의 이름은 {npc_name}이라고 하네. 기억해 주면 고맙겠군."],
            "ask_emotion_happy": ["오늘은 꽤 기분이 좋구려. 마을 공기가 유난히 산뜻해서 그런 듯하네."],
            "ask_emotion_shy": ["조금 쑥스럽네만 괜찮다네. 노인네 안부를 다 챙겨주다니 고맙군."],
            "ask_emotion_sad": ["조금 마음이 울적했네만... 자네가 말을 건네주니 한결 나아졌구려."],
            "ask_emotion_angry": ["허허, 지금은 솔직히 그리 유쾌한 심정은 아니라네."],
            "ask_emotion_lonely": ["허허, 홀로 서재에 있으니 조금 쓸쓸하더군. 하지만 자네가 와 주어 다행일세."],
            "ask_emotion_excited": ["허허, 마음이 무척 흥분되는구려. 무언가 기분 좋은 예감이 드는군."],
            "ask_emotion_stressed": ["요즘 피로가 겹쳤는지 머리가 조금 아프구려. 차분히 쉬어야겠네."],
            "ask_emotion_comfortable": ["무척이나 평온하고 조용한 시간이구려. 이대로 풍경을 즐기는 것도 좋지."],
            "ask_emotion_neutral": ["음, 오늘은 그저 평범하고 평온한 하루일세."],
            "ask_like": ["나는 {like_item}을 무척 아끼고 좋아한다네. 그것들을 대할 때 가장 보람되지."],
            "ask_dislike": ["내 나이가 되어도 {dislike_item}은 참 낯설고 멀리하고 싶더군."],
            "compliment": [
                "허허, 그렇게 칭찬해주다니 마음 씀씀이가 참 곱구려. 고맙네.",
                "음, 쑥스럽구려. 내 나이에 그런 칭찬을 듣다니 기분은 좋군."
            ],
            "insult": ["흠, 그런 짓궂은 말은 삼가 주면 좋겠군. 마음이 언짢네만."],
            "give_gift": [
                "오, 나를 위한 선물인가? 정성이 참 갸륵하구려. 잘 간직하겠네.",
                "선물이라니, 뜻밖이구려. 고맙네. 유용하게 잘 쓰겠네."
            ],
            "ask_memory_exist": ["허허, 내 나이가 되어도 잊지 않았네. 자네가 {memory_content}"],
            "ask_memory_empty": ["아직은 기억에 담아둘 만한 거창한 일은 없네만, 앞으로 좋은 인연을 맺어가세."],
            "goodbye": ["조심히 들어가게나. 다음 기회에 또 차 한잔하세."],
            "smalltalk": [
                "흠, 그렇구려. 꽤 흥미로운 생각이니 조금 더 들려주겠나?",
                "이 마을의 역사 속에서도 비슷한 생각을 했던 철학자가 있었네만...",
                "허허, 자네 이야기를 듣고 있자니 마음이 흐뭇해지는구려."
            ]
        }
    }

    @classmethod
    def generate_reply(cls, npc_data: dict, relation_state: dict, current_emotion: str, intent: str, recent_memory: Optional[dict] = None) -> str:
        style = npc_data.get("style", "soft")
        npc_name = npc_data.get("name", "주민")
        like_item = npc_data.get("likes", "좋아하는 것")
        dislike_item = npc_data.get("dislikes", "싫어하는 것")

        # Get style templates
        style_templates = cls.TEMPLATES.get(style, cls.TEMPLATES["soft"])

        friendship = relation_state.get("friendship", 0)
        
        # Determine relationship step for greeting templates
        if friendship >= 40:
            rel_key = "friend"
        elif friendship >= 20:
            rel_key = "acquaintance"
        else:
            rel_key = "stranger"

        # Match intent key to template
        template_key = intent
        
        # Special mappings
        if intent == "greeting":
            template_key = f"greeting_{rel_key}"
        elif intent == "ask_emotion":
            template_key = f"ask_emotion_{current_emotion}"
        elif intent == "ask_memory":
            if recent_memory:
                template_key = "ask_memory_exist"
            else:
                template_key = "ask_memory_empty"

        # Fallback to smalltalk if template is missing
        templates = style_templates.get(template_key, style_templates["smalltalk"])
        selected_template = random.choice(templates)

        # Format variables
        memory_content = recent_memory["content"] if recent_memory else ""
        
        reply = selected_template.format(
            npc_name=npc_name,
            like_item=like_item,
            dislike_item=dislike_item,
            memory_content=memory_content
        )

        return reply
