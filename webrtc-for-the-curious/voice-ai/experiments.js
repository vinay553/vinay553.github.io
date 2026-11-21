// All values inserted into the lab displays come from these fixed scenario controls.
const selectControl = (key, label, options, initial = 0) => ({
  key,
  label,
  options,
  initial
});
const checkControl = (key, label, initial = false) => ({
  key,
  label,
  initial
});

function readouts(items) {
  return '<div class="readouts">' + items.map(([l, v]) =>
    '<div class="readout"><small>' + l + '</small><strong>' + v + '</strong></div>').join('') + '</div>';
}

function table(title, columns, rows) {
  const cells = (items, tag) => items.map(v => '<' + tag + '>' + v + '</' + tag + '>').join('');
  return '<table class="readtable"><caption>' + title + '</caption><thead><tr>' + cells(columns, 'th') +
    '</tr></thead><tbody>' + rows.map(r => '<tr>' + cells(r, 'td') + '</tr>').join('') + '</tbody></table>';
}

function timeline(spans, end) {
  return '<div class="trace" aria-label="Stage offsets relative to end of user speech">' +
    spans.map(([label, start, stop]) => '<div class="trace-row"><span>' + label +
      '</span><div class="trackline"><i style="left:' + 100 * start / end + '%;width:' + 100 * (stop - start) / end +
      '%"></i></div><output>' + start + '–' + stop + '</output></div>').join('') + '</div>';
}

