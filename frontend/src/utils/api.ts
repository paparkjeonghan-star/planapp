const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'

export async function getStudents(){
  const res = await fetch(`${API_BASE}/api/students`)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

export async function getTimetable(studentId:string, weekStart:string){
  const q = new URL(`${API_BASE}/api/timetables`)
  q.searchParams.set('studentId', studentId)
  q.searchParams.set('weekStart', weekStart)
  const res = await fetch(q.toString())
  if (!res.ok) throw new Error('No timetable')
  return res.json()
}

export async function saveTimetable(payload:any){
  const res = await fetch(`${API_BASE}/api/timetables`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error('Save failed')
  return res.json()
}

export async function generatePlan(studentId:string, weekStart:string){
  const res = await fetch(`${API_BASE}/api/plans/generate`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ studentId, weekStart }) })
  if (!res.ok) throw new Error('Generate failed')
  return res.json()
}

export async function getSubjects(studentId:string){
  const q = new URL(`${API_BASE}/api/subjects`)
  q.searchParams.set('studentId', studentId)
  const res = await fetch(q.toString())
  if (!res.ok) throw new Error('Failed to fetch subjects')
  return res.json()
}

export async function createSubject(name:string, weeklyTargetHours:number, priority:number, color:string, studentId?:string){
  const res = await fetch(`${API_BASE}/api/subjects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, weeklyTargetHours, priority, color, studentId })
  })
  if (!res.ok) throw new Error('Create subject failed')
  return res.json()
}

export async function updateSubject(id:string, patch:any){
  const res = await fetch(`${API_BASE}/api/subjects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  })
  if (!res.ok) throw new Error('Update subject failed')
  return res.json()
}

export async function createStudent(name:string, grade?:string, notes?:string, school?:string, scores?:string){
  const res = await fetch(`${API_BASE}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, grade, notes, school, scores })
  })
  if (!res.ok) throw new Error('Create student failed')
  return res.json()
}

export async function updateStudent(id:string, patch:any){
  const res = await fetch(`${API_BASE}/api/students/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  })
  if (!res.ok) throw new Error('Update student failed')
  return res.json()
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
