<template>
  <div class="post-container">
    <van-floating-bubble
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
         
          :autofocus = true
          class="input-field"
        />

        <!-- 上传组件 -->
        <van-uploader 
          ref="uploaderRef" 
          v-model="fileList" 
          multiple 
          :max-count="9" 
          accept="image/png, image/jpeg, image/jpg" 
          class="uploader"  
          :before-read="beforeRead"
          :after-read="afterRead"/>

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
        >
          发表
        </van-button>
      </div>
    </van-popup>

    <!-- 其他内容 -->
    <div v-for="(post, index) in posts" :key="index" class="post-card">
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
            <van-image :src="image" fit="cover" :class="post.images.length > 1 ? 'multi-image' : ''" />
          </van-grid-item>
        </van-grid>

        <!-- 定位信息 -->
        <div class="location">
          <van-icon name="location-o" class="location-icon" color="#44587D" />
          <span style="color: #44587D;">{{ post.location }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { showImagePreview } from 'vant';
import { showToast } from 'vant';
import Compressor from 'compressorjs';
import type { UploaderInstance, UploaderFileListItem } from 'vant';
import { useAuthStore } from '@/store/authStore'
import apiClient from '@/plugins/axios'
const user = useAuthStore();
const loca = ref('江苏省泰州市靖江市')
// const fileList = ref([]); 
const fileList = ref<UploaderFileListItem[]>([]);
const showTop = ref(false);
const inputText = ref('');
// 定义每个发布项的数据结构
interface Post {
  avatar: string
  person: string
  timestamp: string
  content: string
  images: string[]
  location: string
  gridColumn: number
}

const uploaderRef = ref<UploaderInstance>();

// 定义发布内容数组
const posts = ref<Post[]>([
  {
    avatar: '',
    person: '张勇',
    timestamp: '2025年02月25日 23:12:27',
    content: '分段、加工、船舶、钢结构加班正常，服务中班正常，员工在岗，其余正常。',
    images: [
      'https://pic4.zhimg.com/v2-efd4f4517d5bdb43858a04f7e4ff5f7f_r.jpg',
      'https://pic4.zhimg.com/v2-efd4f4517d5bdb43858a04f7e4ff5f7f_r.jpg',
      'https://ww3.sinaimg.cn/mw690/006dJslggy1hpvd563l7hj30u0140gw8.jpg',
      'https://pic4.zhimg.com/v2-efd4f4517d5bdb43858a04f7e4ff5f7f_r.jpg',
      'https://pic.rmb.bdstatic.com/bjh/9012d49e5e9095703195a7a92128a7b45142.jpeg',
      'https://ww3.sinaimg.cn/mw690/006dJslggy1hpvd563l7hj30u0140gw8.jpg',
      'https://pic4.zhimg.com/v2-efd4f4517d5bdb43858a04f7e4ff5f7f_r.jpg',
      'https://pic.rmb.bdstatic.com/bjh/9012d49e5e9095703195a7a92128a7b45142.jpeg'

    ],
    location: '江苏省泰州市靖江市东兴镇',
    gridColumn: 0
  },
  {
    avatar: '',
    person: '廖明东',
    timestamp: '2025年02月24日 23:59:59',
    content: '1、分段、钢结构、船舶加班正常；2、各岗位员工在岗；3、其余正常。',
    images: [
      'https://ww1.sinaimg.cn/mw690/9ef8454dgy1hu927c7ls2j21e023017j.jpg'
    ],
    location: '江苏省泰州市靖江市东兴镇',
    gridColumn: 0
  }
])

// 动态计算 grid 列数
posts.value.forEach(post => {
  post.gridColumn = post.images.length === 1 ? 1.5 : 3; // 一张图片时列数为1，其他情况下为3
})

// 判断两个经纬度之间的距离 (单位: 米)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // 地球半径，单位：米
  const φ1 = lat1 * Math.PI / 180; // 纬度转弧度
  const φ2 = lat2 * Math.PI / 180; // 纬度转弧度
  const Δφ = (lat2 - lat1) * Math.PI / 180; // 纬度差
  const Δλ = (lon2 - lon1) * Math.PI / 180; // 经度差

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // 返回距离，单位：米
}

