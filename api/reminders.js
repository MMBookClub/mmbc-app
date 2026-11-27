// 모임 3일 전, 1일 전 알림. Vercel Cron 이 매일 오전 8시(한국 시간)에 호출합니다 (vercel.json).
// 여러 번 호출돼도 같은 알림은 한 번만 갑니다.
import { admin, sendTo, firstTime, fmtKST, kst } from './_push.js';

const dayNo = (d) => Math.floor(d.getTime() / 864e5); // 한국 날짜 기준 일 번호

export default async function handler(req, res) {
  try {
    const db = admin();
    const today = dayNo(kst(new Date().toISOString()));
    const { data: gs, error } = await db.from('gatherings').select('id, title, location, leader_id, s1_at, s2_at, status').neq('status', 'closed');
    if (error) throw error;
    let sent = 0;
    for (const g of gs) {
      for (const [n, at] of [[1, g.s1_at], [2, g.s2_at]]) {
        if (!at) continue;
        const left = dayNo(kst(at)) - today;
        if (left !== 3 && left !== 1) continue;
        if (!(await firstTime(db, `remind:${g.id}:${n}:${left}`))) continue;
        const { data: ps } = await db.from('participations').select('user_id').eq('gathering_id', g.id).eq('status', 'confirmed');
        const users = [...new Set([g.leader_id, ...ps.map(p => p.user_id)])];
        const label = g.s2_at ? ` 세션${n}` : '';
        sent += await sendTo(db, users, {
          title: left === 1 ? `내일 모임이에요: ${g.title}` : `모임 3일 전이에요: ${g.title}`,
          body: `${fmtKST(at)} · ${g.location}${label}${left === 1 ? ' · 생각할거리 마감은 오늘까지예요' : ''}`,
          url: `/#g-${g.id}`, tag: `remind-${g.id}-${n}-${left}`,
        });
      }
    }
    return res.json({ checked: gs.length, sent });
  } catch (e) {
    console.error(e); return res.status(500).json({ error: e.message });
  }
}
