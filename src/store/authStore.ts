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

    // userName 相关逻辑
    const userName = ref<string | null>(localStorage.getItem('userName'));

    // 设置 userName，并保存到 localStorage
    function setUserName(newUserName: string) {
      userName.value = newUserName;
      localStorage.setItem('userName', newUserName);
    }
  
    // 清除 userName
    function clearUserName() {
      userName.value = null;
      localStorage.removeItem('userName');
    }

  return {
    token,
    setToken,
    clearToken,
    userCode,
    setUserCode,
    clearUserCode,
    userName,
    setUserName,
    clearUserName,
  }
})
