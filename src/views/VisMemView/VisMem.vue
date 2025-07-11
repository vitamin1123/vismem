<template>
  <div class="post-container">
    <!-- 全局加载遮罩层 -->
    <van-overlay :show="isLoading" z-index="9999">
      <div class="loading-wrapper">
        <van-loading size="24px" type="spinner" color="#1989fa" vertical>
          提交中...
        </van-loading>
      </div>
    </van-overlay>

    <van-notice-bar
      left-icon="volume-o"
      :text="slogan+'值班干部签到表，点击加号新增签到记录'"
      mode="closeable"
      color="#1989fa" 
      background="#ecf9ff"
    />
    <van-field
      v-if="showCompanySelect"
      v-model="selectedCompany"
      label="选择公司"
      is-link
      readonly
      clickable
      @click="showCompanyPicker = true"
    />
    <van-popup v-model:show="showCompanyPicker" position="bottom">
      <van-picker
        show-toolbar
        :columns="companyList"
        @confirm="onCompanyConfirm"
        @cancel="showCompanyPicker = false"
      />
    </van-popup>

    <van-floating-bubble
      v-model:offset="offset"
      axis="xy"
      icon="plus"
      magnetic="x"
      @click="click_bubble"
    />

    <van-popup v-model:show="showTop" position="top" :style="{ height: '90%' }" round>
      <div class="popup-content">
        <!-- 输入框 -->
        <van-field
          v-model="inputText"
          type="textarea"
          rows="3"
          maxlength="200"
          placeholder="请输入内容"
          :autofocus="true"
          class="input-field"
          :disabled="isLoading"
        />

        <!-- 上传组件 -->
        <van-uploader 
          ref="uploaderRef" 
          v-model="fileList" 
          multiple 
          :max-count="9" 
          accept="image/png" 
          class="uploader"  
          :before-read="beforeRead"
          :after-read="afterRead"
          upload-icon="plus"
          :disabled="isLoading"
        />

        <!-- 分割符 -->
        <van-divider :style="{ color: '#8a8a8a', borderColor: '#8a8a8a', padding: '0 2rem' }"/>

        <!-- 定位信息 -->
        <div class="location-info">
          <van-icon name="location-o" class="location-icon" color="#44587D" />
          <span class="location-text">{{ loca }}</span>
        </div>
        <van-button
          type="primary"
          block
          @click="submitPost"
          class="submit-button"
          :disabled="isLoading"
        >
          发表
        </van-button>
      </div>
    </van-popup>

    <lazy-component v-for="(post, index) in posts" :key="index">
      <template #loading>
        <div class="loading-placeholder">加载中...</div>
      </template>
      <div class="post-card">
        <!-- 用户信息和发布时间 -->
        <div class="post-header">
          <img class="avatar" :src="post.avatar" alt="avatar" />
          <div>
            <div class="username">{{ post.person }}</div>
            <div class="timestamp">{{ post.timestamp }}</div>
          </div>
        </div>

        <!-- 发布内容、图片和定位，向右移动 -->
        <div class="post-body">
          <!-- 发布内容 -->
          <div class="post-content">
            <p>{{ post.content }}</p>
          </div>

          <!-- 图片展示 -->
          <van-grid :column-num="post.gridColumn" :border="false">
            <van-grid-item v-for="(image, index) in post.images" :key="index" @click="click_img(post, index)">
              <van-image :src="image" lazy-load fit="cover" :class="post.images.length > 1 ? 'multi-image' : ''" />
            </van-grid-item>
          </van-grid>

          <!-- 定位信息 -->
          <div class="location">
            <van-icon name="location-o" class="location-icon" color="#44587D" />
            <span style="color: #44587D;">{{ post.location }}</span>
          </div>
          <van-button
            v-if="canDeletePost(post)"
            color="#7232dd"
            size="mini"
            @click="deletePost(post)"
            class="delete-button"
            :disabled="isLoading"
          >
            删除
          </van-button>
        </div>
      </div>
    </lazy-component>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { showImagePreview, showToast } from 'vant';
import Compressor from 'compressorjs';
import type { UploaderInstance, UploaderFileListItem, UploaderBeforeRead } from 'vant';
import { useAuthStore } from '@/store/authStore'
import apiClient from '@/plugins/axios'
const user = useAuthStore();
const loca = ref('江苏省')
const fileList = ref<UploaderFileListItem[]>([]);
const showTop = ref(false);
const inputText = ref('');
const showCompanyPicker = ref(false);
const selectedCompany = ref('');
const selectedCompanyCode = ref('')
const companyList = ref<CompanyOption[]>([]);
const offset = ref({ x: 300, y: 100 });
const slogan = ref('')
const isLoading = ref(false); // 新增加载状态

