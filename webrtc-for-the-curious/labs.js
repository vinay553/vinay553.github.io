window.labs = (() => {
  const initial = {
    phase: 0,
    codec: 0,
    net: 0,
    turn: true,
    match: true,
    buffer: 30,
    repair: 1,
    rtt: 20,
    ordered: true,
    retry: true,
    people: 4,
    topology: 0,
    issue: 1,
    era: 0,
    claim: 0,
    spec: 0
  };
  const el = (tag, txt, cls) => {
    const n = document.createElement(tag);
    if (txt !== undefined) n.textContent = txt;
    if (cls) n.className = cls;
    return n
  };

  function mount(host, lesson) {
    const s = {
        ...initial
      },
      id = lesson.id,
      events = new AbortController(),
      resources = [];
    const make = (name, t, c) => el(name, t, c);
    const header = make('div', undefined, 'labhead'),
      tit = make('div');
    const kicker = make('div', undefined, 'lab-kicker');
    kicker.append(make('b', '∿'), document.createTextNode('Interactive lab'));
    tit.append(kicker, make('h2', lesson.lab));
    header.append(tit, make('span', id === 'glossary' ? 'Lookup' : id === 'reference' ? 'Index' : id === 'history' || id === 'faq' ? 'Explore' : 'Simulation', 'model'));
    host.replaceChildren(header);
    const stop = () => {
      events.abort();
      resources.forEach(fn => fn())
    };
    if (id === 'glossary') {
      const d = make('div', undefined, 'directory'),
        label = make('label', 'Find a term'),
        input = make('input');
      input.className = 'search';
      input.type = 'search';
      input.id = 'term-search';
      input.placeholder = 'Try “NACK”, “codec” or “timing”';
      label.htmlFor = input.id;
      const status = make('p');
      status.setAttribute('role', 'status');
      const list = make('div', undefined, 'wordlist');

      function update() {
        list.replaceChildren();
        const q = input.value.trim().toLowerCase();
        const match = window.terms.filter(([k, v]) => (k + ' ' + v).toLowerCase().includes(q));
        status.textContent = match.length + ' matching ' + (match.length === 1 ? 'term' : 'terms');
        match.forEach(([k, v]) => {
          const details = make('details');
          details.append(make('summary', k), make('p', v));
          list.append(details)
        });
        if (!match.length) list.append(make('p', 'Try an acronym or a shorter description.'))
      }
      input.addEventListener('input', update);
      d.append(label, input, status, list);
      host.append(d);
      update();
      return stop;
    }
    const plot = make('div', undefined, 'plot'),
      canvas = make('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    plot.append(canvas);
    const ctrls = make('div', undefined, 'controls'),
      answer = make('div', undefined, 'result'),
      answerTitle = make('strong'),
      answerText = make('p');
    answer.setAttribute('aria-live', 'polite');
    answer.append(answerTitle, answerText);
    host.append(plot, ctrls, answer);
    const updaters = [];

    function seg(key, names, accessible) {
      const group = make('div', undefined, 'segments');
      group.setAttribute('aria-label', accessible);
      group.setAttribute('role', 'group');
      names.forEach((name, i) => {
        const b = make('button', name);
        b.type = 'button';
        b.onclick = () => {
          s[key] = i;
          update()
        };
        updaters.push(() => b.setAttribute('aria-pressed', s[key] === i));
        group.append(b)
      });
      ctrls.append(group)
    }

    function choose(key, name, opts) {
      const lb = make('label', name, 'ctrl-label'),
        select = make('select');
      opts.forEach(t => select.add(new Option(t)));
      select.selectedIndex = s[key];
      select.onchange = () => {
        s[key] = select.selectedIndex;
        update()
      };
      lb.append(select);
      ctrls.append(lb)
    }

    function toggle(key, name) {
      const lb = make('label', undefined, 'ctrl-label'),
        box = make('input');
      box.type = 'checkbox';
      box.checked = s[key];
      box.onchange = () => {
        s[key] = box.checked;
        update()
      };
      lb.append(box, document.createTextNode(name));
      ctrls.append(lb)
    }

    function slide(key, name, min, max, unit) {
      const lb = make('label', name, 'ctrl-label'),
        inp = make('input'),
        out = make('output');
      inp.type = 'range';
      inp.min = min;
      inp.max = max;
      inp.value = s[key];
      inp.id = 'range-' + key;
      out.htmlFor = inp.id;
      lb.htmlFor = inp.id;
      inp.oninput = () => {
        s[key] = Number(inp.value);
        update()
      };
      updaters.push(() => {
        out.value = s[key] + unit
      });
      lb.append(inp, out);
      ctrls.append(lb)
    }
    const phases = [
      ['Exchange descriptions', 'Peer A sends an offer through the application’s signaling service. Peer B returns an answer. The dotted path carries setup messages.'],
      ['Test the route', 'Both peers exchange candidates and run ICE checks. Here a direct pair succeeds and the controlling peer nominates it.'],
      ['Verify and derive keys', 'A DTLS handshake runs over the selected path. The peers check certificate fingerprints and derive keys for their protected transports.'],
      ['Exchange media or data', 'The direct path now carries SRTP media or SCTP messages inside DTLS. The signaling service can still carry future session changes.']
    ];
    const evidence = [
      ['No remote description', 'The offerer has a local offer; the answerer has no remote description. Inspect the application’s message delivery before interpreting ICE or media counters.'],
      ['No selected pair', 'Both descriptions are present. Candidate checks fail and no pair is nominated. Inspect gathered candidate types and whether an authorized relay is available.'],
      ['Identity check failed', 'ICE selected a pair, but DTLS failed with a certificate fingerprint mismatch. Compare the authenticated signaling description with the certificate presented by this peer.'],
      ['No arriving media', 'ICE and DTLS are connected. Audio plays, but inbound video bytes stay at zero. Check the negotiated video direction and the sender’s outbound video track and counters.'],
      ['Packets arrive; frames stall', 'Inbound video bytes increase while framesDecoded stays flat and the receiver requests picture refreshes. Inspect decoder configuration, incomplete frames and keyframe availability.']
    ];
    const eras = [
      ['Early 1990s · MBone', 'Early packet media tools met real network constraints. Software compression and multicast distribution helped small experimental groups share video.'],
      ['1996 · RTP is published', 'RFC 1889 standardized common timing and packet conventions. Different media formats could use a recognizable transport header.'],
      ['2007 · Marratech joins Google', 'Conferencing expertise fed into browser calling work. Gmail initially depended on an installed plug-in to access media functions.'],
      ['2010 · Maastricht discussions', 'Browser vendors and implementers explored communications without a plug-in. Wire protocols and JavaScript interfaces emerged as distinct standards work.'],
      ['2021 · Browser API recommendation', 'WebRTC 1.0 became a W3C Recommendation. The milestone consolidated an interoperable API built on decades of protocol work.']
    ];
    const claims = [
      ['“WebRTC always needs UDP.”', 'UDP is usually preferred because the stack can choose how to recover losses. TURN over TCP or TLS can provide a fallback on restricted networks.'],
      ['“Unordered means unreliable.”', 'Unordered reliable messages can arrive out of order and still be retransmitted. Ordering and retry policy are separate choices.'],
      ['“A data channel can only send text.”', 'A data channel accepts binary messages as well. For video sent this way, your application must implement the playback pipeline.'],
      ['“A low RTT guarantees low video delay.”', 'Capture, encoding, buffering and display introduce time beyond the packet round trip. Measure end-to-end video latency separately.']
    ];
    switch (id) {
      case 'overview':
        seg('phase', ['1  Signal', '2  Connect', '3  Secure', '4  Communicate'], 'Connection phase');
        break;
      case 'signaling':
        choose('codec', 'Peer B supports', ['VP8 only', 'H.264 only', 'AV1 only']);
        break;
      case 'connecting':
        choose('net', 'Network', ['Same LAN', 'Direct internet path', 'Direct traffic blocked']);
        toggle('turn', 'TURN available');
        break;
      case 'securing':
        toggle('match', 'Certificate matches the signaled fingerprint');
        break;
      case 'networking':
        slide('buffer', 'Playout buffer', 0, 75, ' ms');
        break;
      case 'media':
        choose('repair', 'Recovery', ['No packet loss', 'Request retransmission', 'Wait for refresh']);
        slide('rtt', 'Repair time', 5, 90, ' ms');
        break;
      case 'data':
        toggle('ordered', 'Ordered delivery');
        toggle('retry', 'Retry missing message');
        break;
      case 'applied':
        seg('topology', ['Mesh', 'SFU', 'MCU'], 'Room topology');
        slide('people', 'Participants', 2, 10, '');
        break;
      case 'debugging':
        choose('issue', 'Call trace', ['Offer undelivered', 'ICE checks fail', 'Identity mismatch', 'Video bytes flat', 'Decoder stalled']);
        break;
      case 'history':
        choose('era', 'Milestone', ['MBone experiments', 'First RTP RFC', 'Marratech acquisition', 'Maastricht', 'WebRTC 1.0']);
        break;
      case 'faq':
        seg('claim', ['Transport', 'Delivery', 'Payload', 'Latency'], 'Common claim');
        break;
      case 'reference':
        choose('spec', 'Question', window.specs.map(x => x[1]));
        break;
    }

    function outcome() {
      switch (id) {
        case 'overview':
          return phases[s.phase];
        case 'signaling':
          return s.codec === 2 ? ['No common codec', 'The offer lists VP8 and H.264. Peer B accepts only AV1, so this video section must be rejected (port 0). Other compatible sections may still succeed.'] : ['Receive ' + (s.codec ? 'H.264' : 'VP8'), 'Peer A offered to send VP8 or H.264. Peer B answers recvonly with the common format. Its RTP mapping must agree with the offer.'];
        case 'connecting':
          return s.net === 0 ? ['Host pair selected', 'Both hosts are reachable on the same LAN in this scenario. ICE checks the pair before using it; a relay allocation is unnecessary.'] : s.net === 1 ? ['Direct pair selected', 'STUN discovers a mapped address. The modeled NATs permit packets between peers, and a successful ICE check confirms a direct path.'] : s.turn ? ['Relay pair selected', 'The direct checks failed. The relay is reachable, its allocation and permission are valid, and its checks succeed. Media stays encrypted in transit.'] : ['No usable pair', 'The scenario blocks direct peer traffic and no relay is available. Exchanging descriptions alone cannot establish the call.'];
        case 'securing':
          return s.match ? ['Identity check passes', 'The short fingerprints in this drawing match. With trusted signaling and the rest of the handshake validated, the endpoints can use the derived keys.'] : ['Handshake rejected', 'The presented certificate has a different fingerprint. Even a working ICE path cannot establish the expected identity.'];
        case 'networking': {
          const late = [25, 46, 19, 29].map((d, i) => d > s.buffer ? i + 1 : 0).filter(Boolean);
          return [(4 - late.length) + ' of 4 arrive on time', 'Packets leave at 0, 20, 40 and 60 ms; they arrive at 25, 66, 59 and 89 ms. At ' + s.buffer + ' ms of buffering, ' + (late.length ? 'late packets are ' + late.join(', ') + '.' : 'every packet meets its deadline.')]
        }
        case 'media':
          return s.repair === 0 ? ['All five frames decode', 'The I-frame supplies a reference. Each of the next three predicted pictures arrives intact before the next independent frame.'] : s.repair === 1 && s.rtt <= 35 ? ['Repair beats playout', 'The missing P1 fragment returns in ' + s.rtt + ' ms against a 35 ms budget. Later dependent frames can use the repaired picture.'] : ['Wait for an independent frame', s.repair === 2 ? 'A PLI prompts a refresh. In this model the next I-frame restores decoding; the previously missed pictures remain missed.' : 'At ' + s.rtt + ' ms the retry misses the 35 ms deadline. This simplified decoder drops dependent pictures until the next independent frame.'];
        case 'data':
          return [s.ordered ? 'Ordered stream' : 'Unordered stream', s.ordered ? (s.retry ? 'Message 3 waits behind missing 2. When 2 is repaired the app receives 2, then 3.' : 'Message 3 waits until the sender abandons 2 and signals that the receiver can advance.') : (s.retry ? 'Message 3 can be delivered as soon as it arrives. The application receives repaired message 2 later.' : 'Message 3 arrives immediately. After abandonment, message 2 is never delivered in this example.')];
        case 'applied': {
          const n = s.people;
          return [s.topology === 0 ? n * (n - 1) / 2 + ' peer links' : n + ' server connections', s.topology === 0 ? 'Per client: ' + (n - 1) + ' Mb/s up and ' + (n - 1) + ' Mb/s down. There is no media server in this model.' : s.topology === 1 ? 'Per client: 1 Mb/s up and ' + (n - 1) + ' Mb/s down. Server egress: ' + n * (n - 1) + ' Mb/s.' : 'Per client: 1 Mb/s up and 1 Mb/s down. Server egress: ' + n + ' Mb/s plus the work of decoding and encoding composites.']
        }
        case 'debugging':
          return evidence[s.issue];
        case 'history':
          return eras[s.era];
        case 'faq':
          return claims[s.claim];
        case 'reference': {
          const spec = window.specs[s.spec];
          return [spec[2], spec[4]]
        }
      }
    }

    function redraw() {
      window.drawLab(canvas, id, s)
    }

    function update() {
      updaters.forEach(f => f());
      const [t, p] = outcome();
      answerTitle.textContent = t;
      answerText.textContent = p;
      if (id === 'reference') {
        const a = make('a', 'Read the specification');
        a.href = window.specs[s.spec][3];
        a.target = '_blank';
        a.rel = 'noopener';
        answerText.append(' ', a)
      }
      redraw()
    }
    if (id === 'applied') {
      const d = make('div', undefined, 'more-lab');
      d.append(make('small', 'Model assumptions: each participant publishes one 1 Mb/s encoding and subscribes to everyone else. MCU output is one 1 Mb/s composite per client. Protocol overhead is excluded.'));
      host.append(d)
    }
    if (id === 'data') {
      const d = make('div', undefined, 'more-lab'),
        title = make('strong', 'Try a real browser data channel'),
        btn = make('button', 'Send a local ping', 'action'),
        status = make('output', 'Ready.');
      btn.type = 'button';
      status.setAttribute('aria-live', 'polite');
      d.append(title, make('p', 'Two peers in this browser negotiate a connection and exchange one message. No camera, microphone or signaling server is needed.'), btn, status);
      host.append(d);
      btn.onclick = async () => {
        if (!window.RTCPeerConnection) {
          status.textContent = 'This browser does not expose RTCPeerConnection.';
          return
        }
        btn.disabled = true;
        status.textContent = 'Negotiating two local peers…';
        let a, b, timer, finished = false;
        const finish = msg => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          if (a) a.close();
          if (b) b.close();
          if (!events.signal.aborted) {
            status.textContent = msg;
            btn.disabled = false
          }
        };
        resources.push(() => finish('Closed.'));
        timer = setTimeout(() => finish('Local ICE did not connect in time. Browser privacy or network settings can prevent loopback connections.'), 14000);
        try {
          a = new RTCPeerConnection({
            iceServers: []
          });
          b = new RTCPeerConnection({
            iceServers: []
          });

          function gather(pc) {
            if (pc.iceGatheringState === 'complete' || finished) return Promise.resolve();
            return new Promise(resolve => {
              const check = () => {
                if (pc.iceGatheringState === 'complete' || pc.signalingState === 'closed') {
                  pc.removeEventListener('icegatheringstatechange', check);
                  resolve()
                }
              };
              pc.addEventListener('icegatheringstatechange', check);
              resources.push(resolve);
              setTimeout(resolve, 3000)
            })
          }
          const local = a.createDataChannel('fieldbook');
          b.ondatachannel = ({
            channel
          }) => {
            channel.onmessage = ({
              data
            }) => {
              if (data === 'ping') channel.send('pong')
            }
          };
          local.onopen = () => local.send('ping');
          local.onmessage = ({
            data
          }) => finish(data === 'pong' ? 'Success. Peer A sent “ping” and Peer B replied “pong” over a real RTCDataChannel.' : 'Unexpected reply.');
          await a.setLocalDescription(await a.createOffer());
          await gather(a);
          if (finished) return;
          await b.setRemoteDescription(a.localDescription);
          await b.setLocalDescription(await b.createAnswer());
          await gather(b);
          if (finished) return;
          await a.setRemoteDescription(b.localDescription);
        } catch (e) {
          finish('This browser could not complete the local connection (' + e.name + ').')
        }
      };
    }
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);
    resources.push(() => observer.disconnect());
    update();
    return stop;
  }
  return {
    mount
  };
})();
