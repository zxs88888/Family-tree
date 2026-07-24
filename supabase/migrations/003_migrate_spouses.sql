-- 003_migrate_spouses.sql
-- 将旧 spouse_id 字段的配偶关系迁移到新的 spouses 关联表
-- 在 Supabase Dashboard → SQL Editor 中执行

-- ============================================================
-- 清空 spouses 表（确保幂等，可重复执行）
-- ============================================================
DELETE FROM spouses;

-- ============================================================
-- 永康的四位妻子（按婚配顺序：元配→末配）
-- 永康 id: 10bdbc7e-a9cc-4c64-bfd9-0a1efe7296f2
-- ============================================================
-- 陈氏（元配）
INSERT INTO spouses (member_id, spouse_id, marriage_order, marriage_type)
SELECT m.id, m.spouse_id, 1, '元配' FROM members m WHERE m.name = '陈氏' AND m.spouse_id IS NOT NULL;
INSERT INTO spouses (member_id, spouse_id, marriage_order, marriage_type)
SELECT m.spouse_id, m.id, 1, '元配' FROM members m WHERE m.name = '陈氏' AND m.spouse_id IS NOT NULL;

-- 唐氏（次配）
INSERT INTO spouses (member_id, spouse_id, marriage_order, marriage_type)
SELECT m.id, m.spouse_id, 2, '次配' FROM members m WHERE m.name = '唐氏' AND m.spouse_id IS NOT NULL;
INSERT INTO spouses (member_id, spouse_id, marriage_order, marriage_type)
SELECT m.spouse_id, m.id, 1, '次配' FROM members m WHERE m.name = '唐氏' AND m.spouse_id IS NOT NULL;

-- 徐氏（三配）
INSERT INTO spouses (member_id, spouse_id, marriage_order, marriage_type)
SELECT m.id, m.spouse_id, 3, '三配' FROM members m WHERE m.name = '徐氏' AND m.spouse_id IS NOT NULL;
INSERT INTO spouses (member_id, spouse_id, marriage_order, marriage_type)
SELECT m.spouse_id, m.id, 1, '三配' FROM members m WHERE m.name = '徐氏' AND m.spouse_id IS NOT NULL;

-- 肖氏（末配）
INSERT INTO spouses (member_id, spouse_id, marriage_order, marriage_type)
SELECT m.id, m.spouse_id, 4, '末配' FROM members m WHERE m.name = '肖氏' AND m.spouse_id IS NOT NULL;
INSERT INTO spouses (member_id, spouse_id, marriage_order, marriage_type)
SELECT m.spouse_id, m.id, 1, '末配' FROM members m WHERE m.name = '肖氏' AND m.spouse_id IS NOT NULL;

-- ============================================================
-- 树炎的两位妻子（元配杨氏，继配万氏）
-- ============================================================
-- 杨氏（元配）
INSERT INTO spouses (member_id, spouse_id, marriage_order, marriage_type)
SELECT m.id, m.spouse_id, 1, '元配' FROM members m WHERE m.name = '杨氏' AND m.spouse_id IS NOT NULL;
INSERT INTO spouses (member_id, spouse_id, marriage_order, marriage_type)
SELECT m.spouse_id, m.id, 1, '元配' FROM members m WHERE m.name = '杨氏' AND m.spouse_id IS NOT NULL;

-- 万氏（继配）
INSERT INTO spouses (member_id, spouse_id, marriage_order, marriage_type)
SELECT m.id, m.spouse_id, 2, '继配' FROM members m WHERE m.name = '万氏' AND m.spouse_id IS NOT NULL;
INSERT INTO spouses (member_id, spouse_id, marriage_order, marriage_type)
SELECT m.spouse_id, m.id, 1, '继配' FROM members m WHERE m.name = '万氏' AND m.spouse_id IS NOT NULL;

-- ============================================================
-- 单配偶夫妻（双向 order=1）
-- ============================================================
-- 熙涵 ↔ 夏凡
INSERT INTO spouses (member_id, spouse_id, marriage_order, marriage_type)
SELECT m.id, m.spouse_id, 1, '元配' FROM members m WHERE m.name = '熙涵' AND m.spouse_id IS NOT NULL;
INSERT INTO spouses (member_id, spouse_id, marriage_order, marriage_type)
SELECT m.spouse_id, m.id, 1, '元配' FROM members m WHERE m.name = '熙涵' AND m.spouse_id IS NOT NULL;

-- 树森 ↔ 葛金莲
INSERT INTO spouses (member_id, spouse_id, marriage_order, marriage_type)
SELECT m.id, m.spouse_id, 1, '元配' FROM members m WHERE m.name = '树森' AND m.spouse_id IS NOT NULL;
INSERT INTO spouses (member_id, spouse_id, marriage_order, marriage_type)
SELECT m.spouse_id, m.id, 1, '元配' FROM members m WHERE m.name = '树森' AND m.spouse_id IS NOT NULL;

-- 熙妮 ↔ 熊烨
INSERT INTO spouses (member_id, spouse_id, marriage_order, marriage_type)
SELECT m.id, m.spouse_id, 1, '元配' FROM members m WHERE m.name = '熙妮' AND m.spouse_id IS NOT NULL;
INSERT INTO spouses (member_id, spouse_id, marriage_order, marriage_type)
SELECT m.spouse_id, m.id, 1, '元配' FROM members m WHERE m.name = '熙妮' AND m.spouse_id IS NOT NULL;

-- ============================================================
-- 验证：应返回 22 行（11 对夫妻 × 2 方向）
-- ============================================================
-- SELECT count(*) FROM spouses;
-- SELECT m1.name AS member, m2.name AS spouse, s.marriage_order, s.marriage_type
-- FROM spouses s
-- JOIN members m1 ON m1.id = s.member_id
-- JOIN members m2 ON m2.id = s.spouse_id
-- ORDER BY m1.name, s.marriage_order;
