<script setup>
import AppLogo from './AppLogo.vue';
const emit = defineEmits(['start', 'settings']);
</script>

<template>
  <div
    style="width: 100vw; height: 100vh; position: relative; overflow: hidden;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: #f6f1e9;
      background-image: linear-gradient(0deg, rgba(0, 0, 0, 0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0, 0, 0, 0.04) 1px, transparent 1px);
      background-size: 28px 28px;"
  >
    <!-- Neobrutalist background decorations -->
    <!-- Star Top Left -->
    <div
      class="fa"
      style="position: absolute; top: 8%; left: 8%; color: #ff4cb0; font-size: 90px; text-shadow: 5px 5px 0 #000;"
    >
      ✦
    </div>

    <!-- Settings Button Top Right -->
    <button
      class="btn-3d"
      style="position: absolute; top: 24px; right: 24px; width: 64px; height: 64px; background: #c084fc;
        border: 4px solid #000; box-shadow: 6px 6px 0 #000; border-radius: 12px;
        display: flex; align-items: center; justify-content: center; z-index: 50; cursor: pointer;"
      @click="emit('settings')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    </button>
    <!-- Box Top Right -->
    <div
      class="fb"
      style="position: absolute; top: 12%; right: 12%; width: 110px; height: 110px; background: #00e5ff;
        border: 5px solid #000; box-shadow: 8px 8px 0 #000; transform: rotate(15deg);"
    ></div>
    <!-- Box Bottom Left -->
    <div
      class="fc"
      style="position: absolute; bottom: 15%; left: 10%; width: 140px; height: 80px; background: #ff6b35;
        border: 5px solid #000; box-shadow: -8px 8px 0 #000; transform: rotate(-10deg);"
    ></div>
    <!-- Star Bottom Right -->
    <div
      class="fa"
      style="position: absolute; bottom: 10%; right: 10%; color: #ffd700; font-size: 100px; text-shadow: 5px 5px 0 #000;"
    >
      ✦
    </div>
    <!-- Small elements -->
    <div
      class="fb"
      style="position: absolute; top: 40%; left: 5%; width: 30px; height: 30px; background: #a855f7;
        border: 3px solid #000; border-radius: 50%; box-shadow: 3px 3px 0 #000;"
    ></div>
    <div
      class="fc"
      style="position: absolute; bottom: 40%; right: 6%; width: 40px; height: 40px; background: #fff;
        border: 4px solid #000; box-shadow: 4px 4px 0 #000; transform: rotate(45deg);"
    ></div>

    <!-- Main Content Container -->
    <div
      class="bounce-in"
      style="position: relative; z-index: 10; padding: 40px 60px; background: #ffffff;
        border: 6px solid #000; box-shadow: 16px 16px 0 #000; width: 90vw; max-width: 1000px; aspect-ratio: 16 / 9;
        display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;"
    >
        <AppLogo type="MAIN" :size="300" style="filter: drop-shadow(8px 8px 0 #000);" />
      
      <!-- Subtitle banner -->
      <div style="margin: 16px 0 32px;">
        <div
          style="background: #ffd700; padding: 12px 32px; border: 4px solid #000;
            box-shadow: 6px 6px 0 #000; display: inline-block; transform: rotate(-3deg);"
        >
          <p
            style="font-family: 'Bangers', cursive; font-size: clamp(16px, 3vw, 26px);
              color: #000; letter-spacing: 3px; margin: 0;"
          >
            CAPTURE YOUR BEST MOMENTS!
          </p>
        </div>
      </div>

      <!-- Camera button -->
      <div style="display: flex; flex-direction: column; align-items: center; gap: 24px;">
        <button
          class="pulse-cam"
          style="width: 140px; height: 140px; background: #00e5ff; border-radius: 50%;
            border: 6px solid #000; display: inline-flex; align-items: center;
            justify-content: center; box-shadow: 8px 8px 0 #000; cursor: pointer; outline: none; padding: 0;"
          @click="emit('start')"
        >
          <AppLogo type="CAMERA" :size="80" />
        </button>
        
        <div
          style="background: #111; color: #fff; font-family: 'Bangers', cursive; font-size: 18px;
            letter-spacing: 3px; padding: 8px 24px; border: 3px solid #000; box-shadow: 4px 4px 0 #ff4cb0;"
        >
          KLIK UNTUK MULAI
        </div>
      </div>
    </div>
  </div>
</template>
