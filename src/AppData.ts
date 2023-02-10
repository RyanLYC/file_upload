import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { checkFile, merge, uploadFileBlock } from '@/api'
import { CHUNK_SIZE } from './utils/constant'
import {
  calculateHash,
  calculateHashIdle,
  calculateHashSample,
  calculateHashWorker,
  ext
} from './utils/_utils'

interface StateI {
  /** 选择上传的文件对象 */
  file: File | null
  /** 分块的文件数组 */
  chunks: ChunkI[]
  /**hash 值 */
  hash: string
}

interface ChunkI {
  /** 第几块文件 */
  index: number
  /** 名称 hash-index */
  name: string
  /** 文件的hash值 */
  hash: string
  /** 上传进度 */
  progress: number
  /** 分块文件对象 */
  chunk: Blob
}

interface UploadPostDataI {
  form: FormData
  index: number
  error: number
}

export default class AppData {
  state = reactive<StateI>({
    file: null,
    chunks: [],
    hash: ''
  })
  /** 计算hash的进度 */
  hashProgress = ref(0)

  /**选择文件后赋值 */
  selectedFile = (file: File) => {
    this.state.file = file
  }

  /**按固定大小切块文件 */
  createFileChunk = (file: File, size = CHUNK_SIZE) => {
    // 生成文件块 Blob.slice语法
    const chunks = []
    let cur = 0
    while (cur < file.size) {
      chunks.push({ index: cur, file: file.slice(cur, cur + size) })
      cur += size
    }
    return chunks
  }

  /** 上传文件 */
  handleUpload = async () => {
    if (!this.state.file) {
      ElMessage.info('请选择文件')
      return
    }
    let chunks = this.createFileChunk(this.state.file)

    // 直接计算hash
    // this.state.hash = await calculateHash(this.state.file)
    // web worker 增量计算
    // this.state.hash = await calculateHashWorker(chunks, this.hashProgress)
    // requestIdleCallback
    this.state.hash = await calculateHashIdle(chunks, this.hashProgress)
    // 抽样计算
    // this.state.hash = await calculateHashSample(
    //   this.state.file,
    //   this.hashProgress
    // )
    // 检查文件是否已经上传
    const { data } = await checkFile({
      ext: ext(this.state.file.name),
      hash: this.state.hash
    })
    console.log('checkFile:', data)

    if (data.uploaded) {
      return ElMessage.success('秒传成功!')
    }
    // 切片
    this.state.chunks = chunks.map((chunk, index) => {
      // 每一个切片的名字
      const chunkName = this.state.hash + '-' + index
      return {
        hash: this.state.hash,
        chunk: chunk.file,
        name: chunkName,
        index,
        // 设置进度条
        progress: data.uploadedList.indexOf(chunkName) > -1 ? 100 : 0
      }
    })
    await this.uploadChunks(data.uploadedList)
  }

  uploadChunks = async (uploadedList: string[] = []) => {
    const extName = ext(this.state.file!.name)
    const list = this.state.chunks
      .filter((chunk) => uploadedList.indexOf(chunk.name) == -1)
      .map(({ chunk, name, hash, index }) => {
        const form = new FormData()
        form.append('chunkname', name)
        form.append('ext', extName)
        form.append('hash', hash)
        // form.append("file", new File([chunk],name,{hash,type:'png'}))
        form.append('file', chunk)

        return { form, index, error: 0 }
      })
    try {
      await this.sendRequest([...list], 4)
      if (uploadedList.length + list.length === this.state.chunks.length) {
        await this.mergeRequest()
      }
    } catch (e: any) {
      ElMessage.error('上传失败：', e)
    }
  }

  sendRequest = (chunks: UploadPostDataI[], limit = 4) => {
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
            await uploadFileBlock(form, (progress: any) => {
              this.state.chunks[index].progress = Number(
                ((progress.loaded / progress.total) * 100).toFixed(2)
              )
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
            this.state.chunks[index].progress = -1
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

  mergeRequest = async () => {
    await merge({
      ext: ext(this.state.file!.name)!,
      size: CHUNK_SIZE,
      hash: this.state.hash
    })
  }
}
