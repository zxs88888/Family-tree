-- 007_rls_life_events.sql
-- 修复：life_events 启用了 RLS 但缺少匿名可读策略，导致前端无法读取时间线数据
-- 在 Supabase Dashboard → SQL Editor 中执行

-- 确保 RLS 启用
ALTER TABLE life_events ENABLE ROW LEVEL SECURITY;

-- 任何人可查看事件（匿名可读，用于前端展示时间线）
DROP POLICY IF EXISTS "允许任何人查看事件" ON life_events;
CREATE POLICY "允许任何人查看事件" ON life_events
FOR SELECT USING (true);

-- 仅管理员可写（增删改）
DROP POLICY IF EXISTS "仅管理员可操作事件" ON life_events;
CREATE POLICY "仅管理员可操作事件" ON life_events
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM admins
    JOIN members ON members.id = life_events.member_id
    WHERE admins.user_id = auth.uid() AND admins.family_id = members.family_id
  )
);

-- 同时确保 member_media 也有匿名可读策略（避免后续媒体功能同样问题）
DROP POLICY IF EXISTS "允许任何人查看媒体" ON member_media;
CREATE POLICY "允许任何人查看媒体" ON member_media
FOR SELECT USING (true);
