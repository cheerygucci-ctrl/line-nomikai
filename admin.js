/* 飲み会LINE 管理者サイトの画面と動き。
 * admin/index.html（自分だけが開ける Apps Script のウェブアプリ）から読み込まれ、
 * google.script.run.getDashboard() / saveEvent() でデータをやりとりする。
 * データはここには含まれない。すべて textContent で表示する（HTMLとして解釈しない）。 */
(function () {
  'use strict';
  const SITE = 'https://cheerygucci-ctrl.github.io/line-nomikai/event.html';
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TABS = [
    { key: 'summary', label: '概要', em: '📊' },
    { key: 'list', label: '回答', em: '📝' },
    { key: 'dreams', label: '夢・つながり', em: '✨' },
    { key: 'event', label: 'イベント', em: '🍻' },
    { key: 'members', label: 'メンバー', em: '👥' },
  ];
  const LONG_KEYS = ['greeting', 'rules', 'schedule', 'notes'];
  let data = null;
  let current = 'summary';
  let onlyAttend = false;

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

  // ---------- 骨組み ----------
  function shell() {
    const reload = el('button', { className: 'icon-btn', id: 'reload', type: 'button', 'aria-label': '最新の回答を読み込む', title: '最新にする' });
    reload.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>';
    reload.addEventListener('click', () => load(true));

    const tabs = el('nav', { className: 'tabs', role: 'tablist', 'aria-label': '画面の切り替え' },
      TABS.map((t) => {
        const b = el('button', { type: 'button', role: 'tab', id: 'tab-' + t.key, 'aria-selected': String(t.key === current), 'aria-controls': 'view-' + t.key },
          [el('span', { className: 'em', 'aria-hidden': 'true', textContent: t.em }), el('span', { textContent: t.label })]);
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
    renderList();
    renderDreams();
    renderEvent();
    loadMembers();
    show(current);
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
          if (!confirm(mail + ' を管理者サイトのメンバーから外しますか？\nスプレッドシートの共有も解除されます。')) return;
          del.disabled = true;
          run().withSuccessHandler((res) => { renderMembers(res); toast('メンバーから外しました'); })
            .withFailureHandler((e) => { del.disabled = false; toast(e.message, { err: true }); }).removeMember(mail);
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
    $('view-members').replaceChildren(...parts);
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
        el('thead', {}, [el('tr', {}, ['回答日時', 'ニックネーム', 'LINE名', '参加', '職業', '知ったきっかけ', '参加の目的', '仕事でつながりたい人', 'お酒', 'NG・アレルギー', '夢・やりたいこと', '目標', 'ひとこと'].map((h) => el('th', { textContent: h })))]),
        el('tbody', {}, list.map((a, i) => stagger(el('tr', {}, [
          el('td', { textContent: a.at }), el('td', { textContent: a.nickname }), el('td', { textContent: a.lineName }),
          el('td', {}, [el('span', { className: 'pill ' + (a.attend === '参加' ? 'yes' : 'no'), textContent: a.attend })]),
          el('td', { className: 'long', textContent: val(a, DETAIL[0][1]) || '—' }),
          el('td', { textContent: val(a, DETAIL[3][1]) || '—' }), el('td', { className: 'long', textContent: a.purpose }),
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
          el('span', { className: 'meta', textContent: [a.job ? '💼 ' + a.job : '', a.purpose, a.connect ? '🤝 ' + a.connect : ''].filter(Boolean).join('　') || a.at }),
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
            return stagger(el('div', { className: 'dream' }, [el('div', { className: 'who', textContent: a.nickname + (a.attend === '参加' ? '' : '（不参加）') }), a.job ? el('div', { className: 'note', style: 'margin:-4px 0 6px', textContent: '💼 ' + val(a, DETAIL[0][1]) }) : null, dl]), i);
          }))
        : el('p', { className: 'empty', textContent: 'まだ書いてくれた人はいません。' }));
  }

  function renderEvent() {
    const form = el('form', { className: 'ev', noValidate: true });
    data.fields.forEach((fd, i) => {
      const id = 'ev-' + fd.key;
      const input = LONG_KEYS.includes(fd.key)
        ? el('textarea', { id, name: fd.key, maxLength: fd.max })
        : el('input', { id, name: fd.key, type: fd.key === 'mapUrl' ? 'url' : 'text', maxLength: fd.max });
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