// 计算初始位置
const calculateOffset = () => {
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  offset.value = {
    x: windowWidth - 70,
    y: windowHeight - 200,
  };
};

// 定义每个发布项的数据结构
interface Post {
  id: string,
  avatar: string
  person: string
  timestamp: string
  content: string
  images: string[]
  location: string
  gridColumn: number
  userCode: string
}

interface VismemItem {
  ope_name: string;
  ope_time: string;
  mem: string;
  location: string;
  img1?: string;
  img2?: string;
  img3?: string;
  img4?: string;
  img5?: string;
  img6?: string;
  img7?: string;
  img8?: string;
  img9?: string;
}

interface GeolocationCoordinates {
  readonly latitude: number;
  readonly longitude: number;
  readonly altitude: number | null;
  readonly accuracy: number;
  readonly altitudeAccuracy: number | null;
  readonly heading: number | null;
  readonly speed: number | null;
}

const uploaderRef = ref<UploaderInstance>();

// 定义发布内容数组
const posts = ref<Post[]>([])

const showCompanySelect = computed(() => {
  return user.userCode === '10030203' || user.userCode === '10001007';
});

interface CompanyOption {
  text: string;
  value: string;
}

const onCompanyConfirm = async({ selectedOptions }: { selectedOptions: CompanyOption[] }) => {
  if (selectedOptions.length > 0) {
    selectedCompany.value = selectedOptions[0].text;
    selectedCompanyCode.value = selectedOptions[0].value;
    await load_post();
    showCompanyPicker.value = false;
  }
};

const canDeletePost = (post: Post) => {
  const postTime = new Date(post.timestamp).getTime();
  const currentTime = new Date().getTime();
  const timeDiff = (currentTime - postTime) / (1000 * 60);
  return post.userCode === user.userCode && timeDiff < 2;
};

const deletePost = async (post: Post) => {
  try {
    const response = await apiClient.post('/api/del_post', {
      id: post.id,
      userCode: user.userCode,
      timestamp: post.timestamp,
    });
    if (response.data.success) {
      showToast(response.data.message);
      await load_post();
    } else {
      showToast(response.data.message);
    }
  } catch (error) {
    console.error('删除失败', error);
    showToast('删除失败，请重试');
  }
};

const fetchCompanyList = async () => {
  const response = await apiClient.get('/api/company_list');
  companyList.value = response.data.map((company: { company_code: string; company_name: string }) => ({
    text: company.company_name,
    value: company.company_code,
  }));
};

const beforeRead: UploaderBeforeRead = (file, detail) => {
  return new Promise<File | File[] | undefined>((resolve) => {
    if (Array.isArray(file)) {
      const compressedFiles: File[] = [];
      let completed = 0;

      file.forEach((f) => {
        new Compressor(f, {
          quality: 0.6,
          success: (result) => {
            compressedFiles.push(result as File);
            completed++;
            if (completed === file.length) {
              resolve(compressedFiles);
            }
          },
          error: (err) => {
            console.error('Compression error:', err.message);
            completed++;
            if (completed === file.length) {
              resolve(undefined);
            }
          },
        });
      });
    } else {
      new Compressor(file, {
        quality: 0.6,
        success: (result) => {
          resolve(result as File);
        },
        error: (err) => {
          console.error('Compression error:', err.message);
          resolve(undefined);
        },
      });
    }
  });
};

const getUserLocation = (): Promise<GeolocationCoordinates> => {
  return new Promise((resolve, reject) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve(position.coords);
        },
        (error) => {
          reject(error);
        }
      );
    } else {
      reject("Geolocation is not supported by this browser.");
    }
  });
}

const checkLocationInRange = async () => {
  try {
    const userLocation = await getUserLocation();
    const res = await apiClient.post('/api/get_location', {
        userLat: userLocation.latitude,
        userLon: userLocation.longitude,
    });
    loca.value = res.data.data
  }catch (error) {
    console.error("获取定位失败", error);
  }
}

const load_user = async() => {
  try {
    const response = await apiClient.post('/api/get_vismem');
    user.userCode = response.data.userCode
    slogan.value = response.data.data[0].company_name
  } catch (error) {
    console.error('get_vismem--',error);
  }
}

