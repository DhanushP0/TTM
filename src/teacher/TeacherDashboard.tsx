import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { convertToIST, getCurrentISTTime } from '../utils/timeUtils'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import NavBar from './NavBar';
import { nav } from 'framer-motion/client'

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger)

// Types
interface Building {
  id: number
  name: string
}

interface Floor {
  id: number
  building_id: number
  floor_number: number
}

interface Classroom {
  id: number
  room_number: string
  floor_id: number
  building_id: number
}

interface AssignedClass {
  id: number
  class_name: string
  date: string
  start_time: string
  end_time: string
  classroom_id: number
  teacher_id: number
  class_status_id: number | null
  classroom?: {
    id: number
    room_number: string
    floor_id: number
    building_id: number
    floor?: {
      floor_number: number
      building?: {
        name: string
      }
    }
  }
  teacher?: {
    id: number
    first_name: string
    last_name: string
    department_id: number
    department?: {
      name: string
    }
  }
  class_status?: {
    id: number
    status: string
    updated_at: string
  }
}

interface GroupedClass {
  classroom: {
    id: number;
    room_number: string;
    floor: {
      floor_number: number;
      building: {
        name: string;
      };
    };
  };
  classes: AssignedClass[];
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.3
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1, y: 0,
    transition: { type: "spring", stiffness: 100 }
  }
}

interface NavBarProps {
  title: string;
}

