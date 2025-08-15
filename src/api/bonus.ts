// src/api/bonus.ts
import apiClient from '@/plugins/axios'
import type { YearEndBonusItem } from '@/types/bonus'
import { useAuthStore } from '@/store/authStore'

export function getAllYearEndBonus() {
  const { userCode } = useAuthStore()
  return apiClient.get('/api/getAllYearEndBonus', {
    params: {
      user: userCode
    }
  })
}