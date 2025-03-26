import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import router from '@/router'
import { Lazyload } from 'vant'
import 'vant/lib/index.css';
import 'tdesign-vue-next/es/style/index.css';
const app = createApp(App)
app.use(Lazyload, {
    lazyComponent: true  // 关键配置
  })
app.use(createPinia())
app.use(router)

app.mount('#app')
