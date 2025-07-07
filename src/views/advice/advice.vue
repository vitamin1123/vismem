<template>
  <div class="suggestion-page">
     <van-collapse v-model="activeNames">
      <van-collapse-item name="1">
        <template #title>
          <div class="logo-placeholder">
            <van-image 
              :src="logo" 
              fit="contain" 
              width="140px" 
              height="40px" 
            />
          </div>
        </template>
        
        <!-- 弹幕区域 -->
        <van-barrage v-model="barrageList" class="barrage-container">
          <div class="barrage-video" style="width: 100%; height: 150px"></div>
        </van-barrage>
      </van-collapse-item>
    </van-collapse>

    <div class="page-title">
      <h2>员工建议通道</h2>
      <p>您的每一个建议，我们都认真倾听</p>
    </div>

    <van-form ref="formRef" @submit="onSubmit">
      <van-cell-group inset title="1. 请选择您想反馈的问题类别">
        <van-radio-group v-model="selectedCategory">
          <van-cell-group>
            <van-cell 
              v-for="item in categories" 
              :key="item.value" 
              :title="item.text"
              clickable 
              @click="selectedCategory = item.value"
            >
              <template #right-icon>
                <van-radio :name="item.value" />
              </template>
              <template #label v-if="item.value === 'canteen'">
                <div class="canteen-label">{{ item.subText }}</div>
              </template>
            </van-cell>
          </van-cell-group>
        </van-radio-group>
        
        <div v-if="selectedCategory">
          <van-field
            v-model="suggestionText"
            class="suggestion-textarea"
            rows="4"
            autosize
            label="具体说明"
            type="textarea"
            maxlength="200"
            placeholder="请详细描述您的问题或建议..."
            show-word-limit
            :rules="[{ 
              required: true, 
              message: '请填写具体说明',
              validator: (value) => value.trim().length > 0
            }]"
          />
        </div>
      </van-cell-group>
      <van-cell-group inset title="上传图片(可选，最多3张)">
              <van-field name="uploader">
                <template #input>
                  <van-uploader
                    v-model="uploadedImages"
                    :max-count="3"
                    :before-read="beforeRead"
                    @delete="handleDeleteImage"
                    @failed="handleUploadFailed"
                    preview-size="80px"
                    :deletable="true"
                    :preview-image="true"
                  />
                </template>
              </van-field>
            </van-cell-group>
      <!-- 是否期望回复 -->
      <van-cell-group inset>
        <van-cell title="是否期望得到回复">
          <template #right-icon>
            <van-switch v-model="expectReply" size="24" />
          </template>
        </van-cell>
      </van-cell-group>

      <!-- 仅在期望回复时显示个人信息 -->
      <van-cell-group v-if="expectReply" inset title="请填写您的信息">
        <van-field
          v-model="employeeId"
          name="工号"
          label="工号"
          placeholder="请输入您的8位工号"
          maxlength="8"
          :rules="[{ required: true, pattern: /^\d{8}$/, message: '请输入8位数字工号' }]"
        />
        <van-field
          v-model="employeeName"
          name="姓名"
          label="姓名"
          placeholder="请输入您的姓名"
          :rules="[{ 
            required: true, 
            message: '请填写姓名',
            validator: (value) => value.trim().length > 0
          }]"
        />
        <van-field
          v-model="contactInfo"
          name="联系方式"
          label="联系方式"
          placeholder="请输入联系方式"
          :rules="[{ 
            required: true, 
            message: '请填写联系方式',
            validator: (value) => value.trim().length > 0
          }]"
        />
      </van-cell-group>

      <div style="margin: 24px 16px;">
        <van-button round block type="primary" native-type="submit" :loading="submitting">
          {{ submitting ? '提交中...' : '提交建议' }}
        </van-button>
      </div>
    </van-form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { showToast, showFailToast, type FormInstance,  showConfirmDialog  } from 'vant';
