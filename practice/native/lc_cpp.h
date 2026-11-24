/* 線上練習判題用：C++ 的預設標頭、資料結構與轉換函式（比照 LeetCode 環境） */
#pragma once
#include <algorithm>
#include <array>
#include <bitset>
#include <climits>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <deque>
#include <functional>
#include <iostream>
#include <list>
#include <map>
#include <numeric>
#include <queue>
#include <set>
#include <sstream>
#include <stack>
#include <string>
#include <tuple>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>
#include "lcjson.h"
using namespace std;

struct ListNode {
    int val;
    ListNode *next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode *next) : val(x), next(next) {}
};
struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode() : val(0), left(nullptr), right(nullptr) {}
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
    TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}
};
/* ---------- JSON → C++ ---------- */
namespace lcx {
template <class T> struct Tag {};
inline int get(LJ *v, Tag<int>) { return (int)v->i; }
inline long long get(LJ *v, Tag<long long>) { return v->i; }
inline uint32_t get(LJ *v, Tag<uint32_t>) { return (uint32_t)v->i; }
inline double get(LJ *v, Tag<double>) { return v->d; }
inline bool get(LJ *v, Tag<bool>) { return v->i != 0; }
inline char get(LJ *v, Tag<char>) { return v->n ? v->s[0] : 0; }
inline string get(LJ *v, Tag<string>) { return string(v->s, v->n); }
inline ListNode *get(LJ *v, Tag<ListNode *>) {
    ListNode *h = nullptr;
    for (int i = v->n - 1; i >= 0; i--) h = new ListNode((int)v->a[i].i, h);
    return h;
}
inline TreeNode *get(LJ *v, Tag<TreeNode *>) {
    if (v->n == 0 || v->a[0].t == LJ_NULL) return nullptr;
    vector<TreeNode *> q;
    TreeNode *root = new TreeNode((int)v->a[0].i);
    q.push_back(root);
    size_t h = 0;
    int i = 1;
    while (h < q.size() && i < v->n) {
        TreeNode *x = q[h++];
        if (i < v->n && v->a[i].t != LJ_NULL) { x->left = new TreeNode((int)v->a[i].i); q.push_back(x->left); }
        i++;
        if (i < v->n && v->a[i].t != LJ_NULL) { x->right = new TreeNode((int)v->a[i].i); q.push_back(x->right); }
        i++;
    }
    return root;
}
template <class T> vector<T> get(LJ *v, Tag<vector<T>>) {
    vector<T> out;
    out.reserve(v->n);
    for (int i = 0; i < v->n; i++) out.push_back(get(&v->a[i], Tag<T>()));
    return out;
}
template <class T> T from(LJ *v) { return get(v, Tag<T>()); }

/* ---------- C++ → JSON ---------- */
inline void put(LB *o, int x) { lb_ll(o, x); }
inline void put(LB *o, long x) { lb_ll(o, x); }
inline void put(LB *o, long long x) { lb_ll(o, x); }
inline void put(LB *o, unsigned x) { lb_ull(o, x); }
inline void put(LB *o, unsigned long x) { lb_ull(o, x); }
inline void put(LB *o, unsigned long long x) { lb_ull(o, x); }
inline void put(LB *o, double x) { lb_dbl(o, x); }
inline void put(LB *o, bool x) { lb_bool(o, x); }
inline void put(LB *o, char x) { lb_strn(o, &x, 1); }
inline void put(LB *o, const string &s) { lb_strn(o, s.data(), (int)s.size()); }
inline void put(LB *o, const char *s) { lb_str(o, s); }
inline void put(LB *o, ListNode *h) {
    lb_ch(o, '[');
    int k = 0;
    for (; h; h = h->next) {
        if (++k > 200000) { lb_put(o, "\"串列過長，可能形成了環\""); break; }
        if (k > 1) lb_ch(o, ',');
        lb_ll(o, h->val);
    }
    lb_ch(o, ']');
}
inline void put(LB *o, TreeNode *r) {
    if (!r) { lb_put(o, "[]"); return; }
    vector<TreeNode *> q{r};
    vector<string> parts;
    size_t h = 0, last = 0;
    while (h < q.size() && parts.size() < 400000) {
        TreeNode *x = q[h++];
        if (!x) { parts.push_back("null"); continue; }
        parts.push_back(to_string(x->val));
        last = parts.size();
        q.push_back(x->left);
        q.push_back(x->right);
    }
    lb_ch(o, '[');
    for (size_t i = 0; i < last; i++) { if (i) lb_ch(o, ','); lb_put(o, parts[i].c_str()); }
    lb_ch(o, ']');
}
template <class T> void put(LB *o, const vector<T> &v) {
    lb_ch(o, '[');
    for (size_t i = 0; i < v.size(); i++) { if (i) lb_ch(o, ','); put(o, (T)v[i]); }
    lb_ch(o, ']');
}
inline void put(LB *o, const vector<bool> &v) {
    lb_ch(o, '[');
    for (size_t i = 0; i < v.size(); i++) { if (i) lb_ch(o, ','); lb_bool(o, v[i]); }
    lb_ch(o, ']');
}
inline void putNull(LB *o) { lb_put(o, "null"); }
}  // namespace lcx
