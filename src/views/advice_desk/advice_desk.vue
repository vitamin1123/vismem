<template>
  <div class="advice-management">
    <!-- 顶部区域：统计卡片和词云 -->
    <div class="top-section">
      <!-- 左侧统计卡片（竖向） -->
      <div class="stat-cards-vertical">
        <t-card :bordered="false" hover-shadow>
          <div class="stat-item">
            <trending-up-icon class="stat-icon" />
            <div class="stat-content">
              <div class="stat-value">{{ statistics.total }}</div>
              <div class="stat-label">总建议数</div>
            </div>
          </div>
        </t-card>
        
        <t-card :bordered="false" hover-shadow>
          <div class="stat-item">
            <shop-3-icon class="stat-icon" />
            <div class="stat-content">
              <div class="stat-value">{{ statistics.canteen }}</div>
              <div class="stat-label">食堂建议</div>
            </div>
          </div>
        </t-card>
        
        <t-card :bordered="false" hover-shadow>
          <div class="stat-item">
            <user-talk-icon class="stat-icon" />
            <div class="stat-content">
              <div class="stat-value">{{ statistics.recent }}</div>
              <div class="stat-label">近7天建议</div>
            </div>
          </div>
          <div class="line-chart-container">
            <div ref="lineChartRef" style="height: 120px; width: 100%;"></div>
          </div>
        </t-card>
      </div>

      <!-- 右侧词云图 -->
      <t-card title="建议热点分布" class="word-cloud-card">
        <template #actions>
          <t-space>
            <t-radio-group v-model="wordCloudType" @change="changeWordCloudType">
              <t-radio-button value="recent">最近七天</t-radio-button>
              <t-radio-button value="all">历史全部</t-radio-button>
            </t-radio-group>
            <t-button variant="text" shape="square" @click="refreshWordCloud">
              <refresh-icon />
            </t-button>
          </t-space>
        </template>
        
        <div class="word-cloud-container">
          <div ref="wordCloudChartRef" style="height: 300px; width: 100%;"></div>
          <div v-if="!hasWordCloudData" class="empty-word-cloud">
            <folder-icon size="3x" />
            <p>暂无词云数据</p>
          </div>
        </div>
      </t-card>
    </div>

    <!-- 建议明细表格 -->
    <t-card title="建议明细" class="table-card">
      <!-- 过滤条件 -->
      <div class="filter-row">
      <div class="filter-group">
        <t-select 
          v-model="filter.category" 
          placeholder="全部类别" 
          clearable
          @change="handleCategoryChange"
        >
          <t-option v-for="item in categoryOptions" :key="item.value" :value="item.value" :label="item.label" />
        </t-select>
        
        <t-date-range-picker
          v-model="filter.dateRange"
          placeholder="选择时间范围"
          clearable
        />
        
        <t-input v-model="filter.keyword" placeholder="搜索关键词" clearable>
          <template #suffix-icon>
            <search-icon />
          </template>
        </t-input>
      </div>
      
      <t-button theme="primary" @click="loadData">
        查询
      </t-button>
    </div>
      
      <t-table
        :data="adviceList"
        :columns="columns"
        row-key="id"
        :pagination="pagination"
        :loading="loading"
        hover
        @page-change="onPageChange"
      >
        <template #category="{ row }">
          <div class="category-cell">
            <t-tag :theme="getCategoryTheme(row.category) as 'warning' | 'primary' | 'success' | 'default' | 'danger'" variant="light">
              {{ categoryMap[row.category as keyof typeof categoryMap] || row.category }}
            </t-tag>
            <div v-if="row.canteen" class="canteen-tag">
              {{ canteenMap[row.canteen as keyof typeof canteenMap] || row.canteen }}
            </div>
          </div>
        </template>
        
        <template #suggestion="{ row }">
          <div class="suggestion-content">
            <div class="suggestion-text">{{ row.suggestion }}</div>
            <div v-if="row.photos" class="suggestion-images">
              <t-image
                v-for="(photo, index) in row.photos.split('|')"
                :key="index"
                :src="`/api/get_image?filename=${photo}`"
                fit="cover"
                :lazy="true"
                :preview="true"
                :gallery="true"
              >
                <template #overlayContent>
                  <div class="image-overlay">
                    <zoom-in-icon />
                  </div>
                </template>
              </t-image>
            </div>
          </div>
        </template>
        
        <template #expectReply="{ row }">
          <t-tag :theme="row.expectReply ? 'success' : 'default'" variant="light">
            {{ row.expectReply ? '是' : '否' }}
          </t-tag>
        </template>
        
        <template #status="{ row }">
          <t-tag :theme="statusThemeMap[row.status as keyof typeof statusThemeMap]" variant="light">
            {{ statusMap[row.status as keyof typeof statusMap] }}
          </t-tag>
        </template>
        
        <template #createdAt="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
        
        <template #op="{ row }">
          <t-space>
            <t-button size="small" variant="outline" @click="showDetail(row)">
              详情
            </t-button>
            <!-- <t-button size="small" theme="danger" variant="outline" @click="confirmDelete(row)">
              删除
            </t-button> -->
          </t-space>
        </template>
      </t-table>
    </t-card>

    <!-- 详情抽屉 -->
    <t-drawer
      v-model:visible="detailVisible"
      :header="'建议详情'"
      size="50%"
      :on-confirm="handleDetailConfirm"
    >
      <div v-if="currentDetail" class="detail-container">
        <div class="detail-section">
          <div class="detail-label">问题类别</div>
          <div class="detail-value">
            <div class="category-cell">
              <t-tag :theme="getCategoryTheme(currentDetail.category)" variant="light">
                {{ categoryMap[currentDetail.category as keyof typeof categoryMap] || currentDetail.category }}
              </t-tag>
              <div v-if="currentDetail.canteen" class="canteen-tag">
                {{ canteenMap[currentDetail.canteen as keyof typeof canteenMap] || currentDetail.canteen }}
              </div>
            </div>
          </div>
        </div>
        
        <div class="detail-section">
          <div class="detail-label">具体说明</div>
          <div class="detail-value suggestion-text">{{ currentDetail.suggestion }}</div>
        </div>
        
        <div v-if="currentDetail.photos" class="detail-section">
          <div class="detail-label">上传图片</div>
          <div class="detail-value">
            <div class="detail-images">
              <t-image
                v-for="(photo, index) in (currentDetail?.photos ? currentDetail.photos.split('|') : [])"
                :key="index"
                :src="`/api/get_image?filename=${photo}`"
                fit="cover"
                :lazy="true"
                class="detail-image"
                :preview="true"
                :gallery="true"
              >
                <template #overlayContent>
                  <div class="image-overlay">
                    <zoom-in-icon />
                  </div>
                </template>
              </t-image>
            </div>
          </div>
        </div>
        
        <div class="detail-row">
          <div class="detail-col">
            <div class="detail-label">是否期望回复</div>
            <div class="detail-value">{{ currentDetail.expectReply ? '是' : '否' }}</div>
          </div>
          
          <div class="detail-col">
            <div class="detail-label">提交时间</div>
            <div class="detail-value">{{ formatDate(currentDetail.createdAt, true) }}</div>
          </div>
        </div>
        
        <div v-if="currentDetail.expectReply" class="detail-row">
          <div class="detail-col">
            <div class="detail-label">工号</div>
            <div class="detail-value">{{ currentDetail.employeeId }}</div>
          </div>
          
          <div class="detail-col">
            <div class="detail-label">姓名</div>
            <div class="detail-value">{{ currentDetail.employeeName }}</div>
          </div>
        </div>
        
        <div v-if="currentDetail.expectReply" class="detail-section">
          <div class="detail-label">联系方式</div>
          <div class="detail-value">{{ currentDetail.contactInfo }}</div>
        </div>
        
        <div class="detail-section">
          <div class="detail-label">处理状态</div>
          <div class="detail-value">
            <t-select v-model="currentDetail.status" class="status-select">
              <t-option v-for="(label, value) in statusMap" :key="value" :value="value" :label="label" />
            </t-select>
          </div>
        </div>
        
        <div class="detail-section">
          <div class="detail-label">处理备注</div>
          <div class="detail-value">
            <t-textarea v-model="currentDetail.processNote" placeholder="请输入处理备注" />
          </div>
        </div>
      </div>
    </t-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, onBeforeUnmount, computed } from 'vue';
