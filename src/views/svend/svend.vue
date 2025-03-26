<template>
<t-dialog
    v-model:visible="statsVisible"
    :header="`生产统计 (总订货量: ${totalOrder.toFixed(1)}吨)`"
    width="800px"
    :confirm-btn="'关闭'"
  >
    <div class="stats-dialog">
      <!-- 各公司统计 - 完全原始数据 -->
      <div v-for="(data, name) in statsData" :key="name" class="stats-block">
        <h4>{{ name }}统计</h4>
        <div class="stats-grid">
          <div class="completed-stats">
            <h5>已完成</h5>
            <pre>
{{ name === '涟钢' && data.已发运 ? `已发运: ${data.已发运.toFixed(1)}吨` : '' }}
{{ data.已炼钢 ? `已炼钢: ${data.已炼钢.toFixed(1)}吨` : '' }}
{{ data.已轧制 ? `已轧制: ${data.已轧制.toFixed(1)}吨` : '' }}
{{ data.已船检 ? `已船检: ${data.已船检.toFixed(1)}吨` : '' }}
{{ data.已集港 ? `已集港: ${data.已集港.toFixed(1)}吨` : '' }}
            </pre>
          </div>
          <div class="uncompleted-stats">
            <h5>未完成</h5>
            <pre>
{{ name !== '涟钢' && data.未发运 ? `未发运: ${data.未发运.toFixed(1)}吨` : '' }}
{{ data.未炼钢 ? `未炼钢: ${data.未炼钢.toFixed(1)}吨` : '' }}
{{ data.未轧制 ? `未轧制: ${data.未轧制.toFixed(1)}吨` : '' }}
{{ data.未船检 ? `未船检: ${data.未船检.toFixed(1)}吨` : '' }}
{{ data.未集港 ? `未集港: ${data.未集港.toFixed(1)}吨` : '' }}
            </pre>
          </div>
        </div>
      </div>
    </div>
  </t-dialog>
  <div class="page-container">
    <!-- 导航栏 -->
    <t-header class="header">
      <t-menu
        theme="light"
        value="home"
        style="flex: 1"
      >
        <!-- <t-menu-item value="home">首页</t-menu-item>
        <t-menu-item value="data">数据管理</t-menu-item>
        <t-menu-item value="report">报表</t-menu-item> -->
      </t-menu>
      
      <div class="header-right">
        <t-dropdown :min-column-width="120" @click="handleCompanyChange">
          <t-button variant="text">
            {{ currentCompany }}
            <template #suffix><t-icon name="chevron-down" /></template>
          </t-button>
          <t-dropdown-menu>
            <t-dropdown-item v-for="company in companies" :key="company" :value="company">
              {{ company }}
            </t-dropdown-item>
          </t-dropdown-menu>
        </t-dropdown>
        
        <t-dropdown :min-column-width="120" @click="handleUserAction">
          <t-avatar :image="userAvatar" size="medium" />
          <t-dropdown-menu>
            <t-dropdown-item value="logout" @click="handleLogout">退出登录</t-dropdown-item>
          </t-dropdown-menu>
        </t-dropdown>
      </div>
    </t-header>
    
    <!-- 主体内容 -->
    <div class="main-content">
      <!-- 左侧时间线 -->
      <div class="timeline-container">
        <t-card title="最近上传记录" class="timeline-card">
          <div class="timeline-wrapper">
            <t-timeline>
              <t-timeline-item
                v-for="(record, index) in uploadRecords"
                :key="index"
                :label="record.time"
                :dot-color="record.success ? 'success' : 'error'"
              >
                <div class="record-item">
                  <span class="filename">{{ record.filename }}</span>
                  <t-tag :theme="record.success ? 'success' : 'danger'" variant="light">
                    {{ record.success ? '成功' : '失败' }}
                  </t-tag>
                </div>
              </t-timeline-item>
            </t-timeline>
          </div>
        </t-card>
      </div>
      
      <!-- 右侧上传区域 -->
      <div class="upload-container">
        <t-card title="数据上传" class="upload-card" :bordered="false">
          <t-upload
            v-model="files"
            action="/api/upload"
            :before-upload="beforeUpload"
            :format-response="formatResponse"
            :tips="uploadTips"
            :locale="uploadLocale"
            theme="custom"
            accept=".xlsx,.xls"
            :disabled="!totalOrderFetched"
            @fail="handleFail"
            @success="handleSuccess"
          >
            <t-button variant="outline" :loading="!totalOrderFetched">
              <template #icon><t-icon name="upload" /></template>
              {{ totalOrderFetched ? '点击上传' : '加载中...' }}
            </t-button>
            <template #fileListDisplay="{ files: displayFiles }">
              <t-table :data="displayFiles" :columns="fileColumns" row-key="name" />
            </template>
          </t-upload>
        </t-card>
      </div>
    </div>
  </div>
