<template>
  <t-dialog
      v-model:visible="statsVisible"
      :header="`生产统计 (总订货量: ${totalOrder.toFixed(1)}吨)`"
      width="800px"
      :confirm-btn="'关闭'"
    >
      <!-- 对话框内容 -->
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
        <!-- 左侧Excel预览 -->
        <div class="excel-preview-container">
          <t-card title="Excel预览" :subtitle="excelName" class="excel-preview-card">
            <div v-show="sheets.length > 0">
              <div class="sheet-tabs">
                <t-tabs v-model="activeSheet" theme="card">
                  <t-tab-panel
                    v-for="(sheet, index) in sheets"
                    :key="index"
                    :value="index"
                    :label="sheet.name"
                  >
                  </t-tab-panel>
                </t-tabs>
              </div>
              <div class="hot-container">
                <hot-table
                  :settings="hotSettings"
                  :data="currentSheetData"
                  :colHeaders="true"
                  :rowHeaders="true"
                  :width="'100%'"
                  :height="auto"
                  :key="upkey"
                ></hot-table>
              </div>
            </div>
            <div v-show="sheets.length === 0" class="empty-preview">
              <t-icon name="file-excel" size="48px" />
              <p>上传Excel文件后预览内容将显示在这里currentSheetData</p>
            </div>
          </t-card>
        </div>
        <div class="right-side-container">
          <!-- 上传区域 -->
          <t-card title="数据上传" class="upload-card" :bordered="false">
            <t-upload
              v-model="files"
              :action="uploadConfig.action"
              :headers="uploadConfig.headers"
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
          
          <!-- 时间线 -->
          <t-card title="上传记录" class="timeline-card">
            <div class="timeline-wrapper">
              <t-timeline>
                <t-timeline-item
                  v-for="(record, index) in uploadRecords"
                  :key="index"
                  :label="record.time"
                  :dot-color="record.success ? 'success' : 'error'"
                  @click="handleTimelineClick(record)"
                >
                  <div class="record-item">
                    <span class="filename">{{ record.filename }}</span>
                    <!-- <span class="status" :class="record.success ? 'success' : 'error'">
                      {{ record.success ? '✓' : '✗' }}
                    </span> -->
                  </div>
                </t-timeline-item>
              </t-timeline>
            </div>
          </t-card>
        </div>
        
      </div>
    </div>
</template>

<script setup>
import apiClient from '@/plugins/axios'
import { ref, onMounted, computed, onBeforeUnmount, nextTick,watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next';
import { tebian } from './components/parse_tebian';
import { useAuthStore } from '@/store/authStore'
import { useRouter } from 'vue-router'
import { HotTable } from '@handsontable/vue3';
import { registerAllModules } from 'handsontable/registry';
import { read, utils } from 'xlsx';
import 'handsontable/dist/handsontable.full.min.css';

// Register Handsontable modules
registerAllModules();



const upkey = ref(Date.now()); // 初始化为当前时间戳
const authStore = useAuthStore()
const router = useRouter()
const currentCompany = ref('');
// '特变', '沙钢', '卫源', '德瑞斯', '三鼎','朗度','兴澄','中船'
const companies = ref([]);
const totalOrder = ref(0);
const totalOrderFetched = ref(false);
const currentSheetData = computed(() => {
  // console.log('currentSheetData: ',sheets.value[activeSheet.value]?.data || [])
  return sheets.value[activeSheet.value]?.data || [];
});
// Handsontable related
const sheets = ref([]);
const activeSheet = ref(0);
const excelName = ref('');
const hotSettings = ref({
  licenseKey: 'non-commercial-and-evaluation', // for non-commercial use
  // data: currentSheetData.value,
  colHeaders: true,  // 显示列标题（A, B, C...）
  rowHeaders: true,  // 显示行号（1, 2, 3...）
  colWidths: 100,    // 统一列宽
  rowHeights: 24,    // 统一行高
  width: '100%',
  height: 'auto',
  afterRender: () => console.log('渲染完成'), // 调试用
  // 手动定义列（关键！）
  // columns: currentSheetData.value[0]?.map((_, idx) => ({
  //   data: idx,
  //   type: 'text',
  // })),
  // colWidths: 100,
  // rowHeights: 25,
  // manualRowResize: true,
  // manualColumnResize: true,
  // contextMenu: true,
  // filters: true,
  // dropdownMenu: true,
  // stretchH: 'all',
  // autoWrapRow: true,
  // autoWrapCol: true,
});


const handleTimelineClick = (record) => {
  console.log('点击了记录:', record);
  console.log('记录ID:', record.id);
  console.log('文件名:', record.filename);
  console.log('上传时间:', record.time);
};


// 用户相关
const userAvatar = 'https://tdesign.gtimg.com/site/avatar.jpg';

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

const uploadConfig = ref({
  action: 'https://chat.yzjship.com:8081/api/upload',
  headers: {
    'Authorization': `Bearer ${authStore.token}`, // 从store获取token
    // 'Content-Type': 'multipart/form-data'
  },
  data: { // 附加表单数据
    company: currentCompany.value 
  },
  name: 'file',
  withCredentials: true
});

// 对话框控制
const statsVisible = ref(false);
const rawStatsData = ref({
  涟钢: [],
  湘钢: [],
  首钢: []
});

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

const parseExcel = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = read(data, { type: 'array' });
        
        const parsedSheets = workbook.SheetNames.map((name, index) => {
          const worksheet = workbook.Sheets[name];
          const jsonData = utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          // console.log('jsonData: ',JSON.parse(JSON.stringify(jsonData)))
          return {
            name: name,
            index: index,
            data: jsonData
          };
        });
        
        
        resolve(parsedSheets);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = (error) => {
      reject(error);
    };
    
    reader.readAsArrayBuffer(file);
  });
};