import * as echarts from 'echarts';
import 'echarts-wordcloud';
import {
  Card as TCard,
  Tag as TTag,
  Table as TTable,
  Select as TSelect,
  Option as TOption,
  Button as TButton,
  Input as TInput,
  DateRangePicker as TDateRangePicker,
  Drawer as TDrawer,
  Image as TImage,
  Textarea as TTextarea,
  MessagePlugin,
  DialogPlugin,
  type PageInfo
} from 'tdesign-vue-next';
import { 
  Shop3Icon, 
  SearchIcon, 
  TrendingUpIcon, 
  UserTalkIcon, 
  FolderIcon,
  ZoomInIcon
} from 'tdesign-icons-vue-next';
// 直接在当前文件中定义类型,无需从外部导入
import apiClient from '@/plugins/axios';
import dayjs from 'dayjs';

// 类型定义
interface AdviceItem {
  id: string;
  category: string;
  canteen?: string;
  suggestion: string;
  expectReply: boolean;
  employeeId?: string;
  employeeName?: string;
  contactInfo?: string;
  photos?: string;
  createdAt: string;
  status: string;
  processNote?: string;
}

interface WordCloudItem {
  name: string;
  value: number;
}

interface Statistics {
  total: number;
  canteen: number;
  recent: number;
  processed: number;
}

