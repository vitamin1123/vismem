<template>
  <div class="performance-page">
    <van-nav-bar title="年度绩效详情" fixed placeholder />

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh" class="performance-content">
      <van-skeleton v-if="loading && !info" title avatar :row="5" class="skeleton-placeholder" />

      <van-empty v-if="!loading && !info" description="暂未查询到您的年度绩效数据" />

      <div v-if="info" v-motion-fade>
        <div class="user-card" v-motion-slide-visible-bottom>
          <div class="avatar">
            <span>{{ info.姓名?.slice(0, 1) ?? '' }}</span>
          </div>
          <div class="user-info">
            <div class="name">{{ info.姓名 ?? '未知姓名' }}</div>
            <div class="sub-info">{{ info.工号 ?? '-' }} · {{ info.公司职务职称 ?? '暂无职务' }}</div>
          </div>
        </div>

        <van-grid :column-num="2" :border="false" class="stats-grid" v-motion-slide-visible-bottom>
          <van-grid-item>
            <template #text>
              <div class="stat-value">{{ info.年度绩效考核分 ?? '-' }}</div>
              <div class="stat-label">年度绩效考评分</div>
            </template>
          </van-grid-item>
          <van-grid-item>
            <template #text>
              <div class="stat-value">{{ info.年度工作日 ?? '-' }}</div>
              <div class="stat-label">年度工作日</div>
            </template>
          </van-grid-item>
          <van-grid-item>
             <template #text>
              <div class="stat-value">{{ info.年度在岗日 ?? '-' }}</div>
              <div class="stat-label">年度在岗日</div>
            </template>
          </van-grid-item>
          <van-grid-item>
             <template #text>
              <div class="stat-value">{{ info.年度缺勤日 ?? '-' }}</div>
              <div class="stat-label">年度缺勤日</div>
            </template>
          </van-grid-item>
        </van-grid>

        <div v-motion-slide-visible-bottom>
          <van-tabs v-model:active="activeTab" class="details-tabs" line-width="20">
            <van-tab title="应发项目">
              <van-cell-group inset class="details-card">
                 <template v-if="payableItems.length > 0">
                    <van-cell
                      v-for="item in payableItems"
                      :key="item.label"
                      :title="item.label"
                      :value="formatCurrency(item.value)"
                    />
                 </template>
                 <van-empty v-else description="无应发项目" />
              </van-cell-group>
            </van-tab>
            <van-tab title="代扣代缴">
              <van-cell-group inset class="details-card">
                 <template v-if="deductionItems.length > 0">
                  <van-cell
                    v-for="item in deductionItems"
                    :key="item.label"
                    :title="item.label"
                    :value="formatValue(item.value)"
                  />
                 </template>
                 <van-empty v-else description="无代扣代缴项目" />
              </van-cell-group>
            </van-tab>
          </van-tabs>
        </div>

      </div>
    </van-pull-refresh>

    <div v-if="info" class="bottom-bar" v-motion-slide-visible-bottom>
      <span>实发绩效合计</span>
      <span class="money">¥{{ animatedFinalAmount.toFixed(2) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { showToast } from 'vant'
import { useTransition, TransitionPresets } from '@vueuse/core'
import { getAllYearEndBonus } from '@/api/bonus'
import type { YearEndBonusItem } from '@/types/bonus'

const info = ref<YearEndBonusItem | null>(null)
const loading = ref(false)
const refreshing = ref(false)
const activeTab = ref(0)

// --- 数据处理与格式化 (已是健壮的) ---

const formatCurrency = (value: any): string => {
  if (value === null || value === undefined) {
    return '-'
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-'
  }
  return `¥${value.toFixed(2)}`
}

const formatValue = (value: any): string => {
  if (value === null || value === undefined) {
    return '-'
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value === 0 ? '0' : formatCurrency(value)
  }
  return String(value)
}

const payableItems = computed(() => {
  if (!info.value) return []
  return [
    { label: '核定年薪', value: info.value.核定年薪 },
    { label: '协商年薪', value: info.value.应发年薪引进 },
    { label: '协商月薪', value: info.value.协商月薪 },
    { label: '年终奖', value: info.value.年终奖实发 },
    { label: '过节费', value: info.value.过节费 },
    { label: '超利奖', value: info.value.超利奖 },
    { label: '双降奖', value: info.value.双降奖 },
    { label: '技术创新奖', value: info.value.技术创新奖 },
  ]
})

const deductionItems = computed(() => {
  if (!info.value) return []
  return [
    { label: '病事假扣款', value: info.value.病事假扣款 },
    { label: '过失分考核', value: info.value.过失分考核 },
    { label: '得分考核', value: info.value.得分考核 },
    { label: '油卡', value: info.value.油卡 },
    { label: '音乐家酒', value: info.value.音乐家酒 },
    { label: '机票商务卡等费用', value: info.value.机票商务卡等费用 },
    { label: '上海代交规费', value: info.value.上海代交规费 },
    { label: '劳务公司代交规费', value: info.value.劳务公司代交规费 },
    { label: '个税', value: info.value.个税 },
  ]
})


// --- 动画效果 (已是健壮的) ---
const finalAmount = computed(() => info.value?.实发绩效 ?? 0)

const animatedFinalAmount = useTransition(finalAmount, {
  duration: 1200,
  transition: TransitionPresets.easeOutCubic,
})


// --- 数据加载 ---
async function loadData() {
  try {
    loading.value = true
    const res = await getAllYearEndBonus()
    info.value = res.data.data
  } catch (err) {
    console.error(err)
    showToast('数据加载失败，请稍后重试')
    info.value = null
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onRefresh() {
  activeTab.value = 0
  loadData()
}

loadData()
</script>

<style scoped>
:root {
  --primary-color: #007aff;
  --text-color: #333;
  --sub-text-color: #888;
  --bg-color: #f4f5f7;
  --card-bg: #ffffff;
  --accent-color: #ee0a24;
}

.performance-page {
  min-height: 100vh;
  background-color: var(--bg-color);
  padding-bottom: 80px; /* 为底部悬浮条留出空间 */
}

.performance-content {
  padding: 16px;
}

.skeleton-placeholder {
  padding: 16px;
  background-color: var(--card-bg);
  border-radius: 12px;
}

/* 用户卡片 */
.user-card {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, #4a90e2 0%, #007aff 100%);
  color: white;
  padding: 20px;
  border-radius: 16px;
  margin-bottom: 16px;
  box-shadow: 0 8px 16px rgba(0, 122, 255, 0.2);
}

.avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.2);
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 22px;
  font-weight: 600;
  margin-right: 16px;
  flex-shrink: 0;
}

.user-info .name {
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 4px;
}

.user-info .sub-info {
  font-size: 14px;
  opacity: 0.8;
}

/* 数据概览格 */
.stats-grid {
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.stats-grid .van-grid-item {
  background-color: var(--card-bg);
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--primary-color);
  margin-bottom: 6px;
}

.stat-label {
  font-size: 13px;
  color: var(--sub-text-color);
}

/* 详情Tabs */
.details-tabs {
  --van-tabs-line-height: 40px;
}
.details-tabs .van-tab {
  color: var(--sub-text-color);
}
.details-tabs .van-tab--active {
  color: var(--text-color);
}

.details-card {
  margin-top: 12px;
  margin-bottom: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  margin-left: 0;
  margin-right: 0;
}

/* 底部悬浮条 */
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--card-bg);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  padding-bottom: calc(16px + constant(safe-area-inset-bottom));
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
  font-size: 16px;
  font-weight: 500;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.06);
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
}

.money {
  font-size: 22px;
  font-weight: 700;
  color: var(--accent-color);
}

/* Vant组件样式覆盖 */
:deep(.van-cell-group--inset) {
  margin: 0;
  border-radius: 16px;
}

:deep(.van-cell) {
  padding-top: 14px;
  padding-bottom: 14px;
}

:deep(.van-cell__value) {
  font-weight: 500;
}
</style>