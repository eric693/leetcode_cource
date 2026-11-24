/* 線上練習判題用：C 的預設標頭、資料結構與轉換函式 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <stdint.h>
#include <limits.h>
#include <math.h>
#include <ctype.h>
#include "lcjson.h"

struct ListNode { int val; struct ListNode *next; };
struct TreeNode { int val; struct TreeNode *left; struct TreeNode *right; };
#ifdef LC_GRAPH_NODE
struct Node { int val; int numNeighbors; struct Node **neighbors; };
#endif
#ifdef LC_RANDOM_NODE
struct Node { int val; struct Node *next; struct Node *random; };
#endif

/* ---------- JSON → C ---------- */
static int lcc_int(LJ *v) { return (int)v->i; }
static uint32_t lcc_u32(LJ *v) { return (uint32_t)v->i; }
static bool lcc_bool(LJ *v) { return v->i != 0; }
static char *lcc_str(LJ *v) { char *s = (char *)malloc(v->n + 1); memcpy(s, v->s, v->n + 1); return s; }
static char lcc_char(LJ *v) { return v->n ? v->s[0] : 0; }
static int *lcc_iarr(LJ *v, int *n) {
    *n = v->n;
    int *a = (int *)malloc(sizeof(int) * (v->n + 1));
    for (int i = 0; i < v->n; i++) a[i] = (int)v->a[i].i;
    return a;
}
static int **lcc_igrid(LJ *v, int *rows, int **cols) {
    *rows = v->n;
    *cols = (int *)malloc(sizeof(int) * (v->n + 1));
    int **g = (int **)malloc(sizeof(int *) * (v->n + 1));
    for (int i = 0; i < v->n; i++) g[i] = lcc_iarr(&v->a[i], &(*cols)[i]);
    return g;
}
static char **lcc_sarr(LJ *v, int *n) {
    *n = v->n;
    char **a = (char **)malloc(sizeof(char *) * (v->n + 1));
    for (int i = 0; i < v->n; i++) a[i] = lcc_str(&v->a[i]);
    return a;
}
/* 字元陣列：每個元素是長度 1 的字串 */
static char *lcc_carr(LJ *v, int *n) {
    *n = v->n;
    char *a = (char *)malloc(v->n + 1);
    for (int i = 0; i < v->n; i++) a[i] = lcc_char(&v->a[i]);
    a[v->n] = 0;
    return a;
}
static char **lcc_cgrid(LJ *v, int *rows, int **cols) {
    *rows = v->n;
    *cols = (int *)malloc(sizeof(int) * (v->n + 1));
    char **g = (char **)malloc(sizeof(char *) * (v->n + 1));
    for (int i = 0; i < v->n; i++) g[i] = lcc_carr(&v->a[i], &(*cols)[i]);
    return g;
}
static struct ListNode *lcc_list(LJ *v) {
    struct ListNode *head = NULL;
    for (int i = v->n - 1; i >= 0; i--) {
        struct ListNode *x = (struct ListNode *)malloc(sizeof(struct ListNode));
        x->val = (int)v->a[i].i; x->next = head; head = x;
    }
    return head;
}
static struct ListNode **lcc_lists(LJ *v, int *n) {
    *n = v->n;
    struct ListNode **a = (struct ListNode **)malloc(sizeof(void *) * (v->n + 1));
    for (int i = 0; i < v->n; i++) a[i] = lcc_list(&v->a[i]);
    return a;
}
static struct TreeNode *lcc_newt(int x) { struct TreeNode *t = (struct TreeNode *)calloc(1, sizeof(struct TreeNode)); t->val = x; return t; }
static struct TreeNode *lcc_tree(LJ *v) {
    if (v->n == 0 || v->a[0].t == LJ_NULL) return NULL;
    struct TreeNode **q = (struct TreeNode **)malloc(sizeof(void *) * (v->n + 1));
    int h = 0, t = 0, i = 1;
    struct TreeNode *root = lcc_newt((int)v->a[0].i);
    q[t++] = root;
    while (h < t && i < v->n) {
        struct TreeNode *x = q[h++];
        if (i < v->n && v->a[i].t != LJ_NULL) { x->left = lcc_newt((int)v->a[i].i); q[t++] = x->left; }
        i++;
        if (i < v->n && v->a[i].t != LJ_NULL) { x->right = lcc_newt((int)v->a[i].i); q[t++] = x->right; }
        i++;
    }
    free(q);
    return root;
}

/* ---------- C → JSON ---------- */
static void lbc_iarr(LB *o, const int *a, int n) {
    lb_ch(o, '[');
    for (int i = 0; i < n; i++) { if (i) lb_ch(o, ','); lb_ll(o, a[i]); }
    lb_ch(o, ']');
}
static void lbc_igrid(LB *o, int **g, int n, const int *cols) {
    lb_ch(o, '[');
    for (int i = 0; i < n; i++) { if (i) lb_ch(o, ','); lbc_iarr(o, g[i], cols ? cols[i] : 0); }
    lb_ch(o, ']');
}
static void lbc_sarr(LB *o, char **a, int n) {
    lb_ch(o, '[');
    for (int i = 0; i < n; i++) { if (i) lb_ch(o, ','); lb_str(o, a[i]); }
    lb_ch(o, ']');
}
static void lbc_sgrid(LB *o, char ***g, int n, const int *cols) {
    lb_ch(o, '[');
    for (int i = 0; i < n; i++) { if (i) lb_ch(o, ','); lbc_sarr(o, g[i], cols ? cols[i] : 0); }
    lb_ch(o, ']');
}
static void lbc_carr(LB *o, const char *a, int n) {
    lb_ch(o, '[');
    for (int i = 0; i < n; i++) { if (i) lb_ch(o, ','); lb_strn(o, a + i, 1); }
    lb_ch(o, ']');
}
static void lbc_cgrid(LB *o, char **g, int n, const int *cols) {
    lb_ch(o, '[');
    for (int i = 0; i < n; i++) { if (i) lb_ch(o, ','); lbc_carr(o, g[i], cols[i]); }
    lb_ch(o, ']');
}
static void lbc_list(LB *o, struct ListNode *h) {
    lb_ch(o, '[');
    int k = 0;
    for (; h; h = h->next) {
        if (++k > 200000) { lb_put(o, "\"串列過長，可能形成了環\""); break; }
        if (k > 1) lb_ch(o, ',');
        lb_ll(o, h->val);
    }
    lb_ch(o, ']');
}
static void lbc_tree(LB *o, struct TreeNode *r) {
    int cap = 64, h = 0, t = 0;
    struct TreeNode **q = (struct TreeNode **)malloc(sizeof(void *) * cap);
    q[t++] = r;
    LB tmp = {0};
    int lastLen = 0, count = 0;
    lb_ch(&tmp, '[');
    while (h < t) {
        struct TreeNode *x = q[h++];
        if (h > 1) lb_ch(&tmp, ',');
        if (!x) { lb_put(&tmp, "null"); continue; }
        if (++count > 200000) break;
        lb_ll(&tmp, x->val);
        lastLen = (int)tmp.n;
        if (t + 2 > cap) { cap *= 2; q = (struct TreeNode **)realloc(q, sizeof(void *) * cap); }
        q[t++] = x->left; q[t++] = x->right;
    }
    free(q);
    if (!r) { lb_put(o, "[]"); free(tmp.b); return; }
    tmp.b[lastLen] = 0;
    tmp.n = lastLen;
    lb_put(o, tmp.b);
    lb_ch(o, ']');
    free(tmp.b);
}
