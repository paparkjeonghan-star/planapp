import React, { useEffect, useMemo, useState } from 'react'
import api from '../utils/api'

type ExamSchedule = {
  midterm1: string
  final1: string
  midterm2: string
  final2: string
}

type PlanSlot = {
  id: string
  weekStart: string
  start: string
  end: string
  category?: string
  studyType?: string
  subject?: string
  note?: string
  completed?: boolean
}

type StudyItem = {
  id: string
  weeksBefore: number
  memo: string
  minutes: number
}

type TypeStudy = {
  studyType: string
  totalMinutes: number
  items: StudyItem[]
}

type SubjectStudy = {
  subject: string
  totalMinutes: number
  typeStudies: TypeStudy[]
}

const examLabels: Record<keyof ExamSchedule, string> = {
  midterm1: '1학기 중간고사',
  final1: '1학기 기말고사',
  midterm2: '2학기 중간고사',
  final2: '2학기 기말고사'
}

const subjectCategories = ['수학', '영어', '국어', '과학', '사회', '기타']
const studyTypes = ['개념공부', '문제풀이', '고난도/서술형']

function parseHM(hm: string) {
  if (!hm) return 0
  const [hh = 0, mm = 0] = hm.split(':').map(Number)
  return hh * 60 + mm
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function startOfWeek(date: Date) {
  const next = new Date(date)
  const day = next.getDay()
  next.setDate(next.getDate() + (day === 0 ? -6 : 1 - day))
  next.setHours(0, 0, 0, 0)
  return next
}

function categorizeSubject(label: string) {
  const normalized = label.trim().toLowerCase()
  if (/수학|math/.test(normalized)) return '수학'
  if (/영어|english/.test(normalized)) return '영어'
  if (/국어|korean/.test(normalized)) return '국어'
  if (/과학|science/.test(normalized)) return '과학'
  if (/사회|social/.test(normalized)) return '사회'
  return label.trim() || '기타'
}

function getWeeksBefore(examWeekStart: Date, weekStart: string) {
  const diffDays = Math.round((examWeekStart.getTime() - parseLocalDate(weekStart).getTime()) / 86400000)
  return Math.max(1, Math.ceil(diffDays / 7))
}

function mapTimetableSlots(timetable: any, weekStart: string): PlanSlot[] {
  return (timetable.slots || []).map((slot: any) => ({
    id: slot.id,
    weekStart,
    start: slot.startTime,
    end: slot.endTime,
    category: slot.category || undefined,
    studyType: slot.studyType || undefined,
    subject: slot.subjectId || undefined,
    note: slot.notes || '',
    completed: Boolean(slot.completed)
  }))
}

export default function StudyPlan({ studentId, allSlots }: { studentId: string; allSlots: any[] }) {
  const [exams, setExams] = useState<ExamSchedule>({ midterm1: '', final1: '', midterm2: '', final2: '' })
  const [selectedExam, setSelectedExam] = useState<keyof ExamSchedule | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [planSlots, setPlanSlots] = useState<PlanSlot[]>([])
  const [isLoadingPlan, setIsLoadingPlan] = useState(false)

  useEffect(() => {
    if (!studentId) {
      setExams({ midterm1: '', final1: '', midterm2: '', final2: '' })
      setSelectedExam(null)
      setPlanSlots([])
      return
    }

    let ignore = false
    api.getExamSchedule(studentId)
      .then((schedule) => {
        if (ignore) return
        setExams({
          midterm1: schedule.midterm1 || '',
          final1: schedule.final1 || '',
          midterm2: schedule.midterm2 || '',
          final2: schedule.final2 || ''
        })
      })
      .catch((err) => {
        console.error('Failed to load exam schedule', err)
        if (!ignore) setSaveState('error')
      })

    return () => {
      ignore = true
    }
  }, [studentId])

  useEffect(() => {
    async function loadSixWeekPlan() {
      if (!studentId || !selectedExam || !exams[selectedExam]) {
        setPlanSlots([])
        return
      }

      setIsLoadingPlan(true)
      const examWeekStart = startOfWeek(parseLocalDate(exams[selectedExam]))
      const weekStarts = Array.from({ length: 6 }, (_, idx) => {
        const week = new Date(examWeekStart)
        week.setDate(week.getDate() - (idx + 1) * 7)
        return formatDate(week)
      })

      try {
        const timetables = await Promise.all(
          weekStarts.map((weekStart) => api.getTimetable(studentId, weekStart).catch(() => ({ slots: [] })))
        )
        setPlanSlots(timetables.flatMap((timetable, idx) => mapTimetableSlots(timetable, weekStarts[idx])))
      } catch (err) {
        console.error('Failed to load six week plan', err)
        setPlanSlots([])
      } finally {
        setIsLoadingPlan(false)
      }
    }

    loadSixWeekPlan()
  }, [studentId, selectedExam, exams])

  async function updateExamDate(key: keyof ExamSchedule, value: string) {
    const next = { ...exams, [key]: value }
    setExams(next)

    if (!studentId) return
    setSaveState('saving')
    try {
      const saved = await api.saveExamSchedule(studentId, next)
      setExams({
        midterm1: saved.midterm1 || '',
        final1: saved.final1 || '',
        midterm2: saved.midterm2 || '',
        final2: saved.final2 || ''
      })
      setSaveState('saved')
      window.setTimeout(() => setSaveState('idle'), 1200)
    } catch (err) {
      console.error('Failed to save exam schedule', err)
      setSaveState('error')
    }
  }

  const subjectStudies = useMemo<SubjectStudy[]>(() => {
    if (!studentId || !selectedExam || !exams[selectedExam]) return []

    const examWeekStart = startOfWeek(parseLocalDate(exams[selectedExam]))
    const merged = [...planSlots]

    allSlots
      .filter((slot: any) => slot.weekStart)
      .forEach((slot: any) => {
        const weeksBefore = getWeeksBefore(examWeekStart, slot.weekStart)
        if (weeksBefore < 1 || weeksBefore > 6) return
        if (merged.some((item) => item.id === slot.id)) return
        merged.push({
          id: slot.id,
          weekStart: slot.weekStart,
          start: slot.start,
          end: slot.end,
          category: slot.category,
          studyType: slot.studyType,
          subject: slot.subject,
          note: slot.note || '',
          completed: Boolean(slot.completed)
        })
      })

    const grouped: Record<string, { totalMinutes: number; typeMap: Record<string, TypeStudy> }> = {}
    merged.forEach((slot) => {
      const weeksBefore = getWeeksBefore(examWeekStart, slot.weekStart)
      if (weeksBefore < 1 || weeksBefore > 6) return
      if (!slot.completed) return

      const subject = slot.category || categorizeSubject(slot.subject || slot.note || '')
      const studyType = slot.studyType || '개념공부'
      const minutes = Math.max(0, parseHM(slot.end) - parseHM(slot.start))
      if (!grouped[subject]) grouped[subject] = { totalMinutes: 0, typeMap: {} }
      if (!grouped[subject].typeMap[studyType]) {
        grouped[subject].typeMap[studyType] = { studyType, totalMinutes: 0, items: [] }
      }

      grouped[subject].totalMinutes += minutes
      grouped[subject].typeMap[studyType].totalMinutes += minutes
      grouped[subject].typeMap[studyType].items.push({
        id: slot.id,
        weeksBefore,
        memo: slot.note || '',
        minutes
      })
    })

    return Object.entries(grouped)
      .sort(([a], [b]) => {
        const ai = subjectCategories.indexOf(a)
        const bi = subjectCategories.indexOf(b)
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
      })
      .map(([subject, group]) => ({
        subject,
        totalMinutes: group.totalMinutes,
        typeStudies: studyTypes
          .map((studyType) => group.typeMap[studyType] || { studyType, totalMinutes: 0, items: [] })
          .map((typeGroup) => ({
            ...typeGroup,
            items: typeGroup.items.sort((a, b) => b.weeksBefore - a.weeksBefore)
          }))
      }))
  }, [allSlots, exams, planSlots, selectedExam, studentId])

  const totalStudyMinutes = subjectStudies.reduce((sum, group) => sum + group.totalMinutes, 0)

  return (
    <div className="space-y-4">
      <section className="rounded bg-white p-4 shadow">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">시험 일정 설정</h3>
          <div className="text-xs text-gray-500">
            {saveState === 'saving' && '저장 중'}
            {saveState === 'saved' && '저장됨'}
            {saveState === 'error' && '저장 실패'}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(Object.keys(exams) as Array<keyof ExamSchedule>).map((key) => (
            <label key={key} className="flex flex-col gap-2 text-sm font-medium">
              {examLabels[key]}
              <input
                type="date"
                className="rounded border p-2"
                value={exams[key]}
                disabled={!studentId}
                onChange={(e) => updateExamDate(key, e.target.value)}
              />
            </label>
          ))}
        </div>
        {!studentId ? <div className="mt-3 text-sm text-gray-500">학생을 먼저 선택하면 시험 날짜가 학생별로 저장됩니다.</div> : null}
      </section>

      <section className="rounded bg-white p-4 shadow">
        <h3 className="mb-3 text-lg font-semibold">시험별 공부 계획</h3>
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(exams) as Array<keyof ExamSchedule>).map((key) => (
            <button
              key={key}
              onClick={() => setSelectedExam(key)}
              className={`rounded border p-3 ${
                selectedExam === key ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {examLabels[key]} {exams[key] ? `(${exams[key]})` : ''}
            </button>
          ))}
        </div>

        {selectedExam && exams[selectedExam] ? (
          <div className="space-y-3">
            {isLoadingPlan ? <div className="rounded bg-gray-50 p-4 text-center text-gray-500">6주 전 공부 기록을 불러오는 중입니다.</div> : null}
            {!isLoadingPlan && subjectStudies.length === 0 ? (
              <div className="rounded bg-gray-50 p-4 text-center text-gray-500">시험 6주 전까지의 공부 기록이 없습니다.</div>
            ) : (
              <>
                <div className="rounded border border-blue-100 bg-blue-50 p-3">
                  <div className="text-sm text-blue-700">전체 완료 공부 시간</div>
                  <div className="mt-1 text-lg font-semibold text-blue-800">{(totalStudyMinutes / 60).toFixed(1)}시간</div>
                </div>
                {subjectStudies.map((group) => {
                  const subjectRatio = totalStudyMinutes ? (group.totalMinutes / totalStudyMinutes) * 100 : 0
                  return (
                    <div key={group.subject} className="rounded border border-gray-200 p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="font-semibold">{group.subject}</div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-blue-700">{(group.totalMinutes / 60).toFixed(1)}시간</div>
                          <div className="text-xs font-semibold text-gray-500">전체의 {subjectRatio.toFixed(0)}%</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {group.typeStudies.map((typeGroup) => {
                          const ratio = group.totalMinutes ? (typeGroup.totalMinutes / group.totalMinutes) * 100 : 0
                          return (
                            <div key={typeGroup.studyType} className="min-w-0 rounded border border-gray-200 bg-gray-50 p-3">
                              <div className="mb-2">
                                <div className="truncate text-sm font-semibold">{typeGroup.studyType}</div>
                                <div className="mt-1 text-xs font-semibold text-gray-600">
                                  {(typeGroup.totalMinutes / 60).toFixed(1)}시간 · {ratio.toFixed(0)}%
                                </div>
                              </div>
                              <div className="space-y-2">
                                {typeGroup.items.length === 0 ? (
                                  <div className="text-xs text-gray-400">기록 없음</div>
                                ) : (
                                  typeGroup.items.map((item) => (
                                    <div key={item.id} className="rounded bg-white p-2 text-sm text-gray-700">
                                      <span className="font-medium">시험 {item.weeksBefore}주 전</span>
                                      {item.memo ? <span className="ml-2 break-words">{item.memo}</span> : null}
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        ) : (
          <div className="rounded bg-gray-50 p-4 text-center text-gray-500">시험 날짜를 선택하여 공부 계획을 확인하세요.</div>
        )}
      </section>
    </div>
  )
}
