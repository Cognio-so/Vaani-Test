import { useState, useContext } from "react"
import { useAuth } from "../context/AuthContext"
import { Link } from "react-router-dom"
import { HiMail, HiUser } from "react-icons/hi"
import { RiLockPasswordLine } from "react-icons/ri"
import { FcGoogle } from "react-icons/fc"
import ThreeScene from '../components/ThreeScene'
import { ThemeContext } from '../App'

export default function SignupPage() {
  const { signup, signInWithGoogle } = useAuth()
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    acceptTerms: false,
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { theme } = useContext(ThemeContext)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    if (!formData.acceptTerms) {
      setError("Please accept the terms and conditions")
      setLoading(false)
      return
    }

    try {
      await signup(formData.name, formData.email, formData.password)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className={`flex h-screen ${theme === 'dark' ? 'bg-[#0a0a0a]' : 'bg-white'}`}>
      {/* Left Section - 3D Visual with Logo Overlay */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <ThreeScene />
        
        {/* Logo Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <img src="/vannipro.png" alt="Vaani.pro Logo" className="w-44 h-30" />
          <h1 className="text-[#cc2b5e] text-2xl font-bold mt-2">Vaani.pro</h1>
        </div>
      </div>

      {/* Right Section - Signup Form */}
      <div className={`w-full lg:w-1/2 ${theme === 'dark' ? 'bg-[#0a0a0a]' : 'bg-gray-50'} flex items-center justify-center px-4 py-6 lg:px-8`}>
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-[#cc2b5e] to-[#753a88]">
              Create Account
            </h2>
            <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-xs mt-1`}>Join our AI-powered platform</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="text-red-500 text-xs text-center">{error}</div>}
            
            {/* Name Input */}
            <div className="space-y-1">
              <label htmlFor="name" className={`block text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <HiUser className="h-4 w-4 text-[#cc2b5e]" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-3 py-2 border ${theme === 'dark' ? 'border-gray-700 bg-black/30 text-white focus:ring-[#cc2b5e] shadow-[0_0_15px_rgba(204,43,94,0.1)] hover:shadow-[0_0_25px_rgba(204,43,94,0.5)]' : 'border-gray-300 bg-white text-gray-900 focus:ring-[#cc2b5e] shadow-md hover:shadow-lg'} rounded-lg focus:outline-none focus:ring-2 transition-all duration-300`}
                  placeholder="Enter your name"
                />
              </div>
            </div>

            {/* Email Input */}
            <div className="space-y-1">
              <label htmlFor="email" className={`block text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <HiMail className="h-4 w-4 text-[#cc2b5e]" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-3 py-2 border ${theme === 'dark' ? 'border-gray-700 bg-black/30 text-white focus:ring-[#cc2b5e] shadow-[0_0_15px_rgba(204,43,94,0.1)] hover:shadow-[0_0_25px_rgba(204,43,94,0.5)]' : 'border-gray-300 bg-white text-gray-900 focus:ring-[#cc2b5e] shadow-md hover:shadow-lg'} rounded-lg focus:outline-none focus:ring-2 transition-all duration-300`}
                  placeholder="Enter your email"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1">
              <label htmlFor="password" className={`block text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <RiLockPasswordLine className="h-4 w-4 text-[#cc2b5e]" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-3 py-2 border ${theme === 'dark' ? 'border-gray-700 bg-black/30 text-white focus:ring-[#cc2b5e] shadow-[0_0_15px_rgba(204,43,94,0.1)] hover:shadow-[0_0_25px_rgba(204,43,94,0.5)]' : 'border-gray-300 bg-white text-gray-900 focus:ring-[#cc2b5e] shadow-md hover:shadow-lg'} rounded-lg focus:outline-none focus:ring-2 transition-all duration-300`}
                  placeholder="Create a password"
                />
              </div>
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-center">
              <input
                id="terms"
                name="acceptTerms"
                type="checkbox"
                checked={formData.acceptTerms}
                onChange={handleChange}
                className={`h-4 w-4 rounded border ${theme === 'dark' ? 'border-gray-700 bg-black/30' : 'border-gray-300 bg-white'} text-[#cc2b5e] 
                  focus:ring-2 focus:ring-[#cc2b5e] focus:ring-offset-0`}
              />
              <label htmlFor="terms" className={`ml-2 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                I agree to the{" "}
                <Link className="text-[#cc2b5e] hover:text-[#753a88]">Terms</Link>{" "}
                and{" "}
                <Link className="text-[#cc2b5e] hover:text-[#753a88]">Privacy Policy</Link>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-gradient-to-r from-[#cc2b5e] to-[#753a88] text-white text-sm rounded-lg 
                hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#cc2b5e] 
                disabled:opacity-50 transition-all duration-200 transform hover:translate-y-[-1px]"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className={`w-full border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-300'}`}></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className={`px-2 ${theme === 'dark' ? 'bg-[#0a0a0a] text-gray-400' : 'bg-gray-50 text-gray-500'}`}>Or continue with</span>
              </div>
            </div>

            {/* Google Sign In */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className={`w-full py-2 px-4 ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white' : 'bg-white hover:bg-gray-50 border-gray-300 text-gray-700'} border rounded-lg 
                text-sm transition-all duration-200 flex items-center justify-center gap-2
                focus:outline-none focus:ring-2 focus:ring-[#cc2b5e]`}
            >
              <FcGoogle className="w-4 h-4" />
              Sign up with Google
            </button>

            {/* Sign In Link */}
            <p className={`text-center text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-[#cc2b5e] hover:text-[#753a88] transition-colors duration-200">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

