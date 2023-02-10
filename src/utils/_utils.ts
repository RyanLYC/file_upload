import sparkMd5 from 'spark-md5'
import type { Ref } from 'vue'

/**
 *@description 抽样哈希，牺牲一定的准确率 换来效率，hash一样的不一定是同一个文件
 * @param file 文件对象
 * @param hashProgress 进度值
 * @returns
 */
export const calculateHashSample = (file: File, hashProgress: Ref<number>) => {
  return new Promise<string>((resolve) => {
    const spark = new sparkMd5.ArrayBuffer()
    const reader = new FileReader()
    // 文件大小
    const size = file.size
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
      cur += offset
    }
    // 拼接
    reader.readAsArrayBuffer(new Blob(chunks))

    // 最后100K
    reader.onload = (e: any) => {
      spark.append(e.target.result)
      hashProgress.value = 100
      resolve(spark.end())
    }
  })
}

export const ext = (filename: string): string => {
  // 返回文件后缀名
  const extName = filename.split('.').pop()
  return extName ? extName : ''
}

const blobToData = async (blob: File) => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = function () {
      resolve(reader.result)
    }
    reader.readAsBinaryString(blob)
  })
}
/**
 * @description 直接计算md5 大文件会卡顿
 * @param file 文件对象
 * @returns
 */
export const calculateHash = async (file: File) => {
  const ret = await blobToData(file)
  return sparkMd5.hash(ret)
}

/**
 * @description web-worker 计算hash
 * @param chunks 文件块数组
 * @param hashProgress 进度值
 * @returns
 */
export const calculateHashWorker = async (
  chunks: { index: number; file: Blob }[],
  hashProgress: Ref<number>
) => {
  return new Promise<string>((resolve) => {
    // web-worker 防止卡顿主线程
    const worker = new Worker('/hash.js')
    worker.postMessage({ chunks })
    worker.onmessage = (e) => {
      const { progress, hash } = e.data
      hashProgress.value = Number(progress.toFixed(2))
      if (hash) {
        resolve(hash)
      }
    }
  })
}

/**
 * @description requestIdleCallback 计算hash
 * @param chunks 文件块数组
 * @param hashProgress 进度值
 * @returns
 */
export const calculateHashIdle = async (
  chunks: { index: number; file: Blob }[],
  hashProgress: Ref<number>
) => {
  return new Promise<string>((resolve) => {
    const spark = new sparkMd5.ArrayBuffer()
    let count = 0
    const appendToSpark = async (file: Blob) => {
      return new Promise<void>((resolve) => {
        const reader = new FileReader()
        reader.readAsArrayBuffer(file)
        reader.onload = (e: any) => {
          spark.append(e.target.result)
          resolve()
        }
      })
    }
    const workLoop = async (deadline: any) => {
      // 有任务，并且当前帧还没结束
      while (count < chunks.length && deadline.timeRemaining() > 1) {
        console.log(`浏览器没任务拉，开始计算${count}个`)
        await appendToSpark(chunks[count].file)
        count++
        // 没有了 计算完毕
        if (count < chunks.length) {
          // 计算中
          hashProgress.value = Number(
            ((100 * count) / chunks.length).toFixed(2)
          )
          // console.log(this.hashProgress)
        } else {
          // 计算完毕
          hashProgress.value = 100
          resolve(spark.end())
          return
        }
      }
      window.requestIdleCallback(workLoop)
    }
    window.requestIdleCallback(workLoop)
  })
}
