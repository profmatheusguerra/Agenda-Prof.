import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'agenda-prof-v2-data';

const palette = {
  bg: '#F3F6FB',
  bgSoft: '#EAF0FA',
  card: '#FFFFFF',
  border: '#DDE6F3',
  text: '#102544',
  muted: '#6F7E95',
  primary: '#345DB8',
  primarySoft: '#E4ECFF',
  accent: '#F5A623',
  teal: '#27B7D7',
  danger: '#E45C5C',
  success: '#34C38F',
  white: '#FFFFFF',
};

const SCHOOL_COLORS = ['#345DB8', '#27B7D7', '#F5A623', '#34C38F', '#A855F7', '#EF4444', '#F97316'];
const COMMITMENT_TYPES = ['Envio de avaliações', 'Reunião pedagógica', 'Outros'];
const RECURRENCE_OPTIONS = ['Não repetir', 'Diariamente', 'Semanalmente', 'Anualmente'];
const REMINDER_OPTIONS = [
  { label: '10 minutos antes', value: '10min' },
  { label: '1 dia antes', value: '1day' },
  { label: '1 semana antes', value: '1week' },
  { label: '1 mês antes', value: '1month' },
];
const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAY_OPTIONS = [
  { label: 'Segunda-feira', value: 1 },
  { label: 'Terça-feira', value: 2 },
  { label: 'Quarta-feira', value: 3 },
  { label: 'Quinta-feira', value: 4 },
  { label: 'Sexta-feira', value: 5 },
  { label: 'Sábado', value: 6 },
  { label: 'Domingo', value: 0 },
];

const initialData = {
  profile: {
    teacherName: '',
    compactMode: false,
    notifications: true,
    schoolYearEnd: '',
  },
  schools: [],
  classes: [],
  subjects: [],
  lessons: [],
  commitments: [],
  exams: [],
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const pad = (n) => String(n).padStart(2, '0');
const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const todayKey = () => toDateKey(new Date());
const parseDateKey = (key) => {
  const clean = String(key || todayKey()).trim();
  const [y, m, d] = clean.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 12, 0, 0);
};
const shortDate = (dateKey) => parseDateKey(dateKey).toLocaleDateString('pt-BR');
const longDate = (date) => date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).replace(/^./, (s) => s.toUpperCase());
const monthTitle = (date) => date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, (s) => s.toUpperCase());
const compareTime = (a, b) => String(a || '').localeCompare(String(b || ''));
const addDays = (date, days) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};
const startOfWeek = (date) => {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(12, 0, 0, 0);
  return copy;
};
const endOfWeek = (date) => addDays(startOfWeek(date), 6);
const isWithinRange = (date, start, end) => date >= start && date <= end;
const findById = (arr, id) => arr.find((item) => item.id === id);

function isValidDateKey(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || '').trim())) return false;
  const parsed = parseDateKey(dateKey);
  return !Number.isNaN(parsed.getTime());
}

function normalizeData(raw) {
  const merged = {
    ...initialData,
    ...raw,
    profile: { ...initialData.profile, ...(raw?.profile || {}) },
    schools: Array.isArray(raw?.schools) ? raw.schools : [],
    classes: Array.isArray(raw?.classes) ? raw.classes : [],
    subjects: Array.isArray(raw?.subjects) ? raw.subjects : [],
    lessons: Array.isArray(raw?.lessons) ? raw.lessons : [],
    commitments: Array.isArray(raw?.commitments) ? raw.commitments : [],
    exams: Array.isArray(raw?.exams) ? raw.exams : [],
  };
  merged.lessons = merged.lessons.map((lesson) => ({
    lessonType: lesson.lessonType || 'recurring',
    startDate: lesson.startDate || todayKey(),
    date: lesson.date || todayKey(),
    reminder: lesson.reminder || '10min',
    ...lesson,
  }));
  merged.commitments = merged.commitments.map((item) => ({ reminder: item.reminder || '10min', ...item }));
  merged.exams = merged.exams.map((item) => ({ reminder: item.reminder || '1day', attachmentName: item.attachmentName || '', ...item }));
  return merged;
}

function addMinutesToTime(time, minutesToAdd = 50) {
  const match = String(time || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '';
  let hours = Number(match[1]);
  let minutes = Number(match[2]) + minutesToAdd;
  while (minutes >= 60) {
    hours += 1;
    minutes -= 60;
  }
  return `${pad(hours % 24)}:${pad(minutes)}`;
}

function timeToDate(dateKey, time) {
  const date = parseDateKey(dateKey);
  const [hours = 0, minutes = 0] = String(time || '00:00').split(':').map(Number);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

function eventEndDate(event) {
  const fallback = event.sortTime || '00:00';
  const endTime = event.timeLabel?.includes(' - ') ? event.timeLabel.split(' - ')[1] : fallback;
  return timeToDate(event.date, endTime);
}

function shouldShowInTodayWeek(event) {
  const limit = eventEndDate(event);
  limit.setMinutes(limit.getMinutes() + 30);
  return limit > new Date();
}

function isAfterSchoolYearEnd(dateKey, schoolYearEnd) {
  const limit = String(schoolYearEnd || '').trim();
  if (!isValidDateKey(limit)) return false;
  return parseDateKey(dateKey) > parseDateKey(limit);
}

function schoolYearEndMessage(schoolYearEnd) {
  return `A data escolhida ultrapassa o fim do ano letivo (${shortDate(schoolYearEnd)}).`;
}

function getEasterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12, 0, 0);
}

function getNationalHolidayMap(year) {
  const easter = getEasterDate(year);
  const movable = [
    { key: toDateKey(addDays(easter, -48)), name: 'Carnaval' },
    { key: toDateKey(addDays(easter, -47)), name: 'Carnaval' },
    { key: toDateKey(addDays(easter, -2)), name: 'Sexta-feira Santa' },
    { key: toDateKey(addDays(easter, 60)), name: 'Corpus Christi' },
  ];
  const fixed = [
    ['01-01', 'Confraternização Universal'],
    ['04-21', 'Tiradentes'],
    ['05-01', 'Dia do Trabalhador'],
    ['09-07', 'Independência do Brasil'],
    ['10-12', 'Nossa Senhora Aparecida'],
    ['11-02', 'Finados'],
    ['11-15', 'Proclamação da República'],
    ['11-20', 'Consciência Negra'],
    ['12-25', 'Natal'],
  ].map(([md, name]) => ({ key: `${year}-${md}`, name }));
  return Object.fromEntries([...fixed, ...movable].map((item) => [item.key, item.name]));
}

function isNationalHoliday(dateKey) {
  if (!isValidDateKey(dateKey)) return null;
  const year = parseDateKey(dateKey).getFullYear();
  return getNationalHolidayMap(year)[dateKey] || null;
}

function isRecurringOnDate(item, dateKey) {
  const target = parseDateKey(dateKey);
  const source = parseDateKey(item.date);
  if (target < source) return false;
  if (item.recurrence === 'Não repetir') return item.date === dateKey;
  if (item.recurrence === 'Diariamente') return true;
  if (item.recurrence === 'Semanalmente') return source.getDay() === target.getDay();
  if (item.recurrence === 'Anualmente') return source.getDate() === target.getDate() && source.getMonth() === target.getMonth();
  return false;
}

function isLessonOnDate(lesson, dateKey) {
  if (lesson.lessonType === 'single') return lesson.date === dateKey;
  const startDate = lesson.startDate || todayKey();
  if (parseDateKey(dateKey) < parseDateKey(startDate)) return false;
  return parseDateKey(dateKey).getDay() === lesson.weekday;
}

