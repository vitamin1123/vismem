<template>
  <Input v-model="uuid" label="哈哈" placeholder="请输入文字"></Input>
  <Input v-model="uuid" label="哈哈" placeholder="请输入文字"></Input>
  <Button theme="primary">按需引入按钮</Button>
  <Progress :percentage="80"></Progress>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import apiClient from '@/plugins/axios'
import { Input, Button, Progress } from 'tdesign-mobile-vue'
import 'tdesign-mobile-vue/es/style/index.css';

// 使用 ref 管理 uuid
const uuid = ref(uuidv4())

// 模拟一个 API 请求
const fetchData = async () => {
  try {
    const response = await apiClient.get('http://10.0.108.167:3000/public/api/get-recent-up')
    console.log(response.data)
  } catch (error) {
    console.error(error)
  }
}

onMounted(() => {
  // fetchData()
})
</script>

<style lang="less">
</style>
