<template>
  <div class="app">
    <div ref="drag" id="drag">
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
        :percentage="state.hashProgress"
      ></el-progress>
    </div>
    {{ state.hashProgress }}
    <div>
      <el-button type="primary" @click="handleUpload">上 传</el-button>
    </div>
    <!-- 方块进度条 -->
    <div class="cube-container" :style="{ width: cubeWidth + 'px' }">
      <div class="cube" v-for="chunk in state.chunks" :key="chunk.name">
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
import { computed, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import sparkMd5 from 'spark-md5'
import request from './request'

const CHUNK_SIZE = 1 * 1024 * 1024 // 1M
const state = reactive({
  file: null as any,
  chunks: [] as {
    index: number
    name: string
    hash: string
    progress: number
    chunk: any
  }[],
  hashProgress: 0,
  hash: ''
})

const handleFileChange = (e: any) => {
  const [file] = e.target.files
  if (!file) return
  state.file = file
}

const uploadProgress = computed(() => {
  if (!state.file || !state.chunks.length) return 0
  const loaded = state.chunks
    .map((item) => item.chunk.size * item.progress)
    .reduce((acc, cur) => acc + cur)
  return parseInt((loaded / state.file.size).toFixed(2))
})

const cubeWidth = computed(() => {
  return Math.ceil(Math.sqrt(state.chunks.length)) * 16
})

const createFileChunk = (file: any, size = CHUNK_SIZE) => {
  // 生成文件块 Blob.slice语法
  const chunks = []
  let cur = 0
  while (cur < file.size) {
    chunks.push({ index: cur, file: file.slice(cur, cur + size) })
    cur += size
  }
  return chunks
}

const calculateHashSample = () => {
  return new Promise<string>((resolve) => {
    const spark = new sparkMd5.ArrayBuffer()
    const reader = new FileReader()
    const file = state.file
    // 文件大小
    const size = state.file.size
    let offset = 2 * 1024 * 1024

    let chunks = [file.slice(0, offset)]

    // 前面100K
    let cur = offset
    while (cur < size) {
      // 最后一块全部加进来
      if (cur + offset >= size) {
        chunks.push(file.slice(cur, cur + offset))
      } else {
        // 中间的 前中后去两个字节
        const mid = cur + offset / 2
        const end = cur + offset
        chunks.push(file.slice(cur, cur + 2))
        chunks.push(file.slice(mid, mid + 2))
        chunks.push(file.slice(end - 2, end))
      }
      // 前取两个子杰
      cur += offset
    }
    // 拼接
    reader.readAsArrayBuffer(new Blob(chunks))

    // 最后100K
    reader.onload = (e: any) => {
      spark.append(e.target.result)
      state.hashProgress = 100
      resolve(spark.end())
    }
  })
}

const ext = (filename: string) => {
  // 返回文件后缀名
  return filename.split('.').pop()
}
const sendRequest = (chunks: any[], limit = 4) => {
  return new Promise<void>((resolve, reject) => {
    const len = chunks.length
    let counter = 0
    // 全局开关
    let isStop = false

    const start = async () => {
      if (isStop) {
        return
      }
      const task = chunks.shift()
      if (task) {
        const { form, index } = task
        try {
          await request.post('/uploadFileBlock', form, {
            onUploadProgress: (progress: any) => {
              state.chunks[index].progress = Number(
                ((progress.loaded / progress.total) * 100).toFixed(2)
              )
            }
          })
          if (counter == len - 1) {
            // 最后一个
            resolve()
          } else {
            counter++
            start()
          }
        } catch (e) {
          // 当前切片报错了
          // 尝试3次重试机制，重新push到数组中
          console.log('出错了')
          // 进度条改成红色
          state.chunks[index].progress = -1
          if (task.error < 3) {
            task.error++
            // 队首进去 准备重试
            chunks.unshift(task)
            start()
          } else {
            // 错误3次了 直接结束
            isStop = true
            reject()
          }
        }
      }
    }

    while (limit > 0) {
      setTimeout(() => {
        // 模拟延迟
        start()
      }, Math.random() * 2000)

      limit -= 1
    }
  })
}

const mergeRequest = async () => {
  await request.post('/merge', {
    ext: ext(state.file.name),
    size: CHUNK_SIZE,
    hash: state.hash
  })
}

const uploadChunks = async (uploadedList: any[] = []) => {
  const list = state.chunks
    .filter((chunk) => uploadedList.indexOf(chunk.name) == -1)
    .map(({ chunk, name, hash, index }, i) => {
      const form = new FormData()
      form.append('chunkname', name)
      form.append('ext', ext(state.file.name)!)
      form.append('hash', hash)
      // form.append("file", new File([chunk],name,{hash,type:'png'}))
      form.append('file', chunk)

      return { form, index, error: 0 }
    })
  try {
    await sendRequest([...list], 4)
    if (uploadedList.length + list.length === state.chunks.length) {
      await mergeRequest()
    }
  } catch (e: any) {
    ElMessage.error('上传失败：', e)
  }
}

const handleUpload = async () => {
  if (!state.file) {
    ElMessage.info('请选择文件')
    return
  }
  let chunks = createFileChunk(state.file)

  // 计算hash 文件指纹标识
  // this.hash = await this.calculateHash(this.file)
  // web-worker
  // this.hash = await this.calculateHashWorker(chunks)
  // requestIdleCallback
  // this.hash = await this.calculateHashIdle(chunks)

  // 抽样哈希，牺牲一定的准确率 换来效率，hash一样的不一定是同一个文件， 但是不一样的一定不是
  // 所以可以考虑用来预判
  state.hash = await calculateHashSample()
  // 检查文件是否已经上传
  const { data } = await request.post('/checkFile', {
    ext: ext(state.file.name),
    hash: state.hash
  })
  if (data.uploaded) {
    return ElMessage.success('秒传成功!')
  }
  // 切片
  state.chunks = chunks.map((chunk, index) => {
    // 每一个切片的名字
    const chunkName = state.hash + '-' + index
    return {
      hash: state.hash,
      chunk: chunk.file,
      name: chunkName,
      index,
      // 设置进度条
      progress: data.uploadedList.indexOf(chunkName) > -1 ? 100 : 0
    }
  })
  await uploadChunks(data.uploadedList)
}
</script>
<style scoped>
.app > div {
  margin: 50px;
}
#drag {
  height: 100px;
  border: 2px dashed #eee;
  line-height: 100px;
  text-align: center;
  vertical-align: middle;
}

.cube-container {
  width: 100px;
  overflow: hidden;
}
.cube {
  width: 14px;
  height: 14px;
  line-height: 12px;
  border: 1px solid black;
  background: #eee;
  float: left;
}
.cube > .success {
  background: #67c23a;
}
.cube > .uploading {
  background: #409eff;
}
.cube > .error {
  background: #f56c6c;
}
</style>