import apiClient from '@/plugins/axios';
import logo from '@/assets/logo.svg';
import Compressor from 'compressorjs'; // 图片压缩库
import { v4 as uuidv4 } from 'uuid'; // 用于生成唯一文件名
import type { UploaderFileListItem } from 'vant';
// 定义问题类别的数据结构
interface Category {
  text: string;
  value: string;
  subText?: string;
}
interface ExtendedUploaderFileListItem extends UploaderFileListItem {
  serverFile?: string;
}
// 表单响应式数据
const selectedCategory = ref<string>('');
const suggestionText = ref('');
const employeeId = ref('');
const employeeName = ref('');
const contactInfo = ref('');
const expectReply = ref(false); // 是否期望回复
const formRef = ref<FormInstance>(); // 表单引用
const submitting = ref(false); // 提交状态
const userAgent = ref(''); // 用户UA信息

// 弹幕相关
const activeNames = ref(['1']); // 默认展开第一个折叠面板
const barrageList = ref<{ id: number; text: string }[]>([]);
const allBarrages = ref<{ id: string; text: string }[]>([]); // 存储所有弹幕
let timer: number | null = null; // 定时器引用

// 图片上传相关
const uploadedImages = ref<ExtendedUploaderFileListItem[]>([]); 
const tempImages = ref<string[]>([]); // 存储临时上传的图片文件名

// 图片上传前的处理（压缩和验证）
const beforeRead = (file: File | File[]): Promise<File | File[]> => {
  return new Promise((resolve, reject) => {
    // 处理多个文件的情况
    if (Array.isArray(file)) {
      // 递归处理每个文件
      const processedFiles = file.map(f => processSingleFile(f));
      Promise.all(processedFiles)
        .then(resolve)
        .catch(reject);
      return;
    }
    
    // 处理单个文件
    processSingleFile(file).then(resolve).catch(reject);
  });
};

// 更新 processSingleFile 方法，明确参数类型为 File
const processSingleFile = (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      showFailToast('请上传图片文件');
      reject(new Error('文件类型错误'));
      return;
    }
    
    // 检查文件大小（限制5MB）
    if (file.size > 5 * 1024 * 1024) {
      showFailToast('图片大小不能超过5MB');
      reject(new Error('文件过大'));
      return;
    }
    console.log('原始文件:', file.name, '类型:', file.type, '大小:', file.size);
    // 显示确认对话框
    showConfirmDialog({
      title: '上传图片',
      message: '确认上传这张图片吗？',
    })
    .then(() => {
      // 使用compressorjs压缩图片
       new Compressor(file, {
      quality: 0.6,
      success(blob) {
        // 修复: 确保保留原始类型
        const mimeType = blob.type || file.type;
        
        // 调试输出
        console.log('压缩后类型:', mimeType, '大小:', blob.size);
        
        resolve(new File(
          [blob], 
          file.name,
          { type: mimeType } // 保留原始MIME类型
        ));
      },
      error(err) {
        console.error('压缩错误:', err);
        reject(new Error('图片处理失败'));
      }
      });
    })
    .catch(() => {
      // 用户取消上传
      reject(new Error('USER_CANCEL'));
    });
  });
};

// 更新 handleUploadFailed 方法
const handleUploadFailed = (error: any) => {
  if (error.message === 'USER_CANCEL') {
    // 用户取消，不显示错误
    return;
  }
  
  // 显示特定错误信息
  let message = '图片上传失败';
  if (error.message === '文件类型错误') message = '请上传图片文件';
  if (error.message === '文件过大') message = '图片大小不能超过5MB';
  
  showFailToast(message);
};

// 删除图片处理
const handleDeleteImage = async (file: any, { index }: { index: number }) => {
  const image = uploadedImages.value[index];
  
  if (image.serverFile) {
    try {
      // 调用后端删除图片接口
      await apiClient.post('/api/delete_image', { filename: image.serverFile });
      
      // 从临时列表中移除
      const tempIndex = tempImages.value.indexOf(image.serverFile);
      if (tempIndex !== -1) {
        tempImages.value.splice(tempIndex, 1);
      }
    } catch (error) {
      console.error('删除图片失败:', error);
      showFailToast('删除图片失败');
    }
  }
  
  // 从上传列表中移除
  uploadedImages.value.splice(index, 1);
};

