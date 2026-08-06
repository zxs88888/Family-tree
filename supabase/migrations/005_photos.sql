-- 005_photos.sql
-- 照片功能：创建 Storage bucket + 访问策略
-- 用法：在 Supabase SQL Editor 执行

-- 1. 创建公开照片桶
INSERT INTO storage.buckets (id, name, public)
VALUES ('family_photos', 'family_photos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. 任何人可查看照片（公开桶）
CREATE POLICY "任何人可查看家族照片" ON storage.objects
FOR SELECT USING (bucket_id = 'family_photos');

-- 3. 仅管理员可上传照片（路径约定：{member_id}/{文件名}）
CREATE POLICY "仅管理员可上传照片" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'family_photos'
  AND EXISTS (
    SELECT 1 FROM admins
    WHERE admins.user_id = auth.uid()
      AND admins.family_id = (
        SELECT family_id FROM members
        WHERE id = (storage.foldername(name))[1]::uuid
      )
  )
);

-- 4. 仅管理员可删除照片
CREATE POLICY "仅管理员可删除照片" ON storage.objects
FOR DELETE USING (
  bucket_id = 'family_photos'
  AND EXISTS (
    SELECT 1 FROM admins
    WHERE admins.user_id = auth.uid()
      AND admins.family_id = (
        SELECT family_id FROM members
        WHERE id = (storage.foldername(name))[1]::uuid
      )
  )
);
