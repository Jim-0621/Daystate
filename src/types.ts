export type Score = 1 | 2 | 3 | 4 | 5

export interface User {
  id: string
  username: string
}

export interface MoodEntry {
  date: string
  mood: Score
  fatigue: Score
  note: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface EntryInput {
  mood: Score
  fatigue: Score
  note: string
  tags: string[]
}

export type Page = 'record' | 'calendar' | 'trends' | 'settings'
