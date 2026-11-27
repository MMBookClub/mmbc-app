// ▼ 운영 설정. 여기만 고치면 됩니다.
window.MMBC_CONFIG = {
  // Supabase 프로젝트 정보 (Settings > API). 비워두면 "체험용 모드"로 동작합니다.
  supabaseUrl: 'https://mszhfnjrzljaqzotjeag.supabase.co',
  supabaseAnonKey: 'sb_publishable_VEbmkXxXHuqY2LIdNRh33A_oPbll6TO',

  // 홈 화면 링크 (비워두면 "준비중"으로 표시)
  links: {
    instagram: 'https://www.instagram.com/m.m.bookclub/',
    threads: 'https://www.threads.com/@m.m.bookclub',
    kakaoOpenChat: 'https://open.kakao.com/o/gvvh4uzh',
    clubOwner: '',   // "클럽장이 생각하는 곳" 버튼 주소
  },

  // 잔여 보증금 기부처
  donation: { bank: 'KB국민은행', holder: '어린이재단', account: '102790-71-190660' },

  // 보증금/차감 기준(원)
  money: { deposit: 20000, absent: 10000, late: 5000, homework: 5000, gift: 5000 },
};