function buildMonthCells(viewDate) {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1, 12, 0, 0);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const date = addDays(start, i);
    cells.push({ date, key: toDateKey(date), inMonth: date.getMonth() === viewDate.getMonth() });
  }
  return cells;
}

function App() {
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState('Hoje');
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState(null);
  const [calendarPickerOpen, setCalendarPickerOpen] = useState(false);
  const [calendarTargetField, setCalendarTargetField] = useState('date');
  const [nowTick, setNowTick] = useState(Date.now());
  const [editingItem, setEditingItem] = useState(null);
  const [eventActions, setEventActions] = useState(null);
  const [managementModal, setManagementModal] = useState(null);
  const [schoolForm, setSchoolForm] = useState({ name: '', color: SCHOOL_COLORS[0] });
  const [classForm, setClassForm] = useState({ name: '' });
  const [subjectForm, setSubjectForm] = useState({ name: '' });
  const [lessonForm, setLessonForm] = useState({ lessonType: 'recurring', schoolId: '', classId: '', subjectId: '', weekday: 1, startDate: todayKey(), date: todayKey(), startTime: '07:00', endTime: '07:50', reminder: '10min' });
  const [commitmentForm, setCommitmentForm] = useState({ type: COMMITMENT_TYPES[0], title: '', description: '', schoolId: '', date: todayKey(), time: '08:00', recurrence: 'Não repetir', reminder: '10min' });
  const [examForm, setExamForm] = useState({ title: '', schoolId: '', classId: '', subjectId: '', date: todayKey(), time: '08:00', reminder: '1day', attachmentName: '' });

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) setData(normalizeData(JSON.parse(saved)));
      } catch (error) {
        console.log('Erro ao carregar dados', error);
      }
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch((error) => console.log('Erro ao salvar dados', error));
  }, [data]);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const enrichedEvents = useMemo(() => {
    const events = [];
    const current = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1, 12, 0, 0);
    const start = new Date(current.getFullYear(), current.getMonth() - 1, 1, 12, 0, 0);
    const end = new Date(current.getFullYear(), current.getMonth() + 2, 0, 12, 0, 0);

    for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
      const dateKey = toDateKey(cursor);
      if (isNationalHoliday(dateKey)) continue;
      if (isAfterSchoolYearEnd(dateKey, data.profile?.schoolYearEnd)) continue;

      data.lessons.forEach((lesson) => {
        if (isLessonOnDate(lesson, dateKey)) {
          const school = findById(data.schools, lesson.schoolId);
          const classItem = findById(data.classes, lesson.classId);
          const subject = findById(data.subjects, lesson.subjectId);
          events.push({
            id: `${lesson.id}-${dateKey}`,
            originalId: lesson.id,
            sourceType: 'lesson',
            eventType: lesson.lessonType === 'single' ? 'aula isolada' : 'aula',
            title: subject?.name || 'Aula',
            subtitle: `${classItem?.name || 'Turma'} • ${school?.name || 'Escola'}`,
            date: dateKey,
            sortTime: lesson.startTime,
            timeLabel: `${lesson.startTime} - ${lesson.endTime}`,
            color: school?.color || palette.primary,
          });
        }
      });

      data.commitments.forEach((item) => {
        if (isRecurringOnDate(item, dateKey)) {
          const school = item.schoolId ? findById(data.schools, item.schoolId) : null;
          events.push({
            id: `${item.id}-${dateKey}`,
            originalId: item.id,
            sourceType: 'commitment',
            eventType: 'compromisso',
            title: item.title || item.type,
            subtitle: school ? `${item.type} • ${school.name}` : item.type,
            date: dateKey,
            sortTime: item.time || '00:00',
            timeLabel: item.time || '--:--',
            color: school?.color || palette.accent,
            description: item.description,
          });
        }
      });

      data.exams.forEach((exam) => {
        if (exam.date === dateKey) {
          const school = findById(data.schools, exam.schoolId);
          const classItem = findById(data.classes, exam.classId);
          const subject = findById(data.subjects, exam.subjectId);
          events.push({
            id: `exam-${exam.id}`,
            originalId: exam.id,
            sourceType: 'exam',
            eventType: 'avaliação',
            title: exam.title || `Avaliação de ${subject?.name || 'disciplina'}`,
            subtitle: `${classItem?.name || 'Turma'} • ${school?.name || 'Escola'}`,
            date: dateKey,
            sortTime: exam.time || '00:00',
            timeLabel: exam.time || '--:--',
            color: palette.danger,
            description: exam.attachmentName ? `Prova/anexo: ${exam.attachmentName}` : '',
          });
        }
      });
    }

    return events.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return compareTime(a.sortTime, b.sortTime);
    });
  }, [data, viewMonth, nowTick]);

  const currentTodayKey = todayKey();
  const todaysEvents = enrichedEvents.filter((event) => event.date === currentTodayKey && shouldShowInTodayWeek(event));
  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfWeek(new Date());
  const weekEvents = enrichedEvents.filter((event) => isWithinRange(parseDateKey(event.date), weekStart, weekEnd) && shouldShowInTodayWeek(event));
  const selectedDayEvents = enrichedEvents.filter((event) => event.date === selectedDate);
  const monthCells = buildMonthCells(viewMonth);
  const eventCountByDay = useMemo(() => {
    const counts = {};
    enrichedEvents.forEach((event) => { counts[event.date] = (counts[event.date] || 0) + 1; });
    return counts;
  }, [enrichedEvents]);
  const examCountByDay = useMemo(() => {
    const counts = {};
    data.exams.forEach((exam) => {
      if (!isNationalHoliday(exam.date) && !isAfterSchoolYearEnd(exam.date, data.profile?.schoolYearEnd)) counts[exam.date] = (counts[exam.date] || 0) + 1;
    });
    return counts;
  }, [data.exams, data.profile?.schoolYearEnd]);
  const weeklyLessonCount = data.lessons.filter((lesson) => lesson.lessonType !== 'single').length;
  const counts = { schools: data.schools.length, classes: data.classes.length, subjects: data.subjects.length, lessons: data.lessons.length, commitments: data.commitments.length, exams: data.exams.length };

  const updateProfile = (patch) => setData((prev) => ({ ...prev, profile: { ...prev.profile, ...patch } }));
  const openCreateMenu = () => { setEditingItem(null); setModalMode(null); setModalOpen(true); };

  const resetLessonForm = () => setLessonForm({ lessonType: 'recurring', schoolId: '', classId: '', subjectId: '', weekday: 1, startDate: todayKey(), date: todayKey(), startTime: '07:00', endTime: '07:50', reminder: '10min' });
  const resetCommitmentForm = () => setCommitmentForm({ type: COMMITMENT_TYPES[0], title: '', description: '', schoolId: '', date: todayKey(), time: '08:00', recurrence: 'Não repetir', reminder: '10min' });
  const resetExamForm = () => setExamForm({ title: '', schoolId: '', classId: '', subjectId: '', date: todayKey(), time: '08:00', reminder: '1day', attachmentName: '' });

  const validateBlockedDate = (dateKey) => {
    const holiday = isNationalHoliday(dateKey);
    if (holiday) {
      Alert.alert('Feriado nacional', `Não é possível cadastrar item em ${shortDate(dateKey)} (${holiday}).`);
      return false;
    }
    if (isAfterSchoolYearEnd(dateKey, data.profile?.schoolYearEnd)) {
      Alert.alert('Fim do ano letivo', schoolYearEndMessage(data.profile.schoolYearEnd));
      return false;
    }
    return true;
  };

  const saveSchool = () => {
    if (!schoolForm.name.trim()) return Alert.alert('Campo obrigatório', 'Digite o nome da escola.');
    setData((prev) => ({ ...prev, schools: [...prev.schools, { id: uid(), name: schoolForm.name.trim(), color: schoolForm.color }] }));
    setSchoolForm({ name: '', color: SCHOOL_COLORS[0] });
    setManagementModal(null);
  };
  const saveClass = () => {
    if (!classForm.name.trim()) return Alert.alert('Campo obrigatório', 'Digite o nome da turma.');
    setData((prev) => ({ ...prev, classes: [...prev.classes, { id: uid(), name: classForm.name.trim() }] }));
    setClassForm({ name: '' });
    setManagementModal(null);
  };
  const saveSubject = () => {
    if (!subjectForm.name.trim()) return Alert.alert('Campo obrigatório', 'Digite o nome da disciplina.');
    setData((prev) => ({ ...prev, subjects: [...prev.subjects, { id: uid(), name: subjectForm.name.trim() }] }));
    setSubjectForm({ name: '' });
    setManagementModal(null);
  };

  const saveLesson = () => {
    if (!lessonForm.schoolId || !lessonForm.classId || !lessonForm.subjectId) return Alert.alert('Campos obrigatórios', 'Selecione escola, turma e disciplina.');
    const lessonDate = lessonForm.lessonType === 'single' ? lessonForm.date : lessonForm.startDate;
    if (!validateBlockedDate(lessonDate)) return;
    const item = { ...lessonForm, id: editingItem?.sourceType === 'lesson' ? editingItem.originalId : uid(), weekday: lessonForm.lessonType === 'single' ? parseDateKey(lessonForm.date).getDay() : lessonForm.weekday };
    setData((prev) => ({
      ...prev,
      lessons: editingItem?.sourceType === 'lesson' ? prev.lessons.map((l) => l.id === item.id ? item : l) : [...prev.lessons, item],
    }));
    resetLessonForm(); setEditingItem(null); setModalMode(null); setModalOpen(false);
  };

  const saveCommitment = () => {
    if (!commitmentForm.title.trim()) return Alert.alert('Campo obrigatório', 'Informe um título para o compromisso.');
    if (!validateBlockedDate(commitmentForm.date)) return;
    const item = { ...commitmentForm, id: editingItem?.sourceType === 'commitment' ? editingItem.originalId : uid(), title: commitmentForm.title.trim(), description: commitmentForm.description.trim() };
    setData((prev) => ({
      ...prev,
      commitments: editingItem?.sourceType === 'commitment' ? prev.commitments.map((c) => c.id === item.id ? item : c) : [...prev.commitments, item],
    }));
    resetCommitmentForm(); setEditingItem(null); setModalMode(null); setModalOpen(false);
  };

  const previousLessonReminderCommitments = (exam) => {
    const examDate = parseDateKey(exam.date);
    const reminders = [];
    for (let i = 1; i <= 120 && reminders.length < 2; i += 1) {
      const key = toDateKey(addDays(examDate, -i));
      if (isNationalHoliday(key)) continue;
      data.lessons
        .filter((lesson) => lesson.schoolId === exam.schoolId && lesson.classId === exam.classId && (!exam.subjectId || lesson.subjectId === exam.subjectId) && isLessonOnDate(lesson, key))
        .forEach((lesson) => {
          if (reminders.length < 2) reminders.push({ id: uid(), type: 'Avaliação', title: `Avaliação dessa turma dia ${shortDate(exam.date)}, foco na revisão!!!`, description: 'Lembrete criado automaticamente duas aulas antes da avaliação.', schoolId: exam.schoolId, date: key, time: lesson.startTime || '08:00', recurrence: 'Não repetir', reminder: '10min' });
        });
    }
    return reminders;
  };

  const saveExam = () => {
    if (!examForm.schoolId || !examForm.classId || !examForm.subjectId) return Alert.alert('Campos obrigatórios', 'Selecione escola, turma e disciplina para a avaliação.');
    if (!validateBlockedDate(examForm.date)) return;
    const subject = findById(data.subjects, examForm.subjectId);
    const item = { ...examForm, id: editingItem?.sourceType === 'exam' ? editingItem.originalId : uid(), title: examForm.title.trim() || `Avaliação de ${subject?.name || 'disciplina'}`, attachmentName: examForm.attachmentName.trim() };
    const reminders = editingItem?.sourceType === 'exam' ? [] : previousLessonReminderCommitments(item);
    setData((prev) => ({
      ...prev,
      exams: editingItem?.sourceType === 'exam' ? prev.exams.map((e) => e.id === item.id ? item : e) : [...prev.exams, item],
      commitments: [...prev.commitments, ...reminders],
    }));
    resetExamForm(); setEditingItem(null); setModalMode(null); setModalOpen(false);
  };

  const openEventActions = (event) => setEventActions(event);
  const deleteEvent = () => {
    if (!eventActions) return;
    setData((prev) => {
      if (eventActions.sourceType === 'lesson') return { ...prev, lessons: prev.lessons.filter((item) => item.id !== eventActions.originalId) };
      if (eventActions.sourceType === 'commitment') return { ...prev, commitments: prev.commitments.filter((item) => item.id !== eventActions.originalId) };
      if (eventActions.sourceType === 'exam') return { ...prev, exams: prev.exams.filter((item) => item.id !== eventActions.originalId) };
      return prev;
    });
    setEventActions(null);
  };
  const editEvent = () => {
    if (!eventActions) return;
    setEditingItem(eventActions);
    if (eventActions.sourceType === 'lesson') {
      const item = findById(data.lessons, eventActions.originalId);
      if (item) setLessonForm({ lessonType: item.lessonType || 'recurring', schoolId: item.schoolId || '', classId: item.classId || '', subjectId: item.subjectId || '', weekday: item.weekday ?? 1, startDate: item.startDate || todayKey(), date: item.date || todayKey(), startTime: item.startTime || '07:00', endTime: item.endTime || '07:50', reminder: item.reminder || '10min' });
      setModalMode('lesson');
    } else if (eventActions.sourceType === 'commitment') {
      const item = findById(data.commitments, eventActions.originalId);
      if (item) setCommitmentForm({ type: item.type || COMMITMENT_TYPES[0], title: item.title || '', description: item.description || '', schoolId: item.schoolId || '', date: item.date || todayKey(), time: item.time || '08:00', recurrence: item.recurrence || 'Não repetir', reminder: item.reminder || '10min' });
      setModalMode('commitment');
    } else if (eventActions.sourceType === 'exam') {
      const item = findById(data.exams, eventActions.originalId);
      if (item) setExamForm({ title: item.title || '', schoolId: item.schoolId || '', classId: item.classId || '', subjectId: item.subjectId || '', date: item.date || todayKey(), time: item.time || '08:00', reminder: item.reminder || '1day', attachmentName: item.attachmentName || '' });
      setModalMode('exam');
    }
    setEventActions(null);
    setModalOpen(true);
  };

  const chooseCalendar = (field) => { setCalendarTargetField(field); setCalendarPickerOpen(true); };
  const applyCalendarDate = (dateKey) => {
    if (calendarTargetField === 'commitmentDate') setCommitmentForm((prev) => ({ ...prev, date: dateKey }));
    if (calendarTargetField === 'lessonStartDate') setLessonForm((prev) => ({ ...prev, startDate: dateKey }));
    if (calendarTargetField === 'lessonDate') setLessonForm((prev) => ({ ...prev, date: dateKey, weekday: parseDateKey(dateKey).getDay() }));
    if (calendarTargetField === 'examDate') setExamForm((prev) => ({ ...prev, date: dateKey }));
    setCalendarPickerOpen(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <Header teacherName={data.profile.teacherName} />
        <View style={styles.body}>
          {activeTab === 'Hoje' && <TodayTab events={todaysEvents} counts={counts} onEventPress={openEventActions} />}
          {activeTab === 'Semana' && <WeekTab events={weekEvents} weekStart={weekStart} weekEnd={weekEnd} weeklyLessonCount={weeklyLessonCount} onEventPress={openEventActions} />}
          {activeTab === 'Calendário' && <CalendarTab monthCells={monthCells} selectedDate={selectedDate} setSelectedDate={setSelectedDate} selectedDayEvents={selectedDayEvents} eventCountByDay={eventCountByDay} viewMonth={viewMonth} setViewMonth={setViewMonth} onEventPress={openEventActions} />}
          {activeTab === 'Avaliações' && <ExamsTab exams={data.exams} data={data} monthCells={monthCells} selectedDate={selectedDate} setSelectedDate={setSelectedDate} examCountByDay={examCountByDay} viewMonth={viewMonth} setViewMonth={setViewMonth} onEventPress={openEventActions} />}
          {activeTab === 'Gestão' && <ManagementTab data={data} counts={counts} openManage={setManagementModal} />}
          {activeTab === 'Configurações' && <SettingsTab profile={data.profile} updateProfile={updateProfile} />}
        </View>
        <BottomTabs activeTab={activeTab} setActiveTab={setActiveTab} />
        <Pressable style={styles.fab} onPress={openCreateMenu}><Text style={styles.fabIcon}>＋</Text></Pressable>
      </View>

      <CreateModal
        visible={modalOpen}
        modalMode={modalMode}
        setModalMode={setModalMode}
        close={() => { setModalOpen(false); setModalMode(null); setEditingItem(null); }}
        data={data}
        lessonForm={lessonForm}
        setLessonForm={setLessonForm}
        commitmentForm={commitmentForm}
        setCommitmentForm={setCommitmentForm}
        examForm={examForm}
        setExamForm={setExamForm}
        saveLesson={saveLesson}
        saveCommitment={saveCommitment}
        saveExam={saveExam}
        chooseCalendar={chooseCalendar}
        editingItem={editingItem}
      />
      <CalendarPicker visible={calendarPickerOpen} value={selectedDate} onClose={() => setCalendarPickerOpen(false)} onSelect={applyCalendarDate} />
      <ManagementModal type={managementModal} onClose={() => setManagementModal(null)} schoolForm={schoolForm} setSchoolForm={setSchoolForm} classForm={classForm} setClassForm={setClassForm} subjectForm={subjectForm} setSubjectForm={setSubjectForm} saveSchool={saveSchool} saveClass={saveClass} saveSubject={saveSubject} />
      <EventActionsModal event={eventActions} onClose={() => setEventActions(null)} onEdit={editEvent} onDelete={deleteEvent} />
    </SafeAreaView>
  );
}

