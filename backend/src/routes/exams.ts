import { Router } from 'express'
import prisma from '../prismaClient'

const router = Router()
const examKeys = ['midterm1', 'final1', 'midterm2', 'final2'] as const

function toDateOrNull(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

function serialize(schedule: any) {
  if (!schedule) {
    return { midterm1: '', final1: '', midterm2: '', final2: '' }
  }

  return Object.fromEntries(
    examKeys.map((key) => [key, schedule[key] ? schedule[key].toISOString().slice(0, 10) : ''])
  )
}

router.get('/:studentId', async (req, res) => {
  const { studentId } = req.params

  try {
    const schedule = await prisma.examSchedule.findUnique({ where: { studentId } })
    res.json(serialize(schedule))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server error' })
  }
})

router.put('/:studentId', async (req, res) => {
  const { studentId } = req.params
  const data = Object.fromEntries(examKeys.map((key) => [key, toDateOrNull(req.body[key])]))

  try {
    const schedule = await prisma.examSchedule.upsert({
      where: { studentId },
      update: data,
      create: { studentId, ...data }
    })
    res.json(serialize(schedule))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server error' })
  }
})

export default router
