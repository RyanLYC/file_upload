import axios from 'axios'

// create an axios instance
const request = axios.create({
  baseURL: 'http://localhost:3000'
})

// respone interceptor
request.interceptors.response.use(
  (response) => {
    let { data } = response
    return data
  },
  (error) => {
    console.log('请求出错：', error)
  }
)

export default request
