import { demoStore } from './store-demo.js';
import { makeSupabaseStore } from './store-supabase.js';

{
const CFG = window.MMBC_CONFIG || {};
const MONEY = { deposit: 20000, absent: 10000, late: 5000, homework: 5000, gift: 5000, ...(CFG.money || {}) };
const DONATION = CFG.donation || { bank: 'KB국민은행', holder: '어린이재단', account: '102790-71-190660' };
const LINKS = CFG.links || {};
const CATEGORIES = ['경제', '인문', '특정산업', '세금', '부업', '기타'];
const store = CFG.supabaseUrl && CFG.supabaseAnonKey ? makeSupabaseStore(CFG) : demoStore;

const $ = (s, r = document) => r.querySelector(s);
const view = $('#view');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = (n) => `${Number(n || 0).toLocaleString('ko-KR')}원`;
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
function fmt(iso, withTime = true) {
  if (!iso) return '';
  const d = new Date(iso);
  let s = `${d.getMonth() + 1}/${d.getDate()}(${DAYS[d.getDay()]})`;
  if (withTime) { const h = d.getHours(), m = d.getMinutes(); s += ` ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2, '0')}`; }
  return s;
}
const dayBefore = (iso) => { const d = new Date(iso); d.setDate(d.getDate() - 1); return d.toISOString(); };
const roleName = (r) => ({ admin: '클럽장', leader: '모임장', member: '클럽원' }[r] || '클럽원');

let me = null;
let gatherings = [];
let homeTab = 'join';
let myTab = 'joined';
let adminTab = 'apps';

/* ── 공통 UI ── */
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400); }
function openModal(html, bind) {
  const m = $('#modal'), sh = $('.sheet', m);
  sh.innerHTML = html; m.hidden = false; document.body.style.overflow = 'hidden';
  sh.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModal));
  if (bind) bind(sh);
  const f = sh.querySelector('input,textarea,select,button'); f && f.focus({ preventScroll: true });
}
function closeModal() { $('#modal').hidden = true; $('.sheet').innerHTML = ''; document.body.style.overflow = ''; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

function notice(title, body, okLabel = '확인', onOk) {
  openModal(`<h2>${esc(title)}</h2>${body ? `<p class="pre" style="margin:0">${esc(body)}</p>` : ''}<div class="sheet-actions"><button class="btn" id="ok">${esc(okLabel)}</button></div>`,
    sh => $('#ok', sh).addEventListener('click', () => { closeModal(); onOk && onOk(); }));
}
function confirmBox(title, body, yes, no, onYes) {
  openModal(`<h2>${esc(title)}</h2><p class="pre" style="margin:0">${esc(body)}</p>
    <div class="sheet-actions"><button class="btn ghost" data-close>${esc(no)}</button><button class="btn accent" id="yes">${esc(yes)}</button></div>`,
    sh => $('#yes', sh).addEventListener('click', onYes));
}
const needLogin = (msg = '로그인이 필요합니다') => notice(msg, '', '확인', openLogin);
async function act(btn, fn) {
  if (btn) btn.disabled = true;
  try { await fn(); } catch (e) { toast(e.message || '문제가 생겼습니다'); } finally { if (btn) btn.disabled = false; }
}
function copyText(text) {
  const done = () => toast('복사했어요');
  try { navigator.clipboard.writeText(text).then(done, () => toast(text)); } catch { toast(text); }
}

/* ── 모임 상태 ── */
const lastDate = (g) => new Date(g.s2_at || g.s1_at);
const isEnded = (g) => g.status === 'closed' || lastDate(g) < new Date(Date.now() - 6 * 3600e3);
const isFull = (g) => g.confirmed_count >= g.capacity;
function statusChip(g) {
  if (isEnded(g)) return `<span class="chip ended">끝난 세션</span>`;
  if (me && g.leader_id === me.id) return `<span class="chip confirmed">내가 연 모임</span>`;
  if (g.my_status === 'pending') return `<span class="chip pending">신청중</span>`;
  if (g.my_status === 'confirmed') return `<span class="chip confirmed">확정</span>`;
  if (g.my_status === 'rejected') return `<span class="chip rejected">반려</span>`;
  return isFull(g) ? `<span class="chip full">모집완료</span>` : `<span class="chip open">모집중</span>`;
}
function card(g, { button = true } = {}) {
  const ended = isEnded(g), mine = me && g.leader_id === me.id;
  const pct = Math.min(100, Math.round(g.confirmed_count / g.capacity * 100));
  let btn = '';
  if (button) {
    if (mine || g.my_status || (me && me.role === 'admin')) btn = `<button class="btn sm ghost" data-open="${esc(g.id)}">자세히</button>`;
    else if (ended) btn = '';
    else if (isFull(g)) btn = `<button class="btn sm" disabled>모집완료</button>`;
    else btn = `<button class="btn sm accent" data-join="${esc(g.id)}">참여하기</button>`;
  }
  return `<article class="card ${g.kind === 'special' ? 'special' : ''} ${ended ? 'ended' : ''} ${button ? '' : 'link'}" ${button ? '' : `data-open="${esc(g.id)}"`}>
    <div class="chips"><span class="chip">${esc(g.category)}</span>${statusChip(g)}</div>
    <h3>${esc(g.title)}</h3>
    <dl class="meta">
      ${g.kind === 'special' ? `<dt>초대자</dt><dd>${esc(g.inviter || '-')}</dd>` : ''}
      <dt>모임장</dt><dd>${esc(g.leader_nickname)}</dd>
      <dt>위치</dt><dd>${esc(g.location)}</dd>
      <dt>${g.s2_at ? '세션1' : '일시'}</dt><dd class="num">${fmt(g.s1_at)}</dd>
      ${g.s2_at ? `<dt>세션2</dt><dd class="num">${fmt(g.s2_at)}</dd>` : ''}
    </dl>
    <div class="card-foot">
      <span class="small num">확정 <b>${g.confirmed_count}</b> / ${g.capacity}명${g.pending_count ? ` <span class="muted">· 대기 ${g.pending_count}</span>` : ''}</span>
      <div class="bar" aria-hidden="true"><i style="width:${pct}%"></i></div>
      ${btn}
    </div>
  </article>`;
}
function bindCards(root) {
  root.querySelectorAll('[data-join]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openJoin(b.dataset.join); }));
  root.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); go('g-' + b.dataset.open); }));
}

