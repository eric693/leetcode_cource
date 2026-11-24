/* 線上練習：在瀏覽器裡編譯並執行 C / C++（Clang/LLD 編譯成 WebAssembly，來源：YoWASP） */
const VENDOR = new URL('./vendor/clang-22.0.0-git20542-10/', import.meta.url);
const NATIVE = new URL('./native/', import.meta.url);

let clangMod = null, loading = null, headers = null, pch = null;

async function load() {
  if (!loading) {
    loading = (async () => {
      const progress = (e) => self.postMessage({ type: 'cc-progress', done: e.doneLength, total: e.totalLength });
      const [mod, h, p] = await Promise.all([
        import(new URL('bundle.js', VENDOR).href),
        Promise.all(['lcjson.h', 'lc_c.h', 'lc_cpp.h', 'lc_node_cpp.h', 'bits/stdc++.h'].map((f) =>
          fetch(new URL(f, NATIVE)).then((r) => r.text()).then((t) => [f, t]))),
        fetch(new URL('lc_cpp.h.pch', VENDOR)).then((r) => { if (!r.ok) throw new Error('PCH ' + r.status); return r.arrayBuffer(); }),
      ]);
      clangMod = mod;
      headers = Object.fromEntries(h);
      pch = new Uint8Array(p);
      // 先跑一次極小的編譯，讓編譯器下載並初始化完成
      await clangMod.runClang(['clang', 'w.c', '-c', '-o', 'w.o'], { 'w.c': 'int x;' }, { fetchProgress: progress });
      self.postMessage({ type: 'cc-ready' });
    })().catch((err) => {
      loading = null;
      self.postMessage({ type: 'cc-failed', error: String(err && err.message || err) });
      throw err;
    });
  }
  return loading;
}

function buildTree() {
  return {
    'lcjson.h': headers['lcjson.h'], 'lc_c.h': headers['lc_c.h'], 'lc_cpp.h': headers['lc_cpp.h'],
    'lc_node_cpp.h': headers['lc_node_cpp.h'], bits: { 'stdc++.h': headers['bits/stdc++.h'] },
  };
}

// 編譯錯誤：只保留和使用者程式碼有關的訊息
function cleanErrors(text, file) {
  const lines = text.split('\n').filter((l) => l.trim() && !/^\d+ (error|warning)s? generated\.$/.test(l));
  const out = [];
  for (const l of lines) {
    if (/wasm-ld: error: .*undefined symbol: (\w+)/.test(l)) {
      out.push('連結錯誤：找不到函式 ' + l.match(/undefined symbol: (\w+)/)[1] + '（是不是改了函式名稱，或少寫了某個函式？）');
      continue;
    }
    out.push(l.replace(/^(\.\/)?/, ''));
  }
  const mine = out.filter((l) => l.startsWith(file + ':') || l.startsWith('driver.'));
  const res = (mine.length ? out.slice(out.indexOf(mine[0])) : out).slice(0, 30).join('\n');
  return res.replace(/driver\.(c|cpp):\d+:\d+: error:/g, '判題程式呼叫你的函式時出錯（函式名稱或參數型別可能被改動）:');
}