function Header({ teacherName }) {
  return (
    <View style={styles.header}>
      <View style={styles.logoWrap}>
        <View style={styles.logoBadge}><Image source={require('./assets/icon.png')} style={styles.logoImage} resizeMode="contain" /></View>
        <View style={styles.logoTextWrap}>
          <Text style={styles.brand}>Agenda Prof</Text>
          <Text style={styles.brandSub}>{teacherName ? `Olá, ${teacherName}` : 'Organize • Planeje • Conquiste'}</Text>
        </View>
      </View>
      <Text style={styles.headerHighlight}>Hoje</Text>
    </View>
  );
}

function TodayTab({ events, counts, onEventPress }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.heroCard}><Text style={styles.heroTitle}>{longDate(new Date())}</Text><Text style={styles.heroParagraph}>Visualize rapidamente as próximas aulas, compromissos e avaliações do dia.</Text></View>
      <View style={styles.statsRow}><StatCard label="Escolas" value={counts.schools} /><StatCard label="Turmas" value={counts.classes} /><StatCard label="Avaliações" value={counts.exams} /></View>
      <SectionTitle title="Próximas tarefas do dia" />
      {events.length === 0 ? <EmptyState text="Nenhum item programado para hoje." /> : events.map((event) => <EventCard key={event.id} event={event} onPress={onEventPress} />)}
    </ScrollView>
  );
}