// 获取用户当前定位
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



const formatLatLon = (longitude:any, latitude:any) => {
  // 判断经度是东经还是西经
  const lonDirection = longitude >= 0 ? '东经' : '西经';
  const lonValue = Math.abs(longitude).toFixed(4); // 保留4位小数

  // 判断纬度是北纬还是南纬
  const latDirection = latitude >= 0 ? '北纬' : '南纬';
  const latValue = Math.abs(latitude).toFixed(4); // 保留4位小数

  // 拼接字符串
  return `${lonDirection}${lonValue} | ${latDirection}${latValue}`;
};

// 限定范围（假设是某个经纬度范围内）
const checkLocationInRange = async () => {

  try {
    const userLocation = await getUserLocation();
    const userLat = userLocation.latitude;
    const userLon = userLocation.longitude;
    console.log('用户经纬度: ',userLon,userLat)
    // showToast(userLon+"   |   "+userLat)
    const url = `https://restapi.amap.com/v3/geocode/regeo?key=ff3b7440b36f1916d6e7f7f0e16930f9&s=rsv3&language=zh_cn&batch=true&location=${userLon},${userLat}&callback=jsonp_280324_&platform=JS&logversion=2.0&appname=http%3A%2F%2Fwww.atoolbox.net%2FTool.php&csid=141EE735-8687-4FA9-9D6C-E1B9FFB26CB2&sdkversion=1.4.27`
    // 使用userLon,userLat请求这个地址
   // 发送请求
   const response = await apiClient.get(url);
   const data = response.data; // 假设返回的数据在 response.data 中

// console.log('API 返回数据: ', data);

const jsonpData = data.match(/jsonp_280324_\((.*)\)/);
    if (!jsonpData || !jsonpData[1]) {
      throw new Error("返回数据格式不正确，无法解析 JSONP");
    }

    // 解析 JSON 数据
    const jsonData = JSON.parse(jsonpData[1]);
    // console.log('解析后的 JSON 数据: ', jsonData);

    // 检查返回状态并提取街道信息
    if (jsonData.status === "1" && jsonData.regeocodes && jsonData.regeocodes.length > 0) {
      const addressComponent = jsonData.regeocodes[0].addressComponent;
      const formatted_address = jsonData.regeocodes[0].formatted_address;
      const street = addressComponent.streetNumber.street;
      const number = addressComponent.streetNumber.number;
      const formattedAddress = `${formatted_address}${street}${number}`;

      console.log('拼接后的街道地址: ', formattedAddress);
      if (formattedAddress) {
        loca.value = formattedAddress;
      }else{
        loca.value = formatLatLon(userLon,userLat)
      }
      // showToast(formattedAddress); // 显示拼接后的地址
    } else {
      console.error("无法获取街道信息");
      showToast("无法获取街道信息");
    }
  } catch (error) {
    console.error("获取定位失败", error);
  }
};


const load = async() => {
    try {
      const response = await apiClient.post('/api/get_vismem');
      console.log('get_vismem--',response.data.data)
      user.userCode = response.data.userCode
      console.log('get_vismem---',user.userCode)
      

      const response1 = await apiClient.post('/api/get_vismem_list');
      console.log('get_vismem_list 返回数据:', response1.data.data); // 打印 API 返回的数据

      // 将 API 返回的数据转换为 Post 接口的结构
      const transformedPosts = response1.data.data.map((item: any) => {
        const images = [item.img1, item.img2, item.img3, item.img4, item.img5, item.img6, item.img7, item.img8, item.img9]
          .filter(img => img).map(img => `public/${img}`);// 过滤掉空字符串

        return {
          avatar: generateAvatar(item.ope_name), // 生成头像
          person: item.ope_name,
          timestamp: new Date(item.ope_time).toLocaleString(), // 格式化时间
          content: item.mem,
          images: images,
          location: item.location,
          gridColumn: images.length === 1 ? 1.5 : 3 // 动态计算 grid 列数
        };
      });

      // 更新 posts
      posts.value = transformedPosts;
    } catch (error) {
      console.error(error);
    }
    // filteredOptions.value = [...options.value];
  };

  const beforeRead = (file: any) =>
  new Promise((resolve, reject) => {
    // 使用 compressorjs 压缩图片
    new Compressor(file, {
      quality: 0.6, // 图片质量，范围：0 到 1，默认 0.8
      maxWidth: 800, // 图片最大宽度
      maxHeight: 800, // 图片最大高度
      convertSize: 1000000, // 如果图片大小超过 1MB，则转换为 JPEG 格式
      success(result: any) {
        // 压缩成功，返回压缩后的文件
        resolve(result);
      },
      error(err: any) {
        // 压缩失败，返回错误
        console.error('图片压缩失败:', err.message);
        reject(err);
      },
    });
  });

  const afterRead = (file:any) => {
      // 此时可以自行将文件上传至服务器
     // showTop.value = true;
  };

