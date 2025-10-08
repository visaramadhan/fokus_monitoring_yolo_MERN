import React from 'react';
import { motion } from 'framer-motion';

export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50" />
      
      {/* Floating shapes */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full opacity-10"
        animate={{
          x: [0, 100, 0],
          y: [0, -100, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      <motion.div
        className="absolute top-3/4 right-1/4 w-48 h-48 bg-gradient-to-r from-teal-400 to-blue-400 rounded-full opacity-10"
        animate={{
          x: [0, -80, 0],
          y: [0, 80, 0],
          scale: [1, 0.8, 1],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      <motion.div
        className="absolute top-1/2 right-1/3 w-32 h-32 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full opacity-10"
        animate={{
          x: [0, 60, 0],
          y: [0, -60, 0],
          rotate: [0, 360],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    </div>
  );
}