async function compile(lang, source, driver, define) {
  await load();
  const isCpp = lang === 'cpp';
  const file = isCpp ? 'solution.cpp' : 'solution.c';
  const pre = (define ? `#define ${define}\n` : '') + (isCpp ? '#include "lc_node_cpp.h"\n' : '#include "lc_c.h"\n');
  const main = `${pre}#line 1 "${file}"\n${source}\n#line 1 "driver.${isCpp ? 'cpp' : 'c'}"\n${driver}\n`;
  const tree = buildTree();
  tree[isCpp ? 'main.cpp' : 'main.c'] = main;
  if (isCpp) tree['lc_cpp.h.pch'] = pch;
  const args = isCpp
    ? ['clang++', 'main.cpp', '-std=c++17', '-fno-exceptions', '-O2', '-fsanitize=null,return,bounds,signed-integer-overflow,shift-base,integer-divide-by-zero,unreachable,vla-bound', '-fsanitize-trap=all', '-I', '.', '-include-pch', 'lc_cpp.h.pch', '-Wno-unused-value', '-Wl,-z,stack-size=8388608', '-o', 'a.wasm']
    : ['clang', 'main.c', '-std=gnu11', '-O2', '-fsanitize=null,return,bounds,signed-integer-overflow,shift-base,integer-divide-by-zero,unreachable,vla-bound', '-fsanitize-trap=all', '-I', '.', '-Wno-unused-value', '-Wl,-z,stack-size=8388608', '-o', 'a.wasm'];
  let err = '';
  const dec = new TextDecoder();
  const stderr = (b) => { if (b) err += dec.decode(b, { stream: true }); };
  try {
    const out = await clangMod.runClang(args, tree, { stdout: stderr, stderr });
    return { wasm: out['a.wasm'] };
  } catch (e) {
    return { error: cleanErrors(err || String(e.message || e), file) || String(e.message || e) };
  }
}

// ---------- 極簡 WASI：只實作判題需要的系統呼叫 ----------
class Exit extends Error { constructor(code) { super('exit ' + code); this.code = code; } }

function runWasm(wasm, stdinText, onLine) {
  const stdin = new TextEncoder().encode(stdinText);
  let inPos = 0, mem = null, outBuf = '', errBuf = '';
  const dec = new TextDecoder();
  const view = () => new DataView(mem.buffer);
  const flushLines = (final) => {
    let i;
    while ((i = outBuf.indexOf('\n')) >= 0) { onLine(outBuf.slice(0, i)); outBuf = outBuf.slice(i + 1); }
    if (final && outBuf) { onLine(outBuf); outBuf = ''; }
  };
  const t0 = performance.now();
  const wasi = {
    fd_write(fd, iovs, n, nwritten) {
      const v = view(); let total = 0, s = '';
      for (let k = 0; k < n; k++) {
        const ptr = v.getUint32(iovs + k * 8, true), len = v.getUint32(iovs + k * 8 + 4, true);
        s += dec.decode(new Uint8Array(mem.buffer, ptr, len), { stream: true });
        total += len;
      }
      if (fd === 1) { outBuf += s; flushLines(false); } else errBuf += s;
      v.setUint32(nwritten, total, true);
      return 0;
    },
    fd_read(fd, iovs, n, nread) {
      const v = view(); let total = 0;
      if (fd === 0) {
        for (let k = 0; k < n && inPos < stdin.length; k++) {
          const ptr = v.getUint32(iovs + k * 8, true), len = v.getUint32(iovs + k * 8 + 4, true);
          const take = Math.min(len, stdin.length - inPos);
          new Uint8Array(mem.buffer, ptr, take).set(stdin.subarray(inPos, inPos + take));
          inPos += take; total += take;
        }
      }
      v.setUint32(nread, total, true);
      return 0;
    },
    fd_close() { return 0; },
    fd_seek(fd, off, whence, newoff) { view().setBigUint64(newoff, 0n, true); return 0; },
    fd_fdstat_get(fd, buf) {
      const v = view();
      v.setUint8(buf, fd <= 2 ? 2 : 0); v.setUint16(buf + 2, 0, true);
      v.setBigUint64(buf + 8, 0xffffffffn, true); v.setBigUint64(buf + 16, 0xffffffffn, true);
      return fd <= 2 ? 0 : 8;
    },
    fd_prestat_get() { return 8; },
    fd_prestat_dir_name() { return 8; },
    environ_sizes_get(c, s) { const v = view(); v.setUint32(c, 0, true); v.setUint32(s, 0, true); return 0; },
    environ_get() { return 0; },
    args_sizes_get(c, s) { const v = view(); v.setUint32(c, 0, true); v.setUint32(s, 0, true); return 0; },
    args_get() { return 0; },
    clock_time_get(id, prec, out) {
      const ns = id === 0 ? BigInt(Date.now()) * 1000000n : BigInt(Math.round((performance.now() - t0) * 1e6));
      view().setBigUint64(out, ns, true);
      return 0;
    },
    clock_res_get(id, out) { view().setBigUint64(out, 1000n, true); return 0; },
    random_get(buf, len) { crypto.getRandomValues(new Uint8Array(mem.buffer, buf, len)); return 0; },
    sched_yield() { return 0; },
    proc_exit(code) { throw new Exit(code); },
  };
  const imports = { wasi_snapshot_preview1: new Proxy(wasi, { get: (t, k) => t[k] || (() => 52) }) };
  return WebAssembly.instantiate(wasm, imports).then(({ instance }) => {
    mem = instance.exports.memory;
    let code = 0;
    try { instance.exports._start(); } catch (e) {
      if (e instanceof Exit) code = e.code;
      else { flushLines(true); return { trap: e, stderr: errBuf }; }
    }
    flushLines(true);
    return { code, stderr: errBuf };
  });
}

