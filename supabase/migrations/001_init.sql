-- 001_init.sql
-- 家族族谱应用数据库初始化
-- 包含：建表、索引、RLS 策略、RPC 函数、存储桶

-- ============================================================
-- 1. 建表
-- ============================================================

CREATE TABLE IF NOT EXISTS families (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  access_code VARCHAR(50) DEFAULT 'Wang2026',
  admin_contact VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  gender INT CHECK (gender IN (1,2)),
  birth_year INT,
  death_year INT DEFAULT NULL,
  is_alive BOOLEAN DEFAULT TRUE,
  biography TEXT,
  avatar_url TEXT,
  father_id UUID REFERENCES members(id) ON DELETE SET NULL,
  mother_id UUID REFERENCES members(id) ON DELETE SET NULL,
  spouse_id UUID REFERENCES members(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS life_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  event_type_label VARCHAR(50),
  event_title VARCHAR(100) NOT NULL,
  year_display VARCHAR(30) NOT NULL,
  year_sort INT,
  location VARCHAR(200),
  description TEXT,
  sort_order INT DEFAULT 0,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS member_media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  event_id UUID REFERENCES life_events(id) ON DELETE SET NULL,
  media_url TEXT NOT NULL,
  media_type VARCHAR(20) DEFAULT 'image' CHECK (media_type IN ('image', 'video', 'document')),
  caption VARCHAR(200),
  sort_order INT DEFAULT 0,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. 索引
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_members_father ON members(father_id);
CREATE INDEX IF NOT EXISTS idx_members_mother ON members(mother_id);
CREATE INDEX IF NOT EXISTS idx_members_spouse ON members(spouse_id);
CREATE INDEX IF NOT EXISTS idx_members_family ON members(family_id);
CREATE INDEX IF NOT EXISTS idx_members_is_deleted ON members(is_deleted);
CREATE INDEX IF NOT EXISTS idx_members_is_alive ON members(is_alive);
CREATE INDEX IF NOT EXISTS idx_life_events_member ON life_events(member_id);
CREATE INDEX IF NOT EXISTS idx_life_events_year_sort ON life_events(year_sort DESC NULLS LAST, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_member_media_member ON member_media(member_id);
CREATE INDEX IF NOT EXISTS idx_member_media_event ON member_media(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_user_family ON admins(user_id, family_id);

-- ============================================================
-- 3. RLS 行级安全策略
-- ============================================================

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE life_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- members
CREATE POLICY "允许已登录用户查看成员" ON members
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "允许登录用户新增" ON members
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "管理员可更新所有成员" ON members
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid() AND family_id = members.family_id)
);

CREATE POLICY "创建者可更新自己创建的数据" ON members
FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "仅管理员可删除成员" ON members
FOR DELETE USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid() AND family_id = members.family_id)
);

-- life_events
CREATE POLICY "允许已登录用户查看事件" ON life_events
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "管理员可操作所有事件" ON life_events
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM admins
    JOIN members ON members.family_id = admins.family_id
    WHERE admins.user_id = auth.uid() AND members.id = life_events.member_id
  )
);

-- member_media
CREATE POLICY "允许已登录用户查看媒体" ON member_media
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "管理员可操作所有媒体" ON member_media
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM admins
    JOIN members ON members.family_id = admins.family_id
    WHERE admins.user_id = auth.uid() AND members.id = member_media.member_id
  )
);

-- families（不开放 SELECT，仅管理员可 UPDATE）
CREATE POLICY "仅管理员可更新家族信息" ON families
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid() AND family_id = families.id)
);

-- admins
CREATE POLICY "仅管理员可管理管理员" ON admins
FOR ALL USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid() AND family_id = admins.family_id)
);

-- ============================================================
-- 4. RPC 函数
-- ============================================================

CREATE OR REPLACE FUNCTION validate_access_code(input_code TEXT, family_id UUID)
RETURNS BOOLEAN AS $$
DECLARE stored_code TEXT;
BEGIN
  SELECT access_code INTO stored_code FROM families WHERE id = family_id LIMIT 1;
  IF stored_code IS NULL THEN RETURN FALSE; END IF;
  RETURN stored_code = input_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_access_code_hint(family_id UUID)
RETURNS VARCHAR AS $$
DECLARE full_code VARCHAR; hint VARCHAR;
BEGIN
  SELECT access_code INTO full_code FROM families WHERE id = family_id LIMIT 1;
  IF full_code IS NULL THEN RETURN '****'; END IF;
  hint := LEFT(full_code, 2) || '****';
  RETURN hint;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_family_info(family_id UUID)
RETURNS TABLE (name VARCHAR, description TEXT, admin_contact VARCHAR) AS $$
BEGIN
  RETURN QUERY
  SELECT f.name, f.description, f.admin_contact
  FROM families f
  WHERE f.id = family_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. 存储桶（通过 Supabase Dashboard 或 Management API 创建）
-- 需要手动创建两个 Public Bucket：
--   - avatars（头像）
--   - family_photos（事件图片）
-- ============================================================

-- 插入一条初始家族记录（首次部署后需手动修改）
-- INSERT INTO families (name, access_code, description) VALUES ('我的家族', 'Wang2026', '欢迎来到家族族谱');
