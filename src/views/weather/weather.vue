<template>
  <div class="weather-dashboard">
    <!-- 头部区域 -->
    <div class="dashboard-header">
      <div class="header-left">
        <h1>气象信息大屏</h1>
        <p v-if="weatherData">
          {{ weatherData.forecasts[0].province }} {{ weatherData.forecasts[0].city }} | 数据更新于 {{ weatherData.forecasts[0].reporttime }}
        </p>
      </div>
      <div class="header-right">
        <div class="current-time">{{ currentTime }}</div>
        <div class="current-date">{{ currentDate }}</div>
      </div>
    </div>
    
    <!-- 主内容区域 -->
    <div class="dashboard-content">
      <!-- 左侧气象信息 -->
      <div class="weather-section">
        <div class="dashboard-grid">
          <!-- 当前天气 -->
          <t-card class="dashboard-card current-weather-card" hover-shadow>
            <div class="current-weather" v-if="weatherData">
              <div class="weather-icon">
                <t-icon :name="getWeatherIcon(todayWeather.dayweather)" />
              </div>
              <div class="weather-info">
                <div class="temperature">{{ todayWeather.daytemp }}°C</div>
                <div class="weather-desc">{{ todayWeather.dayweather }}</div>
              </div>
            </div>
          </t-card>

          <!-- 今日详情 -->
          <t-card class="dashboard-card" hover-shadow>
             <template #header><div class="card-title">今日详情</div></template>
            <div class="today-details">
              <div class="detail-item">
                <span>最高温</span>
                <strong>{{ todayWeather.daytemp }}°C</strong>
              </div>
              <div class="detail-item">
                <span>最低温</span>
                <strong>{{ todayWeather.nighttemp }}°C</strong>
              </div>
               <div class="detail-item">
                <span>风向</span>
                <strong>{{ todayWeather.daywind }}风</strong>
              </div>
              <div class="detail-item">
                <span>风力</span>
                <strong>{{ todayWeather.daypower }} 级</strong>
              </div>
            </div>
          </t-card>
          
          <!-- 温度趋势 -->
          <t-card class="dashboard-card" hover-shadow>
            <template #header><div class="card-title">温度趋势</div></template>
            <div class="chart-container" ref="tempChart"></div>
          </t-card>
          
          <!-- 四日预报 -->
          <t-card class="dashboard-card" hover-shadow>
            <template #header><div class="card-title">四日预报</div></template>
            <div class="forecast-container">
              <div 
                class="forecast-item" 
                v-for="(cast, index) in weatherData.forecasts[0].casts" 
                :key="index"
              >
                <div class="forecast-date">{{ formatDate(cast.date) }} ({{ formatWeek(cast.week) }})</div>
                <div class="forecast-icon">
                  <t-icon :name="getWeatherIcon(cast.dayweather)" size="2em"></t-icon>
                </div>
                <div class="forecast-weather">{{ cast.dayweather }}</div>
                <div class="forecast-temp">{{ cast.nighttemp }}° / {{ cast.daytemp }}°</div>
              </div>
            </div>
          </t-card>
          
          <!-- 气象指数 -->
          <t-card class="dashboard-card" hover-shadow>
            <template #header><div class="card-title">气象指数</div></template>
            <div class="indices-container">
              <div 
                class="index-item" 
                v-for="(item, idx) in weatherIndices" 
                :key="idx"
              >
                <t-icon :name="item.icon" size="1.8em" :style="{ color: item.color }"></t-icon>
                <div class="index-info">
                  <div class="index-name">{{ item.name }}</div>
                  <div class="index-value" :style="{ color: item.color }">{{ item.value }}</div>
                </div>
              </div>
            </div>
          </t-card>

           <!-- 风力信息 -->
          <t-card class="dashboard-card" hover-shadow>
            <template #header><div class="card-title">风力信息</div></template>
            <div class="wind-container">
              <div 
                class="wind-item" 
                v-for="(cast, index) in weatherData.forecasts[0].casts" 
                :key="index"
              >
                <div class="wind-info">
                  <div class="wind-date">{{ formatDate(cast.date) }}</div>
                  <div class="wind-details">
                    <t-icon name="wind" size="1.5em"></t-icon>
                    <span>{{ cast.daywind }}风 {{ cast.daypower }}级</span>
                  </div>
                </div>
              </div>
            </div>
          </t-card>

        </div>
      </div>
      
      <!-- 右侧地图区域 -->
      <t-card class="map-section" :bordered="false">
        <div class="map-header">
          <t-icon name="earth" />
          <span>全球风场实时动态</span>
        </div>
        <iframe 
          class="map-iframe" 
          src="https://earth.nullschool.net/zh-cn/#current/wind/surface/level/orthographic=-241.89,33.26,2990/loc=120.163,31.958" 
          allowfullscreen
        ></iframe>
      </t-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import * as echarts from 'echarts';

