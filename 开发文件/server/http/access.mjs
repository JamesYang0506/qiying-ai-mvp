// 统一的访问来源校验：本机 / 局域网私有网段 / 内网穿透隧道 默认放行，
// 其余公网地址需通过 APP_ALLOWED_HOSTS 显式授权。
// APP_ALLOWED_HOSTS 用逗号分隔，可填 IP 或主机名（如 10.156.221.207,example.com）；
// 值为 '*' 表示全部放行（谨慎使用）。
const LOOPBACK_ANY = /^(127\.\d+\.\d+\.\d+|localhost|\[::1\])(:\d+)?$/;
// RFC1918 私有网段 + 链路本地：同事在同一内网直连时 host 就是这些地址，
// 不可能预先写进白名单（DHCP 会变），所以按网段放行。
const PRIVATE_IP = /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+)$/;
// 内网穿透隧道：每次重启域名都随机，同样无法预先列举。
const TUNNEL_HOST = /\.(trycloudflare\.com|ngrok-free\.app|ngrok-free\.dev|ngrok\.io|ngrok\.app|cfargotunnel\.com|loca\.lt)$/i;

function allowedList() {
  const raw = process.env.APP_ALLOWED_HOSTS || '';
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/** host 形如 "10.156.221.207:8787" 或 "[::1]:8787"，这里统一取去掉端口的主机部分 */
function hostName(host) {
  return String(host || '').toLowerCase().replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
}

export function isAllowedHost(host) {
  const h = String(host || '').toLowerCase();
  if (LOOPBACK_ANY.test(h)) return true;
  const list = allowedList();
  if (list.includes('*')) return true;
  const name = hostName(h);
  if (list.includes(name)) return true;
  if (PRIVATE_IP.test(name)) return true;      // 局域网直连
  if (TUNNEL_HOST.test(name)) return true;     // cloudflared / ngrok
  return false;
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
  const addr = req.socket?.remoteAddress ?? 'local';
  const loopback = LOOPBACK.test(addr);
  // 🔴 只有请求确实来自本机（即隧道进程转发进来）时才信任转发头。
  //    否则任何人自己加一个 X-Forwarded-For 就能伪造身份 —— 绕过限流，
  //    还能把验证码绑定到别人的地址上。局域网直连时一律用真实 socket 地址。
  if (loopback) {
    const cf = req.headers?.['cf-connecting-ip'];
    if (typeof cf === 'string' && cf.trim()) return 'cf:' + cf.trim();
    const xff = String(req.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim();
    if (xff) return 'xff:' + xff;
  }
  return loopback ? 'loopback' : addr;
}
