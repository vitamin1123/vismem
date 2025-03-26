// src/plugins/axios.ts
import axios from 'axios'
import { useAuthStore } from '@/store/authStore'
import { useRouter } from 'vue-router'


const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL, // 替换为你的 API 基础 URL
  timeout: 30000,
})

// 请求拦截器
apiClient.interceptors.request.use(
  async (config) => {
    const authStore = useAuthStore()
    const token = authStore.token

    if (token) {
      // config.headers.Authorization = `Bearer ${token}`
      config.headers.Authorization = `Bearer ${encodeURIComponent(token)}`;
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 新增响应拦截器
apiClient.interceptors.response.use(
  (response) => response, // 直接返回成功响应
  (error) => {
    const { status, data } = error.response || {}
    console.log('axios检查返回: ',status, data)
    // 检查 403 错误及特定消息
    if (status === 403 && data?.message === "token 无效或已过期") {
      const authStore = useAuthStore()
      const router = useRouter()
      // 清除 token（根据您的 store 实现调整）
      authStore.clearToken() // 假设 store 有 clearToken 方法
      // 或: authStore.token = null
      
      // 跳转到登录页（带当前路由参数便于登录后返回）
      router.push({ path: '/login', query: { redirect: router.currentRoute.value.path } })
    }

    return Promise.reject(error) // 继续传递错误
  }
)


export default apiClient
