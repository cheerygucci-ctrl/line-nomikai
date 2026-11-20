/* 飲み会LINE 管理者サイトの画面と動き。
 * admin/index.html（自分だけが開ける Apps Script のウェブアプリ）から読み込まれ、
 * google.script.run.getDashboard() / saveEvent() でデータをやりとりする。
 * データはここには含まれない。すべて textContent で表示する（HTMLとして解釈しない）。 */
(function () {
  'use strict';
  const SITE = 'https://cheerygucci-ctrl.github.io/line-nomikai/event.html';
  // 本体GAS（LINEに送る役）。キューの送信待ちを今すぐ送ってもらうために呼ぶ
  const MAIN = 'https://script.google.com/macros/s/AKfycby45UwD6Ymwvnf_D_4vMbUGY_m0DUGJtse1oD3hqwHVuDASQ996Xnu2-AKLAqKheMiytQ/exec';
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TABS = [
    { key: 'summary', label: '概要', em: '📊' },
    { key: 'friends', label: '友だち', em: '👋' },
    { key: 'reserve', label: '予約', em: '🎫' },
    { key: 'list', label: '回答', em: '📝' },
    { key: 'dreams', label: '夢', em: '✨' },
    { key: 'notice', label: 'お知らせ', em: '📣' },
    { key: 'event', label: 'イベント', em: '🍻' },
    { key: 'members', label: 'メンバー', em: '👥' },
  ];
  const LONG_KEYS = ['greeting', 'rules', 'schedule', 'notes'];
  let data = null;
  let current = 'summary';
  let onlyAttend = false;
  let friendFilter = 'all';
  let friendSync = null; // 本体GASの syncFriends の結果

  // ---------- 小さな道具 ----------
  function el(tag, props, kids) {
    const e = document.createElement(tag);
    if (props) Object.keys(props).forEach((k) => {
      if (k === 'style') e.style.cssText = props[k];
      else if (k.startsWith('data-') || k.startsWith('aria-') || k === 'role') e.setAttribute(k, props[k]);
      else e[k] = props[k];
    });
    (kids || []).forEach((c) => { if (c != null && c !== false) e.append(c); });
    return e;
  }
  const $ = (id) => document.getElementById(id);
  const stagger = (node, i) => { node.classList.add('pop-in'); node.style.setProperty('--i', Math.min(i, 12)); return node; };
  const run = () => (window.google && google.script && google.script.run) || null;

  function countUp(node, to) {
    if (REDUCED || !to) { node.textContent = to; return; }
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 700);
      node.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function growBars(root) {
    root.querySelectorAll('.bar .fill').forEach((f) => {
      f.style.width = '0';
      requestAnimationFrame(() => requestAnimationFrame(() => { f.style.width = f.dataset.w; }));
    });
  }

  function mascot(face, cls) {
    const box = el('div', { className: cls || '' });
    if (window.Nomy) { Nomy.installCSS(); box.innerHTML = Nomy.svg({ id: 'm' + Math.random().toString(36).slice(2, 7), face: face || 'happy' }); }
    else box.textContent = '🍺';
    return box;
  }

  let toastTimer = null;
  function toast(text, opts) {
    opts = opts || {};
    let t = $('toast');
    if (!t) { t = el('div', { id: 'toast', className: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(t); }
    t.className = 'toast' + (opts.err ? ' err' : '');
    const m = mascot(opts.err ? 'sad' : 'happy', 'mini');
    t.replaceChildren(m, el('span', { textContent: text }));
    requestAnimationFrame(() => t.classList.add('show'));
    if (!opts.err && window.Nomy) setTimeout(() => Nomy.play(m.querySelector('svg'), 'jump'), 200);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), opts.err ? 5000 : 2600);
  }

  function confetti() {
    if (REDUCED) return;
    const box = el('div', { className: 'confetti', 'aria-hidden': 'true' });
    const colors = ['#E9A21B', '#D9472B', '#1F2A44', '#7CC4F2', '#2E8B57'];
    for (let i = 0; i < 36; i++) {
      const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 180;
      box.append(el('i', { style: `--c:${colors[i % colors.length]};--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r - 80}px;--r:${(Math.random() - .5) * 720}deg` }));
    }
    document.body.append(box);
    setTimeout(() => box.remove(), 1400);
  }

  /** 画面内の確認カード（ブラウザの confirm の代わり）。OK なら true で resolve */
  function ask(title, body, okText) {
    return new Promise((resolve) => {
      const ok = el('button', { type: 'button', className: 'primary', textContent: okText || 'OK' });
      const cancel = el('button', { type: 'button', className: 'ghost-btn', style: 'color:var(--ink)', textContent: 'やめる' });
      const card = el('div', { className: 'modal-card', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'mdl-t' }, [
        mascot('wow', 'modal-mascot'), el('h3', { id: 'mdl-t', textContent: title }), el('p', { textContent: body }), el('div', { className: 'modal-actions' }, [cancel, ok]),
      ]);
      const wrap = el('div', { className: 'modal' }, [card]);
      const close = (v) => { wrap.classList.add('out'); setTimeout(() => wrap.remove(), 200); resolve(v); };
      ok.addEventListener('click', () => close(true));
      cancel.addEventListener('click', () => close(false));
      wrap.addEventListener('click', (e) => { if (e.target === wrap) close(false); });
      document.body.append(wrap);
      ok.focus();
    });
  }

  // ---------- 骨組み ----------
  function shell() {
    const reload = el('button', { className: 'icon-btn', id: 'reload', type: 'button', 'aria-label': '最新の回答を読み込む', title: '最新にする' });
    reload.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>';
    reload.addEventListener('click', () => load(true));

    const tabs = el('nav', { className: 'tabs', role: 'tablist', 'aria-label': '画面の切り替え' },
      TABS.map((t) => {
        const b = el('button', { type: 'button', role: 'tab', id: 'tab-' + t.key, 'aria-selected': String(t.key === current), 'aria-controls': 'view-' + t.key },
          [el('span', { className: 'em', 'aria-hidden': 'true', textContent: t.em }), el('span', { textContent: t.label }), el('span', { className: 'badge', id: 'badge-' + t.key, hidden: true })]);
        b.addEventListener('click', () => show(t.key));
        return b;
      }));

    const app = $('app');
    app.replaceChildren(
      el('header', { className: 'top' }, [mascot('happy', 'mascot'), el('div', { className: 'ttl' }, [el('h1', { textContent: '飲み会 管理' }), el('div', { className: 'ev', id: 'evName', textContent: '' })]), reload]),
      tabs,
      el('main', {}, TABS.map((t) => el('section', { className: 'view', id: 'view-' + t.key, role: 'tabpanel', 'aria-labelledby': 'tab-' + t.key }))),
      el('div', { className: 'loading', id: 'loading' }, [el('div', { className: 'box' }, [el('div', { className: 'glass' }), el('div', { textContent: '回答を集計中…' })])]),
    );
    app.querySelector('.top .mascot').addEventListener('click', (e) => { if (window.Nomy) Nomy.play(e.currentTarget.querySelector('svg'), 'wiggle'); });
  }

  function show(key) {
    const order = TABS.map((t) => t.key);
    const dir = order.indexOf(key) < order.indexOf(current) ? 'left' : '';
    current = key;
    TABS.forEach((t) => {
      $('tab-' + t.key).setAttribute('aria-selected', String(t.key === key));
      const v = $('view-' + t.key);
      v.classList.remove('on', 'left');
      if (t.key === key) { void v.offsetWidth; v.classList.add('on'); if (dir) v.classList.add(dir); }
    });
    growBars($('view-' + key));
    window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
  }

  // ---------- データ ----------
  function load(manual) {
    const r = run();
    if (!r) { $('loading').querySelector('.box').lastChild.textContent = 'このページは管理用のウェブアプリから開いてください。'; return; }
    const btn = $('reload');
    btn.classList.add('spin');
    const before = data ? data.answers.length : null;
    r.withSuccessHandler((d) => {
      data = d;
      btn.classList.remove('spin');
      $('loading').classList.add('hide');
      renderAll();
      if (manual) {
        const diff = before == null ? 0 : d.answers.length - before;
        toast(diff > 0 ? `新しい回答が ${diff} 件あったよ！` : '最新の状態です');
        if (diff > 0) confetti();
      }
    }).withFailureHandler((e) => {
      btn.classList.remove('spin');
      $('loading').classList.add('hide');
      toast('読み込めませんでした：' + e.message, { err: true });
    }).getDashboard();
  }

  function renderAll() {
    const ev = data.event;
    $('evName').textContent = ev.name + '｜' + ev.date;
    renderSummary();
    renderFriends();
    renderReserve();
    renderList();
    renderDreams();
    renderEvent();
    renderNotice();
    loadMembers();
    show(current);
  }

  // ---------- お知らせ ----------
  const TARGETS = [
    { key: 'all', label: '友だち全員', em: '📢', hint: '公式LINEの友だち全員（ブロックしている人を除く）' },
    { key: 'answered', label: 'アンケートに答えた人', em: '📝' },
    { key: 'attending', label: '参加する人', em: '🙋' },
    { key: 'one', label: '1人だけ', em: '👤', hint: 'テスト送信にも使えます（自分の名前を選ぶ）' },
  ];
  let noticeTarget = 'attending';

  function remindTemplate() {
    const ev = data.event;
    const lines = ['🍻 いよいよ今日は ' + ev.name + '！', '', '📅 ' + ev.date, '📍 ' + ev.place + (ev.address ? '（' + ev.address + '）' : '')];
    if (ev.notes) lines.push('', ev.notes);
    lines.push('', '会場で会えるのを楽しみにしています！', SITE);
    return lines.join('\n');
  }

  function eventTemplate() {
    const ev = data.event;
    const lines = ['📣 ' + ev.name + ' のお知らせ', '', '📅 日時：' + ev.date, '📍 場所：' + ev.place + (ev.address ? '（' + ev.address + '）' : ''), '💰 会費：' + ev.fee];
    if (ev.deadline) lines.push('⏰ 回答の締切：' + ev.deadline);
    lines.push('', '詳しくはこちら👇', SITE);
    return lines.join('\n');
  }

  function rankingTemplate() {
    const g = data.game || { catch: [], kanpai: [], teams: [] };
    const medal = ['🥇', '🥈', '🥉'];
    const list = (arr) => (arr.length ? arr.map((r, i) => medal[i] + ' ' + r.nickname + '　' + r.best + '点').join('\n') : 'まだ記録なし！今なら1位のチャンス✨');
    const lines = ['🏆 ノミィのゲームセンター 途中経過！', '', '🫧 泡キャッチ', list(g.catch), '', '🍻 ジャスト乾杯', list(g.kanpai)];
    if (g.teams && g.teams.length) {
      lines.push('', '🏁 チーム対抗戦（優勝チームは当日の乾杯の音頭！）');
      g.teams.forEach((t, i) => lines.push((i + 1) + '位 ' + t.em + t.name + '　' + t.score + '点'));
    }
    lines.push('', '開催日まで何回でも挑戦できるよ👇', 'https://liff.line.me/2012697224-lfwPcqYm/game.html');
    return lines.join('\n');
  }

  function flush() {
    return fetch(MAIN, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ type: 'flush' }) })
      .then((r) => r.json()).catch(() => ({ ok: false }));
  }

  function renderNotice() {
    const A = data.answers;
    const counts = { all: null, answered: A.length, attending: A.filter((a) => a.attend === '参加').length, one: 1 };
    const view = $('view-notice');

    // 送る人（1人だけ）：名前のチップから選ぶ
    const pick = el('div', { className: 'pick', role: 'radiogroup', 'aria-label': '送る人' });
    pick.value = '';
    pick.label = '';
    A.forEach((a) => {
      const b = el('button', { type: 'button', className: 'pick-chip', role: 'radio', 'aria-checked': 'false', textContent: a.nickname + (a.attend === '参加' ? '' : '（不参加）') });
      b.addEventListener('click', () => {
        pick.querySelectorAll('.pick-chip').forEach((x) => x.setAttribute('aria-checked', 'false'));
        b.setAttribute('aria-checked', 'true');
        pick.value = String(a.row); pick.label = a.nickname;
      });
      pick.append(b);
    });
    if (!A.length) pick.append(el('p', { className: 'empty', textContent: 'まだ回答した人がいません。' }));
    const targets = el('div', { className: 'targets', role: 'radiogroup', 'aria-label': '宛先' }, TARGETS.map((t) => {
      const id = 'tg-' + t.key;
      const input = el('input', { type: 'radio', name: 'target', id, value: t.key, checked: t.key === noticeTarget });
      input.addEventListener('change', () => { noticeTarget = t.key; pick.hidden = t.key !== 'one'; updateCount(); });
      return el('div', {}, [input, el('label', { htmlFor: id }, [
        el('span', { className: 'em', 'aria-hidden': 'true', textContent: t.em }),
        el('span', { className: 'tl' }, [el('b', { textContent: t.label }), el('small', { textContent: counts[t.key] == null ? (t.hint || '') : counts[t.key] + '人' + (t.hint ? '・' + t.hint : '') })]),
      ])]);
    }));
    pick.hidden = noticeTarget !== 'one';

    const text = el('textarea', { maxLength: 2000, placeholder: '例：日程が決まりました！12/20(土) 19:00〜 渋谷で開催します🍻', 'aria-label': '本文' });
    const count = el('div', { className: 'count' });
    const bubble = el('div', { className: 'bubble' });
    const prev = el('div', { className: 'preview', 'aria-label': 'LINEでの見え方' }, [
      el('div', { className: 'phone-top', textContent: 'Phoenix' }),
      el('div', { className: 'chat' }, [mascot('happy', 'avatar'), bubble]),
    ]);
    const upd = () => {
      count.textContent = text.value.length + ' / 2000';
      bubble.textContent = text.value || 'ここにメッセージが表示されます';
      bubble.classList.toggle('placeholder', !text.value);
      bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    };
    text.addEventListener('input', upd);
    const tpl = el('button', { type: 'button', className: 'chip-btn', textContent: '📅 イベント情報を入れる' });
    tpl.addEventListener('click', () => { text.value = eventTemplate(); upd(); text.focus(); });
    const url = el('button', { type: 'button', className: 'chip-btn', textContent: '🔗 イベントサイトのURL' });
    url.addEventListener('click', () => { text.value = (text.value ? text.value.replace(/\s*$/, '') + '\n\n' : '') + SITE; upd(); });
    const remind = el('button', { type: 'button', className: 'chip-btn', textContent: '🔔 当日リマインド' });
    remind.addEventListener('click', () => { text.value = remindTemplate(); upd(); text.focus(); });
    const game = el('button', { type: 'button', className: 'chip-btn', textContent: '🎮 ゲームのお誘い' });
    game.addEventListener('click', () => { text.value = '🎮 開催までの待ち時間に「ノミィのゲームセンター」で遊ぼう！\n🫧泡キャッチ・🍻ジャスト乾杯・🔮毎日おみくじ・🏁チーム対抗戦\n\nhttps://liff.line.me/2012697224-lfwPcqYm/game.html'; upd(); text.focus(); });
    const rank = el('button', { type: 'button', className: 'chip-btn', textContent: '🏆 ランキング' });
    rank.addEventListener('click', () => { text.value = rankingTemplate(); upd(); text.focus(); });

    // いつ送るか：今すぐ／日時を指定して予約
    const whenNow = el('input', { type: 'radio', name: 'when', id: 'when-now', checked: true });
    const whenLater = el('input', { type: 'radio', name: 'when', id: 'when-later' });
    const at = el('input', { type: 'datetime-local', 'aria-label': '予約日時', className: 'at', disabled: true });
    const syncWhen = () => {
      at.disabled = !whenLater.checked;
      send.textContent = whenLater.checked ? '予約する' : '送信する';
      if (whenLater.checked && !at.value) {
        // 初期値：開催日の朝9時（なければ明日の9時）
        const d = /^\d{4}-\d{2}-\d{2}$/.test(data.event.eventDate || '') ? data.event.eventDate : new Date(Date.now() + 33 * 3600 * 1000).toISOString().slice(0, 10);
        at.value = d + 'T09:00';
      }
    };
    whenNow.addEventListener('change', syncWhen);
    whenLater.addEventListener('change', syncWhen);
    const when = el('div', { className: 'when' }, [
      el('div', { className: 'when-opts' }, [whenNow, el('label', { htmlFor: 'when-now', textContent: '⚡ 今すぐ送る' }), whenLater, el('label', { htmlFor: 'when-later', textContent: '⏰ 日時を指定して予約' })]),
      at,
    ]);

    const quota = el('p', { className: 'note quota' });
    function updateCount() {
      const n = counts[noticeTarget];
      quota.textContent = noticeTarget === 'all'
        ? '友だち全員に送ります。無料プランは月200通まで（1人に1通で1通と数えます）。'
        : (n + '人に送ります（' + n + '通）。無料プランは月200通までです。');
    }
    updateCount();

    const send = el('button', { type: 'button', className: 'primary send', textContent: '送信する' });
    send.addEventListener('click', () => {
      const body = text.value.trim();
      if (!body) { toast('本文を入力してください', { err: true }); text.focus(); return; }
      if (noticeTarget === 'one' && !pick.value) { toast('送る人を選んでください', { err: true }); return; }
      const t = TARGETS.find((x) => x.key === noticeTarget);
      const who = noticeTarget === 'one' ? pick.label + ' さん' : t.label + (counts[noticeTarget] == null ? '' : '（' + counts[noticeTarget] + '人）');
      if (whenLater.checked) {
        if (!at.value) { toast('予約する日時を選んでください', { err: true }); return; }
        const label = at.value.replace('T', ' ').replace(/^(\d{4})-(\d{2})-(\d{2})/, '$2/$3');
        ask(label + ' に予約します', who + ' に送ります。送信前なら履歴から取り消せます。', '予約する').then((yes) => { if (yes) doSend(at.value); });
        return;
      }
      ask(who + ' に送ります', '送ったあとは取り消せません。よろしいですか？', '送信する').then((yes) => { if (yes) doSend(''); });
    });
    function doSend(scheduledAt) {
      const body = text.value.trim();
      send.disabled = true; send.classList.add('flying'); send.textContent = '送信中…';
      run().withSuccessHandler((list) => {
        renderHistory(list);
        if (scheduledAt) {
          send.disabled = false; send.classList.remove('flying'); syncWhen();
          text.value = ''; upd();
          toast('予約しました！⏰'); confetti();
          return;
        }
        flush().then(() => {
          send.disabled = false; send.classList.remove('flying'); send.textContent = '送信する';
          text.value = ''; upd();
          toast('送信しました！📣'); confetti();
          loadHistory();
        });
      }).withFailureHandler((err) => {
        send.disabled = false; send.classList.remove('flying'); send.textContent = '送信する';
        toast(err.message, { err: true });
      }).enqueueAnnouncement({ target: noticeTarget, row: pick.value, text: body, scheduledAt: scheduledAt || '' });
    }

    view.replaceChildren(
      el('div', { className: 'notice-grid' }, [
        el('div', {}, [
          stagger(el('div', { className: 'panel' }, [el('h2', { textContent: '① 宛先' }), targets, pick]), 0),
          stagger(el('div', { className: 'panel wide' }, [el('h2', { textContent: '② メッセージ' }), el('div', { className: 'chips-row' }, [tpl, remind, game, rank, url]), text, count, quota, when, el('div', { className: 'savebar' }, [send])]), 1),
        ]),
        stagger(el('div', { className: 'panel prevpanel' }, [el('h2', { textContent: '📱 LINEでの見え方' }), prev]), 2),
      ]),
      stagger(el('div', { className: 'panel wide' }, [el('h2', { textContent: '🕒 送信履歴' }), el('div', { id: 'history' }, [el('p', { className: 'empty', textContent: '読み込み中…' })])]), 3),
    );
    upd();
    loadHistory();
  }

  function loadHistory() {
    const r = run();
    if (r) r.withSuccessHandler(renderHistory).withFailureHandler(() => {}).getAnnouncements();
  }

  function renderHistory(list) {
    const box = $('history');
    if (!box) return;
    if (!list.length) { box.replaceChildren(el('p', { className: 'empty', textContent: 'まだお知らせは送っていません。' })); return; }
    const cls = { '送信済み': 'yes', 'エラー': 'err', '送信待ち': 'wait', '送信中': 'wait', '予約': 'resv', '取り消し': 'no' };
    box.replaceChildren(el('ul', { className: 'history' }, list.map((n, i) => {
      const head = el('div', { className: 'h-head' }, [
        el('span', { className: 'pill ' + (cls[n.status] || 'no'), textContent: n.status }),
        el('b', { textContent: n.targetLabel }),
        el('small', { textContent: (n.sentAt || n.at) + (n.count ? '・' + n.count + (n.count === '全員' ? '' : '人') : '') + '・' + n.by }),
      ]);
      const kids = [head];
      if (n.status === '予約' && n.scheduledAt) kids.push(el('p', { className: 'h-when', textContent: '⏰ ' + n.scheduledAt.replace('T', ' ') + ' に送信予定' }));
      kids.push(el('p', { className: 'h-text', textContent: n.text }));
      if (n.error) kids.push(el('p', { className: 'h-err', textContent: '⚠️ ' + n.error }));
      const acts = [];
      if (n.status === '送信待ち') {
        const b = el('button', { type: 'button', className: 'ghost-btn', textContent: '今すぐ送る' });
        b.addEventListener('click', () => { b.disabled = true; flush().then(loadHistory); });
        acts.push(b);
      }
      if (n.status === '予約' || n.status === '送信待ち') {
        const c = el('button', { type: 'button', className: 'ghost-btn', textContent: '取り消す' });
        c.addEventListener('click', () => ask('このお知らせを取り消しますか？', '取り消したお知らせは送られません。', '取り消す').then((yes) => {
          if (!yes) return;
          c.disabled = true;
          run().withSuccessHandler((list) => { renderHistory(list); toast('取り消しました'); })
            .withFailureHandler((e) => { c.disabled = false; toast(e.message, { err: true }); }).cancelAnnouncement(n.id);
        }));
        acts.push(c);
      }
      if (acts.length) kids.push(el('div', { className: 'h-acts' }, acts));
      return stagger(el('li', {}, kids), i);
    })));
  }

  // ---------- メンバー ----------
  function loadMembers() {
    const r = run();
    if (!r) return;
    r.withSuccessHandler(renderMembers).withFailureHandler((e) => {
      $('view-members').replaceChildren(el('p', { className: 'empty', textContent: '読み込めませんでした：' + e.message }));
    }).getMembers();
  }

  function renderMembers(m) {
    const list = el('ul', { className: 'members' }, m.members.map((mail, i) => {
      const isMe = mail === m.me;
      const right = [];
      if (mail === m.owner) right.push(el('span', { className: 'tag gold', textContent: '主催者' }));
      if (isMe) right.push(el('span', { className: 'tag', textContent: 'あなた' }));
      if (m.isOwner && !isMe) {
        const del = el('button', { type: 'button', className: 'ghost-btn', textContent: '削除', 'aria-label': mail + ' を削除' });
        del.addEventListener('click', () => {
          ask(mail + ' を外しますか？', '管理者サイトのメンバーから外し、スプレッドシートの共有も解除します。', '外す').then((yes) => {
            if (!yes) return;
            del.disabled = true;
            run().withSuccessHandler((res) => { renderMembers(res); toast('メンバーから外しました'); })
              .withFailureHandler((e) => { del.disabled = false; toast(e.message, { err: true }); }).removeMember(mail);
          });
        });
        right.push(del);
      }
      return stagger(el('li', {}, [el('span', { className: 'avatar', 'aria-hidden': 'true', textContent: mail.slice(0, 1).toUpperCase() }), el('span', { className: 'mail', textContent: mail }), el('span', { className: 'right' }, right)]), i);
    }));

    const parts = [
      el('p', { className: 'note', textContent: 'ここに登録した人だけが、この管理者サイトを見られます。登録すると回答のスプレッドシートも「編集者」として共有され、回答の閲覧とイベント情報の編集ができるようになります。' }),
      el('div', { className: 'panel' }, [el('h2', { textContent: '👥 メンバー（' + m.members.length + '人）' }), list]),
    ];
    if (m.isOwner) {
      const input = el('input', { type: 'email', placeholder: '例：friend@gmail.com', 'aria-label': '追加するメールアドレス', autocomplete: 'off' });
      const btn = el('button', { type: 'submit', className: 'primary', textContent: '追加する' });
      const form = el('form', { className: 'addmember', noValidate: true }, [input, btn]);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = input.value.trim();
        if (!v) { input.focus(); return; }
        btn.disabled = true; btn.textContent = '追加中…';
        run().withSuccessHandler((res) => {
          renderMembers(res);
          toast(v + ' を追加しました！'); confetti();
        }).withFailureHandler((err) => {
          btn.disabled = false; btn.textContent = '追加する';
          toast(err.message, { err: true });
        }).addMember(v);
      });
      parts.push(el('div', { className: 'panel wide' }, [
        el('h2', { textContent: '➕ メンバーを追加' }), form,
        el('p', { className: 'note', style: 'margin:10px 0 0', textContent: '追加した人には、管理者サイトのURLを送ってください。最初に開いたときだけ、Googleの「許可」を押してもらう必要があります。' }),
      ]));
    } else {
      parts.push(el('p', { className: 'note', style: 'margin-top:12px', textContent: 'メンバーの追加・削除は主催者だけができます。' }));
    }
    parts.push(notifyPanel(m));
    $('view-members').replaceChildren(...parts);
  }

  // 予約の通知をLINEで受け取る（6桁の番号をPhoenixのトークに送ってもらう）
  function notifyPanel(m) {
    const count = el('p', { className: 'note', style: 'margin:0 0 10px' });
    const setCount = (n) => { count.textContent = n ? `いま ${n} 人がLINEで予約の通知を受け取っています。` : 'まだ誰も登録していません。'; };
    setCount((data && data.organizerCount) || 0);
    const out = el('div');
    const btn = el('button', { type: 'button', className: 'primary', textContent: '番号を発行する' });
    btn.addEventListener('click', () => {
      btn.disabled = true;
      run().withSuccessHandler((r) => {
        btn.disabled = false;
        const codeEl = el('div', { className: 'code-big', textContent: '通知登録 ' + r.code });
        out.replaceChildren(
          el('p', { className: 'note', style: 'margin:12px 0 6px', textContent: '公式LINE「Phoenix」のトークに、次の文字をそのまま送ってください（30分以内・1回だけ使えます）。' }),
          codeEl,
        );
        toast('番号を発行しました');
      }).withFailureHandler((e) => { btn.disabled = false; toast(e.message, { err: true }); }).issueOrganizerCode();
    });
    const kids = [el('h2', { textContent: '📲 予約の通知をLINEで受け取る' }), count, btn, out];
    if (m.isOwner) {
      const clear = el('button', { type: 'button', className: 'ghost-btn', style: 'margin-top:12px', textContent: '通知の受け取りを全員解除' });
      clear.addEventListener('click', () => ask('通知の受け取りを全員解除しますか？', '解除すると、予約が入ってもLINEには届きません（管理者サイトでは見られます）。', '解除する').then((yes) => {
        if (!yes) return;
        run().withSuccessHandler((r) => { setCount(r.count); toast('解除しました'); }).withFailureHandler((e) => toast(e.message, { err: true })).clearOrganizers();
      }));
      kids.push(el('div', {}, [clear]));
    }
    return el('div', { className: 'panel wide', style: 'margin-top:12px' }, kids);
  }

  // ---------- 予約 ----------
  let reserveFilter = 'wait';
  const R_FILTERS = [{ key: 'wait', label: '承認待ち' }, { key: 'ok', label: '確定' }, { key: 'all', label: 'すべて' }];
  function renderReserve() {
    const R = data.reservations || [];
    const wait = R.filter((r) => r.status === '申請中');
    const badge = $('badge-reserve');
    if (badge) { badge.textContent = wait.length; badge.hidden = !wait.length; }
    const tile = (n, label, em, cls) => { const num = el('div', { className: 'n', textContent: '0' }); countUp(num, n); return el('div', { className: 'tile ' + (cls || '') }, [el('span', { className: 'em', 'aria-hidden': 'true', textContent: em }), num, el('div', { className: 'l', textContent: label })]); };
    const tiles = el('div', { className: 'tiles', style: 'margin-bottom:14px' }, [
      tile(wait.length, '承認待ち', '⏳', 'main'),
      tile(R.filter((r) => r.status === '承認').length, '予約確定', '🎉'),
      tile(R.filter((r) => r.status === '見送り').length, '見送り', '🙇'),
      tile(R.filter((r) => r.status === 'キャンセル').length, 'キャンセル', '↩️'),
    ].map(stagger));
    const btns = R_FILTERS.map((x) => el('button', { type: 'button', textContent: x.label, 'aria-pressed': String(reserveFilter === x.key) }));
    const body = el('div', { className: 'friends' });
    const PILL = { '申請中': 'wait', '承認': 'yes', '見送り': 'no', 'キャンセル': 'no' };
    const LABEL = { '申請中': '承認待ち', '承認': '確定', '見送り': '見送り', 'キャンセル': 'キャンセル' };
    const draw = () => {
      const list = R.filter((r) => reserveFilter === 'all' || (reserveFilter === 'wait' ? r.status === '申請中' : r.status === '承認'));
      body.replaceChildren(...(list.length ? list.map((r, i) => {
        const acts = [];
        if (r.status === '申請中' || r.status === '承認' || r.status === '見送り') {
          const mk = (label, decision, cls) => {
            const b = el('button', { type: 'button', className: cls, textContent: label });
            b.addEventListener('click', () => decide(r, decision, b));
            return b;
          };
          if (r.status !== '承認') acts.push(mk('承認する', 'approve', 'primary'));
          if (r.status !== '見送り') acts.push(mk('見送る', 'decline', 'ghost-btn'));
        }
        const sub = [r.lineName ? 'LINE名：' + r.lineName : '', '申請 ' + r.at.slice(0, 16), r.notice === '送信済み' ? '📨 本人に通知済み' : r.notice === '送信待ち' ? '📨 通知を送信中…' : r.notice === 'エラー' ? '⚠️ 通知に失敗' : ''].filter(Boolean).join('　');
        return stagger(el('div', { className: 'rcard' }, [
          el('div', { className: 'rhead' }, [el('b', { textContent: r.nickname || '（名前なし）' }), el('span', { className: 'pill ' + (PILL[r.status] || 'no'), textContent: LABEL[r.status] || r.status })]),
          el('div', { className: 'meta', textContent: sub }),
          r.comment ? el('div', { className: 'rcomment', textContent: '💬 ' + r.comment }) : null,
          acts.length ? el('div', { className: 'racts' }, acts) : null,
        ]), i);
      }) : [el('p', { className: 'empty', textContent: reserveFilter === 'wait' ? '承認待ちの予約はありません。' : '当てはまる予約はありません。' })]));
    };
    btns.forEach((b, i) => b.addEventListener('click', () => {
      reserveFilter = R_FILTERS[i].key;
      btns.forEach((x, j) => x.setAttribute('aria-pressed', String(i === j)));
      draw();
    }));
    const notes = [el('p', { className: 'note', textContent: '参加者がLINEで「予約する→確定」を押すとここに届きます。承認すると、本人のLINEに「予約が確定しました」と自動で届きます。' })];
    if (!data.organizerCount) notes.push(el('p', { className: 'note', style: 'color:var(--red)', textContent: '📲 予約が入ったときにLINEで知らせてほしい場合は「メンバー」タブで登録してください。' }));
    $('view-reserve').replaceChildren(tiles, ...notes, el('div', { className: 'toolbar' }, [el('div', { className: 'toggle', role: 'group', 'aria-label': '表示する予約' }, btns)]), body);
    draw();
  }

  function decide(r, decision, btn) {
    const yes = decision === 'approve';
    ask(yes ? r.nickname + ' さんの予約を承認しますか？' : r.nickname + ' さんの予約を見送りますか？',
      yes ? '本人のLINEに「予約が確定しました」と日時・場所つきで届きます。' : '本人のLINEに、今回はご案内が難しい旨のメッセージが届きます。',
      yes ? '承認する' : '見送る').then((ok) => {
      if (!ok) return;
      btn.disabled = true;
      run().withSuccessHandler((list) => {
        data.reservations = list;
        renderReserve();
        toast(yes ? '承認しました！本人に通知しています…' : '見送りにしました');
        if (yes) confetti();
        flush().then(() => run().withSuccessHandler((d) => { data = d; renderReserve(); }).getDashboard());
      }).withFailureHandler((e) => { btn.disabled = false; toast(e.message, { err: true }); }).decideReservation(r.row, decision);
    });
  }

  function bars(kinds, count) {
    const max = Math.max(1, ...kinds.map(count));
    return el('div', { className: 'bars' }, kinds.map((k) => {
      const n = count(k);
      const fill = el('div', { className: 'fill', 'data-w': (n / max * 100) + '%' });
      return el('div', { className: 'bar', title: (k || '未回答') + '：' + n + '人' },
        [el('span', { textContent: k || '未回答' }), el('div', { className: 'track' }, [fill]), el('span', { className: 'v', textContent: n })]);
    }));
  }

  function ageGroup(age) {
    const n = Number(age);
    if (!age || !(n >= 20)) return '';
    return n < 30 ? '20代' : n < 40 ? '30代' : n < 50 ? '40代' : '50代以上';
  }

  function renderSummary() {
    const A = data.answers;
    const going = A.filter((a) => a.attend === '参加');
    const job = A.filter((a) => (a.purpose || '').includes('仕事の話を聞きたい'));
    const last = A.map((a) => a.at).sort().pop();
    const tile = (n, label, em, cls) => { const num = el('div', { className: 'n', textContent: '0' }); countUp(num, n); return el('div', { className: 'tile ' + (cls || '') }, [el('span', { className: 'em', 'aria-hidden': 'true', textContent: em }), num, el('div', { className: 'l', textContent: label })]); };
    const tiles = el('div', { className: 'tiles' }, [
      tile(going.length, '参加', '🙋', 'main'),
      tile(A.filter((a) => a.attend === '不参加').length, '不参加', '🙇'),
      tile(A.length, '回答数', '📝'),
      tile((data.friends || []).filter((f) => f.status !== 'ブロック').length, '友だち', '👋'),
      tile(job.length, '仕事の話を聞きたい', '🤝'),
      el('div', { className: 'tile small' }, [el('span', { className: 'em', 'aria-hidden': 'true', textContent: '🕒' }), el('div', { className: 'n', textContent: last || '—' }), el('div', { className: 'l', textContent: '最新の回答' })]),
    ].map(stagger));

    const ng = going.filter((a) => a.ng);
    const con = A.filter((a) => a.connect);
    const panel = (title, body, cls) => el('div', { className: 'panel ' + (cls || '') }, [el('h2', { textContent: title }), body]);
    const emptyOr = (cond, node, text) => (cond ? node : el('p', { className: 'empty', textContent: text }));

    const grid = el('div', { className: 'grid2' }, [
      panel('🍺 お酒（参加する人）', emptyOr(going.length, bars(['飲む', '少し', '飲まない', ''], (k) => going.filter((a) => a.drink === k).length), 'まだ参加の回答がありません。')),
      panel('⚠️ 食べられないもの・アレルギー', emptyOr(ng.length, el('ul', { className: 'chips red' }, ng.map((a, i) => stagger(el('li', {}, [el('b', { textContent: a.nickname }), '：' + a.ng]), i))), '今のところ申告はありません。')),
      panel('🎯 参加の目的（複数回答）', emptyOr(A.length, bars(['交流したい', '仕事の話を聞きたい', '夢・目標を話したい', 'その他'], (k) => A.filter((a) => (a.purpose || '').split('、').includes(k)).length), 'まだ回答がありません。')),
      panel('🎂 年代', emptyOr(A.length, bars(['20代', '30代', '40代', '50代以上', ''], (k) => A.filter((a) => ageGroup(a.age) === k).length), 'まだ回答がありません。')),
      panel('💼 職業', emptyOr(A.length, bars(['会社員', '経営者・役員', '個人事業主・フリーランス', '公務員', '学生', 'パート・アルバイト', 'その他', ''], (k) => A.filter((a) => (a.job || '') === k).length), 'まだ回答がありません。')),
      panel('📣 知ったきっかけ', emptyOr(A.length, bars(['知り合いの紹介', 'SNS', 'その他', ''], (k) => A.filter((a) => (a.referral || '') === k).length), 'まだ回答がありません。')),
    ].map(stagger));

    const conPanel = panel('🤝 仕事でつながりたい人', emptyOr(con.length, el('ul', { className: 'chips gold' }, con.map((a, i) => stagger(el('li', {}, [
      el('b', { textContent: a.nickname }),
      (a.purpose || '').includes('仕事の話を聞きたい') ? el('span', { className: 'tag', textContent: '仕事の話を聞きたい' }) : null,
      el('div', { textContent: a.connect }),
    ]), i))), 'まだ記入した人はいません。'), 'wide');

    $('view-summary').replaceChildren(tiles, grid, stagger(conPanel, 5));
  }

  function filtered(q) {
    q = (q || '').trim().toLowerCase();
    return data.answers.filter((a) => (!onlyAttend || a.attend === '参加') && (!q || Object.values(a).join(' ').toLowerCase().includes(q)));
  }

  const DETAIL = [
    ['年齢', (a) => (a.age ? a.age + '歳' : '')],
    ['職業', (a) => (a.job || '') + (a.jobDetail ? '（' + a.jobDetail + '）' : '')], ['LINE名', 'lineName'], ['回答日時', 'at'], ['知ったきっかけ', (a) => (a.referral || '') + (a.referrer ? '（' + a.referrer + '）' : '')],
    ['参加の目的', 'purpose'], ['仕事でつながりたい人', 'connect'], ['お酒', 'drink'], ['NG・アレルギー', 'ng'],
    ['夢・やりたいこと', 'dream'], ['目標', 'goal'], ['ひとこと', 'comment'],
  ];
  const val = (a, f) => (typeof f === 'function' ? f(a) : a[f]) || '';

  function renderList() {
    const view = $('view-list');
    const search = el('input', { type: 'search', placeholder: '名前やコメントで検索', 'aria-label': '回答を検索' });
    const all = el('button', { type: 'button', textContent: '全員', 'aria-pressed': String(!onlyAttend) });
    const yes = el('button', { type: 'button', textContent: '参加する人', 'aria-pressed': String(onlyAttend) });
    const body = el('div');
    const count = el('p', { className: 'note', style: 'margin-top:10px' });
    const draw = () => {
      const list = filtered(search.value);
      const table = el('div', { className: 'tablewrap' }, [el('table', {}, [
        el('thead', {}, [el('tr', {}, ['回答日時', 'ニックネーム', 'LINE名', '参加', '年齢', '職業', '知ったきっかけ', '参加の目的', '仕事でつながりたい人', 'お酒', 'NG・アレルギー', '夢・やりたいこと', '目標', 'ひとこと'].map((h) => el('th', { textContent: h })))]),
        el('tbody', {}, list.map((a, i) => stagger(el('tr', {}, [
          el('td', { textContent: a.at }), el('td', { textContent: a.nickname }), el('td', { textContent: a.lineName }),
          el('td', {}, [el('span', { className: 'pill ' + (a.attend === '参加' ? 'yes' : 'no'), textContent: a.attend })]),
          el('td', { textContent: a.age ? a.age + '歳' : '—' }),
          el('td', { className: 'long', textContent: val(a, DETAIL[1][1]) || '—' }),
          el('td', { textContent: val(a, DETAIL[4][1]) || '—' }), el('td', { className: 'long', textContent: a.purpose }),
          el('td', { className: 'long', textContent: a.connect }), el('td', { textContent: a.drink || '—' }),
          el('td', { className: 'long', textContent: a.ng }), el('td', { className: 'long', textContent: a.dream }),
          el('td', { className: 'long', textContent: a.goal }), el('td', { className: 'long', textContent: a.comment }),
        ]), i))),
      ])]);
      const cards = el('div', { className: 'cards' }, list.map((a, i) => {
        const card = el('article', { className: 'acard' });
        const head = el('button', { type: 'button', 'aria-expanded': 'false' }, [
          el('span', { className: 'who', textContent: a.nickname }),
          el('span', {}, [el('span', { className: 'pill ' + (a.attend === '参加' ? 'yes' : 'no'), textContent: a.attend }), el('span', { className: 'chev', 'aria-hidden': 'true', textContent: ' ▾' })]),
          el('span', { className: 'meta', textContent: [a.age ? a.age + '歳' : '', a.job ? '💼 ' + a.job : '', a.purpose, a.connect ? '🤝 ' + a.connect : ''].filter(Boolean).join('　') || a.at }),
        ]);
        head.addEventListener('click', () => { const open = card.classList.toggle('open'); head.setAttribute('aria-expanded', String(open)); });
        const dl = el('dl', {}, DETAIL.flatMap(([label, f]) => [el('dt', { textContent: label }), el('dd', { textContent: val(a, f) || '—' })]));
        card.append(head, el('div', { className: 'more' }, [el('div', {}, [dl])]));
        return stagger(card, i);
      }));
      body.replaceChildren(list.length ? table : el('p', { className: 'empty', textContent: '当てはまる回答はありません。' }), list.length ? cards : '');
      count.textContent = list.length + '件を表示中（全' + data.answers.length + '件）';
    };
    search.addEventListener('input', draw);
    [all, yes].forEach((b) => b.addEventListener('click', () => {
      onlyAttend = b === yes; all.setAttribute('aria-pressed', String(!onlyAttend)); yes.setAttribute('aria-pressed', String(onlyAttend)); draw();
    }));
    view.replaceChildren(el('div', { className: 'toolbar' }, [el('div', { className: 'search' }, [search]), el('div', { className: 'toggle', role: 'group', 'aria-label': '表示する人' }, [all, yes])]), body, count);
    draw();
  }

  // ---------- 友だち ----------
  const FRIEND_FILTERS = [
    { key: 'all', label: '全員' },
    { key: 'todo', label: '未回答' },
    { key: 'done', label: '回答済み' },
    { key: 'blocked', label: 'ブロック' },
  ];

  function syncFriendsOnce() {
    if (friendSync) return;
    friendSync = { pending: true };
    fetch(MAIN, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ type: 'syncFriends' }) })
      .then((r) => r.json()).catch(() => ({ ok: false }))
      .then((res) => {
        friendSync = res || { ok: false };
        if (res && res.added > 0) { toast(`友だちを ${res.added} 人取り込みました`); load(false); } else if (data) renderFriends();
      });
  }

  function avatar(f) {
    if (f.icon) {
      const img = el('img', { className: 'av', src: f.icon + '/small', alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' });
      img.addEventListener('error', () => img.replaceWith(el('span', { className: 'av', 'aria-hidden': 'true', textContent: (f.name || '?').slice(0, 1) })), { once: true });
      return img;
    }
    return el('span', { className: 'av', 'aria-hidden': 'true', textContent: (f.name || '?').slice(0, 1) });
  }

  function renderFriends() {
    const F = data.friends || [];
    const active = F.filter((f) => f.status !== 'ブロック');
    const tile = (n, label, em, cls) => { const num = el('div', { className: 'n', textContent: '0' }); countUp(num, n); return el('div', { className: 'tile ' + (cls || '') }, [el('span', { className: 'em', 'aria-hidden': 'true', textContent: em }), num, el('div', { className: 'l', textContent: label })]); };
    const tiles = el('div', { className: 'tiles', style: 'margin-bottom:14px' }, [
      tile(active.length, '友だち', '👋', 'main'),
      tile(active.filter((f) => f.answered).length, '回答済み', '📝'),
      tile(active.filter((f) => !f.answered).length, '未回答', '⏳'),
      tile(F.length - active.length, 'ブロック', '🚫'),
    ].map(stagger));

    const search = el('input', { type: 'search', placeholder: 'LINE名・ニックネームで検索', 'aria-label': '友だちを検索' });
    const btns = FRIEND_FILTERS.map((x) => el('button', { type: 'button', textContent: x.label, 'aria-pressed': String(friendFilter === x.key) }));
    const body = el('div', { className: 'friends' });
    const count = el('p', { className: 'note', style: 'margin-top:10px' });
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const list = F.filter((f) => {
        if (friendFilter === 'todo' && (f.answered || f.status === 'ブロック')) return false;
        if (friendFilter === 'done' && !f.answered) return false;
        if (friendFilter === 'blocked' && f.status !== 'ブロック') return false;
        return !q || ((f.name || '') + ' ' + (f.nickname || '')).toLowerCase().includes(q);
      });
      body.replaceChildren(...(list.length ? list.map((f, i) => {
        const badge = f.status === 'ブロック'
          ? el('span', { className: 'pill no', textContent: 'ブロック' })
          : f.answered ? el('span', { className: 'pill yes', textContent: '回答済み' }) : el('span', { className: 'pill wait', textContent: '未回答' });
        const sub = [f.nickname ? '「' + f.nickname + '」' : '', f.attend ? (f.attend === '参加' ? '🙋 参加' : '🙇 不参加') : '', f.addedAt ? '追加 ' + f.addedAt.slice(0, 16) : ''].filter(Boolean).join('　');
        return stagger(el('div', { className: 'friend' + (f.status === 'ブロック' ? ' off' : '') }, [
          avatar(f),
          el('div', { className: 'fx' }, [el('div', { className: 'who', textContent: f.name || '（名前を取得できませんでした）' }), el('div', { className: 'meta', textContent: sub || '—' })]),
          badge,
        ]), i);
      }) : [el('p', { className: 'empty', textContent: '当てはまる人はいません。' })]));
      count.textContent = list.length + '人を表示中（全' + F.length + '人）';
    };
    search.addEventListener('input', draw);
    btns.forEach((b, i) => b.addEventListener('click', () => {
      friendFilter = FRIEND_FILTERS[i].key;
      btns.forEach((x, j) => x.setAttribute('aria-pressed', String(i === j)));
      draw();
    }));
    const notes = [el('p', { className: 'note', textContent: '公式LINEを友だち追加した人の一覧です。未回答の人には、お知らせタブの「友だち全員」でアンケートのお願いを送れます。' })];
    if (friendSync && friendSync.ok && friendSync.followersApi === false) {
      notes.push(el('p', { className: 'note', textContent: '※ 2026/11/19 より前に追加して、まだアンケートにもメッセージにも反応していない人は、何か操作してくれた時点でここに出てきます（LINEの仕様で、それ以前の友だちは一覧を取得できないため）。' }));
    }
    $('view-friends').replaceChildren(tiles, ...notes,
      el('div', { className: 'toolbar' }, [el('div', { className: 'search' }, [search]), el('div', { className: 'toggle', role: 'group', 'aria-label': '表示する人' }, btns)]),
      body, count);
    draw();
    syncFriendsOnce();
  }

  function renderDreams() {
    const list = data.answers.filter((a) => a.dream || a.goal || a.connect);
    $('view-dreams').replaceChildren(
      el('p', { className: 'note', textContent: '当日の話のネタにどうぞ。夢・目標・つながりたい人のどれかを書いてくれた人だけ表示しています。' }),
      list.length
        ? el('div', { className: 'dreams' }, list.map((a, i) => {
            const dl = el('dl');
            if (a.dream) dl.append(el('dt', { textContent: '🌟 夢・やりたいこと' }), el('dd', { textContent: a.dream }));
            if (a.goal) dl.append(el('dt', { textContent: '🎯 目標' }), el('dd', { textContent: a.goal }));
            if (a.connect) dl.append(el('dt', { textContent: '🤝 仕事でつながりたい人' }), el('dd', { textContent: a.connect }));
            return stagger(el('div', { className: 'dream' }, [el('div', { className: 'who', textContent: a.nickname + (a.attend === '参加' ? '' : '（不参加）') }), a.job ? el('div', { className: 'note', style: 'margin:-4px 0 6px', textContent: (a.age ? a.age + '歳・' : '') + '💼 ' + val(a, DETAIL[1][1]) }) : null, dl]), i);
          }))
        : el('p', { className: 'empty', textContent: 'まだ書いてくれた人はいません。' }));
  }

  function renderEvent() {
    const form = el('form', { className: 'ev', noValidate: true });
    data.fields.forEach((fd, i) => {
      const id = 'ev-' + fd.key;
      const input = LONG_KEYS.includes(fd.key)
        ? el('textarea', { id, name: fd.key, maxLength: fd.max })
        : el('input', { id, name: fd.key, type: fd.key === 'mapUrl' ? 'url' : fd.key === 'eventDate' ? 'date' : 'text', maxLength: fd.max });
      input.value = data.event[fd.key] || '';
      const count = el('div', { className: 'count', textContent: input.value.length + ' / ' + fd.max });
      input.addEventListener('input', () => { count.textContent = input.value.length + ' / ' + fd.max; });
      form.append(stagger(el('div', {}, [el('label', { htmlFor: id, textContent: fd.label }), input, count]), i));
    });
    const btn = el('button', { type: 'submit', className: 'primary', textContent: 'イベント情報を保存' });
    form.append(el('p', { className: 'note', textContent: '保存すると、イベントサイトとLINEにすぐ反映されます。' }),
      el('div', { className: 'savebar' }, [btn, el('a', { className: 'link', href: SITE, target: '_blank', rel: 'noopener', textContent: 'イベントサイトを開く' })]));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const payload = {};
      data.fields.forEach((fd) => { payload[fd.key] = form.elements[fd.key].value; });
      btn.disabled = true; btn.textContent = '保存中…';
      run().withSuccessHandler((ev) => {
        data.event = ev; $('evName').textContent = ev.name + '｜' + ev.date;
        btn.disabled = false; btn.textContent = 'イベント情報を保存';
        toast('保存しました！カンパーイ🍻'); confetti();
      }).withFailureHandler((err) => {
        btn.disabled = false; btn.textContent = 'イベント情報を保存';
        toast('保存できませんでした：' + err.message, { err: true });
      }).saveEvent(payload);
    });
    $('view-event').replaceChildren(form);
  }

  // ---------- はじめる ----------
  shell();
  load(false);
})();