</template>

<script setup>

import apiClient from '@/plugins/axios'
import { ref , onMounted,computed  } from 'vue'
import { MessagePlugin, DialogPlugin  } from 'tdesign-vue-next';
import { tebian } from './components/parse_tebian';
import { useAuthStore } from '@/store/authStore'
import { useRouter } from 'vue-router'
const authStore = useAuthStore()
const router = useRouter()
const currentCompany = ref('特变');
const companies = ['特变', '沙钢', '卫源', '德瑞斯', '三鼎','朗度','兴澄','中船'];
const totalOrder = ref(0); // 总订货量
// 用户相关
const userAvatar = 'https://tdesign.gtimg.com/site/avatar.jpg';
const totalOrderFetched = ref(false);
// 上传记录
const uploadRecords = ref([
  { time: '2025-05-15\n14:30', filename: '特变进度.xlsx', success: true },
  { time: '2025-03-25\n09:15', filename: '特变进度.xlsx', success: true },
  { time: '2025-03-25\n16:45', filename: '特变进度.xlsx', success: false },
  { time: '2025-03-25\n11:20', filename: '特变进度.xlsx', success: true },
  { time: '2025-03-25\n10:05', filename: '特变进度.xlsx', success: true },
  { time: '2025-03-25\n15:30', filename: '特变进度.xlsx', success: false },
  { time: '2025-03-25\n13:10', filename: '特变进度.xlsx', success: true },
]);

// 对话框控制
const statsVisible = ref(false);
const rawStatsData = ref({
  涟钢: [],
  湘钢: [],
  首钢: []
});

const handleLogout = () => {
  // 清空 token 和 userCode
  authStore.clearToken()
  authStore.clearUserCode()
  
  // 跳转到登录页面
  router.push('/login')
  
  // MessagePlugin.success('已成功退出登录')
}

// 计算属性处理数据
const statsData = computed(() => {
  const data = {
    涟钢: { 已发运: 0 }, 
    湘钢: { 未发运: 0 }, 
    首钢: { 未发运: 0 }
  };
  
  // 只提取原始数据，不做任何计算
  for (const [factory, items] of Object.entries(rawStatsData.value)) {
    if (!Array.isArray(items)) continue;
    
    items.forEach(item => {
      if (factory === '涟钢') {
        data.涟钢.已发运 += Number(item.已发运) || 0;
      } else {
        data[factory].未发运 += Number(item.未发运) || 0;
      }
      
      // 直接累加其他字段
      data[factory].未炼钢 = (data[factory].未炼钢 || 0) + (Number(item.未炼钢) || 0);
      data[factory].未轧制 = (data[factory].未轧制 || 0) + (Number(item.未轧制) || 0);
      data[factory].未船检 = (data[factory].未船检 || 0) + (Number(item.未船检) || 0);
      data[factory].未集港 = (data[factory].未集港 || 0) + (Number(item.未集港) || 0);
    });
  }
  
  return data;
});
// 全局统计数据计算 (保持已+未=总)
const grandTotals = computed(() => {
  const totals = {
    已发运: 0,
    未发运: 0,
    已炼钢: 0,
    未炼钢: 0,
    已轧制: 0,
    未轧制: 0,
    已船检: 0,
    未船检: 0,
    已集港: 0,
    未集港: 0
  };
  
  // 计算各公司数据
  for (const [factory, data] of Object.entries(statsData.value)) {
    if (factory === '涟钢') {
      // 涟钢只有已发运
      totals.已发运 += data.已发运 || 0;
    } else {
      // 其他公司只有未发运
      totals.未发运 += data.未发运 || 0;
      totals.已发运 += totalOrder.value - (data.未发运 || 0);
    }
    
    // 处理其他通用字段
    totals.未炼钢 += data.未炼钢 || 0;
    totals.已炼钢 += totalOrder.value - (data.未炼钢 || 0);
    totals.未轧制 += data.未轧制 || 0;
    totals.已轧制 += totalOrder.value - (data.未轧制 || 0);
    totals.未船检 += data.未船检 || 0;
    totals.已船检 += totalOrder.value - (data.未船检 || 0);
    totals.未集港 += data.未集港 || 0;
    totals.已集港 += totalOrder.value - (data.未集港 || 0);
  }
  
  return totals;
});


