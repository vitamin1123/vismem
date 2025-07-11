<template>
  <div class="weather-dashboard-container">
    <!-- 天气背景动画 -->
    <div class="weather-bg">
      <div class="sun"></div>
      <div class="cloud"></div>
      <div class="cloud"></div>
      <div class="cloud"></div>
    </div>

    <!-- 天气仪表盘 -->
    <div class="weather-dashboard">
      <!-- 头部区域 -->
      <div class="dashboard-header">
        <div class="header-left">
          <h1>气象信息大屏</h1>
          <p>{{ locationText }} | 数据更新于 {{ formatDateTime(weatherData.now.uptime) }}</p>
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
            <!-- 当前天气信息 -->
            <div class="dashboard-card current-weather-card">
              <div class="current-weather">
                <div class="weather-icon">
                  <i :class="getWeatherIcon(weatherData.now.text)"></i>
                </div>
                <div class="weather-info">
                  <div class="temperature">{{ weatherData.now.temp }}°</div>
                  <div class="weather-desc">{{ weatherData.now.text }}</div>
                  <div class="weather-feels">体感温度 {{ weatherData.now.feels_like }}°</div>
                </div>
              </div>
              <div class="weather-details">
                <div class="detail-item">
                  <span>湿度</span>
                  <strong>{{ weatherData.now.rh }}%</strong>
                </div>
                <div class="detail-item">
                  <span>风力</span>
                  <strong>{{ weatherData.now.wind_dir }} {{ weatherData.now.wind_class }}</strong>
                </div>
                <div class="detail-item">
                  <span>能见度</span>
                  <strong>{{ (weatherData.now.vis / 1000).toFixed(1) }}km</strong>
                </div>
                <div class="detail-item">
                  <span>空气质量</span>
                  <strong>{{ getAirQuality(weatherData.now.aqi) }}</strong>
                </div>
              </div>
            </div>

            <!-- 未来七天预报 -->
            <div class="dashboard-card weekly-forecast-card">
              <div class="card-title">未来五天预报</div>
              <div class="weekly-forecast-container">
                <div 
                  v-for="(day, index) in weeklyForecast" 
                  :key="index" 
                  class="weekly-item"
                >
                  <div class="weekly-date">
                    <div class="weekly-week">{{ day.week }}</div>
                    <div class="weekly-day">{{ formatDate(day.date) }}</div>
                  </div>
                  <div class="weekly-weather">
                    <i :class="getWeatherIcon(day.text_day)"></i>
                    <span>{{ day.text_day }} / {{ day.text_night }}</span>
                  </div>
                  <div class="weekly-temp">
                    <span class="high-temp">{{ day.high }}°</span>
                    <span class="low-temp">{{ day.low }}°</span>
                  </div>
                  <div class="weekly-wind">
                    <i class="td-icon t-icon-wind"></i>
                    <span>{{ day.wd_day }} {{ day.wc_day }}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 24小时预报 -->
            <div class="dashboard-card hourly-forecast-card">
              <div class="card-title">24小时预报</div>
              <div class="hourly-forecast-container">
                <div class="hourly-temp-container">
                  <div 
                    v-for="(hour, index) in hourlyForecast" 
                    :key="'temp-'+index" 
                    class="hourly-temp"
                    :style="{ height: calculateTempHeight(hour.temp_fc) + 'px' }"
                  >
                    <span>{{ hour.temp_fc }}°</span>
                  </div>
                </div>
                <div class="hourly-time-container">
                  <div 
                    v-for="(hour, index) in hourlyForecast" 
                    :key="'time-'+index" 
                    class="hourly-time"
                  >
                    {{ formatHour24(hour.data_time) }}
                  </div>
                </div>
                <div class="hourly-weather-container">
                  <div 
                    v-for="(hour, index) in hourlyForecast" 
                    :key="'weather-'+index" 
                    class="hourly-weather"
                  >
                    <i :class="getWeatherIcon(hour.text)"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 右侧地图区域 -->
        <div class="map-section">
          <div class="map-header">
            <i class="td-icon t-icon-earth map-icon"></i>
            <span>全球风场实时动态</span>
          </div>
          <iframe 
            class="map-iframe" 
            src="https://earth.nullschool.net/zh-cn/#current/wind/surface/level/orthographic=-241.89,33.26,2990/loc=120.163,31.958" 
            allowfullscreen
          ></iframe>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';

