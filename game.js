(function (root) {
'use strict';

const NAMES = ['', '송학', '매조', '벚꽃', '흑싸리', '난초', '모란', '홍싸리', '공산', '국진', '단풍', '오동', '비'];
// G 광 / B 열끗(고도리 새) / Y 열끗 / H 홍단 / C 초단 / F 청단 / D 띠 / P 피 / S 쌍피
const SPEC = {
  1: 'GHPP', 2: 'BHPP', 3: 'GHPP', 4: 'BCPP', 5: 'YCPP', 6: 'YFPP',
  7: 'YCPP', 8: 'GBPP', 9: 'YFPP', 10: 'YFPP', 11: 'GSPP', 12: 'GYDS'
};
const TYPE = { G: '광', B: '열', Y: '열', H: '띠', C: '띠', F: '띠', D: '띠', P: '피', S: '피' };
const KN = { G: '광', B: '열끗', Y: '열끗', H: '홍단', C: '초단', F: '청단', D: '띠', P: '피', S: '쌍피' };
const NM = ['방장', '손님'];
const MIN = 7; // 맞고는 7점부터 고/스톱

const kname = c => (c.m === 12 && c.k === 'G') ? '비광' : KN[c.k];
const lab = c => c.m + '월 ' + kname(c);

function mkDeck() {
  const d = []; let id = 0;
  for (let m = 1; m <= 12; m++) for (const k of SPEC[m]) d.push({ id: id++, m, k });
  return d;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function calc(cs) {
  const n = k => cs.filter(c => c.k === k).length;
  const t = x => cs.filter(c => TYPE[c.k] === x);
  let s = 0;
  const g = t('광');
  if (g.length === 5) s += 15;
  else if (g.length === 4) s += 4;
  else if (g.length === 3) s += g.some(c => c.m === 12) ? 2 : 3;
  const y = t('열');
  if (y.length >= 5) s += y.length - 4;
  if (n('B') === 3) s += 5;
  const d = t('띠');
  if (d.length >= 5) s += d.length - 4;
  if (n('H') === 3) s += 3;
  if (n('C') === 3) s += 3;
  if (n('F') === 3) s += 3;
  const p = t('피').reduce((a, c) => a + (c.k === 'S' ? 2 : 1), 0);
  if (p >= 10) s += p - 9;
  return s;
}

function newGame(first) {
  first = first || 0;
  for (;;) {
    const d = shuffle(mkDeck());
    const hands = [d.splice(0, 10), d.splice(0, 10)];
    const floor = d.splice(0, 8);
    const cnt = {};
    floor.forEach(c => cnt[c.m] = (cnt[c.m] || 0) + 1);
    if (Object.values(cnt).includes(4)) continue;
    return {
      hands, floor, deck: d, cap: [[], []], turn: first, phase: 'play',
      pend: null, drawn: null, go: [0, 0], last: [0, 0], log: [], result: null
    };
  }
}

function lg(s, t) { s.log.push(t); if (s.log.length > 8) s.log.shift(); }

function take(s, p, card, m) {
  s.floor = s.floor.filter(c => !m.includes(c));
  s.cap[p].push(card, ...m);
  lg(s, NM[p] + ': ' + lab(card) + ' → ' + m.map(lab).join(', ') + ' 획득');
}

// 카드를 바닥에 내려놓고 매칭. 선택이 필요하면 false
function place(s, p, card, stage) {
  const m = s.floor.filter(c => c.m === card.m);
  if (m.length === 2) {
    s.pend = { card, opts: m.map(c => c.id), stage };
    s.phase = stage === 'play' ? 'pickPlay' : 'pickDraw';
    return false;
  }
  if (m.length === 0) {
    s.floor.push(card);
    lg(s, NM[p] + ': ' + lab(card) + ' 바닥에 놓음');
  } else {
    take(s, p, card, m);
  }
  return true;
}

function next(s, p) {
  if (!s.hands[0].length && !s.hands[1].length) {
    s.phase = 'over';
    s.result = { winner: null };
    lg(s, '패가 다 떨어졌어요 — 무승부');
    return;
  }
  s.turn = 1 - p;
  s.phase = 'play';
}

function finish(s, p) {
  const base = calc(s.cap[p]);
  const g = s.go[p];
  let pts = base + Math.min(g, 2);
  if (g >= 3) pts *= Math.pow(2, g - 2);
  s.phase = 'over';
  s.result = { winner: p, base, go: g, pts };
  lg(s, NM[p] + ' 스톱! ' + pts + '점');
}

function endTurn(s, p) {
  const sc = calc(s.cap[p]);
  if (sc >= MIN && sc > s.last[p]) {
    if (s.hands[p].length === 0) { finish(s, p); return; }
    s.phase = 'goStop';
    return;
  }
  next(s, p);
}

function draw(s, p) {
  if (s.deck.length) {
    const c = s.deck.pop();
    s.drawn = c;
    if (!place(s, p, c, 'draw')) return;
  }
  endTurn(s, p);
}

function playCard(s, p, id) {
  const i = s.hands[p].findIndex(c => c.id === id);
  const card = s.hands[p].splice(i, 1)[0];
  s.drawn = null;
  if (place(s, p, card, 'play')) draw(s, p);
}

function pick(s, p, id) {
  const { card, stage } = s.pend;
  const m = [s.floor.find(c => c.id === id)];
  s.pend = null;
  s.phase = 'busy';
  take(s, p, card, m);
  if (stage === 'play') draw(s, p); else endTurn(s, p);
}

// 액션 적용. 상태가 바뀌었으면 true
function act(s, who, a) {
  if (!s || s.phase === 'over' || s.turn !== who) return false;
  switch (a.k) {
    case 'play':
      if (s.phase !== 'play' || !s.hands[who].some(c => c.id === a.id)) return false;
      playCard(s, who, a.id); return true;
    case 'pick':
      if ((s.phase !== 'pickPlay' && s.phase !== 'pickDraw') || !s.pend.opts.includes(a.id)) return false;
      pick(s, who, a.id); return true;
    case 'go':
      if (s.phase !== 'goStop') return false;
      s.go[who]++;
      s.last[who] = calc(s.cap[who]);
      lg(s, NM[who] + ': ' + s.go[who] + '고!');
      next(s, who); return true;
    case 'stop':
      if (s.phase !== 'goStop') return false;
      finish(s, who); return true;
  }
  return false;
}

const byMonth = (a, b) => a.m - b.m || a.id - b.id;

function viewFor(s, me) {
  return {
    me, turn: s.turn, phase: s.phase,
    hand: s.hands[me].slice().sort(byMonth),
    oppN: s.hands[1 - me].length,
    deckN: s.deck.length,
    floor: s.floor.slice().sort(byMonth),
    cap: s.cap, drawn: s.drawn,
    pend: s.pend ? { card: s.pend.card, opts: s.pend.opts } : null,
    go: s.go, sc: [calc(s.cap[0]), calc(s.cap[1])],
    log: s.log, result: s.result, min: MIN
  };
}

const api = { NAMES, KN, TYPE, MIN, kname, mkDeck, calc, newGame, act, viewFor };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.Matgo = api;
})(typeof window !== 'undefined' ? window : globalThis);
