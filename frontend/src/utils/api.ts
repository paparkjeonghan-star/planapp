const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'
const LOCAL_STUDENTS_KEY = 'planapp.students'
const LOCAL_TIMETABLES_KEY = 'planapp.timetables'
const LOCAL_SUBJECTS_KEY = 'planapp.subjects'

type LocalStudent = {
  id: string
  name: string
  grade?: string
  notes?: string
  school?: string
  scores?: string
  subjects?: any[]
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function readLocalStudents(): LocalStudent[] {
  if (!canUseLocalStorage()) return []
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_STUDENTS_KEY) || '[]')
  } catch {
    return []
  }
}

function writeLocalStudents(students: LocalStudent[]) {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(LOCAL_STUDENTS_KEY, JSON.stringify(students))
}

function readLocalTimetables(): Record<string, any> {
  if (!canUseLocalStorage()) return {}
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_TIMETABLES_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeLocalTimetables(timetables: Record<string, any>) {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(LOCAL_TIMETABLES_KEY, JSON.stringify(timetables))
}

function localTimetableKey(studentId: string, weekStart: string) {
  return `${studentId}:${weekStart}`
}

function readLocalSubjects(): any[] {
  if (!canUseLocalStorage()) return []
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_SUBJECTS_KEY) || '[]')
  } catch {
    return []
  }
}

function writeLocalSubjects(subjects: any[]) {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(LOCAL_SUBJECTS_KEY, JSON.stringify(subjects))
}

function createLocalId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json()
}

export async function getStudents(){
  try {
    return await fetchJson(`${API_BASE}/api/students`)
  } catch (err) {
    console.warn('Using local students because the API is unavailable.', err)
    return readLocalStudents()
  }
}

export async function getTimetable(studentId:string, weekStart:string){
  try {
    const q = new URL(`${API_BASE}/api/timetables`)
    q.searchParams.set('studentId', studentId)
    q.searchParams.set('weekStart', weekStart)
    return await fetchJson(q.toString())
  } catch (err) {
    console.warn('Using local timetable because the API is unavailable.', err)
    return readLocalTimetables()[localTimetableKey(studentId, weekStart)] || { studentId, weekStart, slots: [] }
  }
}

export async function saveTimetable(payload:any){
  try {
    return await fetchJson(`${API_BASE}/api/timetables`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) })
  } catch (err) {
    console.warn('Saving local timetable because the API is unavailable.', err)
    const timetables = readLocalTimetables()
    timetables[localTimetableKey(payload.studentId, payload.weekStart)] = payload
    writeLocalTimetables(timetables)
    return payload
  }
}

export async function generatePlan(studentId:string, weekStart:string){
  const res = await fetch(`${API_BASE}/api/plans/generate`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ studentId, weekStart }) })
  if (!res.ok) throw new Error('Generate failed')
  return res.json()
}

export async function getSubjects(studentId:string){
  try {
    const q = new URL(`${API_BASE}/api/subjects`)
    q.searchParams.set('studentId', studentId)
    return await fetchJson(q.toString())
  } catch (err) {
    console.warn('Using local subjects because the API is unavailable.', err)
    return readLocalSubjects().filter((subject) => !subject.studentId || subject.studentId === studentId)
  }
}

export async function createSubject(name:string, weeklyTargetHours:number, priority:number, color:string, studentId?:string){
  const payload = { name, weeklyTargetHours, priority, color, studentId: studentId || null }
  try {
    return await fetchJson(`${API_BASE}/api/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  } catch (err) {
    console.warn('Creating a local subject because the API is unavailable.', err)
    const subject = { id: createLocalId(), ...payload }
    writeLocalSubjects([...readLocalSubjects(), subject])
    return subject
  }
}

export async function updateSubject(id:string, patch:any){
  try {
    return await fetchJson(`${API_BASE}/api/subjects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    })
  } catch (err) {
    console.warn('Updating a local subject because the API is unavailable.', err)
    const subjects = readLocalSubjects()
    const updatedSubjects = subjects.map((subject) => (subject.id === id ? { ...subject, ...patch } : subject))
    writeLocalSubjects(updatedSubjects)
    return updatedSubjects.find((subject) => subject.id === id)
  }
}

export async function createStudent(name:string, grade?:string, notes?:string, school?:string, scores?:string){
  const payload = { name, grade, notes, school, scores }
  try {
    return await fetchJson(`${API_BASE}/api/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  } catch (err) {
    console.warn('Creating a local student because the API is unavailable.', err)
    const student = { id: createLocalId(), ...payload, subjects: [] }
    const students = readLocalStudents()
    writeLocalStudents([...students, student])
    return student
  }
}

export async function updateStudent(id:string, patch:any){
  try {
    return await fetchJson(`${API_BASE}/api/students/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    })
  } catch (err) {
    console.warn('Updating a local student because the API is unavailable.', err)
    const students = readLocalStudents()
    const updatedStudents = students.map((student) => (student.id === id ? { ...student, ...patch } : student))
    writeLocalStudents(updatedStudents)
    return updatedStudents.find((student) => student.id === id)
  }
}

export async function updateSession(id:string, patch:any){
  const res = await fetch(`${API_BASE}/api/sessions/${id}`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(patch) })
  if (!res.ok) throw new Error('Update session failed')
  return res.json()
}

export async function getExamSchedule(studentId:string){
  const res = await fetch(`${API_BASE}/api/exams/${studentId}`)
  if (!res.ok) throw new Error('Failed to fetch exam schedule')
  return res.json()
}

export async function saveExamSchedule(studentId:string, schedule:any){
  const res = await fetch(`${API_BASE}/api/exams/${studentId}`, {
    method: 'PUT',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(schedule)
  })
  if (!res.ok) throw new Error('Save exam schedule failed')
  return res.json()
}

export default { getStudents, getTimetable, saveTimetable, generatePlan, getSubjects, createSubject, updateSubject, createStudent, updateStudent, updateSession, getExamSchedule, saveExamSchedule }
