// 실제 운영용 저장소: Supabase (무료 요금제) 사용
// 닉네임으로 로그인하기 위해, 닉네임에서 만든 가짜 이메일을 내부적으로만 씁니다. (실제 이메일 수집 없음, 메일 발송 없음)
// Supabase는 가입 때 이메일 도메인이 실제로 존재하는지 확인하므로, 이 사이트 주소를 도메인으로 씁니다.
// 주의: 이미 가입한 회원이 있으면 이 값을 바꾸면 안 됩니다(로그인이 안 됨).
async function nickToEmail(nickname) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nickname.trim()));
  const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  return `m${hex}@mmbc-app.vercel.app`;
}
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Supabase 라이브러리를 불러오지 못했습니다')); document.head.appendChild(s); });
}
const ok = ({ data, error }) => { if (error) throw new Error(friendly(error.message)); return data; };
function friendly(m) {
  if (/Invalid login/i.test(m)) return '닉네임 또는 비밀번호가 맞지 않습니다';
  if (/already registered|duplicate key.*nickname/i.test(m)) return '이미 사용 중인 닉네임입니다';
  if (/Password should be/i.test(m)) return '비밀번호는 6자 이상이어야 합니다';
  return m;
}

export function makeSupabaseStore(cfg) {
  let sb = null, meCache;
  const uidNow = async () => (await sb.auth.getSession()).data.session?.user?.id || null;
  return {
    mode: 'live',
    async init() {
      await loadScript('vendor/supabase-2.119.0.js');
      sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true } });
    },
    async me() {
      const id = await uidNow(); if (!id) return null;
      const p = ok(await sb.from('profiles').select('id,nickname,role,industry').eq('id', id).maybeSingle());
      return p;
    },
    async signUp({ nickname, password, industry, name, age }) {
      const email = await nickToEmail(nickname);
      const r = ok(await sb.auth.signUp({ email, password, options: { data: { nickname: nickname.trim(), industry, name: name || '', age: age ? String(age) : '' } } }));
      if (!r.session) throw new Error('가입은 됐지만 로그인되지 않았습니다. Supabase에서 이메일 확인(Confirm email)을 꺼 주세요.');
      return this.me();
    },
    async signIn(nickname, password) {
      ok(await sb.auth.signInWithPassword({ email: await nickToEmail(nickname), password })); return this.me();
    },
    async signOut() { await sb.auth.signOut(); },

    async listGatherings() { return ok(await sb.rpc('list_gatherings')); },
    async createGathering(data) {
      const leader_id = await uidNow();
      const row = ok(await sb.from('gatherings').insert({ ...data, leader_id }).select('id').single()); return row.id;
    },
    async uploadCover(blob) {
      const path = `${crypto.randomUUID()}.jpg`;
      ok(await sb.storage.from('covers').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' }));
      return sb.storage.from('covers').getPublicUrl(path).data.publicUrl;
    },
    async updateGathering(id, patch) { ok(await sb.from('gatherings').update(patch).eq('id', id)); },
    async join(gid) { ok(await sb.rpc('join_gathering', { g: gid })); },
    async participants(gid) {
      const rows = ok(await sb.from('participations').select('*, profiles(nickname)').eq('gathering_id', gid).order('created_at'));
      return rows.map(r => ({ ...r, nickname: r.profiles?.nickname || '' }));
    },
    async updateParticipation(pid, patch) { ok(await sb.from('participations').update(patch).eq('id', pid)); },
    async posts(gid) { return ok(await sb.from('posts').select('*').eq('gathering_id', gid).order('created_at', { ascending: false })); },
    async createPost(gid, { session_no, title, body }) {
      ok(await sb.from('posts').insert({ gathering_id: gid, session_no, title, body, author_id: await uidNow() }));
    },
    async comments(postId) {
      const rows = ok(await sb.from('comments').select('*, profiles(nickname)').eq('post_id', postId).order('created_at'));
      return rows.map(r => ({ ...r, nickname: r.profiles?.nickname || '' }));
    },
    async addComment(postId, body) { ok(await sb.from('comments').insert({ post_id: postId, body, user_id: await uidNow() })); },
    async myVote(gid) {
      const r = ok(await sb.from('votes').select('candidate_id').eq('gathering_id', gid).maybeSingle()); return r?.candidate_id || null;
    },
    async vote(gid, candidateId) { ok(await sb.rpc('cast_vote', { g: gid, candidate: candidateId })); },
    async voteResults(gid) { return ok(await sb.rpc('vote_results', { g: gid })); },
    async myApplication() {
      const id = await uidNow();
      const rows = ok(await sb.from('leader_applications').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(1));
      return rows[0] || null;
    },
    async applyLeader({ reason, bank, account_no, account_holder }) {
      ok(await sb.rpc('apply_leader', { p_reason: reason, p_bank: bank, p_account_no: account_no, p_holder: account_holder }));
    },
    async listApplications() {
      const rows = ok(await sb.from('leader_applications').select('*, profiles(nickname)').order('created_at', { ascending: false }));
      return rows.map(r => ({ ...r, nickname: r.profiles?.nickname || '' }));
    },
    async decideApplication(id, approve) { ok(await sb.rpc('decide_application', { app: id, approve })); },
    async listMembers() { return ok(await sb.rpc('list_members')); },
    async setRole(id, role) { ok(await sb.rpc('set_role', { target: id, new_role: role })); },
  };
}
