import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { getMsalInstance } from '../authConfig';

const Logout = () => {
  const [searchParams] = useSearchParams();
  const { instance } = useMsal();
  const isExpired = searchParams.get('expired') === 'true';

  useEffect(() => {
    const handleLogout = async () => {
      try {
        // Clear all MSAL cache
        await getMsalInstance().clearCache();
        
        // Clear localStorage and sessionStorage of any auth-related items
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key.includes('msal') || key.includes('oauth') || key.includes('auth')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));

        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key.includes('msal') || key.includes('oauth') || key.includes('auth')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => sessionStorage.removeItem(key));

        // Sign out from Azure AD
        await instance.logoutRedirect();
      } catch (error) {
        console.error('Logout error:', error);
        // Even if logout fails, clear cache locally
        await getMsalInstance().clearCache();
      }
    };

    handleLogout();
  }, [instance]);

  return (
    <div>
      {isExpired ? 'Session expired, logged out' : 'Logged out'}
    </div>
  );
};

export default Logout;
