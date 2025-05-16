import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { convertToIST, getCurrentISTTime, getCurrentISTDate, parseISTTime } from '../utils/timeUtils'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Clock, MapPin, User, ArrowUp, ArrowDown, CheckCircle, AlertCircle, RefreshCw, AlertTriangle } from 'lucide-react'

// Types
interface TimetableEntry {
  id: number
  classroom_id: number | null
  start_time: string
  end_time: string
  class_name: string
  teacher_id: number | null
  date: string
  building_id: number | null
  floor_id: number | null
  teacher?: {
    first_name: string
    last_name: string
  }
  classroom?: {
    id: number
    room_number: string
    floor: {
      floor_number: string
      building: {
        name: string
      }
    }
  }
  class_status?: {
    id: number
    status: string
    updated_at: string
  }
}

interface RoomAvailability {
  roomId: number
  roomNumber: string
  buildingName: string
  floorNumber: string
  isAvailable: boolean
  nextClassTime?: string
  currentClass?: TimetableEntry
  nextClass?: TimetableEntry
}

interface BuildingGroup {
  name: string
  floors: {
    [floorNumber: string]: {
      rooms: RoomAvailability[]
    }
  }
}

export default function PublicTimetable() {
  const [entries, setEntries] = useState<TimetableEntry[]>([])
  const [roomAvailability, setRoomAvailability] = useState<RoomAvailability[]>([])
  const [buildingGroups, setBuildingGroups] = useState<BuildingGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(getCurrentISTDate())
  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(new Set())
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set())
  const [filterAvailable, setFilterAvailable] = useState(false)
  const [currentTime, setCurrentTime] = useState(getCurrentISTTime())
  const [lastRefreshed, setLastRefreshed] = useState<string>(new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  }))

  // Update current time every minute and refresh data every 5 minutes
  useEffect(() => {
    const timeInterval = setInterval(() => {
      const newTime = getCurrentISTTime()
      setCurrentTime(newTime)
    }, 60000) // Update time every minute

    const refreshInterval = setInterval(() => {
      fetchTimetable(true)
    }, 300000) // Refresh data every 5 minutes

    return () => {
      clearInterval(timeInterval)
      clearInterval(refreshInterval)
    }
  }, [])

  useEffect(() => {
    fetchTimetable()
    const subscription = supabase
      .channel('timetable_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timetable' }, () => {
        fetchTimetable()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_statuses' }, () => {
        fetchTimetable()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [selectedDate])

  const fetchTimetable = async (isAutoRefresh = false) => {
    try {
      isAutoRefresh ? setRefreshing(true) : setLoading(true)
      // console.log("Fetching data for date:", selectedDate)

      // First fetch all classrooms
      const { data: classrooms, error: classroomsError } = await supabase
        .from('classrooms')
        .select(`
        id,
        room_number,
        floor:floor_id (
          floor_number,
          building:building_id (
            name
          )
        )
      `)
        .order('room_number')

      if (classroomsError) throw classroomsError

      // Then fetch classes for the selected date
      const { data: classes, error: classesError } = await supabase
        .from('timetable')
        .select(`
        *,
        teacher:teacher_id (
          first_name,
          last_name
        ),
        classroom:classroom_id (
          id,
          room_number,
          floor:floor_id (
            floor_number,
            building:building_id (
              name
            )
          )
        ),
        class_status:class_status_id (
          id,
          status,
          updated_at
        )
      `)
        .eq('date', selectedDate)
        .order('start_time', { ascending: true })

      if (classesError) throw classesError

      // console.log(`Found ${classes?.length || 0} classes for date ${selectedDate}`)
      setEntries(classes || [])
      updateRoomAvailability(classrooms || [], classes || [])

      // Update last refreshed time
      setLastRefreshed(new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
      }))
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const updateRoomAvailability = (classrooms: any[], classes: TimetableEntry[]) => {
    const rooms = new Map<number, RoomAvailability>()
    const buildings = new Map<string, BuildingGroup>()

    // First, initialize all rooms
    classrooms.forEach(classroom => {
      const roomId = classroom.id
      const buildingName = classroom.floor.building.name
      const floorNumber = classroom.floor.floor_number

      // Initialize building if not exists
      if (!buildings.has(buildingName)) {
        buildings.set(buildingName, {
          name: buildingName,
          floors: {}
        })
      }

      // Initialize floor if not exists
      const building = buildings.get(buildingName)!
      if (!building.floors[floorNumber]) {
        building.floors[floorNumber] = { rooms: [] }
      }

      // Add room to availability map
      rooms.set(roomId, {
        roomId,
        roomNumber: classroom.room_number,
        buildingName,
        floorNumber,
        isAvailable: true,
        currentClass: undefined,
        nextClass: undefined
      })
    })

    // Get current time in IST
    const currentTimeIST = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false, // Use 24-hour format for comparison
      timeZone: 'Asia/Kolkata'
    })

    // Group classes by classroom
    const classesByRoom = classes.reduce((acc, entry) => {
      if (entry.classroom_id) {
        if (!acc[entry.classroom_id]) {
          acc[entry.classroom_id] = []
        }
        acc[entry.classroom_id].push(entry)
      }
      return acc
    }, {} as Record<number, TimetableEntry[]>)

    // Process each classroom
    Object.entries(classesByRoom).forEach(([roomIdStr, roomClasses]) => {
      const roomId = parseInt(roomIdStr)
      const room = rooms.get(roomId)

      if (room) {
        // Sort classes by start time
        roomClasses.sort((a, b) => a.start_time.localeCompare(b.start_time))

        let foundCurrent = false
        let nextClassAfterCurrent = null

        // Find current and next classes
        for (const entry of roomClasses) {
          const status = entry.class_status?.status?.toLowerCase() || ''

          // Update the logic for determining room availability and status
          if (status === 'cancelled') {
            // Mark the room as available but highlight the canceled class
            room.isAvailable = true;
            room.currentClass = entry; // Keep the canceled class for display purposes
            continue; // Skip marking the room as occupied
          }

          const isAfterStart = entry.start_time <= currentTimeIST
          const isBeforeEnd = currentTimeIST <= entry.end_time

          // Check if this is the current class
          if (isAfterStart && isBeforeEnd) {
            // Only mark room as occupied if the class is not rescheduled/cancelled/ended
            if (status !== 'rescheduled' && status !== 'ended' && status !== 'delayed') {
              foundCurrent = true
              room.isAvailable = false
              room.currentClass = entry
            } else {
              // For rescheduled/cancelled/ended classes, we'll look for the next one
              // but still store this entry for display purposes
              if (!room.currentClass) {
                room.currentClass = entry
              }
            }
          }
          // Find the next class after current time
          else if (currentTimeIST < entry.start_time) {
            if (!nextClassAfterCurrent) {
              nextClassAfterCurrent = entry
              room.nextClass = entry
              room.nextClassTime = entry.start_time
            }
          }
        }

        // If no current class or current class is rescheduled/cancelled, room is available
        if (!foundCurrent) {
          room.isAvailable = true
        }
      }
    })

    // Organize rooms by building and floor
    rooms.forEach(room => {
      const building = buildings.get(room.buildingName)!
      building.floors[room.floorNumber].rooms.push(room)
    })

    // Sort floors and rooms
    buildings.forEach(building => {
      Object.values(building.floors).forEach(floor => {
        floor.rooms.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber))
      })
    })

    setRoomAvailability(Array.from(rooms.values()))
    setBuildingGroups(Array.from(buildings.values()))
  }

  const getStatusDisplay = (entry: TimetableEntry) => {
    // Get current time in IST in HH:MM:SS format
    const currentTimeIST = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata'
    })

    const status = entry.class_status?.status?.toLowerCase() || 'scheduled'

    if (status === 'ongoing' && currentTimeIST > entry.end_time) {
      return 'ended'
    }

    return status
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ongoing':
        return 'text-blue-600'
      case 'ended':
        return 'text-gray-500'
      case 'cancelled':
        return 'text-red-600'
      case 'rescheduled':
        return 'text-red-500'
      case 'delayed':
        return 'text-yellow-600'
      default:
        return 'text-green-600'
    }
  }

  const getStatusBgColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ongoing':
        return 'bg-blue-50'
      case 'ended':
        return 'bg-gray-50'
      case 'cancelled':
        return 'bg-red-50'
      case 'rescheduled':
        return 'bg-red-50'
      case 'delayed':
        return 'bg-yellow-50'
      default:
        return 'bg-green-50'
    }
  }

  const toggleBuilding = (buildingName: string) => {
    setExpandedBuildings(prev => {
      const newExpanded = new Set(prev)
      if (newExpanded.has(buildingName)) {
        newExpanded.delete(buildingName)
      } else {
        newExpanded.add(buildingName)
      }
      return newExpanded
    })
  }

  const toggleFloor = (floorKey: string) => {
    setExpandedFloors(prev => {
      const newExpanded = new Set(prev)
      if (newExpanded.has(floorKey)) {
        newExpanded.delete(floorKey)
      } else {
        newExpanded.add(floorKey)
      }
      return newExpanded
    })
  }

  const filteredBuildingGroups = useMemo(() => {
    if (!filterAvailable) return buildingGroups

    return buildingGroups.map(building => {
      const filteredBuilding = { ...building, floors: { ...building.floors } }

      Object.entries(building.floors).forEach(([floorNumber, floor]) => {
        filteredBuilding.floors[floorNumber] = {
          rooms: floor.rooms.filter(room => room.isAvailable)
        }
      })

      return filteredBuilding
    }).filter(building =>
      Object.values(building.floors).some(floor => floor.rooms.length > 0)
    )
  }, [buildingGroups, filterAvailable])

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }
    return new Date(dateString).toLocaleDateString(undefined, options)
  }

  const manualRefresh = () => {
    fetchTimetable(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 mx-auto">
            <div className="w-full h-full rounded-full border-t-4 border-b-4 border-blue-500 animate-spin"></div>
          </div>
          <p className="text-gray-600 font-medium">Loading timetable data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12 text-center"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Campus Room Timetable
          </h1>
          <p className="text-lg text-gray-600">
            Find available spaces and scheduled classes across campus
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-8 bg-white rounded-2xl shadow-lg p-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="text-blue-600 w-5 h-5" />
              <div className="relative">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="pl-3 pr-10 py-2 border-0 rounded-lg bg-gray-50 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                />
              </div>
              <span className="text-sm font-medium text-gray-700">{formatDate(selectedDate)}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={manualRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                onClick={() => setFilterAvailable(!filterAvailable)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterAvailable
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {filterAvailable ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                {filterAvailable ? 'Showing Available Rooms' : 'Show All Rooms'}
              </button>
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-500 text-right">
            Last updated: {lastRefreshed} IST (auto-refreshes every 5 minutes)
          </div>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded-lg"
          >
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </motion.div>
        )}

        <div className="space-y-6">
          <AnimatePresence>
            {filteredBuildingGroups.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center py-12"
              >
                <p className="text-gray-500 text-lg">
                  {filterAvailable
                    ? "No available rooms match your criteria"
                    : "No buildings or rooms found for the selected date"}
                </p>
              </motion.div>
            )}

            {filteredBuildingGroups.map((building, buildingIndex) => (
              <motion.div
                key={building.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: buildingIndex * 0.1 }}
                className="bg-white rounded-2xl shadow-md overflow-hidden"
              >
                <div
                  className="px-6 py-5 bg-white border-b border-gray-100 flex justify-between items-center cursor-pointer"
                  onClick={() => toggleBuilding(building.name)}
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">{building.name}</h2>
                    <span className="text-sm text-gray-500">
                      {Object.values(building.floors).reduce((acc, floor) => acc + floor.rooms.length, 0)} rooms
                    </span>
                  </div>
                  <div className={`transition-transform duration-300 ${expandedBuildings.has(building.name) ? 'rotate-180' : ''}`}>
                    <ArrowDown className="w-5 h-5 text-gray-500" />
                  </div>
                </div>

                <AnimatePresence>
                  {expandedBuildings.has(building.name) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="divide-y divide-gray-100">
                        {Object.entries(building.floors)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([floorNumber, floor]) => {
                            if (floor.rooms.length === 0) return null;
                            const floorKey = `${building.name}-${floorNumber}`;

                            return (
                              <div key={floorKey} className="px-6 py-4">
                                <div
                                  className="flex items-center justify-between mb-4 cursor-pointer"
                                  onClick={() => toggleFloor(floorKey)}
                                >
                                  <h3 className="text-lg font-medium text-gray-800">Floor {floorNumber}</h3>
                                  <div className={`transition-transform duration-300 ${expandedFloors.has(floorKey) ? 'rotate-180' : ''}`}>
                                    <ArrowDown className="w-4 h-4 text-gray-400" />
                                  </div>
                                </div>

                                <AnimatePresence>
                                  {expandedFloors.has(floorKey) && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.3 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                        {floor.rooms.map((room, roomIndex) => {
                                          // Determine status information for display
                                          const hasCurrentClass = !!room.currentClass;
                                          let statusDisplay = '';
                                          let statusClass = '';

                                          if (hasCurrentClass) {
                                            const currentStatus = getStatusDisplay(room.currentClass!);

                                            if (['cancelled', 'rescheduled', 'delayed', 'ended'].includes(currentStatus)) {
                                              statusDisplay = currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1);
                                              statusClass = getStatusColor(currentStatus);
                                            }
                                          }

                                          return (
                                            <motion.div
                                              key={room.roomId}
                                              initial={{ opacity: 0, scale: 0.95 }}
                                              animate={{ opacity: 1, scale: 1 }}
                                              transition={{ duration: 0.3, delay: roomIndex * 0.05 }}
                                              className={`rounded-xl p-5 border ${room.isAvailable
                                                ? 'border-green-200 bg-green-50/50'
                                                : 'border-gray-200 bg-gray-50/50'
                                                } hover:shadow-md transition-all duration-300`}
                                            >
                                              <div className="flex items-center justify-between mb-3">
                                                <h4 className="text-base font-medium text-gray-900 flex items-center gap-2">
                                                  <div className={`w-2 h-2 rounded-full ${room.isAvailable ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                                  Room {room.roomNumber}
                                                </h4>
                                                <span className={`px-3 py-1 text-xs font-medium rounded-full ${room.isAvailable
                                                  ? 'bg-green-100 text-green-800'
                                                  : 'bg-red-100 text-red-800'
                                                  }`}>
                                                  {room.isAvailable ? 'Available' : 'Occupied'}
                                                </span>
                                              </div>

                                              {statusDisplay && (
                                                <div className={`mb-3 p-2 rounded-lg ${getStatusBgColor(statusDisplay)} flex items-center`}>
                                                  <AlertTriangle className="w-4 h-4 mr-2 text-yellow-500" />
                                                  <span className={`text-sm font-medium ${getStatusColor(statusDisplay)}`}>
                                                    Class {statusDisplay}
                                                  </span>
                                                </div>
                                              )}

                                              {room.currentClass && (
                                                <div className="space-y-3">
                                                  <div className="text-sm font-medium text-gray-900">
                                                    {room.currentClass.class_name}
                                                  </div>
                                                  <div className="flex items-center gap-2 text-sm text-gray-600">
                                                    <Clock className="w-4 h-4 text-gray-500" />
                                                    {convertToIST(room.currentClass.start_time)} - {convertToIST(room.currentClass.end_time)}
                                                  </div>
                                                  <div className="flex items-center gap-2 text-sm text-gray-600">
                                                    <User className="w-4 h-4 text-gray-500" />
                                                    {room.currentClass.teacher ?
                                                      `${room.currentClass.teacher.first_name} ${room.currentClass.teacher.last_name}` :
                                                      'Not assigned'}
                                                  </div>
                                                  <div className="text-sm">
                                                    <span className="text-gray-600">Status: </span>
                                                    <span className={getStatusColor(getStatusDisplay(room.currentClass))}>
                                                      {getStatusDisplay(room.currentClass).charAt(0).toUpperCase() +
                                                        getStatusDisplay(room.currentClass).slice(1)}
                                                    </span>
                                                  </div>

                                                  {/* If current class is cancelled/rescheduled/ended, show next class if available */}
                                                  {(['canceled', 'rescheduled', 'delayed', 'ended'].includes(getStatusDisplay(room.currentClass)) &&
                                                    room.nextClass) && (
                                                      <div className="mt-4 pt-4 border-t border-gray-200">
                                                        <div className="text-sm font-medium text-blue-600 mb-2">Next Class:</div>
                                                        <div className="text-sm font-medium text-gray-900">
                                                          {room.nextClass.class_name}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                                          <Clock className="w-4 h-4 text-gray-500" />
                                                          {convertToIST(room.nextClass.start_time)} - {convertToIST(room.nextClass.end_time)}
                                                        </div>
                                                      </div>
                                                    )}
                                                </div>
                                              )}

                                              {!room.currentClass && room.nextClass && (
                                                <div className="space-y-3">
                                                  <div className="flex items-center gap-2 text-sm text-gray-600">
                                                    <Clock className="w-4 h-4 text-gray-500" />
                                                    <span>Available until <span className="font-medium">{convertToIST(room.nextClass.start_time)}</span></span>
                                                  </div>
                                                  <div className="mt-2 pt-2 border-t border-gray-200">
                                                    <div className="text-sm font-medium text-blue-600 mb-1">Upcoming Class:</div>
                                                    <div className="text-sm font-medium text-gray-900">
                                                      {room.nextClass.class_name}
                                                    </div>
                                                  </div>
                                                </div>
                                              )}

                                              {!room.currentClass && !room.nextClass && (
                                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                                  <Clock className="w-4 h-4 text-gray-500" />
                                                  <span>Available all day</span>
                                                </div>
                                              )}
                                            </motion.div>
                                          )
                                        })}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )
                          })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}