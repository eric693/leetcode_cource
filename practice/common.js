/* 線上練習：資料結構轉換、呼叫方式與答案檢查（瀏覽器 Worker、主執行緒與建置腳本共用） */
(function (root) {
  'use strict';
  var MAX_NODES = 200000;

  function ListNode(val, next) {
    this.val = val === undefined ? 0 : val;
    this.next = next === undefined ? null : next;
  }
  function TreeNode(val, left, right) {
    this.val = val === undefined ? 0 : val;
    this.left = left === undefined ? null : left;
    this.right = right === undefined ? null : right;
  }
  // clone-graph 與 copy-random-list 的節點（LeetCode 的 JS/TS 都叫 _Node）
  function GraphNode(val, neighbors) {
    this.val = val === undefined ? 0 : val;
    this.neighbors = neighbors === undefined ? [] : neighbors;
  }
  function RandomNode(val, next, random) {
    this.val = val === undefined ? 0 : val;
    this.next = next === undefined ? null : next;
    this.random = random === undefined ? null : random;
  }

  function toList(a) {
    var head = null;
    for (var i = a.length - 1; i >= 0; i--) head = new ListNode(a[i], head);
    return head;
  }
  function fromList(h) {
    var out = [];
    while (h) {
      if (out.length >= MAX_NODES) throw new Error('鏈結串列過長，可能形成了環');
      out.push(h.val);
      h = h.next;
    }
    return out;
  }
  function toTree(a) {
    if (!a.length || a[0] === null) return null;
    var root = new TreeNode(a[0]), q = [root], head = 0, i = 1;
    while (head < q.length && i < a.length) {
      var n = q[head++];
      if (i < a.length && a[i] !== null) { n.left = new TreeNode(a[i]); q.push(n.left); }
      i++;
      if (i < a.length && a[i] !== null) { n.right = new TreeNode(a[i]); q.push(n.right); }
      i++;
    }
    return root;
  }
  function fromTree(r) {
    var out = [], q = [r], head = 0, count = 0;
    while (head < q.length) {
      var n = q[head++];
      if (!n) { out.push(null); continue; }
      if (++count > MAX_NODES) throw new Error('樹的節點過多，可能形成了環');
      out.push(n.val);
      q.push(n.left, n.right);
    }
    while (out.length && out[out.length - 1] === null) out.pop();
    return out;
  }

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function convertArg(type, v) {
    if (type === 'ListNode') return toList(v);
    if (type === 'TreeNode') return toTree(v);
    if (type === 'ListNode[]') return v.map(toList);
    return clone(v);
  }
  function checkNode(type, v, key) {
    if (v !== null && v !== undefined && (typeof v !== 'object' || !(key in v))) {
      var got = Array.isArray(v) ? 'array' : typeof v;
      throw new TypeError('回傳值的型別不對：應該回傳 ' + type + ' 或 null，但回傳了 ' + got);
    }
  }
  function convertRet(type, v) {
    if (v === undefined) return null;
    if (type === 'ListNode') { checkNode(type, v, 'next'); return fromList(v); }
    if (type === 'TreeNode') { checkNode(type, v, 'left'); return fromTree(v); }
    return v;
  }

  // 需要特殊建構輸入的題目：pre 把輸入轉成呼叫參數，post 把回傳值轉成可比對的輸出
  var adapters = {
    cycle: {
      pre: function (a) {
        var nodes = a[0].map(function (v) { return new ListNode(v); });
        for (var i = 0; i + 1 < nodes.length; i++) nodes[i].next = nodes[i + 1];
        if (a[1] >= 0 && nodes.length) nodes[nodes.length - 1].next = nodes[a[1]];
        return { call: [nodes[0] || null], ctx: nodes };
      },
      post: function (r) { return r; },
    },
    'cycle-node': {
      pre: function (a) { return adapters.cycle.pre(a); },
      post: function (r, nodes) {
        if (r === null || r === undefined) return -1;
        var i = nodes.indexOf(r);
        if (i < 0) throw new TypeError('回傳的節點不在原本的串列中');
        return i;
      },
    },
    intersect: {
      pre: function (a) {
        var A = a[1].map(function (v) { return new ListNode(v); });
        var B = a[2].map(function (v) { return new ListNode(v); });
        for (var i = 0; i + 1 < A.length; i++) A[i].next = A[i + 1];
        for (var j = 0; j + 1 < B.length; j++) B[j].next = B[j + 1];
        var shared = null;
        if (a[0] !== 0 && a[3] < A.length && a[4] < B.length) {
          shared = A[a[3]];
          if (a[4] === 0) B = [shared]; else B[a[4] - 1].next = shared;
        }
        return { call: [A[0] || null, B[0] || null], ctx: { shared: shared, A: A } };
      },
      post: function (r, ctx) {
        if (r === null || r === undefined) return null;
        if (r !== ctx.shared) throw new TypeError('回傳的節點不是兩條串列真正共用的那個節點');
        return r.val;
      },
    },
    lca: {
      pre: function (a) {
        var rt = toTree(a[0]), p = null, q = null, st = rt ? [rt] : [];
        while (st.length) {
          var n = st.pop();
          if (n.val === a[1]) p = n;
          if (n.val === a[2]) q = n;
          if (n.left) st.push(n.left);
          if (n.right) st.push(n.right);
        }
        return { call: [rt, p, q], ctx: null };
      },
      post: function (r) {
        if (r === null || r === undefined) return null;
        checkNode('TreeNode', r, 'left');
        return r.val;
      },
    },
    graph: {
      pre: function (a) {
        var nodes = a[0].map(function (_, i) { return new GraphNode(i + 1); });
        a[0].forEach(function (nb, i) { nodes[i].neighbors = nb.map(function (v) { return nodes[v - 1]; }); });
        return { call: [nodes[0] || null], ctx: nodes };
      },
      post: function (r, orig) {
        if (r === null || r === undefined) return [];
        var seen = new Map(), q = [r];
        seen.set(r.val, r);
        while (q.length) {
          var n = q.shift();
          if (orig.indexOf(n) >= 0) throw new TypeError('回傳的圖沿用了原本的節點，不是深拷貝');
          (n.neighbors || []).forEach(function (x) {
            if (!seen.has(x.val)) { seen.set(x.val, x); q.push(x); }
          });
        }
        var out = [];
        for (var v = 1; v <= seen.size; v++) {
          var node = seen.get(v);
          if (!node) throw new TypeError('回傳的圖少了值為 ' + v + ' 的節點');
          out.push(node.neighbors.map(function (x) { return x.val; }));
        }
        return out;
      },
    },
    random: {
      pre: function (a) {
        var nodes = a[0].map(function (p) { return new RandomNode(p[0]); });
        a[0].forEach(function (p, i) {
          nodes[i].next = nodes[i + 1] || null;
          nodes[i].random = p[1] === null ? null : nodes[p[1]];
        });
        return { call: [nodes[0] || null], ctx: nodes };
      },
      post: function (r, orig) {
        var list = [];
        for (var h = r; h; h = h.next) {
          if (list.length > MAX_NODES) throw new Error('鏈結串列過長，可能形成了環');
          if (orig.indexOf(h) >= 0) throw new TypeError('回傳的串列沿用了原本的節點，不是深拷貝');
          list.push(h);
        }
        return list.map(function (n) {
          if (n.random && orig.indexOf(n.random) >= 0) throw new TypeError('random 指向了原本串列的節點，不是深拷貝');
          var k = n.random ? list.indexOf(n.random) : null;
          if (k === -1) throw new TypeError('random 指向了不在新串列中的節點');
          return [n.val, k];
        });
      },
    },
  };

  function nodeClassFor(adapter) {
    if (adapter === 'graph') return GraphNode;
    if (adapter === 'random') return RandomNode;
    return GraphNode;
  }

  // 依題目設定呼叫使用者的程式碼，回傳可比對的輸出
  function invoke(spec, target, args) {
    var out, i;
    if (spec.design) {
      var ops = args[0], argv = args[1];
      var obj = new target(...argv[0]);
      out = [null];
      for (i = 1; i < ops.length; i++) {
        if (typeof obj[ops[i]] !== 'function') throw new TypeError('找不到方法 ' + ops[i]);
        var r = obj[ops[i]](...argv[i]);
        out.push(r === undefined ? null : r);
      }
      return clone(out);
    }
    if (spec.codec) {
      var s = target.serialize(toTree(args[0]));
      if (typeof s !== 'string') throw new TypeError('serialize 必須回傳字串，但回傳了 ' + (s === null ? 'null' : typeof s));
      return convertRet('TreeNode', target.deserialize(s));
    }
    if (spec.adapter) {
      var ad = adapters[spec.adapter];
      var prep = ad.pre(clone(args));
      return clone(ad.post(target(...prep.call), prep.ctx));
    }
    var conv = spec.types.map(function (t, j) { return convertArg(t, args[j]); });
    var ret = target(...conv);
    if (spec.inplace !== undefined && spec.inplace !== null) {
      return clone(convertRet(spec.types[spec.inplace], conv[spec.inplace]));
    }
    if (spec.kprefix) {
      if (typeof ret !== 'number' || ret < 0 || ret > conv[0].length || ret % 1) throw new TypeError('回傳值必須是 0 到 nums.length 之間的整數 k');
      return [ret, conv[0].slice(0, ret)];
    }
    out = convertRet(spec.ret, ret);
    return clone(out === undefined ? null : out);
  }

  // ---------- 答案檢查 ----------
  function byJson(a, b) {
    var x = JSON.stringify(a), y = JSON.stringify(b);
    return x < y ? -1 : x > y ? 1 : 0;
  }
  function normalize(cmp, v) {
    if (cmp === 'u32' && typeof v === 'number') return v >>> 0;
    if (!Array.isArray(v)) return v;
    if (cmp === 'sorted') return v.slice().sort(byJson);
    if (cmp === 'outer') return v.slice().sort(byJson);
    if (cmp === 'groups') {
      return v.map(function (g) { return Array.isArray(g) ? g.slice().sort(byJson) : g; }).sort(byJson);
    }
    if (cmp === 'kprefix-sorted' && v.length === 2 && Array.isArray(v[1])) return [v[0], v[1].slice().sort(byJson)];
    return v;
  }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  var checkers = {
    float: function (g, e) { return typeof g === 'number' && Math.abs(g - e) <= 1e-5 * Math.max(1, Math.abs(e)); },
    peak: function (g, e, a) {
      var n = a[0];
      if (typeof g !== 'number' || g % 1 || g < 0 || g >= n.length) return false;
      return (g === 0 || n[g] > n[g - 1]) && (g === n.length - 1 || n[g] > n[g + 1]);
    },
    topo: function (g, e, a) {
      if (!Array.isArray(g)) return false;
      if (!e.length) return g.length === 0;
      var n = a[0];
      if (g.length !== n) return false;
      var pos = new Array(n).fill(-1);
      for (var i = 0; i < g.length; i++) {
        if (typeof g[i] !== 'number' || g[i] < 0 || g[i] >= n || pos[g[i]] !== -1) return false;
        pos[g[i]] = i;
      }
      return a[1].every(function (p) { return pos[p[1]] < pos[p[0]]; });
    },
    palin: function (g, e, a) {
      return typeof g === 'string' && g.length === e.length && a[0].indexOf(g) >= 0 && g === g.split('').reverse().join('');
    },
    window: function (g, e, a) {
      if (typeof g !== 'string' || g.length !== e.length) return false;
      if (!e.length) return g === '';
      if (a[0].indexOf(g) < 0) return false;
      var need = {};
      a[1].split('').forEach(function (c) { need[c] = (need[c] || 0) + 1; });
      g.split('').forEach(function (c) { if (need[c]) need[c]--; });
      return Object.keys(need).every(function (k) { return need[k] === 0; });
    },
    sudoku: function (g, e, a) {
      if (!Array.isArray(g) || g.length !== 9) return false;
      for (var i = 0; i < 9; i++) {
        if (!Array.isArray(g[i]) || g[i].length !== 9) return false;
        for (var j = 0; j < 9; j++) if (a[0][i][j] !== '.' && a[0][i][j] !== g[i][j]) return false;
      }
      var ok = function (cells) { return cells.slice().sort().join('') === '123456789'; };
      for (var k = 0; k < 9; k++) {
        var row = g[k], col = g.map(function (r) { return r[k]; }), box = [];
        for (var x = 0; x < 3; x++) for (var y = 0; y < 3; y++) box.push(g[Math.floor(k / 3) * 3 + x][(k % 3) * 3 + y]);
        if (!ok(row) || !ok(col) || !ok(box)) return false;
      }
      return true;
    },
  };

  function check(cmp, got, expected, args) {
    if (checkers[cmp]) {
      try { return !!checkers[cmp](got, expected, args); } catch (e) { return false; }
    }
    return same(normalize(cmp, got), normalize(cmp, expected));
  }
  // 舊介面
  function equal(cmp, got, expected) { return check(cmp, got, expected, []); }

  var api = {
    ListNode: ListNode, TreeNode: TreeNode, GraphNode: GraphNode, RandomNode: RandomNode, nodeClassFor: nodeClassFor,
    toList: toList, fromList: fromList, toTree: toTree, fromTree: fromTree,
    convertArg: convertArg, convertRet: convertRet, normalize: normalize, invoke: invoke, check: check, equal: equal,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LC = api;
})(typeof self !== 'undefined' ? self : globalThis);
