/* 線上練習 — 主程式 */
(function () {
  'use strict';

  var MONACO_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/';
  var LANGS = {
    python: { label: 'Python 3', monaco: 'python', file: 'solution.py' },
    typescript: { label: 'TypeScript', monaco: 'typescript', file: 'solution.ts' },
    javascript: { label: 'JavaScript', monaco: 'javascript', file: 'solution.js' },
  };
  var LIMIT = { // 毫秒：整體上限
    run: { python: 10000, typescript: 6000, javascript: 6000 },
    submit: { python: 20000, typescript: 10000, javascript: 10000 },
  };
  var CASE_LIMIT = { python: 5000, typescript: 3000, javascript: 3000 }; // 單一案例上限
  var SOL_LANGS = [['python', 'Python', 'python'], ['cpp', 'C++', 'cpp'], ['java', 'Java', 'java'], ['typescript', 'TypeScript', 'typescript'], ['c', 'C', 'c']];

  // ---------- 小工具 ----------
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem('lc:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem('lc:' + k, JSON.stringify(v)); } catch (e) {}
    },
  };
  function fmtVal(v, max) {
    var s = JSON.stringify(v);
    if (s === undefined) s = 'undefined';
    max = max || 4000;
    return s.length > max ? s.slice(0, max) + ' …（共 ' + s.length.toLocaleString() + ' 字元，已截斷）' : s;
  }
  function fmtMs(ms) {
    if (ms < 1) return '< 1 ms';
    return Math.round(ms) + ' ms';
  }
  function relTime(t) {
    var d = (Date.now() - t) / 1000;
    if (d < 60) return '剛剛';
    if (d < 3600) return Math.floor(d / 60) + ' 分鐘前';
    if (d < 86400) return Math.floor(d / 3600) + ' 小時前';
    if (d < 86400 * 30) return Math.floor(d / 86400) + ' 天前';
    return new Date(t).toLocaleDateString('zh-TW');
  }
  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform);

  // ---------- 狀態 ----------
  var S = {
    index: [],
    p: null,                       // 目前題目資料
    lang: store.get('lang', 'python'),
    cases: [],                     // [[param 的 JSON 字串...]]
    caseIdx: 0,
    resultIdx: 0,
    last: null,                    // 最近一次執行／提交的結果
    busy: false,
    solRevealed: {},
    solLang: 'python',
  };
  if (!LANGS[S.lang]) S.lang = 'python';

  // ---------- 程式碼執行器（Web Worker） ----------
  var runner = {
    seq: 0,
    pending: null,
    py: 'idle',      // idle | loading | ready | error
    pyVersion: '',
    pyWaiters: [],
    spawn: function () {
      var self = this;
      this.w = new Worker('runner.js');
      this.w.onmessage = function (e) { self.onMessage(e.data); };
      this.w.onerror = function (e) {
        if (self.pending) {
          var p = self.pending; self.pending = null; clearTimeout(p.timer);
          p.resolve({ fatal: e.message || '執行環境發生錯誤' });
        }
      };
    },
    onMessage: function (m) {
      if (m.type === 'py-ready') {
        this.py = 'ready'; this.pyVersion = m.version;
        this.pyWaiters.splice(0).forEach(function (w) { w.resolve(); });
        updateEnv();
      } else if (m.type === 'py-failed') {
        this.py = 'error';
        this.pyWaiters.splice(0).forEach(function (w) { w.reject(new Error(m.error)); });
        updateEnv();
      } else if (m.type === 'case') {
        if (this.pending && this.pending.id === m.id) {
          this.pending.lastIdx = m.idx;
          if (this.pending.onCaseStart) this.pending.onCaseStart();
          if (this.pending.onCase) this.pending.onCase(m.idx);
        }
      } else if (m.type === 'result') {
        if (this.pending && this.pending.id === m.id) {
          var p = this.pending; this.pending = null; clearTimeout(p.timer); clearTimeout(p.caseTimer);
          p.resolve(m);
        }
      }
    },
    ensurePython: function () {
      var self = this;
      if (this.py === 'ready') return Promise.resolve();
      return new Promise(function (resolve, reject) {
        self.pyWaiters.push({ resolve: resolve, reject: reject });
        if (self.py !== 'loading') {
          self.py = 'loading';
          updateEnv();
          self.w.postMessage({ type: 'preload-python' });
        }
      });
    },
    exec: function (req, timeout, onCase, caseLimit) {
      var self = this;
      return new Promise(function (resolve) {
        var id = ++self.seq;
        var p = { id: id, resolve: resolve, onCase: onCase, lastIdx: -1 };
        var kill = function (reason) {
          if (self.pending !== p) return;
          self.pending = null;
          clearTimeout(p.timer);
          clearTimeout(p.caseTimer);
          self.restart();
          resolve({ timeout: true, idx: p.lastIdx, reason: reason });
        };
        p.timer = setTimeout(function () { kill('total'); }, timeout);
        if (caseLimit) {
          p.onCaseStart = function () {
            clearTimeout(p.caseTimer);
            p.caseTimer = setTimeout(function () { kill('case'); }, caseLimit);
          };
        }
        self.pending = p;
        req.type = 'run';
        req.id = id;
        self.w.postMessage(req);
      });
    },
    restart: function () {
      var hadPy = this.py === 'ready' || this.py === 'loading';
      this.w.terminate();
      this.py = 'idle';
      this.spawn();
      if (hadPy) this.ensurePython().catch(function () {});
    },
  };
  runner.spawn();

  function updateEnv() {
    var el = $('#envState');
    var cls = 'ready', text;
    if (S.lang === 'python') {
      if (runner.py === 'ready') text = 'Python ' + runner.pyVersion + '（Pyodide，在瀏覽器執行）';
      else if (runner.py === 'loading') { cls = 'loading'; text = 'Python 環境載入中，第一次約需 5–15 秒'; }
      else if (runner.py === 'error') { cls = 'error'; text = 'Python 環境載入失敗，請檢查網路後重新整理'; }
      else { cls = ''; text = 'Python 環境尚未載入'; }
    } else if (S.lang === 'typescript') {
      if (editor.monaco) text = 'TypeScript（在瀏覽器轉譯並執行）';
      else { cls = 'loading'; text = 'TypeScript 編譯器載入中'; }
    } else {
      text = 'JavaScript（在瀏覽器執行）';
    }
    el.className = 'env ' + cls;
    el.lastElementChild.textContent = text;
  }

  // ---------- 編輯器 ----------
  var editor = {
    monaco: null,
    ed: null,
    models: {},
    fallback: null,
    listeners: [],
    getCode: function () {
      if (this.ed) return this.ed.getModel().getValue();
      if (this.fallback) return this.fallback.value;
      return '';
    },
    setProblem: function (p) {
      var self = this;
      Object.keys(LANGS).forEach(function (l) {
        var code = store.get('code:' + p.slug + ':' + l, null);
        if (code === null) code = p.starter[l];
        if (self.monaco) {
          if (self.models[l]) self.models[l].dispose();
          self.models[l] = self.monaco.editor.createModel(code, LANGS[l].monaco, self.monaco.Uri.parse('file:///' + p.slug + '/' + LANGS[l].file));
          self.models[l].onDidChangeContent(function () { onCodeChange(l); });
        } else {
          self.models[l] = { value: code };
        }
      });
      this.showLang(S.lang);
    },
    showLang: function (l) {
      if (this.ed) {
        this.ed.setModel(this.models[l]);
        placeCursor(this.ed);
      } else if (this.fallback) {
        this.fallback.value = this.models[l].value;
      }
    },
    setCode: function (code) {
      if (this.ed) {
        var m = this.ed.getModel();
        this.ed.pushUndoStop();
        this.ed.executeEdits('reset', [{ range: m.getFullModelRange(), text: code }]);
        this.ed.pushUndoStop();
        placeCursor(this.ed);
      } else if (this.fallback) {
        this.fallback.value = code;
        this.models[S.lang].value = code;
        onCodeChange(S.lang);
      }
    },
  };

  // 游標放到第一個空的函式本體（起始程式碼的縮排空行）
  function placeCursor(ed) {
    var m = ed.getModel();
    for (var i = 1; i <= m.getLineCount(); i++) {
      var t = m.getLineContent(i);
      if (t.trim() === '' && t.length >= 4) {
        ed.setPosition({ lineNumber: i, column: t.length + 1 });
        ed.revealLineInCenterIfOutsideViewport(i);
        return;
      }
    }
  }

  var saveTimer;
  function onCodeChange(l) {
    if (!S.p) return;
    $('#saveState').textContent = '';
    clearTimeout(saveTimer);
    var slug = S.p.slug;
    saveTimer = setTimeout(function () {
      var code = editor.ed ? editor.models[l].getValue() : editor.fallback.value;
      store.set('code:' + slug + ':' + l, code);
      $('#saveState').textContent = '已自動儲存';
    }, 500);
  }

  function initMonaco() {
    var done = false;
    var failTimer = setTimeout(function () { if (!done) useFallbackEditor(); }, 20000);
    if (typeof require === 'undefined' || !require.config) { useFallbackEditor(); return; }

    window.MonacoEnvironment = {
      getWorkerUrl: function () {
        return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(
          "self.MonacoEnvironment={baseUrl:'" + MONACO_BASE + "'};importScripts('" + MONACO_BASE + "vs/base/worker/workerMain.js');");
      },
    };
    require.config({ paths: { vs: MONACO_BASE + 'vs' } });
    require(['vs/editor/editor.main'], function () {
      if (editor.fallback) return;     // 已經改用備援編輯器
      done = true;
      clearTimeout(failTimer);
      var monaco = window.monaco;
      editor.monaco = monaco;

      monaco.editor.defineTheme('lc-light', {
        base: 'vs', inherit: true,
        rules: [{ token: 'comment', foreground: '8a857a', fontStyle: 'italic' }],
        colors: {
          'editor.background': '#ffffff', 'editor.lineHighlightBackground': '#f6f5f1', 'editor.lineHighlightBorder': '#00000000',
          'editorLineNumber.foreground': '#b9b4a8', 'editorLineNumber.activeForeground': '#55524b',
          'editorIndentGuide.background1': '#ecebe5', 'editor.selectionBackground': '#d6e4fb',
          'editorGutter.background': '#ffffff', 'scrollbarSlider.background': '#cfcabd66',
        },
      });
      monaco.editor.defineTheme('lc-dark', {
        base: 'vs-dark', inherit: true,
        rules: [{ token: 'comment', foreground: '7d796f', fontStyle: 'italic' }],
        colors: {
          'editor.background': '#191918', 'editor.lineHighlightBackground': '#20201e', 'editor.lineHighlightBorder': '#00000000',
          'editorLineNumber.foreground': '#55524b', 'editorLineNumber.activeForeground': '#b5b1a7',
          'editorIndentGuide.background1': '#2a2a27', 'editor.selectionBackground': '#2c4a7a',
          'editorGutter.background': '#191918', 'scrollbarSlider.background': '#3a393566',
        },
      });

      var decl = [
        'declare class ListNode { val: number; next: ListNode | null; constructor(val?: number, next?: ListNode | null); }',
        'declare class TreeNode { val: number; left: TreeNode | null; right: TreeNode | null; constructor(val?: number, left?: TreeNode | null, right?: TreeNode | null); }',
      ].join('\n');
      var ts = monaco.languages.typescript;
      ts.typescriptDefaults.addExtraLib(decl, 'file:///lc-types.d.ts');
      ts.javascriptDefaults.addExtraLib(decl, 'file:///lc-types.d.ts');
      ts.typescriptDefaults.setCompilerOptions({
        target: ts.ScriptTarget.ES2020, allowNonTsExtensions: true, strict: false, noImplicitAny: false,
        lib: ['es2020'], noEmitOnError: false,
      });

      var host = $('#editorHost');
      $('#editorLoading').remove();
      editor.ed = monaco.editor.create(host, {
        theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'lc-dark' : 'lc-light',
        fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 13.5, lineHeight: 21, fontLigatures: false,
        minimap: { enabled: false }, scrollBeyondLastLine: false, automaticLayout: true,
        padding: { top: 10, bottom: 10 }, tabSize: 4, insertSpaces: true, detectIndentation: false,
        renderLineHighlight: 'line', smoothScrolling: true, cursorSmoothCaretAnimation: 'on',
        bracketPairColorization: { enabled: true }, guides: { indentation: true, bracketPairs: false },
        fixedOverflowWidgets: true, overviewRulerLanes: 0, hideCursorInOverviewRuler: true,
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
        stickyScroll: { enabled: false }, lineNumbersMinChars: 3, folding: true,
      });
      editor.ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, function () { runCode(); });
      editor.ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, function () { submitCode(); });
      editor.ed.onDidChangeCursorPosition(function (e) {
        $('#cursorPos').textContent = '第 ' + e.position.lineNumber + ' 行，第 ' + e.position.column + ' 欄';
      });
      if (S.p) editor.setProblem(S.p);
      updateEnv();
    }, function () { useFallbackEditor(); });
  }

  function useFallbackEditor() {
    if (editor.ed || editor.fallback) return;
    var host = $('#editorHost');
    host.innerHTML = '';
    var ta = document.createElement('textarea');
    ta.className = 'editor-fallback';
    ta.spellcheck = false;
    ta.setAttribute('aria-label', '程式碼');
    ta.addEventListener('input', function () { editor.models[S.lang].value = ta.value; onCodeChange(S.lang); });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        var s = ta.selectionStart;
        ta.setRangeText('    ', s, ta.selectionEnd, 'end');
        ta.dispatchEvent(new Event('input'));
      }
    });
    host.appendChild(ta);
    editor.fallback = ta;
    if (S.p) editor.setProblem(S.p);
    toast('進階編輯器載入失敗，已改用簡易編輯器');
    updateEnv();
  }

  // TypeScript → JavaScript（使用 Monaco 內建的 TypeScript worker）
  async function transpileTs() {
    var monaco = editor.monaco;
    if (!monaco) throw new Error('TypeScript 編譯器尚未載入完成，請稍候再試。');
    var model = editor.models.typescript;
    var getWorker = await monaco.languages.typescript.getTypeScriptWorker();
    var client = await getWorker(model.uri);
    var diags = await client.getSyntacticDiagnostics(model.uri.toString());
    if (diags.length) {
      var d = diags[0];
      var pos = model.getPositionAt(d.start || 0);
      var msg = typeof d.messageText === 'string' ? d.messageText : d.messageText.messageText;
      return { error: '第 ' + pos.lineNumber + ' 行，第 ' + pos.column + ' 欄：' + msg };
    }
    var out = await client.getEmitOutput(model.uri.toString());
    var js = out.outputFiles && out.outputFiles[0] ? out.outputFiles[0].text : '';
    return { code: js };
  }

  // ---------- 題目載入 ----------
  async function loadIndex() {
    var r = await fetch('data/index.json', { cache: 'no-cache' });
    S.index = await r.json();
    renderDrawer();
  }

  async function loadProblem(slug, push) {
    var item = S.index.find(function (x) { return x.slug === slug; }) || S.index[0];
    slug = item.slug;
    $('#viewDesc').innerHTML = '<div class="skeleton-lines"><i></i><i></i><i></i><i></i></div>';
    var r = await fetch('data/' + slug + '.json');
    if (!r.ok) { toast('題目載入失敗'); return; }
    var p = await r.json();
    S.p = p;
    S.last = null;
    S.caseIdx = 0;
    S.resultIdx = 0;
    var saved = store.get('cases:' + slug, null);
    S.cases = (saved && saved.length && saved[0].length === p.params.length) ? saved : exampleCases(p);

    document.title = p.id + '. ' + p.title + ' - 線上練習';
    var url = '?p=' + slug;
    if (push) history.pushState({ slug: slug }, '', url);
    else history.replaceState({ slug: slug }, '', url);

    renderDesc();
    renderSolution();
    renderHistory();
    renderCases();
    renderResultEmpty();
    switchConsole('cases');
    renderDrawer();
    updateNav();
    if (editor.ed || editor.fallback) editor.setProblem(p);
    $('#saveState').textContent = '';
    $('#leftBody').scrollTop = 0;
  }

  function exampleCases(p) {
    return p.examples.map(function (e) {
      return e.args.map(function (a) { return JSON.stringify(a); });
    });
  }

  function updateNav() {
    var i = S.index.findIndex(function (x) { return x.slug === S.p.slug; });
    $('#btnPrev').disabled = i <= 0;
    $('#btnNext').disabled = i >= S.index.length - 1;
  }
  function go(delta) {
    var i = S.index.findIndex(function (x) { return x.slug === S.p.slug; }) + delta;
    if (i >= 0 && i < S.index.length) loadProblem(S.index[i].slug, true);
  }

  function status(slug) { return store.get('status:' + slug, ''); }

  // ---------- 左側：題目 ----------
  function paramLine(p, args) {
    if (p.design) return JSON.stringify(args[0]) + '\n' + JSON.stringify(args[1]);
    return p.params.map(function (pp, i) { return pp[0] + ' = ' + JSON.stringify(args[i]); }).join(', ');
  }

  function renderDesc() {
    var p = S.p;
    var solved = status(p.slug) === 'solved';
    var html = '<article class="desc">';
    html += '<h1><span class="num">' + p.id + '.</span>' + esc(p.title) + '</h1>';
    html += '<div class="meta"><span class="diff ' + p.difficulty + '">' + p.difficulty + '</span>';
    p.tags.forEach(function (t) { html += '<span class="tag">' + esc(t) + '</span>'; });
    if (solved) html += '<span class="solved-flag"><svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>已解決</span>';
    html += '</div>';
    html += '<div class="prose">' + p.desc + '</div>';
    p.examples.forEach(function (e, i) {
      html += '<div class="ex"><div class="ex-label">範例 ' + (i + 1) + '</div><div class="ex-body">';
      html += '<b>輸入</b>' + (p.design ? '\n' : '') + esc(paramLine(p, e.args)) + '\n';
      html += '<b>輸出</b>' + esc(JSON.stringify(e.out));
      if (e.explain) html += '\n<span class="exp"><b>解釋</b>' + esc(e.explain) + '</span>';
      html += '</div></div>';
    });
    html += '<div class="block-title">限制條件</div><ul class="constraints">';
    p.constraints.forEach(function (c) { html += '<li><code>' + esc(c) + '</code></li>'; });
    html += '</ul>';
    if (p.followUp) html += '<p class="followup"><b>進階：</b>' + esc(p.followUp) + '</p>';
    html += '<div class="desc-foot muted">想看圖解與完整說明？<a href="../problems/' + p.slug + '.html">打開這題的題解頁</a></div>';
    html += '</article>';
    $('#viewDesc').innerHTML = html;
  }

  // ---------- 左側：題解 ----------
  function renderSolution() {
    var p = S.p, v = $('#viewSolution');
    if (!S.solRevealed[p.slug]) {
      v.innerHTML = '<div class="sol"><div class="sol-gate"><h3>先自己寫寫看？</h3>' +
        '<p>卡住超過 20 分鐘再看題解，學到的會比較多。題解有 Python、C++、Java、TypeScript、C 五種語言。</p>' +
        '<button class="btn-ghost" id="btnReveal">顯示題解</button></div></div>';
      $('#btnReveal').onclick = function () { S.solRevealed[p.slug] = true; renderSolution(); };
      return;
    }
    var html = '<div class="sol"><div class="seg" role="tablist">';
    SOL_LANGS.forEach(function (l) {
      html += '<button data-sol="' + l[0] + '"' + (l[0] === S.solLang ? ' class="active"' : '') + '>' + l[1] + '</button>';
    });
    html += '</div><pre class="codeblock" id="solCode"></pre>';
    html += '<p class="desc-foot muted">解題思路、複雜度分析與圖解：<a href="../problems/' + p.slug + '.html">完整題解頁</a></p></div>';
    v.innerHTML = html;
    $$('[data-sol]', v).forEach(function (b) {
      b.onclick = function () { S.solLang = b.dataset.sol; renderSolution(); };
    });
    var code = p.solutions[S.solLang] || '';
    var pre = $('#solCode');
    pre.textContent = code;
    var lang = SOL_LANGS.find(function (l) { return l[0] === S.solLang; })[2];
    if (editor.monaco) {
      editor.monaco.editor.colorize(code, lang, { tabSize: 4 }).then(function (h) {
        if ($('#solCode') === pre) pre.innerHTML = h;
      });
    }
  }

  // ---------- 左側：提交紀錄 ----------
  function renderHistory() {
    var subs = store.get('subs:' + S.p.slug, []);
    var v = $('#viewHistory');
    if (!subs.length) {
      v.innerHTML = '<p class="muted empty">還沒有提交紀錄。寫完之後按「提交」，系統會用所有隱藏測資判題。</p>';
      return;
    }
    var html = '<div class="hist"><table class="hist-table"><thead><tr><th>結果</th><th>語言</th><th>執行時間</th><th>時間</th></tr></thead><tbody>';
    subs.forEach(function (s, i) {
      html += '<tr data-i="' + i + '" title="點一下把這次的程式碼載入編輯器"><td class="' + s.cls + '">' + esc(s.label) +
        (s.total ? ' <span class="muted small">' + s.passed + '/' + s.total + '</span>' : '') + '</td><td>' + esc(LANGS[s.lang].label) +
        '</td><td>' + (s.ms !== null && s.ms !== undefined ? fmtMs(s.ms) : '—') + '</td><td class="muted">' + relTime(s.t) + '</td></tr>';
    });
    html += '</tbody></table></div>';
    v.innerHTML = html;
    $$('tbody tr', v).forEach(function (tr) {
      tr.onclick = function () {
        var s = subs[Number(tr.dataset.i)];
        setLang(s.lang);
        editor.setCode(s.code);
        toast('已載入 ' + relTime(s.t) + '的提交程式碼');
      };
    });
  }

  function switchLeft(name) {
    $$('[data-left]').forEach(function (b) { b.classList.toggle('active', b.dataset.left === name); });
    $$('[data-left-view]').forEach(function (v) { v.classList.toggle('active', v.dataset.leftView === name); });
  }

  // ---------- 下方：測試案例 ----------
  function paramNames() {
    return S.p.params.map(function (x) { return x[0]; });
  }

  function renderCases() {
    var v = $('#viewCases');
    var html = '<div class="cases"><div class="chips">';
    S.cases.forEach(function (c, i) {
      html += '<button class="chip' + (i === S.caseIdx ? ' active' : '') + '" data-case="' + i + '">案例 ' + (i + 1) +
        (S.cases.length > 1 ? '<span class="x" data-del="' + i + '" title="刪除這個案例">×</span>' : '') + '</button>';
    });
    if (S.cases.length < 8) html += '<button class="chip chip-add" id="btnAddCase" title="複製目前的案例來新增">+</button>';
    html += '</div>';
    var c = S.cases[S.caseIdx];
    paramNames().forEach(function (name, j) {
      html += '<div class="field"><label for="f' + j + '">' + esc(name) + ' =</label>' +
        '<textarea id="f' + j + '" class="mono" spellcheck="false" data-param="' + j + '" rows="' + rowsFor(c[j]) + '">' + esc(c[j]) + '</textarea>' +
        '<div class="err" hidden></div></div>';
    });
    html += '<div class="case-actions"><button id="btnRestoreCases">恢復成題目範例</button></div>';
    html += '</div>';
    v.innerHTML = html;

    $$('[data-case]', v).forEach(function (b) {
      b.onclick = function (e) {
        if (e.target.dataset.del !== undefined) {
          S.cases.splice(Number(e.target.dataset.del), 1);
          S.caseIdx = Math.min(S.caseIdx, S.cases.length - 1);
          saveCases();
          renderCases();
          return;
        }
        S.caseIdx = Number(b.dataset.case);
        renderCases();
      };
    });
    var add = $('#btnAddCase', v);
    if (add) add.onclick = function () {
      S.cases.push(S.cases[S.caseIdx].slice());
      S.caseIdx = S.cases.length - 1;
      saveCases();
      renderCases();
    };
    $('#btnRestoreCases', v).onclick = function () {
      S.cases = exampleCases(S.p);
      S.caseIdx = 0;
      saveCases();
      renderCases();
    };
    $$('textarea[data-param]', v).forEach(function (ta) {
      ta.addEventListener('input', function () {
        S.cases[S.caseIdx][Number(ta.dataset.param)] = ta.value;
        ta.rows = rowsFor(ta.value);
        validateField(ta);
        saveCases();
      });
      validateField(ta);
    });
  }

  function rowsFor(s) {
    return Math.min(8, Math.max(1, String(s).split('\n').length, Math.ceil(String(s).length / 90)));
  }
  function validateField(ta) {
    var err = ta.parentNode.querySelector('.err');
    try {
      JSON.parse(ta.value);
      ta.classList.remove('invalid');
      err.hidden = true;
    } catch (e) {
      ta.classList.add('invalid');
      err.hidden = false;
      err.textContent = '不是合法的 JSON（字串要用雙引號，例如 "abc"）';
    }
  }
  function saveCases() { store.set('cases:' + S.p.slug, S.cases); }

  function parseCases() {
    var out = [];
    for (var i = 0; i < S.cases.length; i++) {
      var args = [];
      for (var j = 0; j < S.cases[i].length; j++) {
        try { args.push(JSON.parse(S.cases[i][j])); } catch (e) {
          return { error: '案例 ' + (i + 1) + ' 的 ' + paramNames()[j] + ' 不是合法的 JSON', at: i };
        }
      }
      if (S.p.design && (!Array.isArray(args[0]) || !Array.isArray(args[1]) || args[0].length !== args[1].length)) {
        return { error: '案例 ' + (i + 1) + '：operations 與 arguments 必須是等長的陣列', at: i };
      }
      out.push(args);
    }
    return { cases: out };
  }

  function switchConsole(name) {
    $$('[data-console]').forEach(function (b) { b.classList.toggle('active', b.dataset.console === name); });
    $$('[data-console-view]').forEach(function (v) { v.classList.toggle('active', v.dataset.consoleView === name); });
  }

  // ---------- 下方：結果 ----------
  function renderResultEmpty() {
    $('#viewResult').innerHTML = '<p class="muted empty">按「執行」或 <kbd>' + (isMac ? '⌘' : 'Ctrl') + '</kbd> + <kbd>Enter</kbd>，用測試案例執行你的程式碼。</p>';
  }
  function renderRunning(text, progress) {
    var html = '<div class="running"><span class="spin"></span><span>' + esc(text) + '</span></div>';
    if (progress !== undefined) html += '<div class="progress"><i style="width:' + Math.round(progress * 100) + '%"></i></div>';
    $('#viewResult').innerHTML = html;
  }

  function valbox(label, value, bad) {
    return '<div class="field"><label>' + esc(label) + '</label><div class="valbox' + (bad ? ' diff-bad' : '') + '">' + esc(value) + '</div></div>';
  }
  function inputFields(args) {
    var html = '';
    paramNames().forEach(function (n, j) { html += valbox(n + ' =', fmtVal(args[j])); });
    return html;
  }

  function renderRunResult() {
    var R = S.last, v = $('#viewResult');
    var html = '<div class="result">';
    if (R.compileError) {
      html += '<div class="verdict bad"><h2>' + (R.kind === 'syntax' ? '語法錯誤' : '編譯錯誤') + '</h2></div>';
      html += '<pre class="errbox">' + esc(R.compileError) + '</pre>';
      if (R.stdout) html += valbox('標準輸出', R.stdout);
      v.innerHTML = html + '</div>';
      return;
    }
    if (R.timeout) {
      html += '<div class="verdict warn"><h2>超出時間限制</h2><span class="sub">' + (R.perCase ? '單一案例' : '') + '執行超過 ' + (R.limit / 1000) + ' 秒' +
        (R.timeoutIdx >= 0 ? '，卡在案例 ' + (R.timeoutIdx + 1) : '') + '。檢查是否有無窮迴圈。</span></div>';
      if (R.timeoutIdx >= 0) html += inputFields(R.cases[R.timeoutIdx]);
      v.innerHTML = html + '</div>';
      return;
    }
    var res = R.results;
    var firstErr = res.find(function (r) { return !r.ok; });
    var allPass = res.length === R.cases.length && res.every(function (r, i) { return r.ok && r.pass; });
    var totalMs = res.reduce(function (a, r) { return a + (r.ms || 0); }, 0);
    if (firstErr) {
      html += '<div class="verdict bad"><h2>執行錯誤</h2></div>';
    } else if (allPass) {
      html += '<div class="verdict ok"><h2>通過</h2><span class="sub">執行時間 ' + fmtMs(totalMs) + '</span></div>';
    } else {
      html += '<div class="verdict bad"><h2>答案錯誤</h2><span class="sub">' + res.filter(function (r) { return r.pass; }).length + ' / ' + res.length + ' 個案例通過</span></div>';
    }
    html += '<div class="chips">';
    R.cases.forEach(function (c, i) {
      var r = res[i];
      var cls = !r ? '' : (r.ok && r.pass ? ' pass' : ' fail');
      html += '<button class="chip' + cls + (i === S.resultIdx ? ' active' : '') + '" data-rcase="' + i + '"><i class="dot"></i>案例 ' + (i + 1) + '</button>';
    });
    html += '</div>';
    var r = res[S.resultIdx], args = R.cases[S.resultIdx];
    if (!r) {
      html += '<p class="muted">前面的案例發生錯誤，這個案例沒有執行。</p>';
    } else {
      if (!r.ok) html += '<pre class="errbox">' + esc(r.error) + '</pre>';
      html += inputFields(args);
      if (r.stdout) html += valbox('標準輸出', r.stdout);
      if (r.ok) html += valbox('輸出', fmtVal(r.out), !r.pass);
      html += valbox('預期結果', R.expected[S.resultIdx] === undefined ? '（無法計算）' : fmtVal(R.expected[S.resultIdx]));
    }
    v.innerHTML = html + '</div>';
    $$('[data-rcase]', v).forEach(function (b) {
      b.onclick = function () { S.resultIdx = Number(b.dataset.rcase); renderRunResult(); };
    });
  }

  function renderSubmitResult() {
    var R = S.last, v = $('#viewResult');
    var html = '<div class="result">';
    var head = function (cls, title, sub) {
      return '<div class="verdict ' + cls + '"><h2>' + title + '</h2>' + (sub ? '<span class="sub">' + sub + '</span>' : '') + '</div>';
    };
    var passedSub = '通過 ' + R.passed + ' / ' + R.total + ' 個測試案例';
    if (R.compileError) {
      html += head('bad', /SyntaxError|IndentationError|TabError|Expression expected|expected\./.test(R.compileError) || R.kind === 'syntax' ? '語法錯誤' : '編譯錯誤') + '<pre class="errbox">' + esc(R.compileError) + '</pre>';
    } else if (R.verdict === 'AC') {
      html += head('ok', '通過', R.total + ' / ' + R.total + ' 個測試案例全部通過 · 總執行時間 ' + fmtMs(R.ms));
      html += '<p class="muted small">已記錄到「提交紀錄」。想挑戰更好的寫法，可以到「題解」看看別的思路。</p>';
    } else {
      var title = { WA: '答案錯誤', RE: '執行錯誤', TLE: '超出時間限制' }[R.verdict];
      html += head(R.verdict === 'TLE' ? 'warn' : 'bad', title, passedSub);
      if (R.verdict === 'RE') html += '<pre class="errbox">' + esc(R.error) + '</pre>';
      if (R.verdict === 'TLE') html += '<p class="muted small">' + (R.perCase ? '單一測試案例' : '整體') + '執行超過 ' + (R.limit / 1000) + ' 秒。可能是無窮迴圈，或時間複雜度太高。</p>';
      if (R.failArgs) {
        html += '<div class="block-title" style="margin-top:4px">' + (R.verdict === 'TLE' ? '最後執行的輸入' : '未通過的案例') + '</div>';
        html += inputFields(R.failArgs);
        if (R.stdout) html += valbox('標準輸出', R.stdout);
        if (R.verdict === 'WA') {
          html += valbox('輸出', fmtVal(R.got), true);
          html += valbox('預期結果', fmtVal(R.expected));
        }
      }
    }
    v.innerHTML = html + '</div>';
  }

  // ---------- 執行與提交 ----------
  function setBusy(which) {
    S.busy = !!which;
    var run = $('#btnRun'), sub = $('#btnSubmit');
    run.disabled = sub.disabled = S.busy;
    [run, sub].forEach(function (b) {
      var sp = b.querySelector('.spin');
      if (sp) sp.remove();
      b.querySelector('svg').style.display = '';
    });
    if (which) {
      var b = which === 'run' ? run : sub;
      b.querySelector('svg').style.display = 'none';
      var s = document.createElement('span');
      s.className = 'spin';
      b.insertBefore(s, b.firstChild);
    }
  }

  function showConsole() {
    var pc = $('#paneConsole');
    if (pc.classList.contains('collapsed')) toggleConsole(false);
    switchConsole('result');
    if (window.matchMedia('(max-width: 900px)').matches) setMobileView('console');
  }

  // 依語言準備可執行的程式碼
  async function prepare(lang) {
    var code = editor.getCode();
    if (!code.trim()) return { error: '程式碼是空的。' };
    if (lang === 'typescript') {
      if (!editor.monaco) return { error: 'TypeScript 編譯器尚未載入完成，請稍候再試。' };
      var t = await transpileTs();
      if (t.error) return { error: t.error, kind: 'syntax' };
      return { code: t.code, runLang: 'javascript', source: code };
    }
    if (lang === 'python') {
      if (runner.py !== 'ready') renderRunning('正在載入 Python 環境（第一次約需 5–15 秒）…');
      try { await runner.ensurePython(); } catch (e) { return { error: 'Python 環境載入失敗：' + e.message }; }
    }
    return { code: code, runLang: lang, source: code };
  }

  function baseReq(p) {
    return { fn: p.fn, design: p.design, types: p.params.map(function (x) { return x[1]; }), ret: p.ret };
  }

  async function runCode() {
    if (S.busy || !S.p) return;
    var parsed = parseCases();
    if (parsed.error) {
      switchConsole('cases');
      S.caseIdx = parsed.at;
      renderCases();
      toast(parsed.error);
      return;
    }
    var p = S.p, lang = S.lang;
    setBusy('run');
    showConsole();
    renderRunning('執行中…');
    try {
      var prep = await prepare(lang);
      if (prep.error) {
        S.last = { compileError: prep.error, kind: prep.kind };
        renderRunResult();
        return;
      }
      renderRunning('執行中…');
      var cases = parsed.cases;
      // 預期結果：用參考解法計算（自訂案例也能比對）
      var refReq = Object.assign(baseReq(p), { lang: 'javascript', code: p.ref, cases: cases, stopOnError: false });
      var ref = await runner.exec(refReq, 8000);
      var expected = (ref.results || []).map(function (r) { return r.ok ? r.out : undefined; });

      var req = Object.assign(baseReq(p), { lang: prep.runLang, code: prep.code, cases: cases, stopOnError: false });
      var limit = LIMIT.run[lang];
      var res = await runner.exec(req, limit, null, CASE_LIMIT[lang]);
      S.resultIdx = 0;
      if (res.timeout) {
        S.last = { timeout: true, limit: res.reason === 'case' ? CASE_LIMIT[lang] : limit, perCase: res.reason === 'case', timeoutIdx: res.idx, cases: cases };
      } else if (res.fatal) {
        S.last = { compileError: res.fatal };
      } else if (res.compileError) {
        S.last = { compileError: res.compileError, stdout: res.stdout, kind: /SyntaxError|IndentationError|TabError/.test(res.compileError) ? 'syntax' : '' };
      } else {
        res.results.forEach(function (r, i) {
          r.pass = r.ok && expected[i] !== undefined && LC.equal(p.cmp, r.out, expected[i]);
        });
        var firstBad = res.results.findIndex(function (r) { return !r.pass; });
        S.resultIdx = firstBad >= 0 ? firstBad : 0;
        S.last = { results: res.results, cases: cases, expected: expected };
        if (status(p.slug) !== 'solved') { store.set('status:' + p.slug, 'tried'); renderDrawer(); }
      }
      renderRunResult();
    } catch (e) {
      S.last = { compileError: String(e && e.message || e) };
      renderRunResult();
    } finally {
      setBusy(null);
    }
  }

  async function submitCode() {
    if (S.busy || !S.p) return;
    var p = S.p, lang = S.lang;
    setBusy('submit');
    showConsole();
    renderRunning('判題中…');
    var source = editor.getCode();
    var R;
    try {
      var prep = await prepare(lang);
      if (prep.error) {
        R = { compileError: prep.error, verdict: 'CE', kind: prep.kind };
      } else {
        var all = p.examples.map(function (e) { return { args: e.args, out: e.out }; }).concat(p.tests);
        var cases = all.map(function (t) { return t.args; });
        var limit = LIMIT.submit[lang];
        var req = Object.assign(baseReq(p), { lang: prep.runLang, code: prep.code, cases: cases, stopOnError: true });
        var res = await runner.exec(req, limit, function (i) {
          if (i % 3 === 0) renderRunning('判題中… ' + i + ' / ' + all.length, i / all.length);
        }, CASE_LIMIT[lang]);
        R = { total: all.length, passed: 0, limit: limit };
        if (res.timeout) {
          R.verdict = 'TLE';
          if (res.reason === 'case') { R.limit = CASE_LIMIT[lang]; R.perCase = true; }
          R.passed = Math.max(0, res.idx);
          R.failArgs = res.idx >= 0 ? all[res.idx].args : null;
        } else if (res.fatal || res.compileError) {
          R.verdict = 'CE';
          R.compileError = res.fatal || res.compileError;
        } else {
          R.verdict = 'AC';
          R.ms = 0;
          for (var i = 0; i < all.length; i++) {
            var r = res.results[i];
            if (!r) break;
            if (!r.ok) {
              R.verdict = 'RE'; R.error = r.error; R.failArgs = all[i].args; R.stdout = r.stdout;
              break;
            }
            if (!LC.equal(p.cmp, r.out, all[i].out)) {
              R.verdict = 'WA'; R.got = r.out; R.expected = all[i].out; R.failArgs = all[i].args; R.stdout = r.stdout;
              break;
            }
            R.passed++;
            R.ms += r.ms || 0;
          }
          if (R.verdict === 'AC' && R.passed !== all.length) { R.verdict = 'RE'; R.error = '執行意外中止'; }
        }
      }
    } catch (e) {
      R = { compileError: String(e && e.message || e), verdict: 'CE' };
    } finally {
      setBusy(null);
    }
    S.last = R;
    renderSubmitResult();

    var meta = {
      AC: ['通過', 'st-ok'], WA: ['答案錯誤', 'st-bad'], RE: ['執行錯誤', 'st-bad'],
      TLE: ['超出時間限制', 'st-warn'], CE: ['編譯錯誤', 'st-bad'],
    }[R.verdict];
    var subs = store.get('subs:' + p.slug, []);
    subs.unshift({
      t: Date.now(), lang: lang, label: meta[0], cls: meta[1], code: source,
      ms: R.verdict === 'AC' ? R.ms : null, passed: R.passed || 0, total: R.verdict === 'AC' ? 0 : (R.total || 0),
    });
    store.set('subs:' + p.slug, subs.slice(0, 30));
    if (R.verdict === 'AC') {
      var first = status(p.slug) !== 'solved';
      store.set('status:' + p.slug, 'solved');
      if (first) toast('解出來了！這題已標記為已解決');
      renderDesc();
    } else if (status(p.slug) !== 'solved') {
      store.set('status:' + p.slug, 'tried');
    }
    renderHistory();
    renderDrawer();
  }

  // ---------- 語言 ----------
  function setLang(l) {
    if (!LANGS[l] || l === S.lang) { $('#langSelect').value = S.lang; return; }
    S.lang = l;
    store.set('lang', l);
    $('#langSelect').value = l;
    editor.showLang(l);
    if (l === 'python') runner.ensurePython().catch(function () {});
    updateEnv();
  }

  // ---------- 題目列表抽屜 ----------
  function renderDrawer() {
    var q = ($('#drawerSearch').value || '').trim().toLowerCase();
    var html = '', solved = 0;
    S.index.forEach(function (x) {
      var st = status(x.slug);
      if (st === 'solved') solved++;
      if (q && (x.id + '. ' + x.title).toLowerCase().indexOf(q) < 0) return;
      var icon = st === 'solved'
        ? '<svg viewBox="0 0 16 16" width="14" height="14"><path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : st === 'tried'
          ? '<svg viewBox="0 0 16 16" width="12" height="12"><circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
          : '';
      html += '<li><a href="?p=' + x.slug + '" data-slug="' + x.slug + '"' + (S.p && S.p.slug === x.slug ? ' class="current"' : '') + '>' +
        '<span class="pstat ' + st + '" title="' + (st === 'solved' ? '已解決' : st === 'tried' ? '嘗試過' : '') + '">' + icon + '</span>' +
        '<span class="pnum">' + x.id + '.</span><span class="ptitle">' + esc(x.title) + '</span>' +
        '<span class="pdiff ' + x.difficulty + '">' + x.difficulty + '</span></a></li>';
    });
    $('#plist').innerHTML = html || '<li class="muted empty">找不到符合的題目</li>';
    $('#drawerStats').textContent = '已解決 ' + solved + ' / ' + S.index.length + ' 題（進度只存在這台裝置的瀏覽器）';
    $$('#plist a').forEach(function (a) {
      a.onclick = function (e) {
        if (e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        closeDrawer();
        if (!S.p || a.dataset.slug !== S.p.slug) loadProblem(a.dataset.slug, true);
      };
    });
  }
  function openDrawer() {
    $('#drawer').hidden = false;
    $('#drawerMask').hidden = false;
    renderDrawer();
    setTimeout(function () { $('#drawerSearch').focus(); }, 30);
  }
  function closeDrawer() {
    $('#drawer').hidden = true;
    $('#drawerMask').hidden = true;
  }

  // ---------- 版面：拖曳分隔線、收合、手機切換 ----------
  function initSplitters() {
    var left = $('#paneLeft'), ws = $('#workspace'), col = $('#rightCol'), con = $('#paneConsole');
    var split = store.get('split', { x: 44, y: 38 });
    left.style.flexBasis = split.x + '%';
    con.style.flexBasis = split.y + '%';
    if (store.get('consoleCollapsed', false)) con.classList.add('collapsed');

    function drag(gutter, onMove) {
      gutter.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        gutter.setPointerCapture(e.pointerId);
        gutter.classList.add('dragging');
        document.body.classList.add('resizing');
        function move(ev) { onMove(ev); }
        function up() {
          gutter.classList.remove('dragging');
          document.body.classList.remove('resizing');
          gutter.removeEventListener('pointermove', move);
          gutter.removeEventListener('pointerup', up);
          gutter.removeEventListener('pointercancel', up);
          store.set('split', split);
        }
        gutter.addEventListener('pointermove', move);
        gutter.addEventListener('pointerup', up);
        gutter.addEventListener('pointercancel', up);
      });
    }
    drag($('#gutterX'), function (e) {
      var r = ws.getBoundingClientRect();
      var px = Math.min(Math.max(e.clientX - r.left, 300), r.width - 380);
      split.x = Math.round(px / r.width * 1000) / 10;
      left.style.flexBasis = split.x + '%';
    });
    drag($('#gutterY'), function (e) {
      var r = col.getBoundingClientRect();
      var px = Math.min(Math.max(r.bottom - e.clientY, 120), r.height - 140);
      split.y = Math.round(px / r.height * 1000) / 10;
      con.classList.remove('collapsed');
      store.set('consoleCollapsed', false);
      con.style.flexBasis = split.y + '%';
    });
    $('#gutterX').addEventListener('dblclick', function () { split.x = 44; left.style.flexBasis = '44%'; store.set('split', split); });
    $('#gutterY').addEventListener('dblclick', function () { split.y = 38; con.style.flexBasis = '38%'; store.set('split', split); });
  }

  function toggleConsole(force) {
    var con = $('#paneConsole');
    var collapsed = force === undefined ? !con.classList.contains('collapsed') : force;
    con.classList.toggle('collapsed', collapsed);
    store.set('consoleCollapsed', collapsed);
  }

  function setMobileView(v) {
    $('#app').setAttribute('data-mobile-view', v);
    $$('#mobileTabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.view === v); });
    if (v === 'code' && editor.ed) setTimeout(function () { editor.ed.layout(); }, 0);
  }

  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    store.set('theme', t);
    if (editor.monaco) editor.monaco.editor.setTheme(t === 'dark' ? 'lc-dark' : 'lc-light');
  }

  // ---------- 事件綁定 ----------
  function bind() {
    $('#btnRun').onclick = runCode;
    $('#btnSubmit').onclick = submitCode;
    $('#btnList').onclick = openDrawer;
    $('#btnCloseDrawer').onclick = closeDrawer;
    $('#drawerMask').onclick = closeDrawer;
    $('#drawerSearch').oninput = renderDrawer;
    $('#btnPrev').onclick = function () { go(-1); };
    $('#btnNext').onclick = function () { go(1); };
    $('#btnTheme').onclick = function () {
      setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    };
    $('#btnReset').onclick = function () {
      if (!S.p) return;
      if (!confirm('要把 ' + LANGS[S.lang].label + ' 的程式碼重設為起始範本嗎？目前的內容會被取代（可以用 Ctrl+Z 復原）。')) return;
      editor.setCode(S.p.starter[S.lang]);
    };
    $('#btnToggleConsole').onclick = function () { toggleConsole(); };
    $('#langSelect').onchange = function (e) { setLang(e.target.value); };
    $$('[data-left]').forEach(function (b) { b.onclick = function () { switchLeft(b.dataset.left); }; });
    $$('[data-console]').forEach(function (b) {
      b.onclick = function () {
        if ($('#paneConsole').classList.contains('collapsed')) toggleConsole(false);
        switchConsole(b.dataset.console);
      };
    });
    $$('#mobileTabs button').forEach(function (b) { b.onclick = function () { setMobileView(b.dataset.view); }; });

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('#drawer').hidden) { closeDrawer(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) submitCode(); else runCode();
      }
    });
    window.addEventListener('popstate', function (e) {
      var slug = (e.state && e.state.slug) || new URLSearchParams(location.search).get('p');
      if (slug && (!S.p || slug !== S.p.slug)) loadProblem(slug, false);
    });
    if (isMac) $('.kbd-hint').innerHTML = '<kbd>⌘</kbd><kbd>↵</kbd> 執行';
    $('#btnRun').title = '執行測試案例（' + (isMac ? '⌘' : 'Ctrl') + ' + Enter）';
    $('#btnSubmit').title = '提交並以所有測資判題（' + (isMac ? '⌘' : 'Ctrl') + ' + Shift + Enter）';
  }

  // ---------- 啟動 ----------
  async function start() {
    bind();
    initSplitters();
    $('#langSelect').value = S.lang;
    updateEnv();
    if (S.lang === 'python') runner.ensurePython().catch(function () {});
    initMonaco();
    try {
      await loadIndex();
      var slug = new URLSearchParams(location.search).get('p') || S.index[0].slug;
      await loadProblem(slug, false);
    } catch (e) {
      $('#viewDesc').innerHTML = '<p class="empty">題目載入失敗，請重新整理頁面。</p>';
    }
  }
  start();
})();
