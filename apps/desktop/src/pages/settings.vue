<script setup lang="ts">
import ForgeSetup from '@/components/ForgeSetup.vue'
import ProfilesSection from '@/components/ProfilesSection.vue'
</script>

<template>
  <div class="flex h-full flex-col gap-4 overflow-auto p-6">
    <h1 class="text-lg font-semibold">설정</h1>
    <ProfilesSection />
    <ForgeSetup />
  </div>
</template>
