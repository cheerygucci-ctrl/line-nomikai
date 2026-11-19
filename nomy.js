/* 案内役キャラ「ノミィ」（オリジナル）。SVG を文字列で返す。
 * 表情は <svg data-face="normal|happy|sad|sparkle|wink|wow"> を切り替える。
 * 使い方: el.innerHTML = nomySVG({ id: 'nomy' });  setFace(el.querySelector('svg'), 'happy')
 */
(function (g) {
  function nomySVG(opts) {
    opts = opts || {};
    const id = opts.id || 'nomy';
    const beerA = opts.dark ? '#B4622A' : '#FFD45E';
    const beerB = opts.dark ? '#7A3A12' : '#F4A41F';
    return `
<svg class="nomy" data-face="${opts.face || 'normal'}" viewBox="0 0 200 210" role="img" aria-label="ノミィ" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${id}-beer" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${beerA}"/><stop offset="1" stop-color="${beerB}"/>
    </linearGradient>
  </defs>
  <g class="nomy-body">
    <path d="M150 92 h14 a22 22 0 0 1 22 22 v28 a22 22 0 0 1 -22 22 h-14" fill="none" stroke="#5A3410" stroke-width="9" stroke-linecap="round"/>
    <path d="M150 92 h14 a22 22 0 0 1 22 22 v28 a22 22 0 0 1 -22 22 h-14" fill="none" stroke="#FFE7A8" stroke-width="3" stroke-linecap="round" opacity=".7"/>
    <rect x="34" y="62" width="122" height="134" rx="26" fill="url(#${id}-beer)" stroke="#5A3410" stroke-width="6"/>
    <rect x="46" y="78" width="12" height="96" rx="6" fill="#fff" opacity=".45"/>
    <g class="nomy-fizz" fill="#FFF6D6" opacity=".9">
      <circle cx="128" cy="170" r="4"/><circle cx="138" cy="150" r="3"/><circle cx="122" cy="132" r="2.5"/><circle cx="70" cy="182" r="3"/>
    </g>
    <g class="nomy-foam">
      <path d="M30 70 c-8 -18 10 -34 26 -26 c4 -18 30 -22 40 -8 c10 -14 36 -10 40 8 c18 -6 32 12 22 28 c-6 10 -18 10 -24 6 c-8 10 -24 10 -30 0 c-8 8 -22 8 -28 -2 c-10 8 -26 6 -30 -4 c-6 4 -12 2 -16 -2z"
            fill="#fff" stroke="#5A3410" stroke-width="6" stroke-linejoin="round"/>
      <circle cx="62" cy="54" r="5" fill="#F3EEDD"/><circle cx="118" cy="48" r="4" fill="#F3EEDD"/>
    </g>
    <!-- ほっぺ -->
    <ellipse cx="66" cy="132" rx="11" ry="7" fill="#FF8A73" opacity=".75"/>
    <ellipse cx="126" cy="132" rx="11" ry="7" fill="#FF8A73" opacity=".75"/>
    <!-- 目 -->
    <g class="f f-normal f-wink-r"><ellipse class="eye" cx="76" cy="114" rx="6.5" ry="8.5" fill="#3B2108"/><circle cx="78" cy="111" r="2.4" fill="#fff"/></g>
    <g class="f f-normal f-wink"><ellipse class="eye" cx="116" cy="114" rx="6.5" ry="8.5" fill="#3B2108"/><circle cx="118" cy="111" r="2.4" fill="#fff"/></g>
    <g class="f f-wink-only"><path d="M108 116 q8 -8 16 0" fill="none" stroke="#3B2108" stroke-width="5" stroke-linecap="round"/></g>
    <g class="f f-happy" fill="none" stroke="#3B2108" stroke-width="5" stroke-linecap="round">
      <path d="M68 118 q8 -12 16 0"/><path d="M108 118 q8 -12 16 0"/>
    </g>
    <g class="f f-sad" fill="none" stroke="#3B2108" stroke-width="5" stroke-linecap="round">
      <path d="M68 110 q8 8 16 4"/><path d="M108 114 q8 4 16 -4"/>
      <path d="M126 122 q2 8 -2 10 q-4 -2 -2 -10z" fill="#7CC4F2" stroke="none"/>
    </g>
    <g class="f f-sparkle">
      <ellipse cx="76" cy="113" rx="9" ry="11" fill="#3B2108"/><ellipse cx="116" cy="113" rx="9" ry="11" fill="#3B2108"/>
      <path d="M79 105 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2z" fill="#fff"/><path d="M119 105 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2z" fill="#fff"/>
      <circle cx="72" cy="119" r="2" fill="#fff"/><circle cx="112" cy="119" r="2" fill="#fff"/>
    </g>
    <g class="f f-wow"><circle cx="76" cy="114" r="8" fill="#3B2108"/><circle cx="116" cy="114" r="8" fill="#3B2108"/><circle cx="78" cy="111" r="2.6" fill="#fff"/><circle cx="118" cy="111" r="2.6" fill="#fff"/></g>
    <!-- 口 -->
    <path class="f f-normal f-wink f-sparkle" d="M88 132 q8 8 16 0" fill="none" stroke="#3B2108" stroke-width="5" stroke-linecap="round"/>
    <path class="f f-happy" d="M84 128 h24 q0 16 -12 16 q-12 0 -12 -16z" fill="#7A2A12" stroke="#3B2108" stroke-width="4" stroke-linejoin="round"/>
    <path class="f f-sad" d="M88 138 q8 -7 16 0" fill="none" stroke="#3B2108" stroke-width="5" stroke-linecap="round"/>
    <ellipse class="f f-wow" cx="96" cy="136" rx="6" ry="8" fill="#7A2A12" stroke="#3B2108" stroke-width="4"/>
  </g>
</svg>`;
  }

  function setFace(svg, face) {
    if (svg) svg.setAttribute('data-face', face);
  }

  /** ページに1回だけ入れる、ノミィ用の CSS */
  const css = `
.nomy { display:block; width:100%; height:auto; overflow:visible; }
.nomy .f { display:none; }
.nomy[data-face="normal"] .f-normal,
.nomy[data-face="happy"] .f-happy,
.nomy[data-face="sad"] .f-sad,
.nomy[data-face="sparkle"] .f-sparkle,
.nomy[data-face="wow"] .f-wow,
.nomy[data-face="wink"] .f-wink-r,
.nomy[data-face="wink"] .f-wink-only,
.nomy[data-face="wink"] path.f-wink { display:inline; }
.nomy-foam { transform-box: fill-box; transform-origin: 50% 100%; animation: nomy-bob 2.6s ease-in-out infinite; }
.nomy .eye { transform-box: fill-box; transform-origin: center; animation: nomy-blink 4.8s infinite; }
.nomy-fizz circle { animation: nomy-fizz 2.4s linear infinite; }
.nomy-fizz circle:nth-child(2) { animation-delay: .8s; } .nomy-fizz circle:nth-child(3) { animation-delay: 1.5s; } .nomy-fizz circle:nth-child(4) { animation-delay: .4s; }
@keyframes nomy-bob { 0%,100% { transform: scale(1,1); } 50% { transform: scale(1.03,.96); } }
@keyframes nomy-blink { 0%,94%,100% { transform: scaleY(1); } 97% { transform: scaleY(.1); } }
@keyframes nomy-fizz { 0% { transform: translateY(0); opacity:0; } 20% { opacity:.9; } 100% { transform: translateY(-60px); opacity:0; } }
.nomy.jump { animation: nomy-jump .7s cubic-bezier(.3,1.6,.5,1); }
.nomy.droop { animation: nomy-droop .9s ease-in-out; }
.nomy.wiggle { animation: nomy-wiggle .5s ease-in-out; }
@keyframes nomy-jump { 0% { transform: translateY(0) scale(1); } 30% { transform: translateY(6px) scale(1.06,.92); } 60% { transform: translateY(-26px) scale(.96,1.05); } 100% { transform: translateY(0) scale(1); } }
@keyframes nomy-droop { 0%,100% { transform: rotate(0); } 40% { transform: rotate(-6deg) translateY(4px); } 70% { transform: rotate(3deg) translateY(4px); } }
@keyframes nomy-wiggle { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-7deg); } 75% { transform: rotate(7deg); } }
@media (prefers-reduced-motion: reduce) {
  .nomy-foam, .nomy .eye, .nomy-fizz circle, .nomy.jump, .nomy.droop, .nomy.wiggle { animation: none !important; }
}`;

  function installNomyCSS() {
    if (document.getElementById('nomy-css')) return;
    const s = document.createElement('style');
    s.id = 'nomy-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  /** 一度だけ動きを付ける（jump / droop / wiggle） */
  function play(svg, name) {
    if (!svg) return;
    svg.classList.remove('jump', 'droop', 'wiggle');
    void svg.getBoundingClientRect();
    svg.classList.add(name);
  }

  g.Nomy = { svg: nomySVG, setFace: setFace, installCSS: installNomyCSS, play: play };
})(window);
