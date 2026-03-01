import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authAPI } from '../api'

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      firm: null,
      isAuthenticated: false,

      login: async (credentials) => {
        const { data } = await authAPI.login(credentials)
        localStorage.setItem('token', data.token)
        set({
          user: data.user,
          token: data.token,
          firm: data.firm,
          isAuthenticated: true,
        })
        return data
      },

      logout: () => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        set({ user: null, token: null, firm: null, isAuthenticated: false })
        window.location.href = '/login'
      },

      updateUser: (user) => set({ user }),
      updateFirm: (firm) => set({ firm }),

      checkAuth: async () => {
        const token = localStorage.getItem('token')
        if (!token) return false
        try {
          const { data } = await authAPI.getProfile()
          set({ user: data.user, firm: data.firm, isAuthenticated: true })
          return true
        } catch {
          get().logout()
          return false
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        firm: state.firm,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

export default useAuthStore
