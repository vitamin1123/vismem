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

    // userCode 相关逻辑
    const userCode = ref<string | null>(localStorage.getItem('userCode'));

    // 设置 userCode，并保存到 localStorage
    function setUserCode(newUserCode: string) {
      userCode.value = newUserCode;
      localStorage.setItem('userCode', newUserCode);
    }
  
    // 清除 userCode
    function clearUserCode() {
      userCode.value = null;
      localStorage.removeItem('userCode');
    }

  return {
    token,
    setToken,
    clearToken,
    userCode,
    setUserCode,
    clearUserCode,
  }
})
