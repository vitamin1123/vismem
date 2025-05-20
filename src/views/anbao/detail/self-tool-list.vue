<template>
  <van-tabbar v-model="activeTab">
    <van-tabbar-item icon="home-o" @click="activeTab = 0">工具清单</van-tabbar-item>
    
    <van-tabbar-item icon="setting-o" @click="activeTab = 1">审批设置</van-tabbar-item>
    <van-tabbar-item icon="clock-o" @click="activeTab = 2">待审批</van-tabbar-item>
  </van-tabbar>

  <!-- 工具清单页面 -->
  <div v-if="activeTab === 0">
    <van-nav-bar title="进厂自备工具清单" fixed placeholder />
    
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="onLoad"
      >
        <van-cell v-for="(item, index) in toolList" :key="index">
          <van-card>
            <template #title>
              <div class="card-header">
                <span>单位：{{ item.unit }}</span>
                <span class="handler">经办人：{{ item.handler }}</span>
              </div>
            </template>
            <template #desc>
              <div class="tool-item" v-for="(tool, tIndex) in item.tools" :key="tIndex">
                <div class="tool-row">
                  <span class="tool-name">{{ tool.name }}</span>
                  <span class="tool-spec">{{ tool.spec }}</span>
                  <span class="tool-quantity">{{ tool.quantity }}</span>
                  <span class="tool-remark">{{ tool.remark }}</span>
                </div>
              </div>
              <div class="tags">
                <van-tag v-for="(approver, aIndex) in item.approvers" :key="aIndex" type="primary">
                  {{ approver.type === 'approve' ? '审批' : '知会' }}: {{ approver.name || approver.text || '未知用户' }}
                </van-tag>
              </div>
              <div class="footer">
                <span class="time">进厂时间：{{ item.entryTime }}</span>
              </div>
            </template>
          </van-card>
        </van-cell>
      </van-list>
    </van-pull-refresh>

    <van-floating-bubble
      v-model:offset="offset"
      axis="xy"
      magnetic="x"
      @click="showAddDialog = true"
      
    >
      <van-icon name="plus" />
    </van-floating-bubble>

    <!-- 新增工具对话框 -->
    <van-dialog v-model:show="showAddDialog" title="新增工具登记" show-cancel-button @confirm="submitTool">
      <van-form @submit="submitTool" class="form-container">
        <van-cell-group inset>
          <van-field
            v-model="newTool.unit"
            label="单位"
            placeholder="请输入单位名称"
            :rules="[{ required: true, message: '请填写单位名称' }]"
          />
          <van-field
            v-model="newTool.handler"
            label="经办人"
            :value="user.userName"
            readonly
          />
        </van-cell-group>

        <div class="tool-items-container">
          <div v-for="(tool, index) in newTool.tools" :key="index" class="tool-item">
            <van-cell-group inset>
              <div class="item-header">
                <span>工具 {{ index + 1 }}</span>
                <van-button v-if="newTool.tools.length > 1" size="mini" type="danger" @click="removeTool(index)">删除</van-button>
              </div>
              <van-field
                v-model="tool.name"
                label="名称"
                placeholder="请输入工具名称"
                :rules="[{ required: true, message: '请填写工具名称' }]"
              />
              <van-field
                v-model="tool.spec"
                label="规格"
                placeholder="请输入规格"
              />
              <van-field
                v-model="tool.quantity"
                label="数量"
                placeholder="请输入数量"
                type="number"
                :rules="[{ required: true, message: '请填写数量' }]"
              />
              <van-field
                v-model="tool.remark"
                label="备注"
                placeholder="请输入备注"
                type="textarea"
                autosize
              />
            </van-cell-group>
          </div>
        </div>

        <div class="button-group">
          <van-button type="primary" size="small" @click="addTool">添加工具</van-button>
        </div>
      </van-form>
    </van-dialog>
  </div>

  <!-- 审批设置页面 -->
  <div v-if="activeTab === 1">
    <van-nav-bar title="审批设置" fixed placeholder />
    
    <van-form @submit="saveApprovalSettings" class="approval-form">
      <van-cell-group inset>
        <van-field
          v-model="approvalSettings.starterText"
          label="发起人"
          placeholder="请选择发起人"
          is-link
          readonly
          @click="showUserPicker('starter')"
        />
        
        <div v-for="(item, index) in approvalSettings.nodes" :key="index" class="approval-item">
          <div class="approval-row">
            <div class="approval-controls">
              <van-icon name="minus" size="16" color="#ee0a24" @click="removeApprover(index)" />
              <van-field
                :value="item.type === 'approve' ? '审批' : '知会'"
                :placeholder="item.type === 'approve' ? '审批' : '知会'"
                readonly
                @click="showTypePicker(index)"
              />
            </div>
            <van-field
              v-model="item.usersText"
              label="人员"
              placeholder="请选择人员"
              readonly
              is-link
              @click="showUserPicker('node', index)"
            />
          </div>
        </div>
      </van-cell-group>

      <div class="button-group">
        <van-button type="primary" size="small" @click="addApprover">添加审批/知会人</van-button>
        <van-button type="primary" size="small" native-type="submit">保存设置</van-button>
      </div>
    </van-form>
    
    <!-- 类型选择器 -->
    <van-popup v-model:show="showTypeSelect" position="bottom">
      <van-picker
        :columns="typeColumns"
        @confirm="onTypeConfirm"
        @cancel="showTypeSelect = false"
      />
    </van-popup>
    
    <!-- 用户选择器 (共用) -->
    <van-popup v-model:show="showUserSelect" position="bottom" round>
      <div class="user-selector-container">
        <!-- 左侧搜索和选择区域 -->
        <div class="left-panel">
          <div class="search-container">
            <van-search
              v-model="searchText"
              placeholder="请输入搜索内容"
              class="search-input"
              @search="fetchUsers"
            />
          </div>
          <van-cell-group>
            <van-cell
              v-for="user in filteredUserList"
              :key="user.value"
              clickable
              :title="user.text"
              :style="{ color: isUserSelected(user) ? 'red' : 'inherit' }"
              @click="toggleUser(user)"
            />
          </van-cell-group>
        </div>
        
        <!-- 右侧已选人员区域 -->
        <div class="right-panel">
          <div class="selected-header">已选人员</div>
          <van-cell-group>
            <template v-if="currentSelectionType === 'starter'">
              <van-cell
                v-for="(user, index) in currentSelectedUsers"
                :key="index"
                :title="user.name || user.text || user.code || '未知用户'"
              >
                <template #right-icon>
                  <van-icon name="clear" size="16" color="#ee0a24" @click.stop="removeSelectedUser(index)" />
                </template>
              </van-cell>
            </template>
            
            <template v-else-if="currentSelectionType === 'node' && currentSelectionIndex >= 0">
              <van-cell
                v-for="(user, index) in currentSelectedUsers"
                :key="index"
                :title="user.name || user.text || user.code || '未知用户'"
              >
                <template #right-icon>
                  <van-icon name="clear" size="16" color="#ee0a24" @click.stop="removeSelectedUser(index)" />
                </template>
              </van-cell>
            </template>
          </van-cell-group>
        </div>
      </div>
      
      <div class="button-group">
        <van-button type="primary" size="small" @click="toggleSelectAll">{{ isAllSelected ? '取消全选' : '全选' }}</van-button>
        <van-button type="primary" size="small" @click="confirmUserSelection">确定</van-button>
      </div>
    </van-popup>
  </div>

  <!-- 待审批页面 -->
  <div v-if="activeTab === 2">
    <van-nav-bar title="待审批工具清单" fixed placeholder />
    
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="onLoad"
      >
        <van-cell v-for="(item, index) in auditList" :key="index">
          <van-card>
            <template #title>
              <div class="card-header">
                <span>单位：{{ item.unit }}</span>
                <span class="handler">经办人：{{ item.handler }}</span>
              </div>
            </template>
            <template #desc>
              <div class="tool-item" v-for="(tool, tIndex) in item.tools" :key="tIndex">
                <div class="tool-row">
                  <span class="tool-name">{{ tool.name }}</span>
                  <span class="tool-spec">{{ tool.spec }}</span>
                  <span class="tool-quantity">{{ tool.quantity }}</span>
                  <span class="tool-remark">{{ tool.remark }}</span>
                </div>
              </div>
              <div class="footer">
                <span class="time">进厂时间：{{ item.entryTime }}</span>
                <van-button 
                  type="primary" 
                  size="small" 
                  @click="handleAudit(item)"
                  style="margin-left: 10px;"
                >
                  审核
                </van-button>
              </div>
            </template>
          </van-card>
        </van-cell>
      </van-list>
    </van-pull-refresh>

    <van-dialog 
      v-model:show="showAuditDialog" 
      title="确认审核" 
      show-cancel-button
      @confirm="confirmAudit"
    >
      <div style="padding: 16px;">
        确认审核通过该工具清单吗？
      </div>
    </van-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { showToast } from 'vant';
