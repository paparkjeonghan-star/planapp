import { Router } from 'express';
import prisma from '../prismaClient';

const router = Router();

// GET /api/timetables?studentId=&weekStart=
router.get('/', async (req, res) => {
  const { studentId, weekStart } = req.query as any;
  if (!studentId || !weekStart) return res.status(400).json({ error: 'studentId and weekStart required' });
  try {
    const tt = await prisma.timetable.findFirst({
      where: { studentId: String(studentId), weekStart: new Date(String(weekStart)) },
      include: { slots: true }
    });
    if (!tt) return res.json({ studentId: String(studentId), weekStart: new Date(String(weekStart)), slots: [] });
    res.json(tt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// POST /api/timetables
// body: { studentId, weekStart, slots: [{ dayOfWeek, startTime, endTime, type, subjectId, category, studyType, notes, completed }] }
router.post('/', async (req, res) => {
  const { studentId, weekStart, slots } = req.body;
  if (!studentId || !weekStart) return res.status(400).json({ error: 'studentId and weekStart required' });
  try {
    const weekDate = new Date(weekStart);
    let timetable = await prisma.timetable.findFirst({ where: { studentId, weekStart: weekDate } });
    if (!timetable) {
      timetable = await prisma.timetable.create({ data: { studentId, weekStart: weekDate } });
    } else {
      // remove existing slots
      await prisma.slot.deleteMany({ where: { timetableId: timetable.id } });
    }

    if (Array.isArray(slots) && slots.length) {
      const created: any[] = [];
      for (const s of slots) {
        const cs = await prisma.slot.create({ data: {
          timetableId: timetable.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          type: s.type || 'study',
          subjectId: s.subjectId || null,
          category: s.category || null,
          studyType: s.studyType || null,
          notes: s.notes || null,
          completed: Boolean(s.completed)
        }});
        created.push(cs);
      }
      const full = await prisma.timetable.findUnique({ where: { id: timetable.id }, include: { slots: true } });
      return res.status(201).json(full);
    }

    const full = await prisma.timetable.findUnique({ where: { id: timetable.id }, include: { slots: true } });
    res.json(full);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

export default router;
