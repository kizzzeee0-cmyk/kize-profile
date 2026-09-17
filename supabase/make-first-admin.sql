-- 1) Supabase Dashboard > Authentication > Users에서 Email/Password 사용자를 먼저 생성하세요.
-- 2) 생성된 User UUID를 아래 <USER_UUID>에 넣고 실행하세요.
-- 첫 관리자만 SQL Editor에서 bootstrap하고, 이후 admin_profiles 추가는 기존 관리자가 할 수 있습니다.

insert into public.admin_profiles (user_id, display_name)
values ('<USER_UUID>'::uuid, 'Owner');
