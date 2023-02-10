import type { AxiosProgressEvent, AxiosPromise } from 'axios'
import request from '@/utils/request'

interface CMFileReq {
  /** 文件扩展名 */
  ext: string
  /** hash 值 */
  hash: string
  /**文件大小 */
  size?: number
}

interface CheckFileResp {
  /** 文件是否已经存在 */
  uploaded: boolean
  /** 已存在的分块文件名称 列表 */
  uploadedList: string[]
}

interface UploadFileResp {
  /** 文件地址 */
  url: string
}

/** 检测文件是否存在 */
export function checkFile(data: CMFileReq): AxiosPromise<CheckFileResp> {
  return request({
    url: '/checkFile',
    method: 'post',
    data
  })
}

/** 合并分块文件 */
export function merge(data: CMFileReq): AxiosPromise<UploadFileResp> {
  return request({
    url: '/merge',
    method: 'post',
    data
  })
}

/** 上传块文件 */
export function uploadFileBlock(
  data: any,
  onUploadProgress: (progressEvent: AxiosProgressEvent) => void
): AxiosPromise<UploadFileResp> {
  return request({
    url: '/uploadFileBlock',
    method: 'post',
    data,
    onUploadProgress
  })
}
