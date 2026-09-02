import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  User
} from 'firebase/auth';
// @ts-ignore
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, deleteDoc, query, where, updateDoc, increment, Timestamp, orderBy, serverTimestamp } from 'firebase/firestore';
import { FIREBASE_CONFIG } from '../config';
import { Movie, UserProfile, MovieSummary } from '../types';

// Initialize Firebase
const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
// Connect to the specific database 'saimilar' instead of '(default)'
export const db = getFirestore(app, "saimilar");

// === AUTHENTICATION ===

export const registerUser = async (username: string, email: string, password: string) => {
  try {
    console.log('📝 Registering user:', username);
    
    // 1. Check if username is taken
    const usernameTaken = await checkNickname(username);
    if (usernameTaken) {
      throw new Error("Username already taken");
    }

    // 2. Create Auth User
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 3. Create Firestore Profile
    await setDoc(doc(db, "users", user.uid), {
      nickname: username,
      email: email, // Storing email for Admin use
      provider: 'email',
      role: 'user', // Default role
      createdAt: Timestamp.now(),
      wishlistCount: 0,
      watchedCount: 0,
      ratingsCount: 0
    });

    console.log('✅ User registered successfully:', user.uid);
    return mapUser(user, username, 'user');
  } catch (error: any) {
    console.error('❌ Registration error:', error.message);
    if (error.code === 'auth/operation-not-allowed') {
       throw new Error("Email/Password login is not enabled in Firebase Console.");
    }
    throw error;
  }
};

export const loginUser = async (email: string, password: string) => {
  try {
    console.log('🔐 Logging in user:', email);
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const profile = await getUserProfile(user.uid);
    
    console.log('✅ User logged in successfully');
    return mapUser(user, profile?.nickname, profile?.role);
  } catch (error: any) {
    // Only log critical system errors, not user input errors
    if (error.code !== 'auth/invalid-credential' && 
        error.code !== 'auth/user-not-found' && 
        error.code !== 'auth/wrong-password' &&
        error.code !== 'auth/invalid-email') {
        console.error('❌ Login error:', error.message);
    }
    
    let msg = error.message;
    if (error.code === 'auth/invalid-credential') msg = 'Incorrect email or password.';
    if (error.code === 'auth/user-not-found') msg = 'User not found.';
    if (error.code === 'auth/wrong-password') msg = 'Wrong password.';
    if (error.code === 'auth/invalid-email') msg = 'Invalid email address.';
    throw new Error(msg);
  }
};

export const loginWithGoogle = async () => {
  try {
    console.log('🔐 Starting Google login...');
    
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Check if profile exists
    const profile = await getUserProfile(user.uid);
    
    if (!profile) {
      // New Google User
      const nickname = user.displayName || user.email?.split('@')[0] || `User_${user.uid.slice(0, 6)}`;
      
      await setDoc(doc(db, "users", user.uid), {
        nickname: nickname,
        email: user.email,
        provider: 'google',
        role: 'user',
        createdAt: Timestamp.now(),
        wishlistCount: 0,
        watchedCount: 0,
        ratingsCount: 0
      });

      console.log('✅ New Google user created:', nickname);
      return mapUser(user, nickname, 'user');
    }

    console.log('✅ Existing Google user logged in');
    return mapUser(user, profile.nickname, profile.role);
  } catch (error: any) {
    console.error('❌ Google login error:', error.message);
    if (error.code === 'auth/unauthorized-domain') {
        console.warn("⚠️ DOMAIN NOT AUTHORIZED. Add this domain to Firebase Console > Auth > Settings > Authorized Domains");
        throw new Error("This domain is not authorized for Google Login. Please check Firebase Console.");
    }
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
    console.log('✅ User logged out');
  } catch (error: any) {
    console.error('❌ Logout error:', error.message);
    throw error;
  }
};

export const resetUserPassword = async (email: string) => {
    try {
        await sendPasswordResetEmail(auth, email);
        console.log(`✅ Password reset email sent to ${email}`);
    } catch (error: any) {
        console.error('❌ Reset password error:', error.message);
        throw error;
    }
};

// === NICKNAME VALIDATION ===

export const checkNickname = async (nickname: string): Promise<boolean> => {
  try {
    const q = query(collection(db, "users"), where("nickname", "==", nickname));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty; // true = taken, false = available
  } catch (error: any) {
    // Suppress permission-denied error from console to avoid confusion
    if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
        return false;
    }
    console.error('❌ Error checking nickname:', error.message);
    return false; 
  }
};

// === USER PROFILE ===

export const getUserProfile = async (uid: string): Promise<any> => {
  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    }
    
    return null;
  } catch (error: any) {
    console.error('❌ Error getting user profile:', error.message);
    return null;
  }
};

// === ADMIN ===

export const getAllUsers = async (): Promise<UserProfile[]> => {
    try {
        const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => {
            const data = doc.data() as any;
            return {
                id: doc.id,
                username: data.nickname || 'Unknown',
                email: data.email,
                provider: data.provider || 'local',
                role: data.role || 'user',
                createdAt: data.createdAt?.toMillis() || 0,
                wishlistCount: data.wishlistCount || 0,
                watchedCount: data.watchedCount || 0,
                userRating: data.ratingsCount || 0 
            } as UserProfile;
        });
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            console.warn("⚠️ Access to 'users' collection denied.");
            throw new Error("PERMISSION_DENIED");
        }
        console.error("❌ Error fetching all users:", error);
        return [];
    }
};

// --- Wishlist ---

export const getWishlist = async (uid: string): Promise<Movie[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, "users", uid, "wishlist"));
    return querySnapshot.docs.map(doc => {
        const data = doc.data() as any;
        return { 
          id: data.movieId,
          ...data 
        } as Movie;
    });
  } catch (error: any) {
    console.error('❌ Error fetching wishlist:', error.message);
    return [];
  }
};

