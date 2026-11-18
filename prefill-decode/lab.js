'use strict';

const examples = {
  moon: {
    prompt: ['The', 'moon', 'orbits', 'the'],
    output: ['Earth', '.', '[EOS]']
  },
  water: {
    prompt: ['Water', 'freezes', 'at'],
    output: ['0', '°', 'C', '.', '[EOS]']
  },
  long: {
    prompt: ['Finish', 'this', 'sentence', 'about', 'our', 'solar', 'system', ':'],
    output: ['Earth', 'orbits', 'the', 'Sun', '.', '[EOS]']
  }
};

const el = id => document.getElementById(id);
const promptPicker = el('example');
const timeline = el('timeline');
let example = examples[promptPicker.value];
let step = 1;
let timer;

function item(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function phaseName(index) {
  if (index === 0) return 'Prompt';
  if (index === 1) return 'Prefill';
  return 'Decode ' + (index - 1);
}

function snapshot() {
  const {prompt, output} = example;
  const tokens = [...prompt, ...output.slice(0, step)];
  const cached = step === 0 ? 0 : tokens.length - 1;
  const current = step === 1 ? prompt.map((_, i) => i) : step > 1 ? [cached - 1] : [];
  const retained = cached - current.length;
  const choice = step ? output[step - 1] : undefined;
  return {tokens, cached, current, retained, choice, promptLength: prompt.length};
}

function setupTimeline() {
  timeline.replaceChildren();
  for (let i = 0; i <= example.output.length; i += 1) {
    const entry = item('li');
    const button = item('button', '', phaseName(i));
    button.type = 'button';
    button.addEventListener('click', () => go(i));
    entry.append(button);
    timeline.append(entry);
  }
}

function renderTokens({tokens, current, promptLength}) {
  const sequence = el('sequence');
  sequence.replaceChildren();
  tokens.forEach((token, index) => {
    const active = current.includes(index);
    const kind = index < promptLength ? 'prompt' : 'output';
    const block = item('div', 'token ' + kind + (active ? ' active' : ''));
    if (index === tokens.length - 1 && step) block.classList.add('just-emitted');
    block.title = 'Position ' + (index + 1) + (active ? ' · Input this pass' : '');
    block.append(item('span', 'token-text', token), item('span', 'position', String(index + 1)));
    sequence.append(block);
  });
}

function renderAttention({tokens, current, cached, retained}) {
  const container = el('attention');
  const key = el('matrix-key');
  container.replaceChildren();
  key.replaceChildren();
  if (!current.length) {
    container.append(item('p', 'empty', 'Run prefill to see the causal attention pattern.'));
    return;
  }

  const table = item('table', 'matrix');
  const caption = item('caption', 'sr-only', 'Attention visibility by query and key position');
  const header = item('thead');
  const headingRow = item('tr');
  headingRow.append(item('th', 'axis', 'Q ↓ / K →'));
  for (let k = 0; k < cached; k += 1) {
    const cell = item('th', 'column', String(k + 1));
    cell.scope = 'col';
    cell.title = 'Key ' + (k + 1) + ': ' + tokens[k];
    headingRow.append(cell);
  }
  header.append(headingRow);
  const body = item('tbody');
  for (const q of current) {
    const row = item('tr');
    const label = item('th', 'row-label', (q + 1) + ' · ' + tokens[q]);
    label.scope = 'row';
    row.append(label);
    for (let k = 0; k < cached; k += 1) {
      const state = k > q ? 'masked' : k < retained ? 'reused' : 'fresh';
      const cell = item('td');
      const description = state === 'masked' ? 'Masked future position' :
        state === 'reused' ? 'Attends to cached key' : 'Attends to newly computed key';
      const square = item('span', 'dot ' + state);
      square.setAttribute('aria-hidden', 'true');
      cell.title = tokens[q] + ' → ' + tokens[k] + ' · ' + description;
      cell.append(square, item('span', 'sr-only', description));
      row.append(cell);
    }
    body.append(row);
  }
  table.append(caption, header, body);
  container.append(table);
  key.append(legend('fresh', 'New key'));
  if (retained) key.append(legend('reused', 'Cached key'));
  if (step === 1) key.append(legend('masked', 'Masked future key'));
}

function legend(kind, label) {
  const entry = item('span');
  entry.append(item('i', 'key-' + kind), document.createTextNode(label));
  return entry;
}

function renderCache({tokens, cached, retained}) {
  const container = el('cache');
  container.replaceChildren();
  el('cache-total').textContent = cached + (cached === 1 ? ' position' : ' positions');
  if (!cached) {
    container.append(item('p', 'empty', 'The cache is empty.'));
    return;
  }
  for (let i = 0; i < cached; i += 1) {
    const block = item('div', 'cache-block ' + (i < retained ? 'reused' : 'fresh'));
    const title = item('span', 'cache-label', (i + 1) + ' · ' + tokens[i]);
    block.append(title, item('span', 'cache-unit', 'K'), item('span', 'cache-unit', 'V'));
    container.append(block);
  }
}

function renderDescription({tokens, choice, cached, current, retained, promptLength}) {
  const container = el('step-description');
  container.replaceChildren();
  container.append(item('p', 'eyebrow step-label', 'STEP ' + step + ' OF ' + example.output.length));
  const title = item('h2', '', step === 0 ? 'Prompt ready' : step === 1 ? 'Prefill' : 'Decode ' + (step - 1));
  const text = item('p', 'step-copy');
  if (step === 0) {
    text.textContent = 'All ' + promptLength + ' prompt tokens are available. The model has not processed them yet.';
  } else if (step === 1) {
    text.textContent = 'The model processes all ' + promptLength +
      ' prompt tokens. The last prompt position supplies the logits used to select the first output token.';
  } else {
    text.textContent = 'The model takes “' + tokens[cached - 1] + '” as its only new input, reads ' + retained +
      ' cached positions, and stores the key and value for the new position.';
  }
  container.append(title, text);
  if (choice) {
    const emitted = item('div', 'emitted');
    emitted.append(item('span', '', 'Emitted'), item('strong', '', choice));
    container.append(emitted);
    const note = choice === '[EOS]'
      ? 'End of sequence encountered. Generation stops and this token is not fed back.'
      : 'This token can go into the cache when it is fed into the next pass.';
    container.append(item('p', 'output-note', note));
  }

  el('inputs').textContent = current.length;
  el('pairs').textContent = current.reduce((total, index) => total + index + 1, 0);
}

function render() {
  const data = snapshot();
  renderTokens(data);
  renderAttention(data);
  renderCache(data);
  renderDescription(data);
  [...timeline.querySelectorAll('button')].forEach((button, index) => {
    if (index === step) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
    button.classList.toggle('complete', index < step);
  });
  const currentTab = timeline.querySelector('[aria-current="step"]').getBoundingClientRect();
  const scrollArea = timeline.parentElement;
  const area = scrollArea.getBoundingClientRect();
  if (currentTab.left < area.left) scrollArea.scrollLeft += currentTab.left - area.left - 8;
  if (currentTab.right > area.right) scrollArea.scrollLeft += currentTab.right - area.right + 8;
  el('back').disabled = step === 0;
  el('next').disabled = step === example.output.length;
  el('play').textContent = timer ? 'Pause' : step === example.output.length ? 'Replay' : 'Play';
}

function pause() {
  clearInterval(timer);
  timer = undefined;
}

function go(value) {
  pause();
  step = Math.min(example.output.length, Math.max(0, value));
  render();
}

function autoplay() {
  if (timer) {
    pause();
  } else {
    if (step === example.output.length) step = 0;
    step += 1;
    if (step < example.output.length) {
      timer = setInterval(() => {
        step += 1;
        if (step === example.output.length) pause();
        render();
      }, 2100);
    }
  }
  render();
}

promptPicker.addEventListener('change', () => {
  example = examples[promptPicker.value];
  setupTimeline();
  go(0);
});
el('reset').addEventListener('click', () => go(0));
el('back').addEventListener('click', () => go(step - 1));
el('next').addEventListener('click', () => go(step + 1));
el('play').addEventListener('click', autoplay);
el('lab').addEventListener('keydown', event => {
  if (event.target === promptPicker || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  go(step + (event.key === 'ArrowLeft' ? -1 : 1));
});

setupTimeline();
render();
