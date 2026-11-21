// Diagrams use device pixels for clarity and logical pixels for layout.
window.drawLab = function(canvas, kind, s) {
  const r = canvas.getBoundingClientRect(),
    w = r.width,
    h = r.height;
  if (!w || !h) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * ratio);
  canvas.height = Math.round(h * ratio);
  const g = canvas.getContext('2d');
  if (!g) return;
  g.scale(ratio, ratio);
  const mint = '#a9f2cb',
    coral = '#ffb183',
    pale = '#f0f8ec',
    dim = '#91b5a3',
    wire = '#5c8375',
    dark = '#143f38',
    deep = '#0f332e';
  const small = w < 520;
  const fs = small ? 11 : 14;

  function path(points, color, width = 2, dash = []) {
    g.save();
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.strokeStyle = color;
    g.lineWidth = width;
    g.setLineDash(dash);
    g.beginPath();
    points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.stroke();
    g.restore()
  }

  function rect(x, y, W, H, r, fill, stroke) {
    g.beginPath();
    g.roundRect(x, y, W, H, r);
    if (fill) {
      g.fillStyle = fill;
      g.fill()
    }
    if (stroke) {
      g.lineWidth = 1.6;
      g.strokeStyle = stroke;
      g.stroke()
    }
  }

  function dot(x, y, R, c) {
    g.fillStyle = c;
    g.beginPath();
    g.arc(x, y, R, 0, 2 * Math.PI);
    g.fill()
  }

  function label(t, x, y, c = pale, size = fs, bold = false, align = 'center', mono = false) {
    g.fillStyle = c;
    g.font = (bold ? '650 ' : '500 ') + size + 'px ' + (mono ? 'ui-monospace, Menlo, monospace' : '-apple-system, BlinkMacSystemFont, Arial, sans-serif');
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.fillText(t, x, y)
  }

  function arrow(x, y, angle, color) {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    path([
      [-6, -4],
      [0, 0],
      [-6, 4]
    ], color, 1.8);
    g.restore()
  }

  function tag(t, x, y, c) {
    g.font = '600 ' + (small ? 10 : 12) + 'px ui-monospace, Menlo, monospace';
    const W = g.measureText(t).width + 16;
    rect(x - W / 2, y - 11, W, 22, 6, deep, c);
    label(t, x, y + .5, c, small ? 10 : 12, true, 'center', true)
  }

  function device(x, y, name, who) {
    const W = small ? 52 : 83,
      H = small ? 33 : 51;
    g.save();
    g.shadowBlur = 16;
    g.shadowColor = '#81ffb526';
    rect(x - W / 2, y - H / 2, W, H, 6, '#1e5146', mint);
    g.restore();
    rect(x - W / 2 + 5, y - H / 2 + 5, W - 10, H - 11, 3, '#193e38', '#528170');
    const cx = x + (who ? 4 : -4),
      cy = y - 3,
      rad = small ? 5 : 8;
    dot(cx, cy - rad * .4, rad, who ? coral : mint);
    g.fillStyle = who ? coral : mint;
    g.beginPath();
    g.ellipse(cx, cy + rad * 1.65, rad * 1.75, rad * 1.05, 0, Math.PI, 2 * Math.PI);
    g.fill();
    path([
      [x, y + H / 2],
      [x, y + H / 2 + 5]
    ], mint, 2);
    path([
      [x - W * .22, y + H / 2 + 7],
      [x + W * .22, y + H / 2 + 7]
    ], mint, 2);
    label(name, x, y + H / 2 + 23, pale, fs, true)
  }

  function network(phase, relayLabel, directLabel, failed = false) {
    const lx = w * .15,
      rx = w * .85,
      cx = w * .5,
      y = h * .62,
      serverY = h * .235,
      devW = small ? 26 : 42,
      delta = small ? 18 : 27;
    const topActive = phase === 0,
      a = topActive ? coral : wire,
      b = phase > 0 && !failed ? mint : wire;
    path([
      [lx, y - delta],
      [lx, serverY + 8],
      [cx - 35, serverY + 8]
    ], a, topActive ? 2 : 1.4, [5, 5]);
    path([
      [cx + 35, serverY + 8],
      [rx, serverY + 8],
      [rx, y - delta]
    ], a, topActive ? 2 : 1.4, [5, 5]);
    if (topActive) {
      arrow(cx - 36, serverY + 8, 0, coral);
      arrow(rx, y - delta, Math.PI / 2, coral)
    }
    path([
      [lx + devW + 2, y],
      [rx - devW - 2, y]
    ], b, phase > 0 ? 2.7 : 1.3, phase > 0 ? [] : [4, 6]);
    if (phase > 0 && !failed) arrow(rx - devW - 3, y, 0, mint);
    for (let j = 0; j < 2; j++) {
      rect(cx - 20, serverY + j * 7 - 9, 40, 9, 3, dark, a);
      dot(cx - 13, serverY + j * 7 - 4.5, 1.6, a);
      path([
        [cx + 5, serverY + j * 7 - 4.5],
        [cx + 14, serverY + j * 7 - 4.5]
      ], a, 1.2)
    }
    label(relayLabel, cx, Math.max(11, serverY - 22), topActive ? coral : dim, fs, true);
    if (directLabel) tag(directLabel, cx, y, failed ? coral : phase > 0 ? mint : dim);
    device(lx, y, 'Peer A', 0);
    device(rx, y, 'Peer B', 1);
  }

  function node(x, y, t, on = true) {
    dot(x, y, small ? 12 : 16, on ? mint : wire);
    label(t, x, y, deep, small ? 11 : 13, true)
  }

  function lineFlow(names, colors, sub) {
    const y = h * .49,
      left = small ? 31 : 55,
      dx = (w - 2 * left) / Math.max(1, names.length - 1);
    path([
      [left, y],
      [w - left, y]
    ], wire, 2, [4, 5]);
    names.forEach((n, i) => {
      let x = left + i * dx;
      dot(x, y, small ? 14 : 19, colors[i]);
      label(String(i + 1), x, y, deep, fs, true, 'center', true);
      label(n, x, y + 35, colors[i], fs, true)
    });
    if (sub) tag(sub, w / 2, h * .19, mint);
  }
  if (kind === 'overview') {
    network(s.phase, 'Signaling service', ['No media yet', 'ICE checks', 'DTLS handshake', 'Protected traffic'][s.phase]);
    return
  }
  if (kind === 'connecting') {
    const relay = s.net === 2 && s.turn;
    const fail = s.net === 2 && !s.turn;
    network(relay ? 0 : fail ? -1 : 1, relay ? 'TURN relay' : 'TURN relay', fail ? 'No path' : relay ? 'Direct blocked' : s.net === 0 ? 'Host pair' : 'Reflexive pair', fail);
    return
  }
  if (kind === 'signaling') {
    const y = h * .52;
    const labels = ['Offer', 'Common codec', 'Answer'];
    const vals = ['VP8 + H.264', s.codec === 2 ? 'None' : s.codec === 0 ? 'VP8' : 'H.264', s.codec === 2 ? 'Reject video' : 'Receive video'];
    [0, 1, 2].forEach((v) => {
      const x = w * (.17 + .33 * v),
        W = w * .265;
      if (v < 2) path([
        [x + W / 2, y],
        [x + w * .33 - W / 2, y]
      ], wire, 2, [3, 4]);
      rect(x - W / 2, y - 24, W, 48, 7, dark, v === 1 ? coral : mint);
      label(vals[v], x, y, v === 1 ? coral : pale, fs, true);
      label(labels[v], x, y + 45, dim, fs)
    });
    return
  }
  if (kind === 'securing') {
    lineFlow(['Description', 'Certificate', s.match ? 'Verified' : 'Mismatch', s.match ? 'Keys ready' : 'Stop'], [mint, mint, s.match ? mint : coral, s.match ? mint : coral], s.match ? 'A1:93 = A1:93' : 'A1:93 ≠ 7C:20');
    return
  }
  if (kind === 'networking') {
    const sends = [0, 20, 40, 60],
      arr = [25, 66, 59, 89],
      x0 = small ? 33 : 65,
      x1 = w - (small ? 21 : 45),
      x = t => x0 + t * (x1 - x0) / 135;
    sends.forEach((t, i) => {
      const y = 22 + i * (h - 45) / 4,
        on = arr[i] <= t + s.buffer;
      label('P' + (i + 1), x0 - 8, y, dim, fs, false, 'right', true);
      path([
        [x0, y],
        [x1, y]
      ], wire, 1, [2, 5]);
      path([
        [x(t), y],
        [x(arr[i]), y]
      ], on ? mint : coral, 3);
      dot(x(arr[i]), y, 5, on ? mint : coral);
      path([
        [x(t + s.buffer), y - 7],
        [x(t + s.buffer), y + 7]
      ], pale, 1.6)
    });
    label('● arrival     │ playout deadline      time (ms)', w / 2, h - 16, dim, small ? 10 : 13, false, 'center', true);
    return
  }
  if (kind === 'media') {
    const good = s.repair === 0 || s.repair === 1 && s.rtt <= 35;
    lineFlow(['I-frame', 'P1', 'P2', 'P3', 'I-frame'], [mint, good ? mint : coral, good ? mint : coral, good ? mint : coral, mint], good ? 'Reference chain intact' : s.repair === 2 ? 'Refresh at next I-frame' : 'Reference chain damaged');
    return
  }
  if (kind === 'data') {
    const words = s.ordered ? ['1', '…', '2', '3'] : ['1', '3', '…', '2'];
    if (!s.retry) {
      words.splice(0, 4, ...(s.ordered ? ['1', '…', 'skip', '3'] : ['1', '3', 'skip']))
    }
    const left = small ? 20 : 40,
      right = w - left;
    label('Application delivery', left, h * .20, dim, fs, true, 'left');
    path([
      [left, h * .54],
      [right, h * .54]
    ], wire, 2, [4, 5]);
    words.forEach((t, i) => {
      const x = left + (i + .5) * (right - left) / words.length;
      rect(x - 22, h * .54 - 19, 44, 38, 5, deep, t === '…' || t === 'skip' ? coral : mint);
      label(t, x, h * .54, t === '…' || t === 'skip' ? coral : mint, fs + 2, true, 'center', true)
    });
    label('Time advances from left to right', w / 2, h * .82, dim, fs);
    return
  }
  if (kind === 'applied') {
    const n = s.people,
      cx = w / 2,
      cy = h * .52,
      rx = Math.min(w * .37, 175),
      ry = h * .34,
      pts = Array.from({
        length: n
      }, (_, i) => {
        const a = 2 * Math.PI * i / n - Math.PI / 2;
        return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]
      });
    pts.forEach((p, i) => {
      if (s.topology === 0) pts.slice(i + 1).forEach(q => path([p, q], wire, 1.2));
      else path([p, [cx, cy]], wire, 1.8)
    });
    pts.forEach(([x, y], i) => node(x, y, String(i + 1)));
    if (s.topology) tag(s.topology === 1 ? 'SFU' : 'MCU', cx, cy, coral);
    return
  }
  if (kind === 'debugging') {
    const bad = [0, 1, 2, 3, 4][s.issue];
    const names = ['Signal', 'ICE', 'DTLS', 'RTP', 'Decode'];
    lineFlow(names, names.map((_, i) => i < bad ? mint : i === bad ? coral : wire), 'First failed handoff');
    return
  }
  if (kind === 'history') {
    const names = ['MBone', 'RTP RFC', 'Marratech', 'Maastricht', 'WebRTC 1.0'];
    lineFlow(names, names.map((_, i) => s.era === i ? coral : mint), ['Early 1990s', '1996', '2007', '2010', '2021'][s.era]);
    return
  }
  if (kind === 'faq') {
    lineFlow(['Claim', 'Mechanism', 'Conclusion'], [mint, coral, mint], ['Transport', 'Delivery', 'Payload', 'Latency'][s.claim]);
    return
  }
  if (kind === 'reference') {
    lineFlow(['Question', 'Scope', 'Specification'], [mint, coral, mint], window.specs[s.spec][0]);
    return
  }
};
