import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NavBarProps {
  title: string;
}

export default function NavBar({ title }: NavBarProps) {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    
    // Update time every minute
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearInterval(timeInterval);
    };
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate('/login');
    } catch (error: any) {
      console.error('Logout error:', error);
    }
  };

  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <motion.header
    className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'
    }`}
    initial={{ y: -100 }}
    animate={{ y: 0 }}
    transition={{ type: "spring", stiffness: 50, damping: 15 }}
  >
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center">
        <motion.div 
          className="flex items-center"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="mr-3">
            <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          </div>
          <div>
            <h1 className={`font-semibold transition-all duration-300 ${scrolled ? 'text-gray-900 text-lg' : 'text-gray-800 text-xl'}`}>{title}</h1>
            <p className={`text-xs text-gray-500 transition-all duration-300 ${scrolled ? 'opacity-100' : 'opacity-0'}`}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </motion.div>

        {/* Desktop menu */}
        <motion.div 
          className="hidden md:flex items-center space-x-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <nav className="flex items-center space-x-6">
            <a href="/teacher-dashboard" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors active">Dashboard</a>
            <a href="/teacher-timetable-form" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">Add Class</a>
            {/* <a href="/profile" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">Profile</a> */}
          </nav>
          <div className="flex items-center">
            <motion.button
              onClick={handleLogout}
              className="flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-medium hover:shadow-lg transition-all duration-300 hover:scale-105"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              <span>Logout</span>
              <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </motion.button>
          </div>
        </motion.div>

        {/* Mobile menu button */}
        <motion.div 
          className="md:hidden flex items-center"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <button
            className="text-gray-600 hover:text-gray-900 focus:outline-none"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </motion.div>
      </div>
    </div>

    {/* Mobile menu */}
    <AnimatePresence>
      {menuOpen && (
        <motion.div
          className="md:hidden absolute top-full left-0 right-0 bg-white shadow-lg"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="px-4 py-6 space-y-4">
            <a href="/teacher-dashboard" className="block py-2 text-base font-medium text-gray-700 hover:text-blue-600">Dashboard</a>
            <a href="/teacher-timetable-form" className="block py-2 text-base font-medium text-gray-700 hover:text-blue-600">Add Class</a>
            {/* <a href="/profile" className="block py-2 text-base font-medium text-gray-700 hover:text-blue-600">Profile</a> */}
            <button
              onClick={handleLogout}
              className="w-full mt-4 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </motion.header>
)
}