// 上传所有图片到服务器
const uploadImages = async () => {
  const uploadedFiles: string[] = [];
  
  for (const item of uploadedImages.value) {
    if (!item.file) continue;
    
    try {
      
      const formData = new FormData();
      formData.append('file', item.file);
      
      const response = await apiClient.post('/api/upload_image', formData);
      
      if (response.data.code === 0) {
        item.serverFile = response.data.data.filename;
        uploadedFiles.push(response.data.data.filename);
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      console.error('图片上传失败:', error);
      showFailToast('图片上传失败');
      throw error; // 中断整个提交
    }
  }
  
  return uploadedFiles.join('|');
};

// 清理未提交的图片
const cleanupUnsubmittedImages = async () => {
  if (tempImages.value.length === 0) return;
  
  try {
    // 调用后端清理接口
    await apiClient.post('/api/cleanup_images', { filenames: tempImages.value });
    console.log('清理未提交图片成功:', tempImages.value);
  } catch (error) {
    console.error('清理图片失败:', error);
  } finally {
    tempImages.value = [];
  }
};


// 获取弹幕数据
const fetchBarrageList = async () => {
  try {
    const response = await apiClient.get('/api/get_latest_advices');
    
    if (response.data.code === 0 && Array.isArray(response.data.data)) {
      // 保存所有弹幕
      allBarrages.value = response.data.data;
      
      // 启动弹幕循环
      startBarrageLoop();
    } else {
      console.error('获取弹幕失败:', response.data.message);
    }
  } catch (error) {
    console.error('请求弹幕失败:', error);
  }
};

// 启动弹幕循环
const startBarrageLoop = () => {
  // 清除现有定时器
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  
  // 设置随机间隔的定时器 (0.5秒到3秒之间)
  timer = setInterval(() => {
    addBarrage();
    
    // 定期清理过期的弹幕（防止内存占用过大）
    if (barrageList.value.length > 100) {
      barrageList.value = barrageList.value.slice(-50);
    }
  }, getRandomInterval(500, 3000)) as unknown as number;
};

// 获取随机时间间隔
const getRandomInterval = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (tempImages.value.length > 0) {
    cleanupUnsubmittedImages();
  }
});
// 添加弹幕
const addBarrage = () => {
  if (allBarrages.value.length === 0) return;
  
  // 随机选择一条弹幕
  const randomIndex = Math.floor(Math.random() * allBarrages.value.length);
  const barrage = allBarrages.value[randomIndex];
  
  // 添加到显示列表
  barrageList.value.push({
    id: Number(Date.now()), // 确保ID唯一
    text: barrage.text
  });
};

// 问题类别选项
const categories = ref<Category[]>([
  { text: '工作环境', value: 'work_environment' },
  { text: '部门沟通', value: 'communication' },
  { text: '薪资福利', value: 'salary_benefits' },
  { text: '企业文化', value: 'culture' },
  { 
    text: '食堂餐饮', 
    value: 'canteen', 
    subText: '大楼食堂(小炒)、大楼食堂(快餐)、南食堂(一号食堂)、中舟食堂、生活区食堂'
  },
  { text: '宿舍服务', value: 'dormitory' },
  { text: '其他', value: 'other' },
]);

