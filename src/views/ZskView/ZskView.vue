<template>
  
  <div>
    
    <div class="toolbar">
      <div class="dropdown-menu">
        <!-- <t-dropdown-menu @menu-opened="handleMenuOpened" @menu-closed="handleMenuClosed">
          <t-dropdown-item :options="product.options" :value="product.value" @change="onChange" />
        </t-dropdown-menu> -->
      </div>
      <t-search class="search" v-model="searchQuery" placeholder="搜索文档..." @change="onChange" @submit="onSubmit"/>
    </div>

    <div class="list-container">
      <t-pull-down-refresh v-model="refreshing" @refresh="onRefresh">
        <t-list :async-loading="loading" @scroll="onScroll" :finished="finished" finished-text="没有更多了">
          <t-list-item v-for="(item, index) in articles" :key="index" class="list-item">
            <div class="card">
              <div class="card-header" v-html="item.name.slice(0, -4)"></div>
              <div class="card-body" v-html="item.description" @click="handleCardBodyClick(item.name)"></div>
              <div class="card-footer">
                <div class="date">{{ item.mode_time }}</div>
                <!-- <div class="tags" v-if="item.tags.length > 0 && item.tags[0] != ''">
                  <t-check-tag v-for="(tag, tagIndex) in item.tags" :key="tagIndex">{{ tag }}</t-check-tag>
                </div> -->
              </div>
            </div>
          </t-list-item>
        </t-list>
      </t-pull-down-refresh>
    </div>
    <!-- <PdfViewer v-if="pdfUrl" :pdfUrl="pdfUrl" @close="closeViewer" /> -->
  </div> 
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import apiClient from '@/plugins/axios'
// import * as pdfjsLib from 'pdfjs-dist';
// import PdfViewer from './comp/PdfViewer.vue';
import { useAuthStore } from '@/store/authStore'
// import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs';

const user = useAuthStore();
const { token } = user;
const pdfUrl = ref<string | null>(null);
const searchQuery = ref('');
const articles = ref<any[]>([]);
const articleNum = ref(100);
const finished = ref(false);
const page = ref(1);
const loading = ref(false);
const refreshing = ref(false);
// const pdfDocument = ref<any>(null);
const sw = ref("");

const product = {
  value: 'all',
  options: [
    {
      value: 'all',
      label: '全部产品',
    },
    {
      value: 'new',
      label: '最新产品',
    },
    {
      value: 'hot',
      label: '最火产品',
    },
  ],
};

const onChange = (val: string) => {
  console.log('change: ', val);
  sw.value = val;
};

const onSubmit = () => {
  
  finished.value = false;
  loading.value = false;
  loadData(true);
  console.log('submit');
};

const handleMenuOpened = () => {
  console.log('==handleMenuOpened===');
};

const handleMenuClosed = (val: string) => {
  console.log('==handleMenuClosed===', val);
};

const loadData = async (isRefresh: boolean) => {
  if (loading.value) return;
  loading.value = true;

  if (isRefresh) {
    page.value = 1;
    articles.value = [];
  }

  try {
    const response = await apiClient.post('/api/get-card-list', {
      st: (page.value - 1) * 10,
      sw: sw.value,
      dept: "",
      cata: "",
      tags: [],
      user: ""
    }, {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'json',
    });

    const { list } = response.data.data;
    // console.log('看list: ',list.length)
    if (list.length > 0) {
      articles.value = list;
      articleNum.value = list.length > 0 ? list[0] : 0;
      page.value += 1;
    } else {
      finished.value = true;
    }
    //console.log('看list: ',articles.value,list)
  } catch (error) {
    console.error("请求失败：", error);
  } finally {
    loading.value = false;
  }
};

const closeViewer = () => {
  if (pdfUrl.value) {
    URL.revokeObjectURL(pdfUrl.value); // 清理 URL
    pdfUrl.value = null;
  }
};

const handleCardBodyClick = async (name: string) => {
  const pdfName = name.replace(/<\/?[^>]+(>|$)/g, '');
  
  try {
    // 使用 Axios 请求 PDF 文件
    const pdfName = name.replace(/<\/?[^>]+(>|$)/g, '');
    const response = await apiClient.post(
      '/api/file',
      { productName: pdfName, usercode: 'user_code', isSearch: true },
      { responseType: 'blob' }
    );

    // 创建 Blob URL 用于显示
    const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
    pdfUrl.value = URL.createObjectURL(pdfBlob);
  } catch (error) {
    console.error('无法加载 PDF 文件：', error);
  }
};



const onRefresh = async () => {
  refreshing.value = true;
  await loadData(true);
  refreshing.value = false;
};

const onLoad = () => {
  if (articles.value.length >= articleNum.value || loading.value) {
    return;
  }
  loadData(false);
};

// const throttle = (func: Function, delay: number) => {
//   let timeout: NodeJS.Timeout | null = null;
//   return (...args: any[]) => {
//     if (!timeout) {
//       func(...args);
//       timeout = setTimeout(() => {
//         timeout = null;
//       }, delay);
//     }
//   };
// };

const onScroll = (scrollBottom: number) => {
  
  if (scrollBottom < 20 && !loading.value && !finished.value) {
    console.log('scrollBottom', scrollBottom);
    //throttle(onLoad, 1000)();
  }
};

onMounted(() => {
  onLoad();
});
</script>

<style lang="less" scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  position: sticky;
  top: 0;
  z-index: 1000;
}

.dropdown-menu {
  display: flex;
  flex-grow: 1;
  gap: 10px;
}

.search {
  width: 100%;
  max-width: 400px;
  box-sizing: border-box;
}

.list-container {
  margin-top: 10px;
}

.list-item {
  margin: 15px 0;
  padding: 0;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  background-color: #fff;
  border-radius: 10px;
  overflow: hidden;
}

.card {
  padding: 20px;
}

.card-header {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 10px;
}

.card-body {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 15px;
}

.card-footer .date {
  font-size: 12px;
  color: #999;
}

.card-footer .tags {
  display: flex;
  gap: 8px;
}

.t-check-tag {
  margin-right: 5px;
}
</style>
