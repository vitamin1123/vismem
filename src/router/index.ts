// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import Result404 from '@/views/NotFound404View/NotFound404View.vue'
import SvendView from '@/views/svend/svend.vue'
import loginView from '@/views/login/login.vue'
import VisMemView from '@/views/VisMemView/VisMem.vue'
import Anbao from '@/views/anbao/anbao.vue'
import advice from '@/views/advice/advice.vue'
import selfToolList from '@/views/anbao/detail/self-tool-list.vue'
import dutyRecord from '@/views/anbao/detail/duty-record.vue'
import meetingRecord from '@/views/anbao/detail/meeting-record.vue'
import reWeigh from '@/views/anbao/detail/re-weigh.vue'
import shipRegister from '@/views/anbao/detail/ship-register.vue'
import customsRecord from '@/views/anbao/detail/customs-record.vue'
import securityCheck from '@/views/anbao/detail/security-check.vue'
import guest from '@/views/anbao/detail/guest.vue'
import guest_car from '@/views/anbao/detail/guest_car.vue'
import xunluo from '@/views/anbao/detail/xunluo.vue'
import css from '@/views/CSS/CSS.vue'
import apiClient from '@/plugins/axios'


import { useAuthStore } from '@/store/authStore'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // { title: '进厂自备工具清单', path: '/self-tool-list', icon: 'todo-list-o' },
    // { title: '值班记录', path: '/duty-record', icon: 'notes-o' },
    // { title: '班前会记录', path: '/meeting-record', icon: 'comment-o' },
    // { title: '物资出场重新过磅', path: '/re-weigh', icon: 'balance-list-o' },
    // { title: '外来船舶登记', path: '/ship-register', icon: 'font-o' },
    // { title: '海关监管场所台账', path: '/customs-record', icon: 'records-o' },
    // { title: '治安保卫检查整改', path: '/security-check', icon: 'shield-o' },
    {
      path: '/meeting-record',
      name: 'meeting-record',
      component: meetingRecord,
      meta: {
        title: '班前会记录' // 自定义标题
      }
    },
    {
      path: '/guest',
      name: 'guest',
      component: guest,
      meta: {
        title: '外来人员登记' // 自定义标题
      }
    },
    {
      path: '/css',
      name: 'css',
      component: css,
      meta: {
        title: '表格转换' // 自定义标题
      }
    },
    {
      path: '/advice',
      name: 'advice',
      component: advice,
      meta: {
        title: '有事码上说' // 自定义标题
      }
    },
    {
      path: '/guest_car',
      name: 'guest_car',
      component: guest_car,
      meta: {
        title: '外来车辆登记' // 自定义标题
      }
    },
    {
      path: '/xunluo',
      name: 'xunluo',
      component: xunluo,
      meta: {
        title: '巡逻' // 自定义标题
      }
    },
    {
      path: '/re-weigh',
      name: 're-weigh',
      component: reWeigh,
      meta: {
        title: '物资出场重新过磅' // 自定义标题
      }
    },
    {
      path: '/ship-register',
      name: 'ship-register',
      component: shipRegister,
      meta: {
        title: '外来船舶登记' // 自定义标题
      }
    },
    {
      path: '/customs-record',
      name: 'customs-record',
      component: customsRecord,
      meta: {
        title: '海关监管场所台账' // 自定义标题
      }
    },
    {
      path: '/security-check',
      name: 'security-check',
      component: securityCheck,
      meta: {
        title: '治安保卫检查整改' // 自定义标题
      }
    },
    {
      path: '/duty-record',
      name: 'duty-record',
      component: dutyRecord,
      meta: {
        title: '值班记录' // 自定义标题
      }
    },
    {
      path: '/self-tool-list',
      name: 'self-tool-list',
      component: selfToolList,
      meta: {
        title: '进厂自备工具清单' // 自定义标题
      }
    },
    {
      path: '/404',
      name: '404',
      component: Result404,
      meta: {
        title: '404' // 自定义标题
      }
    },
    {
      path: '/anbao',
      name: 'anbao',
      component: Anbao,
      meta: {
        title: '安保平台' // 自定义标题
      }
    },
    {
      path: '/vismem',
      name: 'vismem',
      component: VisMemView,
      meta: {
        title: '值班打卡' // 自定义标题
      }
    },
  
    {
      path: '/svend',
      name: 'svend',
      component: SvendView,
      meta: {
        title: '钢板供应商' // 自定义标题
      }
    },
    {
      path: '/login',
      name: 'login',
      component: loginView,
      meta: {
        title: '登录' // 自定义标题
      }
    }
  ],
})

// 路由守卫
router.beforeEach(async (to, from, next) => {
  // document.title = to.meta.title || '自助功能'
  document.title = (to.meta?.title as string) ?? '自助功能'
  const authStore = useAuthStore()

  // 从 URL 中提取 token 参数
  const tokenFromQuery = Array.isArray(to.query.token) ? to.query.token[0] : to.query.token

  // 如果 URL 中有 token，则强制更新 authStore 中的 token 并移除 URL 中的 token 参数
  if (tokenFromQuery) {
    authStore.setToken(tokenFromQuery)

    // 调用接口获取用户信息
    try {
      const response = await apiClient.post('/api/get_usercinfo_')
      if (response.data.code === 200 && response.data.data?.length > 0) {
        const userInfo = response.data.data[0]
        authStore.setUserCode(userInfo.usercode)
        // 可以在这里添加name到store的逻辑，如果store中需要的话
        authStore.setUserName(userInfo.name)
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
    }

    // 移除 token 参数
    const { token, ...queryWithoutToken } = to.query
    return next({ path: to.path, query: queryWithoutToken, replace: true })
  }

  // 如果没有 token 并且 authStore 中也没有 token，重定向到 404
  if (!tokenFromQuery && !authStore.token) {
    console.log('确实没有token')
    if (to.path === '/login' || to.path === '/404' || to.path === '/advice' || to.path === '/css') {
      return next()
    }
    // return next({ path: '/404' })
    // 根据 vismem 参数判断跳转方向
    if (to.path === '/vismem') {
      return next({ path: '/404' })
    } else {
      return next({ path: '/login' })
    }
  }

  next()
})

// router.beforeEach(async (to, from, next) => {
//   const authStore = useAuthStore()

//   // 从 URL 中获取 token，并确保它是 string 类型
//   const token_tp = Array.isArray(to.query.token) ? to.query.token[0] : to.query.token
//   console.log("看看有没有token", token_tp, authStore.token,token_tp!==authStore.token)

//   // 如果 URL 中没有 token 并且 authStore 也没有 token，重定向到 /404
//   if (!token_tp && !authStore.token && to.path !== '/404') {
//     return next({ path: '/404' })
//   }

//   // 如果 URL 中有 token 且 authStore 中没有存储 token，则进行 token 处理
//   if (typeof token_tp === 'string' && token_tp && (!authStore.token || token_tp!== authStore.token)) {
//     authStore.setToken(token_tp)
//     console.log('authStore写入成功')

//     // 移除 URL 中的 token 参数，避免暴露
//     const { token , ...queryWithoutToken } = to.query

//     return next({ ...to, query: queryWithoutToken, replace: true })
//   }

//   // 如果 URL 没有 token，但 authStore 已经有 token，则直接放行
//   next()
// })




export default router