// --- 类型定义 ---
interface WeatherCast {
  date: string; week: string; dayweather: string; nightweather: string;
  daytemp: string; nighttemp: string; daywind: string; nightwind: string;
  daypower: string; nightpower: string; daytemp_float: string; nighttemp_float: string;
}
interface WeatherForecast {
  city: string; adcode: string; province: string; reporttime: string; casts: WeatherCast[];
}
interface WeatherData {
  status: string; count: string; info: string; infocode: string; forecasts: WeatherForecast[];
}
interface WeatherIndex {
  name: string; icon: string; value: string; color: string;
}

// --- 状态管理 ---
const currentTime = ref<string>('');
const currentDate = ref<string>('');
const tempChart = ref<HTMLElement | null>(null);
let chartInstance: echarts.ECharts | null = null;
let timeInterval: number | null = null;

// --- 模拟数据 ---
const weatherData = ref<WeatherData>({
  status: "1", count: "1", info: "OK", infocode: "10000",
  forecasts: [{
    city: "靖江市", adcode: "321282", province: "江苏", reporttime: "2025-07-09 16:04:21",
    casts: [
      { date: "2025-07-09", week: "3", dayweather: "晴", nightweather: "晴", daytemp: "33", nighttemp: "27", daywind: "东", nightwind: "东", daypower: "1-3", nightpower: "1-3", daytemp_float: "33.0", nighttemp_float: "27.0" },
      { date: "2025-07-10", week: "4", dayweather: "多云", nightweather: "小雨", daytemp: "34", nighttemp: "27", daywind: "东", nightwind: "东", daypower: "1-3", nightpower: "1-3", daytemp_float: "34.0", nighttemp_float: "27.0" },
      { date: "2025-07-11", week: "5", dayweather: "暴雨", nightweather: "小雨", daytemp: "29", nighttemp: "26", daywind: "东北", nightwind: "东北", daypower: "1-3", nightpower: "1-3", daytemp_float: "29.0", nighttemp_float: "26.0" },
      { date: "2025-07-12", week: "6", dayweather: "小雨", nightweather: "阴", daytemp: "31", nighttemp: "26", daywind: "东", nightwind: "东", daypower: "1-3", nightpower: "1-3", daytemp_float: "31.0", nighttemp_float: "26.0" }
    ]
  }]
});

const weatherIndices = ref<WeatherIndex[]>([
  { name: '紫外线', icon: 'sun', value: '中等', color: '#f57c00' },
  { name: '健康', icon: 'heart', value: '良好', color: '#d32f2f' },
  { name: '穿衣', icon: 'clothes', value: '舒适', color: '#388e3c' },
  { name: '出行', icon: 'car', value: '适宜', color: '#1976d2' },
  { name: '运动', icon: 'run', value: '适宜', color: '#0097a7' },
  { name: '洗车', icon: 'water', value: '不宜', color: '#512da8' }
]);

// --- 计算属性 ---
const todayWeather = computed(() => weatherData.value.forecasts[0].casts[0]);

// --- 方法 ---
const updateDateTime = () => {
  const now = new Date();
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  currentDate.value = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
};

const formatWeek = (week: string): string => {
  const weekMap: Record<string, string> = { '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六', '7': '日' };
  return `周${weekMap[week] || ''}`;
};

const getWeatherIcon = (weather: string): string => {
  const iconMap: Record<string, string> = {
    '晴': 'sunny', '多云': 'cloudy', '阴': 'cloudy',
    '小雨': 'rain', '中雨': 'rain', '大雨': 'rain',
    '阵雨': 'rain', '雷阵雨': 'thunderstorm', '暴雨': 'rainy',
    '大暴雨': 'rainy', '特大暴雨': 'rainy',
    '雪': 'snow', '雾': 'fog',
  };
  return iconMap[weather] || 'cloudy'; // 默认图标
};

const initTempChart = () => {
  if (!tempChart.value) return;
  chartInstance = echarts.init(tempChart.value);
  
  const casts = weatherData.value.forecasts[0].casts;
  const dates = casts.map(c => formatDate(c.date));
  const dayTemps = casts.map(c => parseInt(c.daytemp));
  const nightTemps = casts.map(c => parseInt(c.nighttemp));
  
  const option: echarts.EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['白天温度', '夜间温度'], top: '5%', right: '5%' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: dates },
    yAxis: { type: 'value', axisLabel: { formatter: '{value} °C' } },
    series: [
      {
        name: '白天温度', type: 'line', smooth: true,
        itemStyle: { color: '#FF6B6B' },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(255, 107, 107, 0.5)' }, { offset: 1, color: 'rgba(255, 107, 107, 0)' }])},
        data: dayTemps
      },
      {
        name: '夜间温度', type: 'line', smooth: true,
        itemStyle: { color: '#4D96FF' },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(77, 150, 255, 0.5)' }, { offset: 1, color: 'rgba(77, 150, 255, 0)' }])},
        data: nightTemps
      }
    ]
  };
  chartInstance.setOption(option);
};

