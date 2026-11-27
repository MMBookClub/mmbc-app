// 체험용(데모) 저장소: 이 기기 브라우저에만 저장됩니다. Supabase 설정 전 미리보기용.
const KEY = 'mmbc-demo-v1';
const SESSION_KEY = 'mmbc-demo-session';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id' + Math.random().toString(36).slice(2));
const now = () => new Date().toISOString();
const daysFromNow = (d, h = 7, m = 0) => { const t = new Date(); t.setDate(t.getDate() + d); t.setHours(h, m, 0, 0); return t.toISOString(); };

let mem = null;
function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* 저장 불가 환경 */ } }

function seed() {
  const U = (nickname, role, industry) => ({ id: uid(), nickname, password: 'demo1234', role, industry, name: '', age: null, created_at: now() });
  const tony = U('TONY', 'admin', '금융'), minji = U('민지', 'leader', '회계'), junho = U('준호', 'member', 'IT');
  const others = ['서연', '도윤', '하은', '지후', '수아'].map((n, i) => U(n, 'member', ['교육', '제조', '의료', '디자인', '공무원'][i]));
  const users = [tony, minji, junho, ...others];
  const G = (o) => ({ id: uid(), kind: 'regular', inviter: '', description: '', bank: '카카오뱅크', account_no: '3333-01-2345678', account_holder: o.leader.nickname,
    deposit: 20000, book_cost: 0, status: 'open', created_at: now(), s2_at: null, ...o, leader_id: o.leader.id, leader: undefined });
  const g1 = G({ category: '경제', title: '돈의 심리학', leader: minji, capacity: 8, location: '강남역 스터디카페 2층', s1_at: daysFromNow(12, 7), s2_at: daysFromNow(19, 7) });
  const g2 = G({ category: '부업', title: '나는 4시간만 일한다', leader: tony, capacity: 6, location: '온라인 (줌 링크는 확정 후 안내)', s1_at: daysFromNow(14, 6, 30), s2_at: daysFromNow(21, 6, 30) });
  const g3 = G({ category: '세금', title: '세금 아는 만큼 돈 번다', leader: minji, capacity: 4, location: '합정역 카페', s1_at: daysFromNow(11, 8), s2_at: daysFromNow(18, 8) });
  const g4 = G({ kind: 'special', category: '특정산업', title: '반도체 산업 한눈에 보기', inviter: '현직 반도체 애널리스트', leader: tony, capacity: 30, location: '온라인 라이브', s1_at: daysFromNow(16, 20), description: '초대 연사와 함께하는 1회 특별세션' });
  const g5 = G({ category: '인문', title: '사피엔스', leader: minji, capacity: 6, location: '선릉역 모임공간', s1_at: daysFromNow(-20, 7), s2_at: daysFromNow(-13, 7), status: 'closed', book_cost: 18000 });
  const P = (g, u, status, extra = {}) => ({ id: uid(), gathering_id: g.id, user_id: u.id, status, s1_absent: false, s1_late: false, s1_hw: false, s2_absent: false, s2_late: false, s2_hw: false, created_at: now(), ...extra });
  const parts = [
    P(g1, junho, 'confirmed'), P(g1, others[0], 'confirmed'), P(g1, others[1], 'pending'), P(g1, tony, 'confirmed'),
    P(g3, others[2], 'confirmed'), P(g3, others[3], 'confirmed'), P(g3, others[4], 'confirmed'), P(g3, junho, 'confirmed'),
    P(g2, minji, 'confirmed'), P(g2, junho, 'pending'),
    P(g4, junho, 'confirmed'),
    P(g5, junho, 'confirmed', { s1_late: true }), P(g5, others[0], 'confirmed', { s2_absent: true, s2_hw: true }), P(g5, others[1], 'confirmed'), P(g5, tony, 'confirmed', { s1_hw: true }),
  ];
  const posts = [
    { id: uid(), gathering_id: g1.id, session_no: 1, title: '1~5장 읽고 가장 와닿은 문장 1개 + 이유', body: '각자 1~5장을 읽고 가장 와닿은 문장 하나와 그 이유를 댓글로 남겨 주세요.\n분량은 3줄 이상이면 충분해요.', author_id: minji.id, created_at: now() },
  ];
  const comments = [{ id: uid(), post_id: posts[0].id, user_id: junho.id, body: '"부자가 되는 것과 부자로 남는 것은 다르다" 저축 습관을 다시 돌아보게 됐어요.', created_at: now() }];
  const apps = [{ id: uid(), user_id: others[0].id, reason: '세션에 두 번 참여했고, 부동산 책으로 모임을 열어보고 싶어요.', bank: '국민은행', account_no: '123-45-678901', account_holder: '서연', status: 'pending', created_at: now() },
    { id: uid(), user_id: minji.id, reason: '회계 일을 하며 읽은 책을 함께 나누고 싶어요.', bank: '카카오뱅크', account_no: '3333-01-2345678', account_holder: '민지', status: 'approved', created_at: daysFromNow(-40) }];
  const votes = [{ gathering_id: g5.id, voter_id: others[0].id, candidate_id: junho.id }, { gathering_id: g5.id, voter_id: tony.id, candidate_id: junho.id }];
  return { users, gatherings: [g1, g2, g3, g4, g5], participations: parts, posts, comments, applications: apps, votes };
}

