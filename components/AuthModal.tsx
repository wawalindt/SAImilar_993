
import React, { useState } from 'react';
import { UserProfile } from '../types';
import { loginUser, registerUser, loginWithGoogle } from '../services/firebaseService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: UserProfile) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLogin }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
        let user: UserProfile;
        if (mode === 'login') {
            user = await loginUser(email, password);
        } else {
            user = await registerUser(username, email, password);
        }
        onLogin(user);
        onClose();
    } catch (e: any) {
        let msg = e.message;
        // Clean up common firebase errors if not already handled in service
        if (msg.includes('auth/invalid-credential')) msg = 'Invalid email or password.';
        if (msg.includes('auth/email-already-in-use')) msg = 'Email already registered.';
        if (msg.includes('auth/weak-password')) msg = 'Password should be at least 6 characters.';
        setError(msg);
    } finally {
        setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
      setError('');
      setIsLoading(true);
      try {
          const user = await loginWithGoogle();
          onLogin(user);
          onClose();
      } catch (e: any) {
          setError(e.message || 'Google login failed');
      } finally {
          setIsLoading(false);
      }
  };

  const resetState = () => {
      setMode('login');
      setError('');
      setUsername('');
      setEmail('');
      setPassword('');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-fadeIn">
        <div className="flex border-b border-white/5">
            <button 
                className={`flex-1 py-4 text-sm font-bold uppercase transition-colors ${mode === 'login' ? 'bg-surface text-primary border-b-2 border-primary' : 'bg-surfaceHover/50 text-textMuted hover:text-white'}`}
                onClick={resetState}
            >
                Log In
            </button>
            <button 
                className={`flex-1 py-4 text-sm font-bold uppercase transition-colors ${mode === 'register' ? 'bg-surface text-primary border-b-2 border-primary' : 'bg-surfaceHover/50 text-textMuted hover:text-white'}`}
                onClick={() => { setMode('register'); setError(''); }}
            >
                Register
            </button>
        </div>

        <div className="p-8">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
                {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>

            {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-xs text-center">
                    {error}
                </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
                {mode === 'register' && (
                    <div>
                        <label className="block text-xs uppercase text-textMuted font-bold mb-1">Username</label>
                        <input 
                            type="text" 
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-background border border-surfaceHover rounded-xl px-4 py-3 text-textMain focus:border-primary outline-none"
                            placeholder="Display Name"
                        />
                    </div>
                )}
                
                <div>
                    <label className="block text-xs uppercase text-textMuted font-bold mb-1">Email</label>
                    <input 
                        type="email" 
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-background border border-surfaceHover rounded-xl px-4 py-3 text-textMain focus:border-primary outline-none"
                        placeholder="you@example.com"
                    />
                </div>

                <div>
                    <label className="block text-xs uppercase text-textMuted font-bold mb-1">Password</label>
                    <input 
                        type="password" 
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-background border border-surfaceHover rounded-xl px-4 py-3 text-textMain focus:border-primary outline-none"
                        placeholder="••••••••"
                        minLength={6}
                    />
                </div>

                <button 
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-primary hover:bg-red-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/20 transition-all mt-2 disabled:opacity-50 flex justify-center items-center gap-2"
                >
                    {isLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                    {mode === 'login' ? 'Sign In' : 'Sign Up'}
                </button>
            </form>

            <div className="mt-6 flex items-center gap-4">
                <div className="h-px bg-white/10 flex-1"></div>
                <span className="text-xs text-textMuted uppercase">OR</span>
                <div className="h-px bg-white/10 flex-1"></div>
            </div>

            <button 
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full mt-6 bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
            >
                <i className="fa-brands fa-google text-lg"></i>
                Continue with Google
            </button>
        </div>
        
        <button onClick={onClose} className="absolute top-4 right-4 text-textMuted hover:text-white">
            <i className="fa-solid fa-xmark text-xl"></i>
        </button>
      </div>
    </div>
  );
};

export default AuthModal;