import { useAuthStore } from '@/store/authStore'
import apiClient from '@/plugins/axios'
const user = useAuthStore();

// 用户选择相关状态
const currentSelectedUsers = ref([]); // 存储完整用户对象的数组

onMounted(async () => {
  await fetchUsers();
  await fetchApprovalSettings();
  await fetchCardList();
  await fetchAuditCardList();
});

const fetchCardList = async () => {
  try {
    const response = await apiClient.post('/api/get_card_list', {
      form: 'selftool'
    });
    
    if (response.data.code === 0 && response.data.data) {
      toolList.value = response.data.data;
    }
  } catch (error) {
    console.error('获取卡片列表失败:', error);
    showToast('获取卡片列表失败');
  }
};

const auditList = ref([]);
const showAuditDialog = ref(false);
const currentAuditItem = ref(null);

const fetchAuditCardList = async () => {
  try {
    const response = await apiClient.post('/api/get_audit_card_list', {
      form: 'selftool'
    });
    
    if (response.data.code === 0 && response.data.data) {
      auditList.value = response.data.data;
    }
  } catch (error) {
    console.error('获取待审批列表失败:', error);
    showToast('获取待审批列表失败');
  }
};

const handleAudit = (item) => {
  currentAuditItem.value = item;
  showAuditDialog.value = true;
};

