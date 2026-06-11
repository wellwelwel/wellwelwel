export const AVATAR_SIZE = Number(Bun.env.SIZE) || 64;

export const generateBase64 = async (username: string) => {
  const url = `https://avatars.githubusercontent.com/${username}?size=${AVATAR_SIZE * 2}`;
  const res = await fetch(url);
  const bytes = await res.bytes();

  return bytes.toBase64();
};
