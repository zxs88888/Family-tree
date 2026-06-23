<template>
  <view class="skeleton-loader">
    <view class="skeleton-circle skeleton-shimmer"></view>
    <view class="skeleton-line w-60 skeleton-shimmer"></view>
    <view class="skeleton-line w-80 skeleton-shimmer"></view>
    <view class="skeleton-line w-40 skeleton-shimmer"></view>
    <view class="skeleton-line w-70 skeleton-shimmer"></view>
  </view>
</template>

<style>
.skeleton-loader {
  padding: var(--spacing-lg);
}
.skeleton-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  margin: var(--spacing-lg) auto;
}
.skeleton-line {
  height: 16px;
  border-radius: var(--radius-sm);
  margin: var(--spacing-sm) 0;
}
.w-60 {
  width: 60%;
}
.w-80 {
  width: 80%;
}
.w-40 {
  width: 40%;
}
.w-70 {
  width: 70%;
}
</style>
