<template>
  <div class="app">
    <div ref="dragRef" id="drag">
      <input type="file" name="file" @change="handleFileChange" />
    </div>
    <div>上传进度</div>
    <el-progress
      :text-inside="true"
      :stroke-width="20"
      :percentage="uploadProgress"
    ></el-progress>

    <div>文件准备中</div>
    <div>
      <el-progress
        :text-inside="true"
        :stroke-width="20"
        :percentage="appData.hashProgress.value"
      ></el-progress>
    </div>
    {{ appData.hashProgress.value }}
    <div>
      <el-button type="primary" @click="appData.handleUpload()">
        上 传
      </el-button>
    </div>
    <div>
      <el-button type="primary" @click="appData.handleUploadStrategy()">
        慢启动上传
      </el-button>
      <p>
        由于文件大小不一，我们每个切片的大小设置成固定的也有点略显笨拙，我们可以参考TCP协议的慢启动策略，
        . 设置一个初始大小，根据上传任务完成的时候，来动态调整下一个切片的大小，
        确保文件切片的大小和当前网速匹配
      </p>
      <p>
        初始大小定为1M，如果上传花了10秒，那下一个区块大小变成3M
        如果上传花了60秒，那下一个区块大小变成500KB 以此类推
      </p>
    </div>
    <!-- 方块进度条 -->
    <div class="cube-container" :style="{ width: cubeWidth + 'px' }">
      <div class="cube" v-for="chunk in appData.state.chunks" :key="chunk.name">
        <div
          :class="{
            uploading: chunk.progress > 0 && chunk.progress < 100,
            success: chunk.progress == 100,
            error: chunk.progress < 0
          }"
          :style="{ height: chunk.progress + '%' }"
        >
          <i
            v-if="chunk.progress < 100 && chunk.progress > 1"
            class="el-icon-loading"
            style="color: #f56c6c"
          ></i>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppData from './AppData'
import { bindDragEvent } from './utils/_utils'

const appData = new AppData()

const handleFileChange = async (e: any) => {
  const [file] = e.target.files
  if (!file) return
  appData.selectedFile(file)
}

const uploadProgress = computed(() => {
  if (!appData.state.file || !appData.state.chunks.length) return 0
  const loaded = appData.state.chunks
    .map((item) => item.chunk.size * item.progress)
    .reduce((acc, cur) => acc + cur)
  return parseInt((loaded / appData.state.file.size).toFixed(2))
})

const cubeWidth = computed(() => {
  return Math.ceil(Math.sqrt(appData.state.chunks.length)) * 24
})

const dragRef = ref<HTMLDivElement>()
onMounted(() => {
  bindDragEvent(dragRef, appData.selectedFile)
})
</script>
<style scoped>
.app > div {
  margin: 50px;
}
#drag {
  height: 150px;
  border: 2px dashed #eee;
  line-height: 100px;
  text-align: center;
  vertical-align: middle;
}

.cube-container {
  width: 200px;
  overflow: hidden;
  display: flex;
  flex-wrap: wrap;
}
.cube {
  width: 22px;
  height: 22px;
  line-height: 20px;
  border: 1px solid #333;
  background: #eee;
}
.cube > .success {
  background: #67c23a;
}
.cube > .uploading {
  background: #0066ff;
}
.cube > .error {
  background: #e63737;
}
</style>