function trapMessage(e) {
  const m = String(e && e.message || e);
  if (/out of bounds/i.test(m)) return '執行錯誤：記憶體存取越界（可能是陣列索引超出範圍，或使用了 NULL / nullptr 指標）';
  if (/unreachable/i.test(m)) return '執行錯誤：偵測到未定義行為或程式中止。\n常見原因：存取 NULL / nullptr 指標、陣列或 vector 索引越界、有號整數溢位、除以零、位移負數，或呼叫了 abort()。';
  if (/call stack|stack overflow|too much recursion/i.test(m)) return '執行錯誤：堆疊溢位（遞迴太深，可以改用迭代或顯式堆疊）';
  if (/divide by zero|integer divide/i.test(m)) return '執行錯誤：整數除以零';
  if (/integer overflow/i.test(m)) return '執行錯誤：整數溢位（例如 INT_MIN / -1）';
  return '執行錯誤：' + m;
}

self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'preload') { load().catch(() => {}); return; }
  if (m.type !== 'run') return;
  try {
    self.postMessage({ type: 'cc-phase', id: m.id, phase: 'compile' });
    const c = await compile(m.lang, m.code, m.driver, m.define);
    if (c.error) { self.postMessage({ type: 'result', id: m.id, compileError: c.error }); return; }
    self.postMessage({ type: 'cc-phase', id: m.id, phase: 'run' });
    const stdin = m.cases.length + '\n' + m.cases.map((a) => JSON.stringify(a)).join('\n') + '\n';
    const results = [];
    let cur = -1, curOut = [];
    const onLine = (line) => {
      if (line.startsWith('\x01S ')) {
        cur = Number(line.slice(3)); curOut = [];
        self.postMessage({ type: 'case', id: m.id, idx: cur });
      } else if (line.startsWith('\x01R ')) {
        const mm = line.match(/^\x01R (\d+) ([\d.]+) (.*)$/);
        let out;
        try { out = JSON.parse(mm[3]); } catch (err) { out = '輸出無法解析'; }
        results[Number(mm[1])] = { ok: true, out, ms: Number(mm[2]), stdout: curOut.join('\n') };
        cur = -1;
      } else if (cur >= 0) {
        if (line || curOut.length) curOut.push(line);
      }
    };
    const r = await runWasm(c.wasm, stdin, onLine);
    if (r.trap || r.code !== 0) {
      const msg = r.trap ? trapMessage(r.trap) : `程式以結束碼 ${r.code} 提前結束（是不是呼叫了 exit()？）`;
      const idx = cur >= 0 ? cur : results.length;
      results[idx] = { ok: false, error: msg + (r.stderr ? '\n' + r.stderr.slice(0, 2000) : ''), stdout: curOut.join('\n') };
    }
    const dense = [];
    for (let i = 0; i < results.length; i++) { if (!results[i]) break; dense.push(results[i]); }
    self.postMessage({ type: 'result', id: m.id, results: dense });
  } catch (err) {
    self.postMessage({ type: 'result', id: m.id, fatal: String(err && err.message || err) });
  }
};
