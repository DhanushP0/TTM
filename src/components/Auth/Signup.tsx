import { useState, useEffect } from 'react' // Use React's built-in useEffect
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, UserPlus } from 'lucide-react'

export default function Signup() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    departmentId: '',
    roleId: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([])
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([])

  useEffect(() => {
    const fetchRolesAndDepartments = async () => {
      const [{ data: departmentsData, error: deptError }, { data: rolesData, error: rolesError }] = await Promise.all([
        supabase.from('departments').select('id, name'),
        supabase.from('roles').select('id, name'),
      ])

      if (departmentsData) setDepartments(departmentsData)
      if (rolesData) setRoles(rolesData)

      if (deptError || rolesError) {
        console.error('Failed to fetch:', deptError || rolesError)
      }
    }

    fetchRolesAndDepartments()
  }, [])


  useEffect(() => {
    const fetchDepartments = async () => {
      const { data, error } = await supabase.from('departments').select('id, name')
      if (!error && data) {
        setDepartments(data)
      } else {
        console.error('Failed to fetch departments:', error?.message)
      }
    }

    fetchDepartments()
  }, [])

  interface FormData {
    email: string
    password: string
    firstName: string
    lastName: string
    phoneNumber: string
    departmentId: string
    roleId: string
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev: FormData) => ({
      ...prev,
      [name]: value
    }))
  }

  interface InsertResponse {
    error: { message: string } | null
  }

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Sign up the user and send a confirmation email
      const { error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (signUpError) throw signUpError;

      // Then, create the teacher record
      const { error: teacherError }: InsertResponse = await supabase
        .from('teachers')
        .insert([
          {
            first_name: formData.firstName,
            last_name: formData.lastName,
            email: formData.email,
            phone_number: formData.phoneNumber || null,
            department_id: formData.departmentId ? parseInt(formData.departmentId) : null,
            role_id: formData.roleId ? parseInt(formData.roleId) : null,
          },
        ]);

      if (teacherError) throw teacherError;

      // Redirect to the confirmation email page
      navigate('/confirm-email');
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
    <div className="flex min-h-screen bg-gray-900">
      {/* Left Side - Image/Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-400 to-blue-500 opacity-90"></div>
        <img
          src="/studying.svg"
          alt="Studying"
          className="absolute inset-0 object-cover w-full h-full opacity-20 mix-blend-overlay"
        />
        <div className="relative flex flex-col justify-between z-10 w-full h-full p-12 text-white">
          <div>
            <h1 className="text-3xl font-bold">Schedule Pro</h1>
            <p className="mt-2 text-gray-200">Plan your time efficiently</p>
          </div>

          <div className="max-w-md">
            <h2 className="text-4xl font-bold mb-6">Join our community today</h2>
            <p className="text-xl text-gray-200 mb-8">Create an account to start organizing your schedule like a pro.</p>

            <div className="flex items-center space-x-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-teal-300"></div>
              <span>Personalized schedules</span>
            </div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-teal-300"></div>
              <span>Department collaboration</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-teal-300"></div>
              <span>Seamless onboarding</span>
            </div>
          </div>

          <div className="text-sm">
            © 2025 Schedule Pro. All rights reserved.
          </div>
        </div>
      </div>

      {/* Right Side - Signup Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-8 md:px-16 py-12">
        <div className="w-full max-w-md">
          <div className="mb-12">
            <UserPlus className="h-10 w-10 text-teal-500 mb-6" />
            <h2 className="text-3xl font-bold text-white">Create account</h2>
            <p className="mt-3 text-gray-400">Join Schedule Pro to manage your time effectively.</p>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-500/50 text-red-200 px-4 py-3 rounded-md mb-6">
              {error}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSignup}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-300 mb-2">
                  First Name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Enter your first name"
                  value={formData.firstName}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-300 mb-2">
                  Last Name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Enter your last name"
                  value={formData.lastName}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-300 mb-2">
                Phone Number (optional)
              </label>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Enter your phone number"
                value={formData.phoneNumber}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="roleId" className="block text-sm font-medium text-gray-300 mb-2">
                Role
              </label>
              <select
                id="roleId"
                name="roleId"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                value={formData.roleId}
                onChange={handleChange}
                required
              >
                <option value="">Select a role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>


            <div>
              <label htmlFor="departmentId" className="block text-sm font-medium text-gray-300 mb-2">
                Department
              </label>
              <select
                id="departmentId"
                name="departmentId"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                value={formData.departmentId}
                onChange={handleChange}
              >
                <option value="">Select a department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center px-4 py-3 bg-teal-500 text-white font-medium rounded-md hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors duration-200"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <>
                  Create account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-400">
            Already have an account?{' '}
            <a href="/login" className="font-medium text-teal-500 hover:text-teal-400">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}