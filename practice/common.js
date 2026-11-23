/* 線上練習：資料結構轉換與答案比對（瀏覽器 Worker、主執行緒與建置腳本共用） */
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

  function convertArg(type, v) {
    if (type === 'ListNode') return toList(v);
    if (type === 'TreeNode') return toTree(v);
    return JSON.parse(JSON.stringify(v));
  }
  function checkNode(type, v, key) {
    if (v !== null && (typeof v !== 'object' || !(key in v))) {
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

  function byJson(a, b) {
    var x = JSON.stringify(a), y = JSON.stringify(b);
    return x < y ? -1 : x > y ? 1 : 0;
  }
  function normalize(cmp, v) {
    if (!Array.isArray(v)) return v;
    if (cmp === 'sorted') return v.slice().sort(byJson);
    if (cmp === 'groups') {
      return v.map(function (g) { return Array.isArray(g) ? g.slice().sort() : g; }).sort(byJson);
    }
    return v;
  }
  function equal(cmp, got, expected) {
    return JSON.stringify(normalize(cmp, got)) === JSON.stringify(normalize(cmp, expected));
  }

  var api = {
    ListNode: ListNode, TreeNode: TreeNode,
    toList: toList, fromList: fromList, toTree: toTree, fromTree: fromTree,
    convertArg: convertArg, convertRet: convertRet, normalize: normalize, equal: equal,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LC = api;
})(typeof self !== 'undefined' ? self : globalThis);
