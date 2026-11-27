// 새 모임 개설 / 모임장 승인 알림. Supabase 데이터베이스가 변경될 때 자동으로 호출합니다.
// 비밀값이 없어도 안전합니다: 서버가 데이터베이스에서 사실을 다시 확인하고, 같은 알림은 한 번만 보냅니다.
import { admin, sendTo, firstTime, fmtKST } from './_push.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { kind, id } = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (!/^[0-9a-f-]{36}$/i.test(String(id || ''))) return res.status(400).json({ error: 'bad id' });
    const db = admin();

    if (kind === 'new_gathering') {
      const { data: g } = await db.from('gatherings').select('id, kind, category, title, leader_id, s1_at, created_at, profiles(nickname)').eq('id', id).maybeSingle();
      if (!g || Date.now() - new Date(g.created_at).getTime() > 30 * 60e3) return res.json({ skipped: true });
      if (!(await firstTime(db, `new:${g.id}`))) return res.json({ skipped: 'dup' });
      const { data: all } = await db.from('push_subscriptions').select('user_id');
      const others = [...new Set(all.map(r => r.user_id))].filter(u => u !== g.leader_id);
      const sent = await sendTo(db, others, {
        title: g.kind === 'special' ? '특별세션이 열렸어요' : '새 모임이 열렸어요',
        body: `[${g.category}] ${g.title} · 모임장 ${g.profiles?.nickname || ''} · ${fmtKST(g.s1_at)}`,
        url: `/#g-${g.id}`, tag: `new-${g.id}`,
      });
      return res.json({ sent });
    }

    if (kind === 'leader_approved') {
      const { data: a } = await db.from('leader_applications').select('id, user_id, status').eq('id', id).maybeSingle();
      if (!a || a.status !== 'approved') return res.json({ skipped: true });
      if (!(await firstTime(db, `approved:${a.id}`))) return res.json({ skipped: 'dup' });
      const sent = await sendTo(db, [a.user_id], { title: '모임장으로 승인됐어요 🎉', body: '이제 홈의 "모집하기"에서 모임을 열 수 있어요.', url: '/#home', tag: `approved-${a.id}` });
      return res.json({ sent });
    }
    return res.status(400).json({ error: 'unknown kind' });
  } catch (e) {
    console.error(e); return res.status(500).json({ error: e.message });
  }
}
