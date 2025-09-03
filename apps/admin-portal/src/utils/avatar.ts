/**
 * Helper funkcija za formiranje pune putanje avatara
 * Podržava i lokalni development i produkciju sa DigitalOcean Spaces
 */
export const getAvatarUrl = (avatarPath: string | null | undefined): string | undefined => {
  console.log('getAvatarUrl called with:', avatarPath);
  
  if (!avatarPath) {
    console.log('No avatar path provided');
    return undefined;
  }

  // Ako je već pun URL (počinje sa http:// ili https://), vrati ga direktno
  if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
    console.log('Already full URL:', avatarPath);
    return avatarPath;
  }

  // Za relativne putanje (/uploads/avatars/...), dodaj base URL
  const apiUrl = import.meta.env.VITE_API_URL;
  
  if (!apiUrl) {
    console.warn('VITE_API_URL nije definisan u environment varijablama');
    return avatarPath;
  }
  
  console.log('API URL:', apiUrl);

  // Proveri da li je produkcija (DigitalOcean Spaces URL)
  const isProduction = apiUrl.includes('smart-city.rs') || 
                       apiUrl.includes('vercel.app') ||
                       apiUrl.includes('digitalocean');

  if (isProduction) {
    // Na produkciji, avatar je već pun URL sa Spaces-a
    // ali backend možda vraća samo putanju, pa proveravamo
    if (avatarPath.startsWith('/')) {
      // Ako je relativna putanja na produkciji, možda je greška
      console.warn('Relativna putanja avatara na produkciji:', avatarPath);
      const fullUrl = `${apiUrl}${avatarPath}`;
      console.log('Production relative path, returning:', fullUrl);
      return fullUrl;
    }
    console.log('Production full URL:', avatarPath);
    return avatarPath;
  } else {
    // Development - koristi lokalni server
    // Ukloni dupli slash ako postoji
    const cleanPath = avatarPath.startsWith('/') ? avatarPath : `/${avatarPath}`;
    const fullUrl = `${apiUrl}${cleanPath}`;
    console.log('Development URL:', fullUrl);
    return fullUrl;
  }
};

/**
 * Proveri da li je aplikacija u produkcijskom modu
 */
export const isProduction = (): boolean => {
  const apiUrl = import.meta.env.VITE_API_URL;
  return apiUrl && (
    apiUrl.includes('smart-city.rs') || 
    apiUrl.includes('vercel.app') ||
    apiUrl.includes('digitalocean')
  );
};