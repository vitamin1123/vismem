// src/store/authStore.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'))

  // 设置 token，并保存到 localStorage
  function setToken(newToken: string) {
    token.value = newToken
    localStorage.setItem('token', newToken)
  }

  // 清除 token
  function clearToken() {
    token.value = null
    localStorage.removeItem('token')
  }

  return {
    token,
    setToken,
    clearToken,
  }
})
