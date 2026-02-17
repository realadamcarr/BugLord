const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // excludes O, 0, I, 1

export function generateFriendCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return code;
}

export function isValidFriendCode(code: string, length = 6): boolean {
  if (typeof code !== 'string' || code.length !== length) return false;
  const pattern = new RegExp(`^[${CHARSET}]{${length}}$`);
  return pattern.test(code);
}
