<template>
  <div class="login-container">
    <div class="login-card">
      <!-- 动态波浪背景 -->
      <div class="wave-bg"></div>

      <!-- 品牌标识 -->
      <div class="brand-section">
        <img
          src="/src/assets/assets-yzj-logo.png"
          class="brand-logo"
          alt="Company Logo"
        />
        <h1 class="brand-title">供应商生产情况执行反馈</h1>
        <p class="brand-subtitle"></p>
      </div>

      <!-- 登录表单 -->
      <t-form
        ref="form"
        :rules="rules"
        :data="formData"
        @submit="handleSubmit"
        class="login-form"
        :label-width="0"  
      >
        <t-form-item 
          name="username" 
          :show-required-mark="false"
          class="full-width-form-item"  
        >
          <t-input
            v-model="formData.username"
            clearable
            placeholder="请输入账号"
            size="large"
            class="custom-input full-width-input"
            :prefix-icon="null"  
            :suffix-icon="null"
          />
        </t-form-item>

        <t-form-item 
          name="password" 
          :show-required-mark="false"
          class="full-width-form-item"
        >
          <t-input
            v-model.trim="formData.password"
            type="password"
            clearable
            placeholder="请输入密码"
            size="large"
            class="custom-input full-width-input"
            :prefix-icon="null"
            :suffix-icon="null"
            
          />
        </t-form-item>

        <t-button
          theme="primary"
          block
          size="large"
          :loading="loading"
          class="login-btn"
          @click="handleSubmit"
        >
          {{ loading ? '登录中...' : '立即登录' }}
        </t-button>

        <div class="action-links">
          <a class="link-item">忘记密码</a>
        </div>
      </t-form>
    </div>
  </div>
</template>

<!-- script和style部分保持不变 -->

<script setup>
import { ref } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { sha256 } from 'js-sha256'
import apiClient from '@/plugins/axios'
import CryptoJS  from 'crypto-js'
import base64 from 'base64-js'
import { useAuthStore } from '@/store/authStore'
import { useRouter } from 'vue-router'
const user = useAuthStore();
const router = useRouter()
// 加密配置
const ENCRYPT_SALT = import.meta.env.VITE_ENC_SALT

// 表单数据
const formData = ref({
  username: '',
  password: ''
})

// 表单验证规则
const rules = {
  username: [{ required: true, message: '账号不能为空' }],
  password: [
    { required: true, message: '密码不能为空' },
    { min: 8, message: '密码长度至少8位' }
  ]
}

// 提交状态
const loading = ref(false)

// 密码加密处理
function encryptPassword(password, timestamp, nonce) {
  const salt = import.meta.env.VITE_HMAC_SALT; // 前端固定盐（需与后端一致）
  const hmac = HmacSHA256(
    `${password}:${timestamp}:${nonce}`, // 数据
    salt                                // 密钥
  ).toString();
  return hmac;
}

// 生成随机nonce
function generateNonce() {
  const array = new Uint8Array(16)
  window.crypto.getRandomValues(array)
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
}

// 提交处理
const handleSubmit = async () => {
  // console.log('ff')
  try {
    loading.value = true

    const HMAC_SECRET_KEY = ENCRYPT_SALT
    const passwordHash = CryptoJS.HmacSHA256(formData.value.password, HMAC_SECRET_KEY).toString(CryptoJS.enc.Hex);

    const response = await apiClient.post('/api/login', {
      username: formData.value.username,
      password: passwordHash
    })

    console.log('login-response: ',  response.data.code)
    // 处理响应
    if (response.data.code === 200) {
      user.userCode = response.data.data.userInfo.username
      user.setToken(response.data.data.token)
      user.setUserCode(response.data.data.userInfo.username)
      MessagePlugin.success('登录成功')
      router.push('/svend')
    } else {
      MessagePlugin.error(response.message)
    }
  } catch (error) {
    MessagePlugin.error('登录失败: ' + error.message)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
}

.login-card {
  width: 480px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
  position: relative;
  overflow: hidden;
  transform: translateY(0);
  animation: cardEnter 0.6s cubic-bezier(0.23, 1, 0.32, 1);
}

@keyframes cardEnter {
  0% { transform: translateY(50px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}

.wave-bg {
  position: absolute;
  top: -120px;
  left: -50%;
  width: 200%;
  height: 300px;
  background: linear-gradient(90deg, #7f7fd5 0%, #86a8e7 50%, #91eae4 100%);
  opacity: 0.15;
  border-radius: 40% 40% 0 0;
  animation: wave 12s infinite linear;
}

@keyframes wave {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.brand-section {
  text-align: center;
  padding: 40px 0 30px;
}

.brand-logo {
  width: 350px;
  height: 73px;
  margin-bottom: 16px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.brand-title {
  font-size: 24px;
  color: #2d3748;
  margin-bottom: 8px;
  font-weight: 600;
}

.brand-subtitle {
  color: #718096;
  font-size: 14px;
}

.login-form {
  padding: 0 40px 40px;
}

.custom-input {
  border-radius: 8px;
  transition: all 0.3s;

  /* 调整输入框内边距 */
  &:deep(.t-input__inner) {
    padding-left: 16px;
    padding-right: 16px;
  }
}

.login-btn {
  margin-top: 30px;
  border-radius: 8px;
  height: 48px;
  font-size: 16px;
  letter-spacing: 2px;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(128, 90, 213, 0.3);
  }
}

.action-links {
  margin-top: 20px;
  text-align: center;
}

.link-item {
  color: #718096;
  cursor: pointer;
  transition: color 0.3s;

  &:hover {
    color: #667eea;
  }
}

/* 新增样式 */
.full-width-form-item {
  width: 100%;
}

.full-width-input {
  width: 100% !important;
}

/* 调整已有样式 */
.login-form {
  padding: 0 40px 40px;
  /* 确保表单项容器没有内边距影响 */
  :deep(.t-form__item) {
    padding: 0;
    margin-bottom: 20px;
  }
}

.custom-input {
  border-radius: 8px;
  transition: all 0.3s;
  
  /* 确保输入框内部元素宽度 */
  &:deep(.t-input__inner) {
    width: 100%;
    padding: 0 16px;
  }
}

.login-btn {
  margin-top: 30px;
  /* 宽度已由block属性控制 */
}
</style>
