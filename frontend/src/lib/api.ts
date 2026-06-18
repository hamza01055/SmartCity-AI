import axios from 'axios'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333'

export const api = axios.create({ baseURL: API_URL })

export type Report = {
  id: number
  reporterName: string | null
  reporterContact?: string | null
  description: string
  imagePath: string
  category: 'Pothole' | 'Garbage' | 'Broken Streetlight' | null
  confidence: number | null
  bbox: { x: number; y: number; w: number; h: number } | null
  mlMode: 'mock' | 'real' | null
  status: 'pending' | 'reviewed' | 'assigned' | 'in_progress' | 'resolved'
  priority: 'low' | 'medium' | 'high'
  assignedWorker: string | null
  assignedDepartment: string | null
  workerNotes: string | null
  latitude: number
  longitude: number
  createdAt: string
  updatedAt: string
}

export const categoryColor: Record<string, string> = {
  Pothole:            '#f87171',
  Garbage:            '#fb923c',
  'Broken Streetlight': '#fbbf24',
}

export const statusColor: Record<string, string> = {
  pending:     '#fbbf24',
  reviewed:    '#38bdf8',
  assigned:    '#818cf8',
  in_progress: '#34d399',
  resolved:    '#10b981',
}

export const priorityColor: Record<string, string> = {
  low:    '#94a3b8',
  medium: '#fbbf24',
  high:   '#f87171',
}

export type AnalyticsData = {
  totals: {
    total: string; pending: string; reviewed: string
    assigned: string; resolved: string
  }
  trend: { day: string; count: string }[]
  byCategory: { category: string; count: string; avg_confidence: string | null }[]
  workerStats: { name: string; active: string; completed: string }[]
  avgResolutionHours: number | null
}