// 定义天气数据类型
interface WeatherData {
  location: {
    country: string;
    province: string;
    city: string;
    name: string;
    id: string;
  };
  now: {
    text: string;
    temp: number;
    feels_like: number;
    rh: number;
    wind_class: string;
    wind_dir: string;
    prec_1h: number;
    clouds: number;
    vis: number;
    aqi: number;
    pm25: number;
    pm10: number;
    no2: number;
    so2: number;
    o3: number;
    co: number;
    uptime: string;
  };
  forecasts: {
    text_day: string;
    text_night: string;
    high: number;
    low: number;
    wc_day: string;
    wd_day: string;
    wc_night: string;
    wd_night: string;
    date: string;
    week: string;
  }[];
  forecast_hours: {
    text: string;
    temp_fc: number;
    wind_class: string;
    wind_dir: string;
    rh: number;
    prec_1h: number;
    clouds: number;
    data_time: string;
  }[];
}

// 模拟后端数据
const weatherData: WeatherData = {
  "location": {
    "country": "中国",
    "province": "江苏省",
    "city": "泰州市",
    "name": "靖江",
    "id": "321282"
  },
  "now": {
    "text": "多云",
    "temp": 30,
    "feels_like": 31,
    "rh": 76,
    "wind_class": "2级",
    "wind_dir": "东风",
    "prec_1h": 0.0,
    "clouds": 52,
    "vis": 8500,
    "aqi": 74,
    "pm25": 54,
    "pm10": 79,
    "no2": 36,
    "so2": 9,
    "o3": 64,
    "co": 0.8,
    "uptime": "20250710094000"
  },
  "forecasts": [
    {
      "text_day": "晴",
      "text_night": "多云",
      "high": 32,
      "low": 27,
      "wc_day": "<3级",
      "wd_day": "东风",
      "wc_night": "<3级",
      "wd_night": "东北风",
      "date": "2025-07-10",
      "week": "星期四"
    },
    {
      "text_day": "大雨",
      "text_night": "小雨",
      "high": 29,
      "low": 26,
      "wc_day": "<3级",
      "wd_day": "东北风",
      "wc_night": "<3级",
      "wd_night": "东风",
      "date": "2025-07-11",
      "week": "星期五"
    },
    {
      "text_day": "中雨",
      "text_night": "晴",
      "high": 30,
      "low": 26,
      "wc_day": "<3级",
      "wd_day": "东风",
      "wc_night": "<3级",
      "wd_night": "东北风",
      "date": "2025-07-12",
      "week": "星期六"
    },
    {
      "text_day": "晴",
      "text_night": "晴",
      "high": 32,
      "low": 26,
      "wc_day": "<3级",
      "wd_day": "东风",
      "wc_night": "<3级",
      "wd_night": "东风",
      "date": "2025-07-13",
      "week": "星期日"
    },
    {
      "text_day": "多云",
      "text_night": "阴",
      "high": 33,
      "low": 27,
      "wc_day": "<3级",
      "wd_day": "西风",
      "wc_night": "<3级",
      "wd_night": "西南风",
      "date": "2025-07-14",
      "week": "星期一"
    },
    {
      "text_day": "阴",
      "text_night": "阴",
      "high": 34,
      "low": 29,
      "wc_day": "<3级",
      "wd_day": "西南风",
      "wc_night": "<3级",
      "wd_night": "南风",
      "date": "2025-07-15",
      "week": "星期二"
    },
    {
      "text_day": "多云",
      "text_night": "阴",
      "high": 36,
      "low": 29,
      "wc_day": "<3级",
      "wd_day": "东南风",
      "wc_night": "<3级",
      "wd_night": "东南风",
      "date": "2025-07-16",
      "week": "星期三"
    }
  ],
  "forecast_hours": [
    {
      "text": "晴",
      "temp_fc": 29,
      "wind_class": "<3级",
      "wind_dir": "东风",
      "rh": 76,
      "prec_1h": 0.0,
      "clouds": 1,
      "data_time": "2025-07-10 09:00:00"
    },
    {
      "text": "晴",
      "temp_fc": 30,
      "wind_class": "<3级",
      "wind_dir": "东风",
      "rh": 73,
      "prec_1h": 0.0,
      "clouds": 4,
      "data_time": "2025-07-10 10:00:00"
    },
    {
      "text": "晴",
      "temp_fc": 31,
      "wind_class": "<3级",
      "wind_dir": "东风",
      "rh": 70,
      "prec_1h": 0.0,
      "clouds": 6,
      "data_time": "2025-07-10 11:00:00"
    },
    {
      "text": "晴",
      "temp_fc": 31,
      "wind_class": "<3级",
      "wind_dir": "东风",
      "rh": 70,
      "prec_1h": 0.0,
      "clouds": 7,
      "data_time": "2025-07-10 12:00:00"
    },
    {
      "text": "晴",
      "temp_fc": 31,
      "wind_class": "<3级",
      "wind_dir": "东风",
      "rh": 71,
      "prec_1h": 0.0,
      "clouds": 8,
      "data_time": "2025-07-10 13:00:00"
    },
    {
      "text": "晴",
      "temp_fc": 32,
      "wind_class": "3~4级",
      "wind_dir": "东风",
      "rh": 72,
      "prec_1h": 0.0,
      "clouds": 9,
      "data_time": "2025-07-10 14:00:00"
    },
    {
      "text": "晴",
      "temp_fc": 31,
      "wind_class": "<3级",
      "wind_dir": "东风",
      "rh": 72,
      "prec_1h": 0.0,
      "clouds": 7,
      "data_time": "2025-07-10 15:00:00"
    },
    {
      "text": "晴",
      "temp_fc": 31,
      "wind_class": "<3级",
      "wind_dir": "东风",
      "rh": 72,
      "prec_1h": 0.0,
      "clouds": 6,
      "data_time": "2025-07-10 16:00:00"
    },
    {
      "text": "晴",
      "temp_fc": 31,
      "wind_class": "<3级",
      "wind_dir": "东风",
      "rh": 73,
      "prec_1h": 0.0,
      "clouds": 5,
      "data_time": "2025-07-10 17:00:00"
    },
    {
      "text": "晴",
      "temp_fc": 30,
      "wind_class": "<3级",
      "wind_dir": "东风",
      "rh": 75,
      "prec_1h": 0.0,
      "clouds": 3,
      "data_time": "2025-07-10 18:00:00"
    },
    {
      "text": "晴",
      "temp_fc": 29,
      "wind_class": "<3级",
      "wind_dir": "东风",
      "rh": 77,
      "prec_1h": 0.0,
      "clouds": 1,
      "data_time": "2025-07-10 19:00:00"
    },
    {
      "text": "晴",
      "temp_fc": 29,
      "wind_class": "<3级",
      "wind_dir": "东风",
      "rh": 79,
      "prec_1h": 0.0,
      "clouds": 0,
      "data_time": "2025-07-10 20:00:00"
    }
  ]
};