export const addToWishlist = async (uid: string, movie: Movie) => {
  try {
    await setDoc(doc(db, "users", uid, "wishlist", movie.id.toString()), {
      movieId: movie.id,
      title: movie.title,
      poster_path: movie.poster_path,
      vote_average: movie.vote_average,
      media_type: movie.media_type || 'movie',
      addedAt: Timestamp.now()
    });
    // Increment counter
    await updateDoc(doc(db, "users", uid), { wishlistCount: increment(1) });
    // Log removed as requested
  } catch (error: any) {
    console.error('❌ Error adding to wishlist:', error.message);
    throw error;
  }
};

export const removeFromWishlist = async (uid: string, movieId: number) => {
  try {
    await deleteDoc(doc(db, "users", uid, "wishlist", movieId.toString()));
    // Decrement counter
    await updateDoc(doc(db, "users", uid), { wishlistCount: increment(-1) });
    // Log removed as requested
  } catch (error: any) {
    console.error('❌ Error removing from wishlist:', error.message);
    throw error;
  }
};

// --- Watched ---

export const getWatched = async (uid: string): Promise<Movie[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, "users", uid, "watched"));
    return querySnapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          id: data.movieId,
          ...data
        } as Movie;
    });
  } catch (error: any) {
    console.error('❌ Error fetching watched:', error.message);
    return [];
  }
};

export const addToWatched = async (uid: string, movie: Movie, rating?: number) => {
  try {
    await setDoc(doc(db, "users", uid, "watched", movie.id.toString()), {
      movieId: movie.id,
      title: movie.title,
      poster_path: movie.poster_path,
      vote_average: movie.vote_average,
      media_type: movie.media_type || 'movie',
      userRating: rating || 0,
      watchedAt: Timestamp.now()
    }, { merge: true }); // Merge ensures we don't overwrite if it exists

    // Increment counter
    await updateDoc(doc(db, "users", uid), { 
        watchedCount: increment(1),
        ratingsCount: rating ? increment(1) : increment(0)
    });
    // Log removed as requested
  } catch (error: any) {
    console.error('❌ Error adding to watched:', error.message);
    throw error;
  }
};

export const removeFromWatched = async (uid: string, movieId: number) => {
  try {
    await deleteDoc(doc(db, "users", uid, "watched", movieId.toString()));
    // Decrement counter
    await updateDoc(doc(db, "users", uid), { watchedCount: increment(-1) });
    // Log removed as requested
  } catch (error: any) {
    console.error('❌ Error removing from watched:', error.message);
    throw error;
  }
};

export const updateMovieRating = async (uid: string, movieId: number, rating: number) => {
  try {
    // We use setDoc with merge:true to act as an upsert. 
    // If the movie isn't in 'watched' yet (rare but possible via race conditions), this adds it.
    const movieRef = doc(db, "users", uid, "watched", movieId.toString());
    
    // Check if document exists to decide whether to increment ratings count
    const docSnap = await getDoc(movieRef);
    const exists = docSnap.exists();
    const oldRating = exists ? (docSnap.data() as any).userRating : 0;

    await setDoc(movieRef, { 
        userRating: rating,
        movieId: movieId // Ensure ID is present if creating new
    }, { merge: true });
    
    // Update global user stats if this is a fresh rating
    if (rating > 0 && (!exists || oldRating === 0)) {
       await updateDoc(doc(db, "users", uid), { ratingsCount: increment(1) });
    }
    
    // Log removed as requested
  } catch (error: any) {
    console.error('❌ Error updating rating:', error.message);
    throw error;
  }
};

// === GLOBAL MOVIE CACHE (movieDetails) ===

export const getGlobalMovieSummary = async (movieId: number, lang: string): Promise<MovieSummary | null> => {
  try {
    // Access global collection "movieDetails" (accessible by any user based on rules)
    const docRef = doc(db, "movieDetails", movieId.toString());
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data() as any;
      // Structure: { id: 123, aiSummary: { ru: {...}, en: {...} } }
      const summary = data.aiSummary?.[lang];
      return summary || null;
    }
    return null;
  } catch (error: any) {
    // Graceful fail for global cache (e.g., offline or very restrictive rules)
    // console.warn('⚠️ Global summary fetch skipped/failed:', error.message);
    return null;
  }
};

export const saveGlobalMovieSummary = async (movieId: number, movieTitle: string, lang: string, summary: MovieSummary) => {
  if (!movieId || !summary) return;
  
  try {
    const docRef = doc(db, "movieDetails", movieId.toString());
    
    // Construct simplified data object
    const dataToSave = {
        title: movieTitle,
        summary: summary.summary,
        tone: summary.tone
    };

    // Use setDoc with merge: true. 
    // We pass the object structure { aiSummary: { [lang]: summary } }
    // Firestore's merge behavior will ensure we don't overwrite 'en' when saving 'ru', and vice-versa.
    await setDoc(docRef, {
      id: movieId,
      aiSummary: {
          [lang]: dataToSave
      },
      updatedAt: serverTimestamp()
    }, { merge: true });

    // Log removed as requested
  } catch (error: any) {
    console.error('❌ Error saving global summary:', error.message);
  }
};

// === HELPERS ===

const mapUser = (firebaseUser: User, nickname?: string, role?: string): UserProfile => ({
  id: firebaseUser.uid,
  username: nickname || 'User',
  email: firebaseUser.email || undefined,
  provider: firebaseUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'local',
  role: role || 'user',
  createdAt: 0
});

// === SETUP LISTENER ===

export const setupAuthListener = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export const getCurrentUser = () => {
  return auth.currentUser;
};