const EditClassModal = ({
  isOpen,
  onClose,
  classData,
  onSave
}: {
  isOpen: boolean;
  onClose: () => void;
  classData: AssignedClass | null;  // Make classData nullable
  onSave: (updatedData: Partial<AssignedClass>) => Promise<void>;
}) => {
  // Initialize form data with empty values or class data if available
  const [formData, setFormData] = useState({
    class_name: classData?.class_name || '',
    start_time: classData?.start_time || '',
    end_time: classData?.end_time || '',
    date: classData?.date || '',
  });

  // Update form data when classData changes
  useEffect(() => {
    if (classData) {
      setFormData({
        class_name: classData.class_name,
        start_time: classData.start_time,
        end_time: classData.end_time,
        date: classData.date,
      });
    }
  }, [classData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classData) return; // Add null check
    await onSave(formData);
    onClose();
  };

  // Only render the modal if it's open and classData exists
  if (!isOpen || !classData) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />
          <div className="fixed inset-0 flex items-center justify-center z-[70] overflow-y-auto px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg"
            >
              <form onSubmit={handleSubmit}>
                <div className="p-6 border-b border-gray-100">
                  <h3 className="text-xl font-semibold text-gray-900">
                    Edit Class Details
                  </h3>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Class Name
                    </label>
                    <input
                      type="text"
                      value={formData.class_name}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        class_name: e.target.value
                      }))}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={formData.start_time}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          start_time: e.target.value
                        }))}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={formData.end_time}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          end_time: e.target.value
                        }))}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        date: e.target.value
                      }))}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default function TeacherDashboard() {
  const [buildings, setBuildings] = useState<Building[]>([])
  const [floors, setFloors] = useState<Floor[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [assignedClasses, setAssignedClasses] = useState<AssignedClass[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [teacherId, setTeacherId] = useState<number | null>(null)
  const [activeFilter, setActiveFilter] = useState<'today' | 'upcoming'>('today')
  const [searchQuery, setSearchQuery] = useState('')
  const [showEditStatusModal, setShowEditStatusModal] = useState(false)
  const [selectedClass, setSelectedClass] = useState<AssignedClass | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isAnimate, setIsAnimate] = useState(false)
  const [lastFetchedDate, setLastFetchedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingClass, setEditingClass] = useState<AssignedClass | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [classToDelete, setClassToDelete] = useState<AssignedClass | null>(null);
  const navigate = useNavigate()

  const handleDelete = async (classId: number) => {
    try {
      const { error } = await supabase
        .from('timetable')
        .delete()
        .eq('id', classId)

      if (error) throw error

      // Refresh the data
      fetchAssignedClasses()

      // Show delete success toast
      const successToast = document.getElementById('success-toast')
      if (successToast) {
        // Update the success message text
        const messageElement = successToast.querySelector('p');
        if (messageElement) {
          messageElement.textContent = 'Class deleted successfully!';
        }

        successToast.classList.remove('translate-y-20', 'opacity-0')
        successToast.classList.add('translate-y-0', 'opacity-100')

        setTimeout(() => {
          successToast.classList.add('translate-y-20', 'opacity-0')
          successToast.classList.remove('translate-y-0', 'opacity-100')
        }, 3000)
      }
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred.');
      }
    }
    
  }

  const handleDeleteClick = (e: React.MouseEvent, cls: AssignedClass) => {
    e.stopPropagation();
    setClassToDelete(cls);
    setShowDeleteModal(true);
  };

  const handleEdit = (cls: AssignedClass) => {
    navigate(`/edit-class/${cls.id}`)
  }

  const handleEditClass = async (updatedData: Partial<AssignedClass>) => {
    try {
      if (!editingClass) return;

      const { error } = await supabase
        .from('timetable')
        .update(updatedData)
        .eq('id', editingClass.id);

      if (error) throw error;

      // Show edit success toast
      const successToast = document.getElementById('success-toast');
      if (successToast) {
        // Update the success message text
        const messageElement = successToast.querySelector('p');
        if (messageElement) {
          messageElement.textContent = 'Class details updated successfully!';
        }

        successToast.classList.remove('translate-y-20', 'opacity-0');
        successToast.classList.add('translate-y-0', 'opacity-100');

        setTimeout(() => {
          successToast.classList.add('translate-y-20', 'opacity-0');
          successToast.classList.remove('translate-y-0', 'opacity-100');
        }, 3000);
      }

      // Close modal and refresh data
      setShowEditModal(false);
      setEditingClass(null);
      fetchAssignedClasses();
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred.');
      }
    }
    
  };

  useEffect(() => {
    // Set animation trigger
    setTimeout(() => {
      setIsAnimate(true)
    }, 500)

    // Initialize GSAP animations
    const ctx = gsap.context(() => {
      // Cards animation on scroll
      ScrollTrigger.batch(".class-card", {
        onEnter: batch => gsap.to(batch, {
          opacity: 1,
          y: 0,
          stagger: 0.05,
          duration: 0.5,
          ease: "power2.out"
        }),
        start: "top 90%"
      })
    })

    return () => ctx.revert()
  }, [assignedClasses])

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    return () => clearInterval(timer)
  }, [])

  // Add auto-refresh for ended classes
  useEffect(() => {
    const checkEndedClasses = setInterval(() => {
      const now = new Date();
      const istOffset = 330 * 60 * 1000; // IST is UTC+5:30
      const currentISTDate = new Date(now.getTime() + istOffset)
        .toISOString()
        .split('T')[0];

      // Re-fetch classes if it's a new day
      if (currentISTDate !== lastFetchedDate) {
        setLastFetchedDate(currentISTDate);
        fetchAssignedClasses();
      } else {
        // Force re-render to update status of classes
        setCurrentTime(new Date());
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkEndedClasses);
  }, [lastFetchedDate]);

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true)
        await Promise.all([
          fetchTeacherData(),
          fetchBuildingsData(),
          fetchFloorsData(),
          fetchClassroomsData(),
        ])
      } catch (error) {
        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError('An unknown error occurred.');
        }
      }
      
    }

    fetchInitialData()
  }, [])

  // Fetch classes when teacher ID is available
  useEffect(() => {
    if (teacherId !== null) {
      fetchAssignedClasses()
    }
  }, [teacherId, activeFilter])

  // Set up real-time subscription
  useEffect(() => {
    const subscription = supabase
      .channel('table_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'timetable' },
        () => fetchAssignedClasses()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'class_status' },
        () => fetchAssignedClasses()
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [teacherId])

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const istOffset = 330 * 60 * 1000; // IST is UTC+5:30
      const currentISTDate = new Date(now.getTime() + istOffset)
        .toISOString()
        .split('T')[0]; // Extract the date part in IST

      // Check if the current date is different from the last fetched date
      if (currentISTDate !== lastFetchedDate) {
        setLastFetchedDate(currentISTDate); // Update the last fetched date
        fetchAssignedClasses(); // Fetch classes for the new day
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval); // Cleanup on component unmount
  }, [lastFetchedDate]);

  useEffect(() => {
    const checkPassedClasses = setInterval(() => {
      // Force re-render to update filtered classes
      setCurrentTime(new Date());
    }, 60000); // Check every minute

    return () => clearInterval(checkPassedClasses);
  }, []);

  const fetchTeacherData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      const { data: teacherRows, error: teacherError } = await supabase
        .from('teachers')
        .select('id')
        .eq('email', user.email)

      if (teacherError) throw teacherError
      if (!teacherRows || teacherRows.length === 0) throw new Error('No teacher found with this email')

      setTeacherId(teacherRows[0].id)
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred.');
      }
    }    
  }

  const fetchBuildingsData = async () => {
    try {
      const { data: buildingsData, error: buildingsError } = await supabase
        .from('buildings')
        .select('*')
        .order('name')

      if (buildingsError) throw buildingsError
      setBuildings(buildingsData || [])
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred.');
      }
    }    
  }

  const fetchFloorsData = async () => {
    try {
      const { data: floorsData, error: floorsError } = await supabase
        .from('floors')
        .select('*')
        .order('floor_number')

      if (floorsError) throw floorsError
      setFloors(floorsData || [])
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred.');
      }
    }    
  }

  const fetchClassroomsData = async () => {
    try {
      const { data: classroomsData, error: classroomsError } = await supabase
        .from('classrooms')
        .select('*')
        .order('room_number')

      if (classroomsError) throw classroomsError
      setClassrooms(classroomsData || [])
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred.');
      }
    }    
  }

  const fetchAssignedClasses = async () => {
    try {
      if (!teacherId) return;

      const now = new Date();
      const istOffset = 330 * 60 * 1000; // IST is UTC+5:30
      const todayIST = new Date(now.getTime() + istOffset).toISOString().split('T')[0];
      const tomorrowIST = new Date(now.getTime() + istOffset + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      let query = supabase
        .from('timetable')
        .select(`
          *,
          classroom:classrooms (
            id,
            room_number,
            floor:floors (
              floor_number,
              building:buildings (
                name
              )
            )
          ),
          teacher:teachers (
            id,
            first_name,
            last_name,
            department:departments (
              name
            )
          ),
          class_status:class_status_id (
            id,
            status,
            updated_at
          )
        `)
        .eq('teacher_id', teacherId)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      // Apply filter based on active filter
      if (activeFilter === 'today') {
        query = query.eq('date', todayIST);
      } else if (activeFilter === 'upcoming') {
        query = query.eq('date', tomorrowIST);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAssignedClasses(data || []);
      setLoading(false);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred.');
      }
    }
  };

  const groupClassesByClassroom = (classes: AssignedClass[]): GroupedClass[] => {
    const grouped = classes.reduce((acc: { [key: string]: GroupedClass }, cls) => {
      const classroomId = cls.classroom?.id;
      if (!classroomId) return acc;

      if (!acc[classroomId]) {
        acc[classroomId] = {
          classroom: cls.classroom && cls.classroom.floor && cls.classroom.floor.building
            ? {
              id: cls.classroom.id,
              room_number: cls.classroom.room_number,
              floor: {
                floor_number: cls.classroom.floor.floor_number,
                building: {
                  name: cls.classroom.floor.building.name,
                },
              },
            }
            : {
              id: 0,
              room_number: 'Unknown',
              floor: {
                floor_number: 0,
                building: {
                  name: 'Unknown',
                },
              },
            },
          classes: []
        };
      }
      acc[classroomId].classes.push(cls);
      return acc;
    }, {});

    return Object.values(grouped);
  };

  const getStatusId = async (statusName: string): Promise<number> => {
    const { data, error } = await supabase
      .from('class_status')
      .select('id')
      .eq('status', statusName.toLowerCase())
      .single();

    if (error) throw error;
    return data.id;
  };

  const updateClassStatus = async (classId: number, statusName: string) => {
    try {
      // Get the status ID first
      const statusId = await getStatusId(statusName);

      // Update the class with the correct status ID
      const { error: updateError } = await supabase
        .from('timetable')
        .update({ class_status_id: statusId })
        .eq('id', classId);

      if (updateError) throw updateError;

      // Refresh data immediately
      await fetchAssignedClasses();

      // Show success message
      const successToast = document.getElementById('success-toast');
      if (successToast) {
        successToast.classList.remove('translate-y-20', 'opacity-0');
        successToast.classList.add('translate-y-0', 'opacity-100');

        setTimeout(() => {
          successToast.classList.add('translate-y-20', 'opacity-0');
          successToast.classList.remove('translate-y-0', 'opacity-100');
        }, 3000);
      }

      setShowEditStatusModal(false);
      setSelectedClass(null);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred.');
      }
    }    
  };

  const getClassStatus = (cls: AssignedClass): string => {
    if (!cls) return 'available';

    // First check status from class_status table
    if (cls.class_status?.status) {
      return cls.class_status.status.toLowerCase();
    }

    const currentTime = getCurrentISTTime();
    const today = new Date().toISOString().split('T')[0];

    if (cls.date < today) {
      return 'ended';
    }

    if (cls.date === today) {
      if (currentTime > convertToIST(cls.end_time)) {
        return 'ended';
      }
      if (currentTime >= convertToIST(cls.start_time) && currentTime <= convertToIST(cls.end_time)) {
        return 'ongoing';
      }
    }

    return 'scheduled';
  };

  const isClassInSession = (cls: AssignedClass): boolean => {
    const currentTime = getCurrentISTTime();
    const today = new Date().toISOString().split('T')[0];

    return (
      cls.date === today &&
      currentTime >= convertToIST(cls.start_time) &&
      currentTime <= convertToIST(cls.end_time) &&
      !['canceled', 'ended', 'rescheduled'].includes(cls.class_status?.status?.toLowerCase() || '')
    );
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'ongoing': return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
      case 'scheduled': return 'bg-gradient-to-r from-green-400 to-green-500 text-white'
      case 'canceled': return 'bg-gradient-to-r from-red-500 to-red-600 text-white'
      case 'rescheduled': return 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white'
      case 'delayed': return 'bg-gradient-to-r from-purple-400 to-purple-500 text-white'
      case 'ended': return 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
      default: return 'bg-gradient-to-r from-green-400 to-green-500 text-white'
    }
  }

  const getStatusLightColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'ongoing': return 'bg-green-100 text-green-800'
      case 'scheduled': return 'bg-blue-100 text-blue-800'
      case 'canceled': return 'bg-red-100 text-red-800'
      case 'rescheduled': return 'bg-purple-100 text-purple-800'
      case 'delayed': return 'bg-yellow-100 text-yellow-800'
      case 'ended': return 'bg-gray-100 text-gray-800'
      default: return 'bg-blue-100 text-blue-800'
    }
  }

  const getBuildingName = (buildingId: number): string => {
    const building = buildings.find(b => b.id === buildingId)
    return building ? building.name : 'Unknown Building'
  }

  const isClassPassed = (cls: AssignedClass): boolean => {
    // Get current IST time and date
    const now = new Date();
    const istOffset = 330 * 60 * 1000; // IST is UTC+5:30 (330 minutes)
    const istNow = new Date(now.getTime() + istOffset);
    const todayIST = istNow.toISOString().split('T')[0];

    // Convert IST time to minutes since midnight
    const getMinutes = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    // Get current IST time in HH:mm format
    const currentHours = istNow.getUTCHours();
    const currentMinutes = istNow.getUTCMinutes();
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;

    // Get class end time in minutes
    const endTimeInMinutes = getMinutes(cls.end_time);

    // Debug logs
    // console.log('IST Current Time:', `${currentHours}:${currentMinutes}`);
    // console.log('Class End Time:', cls.end_time);
    // console.log('Current Minutes:', currentTimeInMinutes);
    // console.log('End Minutes:', endTimeInMinutes);
    // console.log('Today IST:', todayIST);
    // console.log('Class Date:', cls.date);

    // If class date is before today
    if (cls.date < todayIST) return true;

    // If class is today and end time has passed
    if (cls.date === todayIST && currentTimeInMinutes > endTimeInMinutes) {
      return true;
    }

    return false;
  };

  const getFilteredClasses = (): AssignedClass[] => {
    // First filter out passed classes
    const filteredByTime = assignedClasses.filter(cls => {
      // Remove passed classes
      const isPassed = isClassPassed(cls);
      // console.log('Class:', cls.class_name, 'isPassed:', isPassed, 'Time:', cls.end_time);
      return !isPassed;
    });

    // Then apply search filter if exists
    if (!searchQuery) return filteredByTime;

    return filteredByTime.filter(cls =>
      cls.class_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cls.classroom?.room_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cls.classroom?.floor?.building?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cls.teacher?.department?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const handleEditStatus = (cls: AssignedClass) => {
    setSelectedClass(cls)
    setShowEditStatusModal(true)
  }

  const clearSearch = () => {
    setSearchQuery('')

    // Animation for search clearing
    gsap.to("#search-input", {
      keyframes: { x: [-5, 5, -3, 3, 0] },
      duration: 0.4,
      ease: "power2.out"
    })
  }

  // Loading animation
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="flex flex-col items-center px-4">
          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-24 h-24 rounded-full border-[3px] border-blue-100"></div>
            <motion.div
              className="absolute inset-0 rounded-full border-[3px] border-blue-500 border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "linear"
              }}
            ></motion.div>
            <motion.div
              className="absolute inset-0 rounded-full border-[3px] border-indigo-500 border-t-transparent border-b-transparent"
              animate={{ rotate: -180 }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear"
              }}
            ></motion.div>
          </motion.div>
          <motion.div
            className="mt-8 flex flex-col items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Preparing Dashboard</h2>
            <p className="text-gray-500 text-center">Loading your classes and schedule</p>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-blue-50/30">
      <NavBar title="Teacher Dashboard" />
      {/* Modal for editing class status */}
      {/* Success toast */}
      <div
        id="success-toast"
        className="fixed bottom-4 right-4 z-50 bg-white border border-green-100 shadow-lg rounded-lg px-4 py-3 transform translate-y-20 opacity-0 transition-all duration-300 ease-in-out flex items-center"
      >
        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="font-medium text-green-800">Class deleted successfully!</p>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {error && (
          <motion.div
            className="mb-8 bg-red-50 border border-red-100 p-4 rounded-xl shadow-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <div className="ml-auto pl-3">
                <div className="-mx-1.5 -my-1.5">
                  <motion.button
                    onClick={() => setError(null)}
                    className="inline-flex rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="sr-only">Dismiss</span>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Header section with welcome message */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl shadow-sm border border-blue-100 p-6 lg:p-8">
            <div className="flex flex-col md:flex-row md:items-center">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">Welcome Back!</h2>
                <p className="mt-2 text-gray-600">
                  {currentTime.toLocaleDateString('en-US', { weekday: 'long' })} | {currentTime.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="mt-3 text-gray-600 max-w-2xl">
                  View and manage your class schedule. Update class status, view classroom details, and keep track of your teaching commitments.
                </p>
              </div>
              <div className="mt-6 md:mt-0 md:ml-8">
                <div className="inline-block bg-white rounded-xl shadow-sm border border-blue-100 p-5">
                  <div className="flex items-center">
                    <div className="mr-4">
                      <div className="bg-blue-100 rounded-lg p-3">
                        <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Today's Classes</p>
                      <p className="text-xl font-bold text-gray-800">
                        {assignedClasses.filter(cls => cls.date === lastFetchedDate).length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Search and filters section */}
        <motion.div
          className="mb-8 flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {/* Search input */}
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              id="search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search classes, rooms, buildings..."
              className="block w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex space-x-2">
            <motion.button
              onClick={() => setActiveFilter('today')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeFilter === 'today'
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              whileHover={{ scale: activeFilter !== 'today' ? 1.05 : 1 }}
              whileTap={{ scale: 0.97 }}
            >
              Today
            </motion.button>
            <motion.button
              onClick={() => setActiveFilter('upcoming')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeFilter === 'upcoming'
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              whileHover={{ scale: activeFilter !== 'upcoming' ? 1.05 : 1 }}
              whileTap={{ scale: 0.97 }}
            >
              Tomorrow
            </motion.button>
          </div>
        </motion.div>

        {/* Classes grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {groupClassesByClassroom(getFilteredClasses()).length > 0 ? (
            groupClassesByClassroom(getFilteredClasses()).map((group, index) => (
              <motion.div
                key={group.classroom.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 * index }}
                className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 border border-gray-100"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center mr-3">
                        <svg className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          Room {group.classroom.room_number}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {group.classroom.floor.building.name} - Floor {group.classroom.floor.floor_number}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {group.classes.map((cls) => {
                      const status = getClassStatus(cls);
                      const isActive = selectedClass?.id === cls.id;

                      return (
                        <motion.div
                          key={cls.id}
                          onClick={() => setSelectedClass(isActive ? null : cls)}
                          className={`border rounded-xl p-4 hover:border-blue-300 transition-all duration-200 cursor-pointer 
                            ${isActive ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-gray-100'}`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-medium text-gray-900 flex items-center">
                                {cls.class_name}
                                {(status === 'ongoing' || isClassInSession(cls)) && (
                                  <span className="ml-2 relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                  </span>
                                )}
                              </h4>
                              <p className="text-sm text-gray-500 mt-1">
                                {convertToIST(cls.start_time)} - {convertToIST(cls.end_time)}
                              </p>
                            </div>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${status === 'ongoing' ? 'bg-green-100 text-green-800' :
                              status === 'canceled' ? 'bg-red-100 text-red-800' :
                                status === 'delayed' ? 'bg-yellow-100 text-yellow-800' :
                                  status === 'rescheduled' ? 'bg-purple-100 text-purple-800' :
                                    status === 'ended' ? 'bg-gray-100 text-gray-800' :
                                      'bg-blue-100 text-blue-800'
                              }`}>
                              {status.toUpperCase()}
                            </span>
                          </div>

                          {isActive && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="flex justify-end space-x-2 mt-3 pt-3 border-t border-gray-100"
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingClass(cls);
                                  setShowEditModal(true);
                                }}
                                className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors duration-200"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditStatus(cls);
                                }}
                                className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors duration-200"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => handleDeleteClick(e, cls)}
                                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors duration-200"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v10M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
                                  />
                                </svg>
                              </button>
                            </motion.div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="col-span-full flex flex-col items-center justify-center py-16 px-4"
            >
              <div className="bg-blue-50 rounded-full p-4 mb-4">
                <svg
                  className="w-8 h-8 text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {activeFilter === 'upcoming'
                  ? 'No upcoming classes scheduled'
                  : 'No classes scheduled for today'}
              </h3>
              <p className="text-gray-500 text-center max-w-md">
                {activeFilter === 'upcoming'
                  ? 'There are no classes scheduled for the upcoming days. Check back later or add new classes.'
                  : 'You have no classes scheduled for today. Check upcoming classes or add new ones.'}
              </p>
              <motion.button
                onClick={() => navigate('/teacher-timetable-form')}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg shadow-sm hover:bg-blue-600 transition-colors duration-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Add Class
              </motion.button>
            </motion.div>
          )}
        </div>
      </main>

      {/* Edit Status Modal */}
      <AnimatePresence>
        {showEditStatusModal && selectedClass && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
              onClick={() => setShowEditStatusModal(false)}
            />

            <div className="fixed inset-0 flex items-center justify-center z-[70] overflow-y-auto px-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", duration: 0.3 }}
                className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all w-full max-w-3xl"
              >
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">
                        Update Class Status
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Select a new status for <span className="font-medium">{selectedClass.class_name}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="px-6 py-8">
                  <div className="grid grid-cols-2 gap-4">
                    {['scheduled', 'rescheduled', 'ongoing', 'delayed', 'canceled', 'ended'].map((status) => (
                      <motion.button
                        key={status}
                        onClick={() => updateClassStatus(selectedClass.id, status)}
                        className={`relative p-4 rounded-xl text-sm font-medium flex flex-col items-center justify-center space-y-2
                          ${selectedClass.class_status?.status === status
                            ? getStatusColor(status)
                            : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-blue-200 hover:bg-blue-50'
                          } transition-all duration-200`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {/* Status Icon */}
                        <div className={`p-3 rounded-lg ${selectedClass.class_status?.status === status
                          ? 'bg-white/20'
                          : 'bg-gray-100'
                          }`}>
                          {status === 'scheduled' && (
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          )}
                          {status === 'rescheduled' && (
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          )}
                          {status === 'ongoing' && (
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                          {status === 'delayed' && (
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                          {status === 'canceled' && (
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          {status === 'ended' && (
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </div>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </motion.button>
                    ))}
                  </div>

                  {/* Class Details */}
                  <div className="mt-8 bg-gray-50 rounded-xl p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Class Details</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-gray-600">{convertToIST(selectedClass.start_time)} - {convertToIST(selectedClass.end_time)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="text-gray-600">Room {selectedClass.classroom?.room_number}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end">
                  <motion.button
                    type="button"
                    onClick={() => setShowEditStatusModal(false)}
                    className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Close
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <EditClassModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingClass(null);
        }}
        classData={editingClass}  // Remove the non-null assertion
        onSave={handleEditClass}
      />

      <AnimatePresence>
        {showDeleteModal && classToDelete && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
              onClick={() => setShowDeleteModal(false)}
            />
            <div className="fixed inset-0 flex items-center justify-center z-[70] overflow-y-auto px-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                      <svg
                        className="h-6 w-6 text-red-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v10M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
                        />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Delete Class
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Are you sure you want to delete {classToDelete.class_name}? This action cannot be undone.
                    </p>
                  </div>
                </div>

                <div className="mt-8 bg-red-50 rounded-xl p-4">
                  <div className="text-sm text-red-800 space-y-2">
                    <div className="flex items-center space-x-2">
                      <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{convertToIST(classToDelete.start_time)} - {convertToIST(classToDelete.end_time)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span>Room {classToDelete.classroom?.room_number}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-end space-x-3">
                  <motion.button
                    type="button"
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={async () => {
                      await handleDelete(classToDelete.id);
                      setShowDeleteModal(false);
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Delete Class
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}