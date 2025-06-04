"use client"

import { useState } from "react"
import LoginForm from "./login-form"
import RegisterForm from "./register-form"

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)

  const toggleForm = () => {
    setIsLogin(!isLogin)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black dark:bg-black p-4">
      <div className="w-full max-w-md">
        {isLogin ? <LoginForm onToggleForm={toggleForm} /> : <RegisterForm onToggleForm={toggleForm} />}
      </div>
    </div>
  )
}