// 数据初始化
const adviceList = ref<AdviceItem[]>([]);
const wordCloudData = ref<{ recent: WordCloudItem[]; all: WordCloudItem[] }>({
  recent: [],
  all: []
});
// 计算属性：是否有词云数据
const hasWordCloudData = computed(() => {
  const data = wordCloudData.value[wordCloudType.value];
  return data && data.length > 0;
});

// 切换词云类型
const changeWordCloudType = () => {
  renderWordCloud();
};
// 渲染词云图
const renderWordCloud = () => {
  if (!wordCloudChart.value || !wordCloudChartRef.value) return;
  
  const data = wordCloudData.value[wordCloudType.value] || [];
  
  const option = {
    tooltip: {
      show: true,
      formatter: function (params: any) {
        return `${params.name}: ${params.value}`;
      }
    },
    series: [{
      type: 'wordCloud',
      shape: 'circle',
      left: 'center',
      top: 'center',
      width: '100%',
      height: '100%',
      right: null,
      bottom: null,
      sizeRange: [12, 60],
      rotationRange: [0, 0],
      rotationStep: 45,
      gridSize: 8,
      drawOutOfBound: false,
      textStyle: {
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
        color: function () {
          return 'rgb(' + [
            Math.round(Math.random() * 160),
            Math.round(Math.random() * 160),
            Math.round(Math.random() * 160)
          ].join(',') + ')';
        }
      },
      emphasis: {
        focus: 'self',
        textStyle: {
          shadowBlur: 10,
          shadowColor: '#333'
        }
      },
      data: data.map(item => ({
        name: item.name,
        value: item.value
      }))
    }]
  };
  
  wordCloudChart.value.setOption(option);
};
const wordCloudType = ref<'recent' | 'all'>('recent');
const wordCloudChart = ref<echarts.ECharts | null>(null);
const wordCloudChartRef = ref<HTMLElement | null>(null);

const statistics = ref<Statistics>({ total: 0, canteen: 0, recent: 0, processed: 0 });
const loading = ref(false);
const detailVisible = ref(false);
const currentDetail = ref<AdviceItem | null>(null);
type CategoryTheme = 'default' | 'primary' | 'warning' | 'danger' | 'success';
// 分类映射
const categoryMap = {
  work_environment: '工作环境',
  communication: '部门沟通',
  salary_benefits: '薪资福利',
  culture: '企业文化',
  canteen: '食堂餐饮',
  dormitory: '宿舍服务',
  other: '其他'
};

const canteenMap = {
  main_building_large: '大楼食堂大餐厅',
  main_building_small: '大楼食堂小餐厅',
  south: '南食堂',
  living_area: '生活区食堂',
  zhongzhou_employee: '中舟食堂员工餐厅',
  zhongzhou_owner: '中舟食堂船东餐厅'
};

const statusMap = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决',
  closed: '已关闭'
};

const statusThemeMap: Record<string, 'default' | 'primary' | 'warning' | 'danger' | 'success'> = {
  pending: 'warning',
  processing: 'primary',
  resolved: 'success',
  closed: 'default'
};

// 分类选项
const categoryOptions = Object.entries(categoryMap).map(([value, label]) => ({
  value,
  label
}));

// 筛选条件
const filter = ref({
  category: '',
  dateRange: [] as (string | Date)[],
  keyword: ''
});

