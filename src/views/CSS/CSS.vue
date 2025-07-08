<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import * as XLSX from 'xlsx';

// 定义文件状态类型
type FileStatus = 'waiting' | 'processing' | 'success' | 'error';

// 文件接口
interface ExcelFile {
  id: string;
  name: string;
  size: number;
  rawFile: File;
  processedBlob?: Blob;
  status: FileStatus;
  progress: number;
}

// 响应式数据
const files = ref<ExcelFile[]>([]);
const isProcessing = ref(false);
const activeDrag = ref(false);

// 计算属性 - 待处理文件列表
const pendingFiles = computed(() => {
  return files.value.filter(file => file.status === 'waiting');
});

// 计算属性 - 处理完成文件列表
const processedFiles = computed(() => {
  return files.value.filter(file => file.status === 'success');
});

// 处理拖拽事件
const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  activeDrag.value = true;
};

const handleDragLeave = () => {
  activeDrag.value = false;
};

// 添加文件到待处理列表
const addFiles = (newFiles: FileList | null) => {
  if (!newFiles || newFiles.length === 0) return;
  
  activeDrag.value = false;
  
  Array.from(newFiles).forEach(file => {
    // 只接受Excel文件
    if (!file.name.match(/\.(xlsx|xls|xlsm)$/i)) {
      MessagePlugin.warning(`"${file.name}" 不是有效的Excel文件`);
      return;
    }
    
    // 检查是否已存在同名文件
    if (files.value.some(f => f.name === file.name && f.status === 'waiting')) {
      MessagePlugin.warning(`"${file.name}" 已在队列中`);
      return;
    }
    
    files.value.push({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      rawFile: file,
      status: 'waiting',
      progress: 0
    });
  });
  
  MessagePlugin.success(`已添加 ${newFiles.length} 个文件到处理队列`);
};

// 处理文件 - 添加abc sheet
const processFile = async (file: ExcelFile) => {
  file.status = 'processing';
  file.progress = 0;
  
  let interval: number | null = null;
  
  try {
    // 模拟进度更新
    interval = setInterval(() => {
      if (file.progress < 90) {
        file.progress += 10;
      }
    }, 200) as unknown as number;
    
    // 读取Excel文件
    const reader = new FileReader();
    const data = await new Promise<ArrayBuffer>((resolve, reject) => {
      reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file.rawFile);
    });
    
    // 处理Excel
    const workbook = XLSX.read(data, { type: 'array' });
    
    // 检查是否已存在名为abc的sheet
    if (!workbook.SheetNames.includes('abc')) {
      // 创建新sheet
      const newSheet = XLSX.utils.aoa_to_sheet([
        ['Excel处理工具生成'],
        ['Sheet名称: abc'],
        ['添加时间', new Date().toLocaleString()],
        ['原始文件名', file.name]
      ]);
      XLSX.utils.book_append_sheet(workbook, newSheet, 'abc');
    } else {
      MessagePlugin.warning(`"${file.name}" 中已存在abc工作表，将跳过添加`);
    }
    
    // 生成处理后的Excel
    const wbout = XLSX.write(workbook, { 
      bookType: 'xlsx', 
      type: 'array',
      bookSST: true // 提高大文件性能
    });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // 更新文件状态
    file.processedBlob = blob;
    file.status = 'success';
    file.progress = 100;
    
    if (interval) clearInterval(interval);
    MessagePlugin.success(`"${file.name}" 处理完成`);
  } catch (error) {
    console.error('处理文件出错:', error);
    file.status = 'error';
    if (interval) clearInterval(interval);
    MessagePlugin.error(`"${file.name}" 处理失败: ${(error as Error).message}`);
  }
};

// 处理所有文件
const processAllFiles = async () => {
  if (pendingFiles.value.length === 0) {
    MessagePlugin.warning('没有待处理的文件');
    return;
  }
  
  isProcessing.value = true;
  
  // 使用Promise.all并行处理文件（限制并发数）
  const concurrencyLimit = 3;
  const chunks = [];
  
  for (let i = 0; i < pendingFiles.value.length; i += concurrencyLimit) {
    const chunk = pendingFiles.value.slice(i, i + concurrencyLimit);
    chunks.push(chunk);
  }
  
  for (const chunk of chunks) {
    await Promise.all(chunk.map(file => processFile(file)));
  }
  
  isProcessing.value = false;
  MessagePlugin.success('所有文件处理完成');
};

