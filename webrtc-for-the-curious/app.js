(() => {
  'use strict';
  const chapters = window.chapters,
    mainCount = 10;
  const D = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n
  };
  const link = (label, url, external = false) => {
    const a = D('a', label);
    a.href = url;
    if (external) {
      a.target = '_blank';
      a.rel = 'noopener'
    }
    return a
  };
  const key = 'signalschool.webrtc.v1';
  let data;
  try {
    data = JSON.parse(localStorage.getItem(key)) || {}
  } catch {
    data = {}
  }
  if (typeof data !== 'object' || Array.isArray(data)) data = {};
  for (const k of ['done', 'notes', 'quiz'])
    if (!data[k] || typeof data[k] !== 'object') data[k] = {};

  function save() {
    try {
      localStorage.setItem(key, JSON.stringify(data))
    } catch {
      /* The course still works when browser storage is disabled. */ }
  }
  let current = null,
    cleanup = () => {};
  const rail = document.getElementById('sidebar'),
    menu = document.getElementById('menu'),
    lesson = document.getElementById('lesson');

  function closeMenu() {
    rail.classList.remove('open');
    menu.setAttribute('aria-expanded', 'false')
  }
  menu.addEventListener('click', () => {
    const open = rail.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open))
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && rail.classList.contains('open')) {
      closeMenu();
      menu.focus()
    }
  });
  document.querySelector('.skip').onclick = e => {
    e.preventDefault();
    document.getElementById('main').focus()
  };

  function nav() {
    const ch = document.getElementById('chapnav'),
      extra = document.getElementById('resnav');
    ch.replaceChildren();
    extra.replaceChildren();
    chapters.forEach((c, i) => {
      const a = link('', '#' + c.id);
      a.className = 'navitem';
      if (current === c.id) {
        a.classList.add('active');
        a.setAttribute('aria-current', 'page')
      }
      a.append(D('span', i < mainCount ? String(i + 1).padStart(2, '0') : ['?', 'Aa', '§'][i - mainCount], 'nnum'), D('span', c.nav));
      if (data.done[c.id]) {
        const mark = D('span', '✓', 'doneMark');
        mark.setAttribute('aria-label', 'completed');
        a.append(mark)
      }
      a.addEventListener('click', closeMenu);
      (i < mainCount ? ch : extra).append(a)
    });
    const n = chapters.slice(0, mainCount).filter(x => data.done[x.id]).length;
    document.getElementById('progress').value = n;
    document.getElementById('progressText').textContent = n + ' / ' + mainCount;
  }
  const units = ['Foundations', 'Session setup', 'Session setup', 'Session setup', 'Transport', 'Transport', 'Transport', 'Design', 'Operations', 'Origins'];

  function render(c, i) {
    cleanup();
    current = c.id;
    nav();
    lesson.replaceChildren();
    document.title = c.title + ' · Signal School';
    const intro = D('header', undefined, 'lesson-head'),
      k = D('div', undefined, 'eyebrow');
    k.append(D('b', i < 10 ? 'Chapter ' + String(i + 1).padStart(2, '0') + ' / 10' : 'Companion'), D('span', units[i] || c.nav));
    intro.append(k, D('h1', c.title), D('p', c.lead, 'lede'));
    const tabs = D('nav', undefined, 'tabs');
    tabs.setAttribute('aria-label', 'On this page');
    [
      ['lab', 'Interactive lab'],
      ['summary', 'Chapter notes'],
      ['homework', 'Homework']
    ].forEach(([part, label]) => tabs.append(link(label, '#' + c.id + '/' + part)));
    const lab = D('section', undefined, 'lab');
    lab.id = 'lab';
    lab.setAttribute('aria-label', c.lab);
    const notes = D('section', undefined, 'section');
    notes.id = 'summary';
    notes.append(D('div', 'Chapter notes', 'mini-label'), D('h2', 'What to understand'), D('p', c.objective, 'objective'));
    const points = D('div', undefined, 'points');
    c.parts.forEach(([t, p]) => {
      const row = D('div', undefined, 'point');
      row.append(D('h3', t), D('p', p));
      points.append(row)
    });
    notes.append(points);
    const rd = window.readings[i],
      more = D('details', undefined, 'reading');
    more.append(D('summary', 'Read alongside the book'));
    const ul = D('ul');
    [
      [c.nav + ' · full section', rd.url], ...rd.links
    ].forEach(([label, href]) => {
      const li = D('li');
      li.append(link(label, href, true));
      ul.append(li)
    });
    more.append(ul);
    notes.append(more);
    const hw = D('section', undefined, 'section');
    hw.id = 'homework';
    hw.append(D('div', 'Practice', 'mini-label'), D('h2', 'Homework'), D('p', 'Check your understanding, then work through both problems. Your answers are saved in this browser.', 'objective'));
    const cp = D('div', undefined, 'checkpoint'),
      q = c.quiz,
      choices = D('div', undefined, 'options'),
      feedback = D('div', undefined, 'feedback');
    feedback.setAttribute('aria-live', 'polite');
    cp.append(D('div', 'Quick check', 'mini-label'), D('h3', q[0]), choices, feedback);

    function showChoice() {
      const v = data.quiz[c.id],
        valid = Number.isInteger(v) && v >= 0 && v < q[1].length;
      Array.from(choices.children).forEach((b, j) => b.setAttribute('aria-pressed', valid && v === j));
      feedback.textContent = !valid ? '' : v === q[2] ? 'Correct. ' + q[3] : 'Try again. ' + q[3]
    }
    q[1].forEach((ans, j) => {
      const b = D('button', ans);
      b.type = 'button';
      b.onclick = () => {
        data.quiz[c.id] = j;
        save();
        showChoice()
      };
      choices.append(b)
    });
    showChoice();
    hw.append(cp);
    c.work.forEach(([t, p, sol], j) => {
      const e = D('div', undefined, 'exercise'),
        heading = D('h3', t),
        prompt = D('p', p),
        input = D('textarea');
      input.rows = 2;
      input.placeholder = 'Write your reasoning…';
      input.setAttribute('aria-label', t + ' — your answer');
      const id = c.id + '-' + j;
      input.value = data.notes[id] || '';
      input.oninput = () => {
        data.notes[id] = input.value;
        save()
      };
      const details = D('details');
      details.append(D('summary', 'Show worked answer'), D('p', sol));
      e.append(heading, prompt, input, details);
      hw.append(e)
    });
    const foot = D('div', undefined, 'lessonfoot'),
      toggle = D('button', undefined, 'action primary');
    toggle.type = 'button';

    function doneText() {
      toggle.textContent = data.done[c.id] ? '✓  Completed' : 'Mark section complete';
      toggle.setAttribute('aria-pressed', !!data.done[c.id])
    }
    toggle.onclick = () => {
      data.done[c.id] = !data.done[c.id];
      save();
      nav();
      doneText()
    };
    doneText();
    foot.append(toggle);
    if (i + 1 < chapters.length) foot.append(link('Next: ' + chapters[i + 1].nav, '#' + chapters[i + 1].id));
    else foot.append(link('Return to the first chapter', '#overview'));
    hw.append(foot);
    lesson.append(intro, tabs, lab, notes, hw);
    cleanup = window.labs.mount(lab, c);
  }

  function route(initial = false) {
    const [name, part] = location.hash.slice(1).split('/');
    let i = chapters.findIndex(x => x.id === name);
    if (i < 0) i = 0;
    const changed = current !== chapters[i].id;
    if (changed) {
      render(chapters[i], i);
      closeMenu()
    }
    const target = ['lab', 'summary', 'homework'].includes(part) ? part : null;
    document.querySelectorAll('.tabs a').forEach((a, j) => {
      const active = (target || 'lab') === ['lab', 'summary', 'homework'][j];
      a.style.color = active ? 'var(--green)' : 'var(--muted)';
      a.style.borderColor = active ? 'var(--green)' : 'transparent';
      if (active) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current')
    });
    if (target) document.getElementById(target).scrollIntoView({
      block: 'start'
    });
    else if (changed && !initial) {
      window.scrollTo(0, 0);
      document.getElementById('main').focus({
        preventScroll: true
      })
    }
  }
  window.addEventListener('hashchange', () => route());
  route(true);
})();
