-- 002_phase2_upgrade.sql
-- Phase 2 增量迁移：在已有数据库上添加 spouses 表和新功能
-- 在 Supabase Dashboard → SQL Editor 中执行此脚本

-- ============================================================
-- 1. 新增 spouses 多配偶关联表
-- ============================================================

CREATE TABLE IF NOT EXISTS spouses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  spouse_id UUID REFERENCES members(id) ON DELETE CASCADE,
  marriage_order INT NOT NULL DEFAULT 1,
  marriage_type VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, spouse_id)
);

CREATE INDEX IF NOT EXISTS idx_spouses_member ON spouses(member_id);
CREATE INDEX IF NOT EXISTS idx_spouses_spouse ON spouses(spouse_id);

-- ============================================================
-- 2. 给 families 添加 root_member_id
-- ============================================================

ALTER TABLE families ADD COLUMN IF NOT EXISTS root_member_id UUID REFERENCES members(id) ON DELETE SET NULL;

-- ============================================================
-- 3. 给 members 添加 generation 字段
-- ============================================================

ALTER TABLE members ADD COLUMN IF NOT EXISTS generation INT;

-- ============================================================
-- 4. members 唯一索引（导入去重用）
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_name_family ON members(name, family_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);

-- ============================================================
-- 5. spouses RLS 策略
-- ============================================================

ALTER TABLE spouses ENABLE ROW LEVEL SECURITY;

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

-- ============================================================
-- 6. 确保 members 对 anon 可读（访问码门控在前端）
-- ============================================================

DROP POLICY IF EXISTS "允许已登录用户查看成员" ON members;
CREATE POLICY "允许任何人查看成员" ON members
FOR SELECT USING (true);

DROP POLICY IF EXISTS "允许登录用户新增" ON members;
CREATE POLICY "仅管理员可新增成员" ON members
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid() AND family_id = members.family_id)
);

-- 确保 families 对 anon 可读
DROP POLICY IF EXISTS "仅管理员可更新家族信息" ON families;
CREATE POLICY "允许任何人查看家族信息" ON families
FOR SELECT USING (true);
CREATE POLICY "仅管理员可更新家族信息" ON families
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid() AND family_id = families.id)
);

-- ============================================================
-- 7. 更新 RPC 函数
-- ============================================================

-- 访问码验证（单家族模式，无需 family_id）
CREATE OR REPLACE FUNCTION validate_access_code(input_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE stored_code TEXT;
BEGIN
  SELECT access_code INTO stored_code FROM families LIMIT 1;
  IF stored_code IS NULL THEN RETURN FALSE; END IF;
  RETURN stored_code = input_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取家族信息（含 root_member_id）
CREATE OR REPLACE FUNCTION get_family_info()
RETURNS TABLE (name VARCHAR, description TEXT, admin_contact VARCHAR, root_member_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT f.name, f.description, f.admin_contact, f.root_member_id
  FROM families f
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 事务性批量导入
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
BEGIN
  SELECT id INTO v_family_id FROM families LIMIT 1;
  IF v_family_id IS NULL THEN
    RETURN jsonb_build_object('inserted', 0, 'skipped', 0, 'errors', 1, 'error_message', '未找到家族记录');
  END IF;

  -- 第一遍：INSERT members
  FOR v_member IN SELECT * FROM jsonb_array_elements(json_data->'members')
  LOOP
    BEGIN
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
      SELECT id INTO v_member_id FROM members
      WHERE name = v_member->>'name' AND family_id = v_family_id AND is_deleted = FALSE;
      IF v_member_id IS NULL THEN CONTINUE; END IF;

      IF v_member->>'father_name' IS NOT NULL AND v_member->>'father_name' != '' THEN
        SELECT id INTO v_father_id FROM members
        WHERE name = v_member->>'father_name' AND family_id = v_family_id AND is_deleted = FALSE;
        IF v_father_id IS NOT NULL THEN
          UPDATE members SET father_id = v_father_id WHERE id = v_member_id;
        END IF;
      END IF;

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
      SELECT id INTO v_spouse_member_id FROM members
      WHERE name = v_spouse->>'member_name' AND family_id = v_family_id AND is_deleted = FALSE;
      SELECT id INTO v_spouse_id FROM members
      WHERE name = v_spouse->>'spouse_name' AND family_id = v_family_id AND is_deleted = FALSE;

      IF v_spouse_member_id IS NULL OR v_spouse_id IS NULL THEN CONTINUE; END IF;

      INSERT INTO spouses (member_id, spouse_id, marriage_order, marriage_type)
      VALUES (v_spouse_member_id, v_spouse_id, COALESCE((v_spouse->>'marriage_order')::INT, 1), v_spouse->>'marriage_type')
      ON CONFLICT (member_id, spouse_id) DO NOTHING;

      INSERT INTO spouses (member_id, spouse_id, marriage_order, marriage_type)
      VALUES (v_spouse_id, v_spouse_member_id, COALESCE((v_spouse->>'reverse_order')::INT, 1), v_spouse->>'reverse_type')
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
        v_member_id, v_event->>'label', COALESCE(v_event->>'title', v_event->>'label'),
        v_event->>'year_display', NULLIF(v_event->>'year_sort', '')::INT,
        v_event->>'location', v_event->>'description', COALESCE((v_event->>'sort_order')::INT, 0)
      );
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped, 'errors', v_errors);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 完成！执行后请验证：
-- SELECT count(*) FROM spouses;  -- 应为 0（待导入）
-- SELECT root_member_id FROM families;  -- 应为 NULL（待设置）
-- ============================================================
