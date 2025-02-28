// src/plugins/axios.ts
import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL, // 替换为你的 API 基础 URL
  timeout: 10000,
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

// apiClient.interceptors.request.use(
//   (config) => {
//     const authStore = useAuthStore()
//     const token = authStore.token

//     // 如果 token 存在，附加到请求头
//     if (token) {
//       config.headers.Authorization = `Bearer ${token}`
//     }

//     return config
//   },
//   (error) => {
//     return Promise.reject(error)
//   }
// )

export default apiClient