// 分页配置
const pagination = ref({
  current: 1,
  pageSize: 10,
  total: 0
});

// 表格列配置
const columns = [
  {
    colKey: 'category',
    title: '问题类别',
    width: 180,
    cell: 'category',
    align: 'left' as const
  },
  {
    colKey: 'suggestion',
    title: '具体说明',
    cell: 'suggestion',
    align: 'left' as const
  },
  {
    colKey: 'expectReply',
    title: '期望回复',
    width: 100,
    align: 'center' as const,
    cell: 'expectReply'
  },
  {
    colKey: 'status',
    title: '处理状态',
    width: 120,
    align: 'center' as const,
    cell: 'status'
  },
  {
    colKey: 'createdAt',
    title: '提交时间',
    width: 180,
    cell: 'createdAt',
    align: 'left' as const
  },
  {
    colKey: 'op',
    title: '操作',
    width: 150,
    align: 'center' as const,
    cell: 'op'
  }
];

const handleCategoryChange = (value: any) => {
  // 重置到第一页
  pagination.value.current = 1;
  // 更新筛选值
  filter.value.category = value;
  // 触发数据加载
  loadData();
};

// 折线图实例
let lineChart: echarts.ECharts | null = null;
const lineChartRef = ref<HTMLElement | null>(null);

// 折线图数据
const trendData = ref<{ date: string; count: number }[]>([]);

// 初始化折线图
const initLineChart = () => {
  if (!lineChartRef.value) return;
  
  // 销毁旧的图表实例
  if (lineChart) {
    lineChart.dispose();
  }
  
  // 创建新的图表实例
  lineChart = echarts.init(lineChartRef.value);
  
  const option = {
    grid: {
      left: '5px',
      right: '5px',
      top: '20px',
      bottom: '5px',
      containLabel: true
    },
    tooltip: {
      trigger: 'axis',
      formatter: '{b}: {c} 条'
    },
    xAxis: {
      type: 'category',
      data: trendData.value.map(item => item.date),
      axisLine: {
        lineStyle: {
          color: '#e5e7eb'
        }
      },
      axisLabel: {
        fontSize: 10,
        interval: 0,
        rotate: 30
      }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: {
        lineStyle: {
          color: '#f3f4f6'
        }
      }
    },
    series: [
      {
        name: '建议数量',
        type: 'line',
        data: trendData.value.map(item => item.count),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          width: 2,
          color: '#3b82f6'
        },
        itemStyle: {
          color: '#3b82f6'
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }
          ])
        }
      }
    ]
  };
  
  lineChart.setOption(option);
};

// 加载趋势数据
const loadTrendData = async () => {
  try {
    const response = await apiClient.get('/api/advice_trend');
    
    if (response.data.code === 0) {
      trendData.value = response.data.data;
      nextTick(initLineChart);
    }
  } catch (error) {
    console.error('加载趋势数据失败:', error);
  }
};

// 生命周期钩子
onMounted(() => {
  if (wordCloudChartRef.value) {
    wordCloudChart.value = echarts.init(wordCloudChartRef.value);
    window.addEventListener('resize', handleWordCloudResize);
  }

  loadData();
  loadStatistics();
  loadWordCloud();
  loadTrendData();
});

onBeforeUnmount(() => {
  if (lineChart) {
    lineChart.dispose();
    lineChart = null;
  }
  if (wordCloudChart.value) {
    wordCloudChart.value.dispose();
    wordCloudChart.value = null;
  }
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('resize', handleWordCloudResize);
});

// 窗口大小改变时重绘词云图
const handleWordCloudResize = () => {
  if (wordCloudChart.value) {
    wordCloudChart.value.resize();
  }
};

// 加载数据
const loadData = async () => {
  try {
    loading.value = true;
    const params = {
      page: pagination.value.current,
      pageSize: pagination.value.pageSize,
      category: filter.value.category,
      startDate: filter.value.dateRange[0] ? dayjs(filter.value.dateRange[0] as string).format('YYYY-MM-DD') : '',
      endDate: filter.value.dateRange[1] ? dayjs(filter.value.dateRange[1] as string).format('YYYY-MM-DD') : '',
      keyword: filter.value.keyword
    };
    
    const response = await apiClient.get('/api/advice_list', { params });
    
    if (response.data.code === 0) {
      // 确保每条数据的 photos 字段是字符串或初始化空字符串
      adviceList.value = response.data.data.list.map((item: AdviceItem) => ({
        ...item,
        photos: item.photos || ''
      }));
      pagination.value.total = response.data.data.total;
    } else {
      MessagePlugin.error(`加载失败: ${response.data.message}`);
    }
  } catch (error) {
    MessagePlugin.error('数据加载失败，请稍后重试');
    console.error('数据加载错误:', error);
  } finally {
    loading.value = false;
    // 移除了 loadWordCloud() 调用，解决词云重复加载问题
  }
};