const load_post = async() => {
  try {
    const response1 = await apiClient.post('/api/get_vismem_list',{
        company: selectedCompanyCode.value,
    });
    const transformedPosts = response1.data.data.map((item: any) => {
      const images = [item.img1, item.img2, item.img3, item.img4, item.img5, item.img6, item.img7, item.img8, item.img9]
        .filter(img => img).map(img => `public/${img}`);
      return {
        avatar: generateAvatar(item.ope_name),
        id: item.id,
        person: item.ope_name,
        userCode: item.ope,
        timestamp: new Date(item.ope_time).toLocaleString(),
        content: item.mem,
        images: images,
        location: item.location,
        gridColumn: images.length === 1 ? 1.5 : 3
      };
    });
    posts.value = transformedPosts;
  } catch (error) {
    console.error('get_vismem_list--',error);
  }
}

const load = async() => {
  try {
    await load_user()
    await load_post()
  } catch (error) {
    console.error(error);
  }
};

const afterRead = (file:UploaderFileListItem | UploaderFileListItem[]) => {
  if (Array.isArray(file)) {
    file.forEach(f => {
      console.log('多个文件类型:', f.file?.type);
    });
  } else {
    console.log('单个文件类型:', file.file?.type);
  }
};

const submitPost = async () => {
  if (!inputText.value.trim() && fileList.value.length === 0) {
    showToast('请输入内容或上传图片');
    return;
  }

  isLoading.value = true;

  try {
    const formData = new FormData();
    formData.append('content', inputText.value);
    formData.append('location', loca.value);

    fileList.value.forEach((file) => {
      if (file.file) {
        formData.append('files', file.file);
      }
    });

    const response = await apiClient.post('/api/submit_nagezhiban', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (response.data.success) {
      showToast('发表成功');
      inputText.value = '';
      fileList.value = [];
      await load_post();
      showTop.value = false;
    } else {
      showToast('发表失败，请重试');
    }
  } catch (error) {
    console.error('提交失败', error);
    showToast('提交失败，请重试');
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await apiClient.post('/api/log_error', {
        error: errorMessage,
        functionName: 'submitPost',
        location: 'frontend'
      });
    } catch (logError) {
      console.error('日志发送失败', logError);
    }
  } finally {
    isLoading.value = false;
  }
};

const click_bubble = async() => {
  await checkLocationInRange();
  showTop.value = true;
}

const getRandomColor = (): string => {
  const maxColorValue = 200;
  const r = Math.floor(Math.random() * maxColorValue);
  const g = Math.floor(Math.random() * maxColorValue);
  const b = Math.floor(Math.random() * maxColorValue);
  
  if (r > 180 && g > 180 && b > 180) {
    return getRandomColor();
  }

  return `rgb(${r},${g},${b})`;
}

const generateAvatar = (person: string): string => {
  const lastChar = person.charAt(person.length - 1);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    const size = 100;
    canvas.width = size;
    canvas.height = size;
    const backgroundColor = getRandomColor();
    
    ctx.fillStyle = backgroundColor; 
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#fff';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(lastChar, size / 2, size / 2);

    return canvas.toDataURL('image/png');
  }
  return '';
}

const click_img =(post: Post, index: number)=>{
  showImagePreview({
    images: post.images,
    startPosition: index,
  });
}

onMounted(async() => {
  calculateOffset();
  window.addEventListener('resize', calculateOffset);
  await load()
  posts.value.forEach(post => {
    post.avatar = generateAvatar(post.person);
  })
  
  if (showCompanySelect.value) {
    fetchCompanyList();
  }
})
</script>

<style lang="less" scoped>
.post-container {
  padding: 0.4rem;
}

.popup-content {
  padding: 24px;
}

.input-field {
  margin-bottom: 16px;
}

.uploader {
  margin-bottom: 16px;
}

.location-info {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 16px;
}

.location-icon {
  margin-right: 8px;
}

.location-text {
  color: #151a32;
}

.post-card {
  margin-bottom: 0.5rem;
  border: 1px solid #ebebeb;
  border-radius: 8px;
  padding: 0.7rem;
  background-color: #fff;
  position: relative;
}

.post-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.avatar {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  margin-right: 0.5rem;
}

.username {
  font-weight: bold;
}

.timestamp {
  font-size: 0.9rem;
  color: #6e6d6d;
}

.post-body {
  margin-left: 3rem;
}

.post-content {
  margin-bottom: 0.5rem;
}

.post-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.location {
  display: flex;
  align-items: center;
  margin-top: 8px;
}

.delete-button {
  position: absolute;
  bottom: 8px;
  right: 8px;
}

.multi-image {
  width: 20vw;
  height: 27vw;
}

.submit-button {
  margin-top: 2rem;
  width: 80%;
  display: block;
  margin-left: auto;
  margin-right: auto;
}

.loading-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>