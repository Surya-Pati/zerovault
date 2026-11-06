import { cookies } from 'next/headers';

export function getSession() {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get('session');
  
  if (!sessionToken) {
    return null;
  }
  
  try {
    const payload = JSON.parse(Buffer.from(sessionToken.value.split('.')[1], 'base64').toString());
    return payload as { userId: string; role: 'RESEARCHER' | 'BUYER' | 'ADMIN' };
  } catch {
    return null;
  }
}
