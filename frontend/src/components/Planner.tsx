import React, { useEffect, useRef, useState } from 'react'
import StudyPlan from './StudyPlan'
import { SlotType } from './Slot'
import { v4 as uuidv4 } from 'uuid'
import api from '../utils/api'

const days = ['월', '화', '수', '목', '금', '토', '일']
const subjectCategories = ['수학', '영어', '국어', '과학', '사회', '기타']
const studyTypes = ['개념공부', '문제풀이', '고난도/서술형']
const rowHeight = 24
const timelineStartHour = 10
const timelineEndHour = 24
const timelineBase = timelineStartHour * 60
const timeLabels = Array.from({ length: (timelineEndHour - timelineStartHour) * 2 }, (_, i) => timelineBase + i * 30)

function parseHM(hm: string) {
  if (!hm) return 0
  const [hh = 0, mm = 0] = hm.split(':').map(Number)
  return hh * 60 + mm
}

function formatHM(minutes: number) {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, minutes))
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`
}

function rangesOverlap(startA: string, endA: string, startB: string, endB: string) {
  return parseHM(startA) < parseHM(endB) && parseHM(startB) < parseHM(endA)
}

function categorizeSubjectLabel(label: string) {
  const normalized = label.trim().toLowerCase()
  if (/수학|math/.test(normalized)) return '수학'
  if (/영어|english/.test(normalized)) return '영어'
  if (/국어|korean/.test(normalized)) return '국어'
  if (/과학|science/.test(normalized)) return '과학'
  if (/사회|social/.test(normalized)) return '사회'
  return label.trim() || '기타'
}

function parseScores(raw?: string) {
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

type OcrLine = {
  text: string
  bbox?: { x0: number; y0: number; x1: number; y1: number }
}

type ImportedSlotDraft = SlotType & {
  importedText: string
}

function cleanOcrText(text: string) {
  return text
    .replace(/[|ㅣ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function minutesToHM(minutes: number) {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, minutes))
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`
}

function roundToHalfHour(minutes: number) {
  return Math.round(minutes / 30) * 30
}

function parseOcrTime(value: string) {
  const match = value.match(/(\d{1,2})\D?([0-5]\d)?/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = match[2] ? Number(match[2]) : 0
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return hour * 60 + minute
}

function findOcrTimeRange(text: string) {
  const normalized = text.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
  const match = normalized.match(/(\d{1,2}[:.]?\s*[0-5]?\d?)\s*[~-]\s*(\d{1,2}[:.]?\s*[0-5]?\d?)/)
  if (!match) return null
  const start = parseOcrTime(match[1])
  const end = parseOcrTime(match[2])
  if (start === null || end === null || end <= start) return null
  return { start, end }
}

function inferDayFromX(x: number, width: number) {
  const leftTimeColumn = width * 0.105
  const usableWidth = Math.max(1, width - leftTimeColumn)
  return Math.max(0, Math.min(6, Math.floor(((x - leftTimeColumn) / usableWidth) * 7)))
}

function inferMinutesFromY(y: number, height: number) {
  const gridTop = height * 0.055
  const gridBottom = height * 0.99
  const ratio = Math.max(0, Math.min(1, (y - gridTop) / Math.max(1, gridBottom - gridTop)))
  return roundToHalfHour(6 * 60 + ratio * 18 * 60)
}

function isNoiseOcrLine(text: string) {
  if (!text || text.length < 2) return true
  if (/^(시간|요일|월요일|화요일|수요일|목요일|금요일|토요일|일요일)$/i.test(text)) return true
  if (/^\d{1,2}[:.]\d{2}\s*[-~]\s*\d{1,2}[:.]\d{2}$/.test(text)) return true
  if (/^[□☐✓✔]+$/.test(text)) return true
  return false
}

function extractOcrLines(data: any): OcrLine[] {
  const lines = Array.isArray(data?.lines) ? data.lines : []
  if (lines.length > 0) {
    return lines
      .map((line: any) => ({ text: cleanOcrText(line.text || ''), bbox: line.bbox }))
      .filter((line: OcrLine) => !isNoiseOcrLine(line.text))
  }

  const blockLines = Array.isArray(data?.blocks)
    ? data.blocks.flatMap((block: any) =>
        (block.paragraphs || []).flatMap((paragraph: any) =>
          (paragraph.lines || []).map((line: any) => ({ text: cleanOcrText(line.text || ''), bbox: line.bbox }))
        )
      )
    : []
  if (blockLines.length > 0) {
    return blockLines.filter((line: OcrLine) => !isNoiseOcrLine(line.text))
  }

  return String(data?.text || '')
    .split('\n')
    .map((text) => ({ text: cleanOcrText(text) }))
    .filter((line) => !isNoiseOcrLine(line.text))
}

function buildImportedSlots(lines: OcrLine[], imageWidth: number, imageHeight: number, targetWeekStart: string): ImportedSlotDraft[] {
  const drafts = lines
    .map((line) => {
      const bbox = line.bbox
      const range = findOcrTimeRange(line.text)
      const centerX = bbox ? (bbox.x0 + bbox.x1) / 2 : imageWidth / 2
      const day = bbox ? inferDayFromX(centerX, imageWidth) : 0
      const startMinutes = range?.start ?? (bbox ? inferMinutesFromY(bbox.y0, imageHeight) : 18 * 60)
      const endMinutes = range?.end ?? (bbox ? Math.max(startMinutes + 30, inferMinutesFromY(bbox.y1, imageHeight)) : startMinutes + 60)
      const note = line.text.replace(/\[?\d{1,2}[:.]?\s*[0-5]?\d?\s*[~-]\s*\d{1,2}[:.]?\s*[0-5]?\d?\]?/g, '').trim() || line.text

      return {
        id: uuidv4(),
        day,
        start: minutesToHM(startMinutes),
        end: minutesToHM(endMinutes),
        category: categorizeSubjectLabel(note),
        studyType: 'Image import',
        note,
        completed: false,
        weekStart: targetWeekStart,
        importedText: line.text
      }
    })
    .filter((slot) => parseHM(slot.end) > parseHM(slot.start))
    .sort((a, b) => a.day - b.day || parseHM(a.start) - parseHM(b.start))

  const merged: ImportedSlotDraft[] = []
  for (const draft of drafts) {
    const previous = merged[merged.length - 1]
    const shouldMerge =
      previous &&
      previous.day === draft.day &&
      parseHM(draft.start) <= parseHM(previous.end) + 30 &&
      !findOcrTimeRange(previous.importedText) &&
      !findOcrTimeRange(draft.importedText)

    if (shouldMerge) {
      previous.end = parseHM(draft.end) > parseHM(previous.end) ? draft.end : previous.end
      previous.note = `${previous.note}\n${draft.note}`
      previous.importedText = `${previous.importedText}\n${draft.importedText}`
      previous.category = categorizeSubjectLabel(previous.note)
    } else {
      merged.push(draft)
    }
  }

  return merged
}

function readImageSize(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image load failed'))
    }
    image.src = url
  })
}

