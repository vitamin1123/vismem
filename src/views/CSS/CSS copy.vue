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
const mappingData = ref<Map<string, { code: string; name: string }>>(new Map());
const mappingFile = ref<ExcelFile | null>(null);
const mappingStatus = ref<'waiting' | 'processing' | 'success' | 'error'>('waiting');

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

// 处理对照表文件
const handleMappingFile = async (file: File) => {
  mappingStatus.value = 'processing';
  
  try {
    const reader = new FileReader();
    const data = await new Promise<ArrayBuffer>((resolve, reject) => {
      reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
    
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames.find(name => name.includes('YSS1.0'));
    
    if (!sheetName) {
      throw new Error('未找到YSS1.0工作表');
    }
    
    const worksheet = workbook.Sheets[sheetName];
    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // 查找表头索引
    const headers = jsonData[0];
    const codeIndex = headers.indexOf('1.0班组编码');
    const newCodeIndex = headers.indexOf('对应YSS2.0班组代码');
    const newNameIndex = headers.indexOf('对应YSS2.0班组名称');
    
    if (codeIndex === -1 || newCodeIndex === -1 || newNameIndex === -1) {
      throw new Error('对照表缺少必要列');
    }
    
    // 创建映射字典
    const map = new Map();
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      const oldCode = row[codeIndex];
      if (oldCode) {
        map.set(oldCode, {
          code: row[newCodeIndex],
          name: row[newNameIndex]
        });
      }
    }
    
    mappingData.value = map;
    mappingFile.value = {
      id: `mapping-${Date.now()}`,
      name: file.name,
      size: file.size,
      rawFile: file,
      status: 'success',
      progress: 100
    };
    mappingStatus.value = 'success';
    MessagePlugin.success('对照表解析成功');
  } catch (error) {
    console.error('解析对照表出错:', error);
    mappingStatus.value = 'error';
    MessagePlugin.error(`解析对照表失败: ${(error as Error).message}`);
  }
};

// 处理文件 - 替换班组信息（保留样式）
const processFile = async (file: ExcelFile) => {
  file.status = 'processing';
  file.progress = 0;
  
  let interval: number | null = null;
  
  try {
    // 检查对照表是否加载
    if (mappingData.value.size === 0) {
      throw new Error('请先上传并解析对照表');
    }
    
    // 模拟进度更新
    interval = setInterval(() => {
      if (file.progress < 90) {
        file.progress += 10;
      }
    }, 200) as unknown as number;
    
    // 读取Excel文件（保留所有样式信息）
    const reader = new FileReader();
    const data = await new Promise<ArrayBuffer>((resolve, reject) => {
      reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file.rawFile);
    });
    
    // 处理Excel（保留原始样式）
    const workbook = XLSX.read(data, { type: 'array', cellStyles: true });
    
    // 处理每个工作表
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet['!ref']) return;
      
      // 解析工作表范围
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      
      // 处理表头行 (第一行)
      for (let col = 8; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        const cell = worksheet[cellAddress];
        
        if (cell && cell.v && typeof cell.v === 'string') {
          // 移除非汉字字符（保留原始样式）
          const originalStyle = cell.s; // 保存原始样式
          cell.v = cell.v.replace(/[^\u4e00-\u9fa5]/g, '');
          cell.s = originalStyle; // 恢复原始样式
          delete cell.w; // 删除格式化的文本值，让Excel重新生成
        }
      }
      
      // 处理数据行 (从第三行开始)
      for (let row = 2; row <= range.e.r; row++) {
        // 获取C列单元格
        const cCellAddress = XLSX.utils.encode_cell({ r: row, c: 2 });
        const cCell = worksheet[cCellAddress];
        
        if (cCell && cCell.v && mappingData.value.has(cCell.v)) {
          const mapping = mappingData.value.get(cCell.v)!;
          
          // 检查是否应该替换
          if (mapping.code === '无' || 
              mapping.code === '已取消该班组' || 
              mapping.code === '不录入工时' || 
              mapping.code === '不需要') {
            // C列清空（保留样式）
            if (worksheet[cCellAddress]) {
              const originalStyle = worksheet[cCellAddress].s;
              worksheet[cCellAddress].v = '';
              worksheet[cCellAddress].s = originalStyle;
              delete worksheet[cCellAddress].w;
            }
            
            // D列清空（保留样式）
            const dCellAddress = XLSX.utils.encode_cell({ r: row, c: 3 });
            if (worksheet[dCellAddress]) {
              const originalStyle = worksheet[dCellAddress].s;
              worksheet[dCellAddress].v = '';
              worksheet[dCellAddress].s = originalStyle;
              delete worksheet[dCellAddress].w;
            }
          } else {
            // 替换C列值（保留样式）
            if (worksheet[cCellAddress]) {
              const originalStyle = worksheet[cCellAddress].s;
              worksheet[cCellAddress].v = mapping.code;
              worksheet[cCellAddress].s = originalStyle;
              delete worksheet[cCellAddress].w;
            }
            
            // 替换D列值（保留样式）
            const dCellAddress = XLSX.utils.encode_cell({ r: row, c: 3 });
            if (worksheet[dCellAddress]) {
              const originalStyle = worksheet[dCellAddress].s;
              worksheet[dCellAddress].v = mapping.name;
              worksheet[dCellAddress].s = originalStyle;
              delete worksheet[dCellAddress].w;
            } else {
              // 如果D列单元格不存在，创建新单元格（使用C列单元格的样式）
              const styleRef = worksheet[XLSX.utils.encode_cell({ r: row, c: 2 })] || 
                             worksheet[XLSX.utils.encode_cell({ r: row, c: 1 })] || 
                             worksheet[XLSX.utils.encode_cell({ r: row, c: 4 })];
              worksheet[dCellAddress] = {
                v: mapping.name,
                t: 's',
                s: styleRef ? {...styleRef.s} : {} // 复制样式对象
              };
            }
          }
        }
      }
    });
    
    // 生成处理后的Excel
    const wbout = XLSX.write(workbook, { 
      bookType: 'xlsx', 
      type: 'array',
      bookSST: true,
      cellStyles: true // 保留样式
    });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // 更新文件状态
    file.processedBlob = blob;
    file.status = 'success';
    file.progress = 100;
    
    if (interval) clearInterval(interval);
    MessagePlugin.success(`"${file.name}" 处理完成（保留原始样式）`);
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
  
  if (mappingData.value.size === 0) {
    MessagePlugin.warning('请先上传并解析对照表');
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

// 添加对照表点击上传支持
const handleMappingInput = (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    handleMappingFile(input.files[0]);
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
      <p>请先上传对照表，再处理Excel文件（保留原始样式）</p>
    </header>
    
    <div class="main-content">
      <!-- 左侧：对照表区域 -->
      <div class="file-section mapping-section">
        <div class="section-header">
          <t-icon name="file-settings" size="20px" />
          <h2>班组对照表</h2>
          <div class="status-badge" :class="mappingStatus">
            {{ 
              mappingStatus === 'waiting' ? '等待上传' : 
              mappingStatus === 'processing' ? '解析中' : 
              mappingStatus === 'success' ? '已加载' : '错误'
            }}
          </div>
        </div>
        
        <div class="mapping-info" v-if="mappingFile">
          <div class="file-info">
            <t-icon name="file-excel" size="24px" />
            <div class="file-details">
              <div class="file-name">{{ mappingFile.name }}</div>
              <div class="file-size">{{ (mappingFile.size / 1024).toFixed(1) }} KB</div>
              <div class="mapping-stats">
                已加载 {{ mappingData.size }} 条班组对照关系
              </div>
            </div>
          </div>
        </div>
        
        <div 
          class="drop-zone"
          :class="{ active: activeDrag }"
          @dragover.prevent="handleDragOver"
          @dragleave="handleDragLeave"
          @drop.prevent="(e) => { 
            if (e.dataTransfer?.files.length) {
              handleMappingFile(e.dataTransfer.files[0])
            }
          }"
        >
          <div class="drop-content">
            <t-icon name="file-settings" size="36px" />
            <p>拖拽对照表文件到此处</p>
            <p class="hint">需包含YSS1.0工作表的Excel文件</p>
            <t-button variant="outline" class="upload-btn">
              <label for="mapping-upload" class="upload-label">
                <t-icon name="folder" />
                选择文件
              </label>
            </t-button>
            <input 
              id="mapping-upload"
              type="file" 
              accept=".xlsx, .xls, .xlsm"
              @change="handleMappingInput"
              style="display: none;"
            />
          </div>
        </div>
        
        <div class="mapping-instructions">
          <h3>对照表要求：</h3>
          <ul>
            <li>必须包含名为"YSS1.0"的工作表</li>
            <li>工作表需包含列：1.0班组编码、对应YSS2.0班组代码、对应YSS2.0班组名称</li>
            <li>系统将根据1.0班组编码替换Excel中的班组信息</li>
            <li>原始Excel的所有样式（合并单元格、颜色、边框等）将被保留</li>
          </ul>
        </div>
      </div>
      
      <!-- 中间：待处理区域 -->
      <div class="file-section pending-section">
        <div class="section-header">
          <t-icon name="time" size="20px" />
          <h2>待处理文件</h2>
          <div class="actions">
            <t-button 
              :disabled="pendingFiles.length === 0 || isProcessing || mappingData.size === 0" 
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
          @dragover.prevent="handleDragOver"
          @dragleave="handleDragLeave"
          @drop.prevent="(e) => { 
            addFiles(e.dataTransfer?.files || null) 
          }"
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
                :disabled="file.status === 'processing' || mappingData.size === 0"
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
                  <span>班组信息已替换（保留样式）</span>
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
  min-width: 0;
}

.mapping-section {
  border-top: 4px solid #ff9800;
  flex: 0.8;
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

.status-badge {
  background: #ff9800;
  color: white;
  border-radius: 12px;
  padding: 4px 10px;
  font-size: 14px;
  font-weight: 500;
  margin-left: 8px;
}

.status-badge.success {
  background: #00b578;
}

.status-badge.error {
  background: #e34d59;
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
  min-width: 0;
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

.mapping-stats {
  font-size: 13px;
  color: #ff9800;
  margin-top: 4px;
  font-weight: 500;
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

.mapping-info {
  padding: 0 20px 20px;
}

.mapping-instructions {
  padding: 0 20px 20px;
  color: #5f6b7f;
}

.mapping-instructions h3 {
  margin: 0 0 10px;
  font-size: 15px;
  color: #2c3e50;
}

.mapping-instructions ul {
  margin: 0;
  padding-left: 20px;
}

.mapping-instructions li {
  margin-bottom: 6px;
  font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .main-content {
    flex-direction: column;
  }
  
  .file-section {
    min-height: 300px;
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
  
  .mapping-section {
    flex: 1;
  }
}
</style>