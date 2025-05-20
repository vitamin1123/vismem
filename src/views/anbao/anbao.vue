<template>
    <div class="menu-page">
      <van-nav-bar title="菜单" fixed placeholder />
      <van-notice-bar :text="`欢迎使用安保平台，${user.userName}`" left-icon="volume-o" />
      
      <div class="menu-container">
        <div v-for="(row, rowIndex) in menuRows" :key="rowIndex" class="menu-row">
          <van-grid :column-num="2" :gutter="10">
            <van-grid-item
              v-for="item in row"
              :key="item.path"
              :text="item.title"
              :icon="item.icon"
              @click="handleMenuClick(item.path)"
            />
          </van-grid>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, computed } from 'vue';
  import { useRouter } from 'vue-router';
  import { NavBar, Grid, GridItem, NoticeBar } from 'vant';
  import { useAuthStore } from '@/store/authStore'
  const user = useAuthStore();
  const router = useRouter();
  
  // 菜单数据
  const menuItems = ref([
    { title: '进厂自备工具清单', path: '/self-tool-list', icon: 'todo-list-o' },
    { title: '外来人员', path: '/guest', icon: 'user-circle-o' },
    { title: '外来车辆', path: '/guest_car', icon: 'logistics' },
    { title: '巡逻记录', path: '/xunluo', icon: 'edit' },
    { title: '值班记录', path: '/duty-record', icon: 'notes-o' },
    { title: '班前会记录', path: '/meeting-record', icon: 'comment-o' },
    { title: '物资出场重新过磅', path: '/re-weigh', icon: 'balance-list-o' },
    { title: '外来船舶登记', path: '/ship-register', icon: 'font-o' },
    { title: '海关监管场所台账', path: '/customs-record', icon: 'records-o' },
    { title: '治安保卫检查整改', path: '/security-check', icon: 'shield-o' },
  ]);
  
  // 将菜单项分成每行两个的二维数组
  const menuRows = computed(() => {
    const rows = [];
    for (let i = 0; i < menuItems.value.length; i += 2) {
      rows.push(menuItems.value.slice(i, i + 2));
    }
    return rows;
  });
  
  // 菜单点击处理
  const handleMenuClick = (path) => {
    router.push(path);
  };
  </script>
  
  <style scoped>
  .menu-page {
    padding: 10px;
    box-sizing: border-box;
  }
  
  .menu-container {
    margin-top: 20px;
  }
  
  .menu-row {
    margin-bottom: 10px;
  }
  
  :deep(.van-grid-item__content) {
    height: 120px;
    border-radius: 8px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  }
  
  :deep(.van-grid-item__text) {
    font-size: 14px;
    margin-top: 8px;
  }
  </style>