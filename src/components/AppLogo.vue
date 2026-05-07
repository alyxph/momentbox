<script setup>
import { LOGOS } from '../assets/Logos';

const props = defineProps({
  type: {
    type: String,
    default: 'MAIN' // 'MAIN', 'CAMERA', 'PHOTOSTRIP'
  },
  size: {
    type: [Number, String],
    default: 120
  }
});
</script>

<template>
  <div class="logo-container" :style="{ width: size + 'px', height: size + 'px' }">
    <img :src="LOGOS[props.type]" :alt="props.type" />
  </div>
</template>

<style scoped>
.logo-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-container img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  mix-blend-mode: multiply;
}
</style>