const confirmAudit = async () => {
  try {
    const response = await apiClient.post('/api/audit_card', {
      id: currentAuditItem.value.id,
      status: 'approved'
    });
    
    if (response.data.code === 0) {
      showToast('审核成功');
      await fetchAuditCardList();
    } else {
      showToast(response.data.message || '审核失败');
    }
  } catch (error) {
    console.error('审核失败:', error);
    showToast('审核失败，请稍后重试');
  } finally {
    showAuditDialog.value = false;
  }
};

const fetchApprovalSettings = async () => {
  try {
    const response = await apiClient.post('/api/get_approval_settings', {
      form: 'selftool'
    });
    
    if (response.data.code === 0 && response.data.data) {
      const { starter, nodes } = response.data.data;
      
      approvalSettings.starter = starter.map(item => ({
        code: item.code,
        name: item.name
      }));
      approvalSettings.starterText = starter.map(u => u.name).join(',');
      
      approvalSettings.nodes = nodes.map(node => ({
        type: node.type,
        users: node.users.map(user => ({
          code: user.code,
          name: user.name
        })),
        usersText: node.users.map(u => u.name).join(',')
      }));
    } else {
      console.error('获取审批配置失败:', response.data);
      showToast(`获取审批配置失败: ${response.data.message || '未知错误'}`);
    }
  } catch (error) {
    console.error('获取审批配置请求失败:', error);
    showToast(`获取审批配置失败: ${error.message || '网络错误'}`);
  }
};

const activeTab = ref(0);

const toolList = ref([
  {
    unit: '第一工程队',
    handler: '张三',
    tools: [
      { name: '电钻', spec: '220V', quantity: 2, remark: '全新' },
      { name: '扳手', spec: '12寸', quantity: 5, remark: '' }
    ],
    approvers: [
      { type: 'approve', name: '李四' },
      { type: 'notify', name: '王五' }
    ],
    entryTime: '2023-05-10 08:30'
  },
  {
    unit: '第二工程队',
    handler: '李四',
    tools: [
      { name: '锤子', spec: '2磅', quantity: 3, remark: '' },
      { name: '螺丝刀', spec: '十字', quantity: 4, remark: '各种尺寸' }
    ],
    approvers: [
      { type: 'approve', name: '赵六' }
    ],
    entryTime: '2023-05-11 09:15'
  }
]);

const loading = ref(false);
const finished = ref(false);
const refreshing = ref(false);

