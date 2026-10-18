// 统一的访问来源校验：默认只允许本机，可通过 APP_ALLOWED_HOSTS 放开局域网。
// APP_ALLOWED_HOSTS 用逗号分隔，可填 IP 或主机名（如 10.156.221.207,192.168.1.5）。
// 值可以是具体 host，或 '*' 表示全部放行（谨慎使用）。
const LOCAL_ONLY = /^(127\.0\.0\.1|localhost|\[::1\]):\d+$/;

function allowedList() {
  const raw = process.env.APP_ALLOWED_HOSTS || '';
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function isAllowedHost(host) {
  if (LOCAL_ONLY.test(host)) return true;
  const list = allowedList();
  if (list.includes('*')) return true;
  // host 形如 "10.156.221.207:8787" 或 "[::1]:8787"，取去掉端口的部分
  const name = String(host).replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase();
  return list.includes(name);
}

// 同源校验：本机 http、局域网 http、以及经内网穿透（cloudflared/ngrok，https 终结在隧道方）的 https 都要放行。
// 反向代理会带 X-Forwarded-Proto，说明浏览器实际使用的协议。
export function isAllowedOrigin(req, host) {
  const origin = req.headers?.origin;
  if (!origin) return true; // 非浏览器请求 / 同源简单请求可能不带 Origin，由 SameSite=Strict Cookie 兜底
  const candidates = new Set([`http://${host}`, `https://${host}`]);
  const proto = String(req.headers?.['x-forwarded-proto'] ?? '').split(',')[0].trim().toLowerCase();
  if (proto === 'http' || proto === 'https') candidates.add(`${proto}://${host}`);
  return candidates.has(origin);
}

// 客户端地址：公网访问时所有请求都来自隧道进程（127.0.0.1 / ::1），
// 直接用 remoteAddress 会让验证码绑定失效、并让全部用户共享同一份限流配额。
// 优先取隧道注入的真实客户端 IP；回环地址统一归一化，避免 IPv4/IPv6 混用导致校验不通过。
const LOOPBACK = /^(::1|::ffff:127\.0\.0\.1|127\.0\.0\.1)$/;

export function clientAddress(req) {
  const cf = req.headers?.['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim()) return 'cf:' + cf.trim();
  const xff = String(req.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim();
  if (xff) return 'xff:' + xff;
  const addr = req.socket?.remoteAddress ?? 'local';
  return LOOPBACK.test(addr) ? 'loopback' : addr;
}
