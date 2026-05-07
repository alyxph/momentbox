<script setup>
import { ref } from 'vue';
import HomePage from './components/HomePage.vue';
import CameraPage from './components/CameraPage.vue';
import FramesPage from './components/FramesPage.vue';
import PreviewPage from './components/PreviewPage.vue';
import SettingsPage from './components/SettingsPage.vue';
import { frames } from './data/frames';

const page = ref('home');
const photos = ref([]);
const selectedFrame = ref(null);
const cameraKey = ref(0);
const customLayouts = ref([]);

// Load custom layouts from localStorage
const saved = localStorage.getItem('photobooth_custom_layouts');
if (saved) {
  try {
    customLayouts.value = JSON.parse(saved);
  } catch (e) {
    console.error('Failed to load custom layouts');
  }
}

function goToCamera() {
  photos.value = [];
  selectedFrame.value = null;
  page.value = 'camera';
  cameraKey.value += 1;
}

function goHome() {
  page.value = 'home';
  photos.value = [];
  selectedFrame.value = null;
}

function openFrames() {
  page.value = 'frames';
}

function selectFrame(frame) {
  selectedFrame.value = frame;
  page.value = 'preview';
}

function retakePhotos() {
  goToCamera();
}

function openSettings() {
  page.value = 'settings';
}

function saveLayout(payload) {
  console.log('Saving custom layout:', payload);
  const idx = customLayouts.value.findIndex(l => l.id === payload.id);
  if (idx >= 0) {
    customLayouts.value[idx] = payload;
  } else {
    customLayouts.value.push(payload);
  }
  localStorage.setItem('photobooth_custom_layouts', JSON.stringify(customLayouts.value));
}

function deleteLayout(id) {
  customLayouts.value = customLayouts.value.filter(l => l.id !== id);
  localStorage.setItem('photobooth_custom_layouts', JSON.stringify(customLayouts.value));
}
</script>

<template>
  <div class="app-root">
    <HomePage v-if="page === 'home'" @start="goToCamera" @settings="openSettings" />

    <SettingsPage
      v-else-if="page === 'settings'"
      @go-home="goHome"
      @save="saveLayout"
      @delete="deleteLayout"
    />

    <CameraPage
      v-else-if="page === 'camera'"
      :key="cameraKey"
      v-model:photos="photos"
      @done="openFrames"
      @go-home="goHome"
    />

    <FramesPage
      v-else-if="page === 'frames'"
      :frames="frames"
      :photos="photos"
      :custom-layouts="customLayouts"
      @select="selectFrame"
      @go-home="goHome"
    />

    <PreviewPage
      v-else-if="page === 'preview'"
      :selected-frame="selectedFrame"
      :photos="photos"
      @change-frame="openFrames"
      @retake="retakePhotos"
      @go-home="goHome"
    />
  </div>
</template>
