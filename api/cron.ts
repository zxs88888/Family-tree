// Vercel Cron 心跳任务：每天请求一次 Supabase，防止免费项目 7 天无活动自动暂停
// 由 vercel.json 的 crons 配置定时触发（每天凌晨 3 点 UTC）
export default async function handler(): Promise<Response> {
  const url = process.env.TARO_APP_SUPABASE_URL
  const key = process.env.TARO_APP_SUPABASE_ANON_KEY

  if (!url || !key) {
    return new Response(JSON.stringify({ ok: false, reason: 'env missing' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    // 最小查询即可产生数据库活动，防止项目被暂停
    const res = await fetch(`${url}/rest/v1/members?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    return new Response(JSON.stringify({ ok: res.ok, status: res.status }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, reason: String(err?.message || err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}

export const config = {
  maxDuration: 10,
}
