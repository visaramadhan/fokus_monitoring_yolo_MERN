import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Mail, ArrowLeft, LayoutDashboard } from 'lucide-react';
import toast from 'react-hot-toast';

interface ForgotPasswordForm {
  email: string;
}

export default function ForgotPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  
  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordForm>();

  const onSubmit = async (data: ForgotPasswordForm) => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      setEmailSent(true);
      toast.success('Password reset instructions sent to your email!');
    } catch (error: any) {
      toast.error('Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8"
      >
        <div>
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex justify-center"
          >
            <div className="h-16 w-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <LayoutDashboard className="h-8 w-8 text-white" />
            </div>
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6 text-center text-3xl font-extrabold text-gray-900"
          >
            Forgot Password?
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-2 text-center text-sm text-gray-600"
          >
            {emailSent 
              ? "Check your email for reset instructions"
              : "Enter your email address and we'll send you a link to reset your password"
            }
          </motion.p>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white py-8 px-6 shadow-xl rounded-xl border border-gray-100"
        >
          {!emailSent ? (
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('email', { 
                      required: 'Email is required',
                      pattern: {
                        value: /^\S+@\S+$/i,
                        message: 'Invalid email address'
                      }
                    })}
                    type="email"
                    className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm transition-all duration-200"
                    placeholder="Enter your email address"
                  />
                </div>
                {errors.email && (
                  <motion.p 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="mt-2 text-sm text-red-600"
                  >
                    {errors.email.message}
                  </motion.p>
                )}
              </div>

              <div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isLoading}
                  className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    'Send Reset Instructions'
                  )}
                </motion.button>
              </div>
            </form>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Mail className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Email Sent!</h3>
              <p className="text-sm text-gray-600">
                We've sent password reset instructions to your email address. 
                Please check your inbox and follow the link to reset your password.
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setEmailSent(false)}
                className="text-blue-600 hover:text-blue-500 text-sm font-medium"
              >
                Didn't receive the email? Try again
              </motion.button>
            </motion.div>
          )}

          <div className="mt-6 text-center">
            <Link 
              to="/login" 
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors duration-200"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sign In
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}