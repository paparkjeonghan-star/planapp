import { Router } from 'express'
import prisma from '../prismaClient'

const router = Router()

// GET /api/subjects?studentId=
router.get('/', async (req, res) => {
  const { studentId } = req.query as any
  try {
    const list = await prisma.subject.findMany({
      where: {
        OR: [
          { studentId: null },
          ...(studentId ? [{ studentId }] : [])
        ]
      }
    })
    res.json(list)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server error' })
  }
})

// POST /api/subjects (simple create)
router.post('/', async (req, res) => {
  const { name, weeklyTargetHours, priority, color, studentId } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  try {
    const sub = await prisma.subject.create({ data: { name, studentId: studentId || null, weeklyTargetHours: weeklyTargetHours || 0, priority: priority || 0, color: color || '#60a5fa' } })
    res.status(201).json(sub)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server error' })
  }
})

router.put('/:id', async (req, res) => {
  const { id } = req.params
  const { name, weeklyTargetHours, priority, color } = req.body

  try {
    const data: any = {}
    if (name !== undefined) data.name = name
    if (weeklyTargetHours !== undefined) data.weeklyTargetHours = weeklyTargetHours
    if (priority !== undefined) data.priority = priority
    if (color !== undefined) data.color = color

    const sub = await prisma.subject.update({ where: { id }, data })
    res.json(sub)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server error' })
  }
})

export default router
