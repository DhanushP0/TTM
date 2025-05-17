import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Clock, Calendar, AlertTriangle, Info, X, CheckCircle, Moon, Sun } from 'lucide-react';
import { supabase } from '../lib/supabase';

const ANIMATION_CONFIG = {
  layout: { duration: 0.3 },
  transition: { type: "spring", stiffness: 100, damping: 15 }
};

interface ClassInfo {
  id: number;
  class_name: string;
  start_time: string;
  end_time: string;
  date: string;
  teacher?: {
    first_name: string;
    last_name: string;
  };
  class_status?: {
    status: string;
    updated_at: string;
  };
}

interface ProcessedClassroom {
  id: number;
  room_number: string;
  status: string;
  classInfo: ClassInfo | null;
  nextClassInfo: ClassInfo | null;
}

export default function ClassroomDisplayTable() {
  const [params, setParams] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return {
      building: Number(searchParams.get('building')) || 1,
      floor: Number(searchParams.get('floor')) || 1
    };
  });
  const [classrooms, setClassrooms] = useState<ProcessedClassroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isNotificationVisible, setIsNotificationVisible] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('');
  const [darkMode, setDarkMode] = useState(() => {
    // Check for saved preference or system preference
    const savedPreference = localStorage.getItem('darkMode');
    if (savedPreference !== null) {
      return savedPreference === 'true';
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const formatTime = (timeString: string | null | undefined): string => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${minutes} ${ampm}`;
  };

  const isTimeInRange = (currentTime: string, startTime: string, endTime: string): boolean => {
    const getMinutes = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    let current = getMinutes(currentTime);
    const start = getMinutes(startTime);
    let end = getMinutes(endTime);

    if (end < start) {
      end += 24 * 60;
      if (current < start) {
        current += 24 * 60;
      }
    }

    return current >= start && current <= end;
  };

  const getTimeUntilNext = (nextTime: string): string => {
    const currentTimeMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const [nextHours, nextMinutes] = nextTime.split(':').map(Number);
    const nextTimeMinutes = nextHours * 60 + nextMinutes;

    let diffMinutes = nextTimeMinutes - currentTimeMinutes;
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60; // Next day
    }

    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const fetchClassrooms = useCallback(async () => {
    if (isNaN(params.building) || isNaN(params.floor)) {
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('classrooms')
        .select(`
          id,
          room_number,
          timetable: timetable(
            id,
            class_name,
            start_time,
            end_time,
            date,
            teacher: teacher_id(
              first_name,
              last_name
            ),
            class_status: class_status_id(
              status,
              updated_at
            )
          )
        `)
        .eq('building_id', params.building)
        .eq('floor_id', params.floor);

      if (fetchError) {
        console.error('Error fetching classrooms:', fetchError.message);
        setError(fetchError.message);
      } else {
        const today = currentTime.toISOString().split('T')[0];
        const currentTimeString = currentTime.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });

        const processedClassrooms = data.map(classroom => {
          const todaysSessions = (classroom.timetable || [])
            .filter(entry => entry.date === today)
            .sort((a, b) => a.start_time.localeCompare(b.start_time));

          const currentSession = todaysSessions.find(entry => {
            const normalizeTime = (time: string) => time.split(':').slice(0, 2).join(':');

            return isTimeInRange(
              normalizeTime(currentTimeString),
              normalizeTime(entry.start_time),
              normalizeTime(entry.end_time)
            );
          });

          const upcomingSessions = todaysSessions.filter(entry => {
            const startTime = new Date(`1970/01/01 ${entry.start_time}`);
            const current = new Date(`1970/01/01 ${currentTimeString}`);
            return startTime > current && entry.id !== currentSession?.id;
          });

          let status = 'available';
          let classInfo = null;
          let nextClassInfo = upcomingSessions[0] || null;

          if (currentSession) {
            const entryStatus = currentSession.class_status?.status?.toLowerCase() || 'in-session';

            switch (entryStatus) {
              case 'canceled':
                status = 'canceled';
                classInfo = currentSession;
                nextClassInfo = upcomingSessions[0] || null;
                break;

              case 'ended':
                status = 'ended';
                classInfo = currentSession;
                nextClassInfo = upcomingSessions[0] || null;
                break;

              case 'rescheduled':
                status = 'rescheduled';
                classInfo = currentSession;
                nextClassInfo = upcomingSessions[0] || null;
                break;

              case 'delayed':
                status = 'delayed';
                classInfo = currentSession;
                break;

              default:
                status = 'in-session';
                classInfo = currentSession;
            }
          } else if (nextClassInfo) {
            // If no current session but there's an upcoming class soon (within 15 minutes)
            const nextStartTime = new Date(`1970/01/01 ${nextClassInfo.start_time}`);
            const current = new Date(`1970/01/01 ${currentTimeString}`);
            const diffMs = nextStartTime.getTime() - current.getTime();
            const diffMinutes = diffMs / (1000 * 60);

            if (diffMinutes <= 15) {
              status = 'upcoming';
            }
          }

          return {
            id: classroom.id,
            room_number: classroom.room_number,
            status,
            classInfo,
            nextClassInfo
          };
        });

        // Sort classrooms: in-session/upcoming first, then by room number
        const sortedClassrooms = processedClassrooms.sort((a, b) => {
          // First sort by status priority
          const statusPriority = {
            'in-session': 1,
            'upcoming': 2,
            'delayed': 3,
            'rescheduled': 4,
            'canceled': 5,
            'available': 6,
            'ended': 7
          };

          const priorityDiff = statusPriority[a.status as keyof typeof statusPriority] - statusPriority[b.status as keyof typeof statusPriority];
          if (priorityDiff !== 0) return priorityDiff;

          // Then sort by room number
          return a.room_number.localeCompare(b.room_number);
        });

        setClassrooms(sortedClassrooms);
      }
    } catch (err) {
      console.error('Error fetching classrooms:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    }

    setLoading(false);
  }, [params.building, params.floor, currentTime]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
        showNotification('error', 'Could not enter fullscreen mode');
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const newMode = !prev;
      localStorage.setItem('darkMode', String(newMode));
      return newMode;
    });
  };

  interface Notification {
    type: 'error' | 'success';
    message: string;
  }

  const showNotification = (type: Notification['type'], message: Notification['message']): void => {
    setNotificationType(type);
    setNotificationMessage(message);
    setIsNotificationVisible(true);

    setTimeout(() => {
      setIsNotificationVisible(false);
    }, 3000);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Increase refresh interval significantly
    const refreshTimer = setInterval(() => {
      fetchClassrooms();
    }, 300000); // Changed to 5 minutes

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      clearInterval(timer);
      clearInterval(refreshTimer);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [fetchClassrooms]);

  useEffect(() => {
    fetchClassrooms();
  }, [fetchClassrooms]);

  // Apply dark mode class to body
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const formattedCurrentTime = (() => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes().toString().padStart(2, '0');
    const seconds = currentTime.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    return `${formattedHours}:${minutes}:${seconds} ${ampm}`;
  })();

  const getStatusDisplay = (status) => {
    switch (status) {
      case 'in-session': return 'IN SESSION';
      case 'upcoming': return 'UPCOMING';
      case 'available': return 'AVAILABLE';
      case 'canceled': return 'CANCELLED';
      case 'rescheduled': return 'RESCHEDULED';
      case 'delayed': return 'DELAYED';
      case 'ended': return 'ENDED';
      default: return 'AVAILABLE';
    }
  };

  const getStatusColors = (status) => {
    if (darkMode) {
      switch (status) {
        case 'in-session': return 'bg-green-900 border-green-800';
        case 'upcoming': return 'bg-blue-900 border-blue-800';
        case 'available': return 'bg-gray-800 border-gray-700';
        case 'canceled': return 'bg-red-900 border-red-800';
        case 'ended': return 'bg-gray-800 border-gray-700';
        case 'rescheduled': return 'bg-purple-900 border-purple-800';
        case 'delayed': return 'bg-yellow-900 border-yellow-800';
        default: return 'bg-gray-800 border-gray-700';
      }
    } else {
      switch (status) {
        case 'in-session': return 'bg-green-300 border-green-300';
        case 'upcoming': return 'bg-blue-300 border-blue-300';
        case 'available': return 'bg-gray-100 border-gray-300';
        case 'canceled': return 'bg-red-200 border-red-300';
        case 'ended': return 'bg-gray-100 border-gray-300';
        case 'rescheduled': return 'bg-purple-200 border-purple-300';
        case 'delayed': return 'bg-yellow-200 border-yellow-300';
        default: return 'bg-gray-100 border-gray-300';
      }
    }
  };

  const getStatusTextColor = (status) => {
    if (darkMode) {
      switch (status) {
        case 'in-session': return 'text-green-300';
        case 'upcoming': return 'text-blue-300';
        case 'available': return 'text-gray-300';
        case 'canceled': return 'text-red-300';
        case 'ended': return 'text-gray-300';
        case 'rescheduled': return 'text-purple-300';
        case 'delayed': return 'text-yellow-300';
        default: return 'text-gray-300';
      }
    } else {
      switch (status) {
        case 'in-session': return 'text-green-800';
        case 'upcoming': return 'text-blue-800';
        case 'available': return 'text-gray-800';
        case 'canceled': return 'text-red-800';
        case 'ended': return 'text-gray-800';
        case 'rescheduled': return 'text-purple-800';
        case 'delayed': return 'text-yellow-800';
        default: return 'text-gray-800';
      }
    }
  };

  const getStatusIndicator = (status) => {
    switch (status) {
      case 'in-session': return 'bg-green-500';
      case 'upcoming': return 'bg-blue-500';
      case 'available': return darkMode ? 'bg-gray-400' : 'bg-gray-400';
      case 'canceled': return 'bg-red-500';
      case 'ended': return darkMode ? 'bg-gray-400' : 'bg-gray-400';
      case 'rescheduled': return 'bg-purple-500';
      case 'delayed': return 'bg-yellow-500';
      default: return darkMode ? 'bg-gray-400' : 'bg-gray-400';
    }
  };

  const getStatusIcon = (status) => {
    if (darkMode) {
      switch (status) {
        case 'canceled':
          return <X className="w-4 h-4 text-red-300" />;
        case 'delayed':
          return <Clock className="w-4 h-4 text-yellow-300" />;
        case 'rescheduled':
          return <AlertTriangle className="w-4 h-4 text-purple-300" />;
        default:
          return null;
      }
    } else {
      switch (status) {
        case 'canceled':
          return <X className="w-4 h-4 text-red-600" />;
        case 'delayed':
          return <Clock className="w-4 h-4 text-yellow-600" />;
        case 'rescheduled':
          return <AlertTriangle className="w-4 h-4 text-purple-600" />;
        default:
          return null;
      }
    }
  };

  const StatusAlert = ({ classroom }: { classroom: ProcessedClassroom }) => {
    if (!['canceled', 'delayed', 'rescheduled'].includes(classroom.status)) return null;

    let message = '';
    let bgColor = '';
    let textColor = '';
    let icon = null;

    if (darkMode) {
      switch (classroom.status) {
        case 'canceled':
          message = 'This class has been cancelled.';
          bgColor = 'bg-red-800';
          textColor = 'text-red-200';
          icon = <X className="w-5 h-5 text-red-300" />;
          break;
        case 'delayed':
          message = 'This class has been delayed.';
          bgColor = 'bg-yellow-800';
          textColor = 'text-yellow-200';
          icon = <Clock className="w-5 h-5 text-yellow-300" />;
          break;
        case 'rescheduled':
          message = 'This class has been rescheduled.';
          bgColor = 'bg-purple-800';
          textColor = 'text-purple-200';
          icon = <AlertTriangle className="w-5 h-5 text-purple-300" />;
          break;
        default:
          return null;
      }
    } else {
      switch (classroom.status) {
        case 'canceled':
          message = 'This class has been cancelled.';
          bgColor = 'bg-red-400';
          textColor = 'text-red-900';
          icon = <X className="w-5 h-5 text-red-600" />;
          break;
        case 'delayed':
          message = 'This class has been delayed.';
          bgColor = 'bg-yellow-400';
          textColor = 'text-yellow-900';
          icon = <Clock className="w-5 h-5 text-yellow-600" />;
          break;
        case 'rescheduled':
          message = 'This class has been rescheduled.';
          bgColor = 'bg-purple-400';
          textColor = 'text-purple-900';
          icon = <AlertTriangle className="w-5 h-5 text-purple-600" />;
          break;
        default:
          return null;
      }
    }

    return (
      <motion.div
        layout
        layoutId={`status-${classroom.id}`}
        className={`flex items-center p-2 ${bgColor} rounded-lg mb-2 ${textColor}`}
        initial={false}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={ANIMATION_CONFIG}
      >
        <div className="mr-2">{icon}</div>
        <div className="text-sm font-medium">{message}</div>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="mb-6"
          >
            <svg className={`w-16 h-16 ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </motion.div>
          <span className={`text-3xl font-light ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Loading Classroom Data</span>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={`text-3xl font-light ${darkMode ? 'text-red-400' : 'text-red-600'} flex flex-col items-center`}
        >
          <svg className="w-16 h-16 mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Error Loading Data
          <div className={`text-sm ${darkMode ? 'text-red-300' : 'text-red-500'} mt-2`}>{error}</div>
          <button
            onClick={() => { setLoading(true); fetchClassrooms(); }}
            className={`mt-4 px-4 py-2 ${darkMode ? 'bg-indigo-700 hover:bg-indigo-600' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded-md text-sm transition-colors`}
          >
            Try Again
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode
      ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100'
      : 'bg-gradient-to-br from-gray-50 to-gray-100 text-gray-800'} 
      overflow-hidden transition-colors duration-300`}>
      <AnimatePresence>
        {isNotificationVisible && (
          <motion.div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${darkMode
                ? notificationType === 'error' ? 'bg-red-900 text-red-100' : 'bg-green-900 text-green-100'
                : notificationType === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
              }`}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {notificationType === 'error' ? (
              <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                {notificationMessage}
              </div>
            ) : (
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 mr-2" />
                {notificationMessage}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed top-4 right-4 z-50 flex space-x-2">
        <motion.button
          onClick={toggleDarkMode}
          className={`p-2 rounded-full ${darkMode
              ? 'bg-gray-700 hover:bg-gray-600 text-yellow-300'
              : 'bg-white hover:bg-indigo-600 hover:text-white'
            } shadow-md backdrop-blur-sm transition-all duration-300`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </motion.button>

        <motion.button
          onClick={toggleFullscreen}
          className={`p-2 rounded-full ${darkMode
              ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
              : 'bg-white hover:bg-indigo-600 hover:text-white'
            } shadow-md backdrop-blur-sm transition-all duration-300`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <Maximize2 className="w-5 h-5" />
        </motion.button>
      </div>

      <header className="py-6 px-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center mb-6"
        >
          <h1 className={`text-4xl font-light mb-6 tracking-tight ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
            Classroom Availability
          </h1>

          <div className="flex items-center space-x-6">
            <motion.div
              className={`text-2xl font-light ${darkMode
                  ? 'bg-gray-800/80 border-gray-700 text-gray-100'
                  : 'bg-white/80 border-gray-200 text-gray-800'
                } px-6 py-3 rounded-xl shadow-sm flex items-center backdrop-blur-sm border`}
              animate={{ opacity: [1, 0.9, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Clock className={`w-5 h-5 mr-3 ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
              {formattedCurrentTime}
            </motion.div>

            <div className={`text-lg font-light ${darkMode
                ? 'bg-gray-800/80 border-gray-700 text-gray-100'
                : 'bg-white/80 border-gray-200 text-gray-800'
              } px-6 py-3 rounded-xl shadow-sm flex items-center backdrop-blur-sm border`}>
              <Calendar className={`w-5 h-5 mr-3 ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </motion.div>
      </header>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="px-8 pb-8 grid grid-cols-1 gap-4"
      >
        <AnimatePresence>
          {classrooms.map((classroom, index) => (
            <motion.div
              key={classroom.id}
              layoutId={`classroom-${classroom.id}`}
              initial={false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={ANIMATION_CONFIG}
              className={`backdrop-blur-md ${darkMode
                  ? 'bg-gray-800/60 border'
                  : 'bg-white/80 border'
                } rounded-xl shadow-lg overflow-hidden ${getStatusColors(classroom.status)}`}
            >
              <div className="p-4">
                <StatusAlert classroom={classroom} />

                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-2 flex items-center">
                    <div className="flex flex-col items-center justify-center w-full">
                      <span className={`text-sm font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider mb-1`}>Room</span>
                      <span className={`text-3xl font-light ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{classroom.room_number}</span>
                    </div>
                  </div>

                  <div className="col-span-2 flex items-center">
                    <div className="flex flex-col items-center justify-center w-full">
                      <span className={`text-sm font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider mb-1`}>Status</span>
                      <div className="flex items-center space-x-2">
                        <motion.div
                          className={`w-3 h-3 rounded-full ${getStatusIndicator(classroom.status)}`}
                          animate={['in-session', 'upcoming', 'delayed'].includes(classroom.status) ? {
                            scale: [1, 1.3, 1],
                            opacity: [1, 0.7, 1]
                          } : {}}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            repeatType: "loop"
                          }}
                        />
                        <span className={`font-medium tracking-wider ${getStatusTextColor(classroom.status)}`}>
                          {getStatusDisplay(classroom.status)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-3 flex items-center">
                    <div className="flex flex-col w-full">
                      <span className={`text-sm font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider mb-1`}>Class</span>
                      <span className={`font-medium ${darkMode ? 'text-gray-100' : 'text-gray-800'} truncate`}>
                        {classroom.classInfo ? classroom.classInfo.class_name : 'No Current Class'}
                      </span>
                    </div>
                  </div>

                  <div className="col-span-3 flex items-center">
                    <div className="flex flex-col w-full">
                      <span className={`text-sm font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider mb-1`}>Teacher</span>
                      <span className={`font-medium ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                        {classroom.classInfo?.teacher
                          ? `${classroom.classInfo.teacher.first_name} ${classroom.classInfo.teacher.last_name}`
                          : 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <div className="flex flex-col h-full justify-center">
                      {classroom.classInfo ? (
                        <div>
                          <span className={`text-sm font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider block mb-1`}>Time</span>
                          <div className="flex items-center">
                            <span className={`${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                              {`${formatTime(classroom.classInfo.start_time)} - ${formatTime(classroom.classInfo.end_time)}`}
                            </span>
                            {getStatusIcon(classroom.status)}
                          </div>
                        </div>
                      ) : classroom.nextClassInfo ? (
                        <div>
                          <span className={`text-sm font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider block mb-1`}>Next Class</span>
                          <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            {formatTime(classroom.nextClassInfo.start_time)}
                            <span className={`ml-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              (in {getTimeUntilNext(classroom.nextClassInfo.start_time)})
                            </span>
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className={`text-sm font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wider block mb-1`}>Next Class</span>
                          <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>No upcoming classes today</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {classroom.status === 'in-session' && classroom.classInfo && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className={`mt-3 pt-3 ${darkMode ? 'border-t border-gray-700' : 'border-t border-gray-200'}`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <Info className={`w-4 h-4 mr-2 ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
                        <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          Class in session for {classroom.classInfo.class_name}
                        </span>
                      </div>
                      {classroom.nextClassInfo && (
                        <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Next: {classroom.nextClassInfo.class_name} at {formatTime(classroom.nextClassInfo.start_time)}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {classroom.status === 'upcoming' && classroom.nextClassInfo && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className={`mt-3 pt-3 ${darkMode ? 'border-t border-gray-700' : 'border-t border-gray-200'}`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <Clock className={`w-4 h-4 mr-2 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                        <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          {classroom.nextClassInfo.class_name} starting soon
                        </span>
                      </div>
                      <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Teacher: {classroom.nextClassInfo.teacher
                          ? `${classroom.nextClassInfo.teacher.first_name} ${classroom.nextClassInfo.teacher.last_name}`
                          : 'Unassigned'}
                      </div>
                    </div>
                  </motion.div>
                )}

                {['rescheduled', 'delayed', 'canceled', 'ended'].includes(classroom.status) &&
                  classroom.nextClassInfo && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className={`${darkMode
                          ? 'bg-indigo-900/30 border-t border-indigo-800'
                          : 'bg-indigo-50/80 border-t border-indigo-100'
                        } backdrop-blur-sm p-3`}
                    >
                      <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-2 flex items-center justify-center">
                          <div className={`text-xs font-semibold ${darkMode ? 'text-indigo-300' : 'text-indigo-800'
                            } uppercase tracking-wider flex items-center`}>
                            <Info className="w-4 h-4 mr-1" />
                            {classroom.status === 'canceled' ? 'Alternative Class' :
                              classroom.status === 'ended' ? 'Next Class' :
                                classroom.status === 'rescheduled' ? 'Rescheduled To' :
                                  'Next Available'}
                          </div>
                        </div>
                        <div className={`col-span-3 text-sm ${darkMode ? 'text-indigo-200' : 'text-indigo-900'
                          } font-light`}>
                          {classroom.nextClassInfo.class_name}
                        </div>
                        <div className={`col-span-3 text-sm ${darkMode ? 'text-indigo-200' : 'text-indigo-900'
                          } font-light`}>
                          {formatTime(classroom.nextClassInfo.start_time)} - {formatTime(classroom.nextClassInfo.end_time)}
                          <span className={`${darkMode ? 'text-indigo-300' : 'text-indigo-700'
                            } text-xs ml-2`}>
                            ({getTimeUntilNext(classroom.nextClassInfo.start_time)} from now)
                          </span>
                        </div>
                        <div className={`col-span-4 text-sm ${darkMode ? 'text-indigo-200' : 'text-indigo-900'
                          } font-light`}>
                          {classroom.nextClassInfo?.teacher && (
                            <span>
                              {classroom.nextClassInfo.teacher.first_name} {classroom.nextClassInfo.teacher.last_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {classrooms.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={`flex flex-col items-center justify-center p-8 ${darkMode
                ? 'bg-gray-800/60 border-gray-700'
                : 'bg-white/80 border-gray-200'
              } border rounded-xl backdrop-blur-sm`}
          >
            <Info className={`w-12 h-12 ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-4`} />
            <h3 className={`text-xl font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>No Classrooms Found</h3>
            <p className={`text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              There are no classrooms available for Building {params.building}, Floor {params.floor}.
            </p>

          </motion.div>
        )}
      </motion.div>
    </div>
  );
}