const onLoad = () => {
  setTimeout(() => {
    if (refreshing.value) {
      toolList.value = [];
      refreshing.value = false;
    }
    
    loading.value = false;
    
    if (toolList.value.length >= 10) {
      finished.value = true;
    }
  }, 1000);
};

const onRefresh = () => {
  finished.value = false;
  loading.value = true;
  onLoad();
};

const showAddDialog = ref(false);
const offset = ref({ x: 200, y: 400 });

const newTool = reactive({
  unit: '',
  handler: user.userName,
  tools: [
    { name: '', spec: '', quantity: '', remark: '' }
  ]
});

const addTool = () => {
  newTool.tools.push({ name: '', spec: '', quantity: '', remark: '' });
};

const removeTool = (index) => {
  if (newTool.tools.length > 1) {
    newTool.tools.splice(index, 1);
  } else {
    showToast('至少保留一个工具');
  }
};

const submitTool = async () => {
  try {
    const entryTime = new Date().toLocaleString();
    
    const response = await apiClient.post('/api/add_self_tool', {
      unit: newTool.unit,
      handler: newTool.handler,
      tools: newTool.tools,
      entryTime
    });
    
    if (response.data.code === 0) {
      toolList.value.unshift({
        unit: newTool.unit,
        handler: newTool.handler,
        tools: [...newTool.tools],
        approvers: [],
        entryTime
      });
      
      newTool.unit = '';
      newTool.handler = '';
      newTool.tools = [{ name: '', spec: '', quantity: '', remark: '' }];
      
      showToast('提交成功');
      showAddDialog.value = false;
    } else {
      showToast(response.data.message || '提交失败');
    }
  } catch (error) {
    console.error('提交工具失败:', error);
    showToast('提交失败，请稍后重试');
  }
};

const approvalSettings = reactive({
  starter: [],
  starterText: '',
  nodes: []
});

const typeColumns = [
  { text: '审批', value: 'approve' },
  { text: '知会', value: 'notify' }
];

const searchText = ref('');
const userList = ref([]);
const showUserSelect = ref(false);
const currentSelectionType = ref('');
const currentSelectionIndex = ref(-1);
const isAllSelected = ref(false);

const filteredUserList = computed(() => {
  return userList.value;
});

const fetchUsers = async () => {
  try {
    const response = await apiClient.post('/api/get_anbao_user', {
      sw: searchText.value.trim()
    });
    
    if (response.data.code === 0) {
      userList.value = response.data.data.map(user => ({
        text: `${user.postname} - ${user.name}`,
        value: user.code,
        name: user.name
      }));
    } else {
      showToast('获取用户列表失败');
      userList.value = [];
    }
  } catch (error) {
    showToast('获取用户列表失败');
    userList.value = [];
  }
};

const isUserSelected = (user) => {
  return currentSelectedUsers.value.some(u => u.code === user.value);
};

const toggleUser = (user) => {
  const isSelected = isUserSelected(user);
  if (isSelected) {
    currentSelectedUsers.value = currentSelectedUsers.value.filter(
      u => u.code !== user.value
    );
  } else {
    currentSelectedUsers.value.push({
      code: user.value,
      name: user.name,
      text: user.text
    });
  }
};

const showUserPicker = async (type, index = -1) => {
  currentSelectionType.value = type;
  currentSelectionIndex.value = index;
  searchText.value = '';
  
  // await fetchUsers();
  
  // 初始化选中状态
  currentSelectedUsers.value = [];
  
  if (type === 'starter') {
    currentSelectedUsers.value = approvalSettings.starter.map(user => ({
      code: user.code,
      name: user.name,
      text: `${user.code} - ${user.name}`
    }));
  } else if (type === 'node' && index >= 0) {
    currentSelectedUsers.value = approvalSettings.nodes[index].users.map(user => ({
      code: user.code,
      name: user.name,
      text: `${user.code} - ${user.name}`
    }));
  }
  
  showUserSelect.value = true;
};

const toggleSelectAll = () => {
  isAllSelected.value = !isAllSelected.value;
  if (isAllSelected.value) {
    currentSelectedUsers.value = [...userList.value];
  } else {
    currentSelectedUsers.value = [];
  }
};

const removeSelectedUser = (index) => {
  currentSelectedUsers.value.splice(index, 1);
};

