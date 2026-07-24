-- 005_smart_merge.sql
-- 智能合并导入：已有成员更新信息（不重复插入），关系按姓名重连，事件去重
-- 支持多支脉系分批增量导入，自动挂到共同祖先
-- 在 Supabase Dashboard → SQL Editor 中执行

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
  v_updated INT := 0;
  v_errors INT := 0;
  v_new_bio TEXT;
BEGIN
  SELECT id INTO v_family_id FROM families LIMIT 1;
  IF v_family_id IS NULL THEN
    RETURN jsonb_build_object('inserted', 0, 'updated', 0, 'errors', 1, 'error_message', '未找到家族记录');
  END IF;

  -- 第一遍：UPSERT members（新成员插入，已有成员更新信息）
  FOR v_member IN SELECT * FROM jsonb_array_elements(json_data->'members')
  LOOP
    BEGIN
      SELECT id INTO v_member_id FROM members
      WHERE name = v_member->>'name' AND family_id = v_family_id AND is_deleted = FALSE;

      IF v_member_id IS NOT NULL THEN
        -- 已存在：用新数据更新（仅覆盖非空字段，实现智能合并）
        v_new_bio := v_member->>'biography';
        UPDATE members SET
          gender = COALESCE((v_member->>'gender')::INT, gender),
          birth_year = COALESCE(NULLIF(v_member->>'birth_year', '')::INT, birth_year),
          death_year = COALESCE(NULLIF(v_member->>'death_year', '')::INT, death_year),
          is_alive = COALESCE((v_member->>'is_alive')::BOOLEAN, is_alive),
          biography = CASE WHEN v_new_bio IS NOT NULL AND v_new_bio != '' THEN v_new_bio ELSE biography END,
          updated_at = NOW()
        WHERE id = v_member_id;
        v_updated := v_updated + 1;
      ELSE
        -- 新成员：插入
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
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  -- 第二遍：按姓名重连 father_id / mother_id（跨支脉系自动连接到共同祖先）
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

  -- 第三遍：UPSERT spouses（双向，冲突时更新婚配顺序/类型）
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
      ON CONFLICT (member_id, spouse_id) DO UPDATE SET
        marriage_order = EXCLUDED.marriage_order,
        marriage_type = EXCLUDED.marriage_type;

      INSERT INTO spouses (member_id, spouse_id, marriage_order, marriage_type)
      VALUES (v_spouse_id, v_spouse_member_id, COALESCE((v_spouse->>'reverse_order')::INT, 1), v_spouse->>'reverse_type')
      ON CONFLICT (member_id, spouse_id) DO UPDATE SET
        marriage_order = EXCLUDED.marriage_order,
        marriage_type = EXCLUDED.marriage_type;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  -- 第四遍：INSERT life_events（按 成员+年份+标签 去重，防止重复导入）
  FOR v_event IN SELECT * FROM jsonb_array_elements(COALESCE(json_data->'events', '[]'::JSONB))
  LOOP
    BEGIN
      SELECT id INTO v_member_id FROM members
      WHERE name = v_event->>'member_name' AND family_id = v_family_id AND is_deleted = FALSE;
      IF v_member_id IS NULL THEN CONTINUE; END IF;

      -- 去重检查
      IF EXISTS (
        SELECT 1 FROM life_events
        WHERE member_id = v_member_id
          AND year_sort = NULLIF(v_event->>'year_sort', '')::INT
          AND event_type_label = v_event->>'label'
      ) THEN
        CONTINUE;
      END IF;

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

  RETURN jsonb_build_object('inserted', v_inserted, 'updated', v_updated, 'errors', v_errors);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
