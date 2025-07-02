export const AVATAR_SIZE = Number(process.env.SIZE) || 64;

export const generateBase64 = async (username: string) => {
  const url = `https://avatars.githubusercontent.com/${username}?size=${AVATAR_SIZE * 2}`;
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return buffer.toString('base64');
};
