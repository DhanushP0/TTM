import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import Papa from 'papaparse';
import NavBar from './NavBar';
import { getCurrentISTDate } from '../utils/timeUtils';

// Enhanced Animation Variants
const pageTransition = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut"
    }
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.3
    }
  }
};

const stepTransition = {
  hidden: { opacity: 0, x: 50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut"
    }
  },
  exit: {
    opacity: 0, x: -50,
    transition: {
      duration: 0.3
    }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.2,
    },
  }
};

const slideUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 100
    }
  }
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6 }
  }
};

const pulse = {
  scale: [1, 1.02, 1],
  transition: {
    duration: 2,
    repeat: Infinity,
    repeatType: "reverse" as const,
    ease: "easeInOut" as const
  }
};

interface TeacherTimetableFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const checkTimeSlotAvailability = async (
  classroomId: number,
  startTime: string,
  endTime: string,
  date: string,
  currentEntryId?: number
): Promise<boolean> => {
  try {
    console.log('Checking availability for:', {
      classroomId,
      startTime,
      endTime,
      date,
      currentEntryId
    });

    // Query for overlapping bookings
    let query = supabase
      .from('timetable')
      .select('*')
      .eq('classroom_id', classroomId)
      .eq('date', date)
      .or(
        `start_time.lt.${endTime},end_time.gt.${startTime}`
      );

    // Exclude current entry if updating
    if (currentEntryId) {
      query = query.neq('id', currentEntryId);
    }

    const { data, error } = await query;

    if (error) throw error;

    console.log('Found bookings:', data);

    // Check for actual overlaps with proper time comparison
    const hasOverlap = data?.some(booking => {
      const bookingStart = booking.start_time;
      const bookingEnd = booking.end_time;

      // Convert times to minutes for comparison
      const getMinutes = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
      };

      const currentStart = getMinutes(startTime);
      const currentEnd = getMinutes(endTime);
      const existingStart = getMinutes(bookingStart);
      const existingEnd = getMinutes(bookingEnd);

      // Allow booking if one slot ends exactly when the other begins
      return !(currentEnd <= existingStart || currentStart >= existingEnd);
    });

    const isAvailable = !hasOverlap;
    console.log('Time slot is available:', isAvailable);

    return isAvailable;
  } catch (error) {
    console.error('Error checking time slot availability:', error);
    return false;
  }
};