// 窗口大小改变时重绘图表
const handleResize = () => {
  if (lineChart) {
    lineChart.resize();
  }
};

// 添加窗口大小改变监听
window.addEventListener('resize', handleResize);

// 加载统计数据
const loadStatistics = async () => {
  try {
    const response = await apiClient.get('/api/advice_statistics');
    
    if (response.data.code === 0) {
      statistics.value = response.data.data;
    }
  } catch (error) {
    console.error('统计信息加载失败:', error);
  }
};

// 加载词云数据
const loadWordCloud = async () => {
  try {
    const params = {
      category: filter.value.category,
      startDate: filter.value.dateRange[0] ? dayjs(filter.value.dateRange[0] as string).format('YYYY-MM-DD') : '',
      endDate: filter.value.dateRange[1] ? dayjs(filter.value.dateRange[1] as string).format('YYYY-MM-DD') : '',
      keyword: filter.value.keyword
    };
    
    const response = await apiClient.get('/api/word_cloud', { params });
    
    if (response.data.code === 0) {
      wordCloudData.value = response.data.data;
      nextTick(() => {
        renderWordCloud();
      });
    } else {
      wordCloudData.value = { recent: [], all: [] };
    }
  } catch (error) {
    console.error('词云加载失败:', error);
    wordCloudData.value = { recent: [], all: [] };
  }
};

// 刷新词云
const refreshWordCloud = () => {
  loadWordCloud();
};

// 分页变化
const onPageChange = (pageInfo: PageInfo) => {
  pagination.value.current = pageInfo.current;
  pagination.value.pageSize = pageInfo.pageSize;
  loadData();
};

// 显示详情
const showDetail = (row: AdviceItem) => {
  currentDetail.value = { ...row };
  detailVisible.value = true;
};

// 处理详情确认
const handleDetailConfirm = async () => {
  if (!currentDetail.value) return;
  
  try {
    const response = await apiClient.post('/api/update_advice', {
      id: currentDetail.value.id,
      status: currentDetail.value.status,
      processNote: currentDetail.value.processNote
    });
    
    if (response.data.code === 0) {
      MessagePlugin.success('更新成功');
      // 更新列表中的状态
      const index = adviceList.value.findIndex(item => item.id === currentDetail.value?.id);
      if (index !== -1) {
        adviceList.value[index] = { ...currentDetail.value };
      }
      detailVisible.value = false;
    } else {
      MessagePlugin.error(`更新失败: ${response.data.message}`);
    }
  } catch (error) {
    MessagePlugin.error('更新失败，请稍后重试');
    console.error('更新错误:', error);
  }
};

// 确认删除
const confirmDelete = (row: AdviceItem) => {
  const confirmDialog = DialogPlugin.confirm({
    header: '删除确认',
    body: `确定要删除ID为 ${row.id} 的建议吗？`,
    confirmBtn: '确定',
    cancelBtn: '取消',
    onConfirm: ({ e }) => {
      deleteAdvice(row.id);
      confirmDialog.hide();
    },
    onClose: ({ e, trigger }) => {
      confirmDialog.hide();
    },
  });
};

// 删除建议
const deleteAdvice = async (id: string) => {
  try {
    const response = await apiClient.delete(`/api/delete_advice/${id}`);
    
    if (response.data.code === 0) {
      MessagePlugin.success('删除成功');
      // 重新加载数据
      loadData();
      loadStatistics();
      loadWordCloud();
    } else {
      MessagePlugin.error(`删除失败: ${response.data.message}`);
    }
  } catch (error) {
    MessagePlugin.error('删除失败，请稍后重试');
    console.error('删除错误:', error);
  }
};

// 格式化日期
const formatDate = (dateString: string, withTime = false) => {
  const format = withTime ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD';
  return dayjs(dateString).format(format);
};