function gpuReplay(cap, hold, burst) {
  const offsets = [0, 1, 2, 3, 7, 9, 11, 14];
  const arrivals = Array.from({
    length: 24
  }, (_, i) => burst ? 55 * Math.floor(i / 8) + offsets[i % 8] : 18 * i);
  let next = 0,
    free = 0;
  const batches = [],
    times = [];
  while (next < arrivals.length) {
    const oldest = arrivals[next];
    const filledAt = arrivals[next + cap - 1] ?? Infinity;
    const start = Math.max(free, Math.min(filledAt, oldest + hold));
    let end = next;
    while (end < arrivals.length && end - next < cap && arrivals[end] <= start) end++;
    const count = end - next;
    const finish = start + 8 + 3 * count;
    const delays = arrivals.slice(next, end).map(a => finish - a);
    batches.push([next + 1, count, oldest, start, finish, delays[0], delays.filter(d => d > 45).length]);
    times.push(...delays);
    next = end;
    free = finish;
  }
  const sorted = times.slice().sort((a, b) => a - b);
  return {
    batches,
    timely: times.filter(d => d <= 45).length,
    p95: sorted[Math.ceil(.95 * sorted.length) - 1],
    finish: free
  };
}
const experiments = {
  latency: {
    controls: [selectControl('policy', 'Start LLM on', ['Committed turn', 'Stable ASR candidate', 'Candidate revised at commit']), selectControl('queue', 'LLM queue', ['35 ms', '135 ms', '235 ms'])],
    draw(s) {
      const commit = 290,
        candidate = 170;
      const start = s.policy === 1 ? candidate : commit;
      const queue = 35 + 100 * s.queue,
        first = start + queue + 150,
        phrase = first + 60,
        tts = Math.max(commit, phrase),
        pcm = tts + 105,
        heard = pcm + 70;
      const spans = [
        ['Uplink', 0, 45],
        ['ASR candidate', 45, candidate],
        ['Endpoint', 45, commit]
      ];
      if (s.policy === 2) spans.push(['Discarded work', candidate, commit]);
      spans.push(['LLM queue', start, start + queue], ['First token', start + queue, first], ['First phrase', first, phrase], ['First PCM', tts, pcm], ['Downlink + play', pcm, heard]);
      return readouts([
          ['First audible', heard + ' ms'],
          ['Target slack', (650 - heard) + ' ms'],
          ['LLM service to token', '150 ms']
        ]) +
        timeline(spans, hearAxis(heard)) + '<p>Each row gives its start and end relative to the caller’s last speech. Queueing and modeled compute are separate. Speech synthesis starts only after a usable phrase and a committed turn.</p>';
    }
  },
  interruptions: {
    controls: [selectControl('event', 'Replay through', ['Old reply playing', 'Interruption confirmed', 'Late old chunk', 'New reply arrives'], 2), checkControl('flush', 'Flush pending audio', true), checkControl('fence', 'Reject stale generations', true)],
    draw(s) {
      const confirmed = s.event >= 1,
        late = s.event >= 2;
      const pending = [];
      if (!confirmed || !s.flush) pending.push('A2');
      if (late && !s.fence) pending.push('A3');
      if (s.event === 3) pending.push('B1');
      const rows = [
        ['200 ms', 'A1 handed to device', 'Already committed through 300 ms. A2 is pending for 40 ms.']
      ];
      if (confirmed) rows.push(['240 ms', 'User interrupt confirmed', 'Switch A to B. ' + (s.flush ? 'Discard pending A2.' : 'Keep pending A2.')]);
      if (late) rows.push(['260 ms', 'Canceled TTS emits A3', s.fence ? 'Generation fence drops A3.' : 'Stale A3 enters the queue for 40 ms.']);
      if (s.event === 3) rows.push(['280 ms', 'Valid B1 arrives', 'B1 waits behind any remaining A audio.']);
      const tail = 60 + (s.flush ? 0 : 40) + (late && !s.fence ? 40 : 0);
      return readouts([
          ['Active generation', confirmed ? 'B' : 'A'],
          ['Pending at snapshot', pending.join(' · ') || 'Empty'],
          ['Projected old-audio tail', confirmed ? tail + ' ms' : '—']
        ]) +
        table('Playout ledger', ['Time', 'Event', 'Effect'], rows) + '<p>This player cannot revoke A1 after the device accepts it. Tail is projected from confirmation to the last old sample, assuming no further chunks arrive. A cancel signal and a queue flush affect different buffers.</p>';
    }
  },
  audio: {
    controls: [selectControl('packets', 'Packets per chunk', ['2', '4', '8'], 1), selectControl('future', 'Right context', ['0 ms', '20 ms', '60 ms'], 1), selectControl('slow', 'Compute per chunk', ['32 ms', '96 ms'])],
    draw(s) {
      const packets = [2, 4, 8][s.packets],
        ms = 20 * packets,
        future = [0, 20, 60][s.future],
        compute = [32, 96][s.slow],
        rtf = compute / ms;
      return readouts([
          ['First result', ms + future + compute + ' ms'],
          ['Compute RTF', rtf.toFixed(2)],
          ['PCM per chunk', 32 * ms + ' B']
        ]) +
        table('One chunk through the bridge', ['Boundary', 'Quantity', 'Interpretation'], [
          ['RTP input', packets + ' × 960 ticks', '48 kHz Opus clock; fixed 20 ms packetization.'],
          ['Model input', 16 * ms + ' samples', '16 kHz mono signed 16-bit PCM after resampling.'],
          ['Encoder context', ms + ' + ' + future + ' ms', 'New chunk plus future context. Reuse overlapping context.'],
          ['Serial worker', compute + ' ms', rtf > 1 ? 'Falls behind by ' + (compute - ms) + ' ms per chunk under sustained input.' : 'Can keep up on this deterministic trace.']
        ]) +
        '<p>Timing starts at the first captured sample. This lossless toy path excludes transport, hardware delay and decoder cost. Right context delays the first result; it is not extra new audio in each output chunk.</p>';
    }
  },
  serving: {
    controls: [selectControl('pattern', 'Arrivals', ['Sparse', 'Bursty'], 1), selectControl('cap', 'Max batch', ['1', '4', '8'], 1), selectControl('hold', 'Max intentional wait', ['0 ms', '4 ms', '12 ms'])],
    draw(s) {
      const cap = [1, 4, 8][s.cap],
        hold = [0, 4, 12][s.hold],
        result = gpuReplay(cap, hold, s.pattern === 1);
      const row = b => ['#' + b[0] + ' × ' + b[1], b[2], b[3], b[4], b[5], b[6]];
      return readouts([
          ['On time', result.timely + ' / 24'],
          ['p95 turnaround', result.p95 + ' ms'],
          ['Last completion', result.finish + ' ms']
        ]) +
        '<p>Each batch costs 8 + 3 × batch size milliseconds. A ready worker launches at a full batch or the oldest request’s hold limit. A busy worker adds queue delay even when intentional wait is zero. All times below are milliseconds.</p>' +
        '<details class="solve"><summary>Inspect all ' + result.batches.length + ' batches</summary>' +
        table('FIFO replay', ['First ID × size', 'Oldest arrival', 'Launch', 'Finish', 'Oldest latency', 'Late'], result.batches.map(row)) + '</details>';
    }
  },
  model: {
    controls: [selectControl('ctx', 'Context per session', ['2,048 tokens', '4,096 tokens', '16,384 tokens'], 1), selectControl('precision', 'KV representation', ['BF16 · 2 bytes', 'INT8 · 1 byte'])],
    draw(s) {
      const ctx = [2048, 4096, 16384][s.ctx],
        bytes = 2 * 32 * 8 * 128 * [2, 1][s.precision],
        mib = bytes * ctx / 2 ** 20,
        ceiling = Math.floor(24 * 1024 / mib);
      return readouts([
          ['KV per token', bytes / 1024 + ' KiB'],
          ['KV per session', mib + ' MiB'],
          ['Memory ceiling', ceiling + ' sessions']
        ]) +
        '<p>Both K and V are retained. Count KV heads for grouped-query attention. The 24 GiB budget is for KV alone; all sessions use the entire selected context. The estimate excludes fragmentation, quantization scales and sharing.</p>' +
        '<details class="solve"><summary>Interviewer follow-up: the first token improved, but playback stalls</summary><p>Capture first audible audio, per-chunk generation time, queue age and playout-buffer depth on the same stream. Inspect long prefills sharing a worker with decode. For a speech-native model, distinguish audio codec frames from text tokens; for a cascade, check whether text chunking starves TTS.</p></details>';
    }
  },
  coding: {
    controls: [],
    draw() {
      return '<p>A late callback can arrive after the user interrupts. Bound the queue in milliseconds, reject stale generations, and preserve FIFO delivery under the stated ordering contract.</p>' +
        '<div class="downloads"><a class="action primary" href="playout_exercise.py" download>Download starter and tests</a></div>' +
        '<pre><code>python3 playout_exercise.py</code></pre>' +
        '<details class="solve"><summary>Compare after your attempt</summary><p>Save the reference beside the starter, then run the same tests against it.</p><a href="playout_reference.py" download>Download worked implementation</a><pre><code>python3 playout_exercise.py --reference</code></pre></details>';
    }
  },
  mock: {
    controls: [selectControl('incident', 'Interviewer inject', ['Baseline design', 'Mobile-only regression', 'Peak-time stalls', 'Region loss', 'Changed recognition quality'])],
    draw(s) {
      const incidents = [
        ['Choose your first boundary', 'The browser path uses WebRTC. The telephone path delivers 8 kHz mono audio. The service must support interruption and external tool calls.', 'Sketch both paths and specify where audio is decoded, resampled, queued, encrypted and eligible for retention.'],
        ['Mobile latency rises by 180 ms', 'In the affected cohort, GPU queue and TTS times are flat. An interval of jitterBufferDelay grows by 12 s across 100 emitted units, versus 3 s across 100 before.', 'Compute the extra 90 ms of average dwell. Explain why subtracting it from a cohort p95 is invalid. Request matched per-turn playout traces and device-route data before attributing the remainder.'],
        ['More tokens/s, more silence', 'After batching changes, median first audio falls 40 ms, but p99 gap between audio chunks goes from 50 to 190 ms. Playout reserve is 80 ms before such a gap.', 'A 190 ms gap can starve this player for 110 ms. Inspect queue age and decode service during long prefills, replay peak arrivals, then canary a deadline-aware policy.'],
        ['One region drains unexpectedly', 'Two equal pools originally split 10,000 calls. At 40% active audio, each used 36 GPUs under the exercise budget. All calls move to one surviving pool.', 'The idealized surviving ASR requirement is 72 GPUs. Decide what is already warm, what can scale within the SLO, which work is admitted and how session/turn state resumes.'],
        ['Faster ASR loses account numbers', 'The change cuts ASR completion time by 80 ms and barely moves aggregate WER. Task completion falls on narrowband telephone calls.', 'Pair the same calls across old and new models; stratify narrowband, noise and language; score digit/entity accuracy, revisions and false endpoints. Roll back by cohort if a predeclared guardrail fails.']
      ];
      const [title, problem, discussion] = incidents[s.incident];
      return '<h3>' + title + '</h3><p>' + problem + '</p><details class="solve"><summary>Discuss after your answer</summary><p>' + discussion + '</p></details>';
    }
  }
};

function hearAxis(end) {
  return Math.ceil(end / 100) * 100;
}
