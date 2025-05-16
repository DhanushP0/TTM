import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'

interface Building {
  id: number
  name: string
}

interface Floor {
  id: number
  floor_number: number
  building_id: number
}

interface ClassroomFormProps {
  classroomId?: number
  onSuccess: () => void
  onCancel: () => void
}

export default function ClassroomForm({ classroomId, onSuccess, onCancel }: ClassroomFormProps) {
  const [buildingId, setBuildingId] = useState<number | ''>('')
  const [floorId, setFloorId] = useState<number | ''>('')
  const [buildings, setBuildings] = useState<Building[]>([])
  const [floors, setFloors] = useState<Floor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [roomNumber, setRoomNumber] = useState('')

  useEffect(() => {
    fetchBuildings()
    if (classroomId) {
      fetchClassroom()
    }
  }, [classroomId])

  useEffect(() => {
    if (buildingId) {
      fetchFloors()
    } else {
      setFloors([])
      setFloorId('')
    }
  }, [buildingId])

  const fetchBuildings = async () => {
    try {
      const { data, error } = await supabase
        .from('buildings')
        .select('*')
        .order('name')

      if (error) throw error
      setBuildings(data || [])
    } catch (error: any) {
      setError(error.message)
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
    } catch (error: any) {
      setError(error.message)
    }
  }

  const fetchClassroom = async () => {
    try {
      const { data, error } = await supabase
        .from('classrooms')
        .select(`
          *,
          floor:floors(
            id,
            building_id
          )
        `)
        .eq('id', classroomId)
        .single()

      if (error) throw error
      if (data) {
        setRoomNumber(data.room_number)
        setBuildingId(data.floor.building_id)
        setFloorId(data.floor_id)
      }
    } catch (error: any) {
      setError(error.message)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buildingId || !floorId) {
      setError('Please select both building and floor');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Check if a classroom with the same room_number and floor_id already exists
      const { data: existingClassroom, error: checkError } = await supabase
        .from('classrooms')
        .select('id')
        .eq('room_number', roomNumber)
        .eq('floor_id', floorId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        // Ignore "No rows found" error (code PGRST116)
        throw checkError;
      }

      if (existingClassroom && (!classroomId || existingClassroom.id !== classroomId)) {
        throw new Error('A classroom with this room number already exists on the selected floor. Please use a different room number.');
      }

      if (classroomId) {
        // Update the classroom
        const { error } = await supabase
          .from('classrooms')
          .update({ room_number: roomNumber, floor_id: floorId, building_id: buildingId })
          .eq('id', classroomId);

        if (error) throw error;
        setSuccess('Classroom updated successfully!');
      } else {
        // Insert a new classroom
        const { error } = await supabase
          .from('classrooms')
          .insert([{ room_number: roomNumber, floor_id: floorId, building_id: buildingId }]);

        if (error) throw error;
        setSuccess('Classroom added successfully!');
      }

      // Short delay to show success message before closing
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

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

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <label htmlFor="room_number" className="block text-sm font-medium text-gray-700 mb-1">
          Room Number
        </label>
        <div className="relative rounded-xl">
          <input
            type="text"
            id="room_number"
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            required
            className="block w-full pl-10 pr-4 py-2.5 text-gray-700 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200 bg-white"
            autoComplete="off"
            autoFocus
            placeholder="Enter room number"
          />
          <div className="absolute left-3 top-2.5 text-gray-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <label htmlFor="building" className="block text-sm font-medium text-gray-700 mb-1">
          Building
        </label>
        <div className="relative rounded-xl">
          <select
            id="building"
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value ? Number(e.target.value) : '')}
            required
            className="block w-full pl-10 pr-10 py-2.5 text-gray-700 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200 bg-white appearance-none"
          >
            <option value="" className="text-gray-500">Select a building</option>
            {buildings.map((building) => (
              <option key={building.id} value={building.id} className="text-gray-900">
                {building.name}
              </option>
            ))}
          </select>
          <div className="absolute left-3 top-2.5 text-gray-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
            <svg
              className="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.293l3.71-4.06a.75.75 0 111.08 1.04l-4.25 4.65a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <label htmlFor="floor" className="block text-sm font-medium text-gray-700 mb-1">
          Floor
        </label>
        <div className="relative rounded-xl">
          <select
            id="floor"
            value={floorId}
            onChange={(e) => setFloorId(e.target.value ? Number(e.target.value) : '')}
            required
            disabled={!buildingId}
            className={`block w-full pl-10 pr-10 py-2.5 text-gray-700 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200 appearance-none ${!buildingId ? 'bg-gray-50 text-gray-400' : 'bg-white'}`}
          >
            <option value="" className="text-gray-500">Select a floor</option>
            {floors.map((floor) => (
              <option key={floor.id} value={floor.id} className="text-gray-900">
                Floor {floor.floor_number}
              </option>
            ))}
          </select>
          <div className="absolute left-3 top-2.5 text-gray-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
              />
            </svg>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
            <svg
              className="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.293l3.71-4.06a.75.75 0 111.08 1.04l-4.25 4.65a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="flex justify-end space-x-3 pt-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
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
                {classroomId ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                )}
              </svg>
              {classroomId ? 'Update Classroom' : 'Add Classroom'}
            </>
          )}
        </button>
      </motion.div>
    </motion.form>
  )
}