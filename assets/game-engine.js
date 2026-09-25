/*
  game-engine.js
  ---------------
  لماذا محرك جاهز بدل ترك النموذج يكتب JS حرة بالكامل؟
  لأن الطلب يشترط: "لا تكتب pseudocode... كل كود يجب أن يعمل فعليًا".
  توليد JS تفاعلي عشوائي من نموذج لغوي في كل مرة قد ينتج كودًا به أخطاء صياغية
  أو منطقية (خاصة لمنطق السحب والإفلات). لضمان أن اللعبة تعمل 100% في كل مرة،
  النموذج (Claude) يختار فقط "نوع اللعبة" ويولّد "بيانات المحتوى" (أسئلة/أزواج/ترتيب)
  المبنية فعليًا على صور الدرس، بينما محرك اللعبة هنا (مكتوب ومختبر مسبقًا) يحوّل
  هذه البيانات إلى صفحة HTML/CSS/JS كاملة ومستقلة تعمل بدون أي اعتماديات خارجية.

  كل دالة تُرجع سلسلة نصية (string) هي ملف HTML كامل جاهز للتنزيل والرفع على GitHub Pages.
*/

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function gamePageShell(title, bodyContent, extraStyle, extraScript) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  *{box-sizing:border-box}
  body{
    font-family:"Segoe UI",Tahoma,Arial,sans-serif;
    background:linear-gradient(135deg,#eef2ff,#f0fdf4);
    margin:0;padding:20px;color:#1e293b;min-height:100vh;
  }
  .game-wrap{max-width:760px;margin:0 auto;background:#fff;border-radius:18px;
    padding:24px;box-shadow:0 6px 24px rgba(0,0,0,.08)}
  h1{font-size:1.4rem;margin-top:0;text-align:center;color:#1e293b}
  .instructions{color:#64748b;text-align:center;margin-bottom:18px;font-size:.95rem}
  .score-bar{display:flex;justify-content:space-between;align-items:center;
    margin-bottom:16px;font-weight:bold}
  .btn{background:#2563eb;color:#fff;border:none;padding:10px 18px;border-radius:10px;
    cursor:pointer;font-size:.95rem}
  .btn:hover{background:#1e40af}
  .btn.secondary{background:#0f172a}
  .feedback{text-align:center;font-weight:bold;min-height:26px;margin:10px 0}
  .feedback.correct{color:#16a34a}
  .feedback.wrong{color:#dc2626}
  .final-screen{text-align:center;padding:30px 10px}
  ${extraStyle || ""}
</style>
</head>
<body>
  <div class="game-wrap">
    ${bodyContent}
  </div>
  <script>${extraScript || ""}</script>
</body>
</html>`;
}

/* ---------------- 1) لعبة كويز (اختيار من متعدد) ---------------- */
function buildQuizGame(data) {
  const questions = Array.isArray(data.questions) ? data.questions : [];
  const body = `
    <h1>${escapeHtml(data.title || "لعبة الأسئلة")}</h1>
    <p class="instructions">${escapeHtml(data.instructions || "اختر الإجابة الصحيحة لكل سؤال")}</p>
    <div class="score-bar"><span id="qcounter"></span><span id="score">النقاط: 0</span></div>
    <div id="qbox"></div>
    <div class="feedback" id="feedback"></div>
    <div id="final" class="final-screen" style="display:none"></div>
  `;
  const script = `
    const QUESTIONS = ${JSON.stringify(questions)};
    let idx = 0, score = 0;
    const qbox = document.getElementById('qbox');
    const counter = document.getElementById('qcounter');
    const scoreEl = document.getElementById('score');
    const feedback = document.getElementById('feedback');
    const finalBox = document.getElementById('final');

    function render() {
      if (idx >= QUESTIONS.length) return showFinal();
      const q = QUESTIONS[idx];
      counter.textContent = 'السؤال ' + (idx+1) + ' من ' + QUESTIONS.length;
      feedback.textContent = '';
      feedback.className = 'feedback';
      qbox.innerHTML = '<p style="font-size:1.1rem;font-weight:600">' + q.question + '</p>' +
        '<div style="display:grid;gap:10px;margin-top:12px">' +
        q.options.map((opt, i) =>
          '<button class="btn" style="background:#f1f5f9;color:#1e293b;text-align:right" data-i="'+i+'">' + opt + '</button>'
        ).join('') + '</div>';
      qbox.querySelectorAll('button[data-i]').forEach(btn => {
        btn.addEventListener('click', () => onAnswer(parseInt(btn.dataset.i), q));
      });
    }

    function onAnswer(i, q) {
      const correct = i === q.correctIndex;
      if (correct) { score++; feedback.textContent = '✅ إجابة صحيحة!'; feedback.className = 'feedback correct'; }
      else { feedback.textContent = '❌ غير صحيحة. الصحيح: ' + q.options[q.correctIndex]; feedback.className = 'feedback wrong'; }
      scoreEl.textContent = 'النقاط: ' + score;
      qbox.querySelectorAll('button[data-i]').forEach(b => b.disabled = true);
      setTimeout(() => { idx++; render(); }, 1200);
    }

    function showFinal() {
      qbox.innerHTML = '';
      counter.textContent = '';
      feedback.textContent = '';
      finalBox.style.display = 'block';
      finalBox.innerHTML = '<h2>🎉 انتهت اللعبة!</h2><p>نتيجتك: ' + score + ' من ' + QUESTIONS.length + '</p>' +
        '<button class="btn" onclick="location.reload()">إعادة المحاولة</button>';
    }
    render();
  `;
  return gamePageShell(data.title || "لعبة الأسئلة", body, "", script);
}

/* ---------------- 2) لعبة مطابقة (Matching) ---------------- */
function buildMatchingGame(data) {
  const pairs = Array.isArray(data.pairs) ? data.pairs : [];
  const body = `
    <h1>${escapeHtml(data.title || "لعبة المطابقة")}</h1>
    <p class="instructions">${escapeHtml(data.instructions || "اضغط على عنصر من اليمين ثم العنصر المطابق له من اليسار")}</p>
    <div class="score-bar"><span id="matched">0 / ${pairs.length}</span><span id="score">النقاط: 0</span></div>
    <div style="display:flex;gap:20px">
      <div id="colLeft" style="flex:1;display:flex;flex-direction:column;gap:8px"></div>
      <div id="colRight" style="flex:1;display:flex;flex-direction:column;gap:8px"></div>
    </div>
    <div class="feedback" id="feedback"></div>
    <div id="final" class="final-screen" style="display:none"></div>
  `;
  const script = `
    const PAIRS = ${JSON.stringify(pairs)};
    let matchedCount = 0, score = 0, selLeft = null, selRight = null;

    function shuffle(arr){return arr.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(v=>v[1]);}

    const leftItems = shuffle(PAIRS.map((p,i)=>({id:i, text:p.left})));
    const rightItems = shuffle(PAIRS.map((p,i)=>({id:i, text:p.right})));

    const colLeft = document.getElementById('colLeft');
    const colRight = document.getElementById('colRight');
    const feedback = document.getElementById('feedback');
    const matchedEl = document.getElementById('matched');
    const scoreEl = document.getElementById('score');
    const finalBox = document.getElementById('final');

    function makeBtn(item, side){
      const b = document.createElement('button');
      b.className = 'btn';
      b.style.background = '#f1f5f9';
      b.style.color = '#1e293b';
      b.textContent = item.text;
      b.dataset.id = item.id;
      b.addEventListener('click', () => selectItem(item.id, side, b));
      return b;
    }
    leftItems.forEach(it => colLeft.appendChild(makeBtn(it,'left')));
    rightItems.forEach(it => colRight.appendChild(makeBtn(it,'right')));

    function selectItem(id, side, btn){
      if (btn.disabled) return;
      if (side === 'left') {
        if (selLeft) selLeft.el.style.outline = '';
        selLeft = {id, el: btn};
        btn.style.outline = '3px solid #2563eb';
      } else {
        if (selRight) selRight.el.style.outline = '';
        selRight = {id, el: btn};
        btn.style.outline = '3px solid #2563eb';
      }
      if (selLeft && selRight) checkMatch();
    }

    function checkMatch(){
      if (selLeft.id === selRight.id) {
        selLeft.el.style.background = '#bbf7d0';
        selRight.el.style.background = '#bbf7d0';
        selLeft.el.disabled = true;
        selRight.el.disabled = true;
        selLeft.el.style.outline = '';
        selRight.el.style.outline = '';
        matchedCount++; score += 10;
        feedback.textContent = '✅ مطابقة صحيحة!';
        feedback.className = 'feedback correct';
        matchedEl.textContent = matchedCount + ' / ' + PAIRS.length;
        scoreEl.textContent = 'النقاط: ' + score;
        if (matchedCount === PAIRS.length) setTimeout(showFinal, 700);
      } else {
        feedback.textContent = '❌ غير متطابقين، حاول مرة أخرى';
        feedback.className = 'feedback wrong';
        selLeft.el.style.outline = '';
        selRight.el.style.outline = '';
      }
      selLeft = null; selRight = null;
    }

    function showFinal(){
      document.getElementById('colLeft').style.display='none';
      document.getElementById('colRight').style.display='none';
      feedback.textContent='';
      finalBox.style.display='block';
      finalBox.innerHTML = '<h2>🎉 أحسنت! أكملت المطابقة</h2><p>نتيجتك: ' + score + ' نقطة</p>' +
        '<button class="btn" onclick="location.reload()">إعادة المحاولة</button>';
    }
  `;
  return gamePageShell(data.title || "لعبة المطابقة", body, "", script);
}

/* ---------------- 3) لعبة ترتيب بالسحب والإفلات (Drag & Drop Ordering) ---------------- */
function buildDragDropGame(data) {
  const items = Array.isArray(data.items) ? data.items : [];
  const body = `
    <h1>${escapeHtml(data.title || "لعبة الترتيب")}</h1>
    <p class="instructions">${escapeHtml(data.instructions || "اسحب العناصر ورتّبها بالترتيب الصحيح ثم اضغط تحقق")}</p>
    <ul id="sortList" style="list-style:none;padding:0;display:flex;flex-direction:column;gap:10px"></ul>
    <div style="text-align:center;margin-top:14px">
      <button class="btn" id="checkBtn">✅ تحقق من الترتيب</button>
    </div>
    <div class="feedback" id="feedback"></div>
    <div id="final" class="final-screen" style="display:none"></div>
  `;
  const extraStyle = `
    #sortList li{
      background:#f1f5f9;border:2px solid #e2e8f0;border-radius:10px;
      padding:12px 16px;cursor:grab;font-weight:600;user-select:none;
    }
    #sortList li.dragging{opacity:.5}
    #sortList li.correct{background:#bbf7d0;border-color:#16a34a}
    #sortList li.wrong{background:#fecaca;border-color:#dc2626}
  `;
  const script = `
    const ITEMS = ${JSON.stringify(items)};
    const CORRECT_ORDER = ${JSON.stringify(data.correctOrder || items.map(i => i.id))};

    function shuffle(arr){return arr.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(v=>v[1]);}

    const list = document.getElementById('sortList');
    let shuffled = shuffle(ITEMS.slice());
    shuffled.forEach(it => {
      const li = document.createElement('li');
      li.textContent = it.label;
      li.draggable = true;
      li.dataset.id = it.id;
      list.appendChild(li);
    });

    let dragEl = null;
    list.addEventListener('dragstart', e => {
      dragEl = e.target;
      e.target.classList.add('dragging');
    });
    list.addEventListener('dragend', e => e.target.classList.remove('dragging'));
    list.addEventListener('dragover', e => {
      e.preventDefault();
      const afterEl = getDragAfterElement(list, e.clientY);
      if (afterEl == null) list.appendChild(dragEl);
      else list.insertBefore(dragEl, afterEl);
    });
    function getDragAfterElement(container, y) {
      const els = [...container.querySelectorAll('li:not(.dragging)')];
      return els.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height/2;
        if (offset < 0 && offset > closest.offset) return {offset, element: child};
        return closest;
      }, {offset: -Infinity}).element;
    }

    document.getElementById('checkBtn').addEventListener('click', () => {
      const current = [...list.querySelectorAll('li')].map(li => li.dataset.id);
      const isCorrect = JSON.stringify(current) === JSON.stringify(CORRECT_ORDER);
      const feedback = document.getElementById('feedback');
      [...list.querySelectorAll('li')].forEach((li, i) => {
        li.classList.remove('correct','wrong');
        li.classList.add(li.dataset.id === CORRECT_ORDER[i] ? 'correct' : 'wrong');
      });
      if (isCorrect) {
        feedback.textContent = '🎉 ممتاز! الترتيب صحيح تمامًا';
        feedback.className = 'feedback correct';
        document.getElementById('checkBtn').style.display = 'none';
        document.getElementById('final').style.display = 'block';
        document.getElementById('final').innerHTML = '<button class="btn" onclick="location.reload()">إعادة المحاولة</button>';
      } else {
        feedback.textContent = '❌ الترتيب غير صحيح بعد، حاول مرة أخرى (الأخضر = صحيح)';
        feedback.className = 'feedback wrong';
      }
    });
  `;
  return gamePageShell(data.title || "لعبة الترتيب", body, extraStyle, script);
}

/* دالة موحدة: تبني ملف اللعبة الكامل حسب النوع الذي اختاره النموذج */
function buildGameHtml(gameData) {
  const type = (gameData.type || "quiz").toLowerCase();
  if (type === "matching") return buildMatchingGame(gameData);
  if (type === "dragdrop" || type === "ordering") return buildDragDropGame(gameData);
  return buildQuizGame(gameData);
}
