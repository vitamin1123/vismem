<template>
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
            <t-dropdown-item value="logout">退出登录</t-dropdown-item>
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
            @fail="handleFail"
            @success="handleSuccess"
          >
            <t-button variant="outline">
              <template #icon><t-icon name="upload" /></template>
              点击上传
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
import { ref , onMounted } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next';
import { tebian } from './components/parse_tebian';
const currentCompany = ref('特变');
const companies = ['特变', '沙钢', '卫源', '德瑞斯', '三鼎','朗度','兴澄','中船'];

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
      
      console.log('解析结果：', result);
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
    const response = await apiClient.post('/api/what',{'aaa':"bbb"})
    console.log('svend: ',response.data)
  } catch (error) {
    console.error(error)
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
</style>