// 响应式数据
const currentTime = ref('15:48:22');
const currentDate = ref('2025年7月10日 星期四');

// 计算属性
const locationText = computed(() => {
  return `${weatherData.location.province} ${weatherData.location.name}`;
});

const hourlyForecast = computed(() => {
  return weatherData.forecast_hours.slice(0, 12); // 只取前12小时数据
});

const weeklyForecast = computed(() => {
  return weatherData.forecasts.slice(0, 5);
});

// 方法
const formatDateTime = (datetime: string) => {
  // 20250710094000 -> 2025-07-10 09:40:00
  const year = datetime.substring(0, 4);
  const month = datetime.substring(4, 6);
  const day = datetime.substring(6, 8);
  const hour = datetime.substring(8, 10);
  const minute = datetime.substring(10, 12);
  return `${year}-${month}-${day} ${hour}:${minute}`;
};

const formatHour24 = (datetime: string) => {
  // 2025-07-10 09:00:00 -> 09:00
  return datetime.substring(11, 16);
};

const formatDate = (dateStr: string) => {
  // 2025-07-10 -> 07月10日
  return dateStr.substring(5, 7) + '月' + dateStr.substring(8, 10) + '日';
};

const calculateTempHeight = (temp: number) => {
  // 温度范围假设为25-40度，计算柱状图高度
  const minTemp = 25;
  const maxTemp = 40;
  const maxHeight = 80;
  return ((temp - minTemp) / (maxTemp - minTemp)) * maxHeight;
};

