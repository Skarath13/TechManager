import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';

export type Location = 'tustin' | 'santa_ana' | 'irvine' | 'costa_mesa' | 'transactions' | 'tech_summary';

// Interface for your custom user profile data stored in the 'users' table
interface UserProfile {
  id: string; // This is the UUID primary key from your 'users' table
  name: string;
  role: 'admin' | 'manager';
  allowed_locations: string[] | null;
  // Add other fields from your 'users' table if needed in the context
}

interface AuthContextType {
  user: UserProfile | null; // Use the UserProfile interface
  session: Session | null; // Expose session if needed, useful for user ID
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pin: string) => Promise<void>; // Changed signature
  logout: () => Promise<void>;
  hasLocationAccess: (location: Location) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Removed Supabase URL/Key definitions as they should be handled by the supabaseClient

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile from your custom 'users' table
  const fetchUserProfile = async (authUserId: string): Promise<UserProfile | null> => {
    try {
      const { data, error, status } = await supabase
        .from('users')
        .select('id, name, role, allowed_locations')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (error && status !== 406) {
        console.error(`Error fetching user profile (status ${status}):`, error);
        return null;
      }
      if (!data) {
        return null;
      }
      return data as UserProfile;
    } catch (error) {
      console.error('Exception during fetchUserProfile:', error);
      return null;
    }
  };

  useEffect(() => {
    setIsLoading(true);
    let authListenerSubscription: any = null;

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);

      const { data: listenerData } = supabase.auth.onAuthStateChange(
        async (event: AuthChangeEvent, currentSession: Session | null) => {
          setSession(prevSession => {
            if (JSON.stringify(currentSession) !== JSON.stringify(prevSession)) {
              return currentSession;
            }
            return prevSession;
          });

          let profile: UserProfile | null = null;
          let finishedProcessing = false;

          try {
            if (currentSession?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
              profile = await fetchUserProfile(currentSession.user.id);
              setUser(profile);
              finishedProcessing = true;
            } else if (event === 'SIGNED_OUT') {
              setUser(null);
              finishedProcessing = true;
            } else if (!currentSession?.user) {
              setUser(null);
              finishedProcessing = true;
            } else {
              finishedProcessing = true;
            }
          } catch (error) {
            console.error(`Error during onAuthStateChange handling for event ${event}:`, error);
            setUser(null);
            finishedProcessing = true;
          } finally {
            if (finishedProcessing) {
              setIsLoading(false);
            }
          }
        }
      );
      
      authListenerSubscription = listenerData?.subscription;

      if (!initialSession) {
        setIsLoading(false);
      }

    }).catch(error => {
      console.error("Error getting initial session:", error);
      setIsLoading(false);
    });

    return () => {
      authListenerSubscription?.unsubscribe();
    };
  }, []);

  // Removed checkAuth function

  const login = async (email: string, pin: string) => { // Changed signature
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: pin, // Use the pin as password
      });

      if (error) {
        console.error('Supabase login error:', error);
        throw new Error(error.message || 'Login failed');
      }

      // onAuthStateChange will handle setting the user and session state
      // No need to manually set user/token here

    } catch (error) {
      console.error('Login error:', error);
      // Rethrow or handle error display to the user
      if (error instanceof Error) {
         throw error; // Rethrow the original error
      } else {
         throw new Error('An unknown login error occurred');
      }
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Supabase logout error:', error);
        throw new Error(error.message || 'Logout failed');
      }
      // onAuthStateChange handles clearing user state
    } catch (error) {
      console.error('Logout error:', error);
       if (error instanceof Error) {
         throw error; // Rethrow the original error
      } else {
         throw new Error('An unknown logout error occurred');
      }
    }
  };

  const hasLocationAccess = (location: Location): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    // Admins have access to all locations + special views
    if (location === 'transactions' || location === 'tech_summary') return true; // All logged-in users access these? Adjust if needed.
    if (!user.allowed_locations) return false;
    // Check if manager has specific location access
    return user.allowed_locations.includes(location);
  };

  const value = {
    user,
    session,
    isAuthenticated: !!user && !!session,
    isLoading,
    login,
    logout,
    hasLocationAccess
  };

  // Log when the provider value changes (useful for debugging re-renders)
  // console.log('[Auth] Provider value updated:', value);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 