const resizeChart = () => {
  chartInstance?.resize();
};

// --- 生命周期 ---
onMounted(() => {
  updateDateTime();
  timeInterval = setInterval(updateDateTime, 1000);
  
  initTempChart();
  window.addEventListener('resize', resizeChart);
});

onBeforeUnmount(() => {
  if (timeInterval) clearInterval(timeInterval);
  window.removeEventListener('resize', resizeChart);
  chartInstance?.dispose();
});
</script>

<style scoped>
:root {
  --bg-color: #f4f6f9;
  --card-bg-color: #ffffff;
  --text-primary-color: #1f2937;
  --text-secondary-color: #6b7280;
  --border-color: #e5e7eb;
  --shadow-color: rgba(0, 0, 0, 0.05);
}

.weather-dashboard {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--bg-color);
  color: var(--text-primary-color);
  padding: 16px;
  box-sizing: border-box;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 8px;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.header-left h1 {
  font-size: 2rem;
  font-weight: 600;
  margin: 0 0 4px 0;
}

.header-left p {
  font-size: 0.9rem;
  color: var(--text-secondary-color);
  margin: 0;
}

.header-right {
  text-align: right;
}

.current-time {
  font-size: 1.5rem;
  font-weight: 500;
}

.current-date {
  font-size: 0.9rem;
  color: var(--text-secondary-color);
}

.dashboard-content {
  display: flex;
  flex: 1;
  gap: 16px;
  overflow: hidden;
}

.weather-section {
  flex: 7;
  overflow-y: auto;
}

.map-section {
  flex: 5;
  display: flex;
  flex-direction: column;
  background-color: var(--card-bg-color);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px var(--shadow-color);
}

.map-header {
  padding: 12px 16px;
  font-size: 1rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--border-color);
}

.map-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.dashboard-card {
  background-color: var(--card-bg-color);
  border-radius: 12px;
  box-shadow: 0 4px 12px var(--shadow-color);
  border: 1px solid var(--border-color);
  padding: 16px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

:deep(.t-card__header) {
  padding: 0 0 12px 0;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 12px;
}
:deep(.t-card__body) {
  padding: 0;
  flex: 1;
  overflow: hidden;
}

.card-title {
  font-size: 1.1rem;
  font-weight: 600;
}

/* Card Specific Styles */
.current-weather-card .current-weather {
  display: flex;
  align-items: center;
  gap: 20px;
}
.current-weather-card .weather-icon {
  font-size: 5rem;
  color: #4a90e2;
}
.current-weather-card .weather-info {
  line-height: 1.2;
}
.current-weather-card .temperature {
  font-size: 3.5rem;
  font-weight: 700;
}
.current-weather-card .weather-desc {
  font-size: 1.5rem;
  color: var(--text-secondary-color);
}

.today-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  height: 100%;
  align-content: center;
}
.today-details .detail-item {
  display: flex;
  flex-direction: column;
  background-color: #f9fafb;
  padding: 12px;
  border-radius: 8px;
}
.today-details .detail-item span {
  font-size: 0.9rem;
  color: var(--text-secondary-color);
}
.today-details .detail-item strong {
  font-size: 1.2rem;
  font-weight: 600;
}

.chart-container {
  width: 100%;
  height: 100%;
  min-height: 180px;
}

.forecast-container {
  display: flex;
  justify-content: space-between;
  height: 100%;
  gap: 12px;
}
.forecast-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-around;
  padding: 12px 8px;
  border-radius: 8px;
  background-color: #f9fafb;
  text-align: center;
}
.forecast-date { font-size: 0.9rem; font-weight: 500; }
.forecast-icon { margin: 8px 0; color: #4a90e2; }
.forecast-weather { font-size: 1rem; margin-bottom: 4px; }
.forecast-temp { font-size: 1rem; font-weight: 500; color: var(--text-secondary-color); }

.indices-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  height: 100%;
}
.index-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background-color: #f9fafb;
  padding: 12px;
  border-radius: 8px;
}
.index-info {
  line-height: 1.3;
}
.index-name { font-size: 0.9rem; }
.index-value { font-size: 1.1rem; font-weight: 600; }

.wind-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  overflow-y: auto;
}
.wind-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background-color: #f9fafb;
  border-radius: 8px;
}
.wind-info .wind-date { font-weight: 500; }
.wind-info .wind-details { display: flex; align-items: center; gap: 8px; color: var(--text-secondary-color); }

/* Responsive */
@media (max-width: 1400px) {
  .weather-section {
    flex: 6;
  }
  .map-section {
    flex: 4;
  }
  .indices-container {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .dashboard-content {
    flex-direction: column;
  }
  .weather-section {
    overflow-y: visible;
  }
  .map-section {
    min-height: 300px;
  }
  .header-left h1 { font-size: 1.5rem; }
  .current-time { font-size: 1.2rem; }
}
</style>