const getWeatherIcon = (weather: string) => {
  const iconMap: Record<string, string> = {
    '晴': 'td-icon t-icon-sunny',
    '多云': 'td-icon t-icon-cloudy',
    '阴': 'td-icon t-icon-cloud',
    '小雨': 'td-icon t-icon-rain',
    '中雨': 'td-icon t-icon-rainy',
    '大雨': 'td-icon t-icon-heavy-rain',
    '暴雨': 'td-icon t-icon-storm',
    '雾': 'td-icon t-icon-fog',
    '雪': 'td-icon t-icon-snow',
  };
  return iconMap[weather] || 'td-icon t-icon-sunny';
};

const getAirQuality = (aqi: number) => {
  if (aqi <= 50) return '优';
  if (aqi <= 100) return '良';
  if (aqi <= 150) return '轻度污染';
  if (aqi <= 200) return '中度污染';
  if (aqi <= 300) return '重度污染';
  return '严重污染';
};

// 更新时间显示
let timer: number | null = null;
const updateDateTime = () => {
  const now = new Date();
  currentTime.value = now.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: false 
  });
  
  currentDate.value = now.toLocaleDateString('zh-CN', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric', 
    weekday: 'long' 
  });
};

// 生命周期钩子
onMounted(() => {
  updateDateTime();
  timer = setInterval(updateDateTime, 1000);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.weather-dashboard-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
  color: var(--text-primary);
  overflow: hidden;
  position: relative;
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
}

/* 天气背景动画 */
.weather-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  overflow: hidden;
}

.sun {
  position: absolute;
  top: 10%;
  right: 15%;
  width: 120px;
  height: 100px;
  background: radial-gradient(circle, #ffde59 0%, rgba(255,222,89,0.8) 40%, rgba(255,222,89,0.4) 70%, transparent 90%);
  border-radius: 50%;
  box-shadow: 0 0 100px 40px rgba(255, 222, 89, 0.6);
  animation: pulse 8s infinite ease-in-out;
}

.cloud {
  position: absolute;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  filter: blur(10px);
  animation: float 30s linear infinite;
}

.cloud:nth-child(1) {
  top: 15%;
  left: 5%;
  width: 150px;
  height: 60px;
  animation-duration: 40s;
}

.cloud:nth-child(2) {
  top: 25%;
  right: 10%;
  width: 200px;
  height: 80px;
  animation-duration: 35s;
  animation-delay: -15s;
}

.cloud:nth-child(3) {
  top: 40%;
  left: 15%;
  width: 180px;
  height: 70px;
  animation-duration: 50s;
  animation-delay: -10s;
}

.weather-dashboard {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 24px;
  position: relative;
  z-index: 10;
  backdrop-filter: blur(2px);
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px 24px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--glass-border);
}

