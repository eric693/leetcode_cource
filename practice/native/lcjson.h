/* 線上練習判題用：極簡 JSON 讀寫（C 與 C++ 共用） */
#ifndef LCJSON_H
#define LCJSON_H
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <time.h>

#ifdef __cplusplus
extern "C" {
#endif

enum { LJ_NULL, LJ_BOOL, LJ_INT, LJ_DBL, LJ_STR, LJ_ARR };
typedef struct LJ {
    int t;
    long long i;
    double d;
    char *s;
    int n;
    struct LJ *a;
} LJ;

static void lj_ws(const char **p) { while (**p == ' ' || **p == '\n' || **p == '\r' || **p == '\t') (*p)++; }

static LJ *lj_parse(const char **p) {
    LJ *v = (LJ *)calloc(1, sizeof(LJ));
    lj_ws(p);
    char c = **p;
    if (c == 'n') { *p += 4; v->t = LJ_NULL; }
    else if (c == 't') { *p += 4; v->t = LJ_BOOL; v->i = 1; }
    else if (c == 'f') { *p += 5; v->t = LJ_BOOL; v->i = 0; }
    else if (c == '"') {
        (*p)++;
        size_t cap = 16, len = 0;
        char *s = (char *)malloc(cap);
        while (**p && **p != '"') {
            char ch = **p;
            if (ch == '\\') {
                (*p)++;
                char e = **p;
                if (e == 'n') ch = '\n'; else if (e == 't') ch = '\t'; else if (e == 'r') ch = '\r';
                else if (e == 'b') ch = '\b'; else if (e == 'f') ch = '\f';
                else if (e == 'u') {
                    char hex[5] = {(*p)[1], (*p)[2], (*p)[3], (*p)[4], 0};
                    unsigned code = (unsigned)strtoul(hex, NULL, 16);
                    *p += 4;
                    ch = (char)(code < 128 ? code : '?');
                } else ch = e;
            }
            if (len + 2 > cap) { cap *= 2; s = (char *)realloc(s, cap); }
            s[len++] = ch;
            (*p)++;
        }
        (*p)++;
        s[len] = 0;
        v->t = LJ_STR; v->s = s; v->n = (int)len;
    } else if (c == '[') {
        (*p)++;
        int cap = 4;
        v->t = LJ_ARR;
        v->a = (LJ *)malloc(sizeof(LJ) * cap);
        lj_ws(p);
        if (**p == ']') { (*p)++; return v; }
        for (;;) {
            LJ *x = lj_parse(p);
            if (v->n == cap) { cap *= 2; v->a = (LJ *)realloc(v->a, sizeof(LJ) * cap); }
            v->a[v->n++] = *x;
            free(x);
            lj_ws(p);
            if (**p == ',') { (*p)++; continue; }
            (*p)++;
            break;
        }
    } else {
        char *end;
        const char *q = *p;
        int isd = 0;
        while (*q && (*q == '-' || *q == '+' || *q == '.' || *q == 'e' || *q == 'E' || (*q >= '0' && *q <= '9'))) {
            if (*q == '.' || *q == 'e' || *q == 'E') isd = 1;
            q++;
        }
        if (isd) { v->t = LJ_DBL; v->d = strtod(*p, &end); }
        else { v->t = LJ_INT; v->i = strtoll(*p, &end, 10); v->d = (double)v->i; }
        *p = end;
    }
    return v;
}

/* ---------- 輸出緩衝 ---------- */
typedef struct { char *b; size_t n, cap; } LB;
static void lb_grow(LB *o, size_t k) {
    if (o->n + k + 1 > o->cap) {
        o->cap = (o->cap ? o->cap * 2 : 256);
        while (o->n + k + 1 > o->cap) o->cap *= 2;
        o->b = (char *)realloc(o->b, o->cap);
    }
}
static void lb_put(LB *o, const char *s) { size_t k = strlen(s); lb_grow(o, k); memcpy(o->b + o->n, s, k); o->n += k; o->b[o->n] = 0; }
static void lb_ch(LB *o, char c) { lb_grow(o, 1); o->b[o->n++] = c; o->b[o->n] = 0; }
static void lb_ll(LB *o, long long x) { char t[32]; snprintf(t, sizeof t, "%lld", x); lb_put(o, t); }
static void lb_ull(LB *o, unsigned long long x) { char t[32]; snprintf(t, sizeof t, "%llu", x); lb_put(o, t); }
static void lb_dbl(LB *o, double x) { char t[64]; snprintf(t, sizeof t, "%.10g", x); if (!strpbrk(t, ".eEn")) strcat(t, ".0"); lb_put(o, t); }
static void lb_bool(LB *o, int x) { lb_put(o, x ? "true" : "false"); }
static void lb_strn(LB *o, const char *s, int n) {
    lb_ch(o, '"');
    for (int i = 0; n < 0 ? s[i] != 0 : i < n; i++) {
        unsigned char c = (unsigned char)s[i];
        if (c == '"' || c == '\\') { lb_ch(o, '\\'); lb_ch(o, (char)c); }
        else if (c == '\n') lb_put(o, "\\n");
        else if (c == '\t') lb_put(o, "\\t");
        else if (c == '\r') lb_put(o, "\\r");
        else if (c < 32) { char t[8]; snprintf(t, sizeof t, "\\u%04x", c); lb_put(o, t); }
        else lb_ch(o, (char)c);
    }
    lb_ch(o, '"');
}
static void lb_str(LB *o, const char *s) { if (!s) lb_put(o, "null"); else lb_strn(o, s, -1); }

/* ---------- 判題協定 ----------
 * stdin：第一行案例數 N，之後每行一個案例（JSON 陣列）。
 * stdout：\x01S i 表示開始第 i 個案例；\x01R i 毫秒 JSON 表示結果。 */
static double lc_now(void) { struct timespec ts; clock_gettime(CLOCK_MONOTONIC, &ts); return ts.tv_sec * 1000.0 + ts.tv_nsec / 1e6; }
static char *lc_read_all(void) {
    size_t cap = 1 << 16, n = 0;
    char *b = (char *)malloc(cap);
    size_t k;
    while ((k = fread(b + n, 1, cap - n - 1, stdin)) > 0) { n += k; if (cap - n < 2) { cap *= 2; b = (char *)realloc(b, cap); } }
    b[n] = 0;
    return b;
}
static void lc_start(int i) { fflush(stdout); printf("\n\001S %d\n", i); fflush(stdout); }
static void lc_result(int i, double ms, LB *o) { fflush(stdout); printf("\n\001R %d %.4f %s\n", i, ms, o->b ? o->b : "null"); fflush(stdout); }

#ifdef __cplusplus
}
#endif
#endif
