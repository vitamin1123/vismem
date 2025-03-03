import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/App.vue'
// import TDesign from 'tdesign-mobile-vue'
import router from '@/router'
// import '@/assets/reset.less'
// import '@/index.less'
import { Button, Grid, GridItem, Icon, Image as VanImage, FloatingBubble, ImagePreview,Toast,Uploader ,Popup,Field, CellGroup,Divider     } from 'vant';
// 2. 引入组件样式
import 'vant/lib/index.css';
const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(Popup);
app.use(Button);
app.use(Grid);
app.use(GridItem);
app.use(Field);
app.use(Divider);
app.use(CellGroup);
app.use(Icon);
app.use(VanImage);
app.use(FloatingBubble);
app.use(ImagePreview);
app.use(Toast);
app.use(Uploader);
// app.use(TDesign);
app.mount('#app')
