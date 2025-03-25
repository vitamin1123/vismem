import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite'
// import { VantResolver } from '@vant/auto-import-resolver'
import {

  TDesignResolver  ,
  VantResolver ,
} from 'unplugin-vue-components/resolvers'

export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    AutoImport({
      resolvers: [TDesignResolver({
        library: 'vue-next'
      })],
    }),
    
    Components({
      resolvers: [
        // Vant 自动导入
        VantResolver({
          importStyle: false  // 自动引入样式
        }),
        TDesignResolver({
          library: 'vue-next'
        })
      
        
      ],
      // 指定组件类型声明文件生成路径
      dts: true
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
