import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'

interface Building {
  id: number
  name: string
}

interface Floor {
  id: number
  floor_number: string
  building_id: number
}

interface Classroom {
  id: number
  room_number: string
  floor_id: number
}

interface Teacher {
  id: number
  first_name: string
  last_name: string
  email: string
}

interface TimetableFormProps {
  entryId?: number
  onSuccess: () => void
  onCancel: () => void
}

export default function TimetableForm({ entryId, onSuccess, onCancel }: TimetableFormProps) {
  const [className, setClassName] = useState('')
  const [teacherId, setTeacherId] = useState<number | ''>('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [buildingId, setBuildingId] = useState<number | ''>('')
  const [floorId, setFloorId] = useState<number | ''>('')
  const [classroomId, setClassroomId] = useState<number | ''>('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [floors, setFloors] = useState<Floor[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchBuildings()
    fetchTeachers()
    if (entryId) {
      fetchEntry()
    }
  }, [entryId])

  useEffect(() => {
    if (buildingId) {
      fetchFloors()
    } else {
      setFloors([])
      setFloorId('')
      setClassrooms([])
      setClassroomId('')
    }
  }, [buildingId])

  useEffect(() => {
    if (floorId) {
      fetchClassrooms()
    } else {
      setClassrooms([])
      setClassroomId('')
    }
  }, [floorId])

  const fetchTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, first_name, last_name, email')
        .order('first_name')

      if (error) throw error
      setTeachers(data || [])
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred.');
      }
    }
    
  }

  const fetchBuildings = async () => {
    try {
      const { data, error } = await supabase
        .from('buildings')
        .select('*')
        .order('name')

      if (error) throw error
      setBuildings(data || [])
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred.');
      }
    }
    
  }

  const fetchFloors = async () => {
    try {
      const { data, error } = await supabase
        .from('floors')
        .select('*')
        .eq('building_id', buildingId)
        .order('floor_number')

      if (error) throw error
      setFloors(data || [])
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred.');
      }
    }
    
  }

  const fetchClassrooms = async () => {
    try {
      const { data, error } = await supabase
        .from('classrooms')
        .select('*')
        .eq('floor_id', floorId)
        .order('room_number')

      if (error) throw error
      setClassrooms(data || [])
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred.');
      }
    }
    
  }

  const fetchEntry = async () => {
    try {
      const { data, error } = await supabase
        .from('timetable')
        .select(`
          *,
          classroom:classrooms(
            id,
            floor:floors(
              id,
              building_id
            )
          )
        `)
        .eq('id', entryId)
        .single()

      if (error) throw error
      if (data) {
        setClassName(data.class_name)
        setTeacherId(data.teacher_id)
        setStartTime(data.start_time)
        setEndTime(data.end_time)
        setSelectedDate(data.date)
        if (data.classroom) {
          setBuildingId(data.classroom.floor.building_id)
          setFloorId(data.classroom.floor.id)
          setClassroomId(data.classroom.id)
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred.');
      }
    }
    
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Validate time inputs
      if (!startTime || !endTime) {
        throw new Error('Start time and end time are required')
      }

      // Validate that end time is after start time
      if (endTime <= startTime) {
        throw new Error('End time must be after start time')
      }

      // If classroom is selected, check for time slot availability
      if (classroomId) {
        const isAvailable = await checkTimeSlotAvailability(
          Number(classroomId),
          startTime,
          endTime,
          selectedDate,
          entryId
        )

        if (!isAvailable) {
          throw new Error('This classroom is already booked for the selected time slot')
        }
      }

      const entry = {
        class_name: className,
        teacher_id: teacherId || null,
        start_time: startTime,
        end_time: endTime,
        classroom_id: classroomId || null,
        building_id: buildingId || null,
        floor_id: floorId || null,
        date: selectedDate
      }

      if (entryId) {
        const { error } = await supabase
          .from('timetable')
          .update(entry)
          .eq('id', entryId)

        if (error) throw error
        setSuccess('Class updated successfully!')
      } else {
        const { error } = await supabase
          .from('timetable')
          .insert([entry])

        if (error) throw error
        setSuccess('Class added successfully!')
      }

      // Short delay to show success message before closing
      setTimeout(() => {
        onSuccess()
      }, 1000)
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
    
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <AnimatePresence>
        {error && (
          <motion.div
            className="bg-red-50 border-l-4 border-red-400 p-4 rounded-xl shadow-sm"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
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
                    type="button"
                    onClick={() => setError(null)}
                    className="inline-flex rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
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

        {success && (
          <motion.div
            className="bg-green-50 border-l-4 border-green-400 p-4 rounded-xl shadow-sm"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
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
              required
              className="block w-full pl-10 pr-4 py-2.5 text-gray-700 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200 bg-white"
              autoComplete="off"
              autoFocus
              placeholder="Enter class name"
            />
            <div className="absolute left-3 top-2.5 text-gray-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
            Date
          </label>
          <div className="relative rounded-xl">
            <input
              type="date"
              id="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              required
              className="block w-full pl-10 pr-4 py-2.5 rounded-xl text-gray-700 placeholder-gray-500 border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200 bg-white"
            />
            <div className="absolute left-3 top-2.5 text-gray-500">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <label htmlFor="teacher" className="block text-sm font-medium text-gray-700 mb-1">
            Teacher
          </label>
          <div className="relative rounded-xl">
            <select
              id="teacher"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value ? Number(e.target.value) : '')}
              required
              className="block w-full pl-10 pr-10 py-2.5 rounded-xl text-gray-700 border border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200 appearance-none bg-white"
            >
              <option value="">Select a teacher</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.first_name} {teacher.last_name} ({teacher.email})
                </option>
              ))}
            </select>
            <div className="absolute left-3 top-2.5 text-gray-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="absolute right-3 top-2.5 text-gray-400 pointer-events-none">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
        >
          <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">
            Start Time
          </label>
          <div className="relative rounded-xl">
            <input
              type="time"
              id="startTime"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className="block w-full pl-10 pr-4 py-2.5 rounded-xl text-gray-700 border border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200 bg-white"
            />
            <div className="absolute left-3 top-2.5 text-gray-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-1">
            End Time
          </label>
          <div className="relative rounded-xl">
            <input
              type="time"
              id="endTime"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
              className="block w-full pl-10 pr-4 py-2.5 rounded-xl text-gray-700 border border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200 bg-white"
            />
            <div className="absolute left-3 top-2.5 text-gray-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.35 }}
        >
          <label htmlFor="building" className="block text-sm font-medium text-gray-700 mb-1">
            Building
          </label>
          <div className="relative rounded-xl">
            <select
              id="building"
              value={buildingId}
              onChange={(e) => setBuildingId(e.target.value ? Number(e.target.value) : '')}
              className="block w-full pl-10 pr-10 py-2.5 text-gray-700 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200 appearance-none bg-white"
            >
              <option value="">Select a building</option>
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
            <div className="absolute right-3 top-2.5 text-gray-400 pointer-events-none">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        >
          <label htmlFor="floor" className="block text-sm font-medium text-gray-700 mb-1">
            Floor
          </label>
          <div className="relative rounded-xl">
            <select
              id="floor"
              value={floorId}
              onChange={(e) => setFloorId(e.target.value ? Number(e.target.value) : '')}
              disabled={!buildingId}
              className={`block w-full pl-10 pr-10 py-2.5 rounded-xl text-gray-700 border shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200 appearance-none 
                ${!buildingId ? 'bg-gray-50 text-gray-400 border-gray-100' : 'bg-white border-gray-200'}`}
            >
              <option value="">Select a floor</option>
              {floors.map((floor) => (
                <option key={floor.id} value={floor.id}>
                  Floor {floor.floor_number}
                </option>
              ))}
            </select>
            <div className={`absolute left-3 top-2.5 ${!buildingId ? 'text-gray-300' : 'text-gray-400'}`}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <div className="absolute right-3 top-2.5 text-gray-400 pointer-events-none">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.45 }}
        >
          <label htmlFor="classroom" className="block text-sm font-medium text-gray-700 mb-1">
            Classroom
          </label>
          <div className="relative rounded-xl">
            <select
              id="classroom"
              value={classroomId}
              onChange={(e) => setClassroomId(e.target.value ? Number(e.target.value) : '')}
              disabled={!floorId}
              className={`block w-full pl-10 pr-10 py-2.5 rounded-xl  text-gray-700 border shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200 appearance-none 
                ${!floorId ? 'bg-gray-50 text-gray-400 border-gray-100' : 'bg-white border-gray-200'}`}
            >
              <option value="">Select a classroom</option>
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  Room {classroom.room_number}
                </option>
              ))}
            </select>
            <div className={`absolute left-3 top-2.5 ${!floorId ? 'text-gray-300' : 'text-gray-400'}`}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="absolute right-3 top-2.5 text-gray-400 pointer-events-none">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        className="flex justify-end space-x-3 pt-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.5 }}
      >
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 border border-gray-200 rounded-full shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200 flex items-center"
        >
          <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Cancel
        </button>

        <button
          type="submit"
          disabled={loading}
          className={`inline-flex items-center px-5 py-2.5 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 ${loading ? 'opacity-70' : ''}`}
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-0.5 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving...
            </>
          ) : (
            <>
              <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {entryId ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                )}
              </svg>
              {entryId ? 'Update Entry' : 'Add Entry'}
            </>
          )}
        </button>
      </motion.div>
    </motion.form>
  )
}