function WeekTab({ events, weekStart, weekEnd, weeklyLessonCount, onEventPress }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <SectionTitle title="Tarefas da Semana" subtitle={`${weekStart.toLocaleDateString('pt-BR')} até ${weekEnd.toLocaleDateString('pt-BR')}`} />
      {events.length === 0 ? <EmptyState text="Nenhuma tarefa programada nesta semana." /> : events.map((event) => <EventCard key={event.id} event={event} onPress={onEventPress} />)}
      <View style={styles.weekTotalCard}><Text style={styles.weekTotalText}>Você possui {weeklyLessonCount} aulas semanais 😅</Text></View>
    </ScrollView>
  );
}

function CalendarTab({ monthCells, selectedDate, setSelectedDate, selectedDayEvents, eventCountByDay, viewMonth, setViewMonth, onEventPress }) {
  const holidayName = isNationalHoliday(selectedDate);
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <MonthCalendar monthCells={monthCells} selectedDate={selectedDate} setSelectedDate={setSelectedDate} countByDay={eventCountByDay} viewMonth={viewMonth} setViewMonth={setViewMonth} />
      <CalendarLegend />
      <SectionTitle title={`Agenda de ${shortDate(selectedDate)}`} />
      {holidayName ? <HolidayState name={holidayName} /> : selectedDayEvents.length === 0 ? <EmptyState text="Nenhuma tarefa neste dia." /> : selectedDayEvents.map((event) => <EventCard key={event.id} event={event} onPress={onEventPress} />)}
    </ScrollView>
  );
}

function ExamsTab({ exams, data, monthCells, selectedDate, setSelectedDate, examCountByDay, viewMonth, setViewMonth, onEventPress }) {
  const holidayName = isNationalHoliday(selectedDate);
  const selectedExams = holidayName ? [] : exams.filter((exam) => exam.date === selectedDate && !isAfterSchoolYearEnd(exam.date, data.profile?.schoolYearEnd));
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <SectionTitle title="Calendário de Avaliações" subtitle="Acompanhe provas e revisões programadas." />
      <MonthCalendar monthCells={monthCells} selectedDate={selectedDate} setSelectedDate={setSelectedDate} countByDay={examCountByDay} viewMonth={viewMonth} setViewMonth={setViewMonth} markerColor={palette.danger} />
      <CalendarLegend />
      <SectionTitle title={`Avaliações de ${shortDate(selectedDate)}`} />
      {holidayName ? <HolidayState name={holidayName} /> : selectedExams.length === 0 ? <EmptyState text="Nenhuma avaliação neste dia." /> : selectedExams.map((exam) => {
        const school = findById(data.schools, exam.schoolId); const classItem = findById(data.classes, exam.classId); const subject = findById(data.subjects, exam.subjectId);
        return <EventCard key={exam.id} event={{ id: `exam-${exam.id}`, originalId: exam.id, sourceType: 'exam', eventType: 'avaliação', title: exam.title || `Avaliação de ${subject?.name || 'disciplina'}`, subtitle: `${classItem?.name || 'Turma'} • ${school?.name || 'Escola'}`, date: exam.date, sortTime: exam.time || '00:00', timeLabel: exam.time || '--:--', color: palette.danger, description: exam.attachmentName ? `Prova/anexo: ${exam.attachmentName}` : '' }} onPress={onEventPress} />;
      })}
    </ScrollView>
  );
}