function load() {
  if (mem) return mem;
  const raw = safeGet(KEY);
  try { mem = raw ? JSON.parse(raw) : null; } catch { mem = null; }
  if (!mem) { mem = seed(); save(); }
  return mem;
}
function save() { safeSet(KEY, JSON.stringify(mem)); }
const fail = (msg) => { throw new Error(msg); };
const pub = (u) => u && ({ id: u.id, nickname: u.nickname, role: u.role, industry: u.industry });

let sessionUserId = safeGet(SESSION_KEY) || null;

export const demoStore = {
  mode: 'demo',
  async init() { load(); },
  async me() { const d = load(); return pub(d.users.find(u => u.id === sessionUserId)) || null; },
  async signUp({ nickname, password, industry, name, age }) {
    const d = load();
    if (d.users.some(u => u.nickname === nickname)) fail('이미 사용 중인 닉네임입니다');
    const u = { id: uid(), nickname, password, industry, name, age, role: 'member', created_at: now() };
    d.users.push(u); save(); sessionUserId = u.id; safeSet(SESSION_KEY, u.id); return pub(u);
  },
  async signIn(nickname, password) {
    const d = load(); const u = d.users.find(x => x.nickname === nickname && x.password === password);
    if (!u) fail('닉네임 또는 비밀번호가 맞지 않습니다');
    sessionUserId = u.id; safeSet(SESSION_KEY, u.id); return pub(u);
  },
  async signOut() { sessionUserId = null; safeSet(SESSION_KEY, ''); },
  async resetDemo() { mem = seed(); save(); sessionUserId = null; safeSet(SESSION_KEY, ''); },

  async listGatherings() {
    const d = load();
    return d.gatherings.map(g => {
      const ps = d.participations.filter(p => p.gathering_id === g.id);
      const mine = ps.find(p => p.user_id === sessionUserId);
      const logged = !!sessionUserId;
      return { ...g, bank: logged ? g.bank : null, account_no: logged ? g.account_no : null, account_holder: logged ? g.account_holder : null,
        leader_nickname: d.users.find(u => u.id === g.leader_id)?.nickname || '',
        confirmed_count: ps.filter(p => p.status === 'confirmed').length, pending_count: ps.filter(p => p.status === 'pending').length,
        my_status: mine ? mine.status : null };
    }).sort((a, b) => a.s1_at.localeCompare(b.s1_at));
  },
  async createGathering(data) {
    const d = load(); const me = d.users.find(u => u.id === sessionUserId);
    if (!me || !['leader', 'admin'].includes(me.role)) fail('모임장만 모집할 수 있습니다');
    if (data.kind === 'special' && me.role !== 'admin') fail('특별세션은 클럽장만 열 수 있습니다');
    const g = { id: uid(), kind: 'regular', deposit: 20000, book_cost: 0, status: 'open', created_at: now(), inviter: '', description: '', ...data, leader_id: me.id };
    d.gatherings.push(g); save(); return g.id;
  },
  async updateGathering(id, patch) {
    const d = load(); const g = d.gatherings.find(x => x.id === id); Object.assign(g, patch); save();
  },
  async join(gid) {
    const d = load(); if (!sessionUserId) fail('로그인이 필요합니다');
    const g = d.gatherings.find(x => x.id === gid);
    if (g.status !== 'open') fail('모집이 끝난 모임입니다');
    if (g.leader_id === sessionUserId) fail('내가 연 모임입니다');
    if (!d.participations.some(p => p.gathering_id === gid && p.user_id === sessionUserId))
      d.participations.push({ id: uid(), gathering_id: gid, user_id: sessionUserId, status: 'pending', s1_absent: false, s1_late: false, s1_hw: false, s2_absent: false, s2_late: false, s2_hw: false, created_at: now() });
    save();
  },
  async participants(gid) {
    const d = load();
    return d.participations.filter(p => p.gathering_id === gid).map(p => ({ ...p, nickname: d.users.find(u => u.id === p.user_id)?.nickname || '' }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },
  async updateParticipation(pid, patch) {
    const d = load(); const p = d.participations.find(x => x.id === pid); Object.assign(p, patch); save();
  },
  async posts(gid) { return load().posts.filter(p => p.gathering_id === gid).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
  async createPost(gid, { session_no, title, body }) {
    const d = load(); d.posts.push({ id: uid(), gathering_id: gid, session_no, title, body, author_id: sessionUserId, created_at: now() }); save();
  },
  async comments(postId) {
    const d = load();
    return d.comments.filter(c => c.post_id === postId).map(c => ({ ...c, nickname: d.users.find(u => u.id === c.user_id)?.nickname || '' }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },
  async addComment(postId, body) { const d = load(); d.comments.push({ id: uid(), post_id: postId, user_id: sessionUserId, body, created_at: now() }); save(); },
  async myVote(gid) { return load().votes.find(v => v.gathering_id === gid && v.voter_id === sessionUserId)?.candidate_id || null; },
  async vote(gid, candidateId) {
    const d = load(); if (candidateId === sessionUserId) fail('자기 자신에게는 투표할 수 없습니다');
    d.votes = d.votes.filter(v => !(v.gathering_id === gid && v.voter_id === sessionUserId));
    d.votes.push({ gathering_id: gid, voter_id: sessionUserId, candidate_id: candidateId }); save();
  },
  async voteResults(gid) {
    const d = load(); const m = new Map();
    d.votes.filter(v => v.gathering_id === gid).forEach(v => m.set(v.candidate_id, (m.get(v.candidate_id) || 0) + 1));
    return [...m].map(([id, votes]) => ({ candidate_id: id, nickname: d.users.find(u => u.id === id)?.nickname || '', votes })).sort((a, b) => b.votes - a.votes);
  },
  async myApplication() {
    return load().applications.filter(a => a.user_id === sessionUserId).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] || null;
  },
  async applyLeader({ reason, bank, account_no, account_holder }) {
    const d = load(); if (!sessionUserId) fail('로그인 후 신청해주세요');
    if (d.applications.some(a => a.user_id === sessionUserId && a.status === 'pending')) fail('이미 신청한 내역이 있습니다');
    d.applications.push({ id: uid(), user_id: sessionUserId, reason, bank, account_no, account_holder, status: 'pending', created_at: now() }); save();
  },
  async listApplications() {
    const d = load();
    return d.applications.map(a => ({ ...a, nickname: d.users.find(u => u.id === a.user_id)?.nickname || '' })).sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  async decideApplication(id, approve) {
    const d = load(); const a = d.applications.find(x => x.id === id); a.status = approve ? 'approved' : 'rejected';
    const u = d.users.find(x => x.id === a.user_id); if (approve && u.role === 'member') u.role = 'leader'; save();
  },
  async listMembers() {
    return load().users.map(u => ({ id: u.id, nickname: u.nickname, industry: u.industry, role: u.role, created_at: u.created_at, name: u.name, age: u.age }));
  },
  async setRole(id, role) {
    const d = load(); if (id === sessionUserId) fail('내 등급은 바꿀 수 없습니다');
    d.users.find(u => u.id === id).role = role; save();
  },
};
