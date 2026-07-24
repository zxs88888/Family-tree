-- 001_init.sql
-- 家族族谱应用数据库初始化（Phase 2）
-- 包含：建表、索引、RLS 策略、RPC 函数、初始数据

-- ============================================================
-- 1. 建表
-- ============================================================

CREATE TABLE IF NOT EXISTS families (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  access_code VARCHAR(50) DEFAULT 'Wang2026',
  admin_contact VARCHAR(200),
  root_member_id UUID, -- 后设外键，指向 members 表根节点
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  gender INT CHECK (gender IN (1, 2)),
  birth_year INT,
  death_year INT DEFAULT NULL,
  is_alive BOOLEAN DEFAULT TRUE,
  biography TEXT,
  avatar_url TEXT,
  father_id UUID REFERENCES members(id) ON DELETE SET NULL,
  mother_id UUID REFERENCES members(id) ON DELETE SET NULL,
  spouse_id UUID REFERENCES members(id) ON DELETE SET NULL, -- 废弃，由 spouses 表管理
  generation INT, -- 世代编号（0=祖辈，1=父辈...）
  created_by UUID REFERENCES auth.users,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加 families → members 外键（延迟添加避免循环引用）
ALTER TABLE families
  ADD CONSTRAINT fk_families_root_member
  FOREIGN KEY (root_member_id) REFERENCES members(id) ON DELETE SET NULL;

-- 多配偶关联表（解决旧 spouse_id 单字段限制）
CREATE TABLE IF NOT EXISTS spouses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  spouse_id UUID REFERENCES members(id) ON DELETE CASCADE,
  marriage_order INT NOT NULL DEFAULT 1, -- 该婚姻在 member_id 方的顺序
  marriage_type VARCHAR(20), -- 元配/次配/三配/继配/末配
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, spouse_id)
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, family_id)
);

-- ============================================================
-- 2. 索引
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_members_father ON members(father_id);
CREATE INDEX IF NOT EXISTS idx_members_mother ON members(mother_id);
CREATE INDEX IF NOT EXISTS idx_members_family ON members(family_id);
CREATE INDEX IF NOT EXISTS idx_members_is_deleted ON members(is_deleted);
CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);
CREATE INDEX IF NOT EXISTS idx_spouses_member ON spouses(member_id);
CREATE INDEX IF NOT EXISTS idx_spouses_spouse ON spouses(spouse_id);
CREATE INDEX IF NOT EXISTS idx_life_events_member ON life_events(member_id);
CREATE INDEX IF NOT EXISTS idx_life_events_year_sort ON life_events(year_sort DESC NULLS LAST, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_member_media_member ON member_media(member_id);
CREATE INDEX IF NOT EXISTS idx_member_media_event ON member_media(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_user_family ON admins(user_id, family_id);

-- members 唯一约束：同家族内同名不重复（用于导入去重）
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_name_family ON members(name, family_id) WHERE is_deleted = FALSE;

-- ============================================================
-- 3. RLS 行级安全策略
-- ============================================================

ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE spouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE life_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- families: 任何人可读（访问码验证在前端/RPC层）
CREATE POLICY "允许任何人查看家族信息" ON families
FOR SELECT USING (true);

CREATE POLICY "仅管理员可更新家族信息" ON families
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid() AND family_id = families.id)
);

-- members: 任何人可读，仅管理员可写
CREATE POLICY "允许任何人查看成员" ON members
FOR SELECT USING (true);

CREATE POLICY "仅管理员可新增成员" ON members
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid() AND family_id = members.family_id)
);

CREATE POLICY "仅管理员可更新成员" ON members
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid() AND family_id = members.family_id)
);

CREATE POLICY "仅管理员可删除成员" ON members
FOR DELETE USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid() AND family_id = members.family_id)
);

-- spouses: 任何人可读，仅管理员可写
CREATE POLICY "允许任何人查看配偶关系" ON spouses
FOR SELECT USING (true);

CREATE POLICY "仅管理员可管理配偶关系" ON spouses
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM admins
    JOIN members ON members.id = spouses.member_id
    WHERE admins.user_id = auth.uid() AND admins.family_id = members.family_id
  )
);

