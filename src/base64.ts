const AVATAR_SIZE = 80;

export const generateBase64 = async (username: string) => {
  const url = `https://avatars.githubusercontent.com/${username}?size=${AVATAR_SIZE}`;
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return buffer.toString('base64');
};