const confirmUserSelection = () => {
  if (currentSelectionType.value === 'starter') {
    approvalSettings.starter = currentSelectedUsers.value.map(user => ({
      code: user.code,
      name: user.name || user.text.split(' - ')[1] || user.code
    }));
    approvalSettings.starterText = approvalSettings.starter.map(u => u.name).join(',');
  } else if (currentSelectionType.value === 'node' && currentSelectionIndex.value >= 0) {
    approvalSettings.nodes[currentSelectionIndex.value].users = currentSelectedUsers.value.map(user => ({
      code: user.code,
      name: user.name || user.text.split(' - ')[1] || user.code
    }));
    approvalSettings.nodes[currentSelectionIndex.value].usersText = 
      approvalSettings.nodes[currentSelectionIndex.value].users.map(u => u.name).join(',');
  }
  
  showUserSelect.value = false;
  submitApprovalSettings();
};

const showTypeSelect = ref(false);
let currentApproverIndex = 0;

const addApprover = () => {
  approvalSettings.nodes.push({
    type: 'approve',
    users: [],
    usersText: ''
  });
  submitApprovalSettings();
};

const removeApprover = (index) => {
  approvalSettings.nodes.splice(index, 1);
  submitApprovalSettings();
};

const showTypePicker = (index) => {
  currentApproverIndex = index;
  showTypeSelect.value = true;
};

const onTypeConfirm = ({ selectedOptions }) => {
  approvalSettings.nodes[currentApproverIndex].type = selectedOptions[0].value;
  showTypeSelect.value = false;
  submitApprovalSettings();
};

const submitApprovalSettings = async () => {
  try {
    // 数据清洗和格式化
    const auditData = {
      starter: approvalSettings.starter.map(user => ({ 
        code: user.code,
        name: user.name
      })),
      nodes: approvalSettings.nodes.map(node => ({
        type: node.type,
        users: node.users.map(user => ({
          code: user.code,
          name: user.name
        }))
      }))
    };

    const saveData = {
      form: 'selftool',
      audit_json: JSON.stringify(auditData)
    };
    
    const response = await apiClient.post('/api/save_approval_settings', saveData);
    
    if (response.data && response.data.code === 0) {
      showToast('保存成功');
      return true;
    } else {
      console.error('保存失败，服务器响应:', response.data);
      showToast(`保存失败: ${response.data?.message || '未知错误'}`);
      return false;
    }
  } catch (error) {
    console.error('保存审批设置出错:', error);
    showToast(`保存失败: ${error.message || '网络错误'}`);
    return false;
  }
};

const saveApprovalSettings = () => {
  approvalSettings.formtype = 'selftool';
  submitApprovalSettings();
};
</script>

<style scoped>
/* 原有样式保持不变 */
.van-dialog {
  max-height: 70vh;
  overflow-y: auto;
}

.form-container {
  max-height: calc(70vh - 100px);
  overflow-y: auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.handler {
  font-size: 14px;
  color: #666;
}

.tool-item {
  margin-bottom: 10px;
}

.tool-row {
  display: flex;
  margin-bottom: 5px;
}

.tool-row span {
  flex: 1;
  font-size: 14px;
}

.tags {
  margin: 10px 0;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

.time {
  font-size: 12px;
  color: #999;
}

.form-container {
  padding: 16px;
}

.tool-items-container {
  margin-top: 10px;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background-color: #f7f8fa;
}

.button-group {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin: 16px 0;
}

.approval-form {
  padding: 16px;
}

.approval-item {
  margin-bottom: 10px;
}

.approval-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.approval-controls {
  display: flex;
  align-items: center;
  min-width: 20px;
}

.approval-controls .van-field {
  flex: 1;
  margin-left: 0;
}

.user-selector-container {
  display: flex;
  height: 50vh;
  overflow: hidden;
}

.left-panel {
  flex: 1;
  border-right: 1px solid #eee;
  overflow-y: auto;
}

.right-panel {
  width: 40%;
  overflow-y: auto;
}

.search-container {
  padding: 10px;
  background-color: #fff;
  position: sticky;
  top: 0;
  z-index: 1;
}

.selected-header {
  padding: 10px 16px;
  font-weight: bold;
  background-color: #f7f8fa;
  position: sticky;
  top: 0;
  z-index: 1;
}

.van-cell {
  display: flex;
  align-items: center;
}
</style>
