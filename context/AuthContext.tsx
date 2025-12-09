import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserAccount } from '../types';
import { auth, db } from '../firebase';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

interface AuthContextType {
  user: UserAccount | null;
  login: (username: string, password?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Fetch user details from Firestore
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            setUser({ id: userDoc.id, ...userDoc.data() } as UserAccount);
          } else {
            // Fallback: Try finding user by email (since Seed data uses custom IDs like 'u1', not Auth UIDs)
            if (firebaseUser.email) {
              const q = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
              const querySnapshot = await getDocs(q);

              if (!querySnapshot.empty) {
                const userData = querySnapshot.docs[0].data();
                setUser({ id: querySnapshot.docs[0].id, ...userData } as UserAccount);
              } else {
                console.warn('User found in Auth but not in Firestore (ID or Email mismatch)');
                setUser(null);
              }
            } else {
              setUser(null);
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (usernameOrEmail: string, password?: string): Promise<boolean> => {
    try {
      if (!password) {
        throw new Error("Password is required for Firebase Auth");
      }

      let email = usernameOrEmail;

      // Check if input is NOT an email (simple check)
      if (!usernameOrEmail.includes('@')) {
        // Lookup email by username using Cloud Function (Secure)
        try {
          const { httpsCallable } = await import('firebase/functions');
          // Import functions instance from firebase.ts to ensure correct initialization
          const { functions } = await import('../firebase');

          const getEmailByUsername = httpsCallable(functions, 'getEmailByUsername');

          const result = await getEmailByUsername({ username: usernameOrEmail });
          const data = result.data as { email: string };
          email = data.email;
        } catch (error) {
          console.error("Username lookup failed:", error);
          // Fallback: Try direct query (only works if rules allow public read - which they don't)
          const q = query(collection(db, 'users'), where('username', '==', usernameOrEmail));
          const querySnapshot = await getDocs(q);

          if (querySnapshot.empty) {
            console.error("Username not found");
            return false;
          }
          const userDoc = querySnapshot.docs[0].data();
          if (userDoc.email) {
            email = userDoc.email;
          }
        }
      }

      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};