export default function TeacherTimetableForm(_: TeacherTimetableFormProps) {
  const [teacherId, setTeacherId] = useState<number | null>(null);
  const [className, setClassName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [buildingId, setBuildingId] = useState<number | ''>('');
  const [floorId, setFloorId] = useState<number | ''>('');
  const [classroomId, setClassroomId] = useState<number | ''>('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const controls = useAnimation();
  const navigate = useNavigate();

  useEffect(() => {
    controls.start("visible");
  }, [controls]);

  useEffect(() => {
    const fetchTeacherId = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError('Could not get current user');
        return;
      }

      const { data, error } = await supabase
        .from('teachers')
        .select('id')
        .eq('email', user.email)
        .single();

      if (error || !data) {
        setError('Teacher not found for this user');
        return;
      }

      setTeacherId(data.id);
    };

    // Animate fetch operations
    const sequence = async () => {
      await controls.start({ opacity: 1, transition: { duration: 0.5 } });
      await fetchTeacherId();
      await fetchBuildings();
    };

    sequence();
  }, [controls]);

  useEffect(() => {
    if (buildingId) fetchFloors();
  }, [buildingId]);

  useEffect(() => {
    if (floorId) fetchClassrooms();
  }, [floorId]);

  useEffect(() => {
    // console.log('Current Step:', currentStep);
  }, [currentStep]);

  const fetchBuildings = async () => {
    try {
      const { data, error } = await supabase.from('buildings').select('*').order('name');
      if (error) throw error;
      setBuildings(data || []);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred.');
      }
    }
  };

  const fetchFloors = async () => {
    try {
      const { data, error } = await supabase
        .from('floors')
        .select('*')
        .eq('building_id', buildingId)
        .order('floor_number');
      if (error) throw error;
      setFloors(data || []);
      setFloorId('');
      setClassroomId('');
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred.');
      }
    }    
  };

  const fetchClassrooms = async () => {
    try {
      const { data, error } = await supabase
        .from('classrooms')
        .select('*')
        .eq('floor_id', floorId)
        .order('room_number');
      if (error) throw error;
      setClassrooms(data || []);
      setClassroomId('');
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred.');
      }
    }    
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!teacherId) {
        throw new Error('Teacher ID is not set. Please ensure you are logged in as a teacher.');
      }

      if (!startTime || !endTime) {
        throw new Error('Start time and end time are required');
      }

      if (!classroomId) {
        throw new Error('Please select a classroom.');
      }

      // Check for overlapping time slots
      const isAvailable = await checkTimeSlotAvailability(classroomId, startTime, endTime, selectedDate);
      if (!isAvailable) {
        throw new Error(
          'This classroom is already booked during this time slot. Please choose a different time or classroom.'
        );
      }

      const entry = {
        class_name: className,
        teacher_id: teacherId,
        start_time: startTime,
        end_time: endTime,
        classroom_id: classroomId,
        building_id: buildingId || null,
        floor_id: floorId || null,
        date: selectedDate,
      };

      const { error } = await supabase.from('timetable').insert([entry]);
      if (error) throw error;

      setSuccess(true);
      controls.start({
        scale: [1, 1.02, 1],
        transition: { duration: 0.5 }
      });

      setTimeout(() => {
        navigate('/teacher-dashboard');
      }, 2000);
    } catch (error: any) {
      setError(error.message);
      controls.start({
        x: [0, -10, 10, -10, 0],
        transition: { duration: 0.4 }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      processCSVUpload(files[0]);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processCSVUpload(file);
    }
  };

  const processCSVUpload = async (file: File) => {
    try {
      setLoading(true);
      setUploadProgress(0);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = prev + Math.random() * 15;
          return newProgress >= 100 ? 100 : newProgress;
        });
      }, 200);

      const text = await file.text();

      // Parse CSV with proper configuration
      let rows: any[] = [];
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        delimiter: ',',
        transform: (value: string) => value.trim(),
        complete: (result) => {
          rows = result.data;
        },
        error: (error: Error) => {
          console.error('CSV parsing error:', error);
          throw new Error(`CSV parsing error: ${error.message}`);
        }
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Format the data for insertion
      const formattedRows = rows.map((row: any) => ({
        class_name: row.class_name,
        teacher_id: Number(teacherId),
        start_time: row.start_time,
        end_time: row.end_time,
        date: row.date,
        building_id: row.building_id ? Number(row.building_id) : null,
        floor_id: row.floor_id ? Number(row.floor_id) : null,
        classroom_id: row.classroom_id ? Number(row.classroom_id) : null,
      }));

      const { error } = await supabase.from('timetable').insert(formattedRows);
      if (error) throw error;

      setSuccess(true);

      // Show success message briefly before redirecting
      setTimeout(() => {
        navigate('/teacher-dashboard'); // Redirect to dashboard
      }, 1500);

    } catch (error: any) {
      console.error('CSV processing error:', error);
      setError(error.message);
      setUploadProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    setCurrentStep(2);
  };

  const prevStep = () => {
    setCurrentStep(1);
  };

  const handleCancel = () => {
    setShowCancelModal(true);
  };

  const confirmCancel = () => {
    // Reset all form states
    setClassName('');
    setStartTime('');
    setEndTime('');
    setBuildingId('');
    setFloorId('');
    setClassroomId('');
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setError(null);
    setShowCancelModal(false);

    // Add animation before redirecting
    controls.start({
      opacity: 0,
      y: -20,
      transition: { duration: 0.3 }
    }).then(() => {
      // Navigate after animation completes
      navigate('/teacher-dashboard', { replace: true });
    });
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50"
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={pageTransition}
      >
        <NavBar title="Add New Class" />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="mb-10"
          >
            <div className="bg-gradient-to-r from-blue-400 to-indigo-400 rounded-2xl shadow-lg overflow-hidden">
              <div className="relative">
                <div className="absolute inset-0 bg-[url('https://assets.vercel.com/image/upload/v1588361542/zeit/mdx/chevrons-light.svg')] bg-center opacity-10"></div>
                <div className="relative px-8 py-12 text-center sm:text-left sm:flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-white">Schedule a New Class</h2>
                    <p className="mt-3 text-blue-100 max-w-xl">
                      Create a new class session by providing the details below or use bulk upload for multiple entries.
                    </p>
                  </div>
                  <motion.div
                    animate={pulse}
                    className="hidden sm:block"
                  >
                    <div className="w-24 h-24 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="max-w-4xl mx-auto"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6 }}
                className="mb-6 bg-green-100 border border-red-300 rounded-xl shadow-lg p-6 text-green-800"
              >
                <div className="flex items-center">
                  <div className="mr-4 bg-white/20 rounded-full p-2">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">Success!</h3>
                    <p className="text-emerald-100">Class successfully created! Redirecting to dashboard...</p>
                  </div>
                </div>
              </motion.div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: { type: "spring", stiffness: 100 }
                }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-6 bg-red-100 border border-red-300 rounded-xl shadow-lg p-6 text-red-800"
              >
                <div className="flex items-center">
                  <div className="mr-4 bg-red-200 rounded-full p-2">
                    <svg
                      className="w-6 h-6 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">Error</h3>
                    <p className="text-sm">{error}</p>
                  </div>
                </div>
              </motion.div>
            )}

            <motion.div
              className="bg-white rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm border border-gray-100"
              variants={fadeIn}
            >
              <div className="px-6 py-8 sm:p-10">
                <AnimatePresence mode="wait" initial={false}>
                  {currentStep === 1 ? (
                    <motion.div
                      key="step1"
                      variants={stepTransition}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      <motion.div
                        className={`mb-8 p-6 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border-2 ${isDragging ? 'border-blue-400 border-dashed' : 'border-blue-100'} relative overflow-hidden transition-all duration-300`}
                        variants={slideUp}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      >
                        <div className="relative z-10">
                          <h3 className="text-xl font-semibold text-blue-800 mb-4 flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            Bulk Upload
                          </h3>

                          <div className="flex items-center justify-center h-36 bg-white/60 backdrop-blur-sm rounded-lg border border-blue-100">
                            <div className="text-center">
                              <motion.div
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.98 }}
                                className="relative"
                              >
                                <input
                                  type="file"
                                  accept=".csv"
                                  onChange={handleFileChange}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                  disabled={loading}
                                />
                                <button
                                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all duration-200 flex items-center"
                                  type="button"
                                >
                                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                  </svg>
                                  Choose CSV File
                                </button>
                              </motion.div>
                              <p className="mt-2 text-sm text-gray-500">
                                or drag & drop your file here
                              </p>
                            </div>
                          </div>

                          {uploadProgress > 0 && uploadProgress < 100 && (
                            <div className="mt-4">
                              <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <motion.div
                                  className="bg-blue-600 h-2.5 rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${uploadProgress}%` }}
                                  transition={{ duration: 0.2 }}
                                ></motion.div>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">Processing... {Math.round(uploadProgress)}%</p>
                            </div>
                          )}

                          <p className="mt-3 text-xs text-gray-500">
                            CSV format: ClassName, StartTime, EndTime, Date, BuildingId, FloorId, ClassroomId
                          </p>
                        </div>

                        {/* Decorative elements */}
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-blue-200/30 rounded-full blur-2xl"></div>
                        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-32 h-32 bg-indigo-200/30 rounded-full blur-2xl"></div>
                      </motion.div>

                      <div className="flex justify-end mt-8">
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={nextStep}
                          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center"
                        >
                          Manual Entry
                          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </motion.button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="step2"
                      variants={stepTransition}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      <form onSubmit={handleSubmit}>
                        <motion.div
                          variants={slideUp}
                          className="mb-6"
                        >
                          <label htmlFor="className" className="block text-sm font-medium text-gray-700 mb-1">
                            Class Name
                          </label>
                          <div className="relative rounded-xl">
                            <input
                              type="text"
                              id="className"
                              value={className}
                              onChange={(e) => setClassName(e.target.value)}
                              className="block w-full pl-10 pr-4 py-2.5 text-gray-700 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200 bg-white"
                              placeholder="e.g. Advanced Mathematics"
                              required
                              autoComplete="off"
                              autoFocus
                            />
                            <div className="absolute left-3 top-2.5 text-gray-400">
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                          </div>
                        </motion.div>

                        {/* Time inputs */}
                        <motion.div
                          variants={slideUp}
                          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6"
                        >
                          <div>
                            <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">
                              Start Time
                            </label>
                            <div className="relative rounded-xl">
                              <input
                                type="time"
                                id="startTime"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="block w-full pl-10 pr-4 py-2.5 text-gray-700 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200 bg-white"
                                required
                              />
                              <div className="absolute left-3 top-2.5 text-gray-400">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-1">
                              End Time
                            </label>
                            <div className="relative rounded-xl">
                              <input
                                type="time"
                                id="endTime"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className="block w-full pl-10 pr-4 py-2.5 text-gray-700 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200 bg-white"
                                required
                              />
                              <div className="absolute left-3 top-2.5 text-gray-400">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </motion.div>

                        {/* Date and Building Selection */}
                        <motion.div
                          variants={slideUp}
                          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6"
                        >
                          <div>
                            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                              Date
                            </label>
                            <div className="relative rounded-xl">
                              <input
                                type="date"
                                id="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                min={getCurrentISTDate()}
                                className="block w-full pl-10 pr-4 py-2.5 text-gray-700 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200 bg-white"
                                required
                              />
                              <div className="absolute left-3 top-2.5 text-gray-400">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label htmlFor="building" className="block text-sm font-medium text-gray-700 mb-1">
                              Building
                            </label>
                            <div className="relative rounded-xl">
                              <select
                                id="building"
                                value={buildingId}
                                onChange={(e) => setBuildingId(e.target.value ? Number(e.target.value) : '')}
                                className="block w-full pl-10 pr-4 py-2.5 text-gray-700 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200 bg-white"
                                required
                              >
                                <option value="">Select Building</option>
                                {buildings.map((building) => (
                                  <option key={building.id} value={building.id}>
                                    {building.name}
                                  </option>
                                ))}
                              </select>
                              <div className="absolute left-3 top-2.5 text-gray-400">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </motion.div>

                        {/* Floor and Classroom Selection */}
                        <motion.div
                          variants={slideUp}
                          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6"
                        >
                          <div>
                            <label htmlFor="floor" className="block text-sm font-medium text-gray-700 mb-1">
                              Floor
                            </label>
                            <div className="relative rounded-xl">
                              <select
                                id="floor"
                                value={floorId}
                                onChange={(e) => setFloorId(e.target.value ? Number(e.target.value) : '')}
                                className="block w-full pl-10 pr-4 py-2.5 text-gray-700 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200 bg-white"
                                disabled={!buildingId}
                                required
                              >
                                <option value="">Select Floor</option>
                                {floors.map((floor) => (
                                  <option key={floor.id} value={floor.id}>
                                    Floor {floor.floor_number}
                                  </option>
                                ))}
                              </select>
                              <div className="absolute left-3 top-2.5 text-gray-400">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label htmlFor="classroom" className="block text-sm font-medium text-gray-700 mb-1">
                              Classroom
                            </label>
                            <div className="relative rounded-xl">
                              <select
                                id="classroom"
                                value={classroomId}
                                onChange={(e) => setClassroomId(e.target.value ? Number(e.target.value) : '')}
                                className="block w-full pl-10 pr-4 py-2.5 text-gray-700 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200 bg-white"
                                disabled={!floorId}
                                required
                              >
                                <option value="">Select Classroom</option>
                                {classrooms.map((classroom) => (
                                  <option key={classroom.id} value={classroom.id}>
                                    Room {classroom.room_number}
                                  </option>
                                ))}
                              </select>
                              <div className="absolute left-3 top-2.5 text-gray-400">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </motion.div>

                        <motion.div
                          variants={slideUp}
                          className="mt-10 flex justify-between"
                        >
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            type="button"
                            onClick={prevStep}
                            className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg shadow-sm transition-all duration-200 flex items-center"
                          >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back to Bulk Upload
                          </motion.button>

                          <div className="flex space-x-4">
                            <motion.button
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              type="button"
                              onClick={handleCancel}
                              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-lg shadow-sm transition-all duration-200"
                            >
                              Cancel
                            </motion.button>

                            <motion.button
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              type="submit"
                              className={`px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 flex items-center ${loading ? 'opacity-70 cursor-not-allowed' : ''
                                }`}
                              disabled={loading}
                            >
                              {loading ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Processing...
                                </>
                              ) : (
                                <>
                                  Save Class
                                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </>
                              )}
                            </motion.button>
                          </div>
                        </motion.div>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Cancel Confirmation Modal */}
            <AnimatePresence>
              {showCancelModal && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.4 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black z-40"
                    onClick={() => setShowCancelModal(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: "spring", duration: 0.3 }}
                    className="fixed inset-0 flex items-center justify-center z-50 px-4 sm:px-0"
                  >
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative">
                      <div className="mb-4">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 text-center">
                          Cancel Class Creation?
                        </h3>
                        <p className="mt-2 text-sm text-gray-500 text-center">
                          Are you sure you want to cancel? Any unsaved changes will be lost.
                        </p>
                      </div>
                      <div className="flex space-x-3 justify-center">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setShowCancelModal(false)}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors duration-200"
                        >
                          Continue Editing
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={confirmCancel}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 flex items-center"
                        >
                          <svg
                            className="w-4 h-4 mr-1.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 19l-7-7m0 0l7-7m-7 7h18"
                            />
                          </svg>
                          Return to Dashboard
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            <motion.div
              variants={slideUp}
              className="mt-8 text-center text-gray-500 text-sm"
            >
              Need help? View our <span className="text-blue-600 hover:underline cursor-pointer">documentation</span> or <span className="text-blue-600 hover:underline cursor-pointer">contact support</span>.
            </motion.div>
          </motion.div>
        </main>
      </motion.div>
    </AnimatePresence>
  );
}