const click_bubble = () => {
    console.log('click_bubble')
    posts.value.forEach(post => {
      console.log(post.gridColumn)
  })
  showTop.value = true;
  // uploaderRef.value?.chooseFile();
  
  // 执行定位检查
  // checkLocationInRange();
}

// 生成随机颜色
const getRandomColor = (): string => {
  // 设置最大值，避免颜色太亮
  const maxColorValue = 200; // RGB 颜色的最大值设置为 200，避免接近白色

  const r = Math.floor(Math.random() * maxColorValue); // 红色
  const g = Math.floor(Math.random() * maxColorValue); // 绿色
  const b = Math.floor(Math.random() * maxColorValue); // 蓝色
  
  // 如果 RGB 值都接近 255，则调整它们的值，避免接近白色
  if (r > 180 && g > 180 && b > 180) {
    return getRandomColor(); // 递归生成一个颜色，直到找到符合条件的颜色
  }

  return `rgb(${r},${g},${b})`; // 返回 RGB 颜色
}

const generateAvatar = (person: string): string => {
  const lastChar = person.charAt(person.length - 1); // 获取最后一个字
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    const size = 100; // 头像大小
    canvas.width = size;
    canvas.height = size;
    const backgroundColor = getRandomColor();
    
    ctx.fillStyle = backgroundColor; 
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#fff'; // 汉字颜色
    ctx.font = '48px Arial'; // 设置字体大小和字体
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(lastChar, size / 2, size / 2); // 绘制汉字在画布中间

    // 返回生成的 base64 图片
    return canvas.toDataURL('image/png');
  }
  return '';
}

const click_img =(post: Post, index: number)=>{
  // console.log('Clicked image from post:', post.person);
  // console.log('Image index:', index);
  // console.log('Image URL:', post.images[index]);
  showImagePreview({
  images: post.images,
  startPosition: index,
});
}
onMounted(() => {
  posts.value.forEach(post => {
    post.avatar = generateAvatar(post.person); // 动态生成头像
  })
  load()
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
  justify-content: center; // 居中对齐
  margin-top: 16px; // 增加上边距
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

.location-icon {
  margin-right: 4px;
}

.post-actions {
  display: flex;
  justify-content: flex-start;
  gap: 8px;
}

.multi-image {
  width: 20vw;
  height: 27vw;
}

.submit-button {
  margin-top: 24px;
}
</style>

<!-- <style lang="less" scoped>
.post-container {
  padding: 0.4rem;
}

.post-card {
  margin-bottom: 0.5rem;
  border: 1px solid #ebebeb;
  border-radius: 8px;
  padding: 0.7rem;
  background-color: #fff;
}

.post-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.avatar {
  width: 3rem;  /* 设置头像固定大小 */
  height: 3rem; /* 设置头像固定大小 */
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

/* 将发布内容、图片、定位内容往右移动 */
.post-body {
  margin-left: 3rem; /* 向右移动一些 */
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

.location-icon {
  margin-right: 4px;
}

.post-actions {
  display: flex;
  justify-content: flex-start;
  gap: 8px;
}

.multi-image {
  width: 20vw;
  height: 27vw;
}
</style> -->