function MonthCalendar({ monthCells, selectedDate, setSelectedDate, countByDay, viewMonth, setViewMonth, markerColor = palette.accent }) {
  return (
    <View style={styles.calendarCard}>
      <View style={styles.calendarHeaderRow}>
        <Pressable style={styles.monthNav} onPress={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}><Text style={styles.monthNavText}>‹</Text></Pressable>
        <Text style={styles.calendarTitle}>{monthTitle(viewMonth)}</Text>
        <Pressable style={styles.monthNav} onPress={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}><Text style={styles.monthNavText}>›</Text></Pressable>
      </View>
      <View style={styles.weekHeader}>{DAYS.map((day) => <Text key={day} style={styles.weekHeaderText}>{day}</Text>)}</View>
      <View style={styles.calendarGrid}>
        {monthCells.map((cell) => {
          const selected = cell.key === selectedDate;
          const holidayName = isNationalHoliday(cell.key);
          const hasEvent = countByDay[cell.key] > 0;
          return (
            <Pressable key={cell.key} onPress={() => setSelectedDate(cell.key)} style={[styles.dayCell, selected && styles.dayCellSelected, holidayName && styles.dayCellHoliday, selected && holidayName && styles.dayCellHolidaySelected, !cell.inMonth && styles.dayCellMuted]}>
              <Text style={[styles.dayCellText, selected && styles.dayCellTextSelected, holidayName && styles.dayCellHolidayText]}>{parseDateKey(cell.key).getDate()}</Text>
              {holidayName ? <Text style={styles.holidayBadge}>FER</Text> : hasEvent ? <View style={[styles.dayDot, { backgroundColor: markerColor }]} /> : <View style={styles.dayDotSpacer} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function CalendarLegend() {
  return <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: palette.danger }]} /><Text style={styles.legendText}>Feriado nacional</Text><View style={[styles.legendDot, { backgroundColor: palette.accent }]} /><Text style={styles.legendText}>Evento</Text></View>;
}
function HolidayState({ name }) { return <View style={styles.holidayState}><Text style={styles.holidayTitle}>Feriado nacional</Text><Text style={styles.holidayText}>{name}. Aulas e eventos recorrentes não são exibidos nesta data.</Text></View>; }

function ManagementTab({ data, counts, openManage }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <SectionTitle title="Gestão do Professor" subtitle="Cadastre uma vez e selecione nos próximos lançamentos." />
      <View style={styles.managementGrid}>
        <ManagementCard title="Escolas" subtitle={`${counts.schools} cadastrada(s)`} button="Nova escola" onPress={() => openManage('school')} />
        <ManagementCard title="Turmas" subtitle={`${counts.classes} cadastrada(s)`} button="Nova turma" onPress={() => openManage('class')} />
        <ManagementCard title="Disciplinas" subtitle={`${counts.subjects} cadastrada(s)`} button="Nova disciplina" onPress={() => openManage('subject')} />
      </View>
      <SectionTitle title="Resumo cadastrado" />
      <SummaryList title="Escolas" items={data.schools.map((item) => item.name)} colors={Object.fromEntries(data.schools.map((item) => [item.name, item.color]))} empty="Nenhuma escola cadastrada." />
      <SummaryList title="Turmas" items={data.classes.map((item) => item.name)} empty="Nenhuma turma cadastrada." />
      <SummaryList title="Disciplinas" items={data.subjects.map((item) => item.name)} empty="Nenhuma disciplina cadastrada." />
    </ScrollView>
  );
}

function SettingsTab({ profile, updateProfile }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <SectionTitle title="Configurações" subtitle="Personalize o aplicativo para sua rotina." />
      <View style={styles.card}>
        <InputField label="Nome do professor" value={profile.teacherName} onChangeText={(text) => updateProfile({ teacherName: text })} placeholder="Ex.: Prof. Matheus" />
        <InputField label="Fim do ano letivo" value={profile.schoolYearEnd || ''} onChangeText={(text) => updateProfile({ schoolYearEnd: text })} placeholder="AAAA-MM-DD. Ex.: 2026-12-20" />
        <Text style={styles.helperText}>Quando preenchida, aulas, compromissos e avaliações só aparecem até essa data.</Text>
        <SwitchRow label="Modo compacto" value={profile.compactMode} onValueChange={(value) => updateProfile({ compactMode: value })} />
        <SwitchRow label="Notificações locais (preparação)" value={profile.notifications} onValueChange={(value) => updateProfile({ notifications: value })} />
      </View>
    </ScrollView>
  );
}

function CreateModal(props) {
  const { visible, modalMode, setModalMode, close, data, lessonForm, setLessonForm, commitmentForm, setCommitmentForm, examForm, setExamForm, saveLesson, saveCommitment, saveExam, chooseCalendar, editingItem } = props;
  const titlePrefix = editingItem ? 'Editar' : 'Nova';
  const handleStartTime = (text) => setLessonForm((prev) => ({ ...prev, startTime: text, endTime: addMinutesToTime(text, 50) || prev.endTime }));
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.modalBackdrop}><View style={styles.modalCard}>
        {!modalMode && <View><Text style={styles.modalTitle}>Adicionar</Text><Text style={styles.modalSubtitle}>Escolha o que deseja cadastrar.</Text><ActionButton title="Nova aula" subtitle="Recorrente ou isolada" onPress={() => setModalMode('lesson')} /><ActionButton title="Novo compromisso" subtitle="Reuniões, entregas e outros" onPress={() => setModalMode('commitment')} /><ActionButton title="Nova avaliação" subtitle="Provas, anexos e lembretes de revisão" onPress={() => setModalMode('exam')} /><SecondaryButton title="Fechar" onPress={close} /></View>}
        {modalMode === 'lesson' && <ScrollView showsVerticalScrollIndicator={false}><Text style={styles.modalTitle}>{titlePrefix} aula</Text><SegmentedChoice options={[{ label: 'Recorrente', value: 'recurring' }, { label: 'Aula isolada', value: 'single' }]} value={lessonForm.lessonType} onChange={(value) => setLessonForm((prev) => ({ ...prev, lessonType: value }))} /><SelectField label="Escola" placeholder="Selecione uma escola" value={lessonForm.schoolId} options={data.schools.map((item) => ({ label: item.name, value: item.id, color: item.color }))} onChange={(value) => setLessonForm((prev) => ({ ...prev, schoolId: value }))} /><SelectField label="Turma" placeholder="Selecione uma turma" value={lessonForm.classId} options={data.classes.map((item) => ({ label: item.name, value: item.id }))} onChange={(value) => setLessonForm((prev) => ({ ...prev, classId: value }))} /><SelectField label="Disciplina" placeholder="Selecione uma disciplina" value={lessonForm.subjectId} options={data.subjects.map((item) => ({ label: item.name, value: item.id }))} onChange={(value) => setLessonForm((prev) => ({ ...prev, subjectId: value }))} />{lessonForm.lessonType === 'single' ? <DateButton label="Data da aula isolada" value={lessonForm.date} onPress={() => chooseCalendar('lessonDate')} /> : <><SelectField label="Dia da semana" value={lessonForm.weekday} options={WEEKDAY_OPTIONS} onChange={(value) => setLessonForm((prev) => ({ ...prev, weekday: value }))} /><DateButton label="Incluir aulas a partir de" value={lessonForm.startDate} onPress={() => chooseCalendar('lessonStartDate')} /></>}<View style={styles.rowGap}><InputField label="Início" value={lessonForm.startTime} onChangeText={handleStartTime} placeholder="07:00" /><InputField label="Fim" value={lessonForm.endTime} onChangeText={(text) => setLessonForm((prev) => ({ ...prev, endTime: text }))} placeholder="07:50" /></View><SelectField label="Lembrete" value={lessonForm.reminder} options={[{ label: '10 minutos antes', value: '10min' }]} onChange={(value) => setLessonForm((prev) => ({ ...prev, reminder: value }))} /><PrimaryButton title="Salvar aula" onPress={saveLesson} /><SecondaryButton title="Voltar" onPress={() => setModalMode(null)} /></ScrollView>}
        {modalMode === 'commitment' && <ScrollView showsVerticalScrollIndicator={false}><Text style={styles.modalTitle}>{titlePrefix} compromisso</Text><SelectField label="Tipo" value={commitmentForm.type} options={COMMITMENT_TYPES.map((item) => ({ label: item, value: item }))} onChange={(value) => setCommitmentForm((prev) => ({ ...prev, type: value }))} /><InputField label="Título" value={commitmentForm.title} onChangeText={(text) => setCommitmentForm((prev) => ({ ...prev, title: text }))} placeholder="Ex.: Entregar notas" /><InputField label="Descrição" multiline value={commitmentForm.description} onChangeText={(text) => setCommitmentForm((prev) => ({ ...prev, description: text }))} placeholder="Observações" /><SelectField label="Escola (opcional)" placeholder="Sem escola vinculada" value={commitmentForm.schoolId} options={[{ label: 'Sem escola vinculada', value: '' }, ...data.schools.map((item) => ({ label: item.name, value: item.id, color: item.color }))]} onChange={(value) => setCommitmentForm((prev) => ({ ...prev, schoolId: value }))} /><DateButton label="Data" value={commitmentForm.date} onPress={() => chooseCalendar('commitmentDate')} /><View style={styles.rowGap}><InputField label="Horário" value={commitmentForm.time} onChangeText={(text) => setCommitmentForm((prev) => ({ ...prev, time: text }))} placeholder="14:00" /><SelectField label="Repetição" value={commitmentForm.recurrence} options={RECURRENCE_OPTIONS.map((item) => ({ label: item, value: item }))} onChange={(value) => setCommitmentForm((prev) => ({ ...prev, recurrence: value }))} /></View><SelectField label="Lembrete" value={commitmentForm.reminder} options={REMINDER_OPTIONS} onChange={(value) => setCommitmentForm((prev) => ({ ...prev, reminder: value }))} /><PrimaryButton title="Salvar compromisso" onPress={saveCommitment} /><SecondaryButton title="Voltar" onPress={() => setModalMode(null)} /></ScrollView>}
        {modalMode === 'exam' && <ScrollView showsVerticalScrollIndicator={false}><Text style={styles.modalTitle}>{titlePrefix} avaliação</Text><InputField label="Título da avaliação" value={examForm.title} onChangeText={(text) => setExamForm((prev) => ({ ...prev, title: text }))} placeholder="Ex.: Prova bimestral" /><SelectField label="Escola" value={examForm.schoolId} options={data.schools.map((item) => ({ label: item.name, value: item.id, color: item.color }))} onChange={(value) => setExamForm((prev) => ({ ...prev, schoolId: value }))} /><SelectField label="Turma" value={examForm.classId} options={data.classes.map((item) => ({ label: item.name, value: item.id }))} onChange={(value) => setExamForm((prev) => ({ ...prev, classId: value }))} /><SelectField label="Disciplina" value={examForm.subjectId} options={data.subjects.map((item) => ({ label: item.name, value: item.id }))} onChange={(value) => setExamForm((prev) => ({ ...prev, subjectId: value }))} /><DateButton label="Data da avaliação" value={examForm.date} onPress={() => chooseCalendar('examDate')} /><InputField label="Horário" value={examForm.time} onChangeText={(text) => setExamForm((prev) => ({ ...prev, time: text }))} placeholder="08:00" /><SelectField label="Lembrete" value={examForm.reminder} options={REMINDER_OPTIONS} onChange={(value) => setExamForm((prev) => ({ ...prev, reminder: value }))} /><InputField label="Anexo da prova (opcional)" value={examForm.attachmentName} onChangeText={(text) => setExamForm((prev) => ({ ...prev, attachmentName: text }))} placeholder="Nome do arquivo ou observação" /><PrimaryButton title="Salvar avaliação" onPress={saveExam} /><SecondaryButton title="Voltar" onPress={() => setModalMode(null)} /></ScrollView>}
      </View></View>
    </Modal>
  );
}

