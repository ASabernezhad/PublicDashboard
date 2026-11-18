(function(){
  'use strict';

  // ====== کلیدهای localStorage ======
  const CONFIG_KEY = 'publicdashboard_config';
  const LOGS_KEY = 'publicdashboard_logs';

  // ====== تنظیمات پویا ======
  let CONFIG = {
    name: '',
    mode: 'dynamic',
    lessons: [],
    endDate: { jy: 1405, jm: 12, jd: 29 }
  };
  let state = { logs: [] };

  // ====== توابع تاریخ ======
  function jToG(jy, jm, jd){
    var gy = (jy <= 979) ? 621 : 1600;
    jy -= (jy <= 979) ? 0 : 979;
    var days = (365*jy) + (Math.floor(jy/33)*8) + Math.floor(((jy%33)+3)/4) + 78 + jd
             + ((jm < 7) ? (jm-1)*31 : ((jm-7)*30)+186);
    gy += 400*Math.floor(days/146097); days %= 146097;
    if(days > 36524){
      gy += 100*Math.floor(--days/36524); days %= 36524;
      if(days >= 365) days++;
    }
    gy += 4*Math.floor(days/1461); days %= 1461;
    if(days > 365){ gy += Math.floor((days-1)/365); days = (days-1)%365; }
    var gd = days + 1;
    var sal_a = [0,31,((gy%4===0 && gy%100!==0) || gy%400===0) ? 29:28,31,30,31,30,31,31,30,31,30,31];
    var gm;
    for(gm=1; gm<=12; gm++){
      if(gd <= sal_a[gm]) break;
      gd -= sal_a[gm];
    }
    return new Date(gy, gm-1, gd);
  }

  function gToJ(gy, gm, gd) {
    var g_d_m = [0,31,59,90,120,151,181,212,243,273,304,334];
    var jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 621 : 1600;
    var gy2 = (gm > 2) ? (gy + 1) : gy;
    var days = (365 * gy) + (Math.floor((gy2 + 3) / 4)) - (Math.floor((gy2 + 99) / 100))
             + (Math.floor((gy2 + 399) / 400)) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * (Math.floor(days / 12053));
    days %= 12053;
    jy += 4 * (Math.floor(days / 1461));
    days %= 1461;
    jy += Math.floor((days - 1) / 365);
    if (days > 365) days = (days - 1) % 365;
    var jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    var jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return { jy: jy, jm: jm, jd: jd };
  }

  function pad(n){ return n < 10 ? '0'+n : ''+n; }
  function toDateStr(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
  function todayStr(){ return toDateStr(new Date()); }
  function daysBetween(from, to){
    var a = new Date(from); a.setHours(0,0,0,0);
    var b = new Date(to); b.setHours(0,0,0,0);
    return Math.round((b - a) / 86400000);
  }
  function faDigits(str){ return String(str).replace(/[0-9]/g, function(d){ return '۰۱۲۳۴۵۶۷۸۹'[+d]; }); }
  function fmtFa(n, dec){
    dec = dec || 0;
    if(typeof n !== 'number' || !isFinite(n)) n = 0;
    try{
      return n.toLocaleString('fa-IR', { 
        minimumFractionDigits: dec, 
        maximumFractionDigits: dec,
        useGrouping: false
      });
    }catch(e){ return faDigits(n.toFixed(dec)); }
  }
  function pctExact(done, total){ return total ? (done/total)*100 : 0; }
  function pctLabel(done, total){ return fmtFa(pctExact(done,total), 1) + '٪'; }

  function getEndDate(){ return jToG(CONFIG.endDate.jy, CONFIG.endDate.jm, CONFIG.endDate.jd); }
  function getJalaliDayOfWeek(jy, jm, jd) {
    return (jToG(jy, jm, jd).getDay() + 1) % 7;
  }

  // ====== ذخیره و بارگذاری ======
  function loadConfig(){
    try {
      var raw = localStorage.getItem(CONFIG_KEY);
      if (raw) CONFIG = JSON.parse(raw);
    } catch(e) {}
  }
  function saveConfig(){
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(CONFIG)); } catch(e) {}
  }
  function loadLogs(){
    try {
      var raw = localStorage.getItem(LOGS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) state.logs = parsed;
      }
    } catch(e) {}
  }
  function saveLogs(){
    try { localStorage.setItem(LOGS_KEY, JSON.stringify(state.logs)); } catch(e) {}
  }

  function hasConfig(){
    return CONFIG.lessons && CONFIG.lessons.length > 0;
  }

  // ====== محاسبات ======
  function grandTotal(){
    return CONFIG.lessons.reduce(function(s,l){ return s + (Number(l.total)||0); }, 0);
  }
  function donePerLesson(){
    var map = {};
    CONFIG.lessons.forEach(function(l){ map[l.id] = 0; });
    state.logs.forEach(function(lg){
      if(map[lg.lessonId] !== undefined) map[lg.lessonId] += (Number(lg.done)||0);
    });
    return map;
  }
  function remainingPerLesson(){
    var done = donePerLesson();
    var map = {};
    CONFIG.lessons.forEach(function(l){ map[l.id] = Math.max(0, (Number(l.total)||0) - done[l.id]); });
    return map;
  }
  function totalRemaining(){
    var r = remainingPerLesson();
    return CONFIG.lessons.reduce(function(s,l){ return s + r[l.id]; }, 0);
  }
  function totalDone(){ return grandTotal() - totalRemaining(); }
  function remainingDays(){
    var from = new Date(); from.setHours(0,0,0,0);
    var end = getEndDate(); end.setHours(0,0,0,0);
    return Math.max(0, daysBetween(from, end));
  }
  function perLessonDailyTarget(){
    var days = Math.max(1, remainingDays());
    if (CONFIG.mode === 'manual') {
      var map = {};
      CONFIG.lessons.forEach(function(l){
        map[l.id] = Number(l.dailyTarget) || 0;
      });
      return map;
    }
    var rem = remainingPerLesson();
    var map2 = {};
    CONFIG.lessons.forEach(function(l){
      map2[l.id] = Math.ceil(rem[l.id] / days);
    });
    return map2;
  }
  function todayDoneByLesson(){
    var t = todayStr(), map = {};
    CONFIG.lessons.forEach(function(l){ map[l.id] = 0; });
    state.logs.filter(function(lg){ return lg.date === t; }).forEach(function(lg){
      map[lg.lessonId] = (map[lg.lessonId]||0) + (Number(lg.done)||0);
    });
    return map;
  }
  function statusPerLesson(){
    var targets = perLessonDailyTarget();
    var today = todayDoneByLesson();
    var map = {};
    CONFIG.lessons.forEach(function(l){
      var done = today[l.id], target = targets[l.id];
      map[l.id] = { target: target, done: done, diff: done - target };
    });
    return map;
  }

  // ====== استریک ======
  function activeSet(){ return new Set(state.logs.map(function(lg){ return lg.date; })); }
  function calcCurrentStreak(){
    var set = activeSet();
    var cur = new Date(); cur.setHours(0,0,0,0);
    if(!set.has(toDateStr(cur))) cur.setDate(cur.getDate() - 1);
    var n = 0;
    while(set.has(toDateStr(cur))){ n++; cur.setDate(cur.getDate() - 1); }
    return n;
  }

  // ====== انتخاب سریع تاریخ (منوی کشویی) ======
  const DATE_MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];

  function daysInJalaliMonth(jy, jm) {
    if (jm >= 1 && jm <= 6) return 31;
    if (jm >= 7 && jm <= 11) return 30;
    var testG = jToG(jy, 12, 30);
    var backJ = gToJ(testG.getFullYear(), testG.getMonth() + 1, testG.getDate());
    return (backJ.jm === 12 && backJ.jd === 30) ? 30 : 29;
  }

  function fillDateSelects(prefix) {
    var yearInput = document.getElementById(prefix + '-year');
    var monthSel = document.getElementById(prefix + '-month');
    var dayInput = document.getElementById(prefix + '-day');
    if (!yearInput || !monthSel || !dayInput) return;

    // فقط ماه کشوییه
    var monthsHtml = '';
    for (var m = 1; m <= 12; m++) {
      monthsHtml += '<option value="' + m + '">' + DATE_MONTHS[m - 1] + '</option>';
    }
    monthSel.innerHTML = monthsHtml;
  }
  // تبدیل عدد فارسی به لاتین
  function faToEn(str) {
    if (!str) return '';
    return String(str).replace(/[۰-۹]/g, function(d) {
      return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d);
    });
  }
  function readDateSelects(prefix) {
    var yearInput = document.getElementById(prefix + '-year').value;
    var dayInput = document.getElementById(prefix + '-day').value;
    
    // تبدیل فارسی به لاتین
    var yearVal = parseInt(faToEn(yearInput));
    var monthVal = parseInt(document.getElementById(prefix + '-month').value);
    var dayVal = parseInt(faToEn(dayInput));
    
    if (!yearVal || yearVal < 1300 || yearVal > 1500) yearVal = 1405;
    if (!monthVal || monthVal < 1 || monthVal > 12) monthVal = 12;
    if (!dayVal || dayVal < 1 || dayVal > 31) dayVal = 29;
    
    var maxDays = daysInJalaliMonth(yearVal, monthVal);
    if (dayVal > maxDays) dayVal = maxDays;
    
    return { jy: yearVal, jm: monthVal, jd: dayVal };
  }

  function setDateSelects(prefix, date) {
    var yearInput = document.getElementById(prefix + '-year');
    var monthSel = document.getElementById(prefix + '-month');
    var dayInput = document.getElementById(prefix + '-day');
    if (!yearInput || !monthSel || !dayInput) return;

    // نمایش فارسی
    yearInput.value = faDigits(date.jy);
    monthSel.value = date.jm;
    dayInput.value = faDigits(Math.min(date.jd, daysInJalaliMonth(date.jy, date.jm)));
  }

  // ====== تقویم ======
  let currentCalJY = 1403;
  let currentCalJM = 1;
  let selectedDate = '';

  function renderCalendar() {
    var el = document.getElementById('cal-title');
    var grid = document.getElementById('cal-grid');
    if(!el || !grid) return;

    var dailyTotals = {};
    state.logs.forEach(function(lg){
      dailyTotals[lg.date] = (dailyTotals[lg.date]||0) + (Number(lg.done)||0);
    });
    var values = Object.values(dailyTotals);
    var maxVal = values.length > 0 ? Math.max.apply(null, values) : 0;
    if (maxVal === 0) maxVal = 1;
    function getLevel(count) {
      if (count === 0) return 0;
      var ratio = count / maxVal;
      if (ratio < 0.15) return 1;
      if (ratio < 0.4) return 2;
      if (ratio < 0.7) return 3;
      return 4;
    }

    var monthNames = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
    el.textContent = monthNames[currentCalJM - 1] + ' ' + faDigits(currentCalJY);
    grid.innerHTML = '';

    var firstDayOfWeek = getJalaliDayOfWeek(currentCalJY, currentCalJM, 1);
    var daysInMonth = 31;
    if (currentCalJM >= 7 && currentCalJM <= 11) daysInMonth = 30;
    if (currentCalJM === 12) {
      var testG = jToG(currentCalJY, 12, 30);
      var backJ = gToJ(testG.getFullYear(), testG.getMonth() + 1, testG.getDate());
      daysInMonth = (backJ.jm === 12 && backJ.jd === 30) ? 30 : 29;
    }

    for (var i = 0; i < firstDayOfWeek; i++) {
      var empty = document.createElement('div');
      empty.className = 'cal-day empty';
      grid.appendChild(empty);
    }

    for (var d = 1; d <= daysInMonth; d++) {
      (function(dayNum){
        var dayEl = document.createElement('div');
        dayEl.className = 'cal-day';
        dayEl.textContent = fmtFa(dayNum);
        var gDate = jToG(currentCalJY, currentCalJM, dayNum);
        var dateStr = toDateStr(gDate);
        var count = dailyTotals[dateStr] || 0;
        var level = getLevel(count);
        dayEl.classList.add('heat-' + level);
        if (dateStr === todayStr()) dayEl.classList.add('today');
        if (dateStr === selectedDate) dayEl.classList.add('selected');

        dayEl.addEventListener('click', function() {
          selectedDate = dateStr;
          var dateInput = document.getElementById('f-date');
          if (dateInput) {
            dateInput.value = fmtFa(dayNum) + ' ' + monthNames[currentCalJM - 1] + ' ' + faDigits(currentCalJY);
          }
          renderCalendar();
        });
        grid.appendChild(dayEl);
      })(d);
    }
  }

  // ====== رندر ======
  function renderCountdown(){
    var d = remainingDays();
    document.getElementById('cd-days').textContent = fmtFa(d);
    var endJ = CONFIG.endDate;
    var monthNames = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
    document.getElementById('cd-label').textContent =
      'روز تا ' + fmtFa(endJ.jd) + ' ' + monthNames[endJ.jm - 1] + ' ' + faDigits(endJ.jy);
  }

  function renderStats(){
    var rem = totalRemaining();
    var d = remainingDays();
    var daily = d > 0 ? Math.ceil(rem/d) : rem;
    var doneTotal = totalDone();
    var gt = grandTotal();

    document.getElementById('stats').innerHTML =
      '<div class="stat"><div class="label">کل باقی‌مانده</div><div class="value blue">' + fmtFa(rem) + '</div></div>' +
      '<div class="stat"><div class="label">روز باقی‌مانده</div><div class="value">' + fmtFa(d) + '</div></div>' +
      '<div class="stat"><div class="label">هدف روزانه</div><div class="value yellow">' + fmtFa(daily) + '</div></div>' +
      '<div class="stat"><div class="label">پیشرفت</div><div class="value green">' + pctLabel(doneTotal, gt) + '</div></div>';
  }

  function renderChart(){
    var canvas = document.getElementById('progressChart');
    if(!canvas || typeof Chart === 'undefined') return;
    
    var done = donePerLesson();
    var labels = CONFIG.lessons.map(function(l){ return l.name; });
    var dataDone = CONFIG.lessons.map(function(l){ return done[l.id]; });
    var dataRem = CONFIG.lessons.map(function(l){ return Math.max(0, (Number(l.total)||0) - done[l.id]); });
    
    var textColor = '#e8eefc';

    if(window._chart) window._chart.destroy();
    
    window._chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { 
            label: 'انجام‌شده', 
            data: dataDone, 
            backgroundColor: 'rgba(139,92,246,.85)', 
            borderRadius: 8,
            borderSkipped: false
          },
          { 
            label: 'باقی‌مانده', 
            data: dataRem, 
            backgroundColor: 'rgba(148,163,184,.35)', 
            borderRadius: 8,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1000, easing: 'easeOutQuart' },
        plugins: {
          legend: {
            labels: {
              color: textColor,
              font: { family: 'Pinar-VF, Tahoma', size: 13, weight: '700' },
              padding: 15,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,.95)',
            padding: 14,
            cornerRadius: 10,
            titleFont: { family: 'Pinar-VF, Tahoma', size: 14, weight: '700' },
            bodyFont: { family: 'Pinar-VF, Tahoma', size: 13 },
            displayColors: true,
            callbacks: {
              title: function(items) { return items[0].label; },
              label: function(context) {
                return context.dataset.label + ': ' + fmtFa(context.parsed.y) + ' تست';
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            ticks: {
              color: textColor,
              font: { family: 'Pinar-VF, Tahoma', size: 12, weight: '600' }
            },
            grid: { display: false },
            border: { display: false }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              color: textColor,
              font: { family: 'Pinar-VF, Tahoma', size: 12 },
              callback: function(value) {
                return fmtFa(value);
              }
            },
            grid: { color: 'rgba(148,163,184,.12)' },
            border: { display: false }
          }
        }
      }
    });
  }
  function renderCards(){
    var rem = remainingPerLesson();
    var done = donePerLesson();
    var status = statusPerLesson();

    document.getElementById('cards').innerHTML = CONFIG.lessons.map(function(l){
      var pct = pctExact(done[l.id], l.total);
      var s = status[l.id];
      var cls = 'b', txt = 'روی برنامه';
      if(s.diff > 0){ cls='g'; txt='+' + fmtFa(s.diff) + ' جلو'; }
      else if(s.diff < 0){ cls='r'; txt=fmtFa(s.diff) + ' عقب'; }

      return '<div class="card">' +
        '<div class="name">' + l.name + '</div>' +
        '<div class="rem">' + fmtFa(rem[l.id]) + ' باقی از ' + fmtFa(l.total) + '</div>' +
        '<div class="bar"><div class="bar-fill" style="width:' + Math.min(100, pct).toFixed(2) + '%"></div></div>' +
        '<div class="pct-tiny">' + pctLabel(done[l.id], l.total) + ' پیشرفت</div>' +
        '<div class="row"><span class="k">هدف امروز</span><span>' + fmtFa(s.target) + '</span></div>' +
        '<div class="row"><span class="k">امروز زدی</span><span>' + fmtFa(s.done) + '</span></div>' +
        '<div class="row"><span class="k">وضعیت</span><span class="pill ' + cls + '">' + txt + '</span></div>' +
      '</div>';
    }).join('');
  }

  function renderForm(){
    var sel = document.getElementById('f-lesson');
    if(sel){
      sel.innerHTML = CONFIG.lessons.map(function(l){
        return '<option value="' + l.id + '">' + l.name + '</option>';
      }).join('');
    }
    var dateInput = document.getElementById('f-date');
    if(dateInput && !dateInput.value){
      selectedDate = todayStr();
      var now = new Date();
      var jNow = gToJ(now.getFullYear(), now.getMonth() + 1, now.getDate());
      var monthNames = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
      dateInput.value = fmtFa(jNow.jd) + ' ' + monthNames[jNow.jm - 1] + ' ' + faDigits(jNow.jy);
    }
  }

  function renderLogs(){
    var el = document.getElementById('logs');
    if(!el) return;
    if(state.logs.length === 0){
      el.innerHTML = '<div style="color:#94a3b8;font-size:13px;text-align:center;padding:24px;">هنوز چیزی ثبت نکردی.</div>';
      return;
    }
    var sorted = state.logs.slice().sort(function(a,b){
      return (b.date||'').localeCompare(a.date||'') || (b.id - a.id);
    });
    el.innerHTML = sorted.map(function(lg){
      var l = CONFIG.lessons.find(function(x){ return x.id === lg.lessonId; });
      var name = l ? l.name : lg.lessonId;
      return '<div class="log-item">' +
        '<div style="flex:1;">' +
          '<div><b>' + name + '</b> — ' + fmtFa(Number(lg.done)||0) + ' تست</div>' +
          '<div class="meta">📅 ' + faDigits(lg.date) + '</div>' +
        '</div>' +
        '<button class="del" data-id="' + (Number(lg.id)||0) + '">🗑️</button>' +
      '</div>';
    }).join('');
    el.querySelectorAll('.del').forEach(function(btn){
      btn.addEventListener('click', function(){ deleteLog(Number(btn.getAttribute('data-id'))); });
    });
  }

  function renderAll(){
    try{ renderCountdown(); } catch(e){ console.warn(e); }
    try{ renderStats(); } catch(e){ console.warn(e); }
    try{ renderChart(); } catch(e){ console.warn(e); }
    try{ renderCalendar(); } catch(e){ console.warn(e); }
    try{ renderCards(); } catch(e){ console.warn(e); }
    try{ renderForm(); } catch(e){ console.warn(e); }
    try{ renderLogs(); } catch(e){ console.warn(e); }

    try{
      var now = new Date();
      var jNow = gToJ(now.getFullYear(), now.getMonth() + 1, now.getDate());
      var weekdays = ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه'];
      var monthNamesFull = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
      document.getElementById('todayLabel').textContent =
        weekdays[now.getDay()] + ' ' + fmtFa(jNow.jd) + ' ' + monthNamesFull[jNow.jm - 1] + ' ' + faDigits(jNow.jy);
    }catch(e){}

    document.getElementById('streakBig').textContent = fmtFa(calcCurrentStreak());
  }

  // ====== Toast ======
  function toast(msg, color){
    var t = document.getElementById('toast');
    if(!t) return;
    t.textContent = msg;
    t.style.background = color || 'linear-gradient(135deg,#22c55e,#16a34a)';
    t.classList.add('show');
    setTimeout(function(){ t.classList.remove('show'); }, 2000);
  }

  // ====== اکشن‌ها ======
  function addLog(){
    var sel = document.getElementById('f-lesson');
    var inp = document.getElementById('f-done');
    if(!sel || !inp) return;
    var lessonId = sel.value;
    var done = parseInt(inp.value, 10);
    if(!lessonId || !isFinite(done) || done <= 0){
      toast('تعداد تست باید بیشتر از صفر باشه', 'linear-gradient(135deg,#ef4444,#b91c1c)');
      return;
    }
    state.logs.push({
      id: Date.now() + Math.floor(Math.random()*1000),
      date: selectedDate || todayStr(),
      lessonId: lessonId,
      done: done
    });
    saveLogs();
    inp.value = '';
    renderAll();
    toast('✅ ثبت شد');
  }

  function deleteLog(id){
    if(!confirm('این گزارش حذف بشه؟')) return;
    state.logs = state.logs.filter(function(lg){ return Number(lg.id) !== Number(id); });
    saveLogs();
    renderAll();
    toast('🗑️ حذف شد', 'linear-gradient(135deg,#ef4444,#b91c1c)');
  }

  function exportCSV() {
    if(state.logs.length === 0) { toast('خالیه', 'linear-gradient(135deg,#ef4444,#b91c1c)'); return; }
    var csv = '\uFEFF';
    csv += 'ردیف,تاریخ,درس,تعداد تست\n';
    var sorted = state.logs.slice().sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); });
    sorted.forEach(function(lg, index) {
      var l = CONFIG.lessons.find(function(x){ return x.id === lg.lessonId; });
      csv += (index+1) + ',' + lg.date + ',' + (l ? l.name : lg.lessonId) + ',' + lg.done + '\n';
    });
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'backup_' + todayStr() + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('📥 دانلود شد');
  }

  // ====== Onboarding ======
  let onboardingLessons = [];

  function getOnbMode(){
    var r = document.querySelector('input[name="goal-mode"]:checked');
    return r ? r.value : 'dynamic';
  }

  function renderOnbLessons(){
    var el = document.getElementById('onb-lessons');
    var mode = getOnbMode();
    el.innerHTML = onboardingLessons.map(function(l, i){
      var manualField = '';
      if (mode === 'manual') {
        manualField = '<div class="daily-target-input">' +
          '<input type="number" placeholder="هدف روزانه" value="' + (l.dailyTarget || '') + '" data-idx="' + i + '" data-field="dailyTarget" min="1">' +
          '<span>تست/روز</span>' +
        '</div>';
      }
      return '<div class="lesson-row' + (mode === 'manual' ? ' manual-mode' : '') + '">' +
        '<input type="text" placeholder="اسم درس" value="' + (l.name||'') + '" data-idx="' + i + '" data-field="name">' +
        '<input type="number" placeholder="تعداد کل" value="' + (l.total||'') + '" data-idx="' + i + '" data-field="total" min="1">' +
        manualField +
        '<button class="remove-lesson" data-idx="' + i + '">✕</button>' +
      '</div>';
    }).join('');

    el.querySelectorAll('input').forEach(function(inp){
      inp.addEventListener('input', function(){
        var idx = +inp.getAttribute('data-idx');
        var field = inp.getAttribute('data-field');
        if (field === 'total' || field === 'dailyTarget') {
          onboardingLessons[idx][field] = parseInt(inp.value) || 0;
        } else {
          onboardingLessons[idx][field] = inp.value;
        }
      });
    });
    el.querySelectorAll('.remove-lesson').forEach(function(btn){
      btn.addEventListener('click', function(){
        onboardingLessons.splice(+btn.getAttribute('data-idx'), 1);
        renderOnbLessons();
      });
    });
  }

  function showOnboarding(){
    document.getElementById('onboarding').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
    onboardingLessons = [
      { id: 'lesson1', name: '', total: 0 },
      { id: 'lesson2', name: '', total: 0 }
    ];
    renderOnbLessons();
  }

  function completeOnboarding(){
    var name = document.getElementById('onb-name').value.trim();
    var endDate = readDateSelects('onb');
    var jy = endDate.jy;
    var jm = endDate.jm;
    var jd = endDate.jd;
    var mode = getOnbMode();

    var validLessons = onboardingLessons.filter(function(l){
      if (!l.name || !l.name.trim() || !l.total || l.total <= 0) return false;
      if (mode === 'manual' && (!l.dailyTarget || l.dailyTarget <= 0)) return false;
      return true;
    }).map(function(l){
      var out = { 
        id: 'l' + Date.now() + Math.random().toString(36).slice(2,6), 
        name: l.name.trim(), 
        total: l.total 
      };
      if (mode === 'manual') out.dailyTarget = l.dailyTarget;
      return out;
    });

    if(validLessons.length === 0){
      var msg = mode === 'manual' 
        ? 'هر درس باید اسم، تعداد کل و هدف روزانه داشته باشه' 
        : 'حداقل یه درس با تعداد تست وارد کن';
      toast(msg, 'linear-gradient(135deg,#ef4444,#b91c1c)');
      return;
    }

    CONFIG = {
      name: name,
      mode: mode,
      lessons: validLessons,
      endDate: { jy: jy, jm: jm, jd: jd }
    };
    saveConfig();
    document.getElementById('onboarding').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    if(name) document.getElementById('app-title').textContent = '🎯 داشبورد ' + name;
    renderAll();
  }

  // ====== تنظیمات ======
  let settingsLessons = [];

  function getSetMode(){
    var r = document.querySelector('input[name="set-goal-mode"]:checked');
    return r ? r.value : 'dynamic';
  }

  function renderSettingsLessons(){
    var el = document.getElementById('set-lessons');
    var mode = getSetMode();
    el.innerHTML = settingsLessons.map(function(l, i){
      var manualField = '';
      if (mode === 'manual') {
        manualField = '<div class="daily-target-input">' +
          '<input type="number" value="' + (l.dailyTarget || '') + '" data-idx="' + i + '" data-field="dailyTarget" min="1">' +
          '<span>تست/روز</span>' +
        '</div>';
      }
      return '<div class="lesson-row' + (mode === 'manual' ? ' manual-mode' : '') + '">' +
        '<input type="text" value="' + (l.name||'') + '" data-idx="' + i + '" data-field="name">' +
        '<input type="number" value="' + (l.total||'') + '" data-idx="' + i + '" data-field="total" min="1">' +
        manualField +
        '<button class="remove-lesson" data-idx="' + i + '">✕</button>' +
      '</div>';
    }).join('');
    el.querySelectorAll('input').forEach(function(inp){
      inp.addEventListener('input', function(){
        var idx = +inp.getAttribute('data-idx');
        var field = inp.getAttribute('data-field');
        if (field === 'total' || field === 'dailyTarget') {
          settingsLessons[idx][field] = parseInt(inp.value) || 0;
        } else {
          settingsLessons[idx][field] = inp.value;
        }
      });
    });
    el.querySelectorAll('.remove-lesson').forEach(function(btn){
      btn.addEventListener('click', function(){
        settingsLessons.splice(+btn.getAttribute('data-idx'), 1);
        renderSettingsLessons();
      });
    });
  }

  function openSettings(){
    settingsLessons = CONFIG.lessons.map(function(l){ 
      return { 
        id: l.id, 
        name: l.name, 
        total: l.total,
        dailyTarget: l.dailyTarget || 0
      }; 
    });
    document.getElementById('set-name').value = CONFIG.name || '';
    
    setDateSelects('set', {
      jy: CONFIG.endDate.jy,
      jm: CONFIG.endDate.jm,
      jd: CONFIG.endDate.jd
    });
    
    var modeRadios = document.querySelectorAll('input[name="set-goal-mode"]');
    modeRadios.forEach(function(r){
      r.checked = (r.value === CONFIG.mode);
    });
    
    renderSettingsLessons();
    document.getElementById('settings-modal').style.display = 'flex';
  }

  function saveSettings(){
    var mode = getSetMode();
    CONFIG.name = document.getElementById('set-name').value.trim();
    CONFIG.mode = mode;
    CONFIG.endDate = readDateSelects('set');
    
    var valid = settingsLessons.filter(function(l){
      if (!l.name || !l.name.trim() || !l.total || l.total <= 0) return false;
      if (mode === 'manual' && (!l.dailyTarget || l.dailyTarget <= 0)) return false;
      return true;
    }).map(function(l){
      var out = { id: l.id, name: l.name, total: l.total };
      if (mode === 'manual') out.dailyTarget = l.dailyTarget;
      return out;
    });
    if(valid.length === 0){
      var msg = mode === 'manual' 
        ? 'هر درس باید اسم، تعداد کل و هدف روزانه داشته باشه' 
        : 'حداقل یه درس لازمه';
      toast(msg, 'linear-gradient(135deg,#ef4444,#b91c1c)');
      return;
    }
    CONFIG.lessons = valid;
    saveConfig();
    document.getElementById('settings-modal').style.display = 'none';
    renderAll();
    toast('✅ تنظیمات ذخیره شد');
  }

  function resetAll(){
    if(!confirm('همه داده‌ها پاک بشن؟ این کار برگشت‌پذیر نیست.')) return;
    localStorage.removeItem(CONFIG_KEY);
    localStorage.removeItem(LOGS_KEY);
    location.reload();
  }

  // ====== صفحه معرفی ======
  let introSlide = 0;
  const INTRO_TOTAL = 4;

  function showIntroSlide(idx){
    introSlide = Math.max(0, Math.min(INTRO_TOTAL - 1, idx));
    document.querySelectorAll('.intro-slide').forEach(function(s){
      s.classList.toggle('active', +s.getAttribute('data-slide') === introSlide);
    });
    document.querySelectorAll('.dot').forEach(function(d, i){
      d.classList.toggle('active', i === introSlide);
    });
    
    var prevBtn = document.getElementById('intro-prev');
    var nextBtn = document.getElementById('intro-next');
    
    if (prevBtn) {
      prevBtn.style.visibility = introSlide === 0 ? 'hidden' : 'visible';
    }
    if (nextBtn) {
      if (introSlide === INTRO_TOTAL - 1) {
        nextBtn.textContent = '🚀 شروع کنیم';
        nextBtn.classList.add('finish');
      } else {
        nextBtn.textContent = 'بعدی ←';
        nextBtn.classList.remove('finish');
      }
    }
    
    // اسکرول کارت معرفی به بالا
    var introCard = document.querySelector('.intro-card');
    if (introCard) {
      introCard.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    // اسکرول صفحه‌ی معرفی به بالا (برای موبایل)
    var introEl = document.getElementById('intro');
    if (introEl) {
      introEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function finishIntro(){
    document.getElementById('intro').style.display = 'none';
    if (hasConfig()) {
      document.getElementById('onboarding').style.display = 'none';
      document.getElementById('main-app').style.display = 'block';
      if(CONFIG.name) document.getElementById('app-title').textContent = '🎯 داشبورد ' + CONFIG.name;
      renderAll();
    } else {
      showOnboarding();
    }
  }
  // ====== افکت لمس سه‌بعدی + بازخورد لمسی (مخصوص موبایل) ======
  function initTouchEffects() {
    // اگه دستگاه لمسی نبود، اجرا نکن
    var isTouch = window.matchMedia('(hover: none)').matches || 'ontouchstart' in window;
    if (!isTouch) return;

    // ===== بازخورد لرزشی =====
    function haptic(ms) {
      if (navigator.vibrate) {
        try { navigator.vibrate(ms || 10); } catch(e) {}
      }
    }

    // ===== ۱. چرخش و درخشش کارت‌ها با لمس =====
    var tiltTargets = document.querySelectorAll('.card, .stat');
    
    tiltTargets.forEach(function(card) {
      if (card.dataset.touchBound === 'true') return;
      card.dataset.touchBound = 'true';

      // وقتی انگشت روی کارت گذاشته شد
      card.addEventListener('touchstart', function(e) {
        var touch = e.touches[0];
        var rect = card.getBoundingClientRect();
        var x = touch.clientX - rect.left;
        var y = touch.clientY - rect.top;
        
        // موقعیت درخشش
        card.style.setProperty('--mouse-x', x + 'px');
        card.style.setProperty('--mouse-y', y + 'px');
        
        // شروع انیمیشن نرم
        card.style.transition = 'transform 0.1s ease-out';
        
        haptic(8);
      }, { passive: true });

      // وقتی انگشت حرکت کرد
      card.addEventListener('touchmove', function(e) {
        var touch = e.touches[0];
        var rect = card.getBoundingClientRect();
        var x = touch.clientX - rect.left;
        var y = touch.clientY - rect.top;
        var centerX = rect.width / 2;
        var centerY = rect.height / 2;
        
        // محدود کردن به داخل کارت
        if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
        
        // محاسبه زاویه (ظریف‌تر از دسکتاپ)
        var rotateX = ((y - centerY) / centerY) * -6;
        var rotateY = ((x - centerX) / centerX) * 6;
        
        card.style.transform = 
          'perspective(800px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg) scale(0.98)';
        
        card.style.setProperty('--mouse-x', x + 'px');
        card.style.setProperty('--mouse-y', y + 'px');
        
        // درخشش قوی‌تر بشه
        card.classList.add('touch-active');
      }, { passive: true });

      // وقتی انگشت برداشته شد
      function resetTilt() {
        card.style.transition = 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)';
        card.style.transform = '';
        card.classList.remove('touch-active');
      }

      card.addEventListener('touchend', resetTilt, { passive: true });
      card.addEventListener('touchcancel', resetTilt, { passive: true });
    });

    // ===== ۲. بازخورد لمسی روی دکمه‌ها =====
    var buttons = document.querySelectorAll('button, .icon-btn, .cal-day:not(.empty)');
    
    buttons.forEach(function(btn) {
      if (btn.dataset.touchBound === 'true') return;
      btn.dataset.touchBound = 'true';
      
      btn.addEventListener('touchstart', function() {
        haptic(12);
        btn.classList.add('touch-press');
      }, { passive: true });
      
      btn.addEventListener('touchend', function() {
        btn.classList.remove('touch-press');
      }, { passive: true });
      
      btn.addEventListener('touchcancel', function() {
        btn.classList.remove('touch-press');
      }, { passive: true });
    });
  }
  // ====== Init ======
  function init(){
    loadConfig();
    loadLogs();

    var now = new Date();
    var nowJ = gToJ(now.getFullYear(), now.getMonth() + 1, now.getDate());
    currentCalJY = nowJ.jy;
    currentCalJM = nowJ.jm;
    selectedDate = todayStr();

    // پر کردن منوهای تاریخ
    fillDateSelects('onb');
    fillDateSelects('set');
    setDateSelects('onb', { jy: 1405, jm: 12, jd: 29 });

    // دکمه‌های اصلی
    var addBtn = document.getElementById('btn-add');
    if(addBtn) addBtn.addEventListener('click', addLog);
    var expBtn = document.getElementById('btn-export');
    if(expBtn) expBtn.addEventListener('click', exportCSV);
    var impInput = document.getElementById('f-import');
    if(impInput) impInput.addEventListener('change', function(e){
      if(e.target.files[0]) toast('ایمپورت هنوز پیاده نشده', 'linear-gradient(135deg,#f59e0b,#d97706)');
    });

    // تقویم
    var prev = document.getElementById('cal-prev');
    if(prev) prev.addEventListener('click', function(){
      currentCalJM--;
      if(currentCalJM < 1){ currentCalJM = 12; currentCalJY--; }
      renderCalendar();
    });
    var next = document.getElementById('cal-next');
    if(next) next.addEventListener('click', function(){
      currentCalJM++;
      if(currentCalJM > 12){ currentCalJM = 1; currentCalJY++; }
      renderCalendar();
    });

    // فرم
    var inp = document.getElementById('f-done');
    if(inp) inp.addEventListener('keydown', function(e){ if(e.key === 'Enter') addLog(); });

    // Onboarding
    var onbAdd = document.getElementById('onb-add-lesson');
    if(onbAdd) onbAdd.addEventListener('click', function(){
      onboardingLessons.push({ id: 'tmp' + Date.now(), name: '', total: 0 });
      renderOnbLessons();
    });
    var onbSubmit = document.getElementById('onb-submit');
    if(onbSubmit) onbSubmit.addEventListener('click', completeOnboarding);

    // Settings
    var settingsBtn = document.getElementById('btn-settings');
    if(settingsBtn) settingsBtn.addEventListener('click', openSettings);
    var modalClose = document.getElementById('modal-close');
    if(modalClose) modalClose.addEventListener('click', function(){
      document.getElementById('settings-modal').style.display = 'none';
    });
    var setAdd = document.getElementById('set-add-lesson');
    if(setAdd) setAdd.addEventListener('click', function(){
      settingsLessons.push({ id: 'tmp' + Date.now(), name: '', total: 0 });
      renderSettingsLessons();
    });
    var setSave = document.getElementById('set-save');
    if(setSave) setSave.addEventListener('click', saveSettings);
    var setReset = document.getElementById('set-reset');
    if(setReset) setReset.addEventListener('click', resetAll);

    // گوش دادن به تغییر حالت
    document.querySelectorAll('input[name="goal-mode"]').forEach(function(r){
      r.addEventListener('change', function(){ renderOnbLessons(); });
    });
    document.querySelectorAll('input[name="set-goal-mode"]').forEach(function(r){
      r.addEventListener('change', function(){ renderSettingsLessons(); });
    });

    // دکمه‌های صفحه معرفی
    var introPrev = document.getElementById('intro-prev');
    if(introPrev) introPrev.addEventListener('click', function(){
      showIntroSlide(introSlide - 1);
    });
    var introNext = document.getElementById('intro-next');
    if(introNext) introNext.addEventListener('click', function(){
      if(introSlide === INTRO_TOTAL - 1) {
        finishIntro();
      } else {
        showIntroSlide(introSlide + 1);
      }
    });
    // نقطه‌ها کلیک‌پذیر
    document.querySelectorAll('.dot').forEach(function(dot, i) {
      dot.style.cursor = 'pointer';
      dot.addEventListener('click', function() {
        showIntroSlide(i);
      });
    });
    // شروع
    if(hasConfig()){
      document.getElementById('intro').style.display = 'none';
      document.getElementById('onboarding').style.display = 'none';
      document.getElementById('main-app').style.display = 'block';
      if(CONFIG.name){
        document.getElementById('app-title').textContent = '🎯 داشبورد ' + CONFIG.name;
      }
      renderAll();
    } else {
      document.getElementById('onboarding').style.display = 'none';
      document.getElementById('main-app').style.display = 'none';
      document.getElementById('intro').style.display = 'flex';
      showIntroSlide(0);
    }
        setTimeout(initTouchEffects, 60);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
        setTimeout(initTouchEffects, 100);
        // سال فوتر
    var footerYear = document.getElementById('footer-year');
    if(footerYear) {
      var now = new Date();
      var jNow = gToJ(now.getFullYear(), now.getMonth() + 1, now.getDate());
      footerYear.textContent = '© ' + faDigits(jNow.jy);
    }
  }
})();