// 统计方法
const calculateTotals = (items) => {
  // 确保items是数组，如果不是则转为空数组
  const safeItems = Array.isArray(items) ? items : [];
  
  return safeItems.reduce((acc, item) => ({
    已发运: acc.已发运 + (Number(item?.已发运) || 0),
    未炼钢: acc.未炼钢 + (Number(item?.未炼钢) || 0),
    未船检: acc.未船检 + (Number(item?.未船检) || 0),
    未轧制: acc.未轧制 + (Number(item?.未轧制) || 0),
    未集港: acc.未集港 + (Number(item?.未集港) || 0)
  }), {
    已发运: 0, 
    未炼钢: 0, 
    未船检: 0, 
    未轧制: 0, 
    未集港: 0
  });
};
// 格式化显示
const formatStats = (data) => {
  return `已发运: ${data.已发运.toFixed(1)}吨
未炼钢: ${data.未炼钢.toFixed(1)}吨
未船检: ${data.未船检.toFixed(1)}吨
未轧制: ${data.未轧制.toFixed(1)}吨
未集港: ${data.未集港.toFixed(1)}吨`;
};

// 显示统计弹窗
const showStatistics = async (result) => {
  try {
    const resolvedData = {};
    
    // 解析各公司数据
    for (const [factory, promise] of Object.entries(result)) {
      try {
        const items = await promise;
        resolvedData[factory] = items;
      } catch (error) {
        console.error(`处理 ${factory} 数据时出错:`, error);
        resolvedData[factory] = [];
      }
    }
    
    rawStatsData.value = resolvedData;
    statsVisible.value = true;
  } catch (error) {
    MessagePlugin.error(`数据加载失败: ${error.message}`);
  }
};
// 上传组件相关
const files = ref([]);
const uploadTips = '仅支持 Excel 文件 (.xlsx, .xls)，大小不超过 10MB';
const uploadLocale = {
  triggerUploadText: {
    image: '点击上传图片',
    normal: '点击上传',
    fileInput: '选择文件',
    reupload: '重新上传',
    continueUpload: '继续上传',
    delete: '删除',
    upload: '上传',
  },
  dragger: {
    dragDropText: '释放鼠标',
    draggingText: '拖拽到此区域',
    clickAndDragText: '点击上方"选择文件"或将文件拖拽到此区域',
  },
};

const fileColumns = [
  { colKey: 'name', title: '文件名' },
  { colKey: 'size', title: '大小', cell: (h, { row }) => `${(row.size / 1024 / 1024).toFixed(2)} MB` },
  { colKey: 'status', title: '状态', cell: (h, { row }) => {
    if (row.status === 'success') return '上传成功';
    if (row.status === 'fail') return '上传失败';
    return '上传中';
  }},
];

// 方法
const handleCompanyChange = (data) => {
  if (data.value) {
    currentCompany.value = data.value;
    MessagePlugin.success(`已切换至 ${data.value}`);
  }
};

const handleUserAction = (data) => {
  if (data.value === 'logout') {
    MessagePlugin.info('您已退出登录');
    // 这里添加退出登录的逻辑
  }
};





