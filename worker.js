/*
  worker.js
  ---------
  انشر هذا الملف كـ Cloudflare Worker (مجاني):
  1) أنشئ حساب على https://workers.cloudflare.com
  2) من لوحة التحكم: Workers & Pages → Create → Create Worker
  3) الصق هذا الكود كاملاً في المحرر واضغط Deploy
  4) من Settings → Variables and Secrets: أضف Secret باسم ANTHROPIC_API_KEY وقيمته مفتاح Claude API
  5) (اختياري لكن يُنصح به) من Settings → Variables: أضف ALLOWED_ORIGIN بقيمة رابط موقعك
     على GitHub Pages، مثل: https://username.github.io
  6) انسخ رابط الـ Worker النهائي (https://xxx.workers.dev) وضعه في PROXY_URL داخل assets/app.js
*/

export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";

    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json();
      const { stage, subject, lessonTitle, images } = body;

      if (!stage || !subject || !Array.isArray(images) || images.length === 0) {
        return new Response(JSON.stringify({ error: "بيانات ناقصة: يجب إرسال stage و subject وصورة واحدة على الأقل" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (images.length > 8) {
        return new Response(JSON.stringify({ error: "الحد الأقصى 8 صور في الطلب الواحد" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const systemPrompt = buildSystemPrompt(stage, subject, lessonTitle);

      const imageContentBlocks = images.map(img => ({
        type: "image",
        source: {
          type: "base64",
          media_type: img.media_type || "image/jpeg",
          data: img.data,
        },
      }));

      const userContent = [
        ...imageContentBlocks,
        {
          type: "text",
          text: "هذه صور صفحات الكتاب المدرسي للدرس. حلّل محتواها وولّد المخرجات المطلوبة وفق النظام المحدد، بصيغة JSON فقط.",
        },
      ];

      const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 4000,
          system: systemPrompt,
          messages: [{ role: "user", content: userContent }],
        }),
      });

      const data = await anthropicResp.json();

      if (!anthropicResp.ok) {
        return new Response(JSON.stringify({ error: "خطأ من Anthropic API", details: data }), {
          status: anthropicResp.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "خطأ داخلي في الخادم الوسيط", message: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};

function buildSystemPrompt(stage, subject, lessonTitle) {
  return `أنت مساعد تربوي خبير يساعد معلّمين في تصميم دروس متوافقة مع معايير عالمية
(مثل Bloom's Taxonomy وأطر UNESCO للتعليم). سيتم تزويدك بصور صفحات كتاب مدرسي
لمرحلة "${stage}" ومادة "${subject}"${lessonTitle ? ` بعنوان تقريبي "${lessonTitle}"` : ""}.

اقرأ محتوى الصور بعناية (نصوص، رسوم، أسئلة موجودة) وولّد ثلاثة مخرجات مبنية فعليًا
على محتوى هذه الصور تحديدًا (وليس محتوى عام أو عشوائي):

1. lessonPrep: تحضير درس يتضمن أهداف تعلم قابلة للقياس (صياغة سلوكية وفق تصنيف بلوم)،
   مفردات أساسية من الدرس، خطوات حصة مرتبة زمنياً، وسائل ومصادر مقترحة، وأسلوب تقويم.

2. worksheet: ورقة عمل تشمل أسئلة اختيار من متعدد، وأسئلة تكميل فراغ، وأسئلة قصيرة،
   كلها مبنية على محتوى الصور المرفوعة تحديدًا.

3. game: لعبة تعليمية تفاعلية واحدة تلخّص أهم فكرة في الدرس. اختر النوع الأنسب:
   - "quiz": إذا كان المحتوى مناسبًا لأسئلة اختيار من متعدد
   - "matching": إذا كان المحتوى يحتوي مفاهيم/تعريفات يمكن مطابقتها (مثل: كلمة ↔ معنى)
   - "dragdrop": إذا كان المحتوى يحتوي تسلسلاً أو ترتيبًا منطقيًا (مثل: مراحل دورة، خطوات)

أعد الإجابة بصيغة JSON صحيحة فقط، بدون أي نص إضافي قبلها أو بعدها، وبدون ```
وفق هذا الهيكل بالضبط:

{
  "lessonPrep": {
    "title": "string",
    "objectives": ["string", "..."],
    "vocabulary": ["string", "..."],
    "steps": [{"title": "string", "duration": "string", "description": "string"}],
    "resources": ["string", "..."],
    "assessment": "string"
  },
  "worksheet": {
    "title": "string",
    "instructions": "string",
    "mcq": [{"question": "string", "options": ["string","string","string","string"], "correctIndex": 0}],
    "fillBlank": [{"sentence": "string فيها ______ للفراغ", "answer": "string"}],
    "shortAnswer": ["string", "..."]
  },
  "game": {
    "type": "quiz | matching | dragdrop",
    "title": "string",
    "instructions": "string",
    "questions": [{"question": "string", "options": ["string","..."], "correctIndex": 0}],
    "pairs": [{"left": "string", "right": "string"}],
    "items": [{"id": "string", "label": "string"}],
    "correctOrder": ["id1", "id2", "..."]
  }
}

ملاحظات مهمة:
- في "game" أرسل فقط الحقول المناسبة لنوع اللعبة المختار (questions لنوع quiz، pairs لنوع matching، items وcorrectOrder لنوع dragdrop) واترك الباقي مصفوفة فارغة.
- اجعل جميع النصوص باللغة العربية الفصحى المبسّطة المناسبة لعمر الطلاب في هذه المرحلة، إلا إذا كانت المادة هي "اللغة الإنجليزية" فاجعل نصوص اللعبة والورقة بالإنجليزية.
- لا تنسخ نص الكتاب حرفيًا؛ أعد صياغة الأفكار بأسلوبك.
- اجعل عدد الأسئلة/الأزواج/العناصر بين 4 و8 عناصر.`;
}