.header-left h1 {
  font-size: 2.8rem;
  font-weight: 700;
  background: linear-gradient(90deg, #ffffff, #a0d7ff);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 0 15px rgba(74, 144, 226, 0.3);
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.header-left p {
  font-size: 1.1rem;
  color: var(--text-secondary);
  letter-spacing: 0.5px;
  font-weight: 300;
}

.header-right {
  text-align: right;
}

.current-time {
  font-size: 2.5rem;
  font-weight: 300;
  letter-spacing: 2px;
  margin-bottom: 4px;
  color: #ffffff;
  text-shadow: 0 0 10px rgba(74, 144, 226, 0.7);
}

.current-date {
  font-size: 1.1rem;
  color: var(--text-secondary);
  font-weight: 300;
}

.dashboard-content {
  display: flex;
  flex: 1;
  gap: 24px;
  overflow: hidden;
}

.weather-section {
  flex: 7;
  display: flex;
  flex-direction: column;
  overflow-y: hidden;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  grid-template-rows: auto auto;
  gap: 24px;
}

.dashboard-card {
  background: var(--glass-bg);
  border-radius: 20px;
  border: 1px solid var(--glass-border);
  padding: 24px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(12px);
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.dashboard-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at top right, rgba(74, 144, 226, 0.15), transparent 70%);
  pointer-events: none;
}

.dashboard-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  border-color: rgba(255, 255, 255, 0.3);
}

.card-title {
  font-size: 1.4rem;
  font-weight: 600;
  margin-bottom: 20px;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, var(--primary-color), transparent);
  margin-left: 12px;
}

/* 当前天气信息样式 */
.current-weather-card {
  grid-column: 1;
  grid-row: 1;
}

.current-weather {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0 20px;
}

.weather-icon {
  font-size: 5rem;
  color: #ffde59;
  text-shadow: 0 0 20px rgba(255, 222, 89, 0.5);
  animation: floatIcon 6s infinite ease-in-out;
}

.weather-info {
  text-align: right;
}

.temperature {
  font-size: 4.5rem;
  font-weight: 300;
  line-height: 1;
  background: linear-gradient(90deg, #ffffff, #a0d7ff);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 8px;
}

.weather-desc {
  font-size: 1.8rem;
  color: var(--text-secondary);
  font-weight: 400;
}

.weather-feels {
  font-size: 1rem;
  color: var(--text-secondary);
}

.weather-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 20px;
}

.detail-item {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 16px;
  border: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.3s ease;
}

.detail-item:hover {
  background: rgba(74, 144, 226, 0.15);
  transform: translateY(-3px);
}

.detail-item span {
  font-size: 1rem;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.detail-item strong {
  font-size: 1.2rem;
  font-weight: 500;
  color: #ffffff;
}

/* 未来七天预报样式 */
.weekly-forecast-card {
  grid-column: 2;
  grid-row: 1;
}

.weekly-forecast-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 8px;
}

.weekly-forecast-container::-webkit-scrollbar {
  width: 6px;
}

.weekly-forecast-container::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.weekly-item {
  display: grid;
  grid-template-columns: 1fr 1.5fr 1fr 1fr;
  align-items: center;
  padding: 12px;
  background: var(--card-bg);
  border-radius: 12px;
  border: 1px solid var(--glass-border);
  transition: all 0.3s ease;
}

.weekly-item:hover {
  background: rgba(74, 144, 226, 0.15);
  transform: translateY(-3px);
}

.weekly-date {
  display: flex;
  flex-direction: column;
}

.weekly-week {
  font-weight: 500;
  color: #ffffff;
}

