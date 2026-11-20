import { createApp } from 'vue';
import './style.css';
import { initTheme } from './composables/useTheme.js';
import App from './App.vue';

initTheme();
createApp(App).mount('#app');
