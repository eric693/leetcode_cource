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
  'class _LCGraphNode:',
  '    def __init__(self, val=0, neighbors=None):',
  '        self.val = val',
  '        self.neighbors = neighbors if neighbors is not None else []',
  '',
  'class _LCRandomNode:',
  '    def __init__(self, x=0, next=None, random=None):',
  '        self.val = int(x)',
  '        self.next = next',
  '        self.random = random',
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
  '    if t == "ListNode[]": return [_lc_to_list(x) for x in v]',
  '    return v',
  '',
  'def _lc_ret(t, v):',
  '    if t in ("ListNode", "TreeNode") and v is not None and not hasattr(v, "val"):',
  '        raise TypeError(f"回傳值的型別不對：應該回傳 {t} 或 None，但回傳了 {type(v).__name__}")',
  '    if t == "ListNode": return _lc_from_list(v)',
  '    if t == "TreeNode": return _lc_from_tree(v)',
  '    return v',
  '',
  'def _lc_find(nodes, x):',
  '    for i, n in enumerate(nodes):',
  '        if n is x: return i',
  '    return -1',
  '',
  'def _lc_adapt(name, a, call):',
  '    if name in ("cycle", "cycle-node"):',
  '        nodes = [ListNode(v) for v in a[0]]',
  '        for i in range(len(nodes) - 1): nodes[i].next = nodes[i + 1]',
  '        if a[1] >= 0 and nodes: nodes[-1].next = nodes[a[1]]',
  '        r = call(nodes[0] if nodes else None)',
  '        if name == "cycle": return r',
  '        if r is None: return -1',
  '        i = _lc_find(nodes, r)',
  '        if i < 0: raise TypeError("回傳的節點不在原本的串列中")',
  '        return i',
  '    if name == "intersect":',
  '        A = [ListNode(v) for v in a[1]]; B = [ListNode(v) for v in a[2]]',
  '        for i in range(len(A) - 1): A[i].next = A[i + 1]',
  '        for i in range(len(B) - 1): B[i].next = B[i + 1]',
  '        shared = None',
  '        if a[0] != 0 and a[3] < len(A) and a[4] < len(B):',
  '            shared = A[a[3]]',
  '            if a[4] == 0: B = [shared]',
  '            else: B[a[4] - 1].next = shared',
  '        r = call(A[0] if A else None, B[0] if B else None)',
  '        if r is None: return None',
  '        if r is not shared: raise TypeError("回傳的節點不是兩條串列真正共用的那個節點")',
  '        return r.val',
  '    if name == "lca":',
  '        root = _lc_to_tree(a[0]); p = q = None; st = [root] if root else []',
  '        while st:',
  '            n = st.pop()',
  '            if n.val == a[1]: p = n',
  '            if n.val == a[2]: q = n',
  '            if n.left: st.append(n.left)',
  '            if n.right: st.append(n.right)',
  '        r = call(root, p, q)',
  '        return None if r is None else r.val',
  '    if name == "graph":',
  '        nodes = [_LCGraphNode(i + 1) for i in range(len(a[0]))]',
  '        for i, nb in enumerate(a[0]): nodes[i].neighbors = [nodes[v - 1] for v in nb]',
  '        r = call(nodes[0] if nodes else None)',
  '        if r is None: return []',
  '        ids = set(id(n) for n in nodes); seen = {r.val: r}; q = deque([r])',
  '        while q:',
  '            n = q.popleft()',
  '            if id(n) in ids: raise TypeError("回傳的圖沿用了原本的節點，不是深拷貝")',
  '            for x in (n.neighbors or []):',
  '                if x.val not in seen: seen[x.val] = x; q.append(x)',
  '        out = []',
  '        for v in range(1, len(seen) + 1):',
  '            if v not in seen: raise TypeError(f"回傳的圖少了值為 {v} 的節點")',
  '            out.append([x.val for x in seen[v].neighbors])',
  '        return out',
  '    if name == "random":',
  '        nodes = [_LCRandomNode(p[0]) for p in a[0]]',
  '        for i, p in enumerate(a[0]):',
  '            nodes[i].next = nodes[i + 1] if i + 1 < len(nodes) else None',
  '            nodes[i].random = None if p[1] is None else nodes[p[1]]',
  '        r = call(nodes[0] if nodes else None)',
  '        ids = set(id(n) for n in nodes); lst = []; h = r',
  '        while h is not None:',
  '            if len(lst) > 200000: raise RuntimeError("鏈結串列過長，可能形成了環")',
  '            if id(h) in ids: raise TypeError("回傳的串列沿用了原本的節點，不是深拷貝")',
  '            lst.append(h); h = h.next',
  '        pos = {id(n): i for i, n in enumerate(lst)}; out = []',
  '        for n in lst:',
  '            if n.random is not None and id(n.random) in ids: raise TypeError("random 指向了原本串列的節點，不是深拷貝")',
  '            if n.random is not None and id(n.random) not in pos: raise TypeError("random 指向了不在新串列中的節點")',
  '            out.append([n.val, None if n.random is None else pos[id(n.random)]])',
  '        return out',
  '    raise RuntimeError("unknown adapter " + name)',
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
  'def _lc_load(code, adapter=None):',
  '    global _lc_ns',
  '    ns = dict(_lc_base)',
  '    if adapter == "graph": ns["Node"] = _LCGraphNode',
  '    if adapter == "random": ns["Node"] = _LCRandomNode',
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
  '        t0 = time.perf_counter()',
  '        if spec.get("design"):',
  '            cls = _lc_ns.get(spec["design"])',
  '            if cls is None:',
  '                return json.dumps({"error": f"找不到類別 {spec[\'design\']}"})',
  '            ops, argv = args',
  '            obj = cls(*argv[0]); out = [None]',
  '            for op, a in zip(ops[1:], argv[1:]):',
  '                if not hasattr(obj, op): raise AttributeError(f"找不到方法 {op}")',
  '                out.append(getattr(obj, op)(*a))',
  '        elif spec.get("codec"):',
  '            cls = _lc_ns.get("Codec")',
  '            if cls is None:',
  '                return json.dumps({"error": "找不到 class Codec"})',
  '            s = cls().serialize(_lc_to_tree(args[0]))',
  '            if not isinstance(s, str): raise TypeError(f"serialize 必須回傳字串，但回傳了 {type(s).__name__}")',
  '            out = _lc_ret("TreeNode", cls().deserialize(s))',
  '        else:',
  '            cls = _lc_ns.get("Solution")',
  '            if cls is None:',
  '                return json.dumps({"error": "找不到 class Solution"})',
  '            fn = getattr(cls(), spec["fn"], None)',
  '            if fn is None:',
  '                return json.dumps({"error": f"找不到方法 {spec[\'fn\']}，請不要更改它的名稱"})',
  '            if spec.get("adapter"):',
  '                out = _lc_adapt(spec["adapter"], args, fn)',
  '            else:',
  '                conv = [_lc_arg(t, v) for t, v in zip(spec["types"], args)]',
  '                r = fn(*conv)',
  '                if spec.get("inplace") is not None:',
  '                    out = _lc_ret(spec["types"][spec["inplace"]], conv[spec["inplace"]])',
  '                elif spec.get("kprefix"):',
  '                    if not isinstance(r, int) or r < 0 or r > len(conv[0]): raise TypeError("回傳值必須是 0 到 len(nums) 之間的整數 k")',
  '                    out = [r, conv[0][:r]]',
  '                else:',
  '                    out = _lc_ret(spec["ret"], r)',
  '        ms = (time.perf_counter() - t0) * 1000',
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
  var names = m.codec ? ['serialize', 'deserialize'] : [m.design || m.fn];
  var target;
  try {
    var ret = names.map(function (n) { return n + ': (typeof ' + n + ' !== "undefined") ? ' + n + ' : undefined'; }).join(', ');
    var got = new Function('ListNode', 'TreeNode', '_Node', 'Node', 'console',
      m.code + '\n;return { ' + ret + ' };')(LC.ListNode, LC.TreeNode, LC.nodeClassFor(m.adapter), LC.nodeClassFor(m.adapter), con);
    var missing = names.filter(function (n) { return typeof got[n] !== 'function'; });
    if (missing.length) {
      return { compileError: '找不到' + (m.design ? '類別 ' : '函式 ') + missing.join('、') + '，請不要更改它的名稱。', stdout: logs.join('\n') };
    }
    target = m.codec ? got : got[names[0]];
  } catch (err) {
    return { compileError: fmtJsError(err), stdout: logs.join('\n') };
  }
  var results = [];
  for (var i = 0; i < m.cases.length; i++) {
    self.postMessage({ type: 'case', id: m.id, idx: i });
    logs.length = 0;
    try {
      var t0 = performance.now();
      var out = LC.invoke(m, target, m.cases[i]);
      results.push({ ok: true, out: out, ms: performance.now() - t0, stdout: logs.join('\n') });
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
  var load = JSON.parse(pyodide.globals.get('_lc_load')(m.code, m.adapter || null));
  if (load.error) return { compileError: load.error, stdout: pyOut.join('\n') };
  var spec = JSON.stringify({ fn: m.fn, design: m.design, codec: m.codec, adapter: m.adapter, inplace: m.inplace, kprefix: m.kprefix, types: m.types, ret: m.ret });
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