.weekly-day {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.weekly-weather {
  display: flex;
  align-items: center;
  gap: 8px;
}

.weekly-weather i {
  font-size: 1.5rem;
  color: #ffde59;
}

.weekly-weather span {
  font-size: 0.9rem;
}

.weekly-temp {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.high-temp {
  color: #ff6b6b;
  font-weight: 500;
}

.low-temp {
  color: #4d96ff;
  font-weight: 500;
}

.weekly-wind {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  justify-content: flex-end;
}

.weekly-wind i {
  color: var(--primary-color);
}

/* 24小时预报样式 */
.hourly-forecast-card {
  grid-column: 1 / span 2;
  grid-row: 2;
}

.hourly-forecast-container {
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.hourly-temp-container {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  height: 120px;
  padding: 0 10px;
}

.hourly-temp {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  background: linear-gradient(to top, #4a90e2, #36d1dc);
  border-radius: 4px 4px 0 0;
  margin: 0 2px;
  min-width: 30px;
  transition: all 0.3s ease;
  position: relative;
  transform: translateY(-5px);
  box-shadow: 0 0 10px rgba(74, 144, 226, 0.5);
}

.hourly-temp span {
  position: absolute;
  top: -25px;
  font-size: 0.9rem;
  color: #ffffff;
}

.hourly-time-container {
  display: flex;
  justify-content: space-between;
  padding: 0 10px;
}

.hourly-time {
  flex: 1;
  text-align: center;
  font-size: 0.9rem;
  color: var(--text-secondary);
  min-width: 30px;
}

.hourly-weather-container {
  display: flex;
  justify-content: space-between;
  padding: 0 10px;
}

.hourly-weather {
  flex: 1;
  text-align: center;
  font-size: 1.2rem;
  color: #ffde59;
  min-width: 30px;
}

/* 地图区域 */
.map-section {
  flex: 5;
  display: flex;
  flex-direction: column;
  background: var(--glass-bg);
  border-radius: 20px;
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow);
  backdrop-filter: blur(12px);
  overflow: hidden;
}

.map-header {
  padding: 20px;
  font-size: 1.4rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--glass-border);
}

.map-icon {
  font-size: 1.8rem;
  color: var(--primary-color);
}

.map-iframe {
  flex: 1;
  width: 100%;
  border: none;
}

/* 动画定义 */
@keyframes pulse {
  0% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(1); opacity: 0.8; }
}

@keyframes float {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100vw); }
}

@keyframes floatIcon {
  0% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0); }
}

/* 响应式设计 */
@media (max-width: 1400px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
  }
  
  .weekly-forecast-card {
    grid-column: 1;
    grid-row: 2;
  }
  
  .hourly-forecast-card {
    grid-column: 1;
    grid-row: 3;
  }
}

@media (max-width: 992px) {
  .dashboard-content {
    flex-direction: column;
  }
  
  .map-section {
    min-height: 400px;
  }
}

@media (max-width: 768px) {
  .header-left h1 {
    font-size: 2rem;
  }
  
  .current-time {
    font-size: 2rem;
  }
  
  .weekly-item {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto;
    gap: 8px;
  }
  
  .weekly-date {
    grid-column: 1;
    grid-row: 1;
  }
  
  .weekly-weather {
    grid-column: 2;
    grid-row: 1;
    justify-content: flex-end;
  }
  
  .weekly-temp {
    grid-column: 1;
    grid-row: 2;
  }
  
  .weekly-wind {
    grid-column: 2;
    grid-row: 2;
    justify-content: flex-end;
  }
  
  .weather-icon {
    font-size: 3.5rem;
  }
  
  .temperature {
    font-size: 3.5rem;
  }
  
  .weather-desc {
    font-size: 1.4rem;
  }
}
</style>

<style>
:root {
  --primary-color: #4a90e2;
  --secondary-color: #36d1dc;
  --accent-color: #5b86e5;
  --text-primary: #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.8);
  --card-bg: rgba(255, 255, 255, 0.12);
  --card-border: rgba(255, 255, 255, 0.2);
  --glass-bg: rgba(255, 255, 255, 0.08);
  --glass-border: rgba(255, 255, 255, 0.18);
  --shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
</style>