-- life_events: 任何人可读，仅管理员可写
CREATE POLICY "允许任何人查看事件" ON life_events
FOR SELECT USING (true);

CREATE POLICY "仅管理员可操作事件" ON life_events
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM admins
    JOIN members ON members.id = life_events.member_id
    WHERE admins.user_id = auth.uid() AND admins.family_id = members.family_id
  )
);

-- member_media: 任何人可读，仅管理员可写
CREATE POLICY "允许任何人查看媒体" ON member_media
FOR SELECT USING (true);

CREATE POLICY "仅管理员可操作媒体" ON member_media
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM admins
    JOIN members ON members.id = member_media.member_id
    WHERE admins.user_id = auth.uid() AND admins.family_id = members.family_id
  )
);

-- admins: 仅管理员可管理
CREATE POLICY "仅管理员可管理管理员" ON admins
FOR ALL USING (
  EXISTS (SELECT 1 FROM admins a WHERE a.user_id = auth.uid() AND a.family_id = admins.family_id)
);

-- ============================================================
-- 4. RPC 函数
-- ============================================================

-- 访问码验证（单家族模式，无需 family_id 参数）
CREATE OR REPLACE FUNCTION validate_access_code(input_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE stored_code TEXT;
BEGIN
  SELECT access_code INTO stored_code FROM families LIMIT 1;
  IF stored_code IS NULL THEN RETURN FALSE; END IF;
  RETURN stored_code = input_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 访问码脱敏提示
CREATE OR REPLACE FUNCTION get_access_code_hint()
RETURNS VARCHAR AS $$
DECLARE full_code VARCHAR; hint VARCHAR;
BEGIN
  SELECT access_code INTO full_code FROM families LIMIT 1;
  IF full_code IS NULL THEN RETURN '****'; END IF;
  hint := LEFT(full_code, 2) || '****';
  RETURN hint;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取家族信息
CREATE OR REPLACE FUNCTION get_family_info()
RETURNS TABLE (name VARCHAR, description TEXT, admin_contact VARCHAR, root_member_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT f.name, f.description, f.admin_contact, f.root_member_id
  FROM families f
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 事务性批量导入家族数据
CREATE OR REPLACE FUNCTION import_family_data(json_data JSONB)
RETURNS JSONB AS $$
DECLARE
  v_family_id UUID;
  v_member JSONB;
  v_event JSONB;
  v_spouse JSONB;
  v_member_id UUID;
  v_father_id UUID;
  v_mother_id UUID;
  v_spouse_member_id UUID;
  v_spouse_id UUID;
  v_inserted INT := 0;
  v_skipped INT := 0;
  v_errors INT := 0;
  v_error_msg TEXT;
  v_member_order INT;
  v_spouse_order INT;
BEGIN
  -- 获取家族 ID（单家族模式）
  SELECT id INTO v_family_id FROM families LIMIT 1;
  IF v_family_id IS NULL THEN
    RETURN jsonb_build_object('inserted', 0, 'skipped', 0, 'errors', 1, 'error_message', '未找到家族记录');
  END IF;

  -- 第一遍：INSERT members
  FOR v_member IN SELECT * FROM jsonb_array_elements(json_data->'members')
  LOOP
    BEGIN
      -- 检查是否已存在
      SELECT id INTO v_member_id FROM members
      WHERE name = v_member->>'name' AND family_id = v_family_id AND is_deleted = FALSE;

      IF v_member_id IS NOT NULL THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      INSERT INTO members (family_id, name, gender, birth_year, death_year, is_alive, biography)
      VALUES (
        v_family_id,
        v_member->>'name',
        (v_member->>'gender')::INT,
        NULLIF(v_member->>'birth_year', '')::INT,
        NULLIF(v_member->>'death_year', '')::INT,
        COALESCE((v_member->>'is_alive')::BOOLEAN, TRUE),
        v_member->>'biography'
      )
      RETURNING id INTO v_member_id;

      v_inserted := v_inserted + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  -- 第二遍：UPDATE father_id / mother_id
  FOR v_member IN SELECT * FROM jsonb_array_elements(json_data->'members')
  LOOP
    BEGIN
      -- 获取当前成员 ID
      SELECT id INTO v_member_id FROM members
      WHERE name = v_member->>'name' AND family_id = v_family_id AND is_deleted = FALSE;

      IF v_member_id IS NULL THEN CONTINUE; END IF;

      -- 查找父亲
      IF v_member->>'father_name' IS NOT NULL AND v_member->>'father_name' != '' THEN
        SELECT id INTO v_father_id FROM members
        WHERE name = v_member->>'father_name' AND family_id = v_family_id AND is_deleted = FALSE;
        IF v_father_id IS NOT NULL THEN
          UPDATE members SET father_id = v_father_id WHERE id = v_member_id;
        END IF;
      END IF;

      -- 查找母亲
      IF v_member->>'mother_name' IS NOT NULL AND v_member->>'mother_name' != '' THEN
        SELECT id INTO v_mother_id FROM members
        WHERE name = v_member->>'mother_name' AND family_id = v_family_id AND is_deleted = FALSE;
        IF v_mother_id IS NOT NULL THEN
          UPDATE members SET mother_id = v_mother_id WHERE id = v_member_id;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  -- 第三遍：INSERT spouses（双向）
  FOR v_spouse IN SELECT * FROM jsonb_array_elements(json_data->'spouses')
  LOOP
    BEGIN
      -- 获取 member_id
      SELECT id INTO v_spouse_member_id FROM members
      WHERE name = v_spouse->>'member_name' AND family_id = v_family_id AND is_deleted = FALSE;

      -- 获取 spouse_id
      SELECT id INTO v_spouse_id FROM members
      WHERE name = v_spouse->>'spouse_name' AND family_id = v_family_id AND is_deleted = FALSE;

      IF v_spouse_member_id IS NULL OR v_spouse_id IS NULL THEN CONTINUE; END IF;

      -- 正向插入
      INSERT INTO spouses (member_id, spouse_id, marriage_order, marriage_type)
      VALUES (
        v_spouse_member_id,
        v_spouse_id,
        COALESCE((v_spouse->>'marriage_order')::INT, 1),
        v_spouse->>'marriage_type'
      )
      ON CONFLICT (member_id, spouse_id) DO NOTHING;

      -- 反向插入（配偶方的顺序）
      INSERT INTO spouses (member_id, spouse_id, marriage_order, marriage_type)
      VALUES (
        v_spouse_id,
        v_spouse_member_id,
        COALESCE((v_spouse->>'reverse_order')::INT, 1),
        v_spouse->>'reverse_type'
      )
      ON CONFLICT (member_id, spouse_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  -- 第四遍：INSERT life_events
  FOR v_event IN SELECT * FROM jsonb_array_elements(COALESCE(json_data->'events', '[]'::JSONB))
  LOOP
    BEGIN
      SELECT id INTO v_member_id FROM members
      WHERE name = v_event->>'member_name' AND family_id = v_family_id AND is_deleted = FALSE;

      IF v_member_id IS NULL THEN CONTINUE; END IF;

      INSERT INTO life_events (member_id, event_type_label, event_title, year_display, year_sort, location, description, sort_order)
      VALUES (
        v_member_id,
        v_event->>'label',
        COALESCE(v_event->>'title', v_event->>'label'),
        v_event->>'year_display',
        NULLIF(v_event->>'year_sort', '')::INT,
        v_event->>'location',
        v_event->>'description',
        COALESCE((v_event->>'sort_order')::INT, 0)
      );
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped, 'errors', v_errors);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. 初始数据
-- ============================================================

INSERT INTO families (name, access_code, description)
VALUES ('廖氏家族', 'Wang2026', '永康公支系族谱')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. 管理员初始化（需替换为实际 user_id）
-- 用户通过 Magic Link 首次登录后，在 Supabase Dashboard 获取 user_id
-- 然后执行：
-- INSERT INTO admins (user_id, family_id)
-- VALUES ('<替换为实际UUID>', (SELECT id FROM families LIMIT 1));
-- ============================================================