// 下载处理后的文件
const downloadFile = (file: ExcelFile) => {
  if (!file.processedBlob) return;
  
  const url = URL.createObjectURL(file.processedBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `processed_${file.name.replace(/\.[^/.]+$/, '')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  
  // 清理
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
};

// 删除文件
const removeFile = (id: string) => {
  files.value = files.value.filter(file => file.id !== id);
};

// 清空所有文件
const clearAllFiles = () => {
  files.value = [];
  MessagePlugin.success('已清空所有文件');
};

// 添加点击上传支持
const handleFileInput = (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    addFiles(input.files);
    input.value = ''; // 重置input以允许选择相同文件
  }
};

// 初始化时添加事件监听
onMounted(() => {
  window.addEventListener('dragover', (e) => {
    e.preventDefault(); // 防止浏览器默认打开文件
  });
  
  window.addEventListener('drop', (e) => {
    e.preventDefault(); // 防止浏览器默认打开文件
  });
});
</script>

<template>
  <div class="excel-processor-container">
    <header class="app-header">
      <h1>CSS 工作日报 Excel 处理</h1>
      <p>拖拽Excel文件到左侧区域</p>
    </header>
    
    <div class="main-content">
      <!-- 左侧：待处理区域 -->
      <div class="file-section pending-section">
        <div class="section-header">
          <t-icon name="time" size="20px" />
          <h2>待处理文件</h2>
          <div class="actions">
            <t-button 
              :disabled="pendingFiles.length === 0 || isProcessing" 
              @click="processAllFiles"
              theme="primary"
              class="action-btn"
            >
              <t-icon name="play" />
              {{ isProcessing ? '处理中...' : '开始处理' }}
            </t-button>
            <t-button 
              variant="outline" 
              @click="clearAllFiles"
              class="action-btn"
            >
              <t-icon name="delete" />
              清空
            </t-button>
          </div>
        </div>
        
        <div 
          class="drop-zone"
          :class="{ active: activeDrag }"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="(e) => { e.preventDefault(); addFiles(e.dataTransfer?.files || null) }"
        >
          <div class="drop-content">
            <t-icon name="upload" size="36px" />
            <p>拖拽Excel文件到此处</p>
            <p class="hint">支持 .xlsx 和 .xls 格式</p>
            <t-button variant="outline" class="upload-btn">
              <label for="file-upload" class="upload-label">
                <t-icon name="folder" />
                选择文件
              </label>
            </t-button>
            <input 
              id="file-upload"
              type="file" 
              multiple 
              accept=".xlsx, .xls, .xlsm"
              @change="handleFileInput"
              style="display: none;"
            />
          </div>
        </div>
        
        <div class="file-list" v-if="pendingFiles.length > 0">
          <div v-for="file in pendingFiles" :key="file.id" class="file-item" :class="file.status">
            <div class="file-info">
              <t-icon name="file-excel" size="24px" />
              <div class="file-details">
                <div class="file-name">{{ file.name }}</div>
                <div class="file-size">{{ (file.size / 1024).toFixed(1) }} KB</div>
              </div>
            </div>
            
            <div class="file-actions">
              <t-button 
                variant="outline" 
                size="small" 
                @click="processFile(file)"
                :disabled="file.status === 'processing'"
                class="action-btn"
              >
                <t-icon name="play" size="14px" />
                处理
              </t-button>
              <t-button 
                variant="outline" 
                size="small" 
                @click="removeFile(file.id)"
                class="action-btn"
              >
                <t-icon name="delete" size="14px" />
              </t-button>
            </div>
            
            <div v-if="file.status === 'processing'" class="progress-container">
              <t-progress :percentage="file.progress" :label="false" />
              <span class="progress-text">处理中 {{ file.progress }}%</span>
            </div>
          </div>
        </div>
        
        <div v-else class="empty-state">
          <t-icon name="file" size="36px" />
          <p>暂无待处理文件</p>
        </div>
      </div>
      
      <!-- 右侧：处理完成区域 -->
      <div class="file-section processed-section">
        <div class="section-header">
          <t-icon name="check-circle" size="20px" />
          <h2>处理完成</h2>
          <span class="badge">{{ processedFiles.length }}</span>
        </div>
        
        <div class="file-list" v-if="processedFiles.length > 0">
          <div v-for="file in processedFiles" :key="file.id" class="file-item">
            <div class="file-info">
              <t-icon name="file-excel" size="24px" />
              <div class="file-details">
                <div class="file-name">{{ file.name }}</div>
                <div class="file-status">
                  <t-icon name="check-circle" size="14px" />
                  <span>已添加abc工作表</span>
                </div>
              </div>
            </div>
            
            <div class="file-actions">
              <t-button 
                theme="success" 
                size="small" 
                @click="downloadFile(file)"
                class="action-btn"
              >
                <t-icon name="download" size="14px" />
                下载
              </t-button>
              <t-button 
                variant="outline" 
                size="small" 
                @click="removeFile(file.id)"
                class="action-btn"
              >
                <t-icon name="delete" size="14px" />
              </t-button>
            </div>
          </div>
        </div>
        
        <div v-else class="empty-state">
          <t-icon name="file-check" size="36px" />
          <p>暂无处理完成文件</p>
        </div>
      </div>
    </div>
    
    <footer class="app-footer">
      <p>© {{ new Date().getFullYear() }} yangzijiang</p>
    </footer>
  </div>
</template>

<style scoped>
.excel-processor-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4edf5 100%);
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  overflow: hidden;
}

.app-header {
  text-align: center;
  padding: 24px;
  background: linear-gradient(90deg, #2c3e50, #4a6491);
  color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  position: relative;
  z-index: 10;
}

.app-header h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 600;
}

.app-header p {
  margin: 8px 0 0;
  opacity: 0.9;
  font-size: 16px;
}

.main-content {
  display: flex;
  flex: 1;
  padding: 24px;
  gap: 24px;
  overflow: hidden;
}

.file-section {
  flex: 1;
  background: white;
  border-radius: 12px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0; /* 防止内容溢出 */
}

.pending-section {
  border-top: 4px solid #5a78ed;
}

.processed-section {
  border-top: 4px solid #00b578;
}

.section-header {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  background-color: #f9fbfd;
  border-bottom: 1px solid #eaeef5;
  flex-wrap: wrap;
}

.section-header h2 {
  margin: 0 12px;
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
}

.section-header .badge {
  background: #00b578;
  color: white;
  border-radius: 12px;
  padding: 2px 10px;
  font-size: 14px;
  font-weight: 500;
  margin-left: 8px;
}

.actions {
  display: flex;
  gap: 12px;
  margin-left: auto;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
}

.drop-zone {
  border: 2px dashed #d1d9e6;
  border-radius: 8px;
  margin: 20px;
  padding: 40px 20px;
  text-align: center;
  background-color: #f8fafd;
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
}

.drop-zone.active {
  border-color: #5a78ed;
  background-color: rgba(90, 120, 237, 0.05);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(90, 120, 237, 0.15);
}

.drop-content {
  color: #5f6b7f;
  pointer-events: none;
}

.drop-content p {
  margin: 12px 0;
  font-size: 16px;
}

.hint {
  font-size: 14px;
  opacity: 0.7;
}

.upload-btn {
  margin-top: 20px;
  pointer-events: auto;
}

.upload-label {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

.file-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px 20px;
}

.file-item {
  display: flex;
  flex-direction: column;
  padding: 16px;
  margin-bottom: 12px;
  border-radius: 8px;
  background: #f9fbfd;
  border: 1px solid #eaeef5;
  transition: all 0.2s ease;
}

.file-item.processing {
  border-left: 3px solid #5a78ed;
}

.file-item.success {
  border-left: 3px solid #00b578;
}

.file-item.error {
  border-left: 3px solid #e34d59;
}

.file-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
  border-color: #d1d9e6;
}

.file-info {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.file-details {
  flex: 1;
  margin-left: 12px;
  min-width: 0; /* 防止文件名溢出 */
}

.file-name {
  font-weight: 500;
  color: #2c3e50;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 13px;
  color: #5f6b7f;
}

.file-status {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #00b578;
  margin-top: 4px;
}

.file-status span {
  margin-left: 4px;
}

.file-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.progress-container {
  margin-top: 12px;
}

.progress-text {
  display: block;
  text-align: center;
  font-size: 13px;
  color: #5a78ed;
  margin-top: 4px;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #a3a9b6;
  padding: 40px;
}

.empty-state p {
  margin-top: 16px;
  font-size: 16px;
}

.app-footer {
  text-align: center;
  padding: 16px;
  background: #f0f4f8;
  color: #5f6b7f;
  font-size: 14px;
  border-top: 1px solid #eaeef5;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .main-content {
    flex-direction: column;
  }
  
  .file-section {
    min-height: 400px;
  }
  
  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .actions {
    margin-left: 0;
    width: 100%;
    justify-content: flex-end;
  }
}
</style>