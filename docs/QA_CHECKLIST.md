# Outverse — QA Checklist (خطوة بخطوة)

دليل اختبار يدوي شامل قبل الإطلاق. ضع ✅ عند اكتمال كل خطوة.

**البيئة المطلوبة**
- Backend: `python manage.py runserver` (port 8000)
- Frontend: `npm run dev` (port 3000)
- حسابان على الأقل: مبدع + متابع
- تطبيق migrations: `python manage.py migrate`

---

## 0. التحضير

| # | الخطوة | ✅ |
|---|--------|---|
| 0.1 | تشغيل Backend و Frontend بدون أخطاء في الطرفية | |
| 0.2 | فتح `/health` أو `GET /api/health/` — 200 OK | |
| 0.3 | تسجيل دخول بحساب مبدع | |
| 0.4 | تبديل اللغة EN ↔ AR والتحقق من RTL | |
| 0.5 | تبديل الثيم Light ↔ Dark | |

---

## 1. المصادقة والملف الشخصي

| # | الخطوة | ✅ |
|---|--------|---|
| 1.1 | تسجيل حساب جديد → رسالة تحقق البريد | |
| 1.2 | محاولة الدخول قبل التحقق → رفض `email_not_verified` | |
| 1.3 | التحقق من البريد → تسجيل دخول ناجح | |
| 1.4 | نسيت كلمة المرور → رابط إعادة التعيين | |
| 1.5 | تعديل الملف الشخصي (اسم، bio، avatar) | |
| 1.6 | متابعة/إلغاء متابعة مستخدم آخر | |
| 1.7 | زر **عرض التحليلات** في الملف الشخصي → `/analytics` | |

---

## 2. المنشورات (Posts)

| # | الخطوة | ✅ |
|---|--------|---|
| 2.1 | إنشاء منشور نصي من الخلاصة | |
| 2.2 | إنشاء منشور بصورة/فيديو/صوت | |
| 2.3 | إنشاء استطلاع (poll) والتصويت | |
| 2.4 | حفظ مسودة واستئنافها | |
| 2.5 | تعليق + رد على تعليق | |
| 2.6 | تثبيت تعليق (pin) كصاحب المنشور | |
| 2.7 | Echo (repost) و Quote repost | |
| 2.8 | حفظ منشور في المجموعات | |
| 2.9 | البحث بالوسم `#tag` | |
| 2.10 | فتح `/post/[id]` — OG metadata للمشاركة | |

---

## 3. التفاعلات (Reactions)

| # | الخطوة | ✅ |
|---|--------|---|
| 3.1 | نقرة واحدة → Spark (افتراضي) | |
| 3.2 | ضغطة مطولة → picker بـ 5 vibes | |
| 3.3 | Double-tap على الصورة → burst + reaction | |
| 3.4 | تغيير نوع التفاعل (toggle) | |
| 3.5 | فتح **Who resonated** → قائمة المتفاعلين | |
| 3.6 | إشعار للمبدع عند تفاعل جديد | |
| 3.7 | تفاعل على تعليق → إشعار | |

---

## 4. المشاركة (Sharing)

| # | الخطوة | ✅ |
|---|--------|---|
| 4.1 | فتح Share panel على منشور | |
| 4.2 | Copy link → عداد shares يزيد | |
| 4.3 | مشاركة WhatsApp / X / Telegram (يفتح الرابط) | |
| 4.4 | Share to story | |
| 4.5 | Share card + Embed snippet | |
| 4.6 | مشاركة عبر DM داخل التطبيق | |
| 4.7 | مشاركة Reel بنفس القنوات | |
| 4.8 | إشعار share للمبدع (أول مشاركة لكل مستخدم) | |

---

## 5. Reels (Signals)

| # | الخطوة | ✅ |
|---|--------|---|
| 5.1 | تصفح `/reels` — تبويب All / Following | |
| 5.2 | إنشاء reel من `/reels/create` | |
| 5.3 | تسجيل بالكamera + autosave draft | |
| 5.4 | اختيار موسيقى من sound page → prefill create | |
| 5.5 | تعليق + WS live comments | |
| 5.6 | multi-reaction على reel | |
| 5.7 | مشاركة reel | |
| 5.8 | `/reels/sound/[id]` — i18n AR/EN | |

---

## 6. Stories

| # | الخطوة | ✅ |
|---|--------|---|
| 6.1 | إنشاء story (نص، صورة، رسم) | |
| 6.2 | تبويب All / Following في الشريط | |
| 6.3 | استطلاع story + تصويت + i18n | |
| 6.4 | Close Friends — إضافة/حذف من Settings | |
| 6.5 | Time capsule unlock تلقائي | |
| 6.6 | reactions على story | |

---

## 7. Inspiration Engine

| # | الخطوة | ✅ |
|---|--------|---|
| 7.1 | فتح `/inspiration` — سؤال يومي | |
| 7.2 | Skip سؤال → يُسجَّل في stats | |
| 7.3 | Answer → نشر منشور مستوحى | |
| 7.4 | `/inspiration/history` — الأسئلة السابقة | |
| 7.5 | Stats per category في صفحة Inspiration | |
| 7.6 | `GET /api/questions/stats/` — preferred categories | |

