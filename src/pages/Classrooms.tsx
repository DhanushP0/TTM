import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Layout/Navbar'
import ClassroomForm from '../components/Classrooms/ClassroomForm'
import { motion, AnimatePresence } from 'framer-motion'

interface Classroom {
  id: number
  room_number: string
  building: {
    id: number
    name: string
  }
  floor: {
    id: number
    floor_number: number
  }
  created_at: string
}

export default function Classrooms() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formMode, setFormMode] = useState<'closed' | 'add' | 'edit'>('closed')
  const [editingClassroomId, setEditingClassroomId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Classroom | null>(null);

  useEffect(() => {
    fetchClassrooms()

    // Set up real-time subscription
    const subscription = supabase
      .channel('classroom_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classrooms' }, () => {
        fetchClassrooms()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const fetchClassrooms = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('classrooms')
        .select(`
          *,
          building:buildings(id, name),
          floor:floors(id, floor_number)
        `)
        .order('room_number')

      if (error) throw error
      setClassrooms(data || [])
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

  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase
        .from('classrooms')
        .delete()
        .eq('id', id)

      if (error) throw error
      setClassrooms(classrooms.filter(classroom => classroom.id !== id))
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred.');
      }
    }
    
  }

  const handleDeleteClick = (e: React.MouseEvent, item: Classroom) => {
    e.stopPropagation();
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const handleEdit = (id: number) => {
    setEditingClassroomId(id)
    setFormMode('edit')
  }

  const handleFormSuccess = () => {
    setFormMode('closed')
    setEditingClassroomId(null)
    fetchClassrooms()
  }

  // Filter classrooms by search query
  const filteredClassrooms = searchQuery.trim()
    ? classrooms.filter(classroom =>
      classroom.room_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      classroom.building?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      classroom.floor?.floor_number?.toString().includes(searchQuery.toLowerCase())
    )
    : classrooms

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
            <p className="mt-6 text-gray-600 font-medium">Loading classrooms data...</p>
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
              <h1 className="text-3xl font-bold text-gray-900">Classrooms</h1>
              <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium border border-blue-200">
                {classrooms.length} {classrooms.length === 1 ? 'Classroom' : 'Classrooms'}
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
                  placeholder="Search classrooms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full sm:w-64 text-gray-700 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  setEditingClassroomId(null)
                }}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Classroom
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
                    {formMode === 'edit' ? 'Edit Classroom' : 'Add New Classroom'}
                  </h2>
                  <button
                    onClick={() => {
                      setFormMode('closed')
                      setEditingClassroomId(null)
                    }}
                    className="p-1 rounded-full hover:bg-gray-100"
                  >
                    <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <ClassroomForm
                  classroomId={editingClassroomId || undefined}
                  onSuccess={handleFormSuccess}
                  onCancel={() => {
                    setFormMode('closed')
                    setEditingClassroomId(null)
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
                {filteredClassrooms.length > 0 ? (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredClassrooms.map((classroom, index) => (
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
                              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                                <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                              </div>
                              <h3 className="text-lg font-medium text-gray-900">Room {classroom.room_number}</h3>
                            </div>
                            <div className="flex space-x-1">
                              <button
                                onClick={() => handleEdit(classroom.id)}
                                className="p-1.5 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors duration-200"
                                aria-label="Edit classroom"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => handleDeleteClick(e, classroom)}
                                className="p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors duration-200"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v10M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-col space-y-2">
                            <div className="flex items-center text-sm text-gray-600">
                              <svg className="h-5 w-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                              {classroom.building?.name || 'No Building'}
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                              <svg className="h-5 w-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                              </svg>
                              Floor {classroom.floor?.floor_number || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-12 text-center"
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
                        "No classrooms have been added yet. Create your first classroom to get started."}
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <AnimatePresence>
        {showDeleteModal && itemToDelete && (
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
                      Delete Classroom
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Are you sure you want to delete Room {itemToDelete.room_number}? This action cannot be undone.
                    </p>
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
                      await handleDelete(itemToDelete.id);
                      setShowDeleteModal(false);
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Delete Classroom
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