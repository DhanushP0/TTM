import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import TimetableForm from '../components/Timetable/TimetableForm'
import Navbar from '../components/Layout/Navbar'
import { motion, AnimatePresence } from 'framer-motion'
import { convertToIST, getCurrentISTTime } from '../utils/timeUtils'

// Types for our database structure
interface Building {
  id: number
  name: string
  floors: Floor[]
}

interface Floor {
  id: number
  floor_number: number
  building_id: number
  classrooms: Classroom[]
}

interface Classroom {
  id: number
  room_number: string
  floor_id: number
  building_id: number
  timetable_entries: TimetableEntry[]
}

interface TimetableEntry {
  id: number
  classroom_id: number
  start_time: string
  end_time: string
  class_name: string
  teacher_id: number
  date: string
  teacher?: {
    first_name: string
    last_name?: string
  }
  class_status?: {
    status: string
    updated_at: string
  }
}

type ClassStatus = 'Available' | 'In Progress' | 'Ended' | 'Scheduled' | 'Cancelled' | 'Rescheduled'

export default function Timetable() {
  const [buildings, setBuildings] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formMode, setFormMode] = useState<'closed' | 'add' | 'edit'>('closed')
  const [editingEntry, setEditingEntry] = useState<number | null>(null)
  const [activeBuilding, setActiveBuilding] = useState<number | null>(null)
  const [activeFloor, setActiveFloor] = useState<number | null>(null)
  const [selectedClass, setSelectedClass] = useState<TimetableEntry | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [classToDelete, setClassToDelete] = useState<TimetableEntry | null>(null)
  const [cls, setCls] = useState<TimetableEntry | null>(null)
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [showMondayReminder, setShowMondayReminder] = useState(false);

  // Add this function to check if it's Monday
  const isMondayReminder = () => {
    const today = new Date();
    return today.getDay() === 1; // 1 represents Monday
  };

  useEffect(() => {
    fetchData()

    // Set up real-time subscription
    const subscription = supabase
      .channel('timetable_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timetable' }, () => {
        fetchData()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Add this useEffect to check for Monday
  useEffect(() => {
    if (isMondayReminder()) {
      setShowMondayReminder(true);
    }
  }, []);

  // Set the first building and floor as active once data is loaded
  useEffect(() => {
    if (buildings.length > 0 && activeBuilding === null) {
      setActiveBuilding(buildings[0].id)

      if (buildings[0].floors.length > 0) {
        setActiveFloor(buildings[0].floors[0].id)
      }
    }
  }, [buildings, activeBuilding])

  const fetchData = async () => {
    try {
      setLoading(true);

      // Get today's date in IST
      const now = new Date();
      const istOffset = 330 * 60 * 1000; // IST is UTC+5:30
      const istNow = new Date(now.getTime() + istOffset);
      const todayIST = istNow.toISOString().split('T')[0];

      // Fetch buildings
      const { data: buildingsData, error: buildingsError } = await supabase
        .from('buildings')
        .select('*')
        .order('name')

      if (buildingsError) throw buildingsError

      // Fetch floors
      const { data: floorsData, error: floorsError } = await supabase
        .from('floors')
        .select('*')
        .order('floor_number')

      if (floorsError) throw floorsError

      // Fetch classrooms
      const { data: classroomsData, error: classroomsError } = await supabase
        .from('classrooms')
        .select('*')
        .order('room_number')

      if (classroomsError) throw classroomsError

      // Fetch today's timetable entries
      const { data: timetableData, error: timetableError } = await supabase
        .from('timetable')
        .select(`
          *,
          teacher:teachers(first_name, last_name),
          class_status (
            status,
            updated_at
          )
        `)
        .eq('date', todayIST);

      if (timetableError) throw timetableError

      // Build the nested structure
      const buildingsWithData = buildingsData.map(building => {
        const buildingFloors = floorsData.filter(floor => floor.building_id === building.id)

        const floorsWithClassrooms = buildingFloors.map(floor => {
          const floorClassrooms = classroomsData.filter(classroom =>
            classroom.floor_id === floor.id && classroom.building_id === building.id
          )

          const classroomsWithTimetable = floorClassrooms.map(classroom => {
            // Filter out ended classes using IST time
            const entries = timetableData
              .filter(entry => entry.classroom_id === classroom.id)
              .filter(entry => !isClassEnded(entry.end_time));

            return {
              ...classroom,
              timetable_entries: entries
            }
          })

          return {
            ...floor,
            classrooms: classroomsWithTimetable
          }
        })

        return {
          ...building,
          floors: floorsWithClassrooms
        }
      })

      setBuildings(buildingsWithData)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (classId: number) => {
    try {
      const { error } = await supabase
        .from('timetable')
        .delete()
        .eq('id', classId)

      if (error) throw error

      // Refresh the data
      fetchData()

      // Show success toast
      const successToast = document.getElementById('success-toast')
      if (successToast) {
        successToast.classList.remove('translate-y-20', 'opacity-0')
        successToast.classList.add('translate-y-0', 'opacity-100')

        setTimeout(() => {
          successToast.classList.add('translate-y-20', 'opacity-0')
          successToast.classList.remove('translate-y-0', 'opacity-100')
        }, 3000)
      }
    } catch (error: any) {
      console.error('Error deleting class:', error)
      setError(error.message)
    }
  }

  const handleCleanupTimetable = async () => {
    try {
      // Delete all records from the timetable table
      const { error } = await supabase
        .from('timetable')
        .delete()
        .neq('id', 0); // This will match all records

      if (error) throw error;

      // Close modal and refresh data
      setShowCleanupModal(false);

      // Show success toast
      const successToast = document.getElementById('success-toast');
      if (successToast) {
        const messageElement = successToast.querySelector('p');
        if (messageElement) {
          messageElement.textContent = 'All classes have been cleared successfully!';
        }
        successToast.classList.remove('translate-y-20', 'opacity-0');
        successToast.classList.add('translate-y-0', 'opacity-100');

        setTimeout(() => {
          successToast.classList.add('translate-y-20', 'opacity-0');
          successToast.classList.remove('translate-y-0', 'opacity-100');
        }, 3000);
      }

      // Refresh the data
      fetchData();
    } catch (error: any) {
      console.error('Error clearing timetable:', error);
      setError('Failed to clear timetable');
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, cls: TimetableEntry) => {
    e.stopPropagation();
    setClassToDelete(cls);
    setShowDeleteModal(true);
  };

  const handleEdit = (entry: TimetableEntry) => {
    setEditingEntry(entry.id)
    setFormMode('edit')
  }

  const handleFormSuccess = () => {
    setFormMode('closed')
    setEditingEntry(null)
    setSelectedClass(null)
    fetchData()
  }

  const isClassActive = (startTime: string, endTime: string): boolean => {
    const currentTime = getCurrentISTTime()
    return currentTime >= convertToIST(startTime) && currentTime <= convertToIST(endTime)
  }

  const isClassEnded = (endTime: string): boolean => {
    // Get current IST time
    const now = new Date();
    const istOffset = 330 * 60 * 1000; // IST is UTC+5:30
    const istNow = new Date(now.getTime() + istOffset);

    // Convert times to minutes since midnight
    const getMinutes = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const currentHours = istNow.getUTCHours();
    const currentMinutes = istNow.getUTCMinutes();
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;
    const endTimeInMinutes = getMinutes(endTime);

    console.log('Time comparison:', {
      currentTime: `${currentHours}:${currentMinutes}`,
      endTime,
      currentMinutes: currentTimeInMinutes,
      endMinutes: endTimeInMinutes
    });

    return currentTimeInMinutes > endTimeInMinutes;
  }

  const getClassStatus = (entry: TimetableEntry): ClassStatus => {
    if (!entry) return 'Available'
    if (entry.class_status?.status === 'Cancelled') return 'Cancelled'
    if (entry.class_status?.status === 'Rescheduled') return 'Rescheduled'
    if (isClassEnded(entry.end_time)) return 'Ended'
    if (isClassActive(entry.start_time, entry.end_time)) return 'In Progress'
    return 'Scheduled'
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'In Progress': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'Ended': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'Cancelled': return 'bg-red-100 text-red-800 border-red-200'
      case 'Rescheduled': return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'Available': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-indigo-100 text-indigo-800 border-indigo-200'
    }
  }

  const getStatusIcon = (status: ClassStatus) => {
    switch (status) {
      case 'In Progress':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )
      case 'Ended':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'Cancelled':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      case 'Rescheduled':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'Available':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      default:
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )
    }
  }

  // Filter classrooms by search query
  const filteredClassrooms = useMemo(() => {
    if (!activeBuilding || !activeFloor || !searchQuery.trim()) {
      return buildings
        .find(b => b.id === activeBuilding)
        ?.floors.find(f => f.id === activeFloor)
        ?.classrooms || []
    }

    const query = searchQuery.toLowerCase().trim()
    return (
      buildings
        .find(b => b.id === activeBuilding)
        ?.floors.find(f => f.id === activeFloor)
        ?.classrooms.filter(classroom => {
          // Search by room number
          if (classroom.room_number.toLowerCase().includes(query)) return true

          // Search by class name or teacher name
          return classroom.timetable_entries.some(entry =>
            entry.class_name.toLowerCase().includes(query) ||
            entry.teacher?.first_name.toLowerCase().includes(query) ||
            entry.teacher?.last_name?.toLowerCase().includes(query)
          )
        }) || []
    )
  }, [buildings, activeBuilding, activeFloor, searchQuery])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/70">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 relative">
              <div className="absolute inset-0 rounded-full border-4 border-blue-100"></div>
              <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="mt-6 text-gray-600 font-medium">Loading timetable data...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/70">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
        <div className="py-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
            <motion.div
              className="flex items-center space-x-4"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-3xl font-bold text-gray-900">Today's Schedule</h1>
              <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium border border-blue-200">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric'
                })}
              </div>
            </motion.div>

            <motion.div
              className="flex flex-col sm:flex-row gap-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="relative rounded-full">
                <input
                  type="text"
                  placeholder="Search rooms, classes or teachers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full sm:w-64 bg-white text-gray-700 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="absolute left-3 top-2.5 text-gray-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              <button
                onClick={() => {
                  setFormMode('add')
                  setEditingEntry(null)
                }}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Class
              </button>

              <button
                onClick={() => setShowCleanupModal(true)}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 transition-all duration-200"
              >
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v10M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                </svg>
                Clear Timetable
              </button>
            </motion.div>
          </div>

          {error && (
            <motion.div
              className="mb-6 bg-red-50 border border-red-200 p-4 rounded-xl"
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
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
                <div className="ml-auto pl-3">
                  <div className="-mx-1.5 -my-1.5">
                    <button
                      onClick={() => setError(null)}
                      className="inline-flex rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <span className="sr-only">Dismiss</span>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {formMode !== 'closed' ? (
              <motion.div
                key="form"
                className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-gray-100"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-medium text-gray-900">
                    {formMode === 'edit' ? 'Edit Timetable Entry' : 'Add Timetable Entry'}
                  </h2>
                  <button
                    onClick={() => {
                      setFormMode('closed')
                      setEditingEntry(null)
                    }}
                    className="p-1 rounded-full hover:bg-gray-100"
                  >
                    <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <TimetableForm
                  entryId={editingEntry || undefined}
                  onSuccess={handleFormSuccess}
                  onCancel={() => {
                    setFormMode('closed')
                    setEditingEntry(null)
                  }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Building tabs */}
                <div
                  className="mb-6 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
                >
                  <div className="flex space-x-2">
                    {buildings.map((building) => (
                      <button
                        key={building.id}
                        onClick={() => {
                          setActiveBuilding(building.id)
                          if (building.floors.length > 0) {
                            setActiveFloor(building.floors[0].id)
                          }
                          setSelectedClass(null)
                        }}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${activeBuilding === building.id
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                          }`}
                      >
                        {building.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Floor tabs */}
                {activeBuilding && (
                  <div className="mb-6">
                    <div className="flex flex-wrap gap-2">
                      {buildings
                        .find(b => b.id === activeBuilding)
                        ?.floors.map((floor) => (
                          <button
                            key={floor.id}
                            onClick={() => {
                              setActiveFloor(floor.id)
                              setSelectedClass(null)
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${activeFloor === floor.id
                              ? 'bg-indigo-500 text-white shadow-sm'
                              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                              }`}
                          >
                            Floor {floor.floor_number}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* Display classrooms for the selected floor */}
                {activeBuilding && activeFloor && (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredClassrooms.length > 0 ? (
                      filteredClassrooms.map((classroom, index) => (
                        <motion.div
                          key={classroom.id}
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
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                  </svg>
                                </div>
                                <h3 className="text-lg font-medium text-gray-900">Room {classroom.room_number}</h3>
                              </div>
                              {classroom.timetable_entries.length === 0 && (
                                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full border border-green-200 flex items-center">
                                  <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Available
                                </span>
                              )}
                            </div>

                            {classroom.timetable_entries.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-6 text-center">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                  <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                                <p className="text-gray-600 mb-1">No classes scheduled</p>
                                <p className="text-sm text-gray-500">This classroom is available for booking</p>
                                <button
                                  onClick={() => {
                                    setFormMode('add')
                                    setEditingEntry(null)
                                  }}
                                  className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-100 transition-all duration-200 border border-blue-200"
                                >
                                  Book Room
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {classroom.timetable_entries.map((entry) => {
                                  const status = getClassStatus(entry)
                                  const statusColor = getStatusColor(status)
                                  const isActive = selectedClass?.id === entry.id

                                  return (
                                    <motion.div
                                      key={entry.id}
                                      onClick={() => setSelectedClass(isActive ? null : entry)}
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      transition={{ duration: 0.3 }}
                                      className={`border rounded-xl p-4 hover:border-blue-300 transition-all duration-200 cursor-pointer ${isActive ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-gray-100'
                                        }`}
                                    >
                                      <div className="flex justify-between items-start mb-3">
                                        <div>
                                          <h4 className="font-medium text-gray-900 flex items-center">
                                            {entry.class_name}
                                            {status === 'In Progress' && (
                                              <span className="ml-2 relative flex h-2.5 w-2.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                                              </span>
                                            )}
                                          </h4>
                                          <p className="text-sm text-gray-500 mt-0.5 flex items-center">
                                            <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            {entry.teacher?.first_name || 'Unknown'} {entry.teacher?.last_name || ''}
                                          </p>
                                        </div>
                                        <AnimatePresence>
                                          {isActive && (
                                            <motion.div
                                              className="flex space-x-1"
                                              initial={{ opacity: 0, scale: 0.8 }}
                                              animate={{ opacity: 1, scale: 1 }}
                                              exit={{ opacity: 0, scale: 0.8 }}
                                              transition={{ duration: 0.2 }}
                                            >
                                              {!isClassEnded(entry.end_time) && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleEdit(entry)
                                                  }}
                                                  className="p-1.5 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors duration-200"
                                                >
                                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                  </svg>
                                                </button>
                                              )}
                                              <button
                                                onClick={(e) => handleDeleteClick(e, entry)}
                                                className="p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors duration-200"
                                              >
                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v10M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                                                </svg>
                                              </button>
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                      </div>

                                      <div className="flex items-center justify-between">
                                        <div className="text-sm text-gray-600">
                                          {convertToIST(entry.start_time.slice(0, 5))} - {convertToIST(entry.end_time.slice(0, 5))}
                                        </div>
                                        <span className={`px-2 py-1 flex items-center text-xs font-medium rounded-full ${statusColor}`}>
                                          <span className="mr-1">{getStatusIcon(status)}</span>
                                          {status}
                                        </span>
                                      </div>

                                      <AnimatePresence>
                                        {isActive && (
                                          <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="mt-3 pt-3 border-t border-gray-100"
                                          >
                                            <div className="text-sm text-gray-600">
                                              <div className="grid grid-cols-2 gap-2 mb-2">
                                                <div>
                                                  <p className="text-xs text-gray-500 mb-1">Start</p>
                                                  <p className="font-medium">{convertToIST(entry.start_time.slice(0, 5))}</p>
                                                </div>
                                                <div>
                                                  <p className="text-xs text-gray-500 mb-1">End</p>
                                                  <p className="font-medium">{convertToIST(entry.end_time.slice(0, 5))}</p>
                                                </div>
                                              </div>

                                              {entry.class_status && (
                                                <div className="mt-2">
                                                  <p className="text-xs text-gray-500 mb-1">Status updated</p>
                                                  <p className="text-sm">
                                                    {new Date(entry.class_status.updated_at).toLocaleTimeString('en-US', {
                                                      hour: '2-digit',
                                                      minute: '2-digit'
                                                    })}
                                                  </p>
                                                </div>
                                              )}
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </motion.div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="col-span-full flex flex-col items-center justify-center py-12 text-center"
                      >
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                          <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-1">No classrooms found</h3>
                        <p className="text-gray-500 max-w-md">
                          {searchQuery ?
                            `No results for "${searchQuery}". Try a different search term.` :
                            "No classrooms available on this floor."}
                        </p>
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-sm font-medium hover:bg-indigo-100 transition-all duration-200"
                          >
                            Clear Search
                          </button>
                        )}
                      </motion.div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Add Modal UI for delete confirmation */}
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
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span>{classToDelete.teacher?.first_name} {classToDelete.teacher?.last_name}</span>
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

          {/* Add Modal UI for cleanup confirmation */}
          <AnimatePresence>
            {showCleanupModal && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.4 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
                  onClick={() => setShowCleanupModal(false)}
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
                        <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center">
                          <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v10M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                          </svg>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Clear All Classes
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Are you sure you want to delete all classes? This action cannot be undone.
                        </p>
                      </div>
                    </div>

                    <div className="mt-8 flex justify-end space-x-3">
                      <motion.button
                        type="button"
                        onClick={() => setShowCleanupModal(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={handleCleanupTimetable}
                        className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Clear All
                      </motion.button>
                    </div>
                  </motion.div>
                </div>
              </>
            )}
          </AnimatePresence>

          {/* Add Modal UI for Monday reminder */}
          <AnimatePresence>
            {showMondayReminder && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.4 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
                  onClick={() => setShowMondayReminder(false)}
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
                        <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Weekly Cleanup Reminder
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                          It's Monday! Would you like to clear all timetable entries for a fresh start?
                        </p>
                      </div>
                    </div>

                    <div className="mt-8 flex justify-end space-x-3">
                      <motion.button
                        type="button"
                        onClick={() => setShowMondayReminder(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Remind Me Later
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={() => {
                          setShowMondayReminder(false);
                          setShowCleanupModal(true);
                        }}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Clear Classes
                      </motion.button>
                    </div>
                  </motion.div>
                </div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}