function shiftDateString(dateString: string, dayOffset: number) {
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  date.setDate(date.getDate() + dayOffset)
  return date.toISOString().slice(0, 10)
}

export default function Planner({ onPlanGenerated }: { onPlanGenerated?: (arg: any) => void }) {
  const [slots, setSlots] = useState<SlotType[]>([])
  const [editing, setEditing] = useState<SlotType | null>(null)
  const [studentId, setStudentId] = useState('')
  const [students, setStudents] = useState<any[]>([])
  const [newStudentName, setNewStudentName] = useState('')
  const [newStudentSchool, setNewStudentSchool] = useState('')
  const [newStudentGrade, setNewStudentGrade] = useState('')
  const [newStudentNotes, setNewStudentNotes] = useState('')
  const [studentDraft, setStudentDraft] = useState({ name: '', school: '', grade: '', notes: '', scores: {} as Record<string, string> })
  const [weekStart, setWeekStart] = useState('')
  const [sessions, setSessions] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [subjectsMap, setSubjectsMap] = useState<Record<string, any>>({})
  const [newSubject, setNewSubject] = useState({ name: '', weeklyTargetHours: 2, priority: 1, color: '#60a5fa' })
  const [newSlot, setNewSlot] = useState({
    days: [0],
    start: '18:00',
    end: '19:00',
    category: '수학',
    studyType: '개념공부',
    subject: '',
    note: ''
  })
  const [activeTab, setActiveTab] = useState<'planner' | 'plan'>('planner')
  const [imageImportStatus, setImageImportStatus] = useState('')
  const [imageImportBusy, setImageImportBusy] = useState(false)
  const [imageImportCount, setImageImportCount] = useState(0)
  const saveTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const timetableSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragRef = useRef<any>(null)

  const selectedStudent = students.find((student) => student.id === studentId)

  function buildSubjectMap(list: any[]) {
    const map: Record<string, any> = {}
    list.forEach((subject: any) => {
      map[subject.id] = subject
    })
    return map
  }

  function setSubjectList(next: any[]) {
    setSubjects(next)
    setSubjectsMap(buildSubjectMap(next))
  }

  function getSlotCategory(slot: SlotType) {
    const subjectName = subjectsMap[slot.subject || '']?.name || slot.subject || slot.note || ''
    return slot.category || categorizeSubjectLabel(subjectName)
  }

  function mapServerSlots(timetable: any, targetWeekStart: string) {
    return (timetable.slots || []).map((slot: any) => ({
      id: slot.id,
      day: slot.dayOfWeek,
      start: slot.startTime,
      end: slot.endTime,
      category: slot.category || undefined,
      studyType: slot.studyType || '개념공부',
      subject: slot.subjectId,
      note: slot.notes || '',
      completed: Boolean(slot.completed),
      weekStart: targetWeekStart
    }))
  }

  async function loadTimetable() {
    if (!studentId || !weekStart) {
      alert('학생과 주차 시작일을 먼저 선택해주세요.')
      return
    }

    try {
      const timetable = await api.getTimetable(studentId, weekStart)
      setSlots(mapServerSlots(timetable, weekStart))
      alert('불러오기가 완료되었습니다.')
    } catch (err) {
      console.error(err)
      alert('불러오기에 실패했습니다.')
    }
  }

  async function loadWeekTimetable() {
    if (!studentId || !weekStart) {
      setSlots([])
      setSessions([])
      return
    }

    try {
      const timetable = await api.getTimetable(studentId, weekStart)
      setSlots(mapServerSlots(timetable, weekStart))
      setSessions([])
    } catch (err) {
      console.error('Failed to load weekly timetable', err)
      setSlots([])
      setSessions([])
    }
  }

  async function importPreviousWeekTimetable() {
    if (!studentId || !weekStart) {
      alert('Select a student and week start before importing last week.')
      return
    }

    const previousWeekStart = shiftDateString(weekStart, -7)
    if (!previousWeekStart) {
      alert('Invalid week start date.')
      return
    }

    try {
      const timetable = await api.getTimetable(studentId, previousWeekStart)
      const copiedSlots = mapServerSlots(timetable, weekStart).map((slot: SlotType) => ({
        ...slot,
        id: uuidv4(),
        completed: false,
        weekStart
      }))

      if (copiedSlots.length === 0) {
        alert('No blocks found from last week.')
        return
      }

      setSlots(copiedSlots)
      setSessions([])
      await saveTimetable(copiedSlots)
      alert(`Imported ${copiedSlots.length} blocks from last week.`)
    } catch (err) {
      console.error(err)
      alert('Failed to import last week.')
    }
  }

  async function saveTimetable(slotsToSave: SlotType[]) {
    if (!studentId || !weekStart) return
    await api.saveTimetable({
      studentId,
      weekStart,
      slots: slotsToSave.map((slot) => ({
        dayOfWeek: slot.day,
        startTime: slot.start,
        endTime: slot.end,
        type: 'study',
        subjectId: slot.subject || null,
        category: slot.category || null,
        studyType: slot.studyType || '개념공부',
        notes: slot.note || null,
        completed: Boolean(slot.completed)
      }))
    })
  }

  useEffect(() => {
    async function loadStudents() {
      try {
        const list = await api.getStudents()
        setStudents(list)
        if (list.length > 0) setStudentId((current) => current || list[0].id)
      } catch (err) {
        console.error('Failed to load students', err)
      }
    }

    loadStudents()
  }, [])

  useEffect(() => {
    if (!selectedStudent) {
      setStudentDraft({ name: '', school: '', grade: '', notes: '', scores: {} })
      return
    }

    setStudentDraft({
      name: selectedStudent.name || '',
      school: selectedStudent.school || '',
      grade: selectedStudent.grade || '',
      notes: selectedStudent.notes || '',
      scores: parseScores(selectedStudent.scores)
    })
  }, [selectedStudent?.id])

  useEffect(() => {
    async function loadSubjects() {
      if (!studentId) return
      try {
        const list = await api.getSubjects(studentId)
        setSubjectList(list)
      } catch (err) {
        console.error('Failed to load subjects', err)
      }
    }

    loadSubjects()
  }, [studentId])

  useEffect(() => {
    loadWeekTimetable()
  }, [studentId, weekStart])

  useEffect(() => {
    return () => {
      Object.values(saveTimerRef.current).forEach((timer) => clearTimeout(timer))
      if (timetableSaveTimerRef.current) clearTimeout(timetableSaveTimerRef.current)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  async function createStudent() {
    if (!newStudentName.trim()) {
      alert('학생 이름을 입력해주세요.')
      return
    }

    try {
      const created = await api.createStudent(newStudentName.trim(), newStudentGrade.trim(), newStudentNotes.trim(), newStudentSchool.trim(), JSON.stringify({}))
      setStudents((prev) => [...prev, created])
      setStudentId(created.id)
      setNewStudentName('')
      setNewStudentSchool('')
      setNewStudentGrade('')
      setNewStudentNotes('')
    } catch (err) {
      console.error(err)
      alert('학생 생성에 실패했습니다.')
    }
  }

  async function saveStudentInfo() {
    if (!studentId) return

    try {
      const saved = await api.updateStudent(studentId, {
        name: studentDraft.name.trim(),
        school: studentDraft.school.trim(),
        grade: studentDraft.grade.trim(),
        notes: studentDraft.notes.trim(),
        scores: JSON.stringify(studentDraft.scores)
      })
      setStudents((prev) => prev.map((student) => (student.id === studentId ? { ...student, ...saved } : student)))
      alert('학생 정보가 저장되었습니다.')
    } catch (err) {
      console.error(err)
      alert('학생 정보 저장에 실패했습니다.')
    }
  }

  async function createSubject() {
    if (!newSubject.name.trim()) {
      alert('과목명을 입력해주세요.')
      return
    }

    try {
      const created = await api.createSubject(
        newSubject.name.trim(),
        newSubject.weeklyTargetHours,
        newSubject.priority,
        newSubject.color,
        studentId
      )
      setSubjectList([...subjects, created])
      setNewSubject({ name: '', weeklyTargetHours: 2, priority: 1, color: '#60a5fa' })
    } catch (err) {
      console.error(err)
      alert('과목 생성에 실패했습니다.')
    }
  }

  async function updateSubjectColor(subjectId: string, color: string) {
    const previous = subjects
    const next = subjects.map((subject) => (subject.id === subjectId ? { ...subject, color } : subject))
    setSubjectList(next)

    try {
      const saved = await api.updateSubject(subjectId, { color })
      setSubjectList(next.map((subject) => (subject.id === subjectId ? saved : subject)))
    } catch (err) {
      console.error(err)
      setSubjectList(previous)
      alert('과목 색상 저장에 실패했습니다.')
    }
  }

  async function generatePlan() {
    if (!studentId || !weekStart) {
      alert('학생과 주차 시작일을 먼저 선택해주세요.')
      return
    }

    try {
      const result = await api.generatePlan(studentId, weekStart)
      const loadedSessions = result.plan?.sessions || result.createdSessions || []
      setSessions(loadedSessions)
      const list = await api.getSubjects(studentId)
      const map = buildSubjectMap(list)
      setSubjectList(list)
      onPlanGenerated?.({ plan: result.plan, sessions: loadedSessions, subjectsMap: map })
      alert('자동 생성이 완료되었습니다.')
    } catch (err) {
      console.error(err)
      alert('자동 생성에 실패했습니다.')
    }
  }

  function scheduleSaveSession(id: string, patch: any) {
    if (saveTimerRef.current[id]) clearTimeout(saveTimerRef.current[id])
    saveTimerRef.current[id] = setTimeout(async () => {
      try {
        await api.updateSession(id, patch)
      } catch (err) {
        console.error('Save session failed', err)
      }
    }, 400)
  }

  function scheduleTimetableSave(slotsToSave: SlotType[]) {
    if (timetableSaveTimerRef.current) clearTimeout(timetableSaveTimerRef.current)
    timetableSaveTimerRef.current = setTimeout(() => {
      saveTimetable(slotsToSave).catch((err) => console.error('Auto-save failed', err))
    }, 250)
  }

  function onSessionMouseDown(e: React.MouseEvent, session: any, mode: 'move' | 'resize') {
    e.stopPropagation()
    e.preventDefault()
    dragRef.current = {
      id: session.id,
      mode,
      startY: e.clientY,
      startMin: parseHM(session.startTime || '00:00'),
      duration: session.durationMinutes || 30
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  function onMouseMove(e: MouseEvent) {
    if (!dragRef.current) return
    const drag = dragRef.current
    const deltaMins = Math.round((e.clientY - drag.startY) / rowHeight) * 30

    if (drag.mode === 'move') {
      setSessions((prev) => prev.map((s) => (s.id === drag.id ? { ...s, startTime: formatHM(drag.startMin + deltaMins) } : s)))
    } else {
      setSessions((prev) => prev.map((s) => (s.id === drag.id ? { ...s, durationMinutes: Math.max(5, drag.duration + deltaMins) } : s)))
    }
  }

  function onMouseUp() {
    if (!dragRef.current) return
    const drag = dragRef.current
    const updated = sessions.find((session: any) => session.id === drag.id)
    if (updated) scheduleSaveSession(drag.id, { startTime: updated.startTime, durationMinutes: updated.durationMinutes })
    dragRef.current = null
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  function snapToStep(value: string) {
    const [hour = '00', minute = '00'] = value.split(':')
    const candidates = [0, 30, 50]
    const current = Number(minute)
    const snapped = candidates.reduce((best, candidate) =>
      Math.abs(candidate - current) < Math.abs(best - current) ? candidate : best
    )
    return `${hour.padStart(2, '0')}:${String(snapped).padStart(2, '0')}`
  }

  function addSelectedSlots() {
    if (!studentId || !weekStart) {
      alert('학생과 주차를 먼저 선택해주세요.')
      return
    }
    if (newSlot.days.length === 0) {
      alert('요일을 하나 이상 선택해주세요.')
      return
    }

    const start = snapToStep(newSlot.start)
    const end = snapToStep(newSlot.end)
    if (parseHM(end) <= parseHM(start)) {
      alert('종료시간은 시작시간보다 늦어야 합니다.')
      return
    }

    const selectedDays = Array.from(new Set(newSlot.days))
    const overlapDays = selectedDays.filter((day) =>
      slots.some((slot) => slot.day === day && (!slot.weekStart || slot.weekStart === weekStart) && rangesOverlap(start, end, slot.start, slot.end))
    )
    if (overlapDays.length > 0) {
      alert(`이미 등록된 블록과 시간이 겹칩니다: ${overlapDays.map((day) => days[day]).join(', ')}`)
      return
    }

    const nextSlots = selectedDays.map((day) => ({
      id: uuidv4(),
      day,
      start,
      end,
      category: newSlot.category,
      studyType: newSlot.studyType,
      subject: newSlot.subject || undefined,
      note: newSlot.note || undefined,
      completed: false,
      weekStart
    }))
    const next = [...slots, ...nextSlots]
    setSlots(next)
    setNewSlot({ ...newSlot, start: '18:00', end: '19:00', subject: '', note: '' })
    saveTimetable(next).catch((err) => console.error('Auto-save failed', err))
  }

  async function importSlotsFromImage(file?: File) {
    if (!file) return
    if (!studentId || !weekStart) {
      alert('Select a student and week start before importing an image.')
      return
    }

    setImageImportBusy(true)
    setImageImportStatus('Reading image...')
    setImageImportCount(0)

    let worker: any
    try {
      const [{ createWorker }, imageSize] = await Promise.all([
        import('tesseract.js'),
        readImageSize(file)
      ])

      setImageImportStatus('Recognizing text...')
      worker = await createWorker('kor+eng', 1, {
        logger: (message: any) => {
          if (message?.status) {
            const progress = typeof message.progress === 'number' ? ` ${Math.round(message.progress * 100)}%` : ''
            setImageImportStatus(`${message.status}${progress}`)
          }
        }
      })

      const result = await worker.recognize(file, {}, { blocks: true, text: true })
      const lines = extractOcrLines(result.data)
      const imported = buildImportedSlots(lines, imageSize.width, imageSize.height, weekStart)

      if (imported.length === 0) {
        setImageImportStatus('No blocks found. Try a clearer screenshot or photo.')
        return
      }

      const next = [...slots, ...imported.map(({ importedText, ...slot }) => slot)]
      setSlots(next)
      setImageImportCount(imported.length)
      setImageImportStatus(`Imported ${imported.length} blocks. You can edit subjects and details next.`)
      saveTimetable(next).catch((err) => console.error('Image import save failed', err))
    } catch (err) {
      console.error(err)
      setImageImportStatus('Image import failed. Try a sharper image.')
    } finally {
      if (worker) await worker.terminate()
      setImageImportBusy(false)
    }
  }

  function saveSlot(updated: SlotType) {
    const normalized = {
      ...updated,
      category: updated.category || getSlotCategory(updated),
      studyType: updated.studyType || '개념공부',
      start: snapToStep(updated.start),
      end: snapToStep(updated.end),
      note: updated.note || ''
    }
    if (parseHM(normalized.end) <= parseHM(normalized.start)) {
      alert('종료시간은 시작시간보다 늦어야 합니다.')
      return
    }
    const hasOverlap = slots.some(
      (slot) =>
        slot.id !== normalized.id &&
        slot.day === normalized.day &&
        (!slot.weekStart || slot.weekStart === weekStart) &&
        rangesOverlap(normalized.start, normalized.end, slot.start, slot.end)
    )
    if (hasOverlap) {
      alert('이미 등록된 블록과 시간이 겹칩니다.')
      return
    }
    const next = slots.map((slot) => (slot.id === updated.id ? normalized : slot))
    setSlots(next)
    setEditing(null)
    saveTimetable(next).catch((err) => console.error('Auto-save failed', err))
  }

  function deleteSlot(id: string) {
    const next = slots.filter((slot) => slot.id !== id)
    setSlots(next)
    setEditing(null)
    saveTimetable(next).catch((err) => console.error('Auto-save failed', err))
  }

  function toggleSlotCompleted(id: string) {
    setSlots((prev) => {
      const next = prev.map((slot) => (slot.id === id ? { ...slot, completed: !slot.completed } : slot))
      scheduleTimetableSave(next)
      return next
    })
  }

  const totalPlannedMinutes = sessions.reduce((sum, session: any) => sum + (session.durationMinutes || 0), 0)
  const weekSlots = slots.filter((slot) => !slot.weekStart || slot.weekStart === weekStart)
  const totalSlotMinutes = weekSlots.reduce((sum, slot) => sum + Math.max(0, parseHM(slot.end) - parseHM(slot.start)), 0)
  const totalBlockCount = weekSlots.length
  const completedBlockCount = weekSlots.filter((slot) => slot.completed).length
  const completedSlotMinutes = weekSlots.reduce((sum, slot) => {
    if (!slot.completed) return sum
    return sum + Math.max(0, parseHM(slot.end) - parseHM(slot.start))
  }, 0)
  const achievementRate = totalBlockCount ? (completedBlockCount / totalBlockCount) * 100 : 0
  const categoryMinutes = weekSlots.reduce((acc: Record<string, number>, slot) => {
    const category = getSlotCategory(slot)
    acc[category] = (acc[category] || 0) + Math.max(0, parseHM(slot.end) - parseHM(slot.start))
    return acc
  }, {})

  return (
    <div>
      <div className="mb-4 flex gap-2 border-b border-gray-300">
        <button
          onClick={() => setActiveTab('planner')}
          className={`px-4 py-2 font-medium ${activeTab === 'planner' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          시간표
        </button>
        <button
          onClick={() => setActiveTab('plan')}
          className={`px-4 py-2 font-medium ${activeTab === 'plan' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          공부 계획
        </button>
      </div>

      {activeTab === 'planner' ? (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <section className="rounded bg-white p-4 shadow">
              <h3 className="mb-3 text-lg font-semibold">학생 및 주차</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium">
                  학생 선택
                  <select className="rounded border p-2" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                    <option value="">학생을 선택하세요</option>
                    {students.map((student: any) => (
                      <option key={student.id} value={student.id}>
                        {student.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  주차 시작일
                  <input className="rounded border p-2" type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
                </label>
              </div>

              {selectedStudent ? (
                <div className="mt-4 rounded border border-gray-200 p-3">
                  <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <input className="rounded border p-2" placeholder="이름" value={studentDraft.name} onChange={(e) => setStudentDraft((prev) => ({ ...prev, name: e.target.value }))} />
                    <input className="rounded border p-2" placeholder="학교" value={studentDraft.school} onChange={(e) => setStudentDraft((prev) => ({ ...prev, school: e.target.value }))} />
                    <input className="rounded border p-2" placeholder="학년" value={studentDraft.grade} onChange={(e) => setStudentDraft((prev) => ({ ...prev, grade: e.target.value }))} />
                  </div>
                  <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
                    {subjectCategories.map((category) => (
                      <label key={category} className="flex flex-col gap-1 text-xs text-gray-600">
                        {category} 점수
                        <input
                          className="rounded border p-2 text-sm"
                          type="number"
                          min={0}
                          max={100}
                          value={studentDraft.scores[category] || ''}
                          onChange={(e) =>
                            setStudentDraft((prev) => ({
                              ...prev,
                              scores: { ...prev.scores, [category]: e.target.value }
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <textarea className="mb-3 h-20 w-full rounded border p-2" placeholder="학생 메모" value={studentDraft.notes} onChange={(e) => setStudentDraft((prev) => ({ ...prev, notes: e.target.value }))} />
                  <button className="rounded bg-slate-700 px-4 py-2 text-white" onClick={saveStudentInfo}>
                    학생 정보 저장
                  </button>
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
                <input className="rounded border p-2" placeholder="새 학생 이름" value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} />
                <input className="rounded border p-2" placeholder="학교" value={newStudentSchool} onChange={(e) => setNewStudentSchool(e.target.value)} />
                <input className="rounded border p-2" placeholder="학년" value={newStudentGrade} onChange={(e) => setNewStudentGrade(e.target.value)} />
                <input className="rounded border p-2" placeholder="메모" value={newStudentNotes} onChange={(e) => setNewStudentNotes(e.target.value)} />
              </div>
              <button className="mt-3 rounded bg-green-600 px-4 py-2 text-white" onClick={createStudent}>
                학생 생성
              </button>
            </section>

            <section className="rounded bg-white p-4 shadow">
              <h3 className="mb-3 text-lg font-semibold">공부 블록 추가</h3>
              <div className="mb-3 grid grid-cols-7 gap-1">
                {days.map((day, idx) => {
                  const selected = newSlot.days.includes(idx)
                  return (
                    <button
                      key={day}
                      type="button"
                      className={`rounded border px-2 py-2 text-sm ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-700'}`}
                      onClick={() =>
                        setNewSlot((prev) => ({
                          ...prev,
                          days: prev.days.includes(idx) ? prev.days.filter((value) => value !== idx) : [...prev.days, idx]
                        }))
                      }
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
                <input className="rounded border p-2" type="time" value={newSlot.start} onChange={(e) => setNewSlot((prev) => ({ ...prev, start: e.target.value }))} />
                <input className="rounded border p-2" type="time" value={newSlot.end} onChange={(e) => setNewSlot((prev) => ({ ...prev, end: e.target.value }))} />
                <select className="rounded border p-2" value={newSlot.category} onChange={(e) => setNewSlot((prev) => ({ ...prev, category: e.target.value }))}>
                  {subjectCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <select className="rounded border p-2" value={newSlot.studyType} onChange={(e) => setNewSlot((prev) => ({ ...prev, studyType: e.target.value }))}>
                  {studyTypes.map((studyType) => (
                    <option key={studyType} value={studyType}>
                      {studyType}
                    </option>
                  ))}
                </select>
                <select className="rounded border p-2" value={newSlot.subject} onChange={(e) => setNewSlot((prev) => ({ ...prev, subject: e.target.value }))}>
                  <option value="">세부 항목 없음</option>
                  {subjects.map((subject: any) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
                <input className="rounded border p-2" placeholder="메모" value={newSlot.note} onChange={(e) => setNewSlot((prev) => ({ ...prev, note: e.target.value }))} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded bg-blue-600 px-4 py-2 text-white" onClick={addSelectedSlots}>
                  블록 추가
                </button>
                <button className="rounded bg-green-600 px-4 py-2 text-white" onClick={() => saveTimetable(slots).then(() => alert('저장되었습니다.')).catch(() => alert('저장에 실패했습니다.'))}>
                  저장
                </button>
                <button className="rounded bg-slate-700 px-4 py-2 text-white" onClick={loadTimetable}>
                  불러오기
                </button>
                <button className="rounded bg-sky-700 px-4 py-2 text-white" onClick={importPreviousWeekTimetable}>
                  Last week
                </button>
                <button className="rounded bg-indigo-600 px-4 py-2 text-white" onClick={generatePlan}>
                  자동 생성
                </button>
              </div>
              <div className="mt-4 rounded border border-dashed border-slate-300 bg-slate-50 p-3">
                <div className="mb-2 text-sm font-semibold text-slate-700">Import blocks from photo</div>
                <input
                  className="block w-full cursor-pointer rounded border bg-white p-2 text-sm"
                  type="file"
                  accept="image/*"
                  disabled={imageImportBusy}
                  onChange={(e) => {
                    importSlotsFromImage(e.target.files?.[0])
                    e.currentTarget.value = ''
                  }}
                />
                <div className="mt-2 text-xs text-slate-500">
                  {imageImportStatus || 'Upload a timetable photo. Text becomes block notes first; subjects can be edited later.'}
                </div>
                {imageImportCount > 0 ? <div className="mt-1 text-xs font-medium text-emerald-700">{imageImportCount} blocks added</div> : null}
              </div>
            </section>
          </div>

          <section className="overflow-auto rounded bg-white p-3 shadow">
            <div className="flex">
              <div className="w-16 flex-shrink-0 rounded-l border-r border-slate-800 bg-slate-700">
                <div className="h-8" />
                {timeLabels.map((time) => (
                  <div key={time} className="flex items-center justify-center border-t border-slate-600 bg-slate-700 text-center text-[10px] text-white" style={{ height: `${rowHeight}px` }}>
                    {formatHM(time)}
                  </div>
                ))}
              </div>
              <div className="min-w-[840px] flex-1">
                <div className="grid grid-cols-7">
                  {days.map((day) => (
                    <div key={day} className="flex h-8 items-center justify-center border-b border-l border-gray-200 px-2 text-sm font-semibold text-gray-700">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {days.map((_, idx) => (
                    <div id={`timeline-${idx}`} key={idx} className="relative border-l border-gray-200 bg-slate-50" style={{ height: `${timeLabels.length * rowHeight}px` }}>
                      {timeLabels.map((time) => (
                        <div key={time} className="border-t border-gray-200" style={{ height: `${rowHeight}px` }} />
                      ))}
                      {slots
                        .filter((slot) => slot.day === idx)
                        .map((slot) => {
                          const startMin = parseHM(slot.start)
                          const endMin = parseHM(slot.end)
                          const top = Math.max(0, ((startMin - timelineBase) / 30) * rowHeight)
                          const height = Math.max(rowHeight, ((endMin - startMin) / 30) * rowHeight)
                          const subject = subjectsMap[slot.subject || '']
                          return (
                            <div
                              key={slot.id}
                              role="button"
                              tabIndex={0}
                              className={`absolute left-1 right-1 rounded px-2 py-2 text-left text-[11px] text-white shadow ${slot.completed ? 'ring-2 ring-emerald-300' : ''}`}
                              style={{ top: `${top}px`, height: `${height}px`, backgroundColor: subject?.color || '#3b82f6' }}
                              onClick={() => setEditing(slot)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') setEditing(slot)
                              }}
                            >
                              <label className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-sm bg-white shadow" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  className="h-3 w-3 cursor-pointer accent-emerald-600"
                                  checked={Boolean(slot.completed)}
                                  onChange={() => toggleSlotCompleted(slot.id)}
                                />
                              </label>
                              <div className="truncate pr-5 font-semibold">{subject?.name || getSlotCategory(slot)}</div>
                              <div className="text-[10px] opacity-90">{slot.studyType || '개념공부'}</div>
                              <div className="text-[10px] opacity-90">
                                {slot.start} - {slot.end}
                              </div>
                              {slot.note ? <div className="mt-1 line-clamp-2 text-[10px] opacity-90">{slot.note}</div> : null}
                            </div>
                          )
                        })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded bg-white p-4 shadow">
              <h3 className="mb-3 text-lg font-semibold">과목 관리</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input className="rounded border p-2" placeholder="과목명" value={newSubject.name} onChange={(e) => setNewSubject((prev) => ({ ...prev, name: e.target.value }))} />
                <input className="rounded border p-2" type="number" min={0} value={newSubject.weeklyTargetHours} onChange={(e) => setNewSubject((prev) => ({ ...prev, weeklyTargetHours: Number(e.target.value) }))} />
                <input className="rounded border p-2" type="number" min={0} max={10} value={newSubject.priority} onChange={(e) => setNewSubject((prev) => ({ ...prev, priority: Number(e.target.value) }))} />
                <input className="h-11 rounded border" type="color" value={newSubject.color} onChange={(e) => setNewSubject((prev) => ({ ...prev, color: e.target.value }))} />
              </div>
              <button className="mt-3 rounded bg-indigo-600 px-4 py-2 text-white" onClick={createSubject}>
                과목 추가
              </button>
              <div className="mt-4 space-y-2">
                {subjects.map((subject: any) => (
                  <div key={subject.id} className="flex items-center justify-between gap-3 rounded border border-gray-200 p-3">
                    <div>
                      <div className="font-semibold">{subject.name}</div>
                      <div className="text-xs text-gray-500">
                        목표 {subject.weeklyTargetHours || 0}시간 · 우선순위 {subject.priority}
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-500">
                      색상
                      <input className="h-9 w-12 cursor-pointer rounded border" type="color" value={subject.color || '#60a5fa'} onChange={(e) => updateSubjectColor(subject.id, e.target.value)} />
                    </label>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded bg-white p-4 shadow">
              <h3 className="mb-3 text-lg font-semibold">현재 주차 요약</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded border border-gray-200 p-3">
                  <div className="text-sm text-gray-500">등록된 블록</div>
                  <div className="mt-1 font-semibold">{slots.length}개</div>
                </div>
                <div className="rounded border border-gray-200 p-3">
                  <div className="text-sm text-gray-500">생성된 세션</div>
                  <div className="mt-1 font-semibold">{sessions.length}개</div>
                </div>
                <div className="rounded border border-gray-200 p-3">
                  <div className="text-sm text-gray-500">추정 학습 시간</div>
                  <div className="mt-1 font-semibold">{(totalPlannedMinutes / 60).toFixed(1)}시간</div>
                </div>
              </div>
            </section>
          </div>

          <section className="mt-4 rounded bg-white p-4 shadow">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">주차별 달성률</h3>
              <span className="text-sm text-gray-500">{weekStart || '주차 미선택'}</span>
            </div>
            <div className="rounded border border-gray-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-gray-500">이번 주차 블록 완료율</div>
                  <div className="mt-1 text-xs text-gray-500">
                    완료 {completedBlockCount}개 / 전체 {totalBlockCount}개 · 실천 {(completedSlotMinutes / 60).toFixed(1)}시간
                  </div>
                </div>
                <div className="text-xl font-semibold text-emerald-700">{achievementRate.toFixed(0)}%</div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded bg-gray-100">
                <div className="h-full rounded bg-emerald-500" style={{ width: `${Math.min(100, achievementRate)}%` }} />
              </div>
            </div>
          </section>

          <section className="mt-4 rounded bg-white p-4 shadow">
            <h3 className="mb-3 text-lg font-semibold">과목별 블록 분석</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded border border-gray-200 p-3">
                <div className="text-sm text-gray-500">이번 주차 블록 학습 시간</div>
                <div className="mt-1 font-semibold">{(totalSlotMinutes / 60).toFixed(1)}시간</div>
              </div>
              <div className="rounded border border-gray-200 p-3">
                <div className="text-sm text-gray-500">과목별 시간 분포</div>
                <div className="mt-3 space-y-2">
                  {Object.keys(categoryMinutes).length === 0 ? (
                    <div className="text-sm text-gray-500">아직 블록이 없습니다.</div>
                  ) : (
                    Object.entries(categoryMinutes).map(([category, mins]) => {
                      const ratio = totalSlotMinutes ? (mins / totalSlotMinutes) * 100 : 0
                      return (
                        <div key={category} className="flex items-center justify-between text-sm">
                          <span>{category}</span>
                          <span className="font-semibold">
                            {(mins / 60).toFixed(1)}시간 · {ratio.toFixed(0)}%
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </section>

          {editing && (
            <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 px-4 py-6">
              <div className="w-full max-w-xl rounded bg-white p-4">
                <h3 className="mb-3 font-semibold">블록 편집</h3>
                <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    요일
                    <select className="mt-1 w-full rounded border p-2" value={editing.day} onChange={(e) => setEditing({ ...editing, day: Number(e.target.value) })}>
                      {days.map((day, idx) => (
                        <option key={day} value={idx}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    과목 구분
                    <select className="mt-1 w-full rounded border p-2" value={editing.category || getSlotCategory(editing)} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                      {subjectCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    공부 유형
                    <select className="mt-1 w-full rounded border p-2" value={editing.studyType || '개념공부'} onChange={(e) => setEditing({ ...editing, studyType: e.target.value })}>
                      {studyTypes.map((studyType) => (
                        <option key={studyType} value={studyType}>
                          {studyType}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    세부 항목
                    <select className="mt-1 w-full rounded border p-2" value={editing.subject || ''} onChange={(e) => setEditing({ ...editing, subject: e.target.value })}>
                      <option value="">세부 항목 없음</option>
                      {subjects.map((subject: any) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    시작
                    <input className="mt-1 w-full rounded border p-2" type="time" value={editing.start} onChange={(e) => setEditing({ ...editing, start: e.target.value })} />
                  </label>
                  <label className="block text-sm">
                    종료
                    <input className="mt-1 w-full rounded border p-2" type="time" value={editing.end} onChange={(e) => setEditing({ ...editing, end: e.target.value })} />
                  </label>
                  <label className="block text-sm sm:col-span-2">
                    메모
                    <textarea className="mt-1 h-24 w-full rounded border p-2" value={editing.note || ''} onChange={(e) => setEditing({ ...editing, note: e.target.value })} placeholder="블록 메모" />
                  </label>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={Boolean(editing.completed)} onChange={(e) => setEditing({ ...editing, completed: e.target.checked })} />
                    실천 완료
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button className="rounded bg-gray-200 px-4 py-2" onClick={() => setEditing(null)}>
                    취소
                  </button>
                  <button className="rounded bg-red-500 px-4 py-2 text-white" onClick={() => deleteSlot(editing.id)}>
                    삭제
                  </button>
                  <button className="rounded bg-blue-600 px-4 py-2 text-white" onClick={() => saveSlot(editing)}>
                    저장
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <StudyPlan studentId={studentId} allSlots={slots} />
      )}
    </div>
  )
}
