/*
  app.js
  ------
  ‼️ عدّل هذا السطر فقط بعد نشر الـ Cloudflare Worker (proxy):
  ضع رابط الـ Worker هنا (مثال: https://edu-proxy.your-subdomain.workers.dev)
*/
const PROXY_URL = "https://edu-proxy.YOUR-SUBDOMAIN.workers.dev";

const els = {
  stage: document.getElementById('stage'),
  subject: document.getElementById('subject'),
  images: document.getElementById('images'),
  lessonTitle: document.getElementById('lessonTitle'),
  previewStrip: document.getElementById('preview-strip'),
  generateBtn: document.getElementById('generateBtn'),
  status: document.getElementById('status'),
  results: document.getElementById('results'),
};

let selectedFiles = [];
let lastOutputs = { prep: null, worksheet: null, game: null };

els.images.addEventListener('change', () => {
  selectedFiles = Array.from(els.images.files || []);
  els.previewStrip.innerHTML = '';
  selectedFiles.forEach(file => {
    const url = URL.createObjectURL(file);
    const img = document.createElement('img');
    img.src = url;
    els.previewStrip.appendChild(img);
  });
});

function setStatus(msg, type) {
  els.status.textContent = msg;
  els.status.className = 'status' + (type ? ' ' + type : '');
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* -------- بناء صفحة HTML لتحضير الدرس من بيانات JSON -------- */
function buildLessonPrepHtml(prep, stage, subject) {
  const objectives = (prep.objectives || []).map(o => `<li>${escapeHtml(o)}</li>`).join('');
  const vocabulary = (prep.vocabulary || []).map(v => `<span class="chip">${escapeHtml(v)}</span>`).join('');
  const steps = (prep.steps || []).map((s, i) => `
    <div class="step">
      <div class="step-num">${i + 1}</div>
      <div class="step-body">
        <h4>${escapeHtml(s.title || '')} ${s.duration ? `<span class="dur">(${escapeHtml(s.duration)})</span>` : ''}</h4>
        <p>${escapeHtml(s.description || '')}</p>
      </div>
    </div>`).join('');
  const resources = (prep.resources || []).map(r => `<li>${escapeHtml(r)}</li>`).join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<title>تحضير الدرس - ${escapeHtml(prep.title || '')}</title>
<style>
  body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;background:#f8fafc;margin:0;padding:24px;color:#1e293b}
  .card{max-width:800px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;box-shadow:0 2px 10px rgba(0,0,0,.06)}
  h1{color:#1e40af;margin-top:0}
  .meta{color:#64748b;margin-bottom:18px}
  h3{border-bottom:2px solid #e2e8f0;padding-bottom:6px;color:#0f172a}
  .chip{display:inline-block;background:#dbeafe;color:#1e40af;padding:4px 10px;border-radius:20px;margin:3px;font-size:.85rem}
  .step{display:flex;gap:12px;margin-bottom:14px}
  .step-num{background:#2563eb;color:#fff;border-radius:50%;width:28px;height:28px;
    display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:bold}
  .step-body h4{margin:0 0 4px}
  .dur{color:#64748b;font-weight:normal;font-size:.85rem}
  ul{padding-inline-start:20px}
  @media print{body{background:#fff}.card{box-shadow:none}}
</style></head>
<body>
  <div class="card">
    <h1>${escapeHtml(prep.title || 'تحضير الدرس')}</h1>
    <p class="meta">${escapeHtml(stage)} · ${escapeHtml(subject)}</p>

    <h3>🎯 أهداف التعلم</h3>
    <ul>${objectives}</ul>

    <h3>🗝️ المفردات الأساسية</h3>
    <div>${vocabulary}</div>

    <h3>📚 خطوات الحصة</h3>
    ${steps}

    <h3>🧰 وسائل ومصادر مقترحة</h3>
    <ul>${resources}</ul>

    ${prep.assessment ? `<h3>✅ أسلوب التقويم</h3><p>${escapeHtml(prep.assessment)}</p>` : ''}
  </div>
</body></html>`;
}

/* -------- بناء ورقة العمل القابلة للطباعة -------- */
function buildWorksheetHtml(ws, stage, subject) {
  const mcq = (ws.mcq || []).map((q, i) => `
    <div class="q">
      <p><strong>${i + 1}. ${escapeHtml(q.question)}</strong></p>
      <ul class="opts">
        ${(q.options || []).map(o => `<li>◻ ${escapeHtml(o)}</li>`).join('')}
      </ul>
    </div>`).join('');

  const fillBlank = (ws.fillBlank || []).map((f, i) => `
    <p>${i + 1}. ${escapeHtml(f.sentence)}</p>`).join('');

  const shortAnswer = (ws.shortAnswer || []).map((q, i) => `
    <p>${i + 1}. ${escapeHtml(q)}</p><div class="answer-line"></div>`).join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<title>ورقة عمل - ${escapeHtml(ws.title || '')}</title>
<style>
  body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;margin:0;padding:24px;color:#1e293b}
  .sheet{max-width:800px;margin:0 auto}
  h1{color:#1e40af;text-align:center;margin-bottom:4px}
  .meta{text-align:center;color:#64748b;margin-bottom:6px}
  .name-line{display:flex;justify-content:space-between;margin:18px 0;font-size:.95rem}
  .name-line span{border-bottom:1px solid #94a3b8;flex:1;margin:0 8px;min-height:20px}
  h3{border-bottom:2px solid #e2e8f0;padding-bottom:6px}
  .q{margin-bottom:14px}
  .opts{list-style:none;padding-inline-start:6px}
  .opts li{margin-bottom:4px}
  .answer-line{border-bottom:1px solid #94a3b8;height:22px;margin-bottom:12px}
  .print-btn{display:block;margin:0 auto 18px;background:#2563eb;color:#fff;border:none;
    padding:10px 18px;border-radius:8px;cursor:pointer}
  @media print{.print-btn{display:none}}
</style></head>
<body>
  <div class="sheet">
    <button class="print-btn" onclick="window.print()">🖨️ طباعة</button>
    <h1>${escapeHtml(ws.title || 'ورقة عمل')}</h1>
    <p class="meta">${escapeHtml(stage)} · ${escapeHtml(subject)}</p>
    <div class="name-line">الاسم: <span></span> التاريخ: <span></span></div>
    ${ws.instructions ? `<p><em>${escapeHtml(ws.instructions)}</em></p>` : ''}

    ${mcq ? `<h3>أولاً: اختر الإجابة الصحيحة</h3>${mcq}` : ''}
    ${fillBlank ? `<h3>ثانياً: أكمل الفراغ</h3>${fillBlank}` : ''}
    ${shortAnswer ? `<h3>ثالثاً: أسئلة قصيرة</h3>${shortAnswer}` : ''}
  </div>
</body></html>`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function downloadHtml(filename, htmlString) {
  const blob = new Blob([htmlString], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* -------- تبديل التبويبات -------- */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

document.querySelectorAll('.dl-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target;
    const html = lastOutputs[target];
    if (!html) return;
    const names = { prep: 'lesson-prep.html', worksheet: 'worksheet.html', game: 'game.html' };
    downloadHtml(names[target], html);
  });
});

/* -------- الاستدعاء الرئيسي -------- */
els.generateBtn.addEventListener('click', async () => {
  const stage = els.stage.value;
  const subject = els.subject.value;
  const lessonTitle = els.lessonTitle.value.trim();

  if (!stage || !subject) return setStatus('⚠️ الرجاء اختيار المرحلة والمادة', 'error');
  if (selectedFiles.length === 0) return setStatus('⚠️ الرجاء رفع صورة واحدة على الأقل', 'error');
  if (PROXY_URL.includes('YOUR-SUBDOMAIN')) return setStatus('⚠️ لم يتم ضبط رابط الـ Proxy بعد في app.js (PROXY_URL)', 'error');

  els.generateBtn.disabled = true;
  setStatus('⏳ جاري تحليل الصور وتوليد المحتوى... قد يستغرق ذلك دقيقة');

  try {
    const imagesB64 = await Promise.all(selectedFiles.map(async f => ({
      media_type: f.type || 'image/jpeg',
      data: await fileToBase64(f)
    })));

    const resp = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage, subject, lessonTitle, images: imagesB64 })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error('خطأ من الخادم: ' + resp.status + ' - ' + errText);
    }

    const data = await resp.json();
    const parsed = extractJson(data);

    const prepHtml = buildLessonPrepHtml(parsed.lessonPrep || {}, stage, subject);
    const wsHtml = buildWorksheetHtml(parsed.worksheet || {}, stage, subject);
    const gameHtml = buildGameHtml(parsed.game || {});

    lastOutputs = { prep: prepHtml, worksheet: wsHtml, game: gameHtml };

    document.getElementById('frame-prep').srcdoc = prepHtml;
    document.getElementById('frame-worksheet').srcdoc = wsHtml;
    document.getElementById('frame-game').srcdoc = gameHtml;

    els.results.classList.remove('hidden');
    setStatus('✅ تم التوليد بنجاح! يمكنك المعاينة والتنزيل من الأسفل', 'ok');
  } catch (err) {
    console.error(err);
    setStatus('❌ حدث خطأ: ' + err.message, 'error');
  } finally {
    els.generateBtn.disabled = false;
  }
});

/* الـ Worker يعيد استجابة Claude API الخام؛ هذه الدالة تستخرج نص JSON من content وتحوّله لكائن */
function extractJson(apiResponse) {
  const textBlock = (apiResponse.content || []).find(b => b.type === 'text');
  if (!textBlock) throw new Error('لم يتم استلام نص من النموذج');
  let raw = textBlock.text.trim();
  raw = raw.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error('تعذّر تحليل استجابة النموذج كـ JSON صالح');
  }
}
