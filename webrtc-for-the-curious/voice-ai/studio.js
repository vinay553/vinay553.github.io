(() => {
  'use strict';
  const byId = id => document.getElementById(id);

  function node(tag, text, css) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (css) el.className = css;
    return el;
  }

  function anchor(text, url) {
    const el = node('a', text);
    el.href = url;
    return el;
  }

  function disclosure(title, text) {
    const box = node('details', undefined, 'solve');
    box.append(node('summary', title), node('p', text));
    return box;
  }
  const storageKey = 'signalschool.voice-interviews.v1';
  let records = {};
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) records = saved;
  } catch {
    /* Practice can continue in memory. */ }

  function record(id) {
    if (!records[id] || typeof records[id] !== 'object') records[id] = {};
    if (!Array.isArray(records[id].checks)) records[id].checks = [];
    return records[id];
  }

  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(records));
      return true;
    } catch {
      return false;
    }
  }
  let current, timerInterval;
  const menu = byId('menu'),
    side = byId('sidebar');

  function closeMenu() {
    side.classList.remove('open');
    menu.setAttribute('aria-expanded', 'false');
  }
  menu.onclick = () => menu.setAttribute('aria-expanded', String(side.classList.toggle('open')));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && side.classList.contains('open')) {
      closeMenu();
      menu.focus();
    }
  });
  document.querySelector('.skip').onclick = e => {
    e.preventDefault();
    byId('main').focus();
  };

  function refreshNav() {
    const nav = byId('rounds');
    nav.replaceChildren();
    let total = 0;
    rounds.forEach((round, index) => {
      const checks = record(round.id).checks;
      const count = round.rubric.filter((_, j) => checks[j] === true).length;
      total += count;
      const a = anchor('', '#' + round.id);
      a.className = 'navitem';
      if (round.id === current) {
        a.classList.add('active');
        a.setAttribute('aria-current', 'page');
      }
      a.append(node('span', String(index + 1).padStart(2, '0'), 'nnum'), node('span', round.short));
      if (count === round.rubric.length) {
        const mark = node('span', '✓', 'doneMark');
        mark.setAttribute('aria-label', 'Self-assessment complete');
        a.append(mark);
      }
      a.onclick = closeMenu;
      nav.append(a);
    });
    byId('progress').value = total;
    byId('progressText').textContent = total + ' / 21';
  }

  function experiment(round) {
    const lab = node('section', undefined, 'sim'),
      header = node('header', undefined, 'simhead');
    header.append(node('div', 'Interview lab', 'lab-kicker'), node('h2', round.lab), node('p', round.model));
    const spec = experiments[round.id],
      inputs = node('div', undefined, 'panel-controls'),
      body = node('div', undefined, 'simbody'),
      state = {};
    const status = node('div', undefined, 'sr-only');
    status.setAttribute('role', 'status');

    function redraw(announce) {
      body.innerHTML = spec.draw(state);
      if (announce) status.textContent = body.querySelector('.readouts')?.innerText || body.querySelector('h3')?.textContent || 'Updated';
    }
    spec.controls.forEach(control => {
      state[control.key] = control.initial;
      const label = node('label');
      if (control.options) {
        const select = node('select');
        control.options.forEach(text => select.add(new Option(text)));
        select.selectedIndex = control.initial;
        select.onchange = () => {
          state[control.key] = select.selectedIndex;
          redraw(true);
        };
        label.append(node('span', control.label), select);
      } else {
        const check = node('input');
        check.type = 'checkbox';
        check.checked = control.initial;
        check.onchange = () => {
          state[control.key] = check.checked;
          redraw(true);
        };
        label.append(check, document.createTextNode(control.label));
      }
      inputs.append(label);
    });
    lab.append(header);
    if (spec.controls.length) lab.append(inputs);
    lab.append(body, status);
    redraw(false);
    return lab;
  }

  function mockTimer(info) {
    const row = node('div', undefined, 'clock'),
      output = node('output'),
      button = node('button', undefined, 'action');
    output.setAttribute('aria-live', 'off');

    function remaining() {
      return typeof info.ends === 'number' ? Math.max(0, info.ends - Date.now()) : (info.left ?? 45 * 60000);
    }

    function show() {
      const seconds = Math.ceil(remaining() / 1000);
      output.textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
      button.textContent = seconds === 0 ? 'Restart mock' : info.ends ? 'Pause mock' : info.left ? 'Resume mock' : 'Start 45-minute mock';
    }
    button.onclick = () => {
      const left = remaining();
      if (info.ends && left > 0) {
        info.left = left;
        delete info.ends;
      } else {
        info.ends = Date.now() + (left || 45 * 60000);
        delete info.left;
      }
      save();
      show();
    };
    show();
    timerInterval = setInterval(show, 1000);
    row.append(button, output);
    return row;
  }

  function render(round, index, initial) {
    clearInterval(timerInterval);
    current = round.id;
    const info = record(current);
    refreshNav();
    closeMenu();
    document.title = round.title + ' · Voice AI interviews';
    const root = byId('content'),
      intro = node('header', undefined, 'lesson-head'),
      kicker = node('div', undefined, 'eyebrow');
    kicker.append(node('b', 'Round ' + String(index + 1).padStart(2, '0') + ' / 07'), node('span', round.area + ' · ' + round.minutes + ' min'));
    intro.append(kicker, node('h1', round.title), node('p', round.lead, 'lede'));
    const prompt = node('section', undefined, 'brief');
    prompt.append(node('div', 'Interview prompt', 'mini-label'), node('p', round.prompt));
    if (round.id === 'mock') prompt.append(mockTimer(info));
    const response = node('section', undefined, 'section');
    response.append(node('h2', 'Defend your answer'));
    const box = node('div', undefined, 'exercise'),
      label = node('label', 'Talk through your answer before opening the debrief.');
    const notes = node('textarea');
    notes.id = 'response';
    notes.rows = 4;
    notes.value = typeof info.notes === 'string' ? info.notes : '';
    notes.placeholder = 'Assumptions, calculation, decision, and the measurement that would change it…';
    label.htmlFor = notes.id;
    const saved = node('div', 'Notes and self-assessment stay in this browser.', 'saved');
    notes.oninput = () => {
      info.notes = notes.value;
      saved.textContent = save() ? 'Notes saved in this browser.' : 'Notes available for this visit.';
    };
    box.append(label, notes, saved);
    const debrief = disclosure('Compare with a worked answer', round.answer);
    response.append(box, debrief);
    round.probes.forEach(([q, a]) => response.append(disclosure(q, a)));
    response.append(disclosure('Connect to your calling experience', round.bridge));
    const checks = node('fieldset', undefined, 'rubric');
    checks.append(node('legend', 'What could you demonstrate aloud?'));
    round.rubric.forEach((text, i) => {
      const label = node('label'),
        input = node('input');
      input.type = 'checkbox';
      input.checked = info.checks[i] === true;
      input.onchange = () => {
        info.checks[i] = input.checked;
        save();
        refreshNav();
      };
      label.append(input, document.createTextNode(text));
      checks.append(label);
    });
    response.append(checks);
    const reading = node('details', undefined, 'reading'),
      list = node('ul');
    reading.append(node('summary', 'Engineering references'));
    round.refs.forEach(key => {
      const [label, url] = sources[key], li = node('li'), a = anchor(label, url);
      a.target = '_blank';
      a.rel = 'noopener';
      li.append(a);
      list.append(li);
    });
    const book = node('li');
    book.append(anchor('WebRTC field guide · ' + round.book[1], '../#' + round.book[0]));
    list.append(book);
    reading.append(list);
    const foot = node('nav', undefined, 'lessonfoot');
    foot.setAttribute('aria-label', 'Practice sequence');
    if (index > 0) foot.append(anchor('Previous: ' + rounds[index - 1].short, '#' + rounds[index - 1].id));
    if (index + 1 < rounds.length) foot.append(anchor('Next: ' + rounds[index + 1].short, '#' + rounds[index + 1].id));
    else foot.append(anchor('Return to first round', '#latency'));
    root.replaceChildren(intro, prompt, experiment(round), response, reading, foot);
    if (!initial) {
      window.scrollTo(0, 0);
      byId('main').focus({
        preventScroll: true
      });
    }
  }

  function route(initial = false) {
    let index = rounds.findIndex(r => '#' + r.id === location.hash);
    if (index < 0) index = 0;
    if (current !== rounds[index].id) render(rounds[index], index, initial);
  }
  window.addEventListener('hashchange', () => route());
  route(true);
})();
