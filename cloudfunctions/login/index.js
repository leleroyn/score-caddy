// 云函数: login
// 获取用户 openId，返回给前端保存

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  try {
    const { OPENID, APPID } = cloud.getWXContext()
    return {
      code: 0,
      openid: OPENID
    }
  } catch (err) {
    console.error('[云函数] [login] 错误:', err)
    return { code: -1, message: '获取用户信息失败' }
  }
}