/* ── 상단 / 탭 ── */
function renderTop() {
  const t = $('#topActions');
  const applyBtn = (!me || me.role === 'member') ? `<a href="#apply">모임장 신청하기</a>` : '';
  const adminBtn = me && me.role === 'admin' ? `<a href="#admin">클럽장 관리</a>` : '';
  t.innerHTML = me ? `${adminBtn}${applyBtn}<button class="fill" id="meBtn">${esc(me.nickname)}</button>` : `${applyBtn}<button class="fill" id="loginBtn">로그인</button>`;
  $('#loginBtn', t)?.addEventListener('click', openLogin);
  $('#meBtn', t)?.addEventListener('click', () => openModal(`<h2>${esc(me.nickname)}님</h2>
    <p style="margin:0" class="muted">등급: ${roleName(me.role)}${me.industry ? ` · ${esc(me.industry)}` : ''}</p>
    <div class="sheet-actions"><button class="btn ghost" data-close>닫기</button><button class="btn" id="out">로그아웃</button></div>`,
    sh => $('#out', sh).addEventListener('click', async () => { await store.signOut(); me = null; closeModal(); toast('로그아웃했어요'); route(); })));
  const bar = $('#demoBar');
  if (store.mode === 'demo') {
    bar.hidden = false;
    bar.innerHTML = `<span>체험용 화면 · 이 기기에만 저장돼요</span><button id="resetDemo">초기화</button>`;
    $('#resetDemo').onclick = async () => { await store.resetDemo(); me = null; toast('체험 데이터를 처음 상태로 돌렸어요'); go('home'); route(); };
  }
}
function setTab(name) { document.querySelectorAll('.tabs a').forEach(a => a.dataset.tab === name ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')); }
view.addEventListener('click', e => { if (e.target.closest('[data-back]')) history.length > 1 ? history.back() : go('home'); });

/* ── 로그인 / 가입 ── */
function openLogin() {
  const demo = store.mode === 'demo' ? `<div class="box small"><b>체험용 계정</b> (비밀번호 demo1234)<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
    ${[['TONY', '클럽장'], ['민지', '모임장'], ['준호', '클럽원']].map(([n, r]) => `<button type="button" class="btn sm ghost" data-demo="${n}">${n} (${r})</button>`).join('')}</div></div>` : '';
  openModal(`<h2>로그인</h2>
    <form id="lf"><label>회원 닉네임<input name="nickname" autocomplete="username" required maxlength="20"></label>
    <label>암호<input name="password" type="password" autocomplete="current-password" required></label>
    <p class="err" id="lerr"></p>
    <div class="sheet-actions"><button type="button" class="btn ghost" id="toSignup">회원가입</button><button class="btn">로그인</button></div></form>${demo}`,
    sh => {
      const f = $('#lf', sh);
      const doLogin = async (n, p) => { try { me = await store.signIn(n, p); closeModal(); toast(`${me.nickname}님 반가워요`); route(); } catch (e) { $('#lerr', sh).textContent = e.message; } };
      f.addEventListener('submit', e => { e.preventDefault(); doLogin(f.nickname.value.trim(), f.password.value); });
      $('#toSignup', sh).addEventListener('click', () => { closeModal(); go('signup'); });
      sh.querySelectorAll('[data-demo]').forEach(b => b.addEventListener('click', () => doLogin(b.dataset.demo, 'demo1234')));
    });
}
function viewSignup() {
  view.innerHTML = `<div class="pad"><button class="back" data-back>‹ 뒤로</button><h1>회원가입</h1>
    <p class="muted">연락처나 이메일은 받지 않아요. 닉네임과 비밀번호만 있으면 됩니다.</p>
    <form id="sf">
      <label>닉네임<span class="hint">카페, 카카오톡과 꼭 같은 닉네임으로 해주세요!</span><input name="nickname" required maxlength="20" autocomplete="username"></label>
      <label>비밀번호<span class="hint">자유롭게, 6자 이상</span><input name="password" type="password" required minlength="6" autocomplete="new-password"></label>
      <label>종사중이신 업종<input name="industry" required maxlength="40" placeholder="예: 금융, IT, 교육"></label>
      <div class="row"><label>성함 <span class="opt">(선택)</span><input name="name" maxlength="20"></label>
      <label>나이 <span class="opt">(선택)</span><input name="age" type="number" inputmode="numeric" min="1" max="120"></label></div>
      <p class="hint">성함과 나이는 클럽장만 볼 수 있어요.</p>
      <p class="err" id="serr"></p>
      <button class="btn block accent">가입하기</button>
    </form></div>`;
  const f = $('#sf');
  f.addEventListener('submit', e => {
    e.preventDefault();
    act(f.querySelector('button.accent'), async () => {
      try {
        me = await store.signUp({ nickname: f.nickname.value.trim(), password: f.password.value, industry: f.industry.value.trim(), name: f.name.value.trim(), age: f.age.value ? Number(f.age.value) : null });
        toast('가입을 환영해요!'); go('home');
      } catch (err) { $('#serr').textContent = err.message; }
    });
  });
}

/* ── 홈 ── */
async function viewHome() {
  const link = (url, label, sub) => url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${label}<small>${sub}</small></a>` : `<button type="button" data-soon="${label}">${label}<small>준비중</small></button>`;
  const active = gatherings.filter(g => !isEnded(g));
  const regular = active.filter(g => g.kind === 'regular');
  const special = active.filter(g => g.kind === 'special');
  const isLeader = me && ['leader', 'admin'].includes(me.role);
  let tabBody;
  if (homeTab === 'join') tabBody = regular.length ? `<div class="list">${regular.map(g => card(g)).join('')}</div>` : `<p class="empty">지금 모집 중인 모임이 없어요.<br>곧 새 모임이 열립니다.</p>`;
  else {
    const mine = gatherings.filter(g => me && g.leader_id === me.id && g.kind === 'regular' && !isEnded(g));
    tabBody = `<div class="pad" style="padding-bottom:0"><div class="box small"><h3>모임장이 해야 할 일</h3><ol style="margin:0;padding-left:1.2em">
      <li>세션일로부터 최소 10일 전 모집 등록</li><li>입금이 확인된 클럽원 확정</li><li>당일 세션 진행 및 보증금 계산</li>
      <li>세션 후 우수 참여자 투표 독려 및 기프티콘 발송</li><li>보증금 최종 계산 후 환급 및 잔여 보증금 기부</li></ol></div>
      <button class="btn block accent" style="margin-top:12px" id="newG">+ 새 모임 모집하기</button></div>
      <div class="section-title"><h2>내가 모집 중인 모임</h2></div>
      ${mine.length ? `<div class="list">${mine.map(g => card(g)).join('')}</div>` : `<p class="empty">아직 연 모임이 없어요.</p>`}`;
  }
  view.innerHTML = `<section class="hero">
      <img src="icons/mark.png" alt="MMBC 로고" width="360" height="226">
      <p>아침에 책 한 권, 돈 이야기 한 잔.<br>모닝머니북클럽은 함께 읽고 토론하는 독서 모임이에요.</p>
      <div class="hero-links"><a href="#about">운영방침<small>모임 소개</small></a>
      ${link(LINKS.instagram, '둘러보기', '인스타그램')}${link(LINKS.kakaoOpenChat, '공지 오픈채팅', '카카오톡')}</div>
      ${LINKS.threads ? `<p class="small" style="margin:12px 0 0"><a href="${esc(LINKS.threads)}" target="_blank" rel="noopener">스레드에서도 만나요</a></p>` : ''}
    </section>
    <div class="seg" role="tablist"><button role="tab" aria-selected="${homeTab === 'join'}" data-ht="join">참여하기</button><button role="tab" aria-selected="${homeTab === 'recruit'}" data-ht="recruit">모집하기</button></div>
    <div id="tabBody">${tabBody}</div>
    <div class="section-title"><h2>특별세션</h2><span class="small muted">초대 연사와 함께</span></div>
    ${special.length ? `<div class="list">${special.map(g => card(g)).join('')}</div>` : `<p class="empty">예정된 특별세션이 없어요.</p>`}
    ${isLeader && homeTab === 'recruit' ? `<button class="fab" id="fab" aria-label="새 모임 모집하기">+</button>` : ''}`;
  view.querySelectorAll('[data-soon]').forEach(b => b.addEventListener('click', () => toast('링크를 준비하고 있어요')));
  view.querySelectorAll('[data-ht]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.ht === 'recruit') {
      if (!me) return needLogin();
      if (!isLeader) return notice('모임장만 모집할 수 있어요', '우측 상단 "모임장 신청하기"를 통하여 클럽장이 승인할 경우 세션 모집이 가능합니다.', '확인');
    }
    homeTab = b.dataset.ht; viewHome();
  }));
  $('#newG')?.addEventListener('click', () => go('create'));
  $('#fab')?.addEventListener('click', () => go('create'));
  bindCards(view);
}

/* ── 참여하기 팝업 ── */
function openJoin(id) {
  if (!me) return needLogin();
  const g = gatherings.find(x => x.id === id); if (!g) return;
  openModal(`<h2>${esc(g.title)} 참여하기</h2>
    <p style="margin:0">모임장 계좌에 보증금 입금 확인 순서에 따라 <b>선착순 확정</b>됩니다.</p>
    <div class="box"><h3>보증금 ${won(g.deposit || MONEY.deposit)} 입금 계좌</h3>
      <div class="account"><div><b class="num">${esc(g.account_no || '-')}</b><div class="small muted">${esc(g.bank || '')} · 예금주 ${esc(g.account_holder || '')}</div></div>
      <button class="btn sm ghost" id="copyAcc" type="button">복사</button></div></div>
    <div class="box"><h3>보증금 차감 기준</h3><ul><li>결석: ${won(MONEY.absent)}</li><li>지각 (1분 이후): ${won(MONEY.late)}</li><li>과제 미수행: ${won(MONEY.homework)}</li></ul></div>
    <p class="small muted" style="margin:0">차감된 보증금은 총 차감 금액 안에서 우수참여자 상품비, 모임장의 도서구입비, 기부금 순으로 사용됩니다.
    입금 확인 후에는 환불되지 않으니, 차감 기준을 확인하고 보증금 2만원을 입금한 뒤 참여하기를 눌러주세요.</p>
    <div class="sheet-actions"><button class="btn ghost" data-close>닫기</button><button class="btn accent" id="doJoin">입금했어요, 참여하기</button></div>`,
    sh => {
      $('#copyAcc', sh).addEventListener('click', () => copyText(`${g.bank} ${g.account_no}`));
      $('#doJoin', sh).addEventListener('click', e => act(e.currentTarget, async () => {
        await store.join(id); closeModal(); await refresh();
        notice('신청했어요', '모임장이 입금을 확인하면 "확정"으로 바뀝니다. 내 모임 탭에서 확인할 수 있어요.', '확인'); render();
      }));
    });
}

/* ── 모집하기(모임 만들기) ── */
async function viewCreate(kind = 'regular') {
  if (!me) { go('home'); return needLogin(); }
  if (kind === 'special' ? me.role !== 'admin' : !['leader', 'admin'].includes(me.role)) { go('home'); return; }
  let pre = {};
  try { const a = await store.myApplication(); if (a && a.status === 'approved') pre = a; } catch { }
  const minDate = new Date(Date.now() + 10 * 864e5); const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  view.innerHTML = `<div class="pad"><button class="back" data-back>‹ 뒤로</button>
    <h1>${kind === 'special' ? '특별세션 만들기' : '모임 모집하기'}</h1>
    ${kind === 'regular' ? `<p class="muted">세션일로부터 최소 10일 전에 등록해 주세요. 등록하면 홈의 "참여하기"에 날짜 순으로 보여요.</p>` : ''}
    <form id="cf">
      <label>분야<select name="category" required>${CATEGORIES.map(c => `<option>${c}</option>`).join('')}</select></label>
      <label>${kind === 'special' ? '모임 제목' : '책 제목'}<input name="title" required maxlength="80"></label>
      ${kind === 'special' ? `<label>초대자<input name="inviter" required maxlength="60" placeholder="예: OO증권 애널리스트"></label>
        <label>소개 <span class="opt">(선택)</span><textarea name="description" maxlength="1000"></textarea></label>` : ''}
      <fieldset><legend>${kind === 'special' ? '일시' : '세션1'}</legend><div class="row">
        <input type="date" name="d1" required min="${kind === 'regular' ? ymd(minDate) : ''}" aria-label="세션1 날짜"><input type="time" name="t1" required value="07:00" aria-label="세션1 시간"></div></fieldset>
      <fieldset><legend>세션2 <span class="opt">(선택)</span></legend><div class="row">
        <input type="date" name="d2" aria-label="세션2 날짜"><input type="time" name="t2" value="07:00" aria-label="세션2 시간"></div></fieldset>
      <label>위치<input name="location" required maxlength="100" placeholder="예: 강남역 스터디카페 / 온라인 줌"></label>
      <label>모집인원<div style="display:flex;align-items:center;gap:8px"><input name="capacity" type="number" inputmode="numeric" min="1" max="200" required value="${kind === 'special' ? 30 : 8}" style="max-width:120px"> 명</div></label>
      <fieldset><legend>보증금 계좌</legend>
        <label>은행<input name="bank" required maxlength="30" value="${esc(pre.bank || '')}"></label>
        <label>계좌번호<input name="account_no" required maxlength="40" inputmode="numeric" value="${esc(pre.account_no || '')}"></label>
        <label>예금주<input name="account_holder" required maxlength="30" value="${esc(pre.account_holder || '')}"></label>
      </fieldset>
      <p class="err" id="cerr"></p>
      <button class="btn block accent">모집하기</button>
    </form></div>`;
  const f = $('#cf');
  f.addEventListener('submit', e => {
    e.preventDefault();
    const s1 = new Date(`${f.d1.value}T${f.t1.value}`);
    const s2 = f.d2.value ? new Date(`${f.d2.value}T${f.t2.value || '07:00'}`) : null;
    if (kind === 'regular' && s1 < new Date(Date.now() + 10 * 864e5 - 864e5)) return $('#cerr').textContent = '세션1은 오늘로부터 10일 이후여야 해요.';
    if (s2 && s2 <= s1) return $('#cerr').textContent = '세션2는 세션1보다 뒤여야 해요.';
    act(f.querySelector('button.accent'), async () => {
      const id = await store.createGathering({ kind, category: f.category.value, title: f.title.value.trim(), inviter: f.inviter?.value.trim() || null,
        description: f.description?.value.trim() || null, s1_at: s1.toISOString(), s2_at: s2 ? s2.toISOString() : null, location: f.location.value.trim(),
        capacity: Number(f.capacity.value), bank: f.bank.value.trim(), account_no: f.account_no.value.trim(), account_holder: f.account_holder.value.trim(), deposit: MONEY.deposit });
      await refresh(); toast('모집을 시작했어요'); go('g-' + id);
    });
  });
}

/* ── 모임장 신청 ── */
async function viewApply() {
  if (!me) { go('home'); return notice('로그인 후 신청해주세요', '', '확인', openLogin); }
  if (me.role !== 'member') { view.innerHTML = `<div class="pad"><h1>모임장 신청</h1><p>${esc(me.nickname)}님은 이미 ${roleName(me.role)}이에요. 홈의 "모집하기"에서 모임을 열 수 있어요.</p><a class="btn" href="#home">홈으로</a></div>`; return; }
  const app = await store.myApplication();
  const duties = `<div class="box small"><h3>모임장이 해야 할 일</h3><ol style="margin:0;padding-left:1.2em"><li>세션일로부터 최소 10일 전 모집 등록</li><li>입금이 확인된 클럽원에 대하여 확정</li><li>당일에 세션 진행 및 보증금 계산</li><li>세션 완료 후 우수 참여자 투표 독려 및 기프티콘 발송</li><li>보증금 최종 계산 후 환급 및 잔여 보증금 기부</li></ol></div>`;
  if (app && app.status === 'pending') {
    view.innerHTML = `<div class="pad"><h1>모임장 신청</h1><div class="box"><b>신청을 받았어요.</b><p style="margin:6px 0 0">1~2일 안에 클럽장이 확인하고 승인합니다. 승인되면 홈의 "모집하기"가 열려요.</p></div><div style="margin-top:14px">${duties}</div></div>`;
    return;
  }
  view.innerHTML = `<div class="pad"><button class="back" data-back>‹ 뒤로</button><h1>모임장 등록 신청하기</h1>
    <p>모임장으로 등록 신청 후 1~2일 내에 클럽장이 승인을 합니다. 세션에 1번 이상 참여한 클럽원이라면 누구나 모임장이 될 수 있습니다.</p>
    ${app && app.status === 'rejected' ? `<p class="box small">이전 신청은 반려되었어요. 클럽장과 이야기한 뒤 다시 신청할 수 있어요.</p>` : ''}
    <form id="af">
      <label>모임장 등록 사유<textarea name="reason" required maxlength="1000" placeholder="어떤 책으로, 어떤 모임을 열고 싶은지 적어주세요"></textarea></label>
      <fieldset><legend>보증금 관리 계좌</legend><p class="hint" style="margin:0">정확히 입력 부탁드립니다! 모집할 때 자동으로 채워져요.</p>
        <label>계좌번호<input name="account_no" required inputmode="numeric" maxlength="40"></label>
        <label>계좌주<input name="account_holder" required maxlength="30"></label>
        <label>은행<input name="bank" required maxlength="30"></label></fieldset>
      ${duties}
      <p class="err" id="aerr"></p>
      <button class="btn block accent">신청하기</button></form></div>`;
  const f = $('#af');
  f.addEventListener('submit', e => {
    e.preventDefault();
    act(f.querySelector('button.accent'), async () => {
      await store.applyLeader({ reason: f.reason.value.trim(), bank: f.bank.value.trim(), account_no: f.account_no.value.trim(), account_holder: f.account_holder.value.trim() });
      toast('신청했어요'); viewApply();
    });
  });
}

/* ── 내 모임 ── */
function viewMy() {
  if (!me) {
    view.innerHTML = `<div class="pad"><h1>내 모임</h1><p class="empty">로그인하면 내가 참여하거나 모집한 모임이 여기에 모여요.</p><button class="btn block" id="lg">로그인</button></div>`;
    $('#lg').onclick = openLogin; return;
  }
  const joined = gatherings.filter(g => g.my_status);
  const hosted = gatherings.filter(g => g.leader_id === me.id);
  const sortL = (a) => a.sort((x, y) => (isEnded(x) - isEnded(y)) || x.s1_at.localeCompare(y.s1_at));
  const list = myTab === 'joined' ? sortL(joined) : sortL(hosted);
  view.innerHTML = `<div class="pad" style="padding-bottom:0"><h1>내 모임</h1></div>
    <div class="seg" role="tablist"><button role="tab" aria-selected="${myTab === 'joined'}" data-mt="joined">참여하기 (${joined.length})</button><button role="tab" aria-selected="${myTab === 'hosted'}" data-mt="hosted">모집하기 (${hosted.length})</button></div>
    ${list.length ? `<div class="list">${list.map(g => card(g, { button: false })).join('')}</div>` : `<p class="empty">${myTab === 'joined' ? '참여 신청한 모임이 없어요. 홈에서 모임을 골라보세요.' : '내가 모집한 모임이 없어요.'}</p>`}`;
  view.querySelectorAll('[data-mt]').forEach(b => b.addEventListener('click', () => { myTab = b.dataset.mt; viewMy(); }));
  bindCards(view);
}

/* ── 보증금 계산 ── */
function deductions(p) {
  const s = (n) => (p[`s${n}_absent`] ? MONEY.absent : 0) + (p[`s${n}_late`] ? MONEY.late : 0) + (p[`s${n}_hw`] ? MONEY.homework : 0);
  const s1 = s(1), s2 = s(2); const total = Math.min(s1 + s2, MONEY.deposit);
  return { s1, s2, total, balance: MONEY.deposit - total };
}
function settlement(confirmed, bookCost) {
  const total = confirmed.reduce((a, p) => a + deductions(p).total, 0);
  const gift = total >= MONEY.gift ? MONEY.gift : 0;
  const bookMax = total - gift;
  const book = Math.max(0, Math.min(Number(bookCost) || 0, bookMax));
  return { total, gift, bookMax, book, donation: total - gift - book };
}

/* ── 모임 상세 ── */
async function viewDetail(id) {
  if (!me) { go('home'); return needLogin(); }
  const g = gatherings.find(x => x.id === id);
  if (!g) { view.innerHTML = `<p class="empty">모임을 찾을 수 없어요.</p>`; return; }
  const isLeader = g.leader_id === me.id, isAdmin = me.role === 'admin', manage = isLeader || isAdmin;
  const member = !!g.my_status && g.my_status !== 'rejected';
  const ended = isEnded(g), closed = g.status === 'closed';
  const [parts, posts] = await Promise.all([manage || member ? store.participants(id) : [], manage || member ? store.posts(id) : []]);
  const confirmed = parts.filter(p => p.status === 'confirmed');
  const pending = parts.filter(p => p.status === 'pending');
  const sessions = g.s2_at ? [1, 2] : [1];

  const head = `<section class="detail-head"><button class="back" data-back>‹ 뒤로</button>
    <div class="chips"><span class="chip">${esc(g.category)}</span>${g.kind === 'special' ? '<span class="chip">특별세션</span>' : ''}${statusChip(g)}</div>
    <h1>${esc(g.title)}</h1>
    <dl class="meta" style="margin-top:12px">${g.kind === 'special' ? `<dt>초대자</dt><dd>${esc(g.inviter)}</dd>` : ''}
      <dt>모임장</dt><dd>${esc(g.leader_nickname)}</dd><dt>위치</dt><dd>${esc(g.location)}</dd>
      <dt>${g.s2_at ? '세션1' : '일시'}</dt><dd class="num">${fmt(g.s1_at)}</dd>${g.s2_at ? `<dt>세션2</dt><dd class="num">${fmt(g.s2_at)}</dd>` : ''}
      <dt>인원</dt><dd class="num">확정 ${g.confirmed_count} / ${g.capacity}명</dd></dl>
    ${g.description ? `<p class="pre small" style="margin:12px 0 0;opacity:.9">${esc(g.description)}</p>` : ''}</section>`;

  if (!manage && !member) {
    view.innerHTML = head + `<div class="pad">${g.my_status === 'rejected' ? '<p class="box">이 모임 신청은 반려되었어요. 모임장에게 문의해 주세요.</p>' :
      ended ? '<p class="empty">끝난 모임이에요.</p>' : isFull(g) ? '<button class="btn block" disabled>모집완료</button>' : `<button class="btn block accent" data-join="${esc(g.id)}">참여하기</button>`}</div>`;
    bindCards(view); return;
  }

  let html = head;
  if (closed) html += `<p class="box" style="margin:14px 16px">모임이 종료되어 모든 내용은 보기만 할 수 있어요.</p>`;
  if (!manage && g.my_status === 'pending') html += `<p class="box" style="margin:14px 16px"><b>신청중</b>이에요. 모임장이 입금을 확인하면 확정됩니다.<br><span class="small muted">입금 계좌: ${esc(g.bank)} ${esc(g.account_no)} (${esc(g.account_holder)})</span></p>`;

  // 신청자 관리 (모임장)
  if (manage) {
    html += `<section class="block-sec"><header><h2>참여자 확정/반려</h2><span class="small muted">입금 확인 순서대로 확정</span></header>
      ${pending.length ? `<ul class="people">${pending.map(p => `<li><span><b>${esc(p.nickname)}</b> <span class="small muted num">${fmt(p.created_at)} 신청</span></span>
        <span style="display:flex;gap:6px"><button class="btn sm ghost" data-st="rejected" data-pid="${esc(p.id)}" ${closed ? 'disabled' : ''}>반려</button>
        <button class="btn sm" data-st="confirmed" data-pid="${esc(p.id)}" ${closed || confirmed.length >= g.capacity ? 'disabled' : ''}>확정</button></span></li>`).join('')}</ul>` : '<p class="muted small" style="margin:0">대기 중인 신청이 없어요.</p>'}
      ${confirmed.length ? `<details><summary class="small">확정된 참여자 ${confirmed.length}명</summary><ul class="people">${confirmed.map(p => `<li><span>${esc(p.nickname)}</span>
        <button class="btn sm ghost" data-st="pending" data-pid="${esc(p.id)}" ${closed ? 'disabled' : ''}>확정 취소</button></li>`).join('')}</ul></details>` : ''}
    </section>`;
  }

  // 과제
  html += `<section class="block-sec"><header><h2>과제</h2>${manage && !closed ? '<button class="btn sm" id="newPost">과제 등록</button>' : ''}</header>
    ${posts.length ? posts.map(p => `<button class="post" data-post="${esc(p.id)}"><b>${esc(p.title)}</b>
      <span class="small muted num">세션${p.session_no} · 마감 ${fmt(dayBefore(p.session_no === 2 && g.s2_at ? g.s2_at : g.s1_at), false)}까지</span></button>`).join('') : '<p class="muted small" style="margin:0">아직 등록된 과제가 없어요.</p>'}
  </section>`;

  // 보증금 현황/관리
  const rows = confirmed.map(p => {
    const d = deductions(p);
    const edit = manage && !closed;
    const cells = sessions.map(n => ['absent', 'late', 'hw'].map(k => edit ? `<td><input type="checkbox" aria-label="${esc(p.nickname)} 세션${n} ${{ absent: '결석', late: '지각', hw: '과제 미수행' }[k]}"
      data-pid="${esc(p.id)}" data-k="s${n}_${k}" ${p[`s${n}_${k}`] ? 'checked' : ''}></td>` : `<td>${p[`s${n}_${k}`] ? '<b style="color:var(--accent)">✕</b>' : '<span class="muted">·</span>'}</td>`).join('') + `<td class="money">${d[`s${n}`] ? won(d[`s${n}`]) : '-'}</td>`).join('');
    return `<tr><td>${esc(p.nickname)}</td><td class="money">${won(MONEY.deposit)}</td>${cells}<td class="money">${won(d.total)}</td><td class="money"><b>${won(d.balance)}</b></td></tr>`;
  }).join('');
  const st = settlement(confirmed, g.book_cost);
  html += `<section class="block-sec"><header><h2>보증금 ${manage ? '관리' : '현황'}</h2><span class="small muted">결석 ${won(MONEY.absent)} · 지각 ${won(MONEY.late)} · 과제 ${won(MONEY.homework)}</span></header>
    ${confirmed.length ? `<div class="scroll"><table class="dep"><thead><tr><th rowspan="2">참여자</th><th rowspan="2">납입</th>${sessions.map(n => `<th colspan="4">세션${n}</th>`).join('')}<th rowspan="2">차감</th><th rowspan="2">잔액</th></tr>
      <tr>${sessions.map(() => '<th>결석</th><th>지각</th><th>과제</th><th>합계</th>').join('')}</tr></thead><tbody>${rows}</tbody></table></div>
      <dl class="settle"><div><dt>차감보증금 합계</dt><dd>${won(st.total)}</dd></div>
        <div><dt>우수참여자 기프티콘<br><span class="small muted">합계가 ${won(MONEY.gift)} 미만이면 0원</span></dt><dd>${won(st.gift)}</dd></div>
        <div><dt>모임장 도서구입비<br><span class="small muted">최대 ${won(st.bookMax)}</span></dt><dd>${manage && !closed ? `<input id="bookCost" type="number" inputmode="numeric" min="0" max="${st.bookMax}" step="100" value="${st.book}" aria-label="도서구입비">원` : won(st.book)}</dd></div>
        <div><dt>기부금</dt><dd>${won(st.donation)}</dd></div></dl>
      <div class="box small"><b>기부금 계좌</b><div class="account"><div><b class="num">${esc(DONATION.account)}</b><div class="muted">${esc(DONATION.bank)} (${esc(DONATION.holder)})</div></div><button class="btn sm ghost" id="copyDon">복사</button></div></div>`
    : '<p class="muted small" style="margin:0">확정된 참여자가 생기면 보증금 표가 나타나요.</p>'}
  </section>`;

  // 투표
  html += `<section class="block-sec"><header><h2>우수 참여자 투표</h2><span class="small muted">익명으로 1명</span></header>
    <div class="sheet-actions"><button class="btn ghost" id="voteBtn" ${confirmed.length < 2 || closed || !(g.my_status === 'confirmed' || manage) ? 'disabled' : ''}>투표하기</button><button class="btn ghost" id="resBtn">결과보기</button></div></section>`;

  if (manage && !closed) html += `<div class="pad"><button class="btn block danger" id="endBtn">모임 종료</button></div>`;
  view.innerHTML = html;

  // 이벤트
  view.querySelectorAll('[data-st]').forEach(b => b.addEventListener('click', () => act(b, async () => {
    await store.updateParticipation(b.dataset.pid, { status: b.dataset.st }); await refresh(); viewDetail(id);
  })));
  view.querySelectorAll('input[type=checkbox][data-k]').forEach(c => c.addEventListener('change', () => act(null, async () => {
    if (c.dataset.k.endsWith('_absent') && c.checked) { /* 결석이면 지각은 의미가 없으니 해제 */
      const late = view.querySelector(`[data-pid="${c.dataset.pid}"][data-k="${c.dataset.k.replace('absent', 'late')}"]`);
      if (late?.checked) await store.updateParticipation(c.dataset.pid, { [late.dataset.k]: false });
    }
    await store.updateParticipation(c.dataset.pid, { [c.dataset.k]: c.checked }); viewDetail(id);
  })));
  $('#bookCost')?.addEventListener('change', e => act(null, async () => {
    const v = Math.max(0, Math.min(Number(e.target.value) || 0, st.bookMax));
    await store.updateGathering(id, { book_cost: v }); await refresh(); viewDetail(id);
  }));
  $('#copyDon')?.addEventListener('click', () => copyText(`${DONATION.bank} ${DONATION.account}`));
  $('#newPost')?.addEventListener('click', () => openPostForm(g));
  view.querySelectorAll('[data-post]').forEach(b => b.addEventListener('click', () => openPost(g, posts.find(p => p.id === b.dataset.post), manage || member, closed)));
  $('#voteBtn')?.addEventListener('click', () => openVote(g, confirmed));
  $('#resBtn')?.addEventListener('click', () => openResults(g));
  $('#endBtn')?.addEventListener('click', () => confirmBox('모든 내용이 비활성화 됩니다!', '보증금 환급과 기부금 이체까지 완료하였나요?', '예', '아니오', async () => {
    await store.updateGathering(id, { status: 'closed' }); await refresh();
    notice('모임을 종료합니다', '수고 많으셨어요!', '확인', () => viewDetail(id));
  }));
}

function openPostForm(g) {
  openModal(`<h2>과제 등록</h2><form id="pf">
    ${g.s2_at ? `<label>어느 세션 과제인가요?<select name="session_no"><option value="1">세션1 (${fmt(g.s1_at, false)})</option><option value="2">세션2 (${fmt(g.s2_at, false)})</option></select></label>` : ''}
    <p class="hint" style="margin:0">과제 마감은 세션 전날로 자동 설정돼요.</p>
    <label>게시글 제목<input name="title" required maxlength="100"></label>
    <label>내용<textarea name="body" required maxlength="4000"></textarea></label>
    <div class="sheet-actions"><button type="button" class="btn ghost" data-close>취소</button><button class="btn">등록하기</button></div></form>`,
    sh => { const f = $('#pf', sh); f.addEventListener('submit', e => { e.preventDefault(); act(f.querySelector('button:not([data-close])'), async () => {
      await store.createPost(g.id, { session_no: Number(f.session_no?.value || 1), title: f.title.value.trim(), body: f.body.value.trim() });
      closeModal(); toast('과제를 등록했어요'); viewDetail(g.id); }); }); });
}
async function openPost(g, p, canComment, closed) {
  const due = fmt(dayBefore(p.session_no === 2 && g.s2_at ? g.s2_at : g.s1_at), false);
  const draw = async () => {
    const cs = await store.comments(p.id);
    openModal(`<h2>${esc(p.title)}</h2><p class="small muted" style="margin:0">세션${p.session_no} · 과제 마감 ${due}까지</p>
      <div class="pre">${esc(p.body)}</div>
      <h3>댓글 ${cs.length}</h3><div>${cs.map(c => `<div class="comment"><b>${esc(c.nickname)}</b> <span class="small muted">${fmt(c.created_at)}</span><div class="pre">${esc(c.body)}</div></div>`).join('') || '<p class="small muted">첫 댓글을 남겨주세요.</p>'}</div>
      ${canComment && !closed ? `<form id="cmf"><textarea name="body" required maxlength="2000" placeholder="과제나 생각을 남겨주세요" style="min-height:80px"></textarea><button class="btn">댓글 등록</button></form>` : ''}
      <button class="btn ghost" data-close>닫기</button>`,
      sh => { const f = $('#cmf', sh); f && f.addEventListener('submit', e => { e.preventDefault(); act(f.querySelector('button'), async () => { await store.addComment(p.id, f.body.value.trim()); draw(); }); }); });
  };
  draw();
}
async function openVote(g, confirmed) {
  const mine = await store.myVote(g.id);
  const cands = confirmed.filter(p => p.user_id !== me.id);
  openModal(`<h2>우수 참여자 투표</h2><p class="small muted" style="margin:0">누가 누구를 뽑았는지는 아무도 볼 수 없어요. 다시 투표하면 바뀝니다.</p>
    <form id="vf" style="gap:8px">${cands.map(p => `<label class="vote-opt"><input type="radio" name="c" value="${esc(p.user_id)}" ${mine === p.user_id ? 'checked' : ''} required>${esc(p.nickname)}</label>`).join('')}
    <div class="sheet-actions"><button type="button" class="btn ghost" id="vres">결과보기</button><button class="btn accent">투표하기</button></div></form>`,
    sh => {
      $('#vres', sh).addEventListener('click', () => openResults(g));
      const f = $('#vf', sh); f.addEventListener('submit', e => { e.preventDefault(); act(f.querySelector('.accent'), async () => { await store.vote(g.id, f.c.value); toast('투표했어요'); openResults(g); }); });
    });
}
async function openResults(g) {
  const rs = await store.voteResults(g.id); const max = Math.max(1, ...rs.map(r => r.votes));
  openModal(`<h2>투표 결과</h2>${rs.length ? `<div class="result">${rs.map(r => `<div class="r"><span>${esc(r.nickname)}</span><div class="bar" style="max-width:none"><i style="width:${r.votes / max * 100}%"></i></div><span class="num">${r.votes}표</span></div>`).join('')}</div>` : '<p class="muted">아직 투표가 없어요.</p>'}
    <button class="btn ghost" data-close>닫기</button>`);
}

/* ── 클럽장 관리 ── */
async function viewAdmin() {
  if (!me || me.role !== 'admin') { go('home'); return; }
  let body = '';
  if (adminTab === 'apps') {
    const apps = await store.listApplications();
    body = apps.length ? `<div class="list">${apps.map(a => `<article class="card"><div class="chips"><span class="chip ${a.status === 'pending' ? 'pending' : a.status === 'approved' ? 'confirmed' : 'rejected'}">${{ pending: '대기', approved: '승인', rejected: '반려' }[a.status]}</span><span class="chip num">${fmt(a.created_at, false)}</span></div>
      <h3>${esc(a.nickname)}</h3><p class="pre" style="margin:0 0 8px">${esc(a.reason)}</p><p class="small muted" style="margin:0">계좌: ${esc(a.bank)} ${esc(a.account_no)} (${esc(a.account_holder)})</p>
      ${a.status === 'pending' ? `<div class="sheet-actions" style="margin-top:10px"><button class="btn ghost" data-app="${esc(a.id)}" data-ok="0">반려</button><button class="btn" data-app="${esc(a.id)}" data-ok="1">승인</button></div>` : ''}</article>`).join('')}</div>` : '<p class="empty">모임장 신청이 없어요.</p>';
  } else if (adminTab === 'members') {
    const ms = await store.listMembers();
    body = `<p class="pad small muted" style="padding-block:6px">전체 ${ms.length}명 · 모임장 ${ms.filter(m => m.role === 'leader').length}명</p><div class="list">${ms.map(m => `<article class="card"><h3>${esc(m.nickname)} <span class="small muted">${esc(m.industry || '')}</span></h3>
      <p class="small muted" style="margin:0 0 8px">${m.name ? esc(m.name) : '성함 미입력'}${m.age ? ` · ${esc(m.age)}세` : ''} · ${fmt(m.created_at, false)} 가입</p>
      <label class="small" style="grid-template-columns:auto 1fr;align-items:center">등급<select data-role="${esc(m.id)}" ${m.id === me.id ? 'disabled' : ''}>${['member', 'leader', 'admin'].map(r => `<option value="${r}" ${m.role === r ? 'selected' : ''}>${roleName(r)}</option>`).join('')}</select></label></article>`).join('')}</div>`;
  } else {
    const sp = gatherings.filter(g => g.kind === 'special');
    body = `<div class="pad" style="padding-bottom:0"><a class="btn block accent" href="#create-special">+ 특별세션 만들기</a></div><div class="list" style="margin-top:12px">${sp.map(g => card(g, { button: false })).join('') || '<p class="empty">특별세션이 없어요.</p>'}</div>`;
  }
  view.innerHTML = `<div class="pad" style="padding-bottom:0"><h1>클럽장 관리</h1></div>
    <div class="seg" role="tablist">${[['apps', '모임장 신청'], ['members', '회원'], ['special', '특별세션']].map(([k, l]) => `<button role="tab" aria-selected="${adminTab === k}" data-at="${k}">${l}</button>`).join('')}</div>${body}`;
  view.querySelectorAll('[data-at]').forEach(b => b.addEventListener('click', () => { adminTab = b.dataset.at; viewAdmin(); }));
  view.querySelectorAll('[data-app]').forEach(b => b.addEventListener('click', () => act(b, async () => { await store.decideApplication(b.dataset.app, b.dataset.ok === '1'); toast(b.dataset.ok === '1' ? '승인했어요. 이제 모임장입니다.' : '반려했어요'); viewAdmin(); })));
  view.querySelectorAll('[data-role]').forEach(s => s.addEventListener('change', () => act(null, async () => { await store.setRole(s.dataset.role, s.value); toast('등급을 바꿨어요'); })));
  bindCards(view);
}

/* ── 모임 소개(운영방침) ── */
function viewAbout() {
  view.innerHTML = `<section class="hero" style="text-align:left"><h1>모닝머니북클럽 운영방침</h1><p style="margin:8px 0 0">책 읽고 이야기 나누며 돈과 삶을 함께 공부하는 모임이에요. 누구나 가입할 수 있어요.</p></section>
  <div class="pad about">
    <h2>이렇게 참여해요</h2>
    <ol><li>홈의 <b>참여하기</b>에서 모임을 고르고, 모임장 계좌로 보증금 ${won(MONEY.deposit)}을 입금해요.</li>
      <li><b>참여하기</b> 버튼을 누르면 "신청중"이 되고, 모임장이 입금 순서대로 확정해요.</li>
      <li>세션 전날까지 과제를 하고, 세션에서 이야기를 나눠요.</li>
      <li>모임이 끝나면 우수 참여자를 익명으로 투표하고, 남은 보증금을 돌려받아요.</li></ol>
    <h2>보증금 차감 기준</h2>
    <div class="flow"><div><b>${won(MONEY.absent)}</b>결석</div><div><b>${won(MONEY.late)}</b>지각 (1분 이후)</div><div><b>${won(MONEY.homework)}</b>과제 미수행</div></div>
    <p class="small muted">입금이 확인된 뒤에는 환불되지 않아요.</p>
    <h2>차감된 보증금은 이렇게 쓰여요</h2>
    <ol><li><b>우수 참여자 상품</b>: 기프티콘 ${won(MONEY.gift)} (차감 합계가 ${won(MONEY.gift)} 미만이면 없음)</li>
      <li><b>모임장 도서구입비</b>: 남은 금액 안에서</li>
      <li><b>기부</b>: 그래도 남은 금액은 전액 기부해요</li></ol>
    <div class="box"><b>기부처</b><div class="account"><div><b class="num">${esc(DONATION.account)}</b><div class="small muted">${esc(DONATION.bank)} (${esc(DONATION.holder)})</div></div></div></div>
    <h2>모임장이 되려면</h2>
    <p>세션에 1번 이상 참여한 클럽원이라면 누구나 신청할 수 있어요. 우측 상단 <b>모임장 신청하기</b>로 신청하면 1~2일 안에 클럽장이 승인해요.</p>
    <h2>개인정보</h2>
    <p>가입에는 닉네임, 비밀번호, 업종만 필요해요. 연락처와 이메일은 받지 않고, 성함과 나이는 선택이며 클럽장만 볼 수 있어요.</p>
    ${LINKS.kakaoOpenChat ? `<a class="btn block" href="${esc(LINKS.kakaoOpenChat)}" target="_blank" rel="noopener">공지 오픈채팅 들어가기</a>` : ''}
  </div>`;
}

/* ── 라우팅 ── */
function go(name) { if (location.hash.slice(1) !== name) location.hash = name; else render(); }
async function refresh() { gatherings = await store.listGatherings(); }
async function render() {
  const h = location.hash.slice(1) || 'home';
  renderTop();
  setTab(h === 'about' ? 'about' : h === 'my' || h.startsWith('g-') ? 'my' : h === 'home' ? 'home' : '');
  try {
    if (h === 'about') viewAbout();
    else if (h === 'my') viewMy();
    else if (h === 'signup') viewSignup();
    else if (h === 'apply') await viewApply();
    else if (h === 'create') await viewCreate('regular');
    else if (h === 'create-special') await viewCreate('special');
    else if (h === 'admin') await viewAdmin();
    else if (h.startsWith('g-')) await viewDetail(h.slice(2));
    else await viewHome();
  } catch (e) { console.error(e); view.innerHTML = `<p class="empty">불러오지 못했어요: ${esc(e.message)}</p>`; }
}
async function route() { if (!$('#modal').hidden) closeModal(); await refresh().catch(e => toast(e.message)); window.scrollTo(0, 0); await render(); }
window.addEventListener('hashchange', route);

(async () => {
  try { await store.init(); me = await store.me(); } catch (e) { toast(e.message); }
  await route();
  if ('serviceWorker' in navigator && location.protocol === 'https:') { try { navigator.serviceWorker.register('sw.js').catch(() => { }); } catch { } }
})();
}
