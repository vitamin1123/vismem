// src/views/ZskView/ZskView.vue
<template>
  <div>首页测试内容</div>
  <t-input v-model="uuid" label="文字" placeholder="请输入文字"></t-input>
  <t-input v-model="uuid" label="文字" placeholder="请输入文字"></t-input>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import apiClient from '@/plugins/axios'
import { useAuthStore } from '@/store/authStore'

const uuid = ref(uuidv4())

// 模拟一个 API 请求
const fetchData = async () => {
  try {
    const response = await apiClient.post('/api/protected-route')
    uuid.value = response.data.data.userId
    console.log(response.data)
  } catch (error) {
    console.error(error)
  }
}

onMounted(() => {

  fetchData()
})
</script>

<style lang="less">
</style>
