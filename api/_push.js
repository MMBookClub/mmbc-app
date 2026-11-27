// 푸시 알림 공통 코드 (Vercel 서버에서만 실행, 브라우저로 보내지지 않음)
// 필요한 Vercel 환경 변수: SUPABASE_SERVICE_ROLE_KEY, VAPID_PRIVATE_KEY
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://mszhfnjrzljaqzotjeag.supabase.co';
export const VAPID_PUBLIC_KEY = 'BFZP7Abuslc2w5rjgDdpcwaPh4etqzEhSY4US5F_6fCl1-kEEijyDW7fngILSCQHielevQVBOg6tY-bwLjp0AEw';

export function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY 환경 변수가 없습니다');
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

function setupPush() {
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!priv) throw new Error('VAPID_PRIVATE_KEY 환경 변수가 없습니다');
  webpush.setVapidDetails('https://mmbc-app.vercel.app', VAPID_PUBLIC_KEY, priv);
}

// 같은 알림을 두 번 보내지 않도록 기록. 처음이면 true
export async function firstTime(db, key) {
  const { data, error } = await db.from('push_log').upsert({ key }, { onConflict: 'key', ignoreDuplicates: true }).select('key');
  if (error) throw error;
  return data.length > 0;
}

// userIds 가 null 이면 알림을 켠 모든 회원에게
export async function sendTo(db, userIds, payload) {
  setupPush();
  let q = db.from('push_subscriptions').select('endpoint, p256dh, auth, user_id');
  if (userIds) { if (!userIds.length) return 0; q = q.in('user_id', userIds); }
  const { data: subs, error } = await q;
  if (error) throw error;
  let sent = 0;
  await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 24 });
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
    }
  }));
  return sent;
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
export function kst(iso) { return new Date(new Date(iso).getTime() + 9 * 3600e3); }
export function fmtKST(iso) {
  const d = kst(iso), h = d.getUTCHours(), m = d.getUTCMinutes();
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${DAYS[d.getUTCDay()]}) ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2, '0')}`;
}