watch(activeSheet, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    upkey.value = Date.now();
  }
});

const beforeUpload = async(file) => {
  if (!totalOrderFetched.value) {
    MessagePlugin.warning('正在加载数据，请稍后上传')
    return false
  }

  const isExcel = file.type.includes('excel') || 
                 file.name.endsWith('.xlsx') || 
                 file.name.endsWith('.xls')
  const isLt10M = file.size / 1024 / 1024 < 10
  
  if (!isExcel) {
    MessagePlugin.error('只能上传 Excel 文件!')
    return false
  }
  if (!isLt10M) {
    MessagePlugin.error('文件大小不能超过 10MB!')
    return false
  }

  try {
    const fileObj = file.raw || file;
    excelName.value = fileObj.name;
    
    // 解析Excel文件
    const parsedSheets = await parseExcel(fileObj);
    sheets.value = parsedSheets;
    activeSheet.value = 0;
    upkey.value = Date.now();
    // 特变公司解析逻辑
    if (currentCompany.value === '特变') {
      const result = await tebian(fileObj)
      console.log('PR: ',result)
      if (result.message) {
      MessagePlugin.error(result.message); // 显示错误消息
      return false; // 终止上传流程
    }

      await showStatistics(result)
      MessagePlugin.success('Excel解析成功')
    }

    return true
  } catch (error) {
    console.error('文件处理错误:', error)
    MessagePlugin.error(`文件处理失败: ${error.message}`)
    return false
  }
}

const formatResponse = (res) => {
  if (res.success === true) {
    return {  };
  }
  MessagePlugin.error(res.msg || '上传失败');
  return null;
};

const handleSuccess = ({ file }) => {
  MessagePlugin.success(`${file.name} 上传成功`);
  // 添加到上传记录
  uploadRecords.value.unshift({
    time: new Date().toLocaleString().replace(/,?\s/, '\n'),
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

const fetchData1 = async () => {
  try {
    const response = await apiClient.post('/api/getUserCompany',{userName:authStore.userCode})
    
    console.log('getUserCompany: ',response.data.data)
    const uniqueCompanies = [...new Set(
      response.data.data.map(item => item.company).filter(Boolean)
    )];
    
    companies.value = uniqueCompanies;
    
    // 设置默认选中第一个公司（如果有的话）
    if (companies.value.length > 0) {
      currentCompany.value = companies.value[0];
    }
    totalOrderFetched.value = true; // 数据获取完成后启用按钮
  } catch (error) {
    console.error(error)
    MessagePlugin.error('获取公司失败');
    
  }
}

const formatTime = (isoString) => {
  const date = new Date(isoString);
  // 使用 UTC 方法，避免时区转换
  return `${date.getUTCFullYear()}-${padZero(date.getUTCMonth() + 1)}-${padZero(date.getUTCDate())}\n${padZero(date.getUTCHours())}:${padZero(date.getUTCMinutes())}`;
};

// 辅助函数：补零
const padZero = (num) => {
  return num < 10 ? `0${num}` : num;
}

const insertNewlines = (str, interval) => {
  return str.replace(new RegExp(`(.{${interval}})`, 'g'), '$1\n');
};
const fetchData2 = async () => {
  try {
    const response = await apiClient.post('/api/getMyUpR',{userName:authStore.userCode})
    
    uploadRecords.value = response.data.data.map(item => ({
      id: item.id,
      time: formatTime(item.uptime), // 格式化时间
      filename: insertNewlines(item.filename, 20), 
      success: true // 假设所有记录都是成功的，或者可以根据其他字段判断
    }));
    console.log('getMyUpR: ',response.data.data)
  } catch (error) {
    console.error(error)
    MessagePlugin.error('获取公司失败');
    
  }
}
const handleLogout = () => {
  // 清空 token 和 userCode
  authStore.clearToken()
  authStore.clearUserCode()
  
  // 跳转到登录页面
  router.push('/login')
}



onMounted(() => {
  fetchData()
  fetchData1()
  fetchData2()
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

.excel-preview-container {
  flex: 2;
  min-width: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.excel-preview-card {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.empty-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--td-text-color-secondary);
}

.empty-preview p {
  margin-top: 12px;
}

.right-side-container {
  width: 400px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.upload-card {
  position: sticky;
  top: 24px;
  height: auto;
  margin-bottom: 16px;
}

.timeline-card {
  flex: 1;
  overflow: hidden;
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
  /* white-space: nowrap; */
  white-space: pre;
}

.status {
  font-weight: bold;
  margin-left: 8px;
}

.status.success {
  color: var(--td-success-color);
}

.status.error {
  color: var(--td-error-color);
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

/* Handsontable样式 */
.hot-container {
  margin-top: 10px;
  overflow: auto;
  width: 100%;
  height: calc(100vh - 200px); 
}

.handsontable {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.handsontable .ht_clone_left .wtHolder {
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
}

.handsontable td, .handsontable th {
  height: 24px;
  line-height: 24px;
  box-sizing: border-box;
}

.handsontable table {
  border-collapse: separate !important;
}

:deep(.handsontable) {
  position: relative;
  z-index: 1;
}

:deep(.handsontable .wtHolder) {
  width: 100% !important;
  height: 100% !important;
}

:deep(.handsontable td, .handsontable th) {
  padding: 4px;
  box-sizing: border-box;
  line-height: 1.5;
}

.sheet-tabs {
  margin-bottom: 10px;
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