const beforeUpload = async(file) => {
  if (!totalOrderFetched.value) {
    MessagePlugin.warning('正在加载数据，请稍后上传');
    return false;
  }
  const isExcel = file.type.includes('excel') || 
                 file.name.endsWith('.xlsx') || 
                 file.name.endsWith('.xls');
  const isLt10M = file.size / 1024 / 1024 < 10;
  
  if (!isExcel) {
    MessagePlugin.error('只能上传 Excel 文件!');
    return false;
  }
  if (!isLt10M) {
    MessagePlugin.error('文件大小不能超过 10MB!');
    return false;
  }
  // 新增特变公司解析逻辑
  if (currentCompany.value === '特变') {
    try {
      // 传递原生File对象（注意不同UI库的参数结构）
      const result = await tebian(file.raw || file);
      
      if (result.message) {
        MessagePlugin.error(result.message);
        return false;
      }
      await showStatistics(result);
      console.log(result)
      // 遍历打印每个钢厂的数据
      // Object.entries(result).forEach(([factory, data]) => {
      //   console.log(`==== ${factory}数据 ====`);
        
      //   // 检查数据是否为Promise
      //   if (data instanceof Promise) {
      //     data.then(resolvedData => {
      //       console.log("解析完成:", resolvedData);
      //       // 处理解析完成的数据
      //       if (Array.isArray(resolvedData)) {
      //         resolvedData.forEach((item, index) => {
      //           console.log(`${index + 1}.`, item);
      //         });
      //       }
      //     }).catch(err => {
      //       console.error(`${factory}数据处理错误:`, err);
      //     });
      //   } else {
      //     // 直接处理非Promise数据
      //     console.log("直接数据:", data);
      //     if (Array.isArray(data)) {
      //       data.forEach((item, index) => {
      //         console.log(`${index + 1}.`, item);
      //       });
      //     }
      //   }
      // });
      MessagePlugin.success('Excel解析成功');
    } catch (error) {
      MessagePlugin.error(`解析失败：${error.message}`);
      return false;
    }
  }
  return true;
};

const formatResponse = (res) => {
  if (res.code === 0) {
    return { name: res.data.name, size: res.data.size };
  }
  MessagePlugin.error(res.msg || '上传失败');
  return null;
};

const handleSuccess = ({ file }) => {
  MessagePlugin.success(`${file.name} 上传成功`);
  // 添加到上传记录
  uploadRecords.value.unshift({
    time: new Date().toLocaleString(),
    filename: file.name,
    success: true
  });
};

const handleFail = ({ file }) => {
  MessagePlugin.error(`${file.name} 上传失败`);
  // 添加到上传记录
  uploadRecords.value.unshift({
    time: new Date().toLocaleString(),
    filename: file.name,
    success: false
  });
};
// /api/what
const fetchData = async () => {
  try {
    const response = await apiClient.post('/api/getTotalDing',{'sw':"TB"})
    totalOrder.value = response.data.data.total || 0;
    console.log('svend: ',response.data.data)
    totalOrderFetched.value = true; // 数据获取完成后启用按钮
  } catch (error) {
    console.error(error)
    MessagePlugin.error('获取本月总订货量失败');
    totalOrderFetched.value = true; // 即使失败也启用按钮
  }
}

onMounted(() => {
  fetchData()
})

</script>

<style scoped>
.page-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f5f7fa;
}

.header {
  display: flex;
  align-items: center;
  padding: 0 24px;
  height: 64px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  z-index: 100;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.main-content {
  display: flex;
  flex: 1;
  padding: 24px;
  gap: 24px;
  overflow: hidden;
}

.timeline-container {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.timeline-card {
  height: 100%;
}

.timeline-wrapper {
  height: calc(100% - 60px);
  overflow-y: auto;
  padding-right: 8px;
}

.record-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
}

.filename {
  flex: 1;
  margin-right: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-container {
  width: 400px;
}

.upload-card {
  position: sticky;
  top: 24px;
  height: auto;
}

/* 自定义滚动条 */
.timeline-wrapper::-webkit-scrollbar {
  width: 6px;
}

.timeline-wrapper::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.timeline-wrapper::-webkit-scrollbar-thumb {
  background: #d4d4d4;
  border-radius: 3px;
}

.timeline-wrapper::-webkit-scrollbar-thumb:hover {
  background: #b3b3b3;
}

:deep(.t-timeline-item__label) {
  white-space: pre-wrap;
  text-align: left;
  margin-left: 8px;
}

/*    */
.stats-content {
  font-family: monospace;
}

.stats-content h4 {
  color: var(--td-brand-color);
  margin: 16px 0 8px;
}

pre {
  white-space: pre-wrap;
  background: #f8f9fa;
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 16px;
}

.t-divider {
  margin: 16px 0;
}

.stats-dialog {
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 8px;
}

.stats-block {
  margin-bottom: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 16px;
}

.completed-stats, .uncompleted-stats {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 4px;
}

.completed-stats h5 {
  color: var(--td-success-color);
}

.uncompleted-stats h5 {
  color: var(--td-error-color);
}

</style>