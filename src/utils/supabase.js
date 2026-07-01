import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY 必须在 .env 中配置",
  );
}

// 从 localStorage 恢复 auth hash（index.html 保存的），确保 Supabase 客户端能检测到
const storedAuth = typeof window !== 'undefined'
  ? localStorage.getItem('__sb_auth_hash')
  : null;
if (storedAuth) {
  localStorage.removeItem('__sb_auth_hash');
  window.location.hash = storedAuth;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
