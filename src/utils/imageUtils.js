import { supabase } from './supabase'

const AVATAR_BUCKET = 'avatars'
const PHOTO_BUCKET = 'family_photos'
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function validateImage(file) {
  if (file.size > MAX_SIZE) {
    throw new Error(`图片超过 10MB 限制：${(file.size / 1024 / 1024).toFixed(1)}MB`)
  }
  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`不支持的图片格式：${file.type}，支持 JPG/PNG/WEBP`)
  }
}

export function generateStoragePath(memberId, eventId, fileName) {
  const timestamp = Date.now()
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${memberId}/${eventId}/${timestamp}_${safeName}`
}

export function extractStoragePath(mediaUrl) {
  const match = mediaUrl.match(/\/family_photos\/(.+)$/)
  return match ? match[1] : null
}

export async function uploadImage(memberId, eventId, tempFilePath, fileName) {
  const path = generateStoragePath(memberId, eventId, fileName)

  // H5 上 tempFilePath 是 blob URL，需转为 Blob 再上传
  const response = await fetch(tempFilePath)
  const blob = await response.blob()

  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, {
      cacheControl: '3600',
      upsert: false,
      contentType: blob.type || 'image/jpeg',
    })
  if (error) throw error

  const { data: { publicUrl } } = supabase.storage
    .from(PHOTO_BUCKET)
    .getPublicUrl(path)

  return { path, publicUrl }
}

export async function deleteImage(path) {
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .remove([path])
  if (error) throw error
}

export function getThumbnailUrl(mediaUrl, width = 150) {
  return `${mediaUrl}?width=${width}&height=${width}`
}

export async function chooseImages(count = 9) {
  return new Promise((resolve, reject) => {
    uni.chooseImage({
      count,
      sizeType: ['original'],
      sourceType: ['album', 'camera'],
      success: (res) => resolve(res),
      fail: reject,
    })
  })
}
