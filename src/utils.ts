const IMG_WIDTH_LIMIT = 1000
const IMG_HEIGHT_LIMIT = 1000

async function blobToString(blob: any) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = function () {
      const result = reader.result as string

      const ret = result
        .split('')
        .map((v) => v.charCodeAt(0))
        .map((v) => v.toString(16).toUpperCase())
        .map((v) => v.padStart(2, '0'))
        .join(' ')
      resolve(ret)
    }
    reader.readAsBinaryString(blob)
  })
  // 二进制=》ascii码=》转成16进制字符串
}

async function getRectByOffset(
  file: any,
  widthOffset: any,
  heightOffset: any,
  reverse: any
) {
  let width = await blobToString(file.slice(...widthOffset))
  let height = await blobToString(file.slice(...heightOffset))

  if (reverse) {
    // 比如gif 的宽，6和7 是反着排的 大小端存储
    // 比如6位仕89，7位仕02， gif就是 0289 而不是8920的值 切分后翻转一下
    width = [width.slice(3, 5), width.slice(0, 2)].join(' ')
    height = [height.slice(3, 5), height.slice(0, 2)].join(' ')
  }
  const w = parseInt(width.replace(' ', ''), 16)
  const h = parseInt(height.replace(' ', ''), 16)
  return { w, h }
}

async function isGif(file: any) {
  const ret = await blobToString(file.slice(0, 6))
  const isgif = ret === '47 49 46 38 39 61' || ret === '47 49 46 38 37 61'
  if (isgif) {
    console.log('文件是gif')

    const { w, h } = await getRectByOffset(file, [6, 8], [8, 10], true)
    console.log('gif宽高', w, h)
    if (w > IMG_WIDTH_LIMIT || h > IMG_HEIGHT_LIMIT) {
      console.log(
        'gif图片宽高不得超过！' + IMG_WIDTH_LIMIT + '和' + IMG_HEIGHT_LIMIT
      )
      return false
    }
  }
  return isgif
  // 文件头16进制 47 49 46 38 39 61 或者47 49 46 38 37 61
  // 分别仕89年和87年的规范
  // const tmp = '47 49 46 38 39 61'.split(' ')
  //               .map(v=>parseInt(v,16))
  //               .map(v=>String.fromCharCode(v))
  // console.log('gif头信息',tmp)
  // // 或者把字符串转为16进制 两个方法用那个都行
  // const tmp1 = 'GIF89a'.split('')
  //                 .map(v=>v.charCodeAt())
  //                 .map(v=>v.toString(16))
  // console.log('gif头信息',tmp1)

  // return ret ==='GIF89a' || ret==='GIF87a'
  // 文件头标识 (6 bytes) 47 49 46 38 39(37) 61
}
async function isPng(file: any) {
  const ret = await blobToString(file.slice(0, 8))
  const ispng = ret === '89 50 4E 47 0D 0A 1A 0A'
  if (ispng) {
    const { w, h } = await getRectByOffset(file, [18, 20], [22, 24], false)
    console.log('png宽高', w, h)
    if (w > IMG_WIDTH_LIMIT || h > IMG_HEIGHT_LIMIT) {
      console.log(
        'png图片宽高不得超过！' + IMG_WIDTH_LIMIT + '和' + IMG_HEIGHT_LIMIT
      )
      return false
    }
  }
  return ispng
}
async function isJpg(file: any) {
  // jpg开头两个仕 FF D8
  // 结尾两个仕 FF D9
  const len = file.size
  const start = await blobToString(file.slice(0, 2))
  const tail = await blobToString(file.slice(-2, len))
  const isjpg = start === 'FF D8' && tail === 'FF D9'
  if (isjpg) {
    const heightStart = parseInt('A3', 16)
    const widthStart = parseInt('A5', 16)
    const { w, h } = await getRectByOffset(
      file,
      [widthStart, widthStart + 2],
      [heightStart, heightStart + 2],
      false
    )
    console.log('jpg大小', w, h)
  }
  return isjpg
}
export function isImage(file: any) {
  return isGif(file).then((isgif) => {
    isPng(file).then((ispng) => {
      isJpg(file).then((isjpg) => {
        return isgif && ispng && isjpg
      })
    })
  })
}