---

## 8. Analytics للمبدعين

| # | الخطوة | ✅ |
|---|--------|---|
| 8.1 | فتح `/analytics` بدون تسجيل → prompt تسجيل الدخول | |
| 8.2 | بعد تسجيل الدخول → Creativity score + weekly activity | |
| 8.3 | **Creator analytics** — summary (content, views, reactions, shares) | |
| 8.4 | Engagement trend (7 أيام) — shares + reactions | |
| 8.5 | Shares by channel chart | |
| 8.6 | Reactions by vibe chart | |
| 8.7 | Inspired posts + preferred categories | |
| 8.8 | Top performing content — روابط post/reel صحيحة | |
| 8.9 | `GET /api/analytics/creator/` — 401 بدون auth | |
| 8.10 | AR: كل النصوص مترجمة (لا hardcoded English) | |

**اختبار API سريع:**
```bash
curl -H "Authorization: Token YOUR_TOKEN" http://127.0.0.1:8000/api/analytics/creator/
```

---

## 9. Chat

| # | الخطوة | ✅ |
|---|--------|---|
| 9.1 | فتح `/chat` — قائمة الغرف | |
| 9.2 | إرسال رسالة نصية | |
| 9.3 | WS: رسالة تظهر فوراً للطرف الآخر | |
| 9.4 | Mute / Archive غرفة | |
| 9.5 | Prompt rooms — seed rooms تظهر | |
| 9.6 | Room recap بعد نشاط | |

---

## 10. Notifications

| # | الخطوة | ✅ |
|---|--------|---|
| 10.1 | إشعار like/reaction/share/comment/repost | |
| 10.2 | Dropdown في Header — تحديث تدريجي WS | |
| 10.3 | صفحة `/notifications` — pagination | |
| 10.4 | Enable browser push (Settings) | |
| 10.5 | Push يصل عند إشعار جديد (HTTPS) | |

---

## 11. Shop + Premium

| # | الخطوة | ✅ |
|---|--------|---|
| 11.1 | تصفح `/shop` — منتجات | |
| 11.2 | شراء رقمي → download link | |
| 11.3 | `/shop/orders` — حالة الطلب | |
| 11.4 | `/shop/dashboard` — sales chart للبائع | |
| 11.5 | `/premium` — خطط الاشتراك | |
| 11.6 | Stripe checkout (test mode) | |

---

## 12. Saved + Search

| # | الخطوة | ✅ |
|---|--------|---|
| 12.1 | `/saved` — مجموعات + عناصر | |
| 12.2 | `/search` — users, posts, tags | |
| 12.3 | visibility للمجموعات (public/private) | |

---

## 13. Admin (staff فقط)

| # | الخطوة | ✅ |
|---|--------|---|
| 13.1 | `/admin` — dashboard counts | |
| 13.2 | `/admin/analytics` — platform stats | |
| 13.3 | Moderation — flags pending | |
| 13.4 | مستخدم عادي → 403 على admin API | |

---

## 14. العوالم (Worlds)

| # | الخطوة | ✅ |
|---|--------|---|
| 14.1 | `/lab` — تجارب + history | |
| 14.2 | `/vault` — ideas | |
| 14.3 | `/bazaar` — listings | |
| 14.4 | `/forge` — narratives | |
| 14.5 | `/bottles` — throw/catch | |
| 14.6 | `/capsules`, `/collab`, `/library` — تحميل بدون crash | |

---

## 15. Mobile + a11y

| # | الخطوة | ✅ |
|---|--------|---|
| 15.1 | DevTools → iPhone viewport — لا overflow أفقي | |
| 15.2 | Bottom nav + header usable على 375px | |
| 15.3 | Skip to main content (keyboard) | |
| 15.4 | Tab navigation على الأزرار الرئيسية | |
| 15.5 | Contrast مقبول في Dark mode | |

---

## 16. Automated checks (قبل merge)

```bash
# Backend
cd backend && pytest

# Frontend
cd outverse-dashboard && npm run typecheck
cd outverse-dashboard && npm run e2e   # optional, servers running
```

| # | الأمر | متوقع | ✅ |
|---|-------|-------|---|
| 16.1 | `pytest` | all pass | |
| 16.2 | `npm run typecheck` | 0 errors | |
| 16.3 | `npm run build` | success | |
| 16.4 | Playwright smoke | pass | |

---

## 17. Security smoke

| # | الخطوة | ✅ |
|---|--------|---|
| 17.1 | API بدون token على endpoints محمية → 401 | |
| 17.2 | Admin endpoints بدون staff → 403 | |
| 17.3 | Rate limit على share/views (429 بعد كثرة الطلبات) | |
| 17.4 | XSS: `<script>` في تعليق يُعرض escaped | |
| 17.5 | `.env` secrets غير committed | |

---

## ملاحظات QA

| التاريخ | المختبر | المشاكل المكتشفة | الحالة |
|---------|---------|------------------|--------|
| | | | |

---

*آخر تحديث: يشمل Creator Analytics Dashboard، Sharing v2، Reactions v2، Inspiration Engine v3.*
