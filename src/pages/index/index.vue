<template>
  <view class="page">
    <view class="placeholder">
      <text class="title">家族族谱</text>
      <text class="subtitle">加载中...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
</script>

<style lang="scss">
.page {
  min-height: 100vh;
  background: #faf6ef;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder {
  text-align: center;
}

.title {
  display: block;
  font-size: 24px;
  font-weight: bold;
  color: #2b2622;
  font-family: serif;
}

.subtitle {
  display: block;
  font-size: 14px;
  color: #a89c87;
  margin-top: 8px;
  font-family: serif;
}
</style>
