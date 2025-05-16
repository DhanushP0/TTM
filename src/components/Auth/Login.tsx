import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, LogIn } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  interface LoginFormEvent extends React.FormEvent<HTMLFormElement> { }

  const handleLogin = async (e: LoginFormEvent): Promise<void> => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      navigate('/timetable')
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-900">
      {/* Left Side - Image/Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-400 to-blue-500 opacity-90"></div>
        <img
          src="/presentation.svg"
          alt="Presentation"
          className="absolute inset-0 object-cover w-full h-full opacity-20 mix-blend-overlay"
        />
        <div className="relative flex flex-col justify-between z-10 w-full h-full p-12 text-white">
          <div>
            <h1 className="text-3xl font-bold">Schedule Pro</h1>
            <p className="mt-2 text-gray-200">Plan your time efficiently</p>
          </div>

          <div className="max-w-md">
            <h2 className="text-4xl font-bold mb-6">Take control of your schedule</h2>
            <p className="text-xl text-gray-200 mb-8">Our platform helps you organize your time and boost productivity.</p>

            <div className="flex items-center space-x-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-teal-300"></div>
              <span>Smart scheduling algorithms</span>
            </div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-teal-300"></div>
              <span>Calendar synchronization</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-teal-300"></div>
              <span>Time analytics</span>
            </div>
          </div>

          <div className="text-sm">
            © 2025 Schedule Pro. All rights reserved.
          </div>
        </div>
      </div>


      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-8 md:px-16 py-12">
        <div className="w-full max-w-md">
          <div className="mb-12">
            <LogIn className="h-10 w-10 text-teal-500 mb-6" />
            <h2 className="text-3xl font-bold text-white">Sign in</h2>
            <p className="mt-3 text-gray-400">Welcome back! Please enter your details.</p>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-500/50 text-red-200 px-4 py-3 rounded-md mb-6">
              {error}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleLogin}>
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                  Password
                </label>
                <a href="#" className="text-sm font-medium text-teal-500 hover:text-teal-400">
                  Forgot password?
                </a>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                  Sign in
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-gray-900 text-gray-400">Or continue with</span>
              </div>
            </div>
            
            <div className="mt-6 grid grid-cols-3 gap-3">
              <button className="flex justify-center items-center py-2 px-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md">
                <svg className="h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0012.545 2C7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z" />
                </svg>
              </button>
              <button className="flex justify-center items-center py-2 px-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md">
                <svg className="h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.397 20.997v-8.196h2.765l.411-3.209h-3.176V7.548c0-.926.258-1.56 1.587-1.56h1.684V3.127A22.336 22.336 0 0014.201 3c-2.444 0-4.122 1.492-4.122 4.231v2.355H7.332v3.209h2.753v8.202h3.312z" />
                </svg>
              </button>
              <button className="flex justify-center items-center py-2 px-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md">
                <svg className="h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.995 6.686a8.018 8.018 0 01-2.32.636 4.096 4.096 0 001.791-2.235 8.142 8.142 0 01-2.566.978 4.055 4.055 0 00-6.91 3.698 11.517 11.517 0 01-8.363-4.24 4.034 4.034 0 001.258 5.412 4.017 4.017 0 01-1.843-.508v.052a4.07 4.07 0 003.257 3.988 4.072 4.072 0 01-1.07.134 4.01 4.01 0 01-.763-.07 4.084 4.084 0 003.788 2.836 8.15 8.15 0 01-5.032 1.733c-.327 0-.65-.019-.968-.055A11.443 11.443 0 008.175 21c7.237 0 11.195-5.989 11.195-11.18 0-.17-.004-.339-.012-.507a7.974 7.974 0 001.955-2.03l-.317.317z" />
                </svg>
              </button>
            </div>
          </div> */}

          <p className="mt-8 text-center text-sm text-gray-400">
            Don't have an account?{' '}
            <a href="/signup" className="font-medium text-teal-500 hover:text-teal-400">
              Create account
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}