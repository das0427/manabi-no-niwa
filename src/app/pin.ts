/**
 * 保護者の暗証番号（任意）。塩付きの SHA-256 で保存する。
 * 4〜6桁の数字は総当たりで簡単に戻せるため、強固な保護ではない（誤操作防止の目的）。
 * 保存形式: "<塩16進>:<ハッシュ16進>"
 */
async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPin(pin: string): Promise<string> {
  const salt = [...crypto.getRandomValues(new Uint8Array(8))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${salt}:${await sha256Hex(`${salt}:${pin}`)}`;
}

export async function checkPin(pin: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  return (await sha256Hex(`${salt}:${pin}`)) === hash;
}
