/* 線上練習：在 Web Worker 中執行使用者的程式碼（JavaScript / TypeScript 轉譯後 / Python via Pyodide）
 * 主執行緒負責計時，超時直接 terminate 這個 Worker。 */
'use strict';
importScripts('common.js');

var PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
var pyodide = null, pyLoading = null, pyOut = [];

var PY_PRELUDE = [
  'import sys, json, time, traceback, math, re, string, random, collections, heapq, bisect, itertools, functools, operator',
  'from typing import *',
  'from collections import *',
  'from heapq import *',
  'from bisect import *',
  'from functools import *',
  'from itertools import *',
  'from math import inf',
  'sys.setrecursionlimit(10000)',
  '',
  'class ListNode:',
  '    def __init__(self, val=0, next=None):',
  '        self.val = val',
  '        self.next = next',
  '',
  'class TreeNode:',
  '    def __init__(self, val=0, left=None, right=None):',
  '        self.val = val',
  '        self.left = left',
  '        self.right = right',
  '',
  '_lc_base = {k: v for k, v in globals().items() if not k.startswith("_")}',
  '_lc_ns = None',
  '',
  'def _lc_to_list(a):',
  '    head = None',
  '    for v in reversed(a):',
  '        head = ListNode(v, head)',
  '    return head',
  '',
  'def _lc_from_list(h):',
  '    out = []',
  '    while h is not None:',
  '        if len(out) >= 200000:',
  '            raise RuntimeError("鏈結串列過長，可能形成了環")',
  '        out.append(h.val)',
  '        h = h.next',
  '    return out',
  '',
  'def _lc_to_tree(a):',
  '    if not a or a[0] is None:',
  '        return None',
  '    root = TreeNode(a[0]); q = deque([root]); i = 1',
  '    while q and i < len(a):',
  '        n = q.popleft()',
  '        if i < len(a) and a[i] is not None:',
  '            n.left = TreeNode(a[i]); q.append(n.left)',
  '        i += 1',
  '        if i < len(a) and a[i] is not None:',
  '            n.right = TreeNode(a[i]); q.append(n.right)',
  '        i += 1',
  '    return root',
  '',
  'def _lc_from_tree(r):',
  '    out = []; q = deque([r]); cnt = 0',
  '    while q:',
  '        n = q.popleft()',
  '        if n is None:',
  '            out.append(None); continue',
  '        cnt += 1',
  '        if cnt > 200000:',
  '            raise RuntimeError("樹的節點過多，可能形成了環")',
  '        out.append(n.val); q.append(n.left); q.append(n.right)',
  '    while out and out[-1] is None:',
  '        out.pop()',
  '    return out',
  '',
  'def _lc_arg(t, v):',
  '    if t == "ListNode": return _lc_to_list(v)',
  '    if t == "TreeNode": return _lc_to_tree(v)',
  '    return v',
  '',
  'def _lc_ret(t, v):',
  '    if t in ("ListNode", "TreeNode") and v is not None and not hasattr(v, "val"):',
  '        raise TypeError(f"回傳值的型別不對：應該回傳 {t} 或 None，但回傳了 {type(v).__name__}")',
  '    if t == "ListNode": return _lc_from_list(v)',
  '    if t == "TreeNode": return _lc_from_tree(v)',
  '    return v',
  '',
  'def _lc_fmt_exc(e):',
  '    tb = traceback.extract_tb(e.__traceback__)',
  '    frames = [f for f in tb if f.filename == "solution.py"]',
  '    lines = []',
  '    for f in frames[-3:]:',
  '        lines.append(f"  第 {f.lineno} 行，在 {f.name}" + (f"\\n    {f.line}" if f.line else ""))',
  '    head = "Traceback（只顯示你的程式碼）:\\n" if lines else ""',
  '    return head + "\\n".join(lines) + ("\\n" if lines else "") + f"{type(e).__name__}: {e}"',
  '',
  'def _lc_load(code):',
  '    global _lc_ns',
  '    ns = dict(_lc_base)',
  '    try:',
  '        exec(compile(code, "solution.py", "exec"), ns)',
  '    except SyntaxError as e:',
  '        return json.dumps({"error": f"第 {e.lineno} 行：{type(e).__name__}: {e.msg}" + (f"\\n    {e.text.rstrip()}" if e.text else "")})',
  '    except BaseException as e:',
  '        return json.dumps({"error": _lc_fmt_exc(e)})',
  '    _lc_ns = ns',
  '    return json.dumps({"ok": True})',
  '',
  'def _lc_run(spec_json, args_json):',
  '    spec = json.loads(spec_json); args = json.loads(args_json)',
  '    try:',
  '        if spec.get("design"):',
  '            cls = _lc_ns.get(spec["design"])',
  '            if cls is None:',
  '                return json.dumps({"error": f"找不到類別 {spec[\'design\']}"})',
  '            ops, argv = args',
  '            t0 = time.perf_counter()',
  '            obj = cls(*argv[0]); out = [None]',
  '            for op, a in zip(ops[1:], argv[1:]):',
  '                out.append(getattr(obj, op)(*a))',
  '            ms = (time.perf_counter() - t0) * 1000',
  '        else:',
  '            cls = _lc_ns.get("Solution")',
  '            if cls is None:',
  '                return json.dumps({"error": "找不到 class Solution"})',
  '            conv = [_lc_arg(t, v) for t, v in zip(spec["types"], args)]',
  '            t0 = time.perf_counter()',
  '            r = getattr(cls(), spec["fn"])(*conv)',
  '            ms = (time.perf_counter() - t0) * 1000',
  '            out = _lc_ret(spec["ret"], r)',
  '        return json.dumps({"ok": True, "out": out, "ms": ms})',
  '    except RecursionError as e:',
  '        return json.dumps({"error": _lc_fmt_exc(e) + "\\n（遞迴太深，可以改用迭代或顯式堆疊）"})',
  '    except BaseException as e:',
  '        return json.dumps({"error": _lc_fmt_exc(e)})',
].join('\n');

