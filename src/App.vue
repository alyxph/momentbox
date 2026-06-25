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
const gifs = ref([]);
const capturedFrames = ref([]);
const selectedFrame = ref(null);
const cameraKey = ref(0);
const customLayouts = ref([]);
const frameNextPage = ref('camera');

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
  gifs.value = [];
  capturedFrames.value = [];
  page.value = 'camera';
  cameraKey.value += 1;
}

function goHome() {
  page.value = 'home';
  photos.value = [];
  gifs.value = [];
  capturedFrames.value = [];
  selectedFrame.value = null;
}

function startFlow() {
  photos.value = [];
  gifs.value = [];
  capturedFrames.value = [];
  selectedFrame.value = null;
  frameNextPage.value = 'camera';
  page.value = 'frames';
}

function openFrames(nextPage = 'preview') {
  frameNextPage.value = nextPage;
  page.value = 'frames';
}

function selectFrame(frame) {
  selectedFrame.value = frame;
  if (frameNextPage.value === 'camera') {
    photos.value = [];
    cameraKey.value += 1;
  }
  page.value = frameNextPage.value;
}

function goToPreview() {
  if (!selectedFrame.value) {
    openFrames('preview');
    return;
  }
  page.value = 'preview';
}

function retakePhotos() {
  goToCamera();
}

function changeFrame() {
  openFrames('preview');
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
    <HomePage v-if="page === 'home'" @start="startFlow" @settings="openSettings" />

    <SettingsPage
      v-else-if="page === 'settings'"
      @go-home="goHome"
      @save="saveLayout"
      @delete="deleteLayout"
    />

    <CameraPage
      v-else-if="page === 'camera'"
      :key="cameraKey"
      :selected-frame="selectedFrame"
      v-model:photos="photos"
      v-model:gifs="gifs"
      v-model:captured-frames="capturedFrames"
      @done="goToPreview"
      @go-home="goHome"
      @change-frame="() => openFrames('camera')"
    />

    <FramesPage
      v-else-if="page === 'frames'"
      :frames="frames"
      :photos="photos"
      :custom-layouts="customLayouts"
      :selected-frame="selectedFrame"
      @select="selectFrame"
      @go-home="goHome"
    />

    <PreviewPage
      v-else-if="page === 'preview'"
      :selected-frame="selectedFrame"
      :photos="photos"
      :gifs="gifs"
      :captured-frames="capturedFrames"
      @change-frame="changeFrame"
      @retake="retakePhotos"
      @go-home="goHome"
    />
  </div>
</template>
