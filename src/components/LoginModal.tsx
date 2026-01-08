"use client";

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useModal } from '../context/ModalProvider';
import LoginModalContent from './LoginModalContent';

const LoginModal: React.FC = () => {
  const { isLoginModalOpen, closeLoginModal } = useModal();
  const [isClosing, setIsClosing] = useState(false);

  if (!isLoginModalOpen && !isClosing) return null;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      closeLoginModal();
      setIsClosing(false);
    }, 300); // Match animation duration
  };
  
  const animationClass = isLoginModalOpen && !isClosing ? 'animate-fade-in' : 'animate-fade-out';
  const contentAnimationClass = isLoginModalOpen && !isClosing ? 'animate-scale-in' : 'animate-scale-out';

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm ${animationClass}`}>
      <div className={`bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl h-fit relative ${contentAnimationClass}`}>
        
        {/* Close Button */}
        <button 
          onClick={handleClose} 
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-900 z-10 p-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <LoginModalContent onLoginSuccess={handleClose} />
      </div>
      
      {/* Custom Animations */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fade-out {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes scale-in {
          from { 
            opacity: 0;
            transform: scale(0.9);
          }
          to { 
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes scale-out {
          from { 
            opacity: 1;
            transform: scale(1);
          }
          to { 
            opacity: 0;
            transform: scale(0.9);
          }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        .animate-fade-out { animation: fade-out 0.3s ease-out forwards; }
        .animate-scale-in { animation: scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-scale-out { animation: scale-out 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};

export default LoginModal;