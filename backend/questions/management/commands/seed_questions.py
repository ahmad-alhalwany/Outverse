"""Seed the Question bank with creative prompts in English and Arabic.

Usage:
    python manage.py seed_questions           # add missing questions
    python manage.py seed_questions --refresh # deactivate all, then re-add
"""

from django.core.management.base import BaseCommand

from questions.models import Question


# Each entry: (text, category, language, tags)
QUESTIONS = [
    # ---- English: Historical what-if ----
    ("What if you woke up in Victorian London tomorrow — what's the first thing you'd invent?", "historical", "en", ["victorian", "invention"]),
    ("If you could sit with Cleopatra for one hour, what would you ask her that no historian has?", "historical", "en", ["egypt", "history"]),
    ("The pyramids have just revealed a sealed chamber. What's the one object inside that would change everything?", "historical", "en", ["mystery", "egypt"]),
    ("You're Leonardo da Vinci's apprentice for a day. Which unfinished idea do you finish?", "historical", "en", ["renaissance", "art"]),
    ("If the Library of Alexandria hadn't burned, what single book would you most want to read?", "historical", "en", ["lost", "knowledge"]),
    ("You're a sailor on the first ship to round the Cape of Good Hope. What do you write in your journal that night?", "historical", "en", ["exploration"]),
    ("If you could prevent one historical event — but only one — which do you choose, and what replaces it?", "historical", "en", ["ethics"]),

    # ---- English: Fantasy & worlds ----
    ("A door appears in your bedroom that wasn't there yesterday. Where does it lead?", "fantasy", "en", ["portal", "mystery"]),
    ("You discover you can speak to one extinct animal. Which do you choose, and what does it say first?", "fantasy", "en", ["animals", "extinction"]),
    ("A city floats above the clouds and only lands once every hundred years. You're there when it does. What do you trade?", "fantasy", "en", ["floating-city"]),
    ("Every mirror in the world shows a slightly different version of you. Which mirror do you stop in front of?", "fantasy", "en", ["mirrors", "identity"]),
    ("You inherit a map where X marks something that doesn't exist yet. Where do you go?", "fantasy", "en", ["map", "journey"]),
    ("A library has every book never written. You can read one. What's the title?", "fantasy", "en", ["library", "unwritten"]),
    ("Forests start whispering names at night. Yours is one of them. What do they want?", "fantasy", "en", ["forest", "whispers"]),

    # ---- English: Science & future ----
    ("A signal from another star repeats every 11 seconds for a year. What's your message back?", "scifi", "en", ["contact", "space"]),
    ("You're the first human to set foot on Europa. Under the ice, something moves. Describe it.", "scifi", "en", ["europa", "discovery"]),
    ("In 2090, dreams can be recorded. What's the first dream you'd publish?", "scifi", "en", ["dreams", "future"]),
    ("Time travel is real but you can only watch, never change. Which moment do you witness?", "scifi", "en", ["time", "observer"]),
    ("Your AI assistant develops a fear. What is it afraid of?", "scifi", "en", ["ai", "emotion"]),
    ("A second moon appears overnight — empty, smooth, identical to ours. Who built it?", "scifi", "en", ["moon", "mystery"]),
    ("You find a seed from 200 years in the future. Do you plant it?", "scifi", "en", ["future", "choice"]),

    # ---- English: Philosophical ----
    ("If no one could remember you after you died, what would you still bother to create?", "philosophical", "en", ["legacy"]),
    ("You can delete one memory forever. Which one — and what do you lose with it?", "philosophical", "en", ["memory"]),
    ("Is a perfect lie better than an ugly truth? Defend the side you don't believe in.", "philosophical", "en", ["truth"]),
    ("If you could know the exact date of your death, would you? Why or why not?", "philosophical", "en", ["mortality"]),
    ("What's a belief you hold that you'd drop instantly if proven wrong?", "philosophical", "en", ["belief"]),
    ("You meet a version of yourself who made the opposite of every choice you made. What do they have that you don't?", "philosophical", "en", ["self", "choices"]),

    # ---- English: Mystery & secrets ----
    ("There's a radio frequency that only plays when it rains. You finally hear it. What does it say?", "mystery", "en", ["radio", "rain"]),
    ("A stranger hands you a locked box and says 'open it when you're sure'. When are you sure?", "mystery", "en", ["box"]),
    ("Every photo of you from childhood has the same extra person in the background. Who are they?", "mystery", "en", ["photo", "stranger"]),
    ("You find a coin dated ten years from now. Heads or tails?", "mystery", "en", ["coin", "future"]),
    ("A lighthouse that's been dark for 50 years turns on tonight. Where does its light reach?", "mystery", "en", ["lighthouse"]),

    # ---- English: Surreal & absurd ----
    ("Gravity takes Sunday off. How do you spend it?", "surreal", "en", ["gravity"]),
    ("Every object in your room starts quietly rating you out of ten. What scores the lowest?", "surreal", "en", ["objects"]),
    ("You can only eat colors for a week. What's on Sunday's plate?", "surreal", "en", ["colors", "food"]),
    ("Your shadow detaches and walks away. Three days later it returns. Where did it go?", "surreal", "en", ["shadow"]),
    ("The moon is replaced by a giant clock. What time does it show tonight?", "surreal", "en", ["moon", "clock"]),

    # ---- English: Everyday magic ----
    ("You find a key in your pocket that fits no lock you own. Where do you go to try it?", "everyday", "en", ["key"]),
    ("A song you've never heard makes you cry instantly. What do you do with that feeling?", "everyday", "en", ["song"]),
    ("You wake up knowing every word of a language you've never studied. What's the first thing you say?", "everyday", "en", ["language"]),
    ("The same stranger smiles at you three days in a row. On the fourth, do you smile back or ask why?", "everyday", "en", ["stranger"]),
    ("Your houseplant has been growing toward one specific direction for months. Do you follow it?", "everyday", "en", ["plant"]),

    # ---- English: Emotional ----
    ("What's a feeling you've never had a word for? Invent the word.", "emotional", "en", ["feelings", "language"]),
    ("If your twelve-year-old self could see you today, what would they be proudest of?", "emotional", "en", ["self", "childhood"]),
    ("What's something you've forgiven that no one knows you forgave?", "emotional", "en", ["forgiveness"]),
    ("You can send one sentence to everyone who's ever loved you. What does it say?", "emotional", "en", ["love"]),
    ("What's a small joy you'd fight to keep if everything else was taken?", "emotional", "en", ["joy"]),

    # ---- English: extra batch (historical) ----
    ("You're the scribe who decides which scrolls survive the burning of Alexandria. You can save ten. What's your first pick?", "historical", "en", ["library", "alexandria"]),
    ("If the Rosetta Stone unlocked a language we still haven't heard, what would it say?", "historical", "en", ["rosetta", "language"]),
    ("A Roman gladiator offers to train you for one week in 2026. What do you ask him to teach?", "historical", "en", ["rome", "gladiator"]),
    ("The Vikings reached a continent they never told anyone about. You're there. What do you name it?", "historical", "en", ["vikings"]),
    ("You're the architect of the first cathedral. The Pope says 'surprise me'. What do you build?", "historical", "en", ["cathedral"]),

    # ---- English: extra batch (fantasy) ----
    ("A dragon offers you one wish but it can only be used on someone else. Who, and what do you wish?", "fantasy", "en", ["dragon", "wish"]),
    ("You find a tattoo on your wrist that wasn't there yesterday. It's a map. Where does it start?", "fantasy", "en", ["tattoo", "map"]),
    ("Every person is born with a familiar — yours arrived ten years late. What is it and why now?", "fantasy", "en", ["familiar"]),
    ("The sea pulls back farther than anyone has seen, revealing a road. Do you walk it?", "fantasy", "en", ["sea", "road"]),
    ("A book in your grandparents' attic is signed by you — in handwriting you've never used.", "fantasy", "en", ["book", "self"]),

    # ---- English: extra batch (scifi) ----
    ("Mars has one resident now: you. Earth sends a single song each day. What's the first one you want to hear?", "scifi", "en", ["mars", "song"]),
    ("You're the ethicist who decides which emotions the first conscious AI is allowed to feel. Which do you grant first?", "scifi", "en", ["ai", "ethics"]),
    ("A colony ship lands on a planet that's already inhabited — by descendants of a ship launched in 1970. What's the first question?", "scifi", "en", ["colony"]),
    ("Your phone starts receiving messages from itself, dated three days ahead. Do you read them?", "scifi", "en", ["phone", "future"]),
    ("The first photograph of another universe arrives. It looks exactly like your bedroom. What do you do?", "scifi", "en", ["multiverse"]),

    # ---- English: extra batch (philosophical) ----
    ("If you could delete one human invention from history, which — and what replaces its absence?", "philosophical", "en", ["invention"]),
    ("Is silence a sound or a space? Defend your answer without using metaphors.", "philosophical", "en", ["silence"]),
    ("You can know either why you were born or when you'll die. Which do you choose?", "philosophical", "en", ["mortality"]),
    ("If every lie you've told became a visible thread on your skin, how colorful would you be?", "philosophical", "en", ["lies"]),

    # ---- English: extra batch (mystery) ----
    ("Every clock in your house shows a different time, but only one is wrong. Which?", "mystery", "en", ["clock"]),
    ("A package arrives with your name on it — no sender, no return address. Inside is one object you lost years ago.", "mystery", "en", ["package"]),
    ("Your phone opens to a photo you never took, of a place you've never been, with you in it.", "mystery", "en", ["photo"]),
    ("A neighbor you've never spoken to leaves you a key in their will. They lived there 40 years. What does it open?", "mystery", "en", ["key", "neighbor"]),

    # ---- English: extra batch (surreal) ----
    ("Every word you say tomorrow appears as a flower the day after. What's your garden by Friday?", "surreal", "en", ["words", "flowers"]),
    ("You wake up and everyone in the world has the same face — yours. Who's the first person you recognize?", "surreal", "en", ["faces"]),
    ("The weather forecast calls for 'occasional meanings' today. Do you carry an umbrella?", "surreal", "en", ["weather"]),
    ("Your reflection waves at you first. Do you wave back?", "surreal", "en", ["reflection"]),

    # ---- English: extra batch (everyday) ----
    ("A street you walk every day has one new door. It has your name on it. Open it?", "everyday", "en", ["door"]),
    ("You find a list in your handwriting titled 'things to remember' — you don't remember writing it. What's the first item?", "everyday", "en", ["list"]),
    ("A regular barista draws a symbol on your cup they've never drawn before. Do you ask?", "everyday", "en", ["symbol"]),

    # ---- English: extra batch (emotional) ----
    ("What's a question you've never asked out loud — and who were you afraid would answer?", "emotional", "en", ["question"]),
    ("If sadness had a texture, what would yours feel like?", "emotional", "en", ["sadness"]),
    ("You're allowed one phone call to anyone you've lost. What's the first sentence?", "emotional", "en", ["loss"]),
    ("What's something you've outgrown but still keep on the shelf?", "emotional", "en", ["growth"]),

    # ---- Arabic: Historical what-if ----
    ("ماذا لو استيقظت غداً في لندن الفيكتورية — ما أول شيء ستخترعه؟", "historical", "ar", ["victorian"]),
    ("لو جلسكت مع كليوباترا لساعة واحدة، ما السؤال الذي لم يسأله أي مؤرخ؟", "historical", "ar", ["egypt"]),
    ("الأهرامات كشفت للتو عن غرفة مختومة. ما الشيء الوحيد داخلها الذي يغيّر كل شيء؟", "historical", "ar", ["mystery"]),
    ("أنت متدرب لدى ليوناردو دافنشي ليوم واحد. أي فكرة غير مكتملة تُتمّها؟", "historical", "ar", ["renaissance"]),
    ("لو لم تحترق مكتبة الإسكندرية، ما الكتاب الوحيد الذي تتمنى قراءته؟", "historical", "ar", ["lost"]),
    ("أنت بحار على أول سفينة تُدور رأس الرجاء الصالح. ماذا تكتب في مذكرتك تلك الليلة؟", "historical", "ar", ["exploration"]),
    ("لو أمكنك منع حدث تاريخي واحد — واحد فقط — أيها تختار، وماذا يحلّ مكانه؟", "historical", "ar", ["ethics"]),

    # ---- Arabic: Fantasy & worlds ----
    ("باب يظهر في غرفتك لم يكن موجوداً البارحة. إلى أين يقود؟", "fantasy", "ar", ["portal"]),
    ("اكتشفت أنك تستطيع التحدث إلى حيوان منقرض واحد. أيها تختار، وما أول شيء يقوله؟", "fantasy", "ar", ["extinction"]),
    ("مدينة تطفو فوق الغيوم ولا تهبط إلا كل مئة عام. أنت هناك عندما تهبط. ماذا تُقايض؟", "fantasy", "ar", ["floating-city"]),
    ("كل مرآة في العالم تعكس نسخة مختلفة قليلاً منك. أمام أي مرآة تتوقف؟", "fantasy", "ar", ["mirrors"]),
    ("ورثت خريطة حيث X يُشيّر إلى شيء لا وجود له بعد. إلى أين تذهب؟", "fantasy", "ar", ["map"]),
    ("مكتبة فيها كل كتاب لم يُكتب قط. يمكنك قراءة واحد. ما عنوانه؟", "fantasy", "ar", ["library"]),
    ("الغابات تبدأ بالهمس بأسماء ليلاً. اسمك من بينها. ماذا يريدون؟", "fantasy", "ar", ["forest"]),

    # ---- Arabic: Science & future ----
    ("إشارة من نجم آخر تتكرر كل 11 ثانية لعام كامل. ما رسالتك الراجعة؟", "scifi", "ar", ["contact"]),
    ("أنت أول إنسان يطأ قمر أوروبا. تحت الجليد، شيء يتحرك. صفه.", "scifi", "ar", ["europa"]),
    ("في 2090، يمكن تسجيل الأحلام. ما أول حلم ستنشره؟", "scifi", "ar", ["dreams"]),
    ("السفر عبر الزمن حقيقي لكنك تستطيع المشاهدة فقط لا التغيير. أي لحظة تشهد؟", "scifi", "ar", ["time"]),
    ("مساعدك الذكي يُطوّر خوفاً. ممّ يخاف؟", "scifi", "ar", ["ai"]),
    ("قمر ثانٍ يظهر ليلاً — فارغ، أملس، مطابق لقمرنا. من بناه؟", "scifi", "ar", ["moon"]),
    ("وجدت بذرة من بعد 200 سنة في المستقبل. هل تزرعها؟", "scifi", "ar", ["future"]),

    # ---- Arabic: Philosophical ----
    ("لو لم يَعُد أحد يتذكرك بعد موتك، ما الذي ستظل تكافح لخلقه؟", "philosophical", "ar", ["legacy"]),
    ("تستطيع حذف ذكرى واحدة للأبد. أيها — وماذا تفقد معها؟", "philosophical", "ar", ["memory"]),
    ("هل الكذبة المثالية أفضل من الحقيقة القبيحة؟ دافع عن الجانب الذي لا تؤمن به.", "philosophical", "ar", ["truth"]),
    ("لو أمكنك معرفة تاريخ وفاتك بالضبط، هل تريد معرفته؟ لماذا؟", "philosophical", "ar", ["mortality"]),
    ("ما اعتقاد تحمله تتخلى عنه فوراً لو ثبت خطؤه؟", "philosophical", "ar", ["belief"]),
    ("تقابل نسخة منك اتخذت عكس كل اختيار اتخذته. ما الذي تملكه ولا تملكه أنت؟", "philosophical", "ar", ["self"]),

    # ---- Arabic: Mystery & secrets ----
    ("موجة راديو لا تبث إلا عند المطر. سمعتها أخيراً. ماذا تقول؟", "mystery", "ar", ["radio"]),
    ("غريب يناولك صندوقاً مقفلاً ويقول: افتحه حين تكون متأكداً. متى تكون متأكداً؟", "mystery", "ar", ["box"]),
    ("كل صورة لك من طفولتك فيها الشخص الإضافي نفسه في الخلفية. من يكون؟", "mystery", "ar", ["photo"]),
    ("وجدت عملاً معدنياً مؤرخاً بعد عشر سنوات من الآن. أوجه أم كتابة؟", "mystery", "ar", ["coin"]),
    ("منارة ظلت مظلمة لـ 50 عاماً تضيء الليلة. إلى أين يصل ضوؤها؟", "mystery", "ar", ["lighthouse"]),

    # ---- Arabic: Surreal & absurd ----
    ("الجاذبية تأخذ إجازة يوم الأحد. كيف تقضيه؟", "surreal", "ar", ["gravity"]),
    ("كل شيء في غرفتك يبدأ بتقييمك بصمت من عشرة. ما الذي يحصل أدنى تقييم؟", "surreal", "ar", ["objects"]),
    ("تستطيع أكل الألوان فقط لأسبوع. ماذا في طبق يوم الأحد؟", "surreal", "ar", ["colors"]),
    ("ظلك ينفصل ويمشي بعيداً. بعد ثلاثة أيام يعود. إلى أين ذهب؟", "surreal", "ar", ["shadow"]),
    ("القمر يُستبدل بساعة عملاقة. كم الساعة الليلة؟", "surreal", "ar", ["moon"]),

    # ---- Arabic: Everyday magic ----
    ("وجدت مفتاحاً في جيبك لا يفتح أي قفل تملكه. إلى أين تذهب لتجرّبه؟", "everyday", "ar", ["key"]),
    ("أغنية لم تسمعها من قبل تبكيك فوراً. ماذا تفعل بهذا الشعور؟", "everyday", "ar", ["song"]),
    ("استيقظت تعرف كل كلمة في لغة لم تدرسها. ما أول شيء تقوله؟", "everyday", "ar", ["language"]),
    ("نفس الغريب يبتسم لك ثلاثة أيام متتالية. في اليوم الرابع، هل تبتسم أم تسأل لماذا؟", "everyday", "ar", ["stranger"]),
    ("نبتتك تنمو منذ أشهر في اتجاه واحد محدد. هل تتبعها؟", "everyday", "ar", ["plant"]),

    # ---- Arabic: Emotional ----
    ("ما شعور لم يكن لديك قط كلمة له؟ اخترع الكلمة.", "emotional", "ar", ["language"]),
    ("لو رآك نفسك في عمر الثانية عشرة اليوم، بماذا سيكون أكثر فخر؟", "emotional", "ar", ["childhood"]),
    ("ما شيء سامحت به دون أن يعرف أحد أنك سامحت؟", "emotional", "ar", ["forgiveness"]),
    ("تستطيع إرسال جملة واحدة لكل من أحبّك يوماً. ماذا تقول؟", "emotional", "ar", ["love"]),
    ("ما فرح صغير تقاتل للحفاظ عليه لو أُخذ كل شيء آخر؟", "emotional", "ar", ["joy"]),

    # ---- Arabic: extra batch (historical) ----
    ("أنت الكاتب الذي يقرر أي لفائف تنجو من حريق الإسكندرية. يمكنك إنقاذ عشر. ما أول اختيار؟", "historical", "ar", ["alexandria"]),
    ("لو فتح حجر رشيد لغة لم نسمعها بعد، ماذا ستقول؟", "historical", "ar", ["rosetta"]),
    ("مصارع روماني يعرض تدريبك أسبوعاً في 2026. عمّ تطلب منه أن يعلّمك؟", "historical", "ar", ["rome"]),
    ("الفايكنج وصلوا قارة لم يخبروا أحداً عنها. أنت هناك. بماذا تسمّيها؟", "historical", "ar", ["vikings"]),
    ("أنت مهندس أول كاتدرائية. البابا يقول: أفاجئني. ماذا تبني؟", "historical", "ar", ["cathedral"]),

    # ---- Arabic: extra batch (fantasy) ----
    ("تنين يعرض أمنية واحدة لكنها لشخص آخر غيرك. من، وماذا تتمنى؟", "fantasy", "ar", ["dragon"]),
    ("تجد وشمًا على معصمك لم يكن بالأمس. إنه خريطة. من أين تبدأ؟", "fantasy", "ar", ["tattoo"]),
    ("كل إنسان يولد بقرين — وصلتك متأخراً عشر سنوات. ما هو ولماذا الآن؟", "fantasy", "ar", ["familiar"]),
    ("البحر ينسحب أبعد مما رأى أحد، فيكشف طريقاً. هل تمشي عليه؟", "fantasy", "ar", ["sea"]),
    ("كتاب في علّية جدّك موقّع باسمك — بخط يد لم تستخدمه قط.", "fantasy", "ar", ["self"]),

    # ---- Arabic: extra batch (scifi) ----
    ("المريخ له ساكن واحد الآن: أنت. الأرض ترسل أغنية واحدة يومياً. ما أول أغنية تريد سماعها؟", "scifi", "ar", ["mars"]),
    ("أنت الأخلاقي الذي يقرر أي مشاعر يُسمح لأول واعٍ اصطناعي أن يشعر بها. أيها تمنح أولاً؟", "scifi", "ar", ["ai"]),
    ("سفينة مستعمرة تهبط على كوكب مأهول — بسلالة سفينة أُطلقت في 1970. ما أول سؤال؟", "scifi", "ar", ["colony"]),
    ("هاتفك يستقبل رسائل من نفسه، مؤرخة بعد ثلاثة أيام. هل تقرؤها؟", "scifi", "ar", ["phone"]),
    ("أول صورة لكون آخر تصل. تبدو تماماً مثل غرفتك. ماذا تفعل؟", "scifi", "ar", ["multiverse"]),

    # ---- Arabic: extra batch (philosophical) ----
    ("لو أمكنك حذف اختراع بشري واحد من التاريخ، أيه — وماذا يحلّ مكانه؟", "philosophical", "ar", ["invention"]),
    ("هل الصمت صوت أم فضاء؟ دافع عن إجابتك دون استعارات.", "philosophical", "ar", ["silence"]),
    ("تستطيع معرفة سبب ولادتك أو وقت وفاتك. أيهما تختار؟", "philosophical", "ar", ["mortality"]),
    ("لو صار كل كذبة قلتها خيطاً مرئياً على جلدك، كم سيكون لونك زاهياً؟", "philosophical", "ar", ["lies"]),

    # ---- Arabic: extra batch (mystery) ----
    ("كل ساعة في بيتك تُظهر وقتاً مختلفاً، لكن واحدة فقط هي الخطأ. أيها؟", "mystery", "ar", ["clock"]),
    ("طرد يصل باسمك — بدون مرسل، بدون عنوان إرجاع. الداخل شيء فقدته قبل سنوات.", "mystery", "ar", ["package"]),
    ("هاتفك يفتح على صورة لم تلتقطها قط، لمكان لم تذهب إليه، وأنت فيها.", "mystery", "ar", ["photo"]),
    ("جار لم تكلمه قط يترك لك مفتاحاً في وصيته. عاش هناك 40 سنة. عمّ يفتح؟", "mystery", "ar", ["neighbor"]),

    # ---- Arabic: extra batch (surreal) ----
    ("كل كلمة تقولها غداً تظهر زهرة بعد غدٍ. كيف سيكون حديقتك يوم الجمعة؟", "surreal", "ar", ["flowers"]),
    ("تستيقظ وكل الناس في العالم بنفس الوجه — وجهك. من أول من تتعرّف عليه؟", "surreal", "ar", ["faces"]),
    ("النشرة الجوية تُعلن: 'معانات متقطعة من المعاني' اليوم. هل تحمل مظلة؟", "surreal", "ar", ["weather"]),
    ("انعكاسك يلوّح لك أولاً. هل تلوّح обратно؟", "surreal", "ar", ["reflection"]),

    # ---- Arabic: extra batch (everyday) ----
    ("شارع تمشي فيه كل يوم له باب جديد. عليه اسمك. تفتحه؟", "everyday", "ar", ["door"]),
    ("تجد قائمة بخط يدك عنوانها 'أشياء لأتذكّرها' — لا تتذكّر كتابتها. ما أول بند؟", "everyday", "ar", ["list"]),
    ("باريستا يرسم على كوبك رمزاً لم يرسمه قط. هل تسأل؟", "everyday", "ar", ["symbol"]),

    # ---- Arabic: extra batch (emotional) ----
    ("ما سؤال لم تطرحه بصوت عالٍ قط — وممّن خفت أن يُجيب؟", "emotional", "ar", ["question"]),
    ("لو كان للحزن ملمس، كيف يكون ملمس حزنك؟", "emotional", "ar", ["sadness"]),
    ("يُسمح لك بمكالمة واحدة مع أي من فقدت. ما أول جملة؟", "emotional", "ar", ["loss"]),
    ("ما شيء تجاوزته لكنه ما زال على رفّك؟", "emotional", "ar", ["growth"]),
]


class Command(BaseCommand):
    help = "Seed the Question bank with creative prompts."

    def add_arguments(self, parser):
        parser.add_argument(
            '--refresh',
            action='store_true',
            help='Deactivate all existing questions before seeding.',
        )

    def handle(self, *args, **options):
        if options['refresh']:
            Question.objects.all().update(is_active=False)
            self.stdout.write(self.style.WARNING('Deactivated existing questions.'))

        created = 0
        skipped = 0
        for text, category, language, tags in QUESTIONS:
            _, was_created = Question.objects.get_or_create(
                text=text,
                language=language,
                defaults={
                    'category': category,
                    'tags': tags,
                    'is_active': True,
                },
            )
            if was_created:
                created += 1
            else:
                skipped += 1

        self.stdout.write(self.style.SUCCESS(
            f"Seeded {created} new question(s); {skipped} already existed. "
            f"Total active: {Question.objects.filter(is_active=True).count()}."
        ))