function DateButton({ label, value, onPress }) { return <Pressable style={styles.calendarField} onPress={onPress}><Text style={styles.inputLabel}>{label}</Text><Text style={styles.calendarFieldText}>{shortDate(value)}</Text><Text style={styles.calendarFieldHint}>Toque para abrir o calendário</Text></Pressable>; }
function SegmentedChoice({ options, value, onChange }) { return <View style={styles.segmentedWrap}>{options.map((option) => <Pressable key={option.value} style={[styles.segmentedButton, value === option.value && styles.segmentedButtonActive]} onPress={() => onChange(option.value)}><Text style={[styles.segmentedText, value === option.value && styles.segmentedTextActive]}>{option.label}</Text></Pressable>)}</View>; }
function EventActionsModal({ event, onClose, onEdit, onDelete }) { return <Modal visible={!!event} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>{event?.title || 'Evento'}</Text><Text style={styles.modalSubtitle}>{event?.subtitle || ''}</Text><ActionButton title="Editar" subtitle="Alterar dados deste evento" onPress={onEdit} /><ActionButton title="Excluir" subtitle="Remover este evento" onPress={() => Alert.alert('Excluir evento', 'Deseja realmente excluir este item?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: onDelete }])} /><SecondaryButton title="Fechar" onPress={onClose} /></View></View></Modal>; }

function ManagementModal({ type, onClose, schoolForm, setSchoolForm, classForm, setClassForm, subjectForm, setSubjectForm, saveSchool, saveClass, saveSubject }) {
  return <Modal visible={!!type} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalCard}>{type === 'school' && <View style={styles.manageModalCard}><Text style={styles.modalTitle}>Nova escola</Text><InputField label="Nome da escola" value={schoolForm.name} onChangeText={(text) => setSchoolForm((prev) => ({ ...prev, name: text }))} placeholder="Ex.: Escola Estadual Central" inputStyle={styles.manageInput} /><Text style={styles.inputLabel}>Cor de identificação</Text><View style={styles.colorRow}>{SCHOOL_COLORS.map((color) => <Pressable key={color} onPress={() => setSchoolForm((prev) => ({ ...prev, color }))} style={[styles.colorBubble, { backgroundColor: color }, schoolForm.color === color && styles.colorBubbleSelected]} />)}</View><View style={styles.manageButtonsWrap}><PrimaryButton title="Salvar escola" onPress={saveSchool} /><SecondaryButton title="Cancelar" onPress={onClose} /></View></View>}{type === 'class' && <View style={styles.manageModalCard}><Text style={styles.modalTitle}>Nova turma</Text><InputField label="Nome da turma" value={classForm.name} onChangeText={(text) => setClassForm({ name: text })} placeholder="Ex.: 1º ano 1" inputStyle={styles.manageInput} /><View style={styles.manageButtonsWrap}><PrimaryButton title="Salvar turma" onPress={saveClass} /><SecondaryButton title="Cancelar" onPress={onClose} /></View></View>}{type === 'subject' && <View style={styles.manageModalCard}><Text style={styles.modalTitle}>Nova disciplina</Text><InputField label="Nome da disciplina" value={subjectForm.name} onChangeText={(text) => setSubjectForm({ name: text })} placeholder="Ex.: História" inputStyle={styles.manageInput} /><View style={styles.manageButtonsWrap}><PrimaryButton title="Salvar disciplina" onPress={saveSubject} /><SecondaryButton title="Cancelar" onPress={onClose} /></View></View>}</View></View></Modal>;
}

function CalendarPicker({ visible, value, onClose, onSelect }) {
  const [pickerDate, setPickerDate] = useState(value ? parseDateKey(value) : new Date());
  useEffect(() => { if (visible) setPickerDate(value ? parseDateKey(value) : new Date()); }, [visible, value]);
  const cells = buildMonthCells(pickerDate);
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>Selecione a data</Text><MonthCalendar monthCells={cells} selectedDate={value} setSelectedDate={onSelect} countByDay={{}} viewMonth={pickerDate} setViewMonth={setPickerDate} /><CalendarLegend /><SecondaryButton title="Fechar" onPress={onClose} /></View></View></Modal>;
}

function EventCard({ event, onPress }) { return <Pressable style={styles.eventCard} onPress={() => onPress?.(event)}><View style={[styles.eventColor, { backgroundColor: event.color }]} /><View style={styles.eventContent}><View style={styles.eventTopRow}><Text style={styles.eventTitle}>{event.title}</Text><Text style={styles.eventTime}>{event.timeLabel}</Text></View><Text style={styles.eventSubtitle}>{event.subtitle}</Text><Text style={styles.eventDate}>{shortDate(event.date)} • {event.eventType}</Text>{event.description ? <Text style={styles.eventDescription}>{event.description}</Text> : null}</View></Pressable>; }
function BottomTabs({ activeTab, setActiveTab }) { const tabs = ['Hoje', 'Semana', 'Calendário', 'Avaliações', 'Gestão', 'Configurações']; return <View style={styles.tabsWrap}>{tabs.map((tab) => <Pressable key={tab} style={[styles.tabItem, activeTab === tab && styles.tabItemActive]} onPress={() => setActiveTab(tab)}><Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text></Pressable>)}</View>; }
function ActionButton({ title, subtitle, onPress }) { return <Pressable style={styles.actionButton} onPress={onPress}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionSubtitle}>{subtitle}</Text></Pressable>; }
function PrimaryButton({ title, onPress }) { return <Pressable style={styles.primaryButton} onPress={onPress}><Text style={styles.primaryButtonText}>{title}</Text></Pressable>; }
function SecondaryButton({ title, onPress }) { return <Pressable style={styles.secondaryButton} onPress={onPress}><Text style={styles.secondaryButtonText}>{title}</Text></Pressable>; }
function SectionTitle({ title, subtitle }) { return <View style={styles.sectionTitleWrap}><Text style={styles.sectionTitle}>{title}</Text>{subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}</View>; }
function EmptyState({ text }) { return <View style={styles.emptyCard}><Text style={styles.emptyText}>{text}</Text></View>; }
function StatCard({ label, value }) { return <View style={styles.statCard}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function ManagementCard({ title, subtitle, button, onPress }) { return <View style={styles.managementCard}><Text style={styles.managementTitle}>{title}</Text><Text style={styles.managementSubtitle}>{subtitle}</Text><Pressable style={styles.miniButton} onPress={onPress}><Text style={styles.miniButtonText}>{button}</Text></Pressable></View>; }
function SummaryList({ title, items, empty, colors = {} }) { return <View style={styles.card}><Text style={styles.summaryTitle}>{title}</Text>{items.length === 0 ? <Text style={styles.summaryEmpty}>{empty}</Text> : items.map((item) => <View key={item} style={styles.summaryRow}><View style={[styles.summaryBullet, colors[item] ? { backgroundColor: colors[item] } : null]} /><Text style={styles.summaryItem}>{item}</Text></View>)}</View>; }
function SwitchRow({ label, value, onValueChange }) { return <View style={styles.switchRow}><Text style={styles.switchLabel}>{label}</Text><Switch value={value} onValueChange={onValueChange} thumbColor={palette.white} trackColor={{ false: '#CED8E7', true: palette.primary }} /></View>; }
function InputField({ label, multiline = false, inputStyle, ...props }) { return <View style={styles.inputWrapFlex}><Text style={styles.inputLabel}>{label}</Text><TextInput {...props} placeholderTextColor={palette.muted} multiline={multiline} style={[styles.input, multiline && styles.inputMultiline, inputStyle]} /></View>; }
function SelectField({ label, options, value, onChange, placeholder = 'Selecione' }) { const selected = options.find((item) => item.value === value); return <View style={styles.inputWrapFlex}><Text style={styles.inputLabel}>{label}</Text><View style={styles.selectWrap}>{options.map((option) => { const active = option.value === value; return <Pressable key={`${label}-${String(option.value)}`} onPress={() => onChange(option.value)} style={[styles.selectChip, active && styles.selectChipActive]}>{option.color ? <View style={[styles.selectColorDot, { backgroundColor: option.color }]} /> : null}<Text style={[styles.selectChipText, active && styles.selectChipTextActive]}>{option.label || placeholder}</Text></Pressable>; })}{!selected && value === '' && placeholder ? <Text style={styles.selectPlaceholder}>{placeholder}</Text> : null}</View></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg }, container: { flex: 1, backgroundColor: palette.bg }, body: { flex: 1 },
  header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10, backgroundColor: palette.bg }, logoWrap: { flexDirection: 'row', alignItems: 'center' }, logoBadge: { width: 62, height: 62, borderRadius: 20, backgroundColor: palette.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, marginRight: 12, overflow: 'hidden' }, logoImage: { width: 58, height: 58 }, logoTextWrap: { flex: 1 }, brand: { color: palette.text, fontSize: 24, fontWeight: '900' }, brandSub: { color: palette.muted, fontSize: 13, marginTop: 2 }, headerHighlight: { color: palette.primary, fontWeight: '800', marginTop: 8, fontSize: 18 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 116 }, heroCard: { backgroundColor: palette.white, borderRadius: 26, padding: 18, borderWidth: 1, borderColor: palette.border }, heroTitle: { color: palette.text, fontSize: 22, fontWeight: '900' }, heroParagraph: { color: palette.muted, fontSize: 14, marginTop: 8, lineHeight: 20 }, statsRow: { flexDirection: 'row', marginTop: 14 }, statCard: { flex: 1, backgroundColor: palette.white, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: palette.border, marginRight: 8 }, statValue: { color: palette.primary, fontSize: 22, fontWeight: '900' }, statLabel: { color: palette.muted, fontSize: 12, marginTop: 4 },
  sectionTitleWrap: { marginTop: 18, marginBottom: 10 }, sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '800' }, sectionSubtitle: { color: palette.muted, fontSize: 13, marginTop: 2 },
  eventCard: { flexDirection: 'row', backgroundColor: palette.white, borderRadius: 22, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: palette.border }, eventColor: { width: 7 }, eventContent: { flex: 1, padding: 14 }, eventTopRow: { flexDirection: 'row', justifyContent: 'space-between' }, eventTitle: { color: palette.text, fontSize: 15, fontWeight: '800', flex: 1 }, eventTime: { color: palette.accent, fontSize: 13, fontWeight: '800' }, eventSubtitle: { color: palette.muted, fontSize: 13, marginTop: 6 }, eventDate: { color: palette.text, fontSize: 12, marginTop: 8 }, eventDescription: { color: palette.muted, fontSize: 12, marginTop: 8, lineHeight: 18 },
  tabsWrap: { position: 'absolute', left: 10, right: 10, bottom: 12, backgroundColor: palette.white, borderRadius: 24, flexDirection: 'row', padding: 6, borderWidth: 1, borderColor: palette.border, justifyContent: 'space-between' }, tabItem: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 17, paddingHorizontal: 2 }, tabItemActive: { backgroundColor: palette.primary }, tabText: { color: palette.muted, fontSize: 10, fontWeight: '700', textAlign: 'center' }, tabTextActive: { color: palette.white },
  fab: { position: 'absolute', right: 22, bottom: 92, width: 62, height: 62, borderRadius: 24, backgroundColor: palette.accent, justifyContent: 'center', alignItems: 'center', elevation: 8 }, fabIcon: { color: palette.white, fontSize: 32, fontWeight: '900', marginTop: -2 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(16,37,68,0.45)', justifyContent: 'center', padding: 16 }, modalCard: { backgroundColor: palette.white, borderRadius: 26, padding: 18, maxHeight: '90%', borderWidth: 1, borderColor: palette.border }, modalTitle: { color: palette.text, fontSize: 22, fontWeight: '900' }, modalSubtitle: { color: palette.muted, fontSize: 13, marginTop: 4, marginBottom: 16, lineHeight: 18 }, actionButton: { backgroundColor: palette.bgSoft, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: palette.border }, actionTitle: { color: palette.text, fontSize: 16, fontWeight: '800' }, actionSubtitle: { color: palette.muted, fontSize: 13, marginTop: 6 }, primaryButton: { backgroundColor: palette.primary, paddingVertical: 15, borderRadius: 18, alignItems: 'center', marginTop: 12 }, primaryButtonText: { color: palette.white, fontSize: 15, fontWeight: '900' }, secondaryButton: { backgroundColor: palette.white, paddingVertical: 14, borderRadius: 18, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: palette.border }, secondaryButtonText: { color: palette.text, fontSize: 14, fontWeight: '800' },
  inputWrapFlex: { flex: 1, marginBottom: 12 }, inputLabel: { color: palette.text, fontSize: 13, fontWeight: '800', marginBottom: 7 }, input: { backgroundColor: palette.bgSoft, color: palette.text, borderRadius: 16, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14 }, inputMultiline: { minHeight: 88, textAlignVertical: 'top' }, helperText: { color: palette.muted, fontSize: 12, marginTop: -4, marginBottom: 12 }, rowGap: { flexDirection: 'row' }, calendarField: { backgroundColor: palette.bgSoft, borderRadius: 16, borderWidth: 1, borderColor: palette.border, padding: 14, marginBottom: 12 }, calendarFieldText: { color: palette.text, fontSize: 15, fontWeight: '800' }, calendarFieldHint: { color: palette.muted, fontSize: 12, marginTop: 6 },
  calendarCard: { backgroundColor: palette.white, borderRadius: 24, padding: 14, borderWidth: 1, borderColor: palette.border }, calendarHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, calendarTitle: { color: palette.text, fontSize: 16, fontWeight: '900' }, monthNav: { width: 40, height: 40, borderRadius: 14, backgroundColor: palette.bgSoft, alignItems: 'center', justifyContent: 'center' }, monthNavText: { color: palette.primary, fontSize: 22, fontWeight: '900' }, weekHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }, weekHeaderText: { width: '14.285%', textAlign: 'center', color: palette.muted, fontSize: 12, fontWeight: '800' }, calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' }, dayCell: { width: '14.285%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16 }, dayCellSelected: { backgroundColor: palette.primary }, dayCellMuted: { opacity: 0.35 }, dayCellText: { color: palette.text, fontSize: 13, fontWeight: '800' }, dayCellTextSelected: { color: palette.white }, dayDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 }, dayDotSpacer: { width: 6, height: 6, marginTop: 4 }, dayCellHoliday: { backgroundColor: '#FDECEC', borderWidth: 1, borderColor: '#F6B5B5' }, dayCellHolidaySelected: { backgroundColor: palette.danger }, dayCellHolidayText: { color: palette.danger }, holidayBadge: { fontSize: 8, fontWeight: '900', color: palette.danger, marginTop: 2 }, legendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginLeft: 6 }, legendDot: { width: 9, height: 9, borderRadius: 5, marginRight: 5 }, legendText: { fontSize: 12, color: palette.muted, marginRight: 14 }, holidayState: { backgroundColor: '#FDECEC', borderColor: '#F6B5B5', borderWidth: 1, borderRadius: 20, padding: 16 }, holidayTitle: { color: palette.danger, fontSize: 16, fontWeight: '900' }, holidayText: { color: palette.text, fontSize: 13, marginTop: 6, lineHeight: 18 },
  emptyCard: { backgroundColor: palette.white, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: palette.border }, emptyText: { color: palette.muted, fontSize: 14 }, weekTotalCard: { backgroundColor: palette.primarySoft, borderRadius: 18, padding: 16, marginTop: 12 }, weekTotalText: { color: palette.primary, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  managementGrid: { marginBottom: 12 }, managementCard: { backgroundColor: palette.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: palette.border, marginBottom: 12 }, managementTitle: { color: palette.text, fontSize: 16, fontWeight: '800' }, managementSubtitle: { color: palette.muted, fontSize: 13, marginTop: 4 }, miniButton: { alignSelf: 'flex-start', backgroundColor: palette.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, marginTop: 12 }, miniButtonText: { color: palette.white, fontWeight: '800', fontSize: 13 }, card: { backgroundColor: palette.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: palette.border, marginBottom: 12 }, summaryTitle: { color: palette.text, fontWeight: '800', fontSize: 15, marginBottom: 10 }, summaryEmpty: { color: palette.muted, fontSize: 13 }, summaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 }, summaryBullet: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.primary, marginRight: 10 }, summaryItem: { color: palette.text, fontSize: 14 }, colorRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }, colorBubble: { width: 42, height: 42, borderRadius: 21, marginRight: 10, marginBottom: 10 }, colorBubbleSelected: { borderWidth: 4, borderColor: palette.text }, manageModalCard: { backgroundColor: palette.white, borderRadius: 24 }, manageInput: { minHeight: 58, fontSize: 16 }, manageButtonsWrap: { marginTop: 10 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 12 }, switchLabel: { color: palette.text, fontSize: 14, flex: 1, paddingRight: 10 }, selectWrap: { backgroundColor: palette.bgSoft, borderRadius: 16, borderWidth: 1, borderColor: palette.border, padding: 10 }, selectChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: palette.white, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: palette.border }, selectChipActive: { backgroundColor: palette.primary }, selectChipText: { color: palette.text, fontSize: 13, fontWeight: '700' }, selectChipTextActive: { color: palette.white }, selectColorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 }, selectPlaceholder: { color: palette.muted, fontSize: 12, marginTop: 2 }, segmentedWrap: { flexDirection: 'row', backgroundColor: palette.bgSoft, borderRadius: 16, padding: 4, marginVertical: 12 }, segmentedButton: { flex: 1, paddingVertical: 11, borderRadius: 13, alignItems: 'center' }, segmentedButtonActive: { backgroundColor: palette.primary }, segmentedText: { color: palette.muted, fontSize: 13, fontWeight: '800' }, segmentedTextActive: { color: palette.white },
});

export default App;
