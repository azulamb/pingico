async function v(t) {
  let o = new DecompressionStream('deflate'),
    a = new Blob([t]).stream().pipeThrough(o),
    e = await new Response(a).arrayBuffer();
  return new Uint8Array(e);
}
async function B(t) {
  let o = new DataView(t.buffer, t.byteOffset, t.byteLength),
    a = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let c = 0; c < a.length; c++) {
    if (t[c] !== a[c]) throw new Error('Invalid PNG');
  }
  let e = 0, n = 0, w = 0, s = 0, g = [], l = 8;
  for (; l < t.length;) {
    let c = o.getUint32(l),
      m = String.fromCharCode(t[l + 4], t[l + 5], t[l + 6], t[l + 7]);
    if (m === 'IHDR') {
      e = o.getUint32(l + 8),
        n = o.getUint32(l + 12),
        w = t[l + 16],
        s = t[l + 17];
    } else if (m === 'IDAT') g.push(t.subarray(l + 8, l + 8 + c));
    else if (m === 'IEND') break;
    l += c + 12;
  }
  if (w !== 8 || s !== 6) throw new Error('Unsupported PNG format');
  let d = g.reduce((c, m) => c + m.length, 0), x = new Uint8Array(d), u = 0;
  for (let c of g) x.set(c, u), u += c.length;
  let U = await v(x),
    p = 4,
    h = e * p,
    i = new Uint8Array(e * n * 4),
    y = 0,
    f = 0,
    D = (c, m, r) => {
      let b = c + m - r,
        E = Math.abs(b - c),
        A = Math.abs(b - m),
        k = Math.abs(b - r);
      return E <= A && E <= k ? c : A <= k ? m : r;
    };
  for (let c = 0; c < n; c++) {
    let m = U[y++];
    if (m === 0) i.set(U.subarray(y, y + h), f);
    else if (m === 1) {
      for (let r = 0; r < h; r++) {
        let b = r >= p ? i[f + r - p] : 0;
        i[f + r] = U[y + r] + b & 255;
      }
    } else if (m === 2) {
      for (let r = 0; r < h; r++) {
        let b = c > 0 ? i[f + r - h] : 0;
        i[f + r] = U[y + r] + b & 255;
      }
    } else if (m === 3) {
      for (let r = 0; r < h; r++) {
        let b = r >= p ? i[f + r - p] : 0, E = c > 0 ? i[f + r - h] : 0;
        i[f + r] = U[y + r] + (b + E >> 1) & 255;
      }
    } else if (m === 4) {
      for (let r = 0; r < h; r++) {
        let b = r >= p ? i[f + r - p] : 0,
          E = c > 0 ? i[f + r - h] : 0,
          A = c > 0 && r >= p ? i[f + r - h - p] : 0;
        i[f + r] = U[y + r] + D(b, E, A) & 255;
      }
    } else throw new Error(`Unsupported filter type: ${m}`);
    y += h, f += h;
  }
  return { width: e, height: n, image: i };
}
async function C(t) {
  let { width: o, height: a, image: e } = await B(t), n = new Uint8Array(16);
  n[0] = o >= 256 ? 0 : o,
    n[1] = a >= 256 ? 0 : a,
    n[2] = 0,
    n[3] = 0,
    n[4] = 1,
    n[5] = 0,
    n[6] = 32,
    n[7] = 0;
  let w = new Uint8Array(40), s = new DataView(w.buffer);
  s.setUint32(0, 40, !0),
    s.setInt32(4, o, !0),
    s.setInt32(8, a * 2, !0),
    s.setUint16(12, 1, !0),
    s.setUint16(14, 32, !0),
    s.setUint32(16, 0, !0);
  let g = Math.ceil(o / 32) * 4,
    l = new Uint8Array(g * a),
    d = o >= 256,
    x = 10;
  for (let h = 0; h < a; h++) {
    for (let i = 0; i < o; i++) {
      if (e[(h * o + i) * 4 + 3] < x) {
        let f = (a - 1 - h) * g + (i >> 3), D = 7 - (i & 7);
        l[f] |= 1 << D;
      }
    }
  }
  s.setUint32(20, o * a * 4 + l.length, !0),
    s.setUint32(24, 0, !0),
    s.setUint32(28, 0, !0),
    s.setUint32(32, 0, !0),
    s.setUint32(36, 0, !0);
  let u = new Uint8Array(o * a * 4);
  for (let h = 0; h < a; h++) {
    for (let i = 0; i < o; i++) {
      let y = (h * o + i) * 4, f = ((a - 1 - h) * o + i) * 4, D = e[y + 3];
      !d && D < x
        ? (u[f] = 0, u[f + 1] = 0, u[f + 2] = 0)
        : (u[f] = e[y + 2], u[f + 1] = e[y + 1], u[f + 2] = e[y]), u[f + 3] = D;
    }
  }
  let U = new Uint8Array(w.length + u.length + l.length);
  U.set(w, 0), U.set(u, w.length), U.set(l, w.length + u.length);
  let p = U.length;
  return n[8] = p & 255,
    n[9] = p >> 8 & 255,
    n[10] = p >> 16 & 255,
    n[11] = p >> 24 & 255,
    n[12] = 0,
    n[13] = 0,
    n[14] = 0,
    n[15] = 0,
    { header: n, block: U };
}
async function L(...t) {
  let o = [];
  for (let [d, x] of t.entries()) {
    x instanceof Uint8Array
      ? o.push(x)
      : x instanceof Blob
      ? o.push(new Uint8Array(await x.arrayBuffer()))
      : x instanceof ArrayBuffer
      ? o.push(new Uint8Array(x))
      : console.warn(`Unsupported data: [${d}]`);
  }
  let a = [];
  for (let d of o) a.push(await C(d));
  let e = a.length;
  if (e === 0) return new Blob([]);
  let n = new Uint8Array(6);
  n[0] = 0, n[1] = 0, n[2] = 1, n[3] = 0, n[4] = e & 255, n[5] = e >> 8 & 255;
  let w = new Uint8Array(e * 16), s = 6 + e * 16;
  a.forEach((d, x) => {
    let u = d.block.byteLength;
    d.header[8] = u & 255,
      d.header[9] = u >> 8 & 255,
      d.header[10] = u >> 16 & 255,
      d.header[11] = u >> 24 & 255,
      d.header[12] = s & 255,
      d.header[13] = s >> 8 & 255,
      d.header[14] = s >> 16 & 255,
      d.header[15] = s >> 24 & 255,
      w.set(d.header, x * 16),
      s += u;
  });
  let g = new Uint8Array(s);
  g.set(n, 0), g.set(w, 6);
  let l = 6 + e * 16;
  return a.forEach((d) => {
    g.set(d.block, l), l += d.block.byteLength;
  }),
    new Blob([g], { type: 'image/x-icon' });
}
function T(t) {
  return t.preventDefault(),
    t.dataTransfer
      ? t.dataTransfer.items
        ? [...t.dataTransfer.items].filter((o) => o && o.kind === 'file').map(
          (o) => o.getAsFile(),
        )
        : [...t.dataTransfer.files]
      : [];
}
function I(t) {
  return t.filter((o) => o.type === 'image/png');
}
document.addEventListener('DOMContentLoaded', () => {
  let t = [],
    o = ((e) => (e.addEventListener('click', async (n) => {
      console.log(t),
        L(...t).then((w) => {
          let s = URL.createObjectURL(w), g = document.createElement('a');
          g.href = s,
            g.download = t.length === 1 ? 'icon.ico' : 'icons.ico',
            document.body.appendChild(g),
            g.click(),
            document.body.removeChild(g),
            URL.revokeObjectURL(s);
        });
    }),
      () => {
        t.length === 1
          ? (e.textContent = 'Download icon', e.disabled = !1)
          : 1 < t.length
          ? (e.textContent = `Download multi-icons(${t.length})`,
            e.disabled = !1)
          : (e.textContent = 'Download', e.disabled = !0);
      }))(document.getElementById('download'));
  o();
  let a = ((e, n) => (n.addEventListener('click', () => {
    for (t.splice(0, t.length), o(); e.firstChild;) e.removeChild(e.firstChild);
  }),
    (w) => {
      t.push(w), o();
      let s = document.createElement('img');
      s.src = URL.createObjectURL(w), e.appendChild(s);
    }))(document.getElementById('icons'), document.getElementById('reset'));
  ((e) => {
    e.addEventListener('change', (n) => {
      I(e.files ? [...e.files] : []).forEach(a);
    });
  })(document.getElementById('images')),
    document.body.ondrop = (e) => {
      e.preventDefault(), I(T(e)).forEach(a);
    },
    document.body.ondragover = (e) => {
      e.preventDefault();
    };
});