function loadPython() {
  if (!pyLoading) {
    pyLoading = (async function () {
      importScripts(PYODIDE_URL + 'pyodide.js');
      pyodide = await loadPyodide({ indexURL: PYODIDE_URL });
      pyodide.setStdout({ batched: function (s) { pyOut.push(s); } });
      pyodide.setStderr({ batched: function (s) { pyOut.push(s); } });
      pyodide.runPython(PY_PRELUDE);
      var ver = pyodide.runPython('import sys; sys.version.split()[0]');
      self.postMessage({ type: 'py-ready', version: ver });
    })().catch(function (err) {
      pyLoading = null;
      self.postMessage({ type: 'py-failed', error: String(err && err.message || err) });
      throw err;
    });
  }
  return pyLoading;
}

function fmtValue(v) {
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch (e) { return String(v); }
}

// new Function 會在使用者程式碼前加兩行，堆疊中的行號要減掉
function fmtJsError(err) {
  var msg = (err && err.name ? err.name + ': ' : '') + (err && err.message !== undefined ? err.message : String(err));
  var stack = (err && err.stack) || '';
  var m = stack.match(/<anonymous>:(\d+):(\d+)/);
  if (m) msg += '\n  第 ' + (Number(m[1]) - 2) + ' 行，第 ' + m[2] + ' 欄';
  if (err instanceof RangeError && /call stack/i.test(err.message)) msg += '\n（遞迴太深，可以改用迭代或顯式堆疊）';
  return msg;
}

function runJs(m) {
  var logs = [];
  var con = {};
  ['log', 'info', 'warn', 'error', 'debug'].forEach(function (k) {
    con[k] = function () { logs.push(Array.prototype.map.call(arguments, fmtValue).join(' ')); };
  });
  var name = m.design || m.fn, target;
  try {
    target = new Function('ListNode', 'TreeNode', 'console',
      m.code + '\n;return (typeof ' + name + ' !== "undefined") ? ' + name + ' : undefined;')(LC.ListNode, LC.TreeNode, con);
  } catch (err) {
    return { compileError: fmtJsError(err), stdout: logs.join('\n') };
  }
  if (typeof target !== 'function') {
    return { compileError: '找不到' + (m.design ? '類別 ' : '函式 ') + name + '，請不要更改它的名稱。', stdout: logs.join('\n') };
  }
  var results = [];
  for (var i = 0; i < m.cases.length; i++) {
    self.postMessage({ type: 'case', id: m.id, idx: i });
    logs.length = 0;
    var args = m.cases[i], t0, out;
    try {
      if (m.design) {
        var ops = args[0], argv = args[1];
        t0 = performance.now();
        var obj = new target(...argv[0]);
        out = [null];
        for (var k = 1; k < ops.length; k++) {
          if (typeof obj[ops[k]] !== 'function') throw new TypeError('找不到方法 ' + ops[k]);
          var r = obj[ops[k]](...argv[k]);
          out.push(r === undefined ? null : r);
        }
      } else {
        var conv = m.types.map(function (t, j) { return LC.convertArg(t, args[j]); });
        t0 = performance.now();
        out = target(...conv);
      }
      var ms = performance.now() - t0;
      out = m.design ? out : LC.convertRet(m.ret, out);
      out = JSON.parse(JSON.stringify(out === undefined ? null : out));
      results.push({ ok: true, out: out, ms: ms, stdout: logs.join('\n') });
    } catch (err) {
      results.push({ ok: false, error: fmtJsError(err), stdout: logs.join('\n') });
      if (m.stopOnError) break;
    }
  }
  return { results: results };
}

async function runPy(m) {
  await loadPython();
  pyOut = [];
  var load = JSON.parse(pyodide.globals.get('_lc_load')(m.code));
  if (load.error) return { compileError: load.error, stdout: pyOut.join('\n') };
  var spec = JSON.stringify({ fn: m.fn, design: m.design, types: m.types, ret: m.ret });
  var run = pyodide.globals.get('_lc_run');
  var results = [];
  for (var i = 0; i < m.cases.length; i++) {
    self.postMessage({ type: 'case', id: m.id, idx: i });
    pyOut = [];
    var r = JSON.parse(run(spec, JSON.stringify(m.cases[i])));
    var stdout = pyOut.join('\n');
    if (r.error) {
      results.push({ ok: false, error: r.error, stdout: stdout });
      if (m.stopOnError) break;
    } else {
      results.push({ ok: true, out: r.out, ms: r.ms, stdout: stdout });
    }
  }
  return { results: results };
}

self.onmessage = async function (e) {
  var m = e.data;
  if (m.type === 'preload-python') {
    loadPython().catch(function () {});
    return;
  }
  if (m.type !== 'run') return;
  try {
    var res = m.lang === 'python' ? await runPy(m) : runJs(m);
    res.type = 'result';
    res.id = m.id;
    self.postMessage(res);
  } catch (err) {
    self.postMessage({ type: 'result', id: m.id, fatal: String(err && err.message || err) });
  }
};
