<template>
    <Row style="height: 100vh; overflow-y: auto; ">
      <Col :flex="3" style="overflow-y: auto; position: relative;">
        <div>
          <Input 
            v-model = "sw"
            showClearIconOnEmpty 
            clearable 
            autofocus 
            @change="onSearch"
            style="margin-left:100px; margin-top:50px; margin-bottom:50px; width: 60%; z-index: 10; position: sticky; top: 5px;" 
          />
          <div style="margin-left: 100px;">
            <Timeline :layout="layout" :label-align="labelAlign" :mode="mode" reverse>
              <TimelineItem
                v-for="(item, index) in filteredOptions"
                :key="index"
                :dot-color="item.dotColor"
                @click="handleItemClick(item)"
                class="timeline-item"
              >
                <template #label>
                  <div>
                    <div>{{ item.label.split(' ')[0] }}</div>
                    <div>{{ item.label.split(' ')[1] || '' }}</div>
                  </div>
                </template>
  
                <div :style="{ color: item.ope === user ? '#ff9900' : 'inherit' }">
                  {{ item.content }}
                </div>
                <Popconfirm content="确认作废吗" placement="left" @confirm="zuofei(item)">
                    <div :style="CommonStyle" class="reason" v-html="item.reason"></div>
                </Popconfirm>
              </TimelineItem>
            </Timeline>
          </div>
        </div>
      </Col>
  
      <Col :flex="2" style=" overflow-y: auto; padding: 30px 0; position: relative;">
        <div style="width: 90%; position: sticky; top: 5px; background-color: white; z-index: 10;">
          <Textarea v-model="iinnpp" placeholder="请输入内容" class="custom-textarea" :autosize="{ minRows: 15, maxRows: 50 }"></Textarea>
          <Button theme="primary" style="margin-left: 20px;" @click="subsub">提交</Button>
          
        </div>

      </Col>
      
    </Row>
    
  </template>
  
  
  <script setup lang="ts">
  import { ref, onMounted, reactive, computed} from 'vue'
  import { v4 as uuidv4 } from 'uuid'
  import apiClient from '@/plugins/axios'
  import { useAuthStore } from '@/store/authStore'
  import { Button, Input, Timeline, TimelineItem, Popconfirm, Space , NotifyPlugin ,Row, Col, Form, FormItem, CheckboxGroup, Checkbox, DatePicker, Textarea, Popup } from 'tdesign-vue-next'
  import type { TimelineProps } from 'tdesign-vue-next/es/timeline';
  import 'tdesign-vue-next/es/style/index.css';
  import PinYinMatch from 'pinyin-match';
  import dayjs from 'dayjs';
  const sw = ref('');
//   const user = useAuthStore();
  const uuid = ref(uuidv4())
  const user = ref('')
  const layout = ref<TimelineProps['layout']>('vertical');
  const labelAlign = ref<TimelineProps['labelAlign']>('left');
  const mode = ref<TimelineProps['mode']>('alternate');
  const CommonStyle = {
    fontSize: '12px',
    color: 'rgba(0,0,0,.6)',
  };
  const options = ref<Array<{
    id: string;
    state: number;
    label: string;
    content: string;
    reason: string;
    dotColor?: string; // 使用可选属性
    }>>([
    {
        id: '',
        state: 0,
        label: '',
        content: '',
        reason: '',
    },
    ]);

  const filteredOptions = ref(); 

  const zuofei = async(item: any) => {
    console.log(item.id)
    if (item.state === 1){
        NotifyPlugin.error({title:'已经作废啦～'});
        return
    }
    try {
        const payload = {
            id: item.id,
        };
        const response = await apiClient.post('/api/public/zuofei_vismem', payload)

        console.log('update_vis_res: ',response.data)
        if (response.data.data.affectedRows === 1) {
            console.log('作废成功')
            NotifyPlugin.success({ title: '作废成功' });
            const target = options.value.find(option => option.id === item.id);
            if (target) {
            target.dotColor = '#666666'; // 修改 dotColor
            console.log('修改成功:', target);
            } else {
            console.log('未找到 id 为 1 的对象');
            }
            onSearch();
        } else{
            NotifyPlugin.error({title:'作废失败'});
        }
    } catch (error) {
        console.error(error)
    }
  }

  const onSearch = () => {
   

    if (!sw.value || sw.value.trim() === '') {
       
        // 如果没有搜索内容，直接将 options 的内容赋给 filteredOptions
        filteredOptions.value = [...options.value];
        return;
    }

    // 使用 map() 创建新的数组并进行处理，避免直接修改原始数据
    const updatedOptions = options.value.map(option => {
        // 在这里使用了深拷贝，确保不修改 options 的数据
        const newOption = { ...option };

        const m = PinYinMatch.match(newOption.reason, sw.value);
        
        
        if (m) {
            const tmp = newOption.reason;
            newOption.reason = tmp.slice(0, m[0]) +
                               '<span style="color:red">' +
                               tmp.slice(m[0], m[1] + 1) +
                               '</span>' +
                               tmp.slice(m[1] + 1);
        }

        return newOption;  
    });

    // 更新 filteredOptions，确保它是一个新的数组，触发视图更新
    filteredOptions.value = updatedOptions;

    console.log('更新后的 filteredOptions:', filteredOptions.value);
};
  const iinnpp = ref('');
  const subsub = async() => {
    // user, mem  /api/public/add_vismem
    try {
        const payload = {
            user: user.value,
            mem: iinnpp.value,
        };
        const response = await apiClient.post('/api/public/add_vismem', payload)
        
        console.log('add_vis_res: ',response.data,user.value)
        if (response.data.data.affectedRows === 1) {
            console.log('提交成功')
            options.value.push({
                label: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                content: user.value,
                reason: iinnpp.value,
                id: response.data.data.insertId,
                state: 0,
            });
            NotifyPlugin.success({ title: '提交成功' });
            iinnpp.value = '';
            onSearch();
        } else{
            NotifyPlugin.error({title:'提交失败'});
        }
    } catch (error) {
        console.error(error)
    }
    
    
  }

  const handleItemClick = (item: any) => {
    console.log('点击了', item);
  };
  function formatDate(isoString: string): string {
  const date = new Date(isoString);

  // 检查日期是否有效
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date string');
  }

  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, '0'); // 月份从 0 开始
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  
  return `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`;
}


  const load = async() => {
    try {
      const response = await apiClient.post('/api/public/get_vismem');
      console.log('get_vismem--',response.data.data)
      user.value = response.data.user
      console.log('get_vismem---',user.value)
      options.value = response.data.data.map((item: { id:any,created_at: any; ope: any; content: any; state: any; emp_name:any })=>({
        label: formatDate(item.created_at),
        id: item.id,
        state: item.state,
        content: item.emp_name,
        reason: item.content,
        dotColor: item.state === 1 ? '#666666' : undefined,
      }));
      console.log(options.value,user.value)
    } catch (error) {
      console.error(error);
    }
    filteredOptions.value = [...options.value];
  };
  
  onMounted(async() => {
    
    await load()
    
  })
  </script>
  
  <style lang="less">
  .custom-textarea {
    width: 100%;
    height: 400px; 
    padding: 20px;
  }
  .timeline-item {
    transition: transform 0.3s ease, box-shadow 0.3s ease;  // 设置过渡效果
  }

  .timeline-item:hover {
    transform: scale(1.02);   // 鼠标悬停时放大 1.1 倍
    
  }

  .timeline-item .reason {
    white-space: pre-line; /* 保留换行 */
    }
  </style>
  