// 获取随机颜色
const getRandomColor = () => {
  const colors = [
    '#3498db', '#e74c3c', '#2ecc71', '#f39c12', 
    '#9b59b6', '#1abc9c', '#d35400', '#34495e'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// 获取类别主题色
const getCategoryTheme = (category: string): CategoryTheme => {
  const themes: Record<string, CategoryTheme> = {
    work_environment: 'primary',
    communication: 'success',
    salary_benefits: 'warning',
    culture: 'danger',
    canteen: 'default',
    dormitory: 'primary',
    other: 'success'
  };
  return themes[category] || 'default';
};
</script>

<style scoped>
.advice-management {
  padding: 20px;
  background-color: #f5f7fa;
  min-height: 100vh;
}

/* 顶部区域布局 */
.top-section {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

/* 左侧统计卡片（竖向） */
.stat-cards-vertical {
  flex: 0 0 25%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stat-item {
  display: flex;
  align-items: center;
}

.stat-icon {
  font-size: 28px;
  margin-right: 12px;
  color: var(--td-brand-color);
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.stat-label {
  font-size: 14px;
  color: var(--td-text-color-placeholder);
}

/* 右侧词云图 */
.word-cloud-card {
  flex: 1;
  height: 100%;
}

.word-cloud-container {
  position: relative;
  height: 300px;
  border-radius: 8px;
  background-color: #f9fafb;
  border: 1px dashed #e5e7eb;
}

.word-cloud {
  position: relative;
  height: 100%;
}

.word {
  position: absolute;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  padding: 4px 8px;
  border-radius: 4px;
}

.word:hover {
  background-color: rgba(255, 255, 255, 0.8);
  transform: scale(1.1) !important;
  z-index: 10;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}

.empty-word-cloud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--td-text-color-placeholder);
  background-color: #f9fafb; /* 与容器背景色一致 */
  z-index: 10; /* 确保在图表上方 */
}

.empty-word-cloud p {
  margin-top: 10px;
  font-size: 16px;
}

/* 表格卡片样式 */
.table-card {
  margin-bottom: 20px;
}

.filter-row {
  display: flex;
  justify-content: space-between; /* 两端对齐 */
  align-items: center; /* 垂直居中 */
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.filter-group {
  flex: 1; /* 占据剩余空间 */
  display: flex;
  gap: 12px;
  min-width: 300px; /* 确保在小屏幕下也能占据一行 */
}

.filter-group > * {
  flex: 1; /* 每个筛选框均匀分布 */
}

@media (max-width: 768px) {
  .filter-row {
    flex-direction: column;
  }
  
  .filter-group {
    width: 100%;
  }
  
  .filter-row > .t-button {
    align-self: flex-end; /* 小屏幕下按钮右对齐 */
  }
}

/* 新增：食堂类别换行样式 */
.category-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.canteen-tag {
  display: inline-block;
  margin-top: 4px;
  padding: 2px 8px;
  background-color: #eaf7ff;
  border-radius: 4px;
  color: var(--td-brand-color);
  font-size: 12px;
}

.suggestion-content {
  max-width: 600px;
}

.suggestion-text {
  margin-bottom: 8px;
  line-height: 1.5;
}

.suggestion-images {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.suggestion-images .t-image {
  width: 80px;
  height: 80px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
}

.image-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  opacity: 0;
  transition: opacity 0.3s;
}

.t-image:hover .image-overlay {
  opacity: 1;
}

/* 详情样式 */
.detail-container {
  padding: 10px;
}

.detail-section {
  margin-bottom: 20px;
}

.detail-row {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.detail-col {
  flex: 1;
}

.detail-label {
  font-size: 14px;
  color: var(--td-text-color-placeholder);
  margin-bottom: 8px;
}

.detail-value {
  font-size: 16px;
  color: var(--td-text-color-primary);
}

.suggestion-text {
  line-height: 1.6;
  white-space: pre-wrap;
}

.detail-images {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.detail-image {
  width: 120px;
  height: 120px;
  border-radius: 6px;
  object-fit: cover;
}

.status-select {
  width: 200px;
}

/* 响应式调整 */
@media (max-width: 992px) {
  .top-section {
    flex-direction: column;
  }
  
  .stat-cards-vertical {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .filter-row {
    flex-direction: column;
  }
  
  .detail-row {
    flex-direction: column;
    gap: 10px;
  }
}
</style>