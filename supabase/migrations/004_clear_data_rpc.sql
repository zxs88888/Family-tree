-- 004_clear_data_rpc.sql
-- 新增清空家族数据的 RPC 函数（用于重新导入前清空，避免数据累积污染）
-- 在 Supabase Dashboard → SQL Editor 中执行

CREATE OR REPLACE FUNCTION clear_family_data()
RETURNS JSONB AS $$
DECLARE
  v_family_id UUID;
  v_members INT;
BEGIN
  SELECT id INTO v_family_id FROM families LIMIT 1;
  IF v_family_id IS NULL THEN
    RETURN jsonb_build_object('deleted', 0, 'error_message', '未找到家族记录');
  END IF;

  -- 按外键依赖顺序删除
  DELETE FROM member_media WHERE member_id IN (SELECT id FROM members WHERE family_id = v_family_id);
  DELETE FROM life_events WHERE member_id IN (SELECT id FROM members WHERE family_id = v_family_id);
  DELETE FROM spouses WHERE member_id IN (SELECT id FROM members WHERE family_id = v_family_id);

  SELECT count(*) INTO v_members FROM members WHERE family_id = v_family_id;
  DELETE FROM members WHERE family_id = v_family_id;

  -- 重置根节点
  UPDATE families SET root_member_id = NULL WHERE id = v_family_id;

  RETURN jsonb_build_object('deleted', v_members);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 验证：SELECT clear_family_data();  -- 会返回 {"deleted": N}
