<template>
  <view class="gallery-view">
    <view class="gallery-header">
      <text class="gallery-back" @click="$emit('close')">← 返回</text>
      <text class="gallery-title">{{ memberName }} 的照片</text>
      <view class="gallery-header-actions">
        <text v-if="images.length > 0" class="gallery-save-all" @click="openPreview(0)">💾 保存</text>
        <text class="gallery-count">{{ images.length }} 张</text>
      </view>
    </view>

    <scroll-view class="gallery-grid">
      <view v-if="images.length === 0" class="gallery-empty">
        <text>这位成员暂无历史照片，欢迎补充。</text>
      </view>
      <view v-else class="grid">
        <view v-for="(img, i) in images" :key="img.id" class="grid-item" @click="openPreview(i)">
          <image :src="img.media_url + '?width=150&height=150'" mode="aspectFill" class="grid-thumb" />
          <view class="grid-overlay">
            <text class="grid-year">{{ img.year || '' }}</text>
            <text class="grid-title">{{ img.title || '' }}</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
const props = defineProps({
  memberName: { type: String, default: '' },
  images: { type: Array, default: () => [] },
})

const emit = defineEmits(['close'])

function openPreview(index) {
  const urls = props.images.map(img => img.media_url)
  uni.previewImage({
    urls,
    current: index,
    indicator: 'number',
    longPressActions: {
      itemList: ['保存图片'],
      success: (res) => {
        if (res.tapIndex === 0) saveImage(urls[index])
      },
    },
  })
}

function saveImage(url) {
  uni.showLoading({ title: '保存中...' })
  uni.downloadFile({
    url,
    success: (downloadRes) => {
      uni.saveImageToPhotosAlbum({
        filePath: downloadRes.tempFilePath,
        success: () => {
          uni.hideLoading()
          uni.showToast({ title: '保存成功', icon: 'success' })
        },
        fail: () => {
          uni.hideLoading()
          uni.showToast({ title: '保存失败，请在相册中查看', icon: 'none' })
        },
      })
    },
    fail: () => {
      uni.hideLoading()
      uni.showToast({ title: '下载失败，请检查网络', icon: 'none' })
    },
  })
}
</script>

<style>
.gallery-view {
  position: fixed; inset: 0; background: #1a1a1a; z-index: 500;
  display: flex; flex-direction: column;
}
.gallery-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  padding-top: calc(env(safe-area-inset-top) + var(--spacing-md));
  background: rgba(0,0,0,0.3);
}
.gallery-back { color: #fff; font-size: var(--font-size-md); min-width: 48px; min-height: 48px; display: flex; align-items: center; }
.gallery-title { color: #fff; font-size: var(--font-size-md); font-weight: bold; }
.gallery-header-actions { display: flex; align-items: center; gap: var(--spacing-sm); }
.gallery-save-all { color: #fff; font-size: var(--font-size-sm); min-width: 48px; min-height: 48px; display: flex; align-items: center; }
.gallery-count { color: rgba(255,255,255,0.6); font-size: var(--font-size-sm); }
.gallery-grid { flex: 1; overflow-y: auto; padding: var(--spacing-sm); }
.gallery-empty {
  display: flex; align-items: center; justify-content: center;
  min-height: 60vh; color: rgba(255,255,255,0.4); font-size: var(--font-size-md);
}
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.grid-item { position: relative; aspect-ratio: 1; overflow: hidden; border-radius: 4px; }
.grid-thumb { width: 100%; height: 100%; }
.grid-overlay {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: linear-gradient(transparent, rgba(0,0,0,0.7));
  padding: 4px; opacity: 0; transition: opacity 0.2s;
}
.grid-item:active .grid-overlay { opacity: 1; }
.grid-year { color: var(--accent-gold); font-size: 11px; display: block; }
.grid-title { color: #fff; font-size: 11px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