// 表单提交
const onSubmit = async () => {
  
  // 验证是否选择了类别
  if (!selectedCategory.value) {
    showFailToast('请选择问题类别');
    return;
  }
  
  // 验证具体说明是否为空
  if (!suggestionText.value.trim()) {
    showFailToast('具体说明不能为空');
    return;
  }
  
  // 如果期望回复，验证个人信息
  if (expectReply.value) {
    // 验证工号格式
    if (!/^\d{8}$/.test(employeeId.value)) {
      showFailToast('工号必须是8位数字');
      return;
    }
    
    // 验证姓名和联系方式
    if (!employeeName.value.trim() || !contactInfo.value.trim()) {
      showFailToast('请填写完整的个人信息');
      return;
    }
  }
  let photoField = '';
  try {
    submitting.value = true;
    if (uploadedImages.value.length > 0) {
      photoField = await uploadImages();
    }
    const submitData = {
      category: selectedCategory.value,
      suggestion: suggestionText.value.trim(),
      expectReply: expectReply.value,
      userAgent: navigator.userAgent, // 添加用户UA信息
      photo: photoField,
      // 仅在期望回复时提交个人信息
      ...(expectReply.value && {
        employeeId: employeeId.value,
        employeeName: employeeName.value.trim(),
        contactInfo: contactInfo.value.trim()
      })
    };

    const response = await apiClient.post('/api/upload_advice', submitData);

    if (response.data.code === 0) {
      showToast('提交成功！感谢您的建议');
      
      // 重置表单
      selectedCategory.value = '';
      suggestionText.value = '';
      employeeId.value = '';
      employeeName.value = '';
      contactInfo.value = '';
      expectReply.value = false;
      uploadedImages.value = [];
      
      // 清空临时图片列表（已成功提交）
      tempImages.value = [];
      // 刷新弹幕列表
      fetchBarrageList();
    } else {
      showToast(response.data.message || '提交失败');
    }
  } catch (error) {
    if ((error as any).response?.status === 429) {
      showToast('提交过于频繁，请稍后再试');
    } else {
      showToast('提交失败，请稍后重试');
      console.error('提交错误:', error);
    }
  } finally {
    submitting.value = false;
  }
};

// 页面加载时获取弹幕数据
onMounted(() => {
  fetchBarrageList();
});
</script>

<style scoped>
/* 整体页面样式 */
.suggestion-page {
  background-color: #f7f8fa;
  min-height: 100vh;
  padding-bottom: 20px;
}

/* Logo 占位符样式 */
.logo-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  /* 您可以在这里设置 logo 的具体样式 */
}

/* 顶部导航栏样式 */
:deep(.van-nav-bar) {
  background-color: #f7f8fa;
}

/* 页面主标题 */
.page-title {
  padding: 16px 24px;
}
.page-title h2 {
  font-size: 24px;
  color: #1a1a1a;
  font-weight: 600;
  margin: 0 0 8px 0;
}
.page-title p {
  font-size: 14px;
  color: #969799;
  margin: 0;
}

/* Vant 单元格组的标题样式，增加层次感 */
:deep(.van-cell-group__title) {
  font-size: 15px;
  font-weight: 500;
  color: #323233;
  padding: 20px 16px 10px 16px;
}

/* Vant 单元格样式微调 */
:deep(.van-cell) {
  font-size: 16px; /* 统一输入框左侧标题字体大小 */
}

/* 食堂餐饮的辅助说明文字 */
.canteen-label {
  font-size: 12px;
  color: #969799;
  line-height: 1.4;
  margin-top: 4px;
}

/* 详细说明文本域的特殊样式 */
.suggestion-textarea {
  margin-top: 8px; /* 与上方选项留出一些间距 */
}

/* 提交按钮样式 */
.van-button--primary {
  background: linear-gradient(to right, #3f8cff, #4b7dff);
  border: none;
  font-size: 16px;
  box-shadow: 0 4px 12px rgba(63, 140, 255, 0.2);
}

.barrage-container {
  width: 100%;
  height: 150px;
  background: #f7f8fa;
  border-radius: 8px;
  overflow: hidden;
}

.barrage-video {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

/* 添加图片上传样式 */
:deep(.van-uploader__upload) {
  background-color: #f7f8fa;
  border: 1px dashed #dcdee0;
}

:deep(.van-uploader__preview-image) {
  border-radius: 4px;
}

:deep(.van-uploader__preview-delete) {
  background-color: rgba(0, 0, 0, 0.7);
}
</style>