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
const parseDateKey = (key) => {
  const [y, m, d] = String(key || toDateKey(new Date())).split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};
const todayKey = () => toDateKey(new Date());
const monthTitle = (date) =>
  date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, (s) => s.toUpperCase());
const longDate = (date) =>
  date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).replace(/^./, (s) => s.toUpperCase());
const shortDate = (dateKey) => parseDateKey(dateKey).toLocaleDateString('pt-BR');
const compareTime = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const startOfWeek = (date) => {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(12, 0, 0, 0);
  return copy;
};
const endOfWeek = (date) => {
  const start = startOfWeek(date);
  const copy = new Date(start);
  copy.setDate(start.getDate() + 6);
  return copy;
};
const addDays = (date, days) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};
const isWithinRange = (date, start, end) => date >= start && date <= end;

function addMinutesToTime(time, minutesToAdd = 50) {
  const match = String(time || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '';
  let hours = Number(match[1]);
  let minutes = Number(match[2]) + minutesToAdd;
  hours += Math.floor(minutes / 60);
  minutes %= 60;
  hours %= 24;
  return `${pad(hours)}:${pad(minutes)}`;
}

function normalizeData(parsed) {
  return {
    ...initialData,
    ...parsed,
    profile: { ...initialData.profile, ...(parsed?.profile || {}) },
    schools: Array.isArray(parsed?.schools) ? parsed.schools : [],
    classes: Array.isArray(parsed?.classes) ? parsed.classes : [],
    subjects: Array.isArray(parsed?.subjects) ? parsed.subjects : [],
    lessons: Array.isArray(parsed?.lessons) ? parsed.lessons : [],
    commitments: Array.isArray(parsed?.commitments) ? parsed.commitments : [],
    exams: Array.isArray(parsed?.exams) ? parsed.exams : [],
  };
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
  const target = parseDateKey(dateKey);
  const type = lesson.lessonType || 'recurring';
  if (type === 'single') return lesson.date === dateKey;
  const start = parseDateKey(lesson.startDate || '1900-01-01');
  if (target < start) return false;
  return target.getDay() === lesson.weekday;
}

function buildMonthCells(viewDate) {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const date = addDays(start, i);
    cells.push({
      date,
      key: toDateKey(date),
      inMonth: date.getMonth() === viewDate.getMonth(),
    });
  }
  return cells;
}

function findById(arr, id) {
  return arr.find((item) => item.id === id);
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
  const [managementModal, setManagementModal] = useState(null);

  const [lessonForm, setLessonForm] = useState({
    lessonType: 'recurring',
    schoolId: '',
    classId: '',
    subjectId: '',
    weekday: 1,
    startDate: todayKey(),
    date: todayKey(),
    startTime: '07:00',
    endTime: '07:50',
  });
  const [commitmentForm, setCommitmentForm] = useState({
    type: COMMITMENT_TYPES[0],
    title: '',
    description: '',
    schoolId: '',
    date: todayKey(),
    time: '08:00',
    recurrence: 'Não repetir',
  });
  const [examForm, setExamForm] = useState({
    schoolId: '',
    classId: '',
    subjectId: '',
    title: '',
    date: todayKey(),
    time: '08:00',
    attachmentName: '',
  });
  const [schoolForm, setSchoolForm] = useState({ name: '', color: SCHOOL_COLORS[0] });
  const [classForm, setClassForm] = useState({ name: '' });
  const [subjectForm, setSubjectForm] = useState({ name: '' });

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
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch((error) => {
      console.log('Erro ao salvar dados', error);
    });
  }, [data]);

  const enrichedEvents = useMemo(() => {
    const events = [];
    const current = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const start = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    const end = new Date(current.getFullYear(), current.getMonth() + 2, 0);

    for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
      const dateKey = toDateKey(cursor);
      data.lessons.forEach((lesson) => {
        if (isLessonOnDate(lesson, dateKey)) {
          const school = findById(data.schools, lesson.schoolId);
          const classItem = findById(data.classes, lesson.classId);
          const subject = findById(data.subjects, lesson.subjectId);
          events.push({
            id: `${lesson.id}-${dateKey}`,
            originalId: lesson.id,
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
            eventType: 'avaliação',
            title: exam.title || `Avaliação de ${subject?.name || 'disciplina'}`,
            subtitle: `${classItem?.name || 'Turma'} • ${school?.name || 'Escola'}`,
            date: exam.date,
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
  }, [data, viewMonth]);

  const todaysEvents = enrichedEvents.filter((event) => event.date === todayKey());
  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfWeek(new Date());
  const weekEvents = enrichedEvents.filter((event) => isWithinRange(parseDateKey(event.date), weekStart, weekEnd));
  const selectedDayEvents = enrichedEvents.filter((event) => event.date === selectedDate);
  const monthCells = buildMonthCells(viewMonth);

  const eventCountByDay = useMemo(() => {
    const counts = {};
    enrichedEvents.forEach((event) => {
      counts[event.date] = (counts[event.date] || 0) + 1;
    });
    return counts;
  }, [enrichedEvents]);

  const examCountByDay = useMemo(() => {
    const counts = {};
    data.exams.forEach((exam) => {
      counts[exam.date] = (counts[exam.date] || 0) + 1;
    });
    return counts;
  }, [data.exams]);

  const counts = {
    schools: data.schools.length,
    classes: data.classes.length,
    subjects: data.subjects.length,
    lessons: data.lessons.length,
    commitments: data.commitments.length,
    exams: data.exams.length,
  };

  const weeklyLessonCount = data.lessons.filter((lesson) => (lesson.lessonType || 'recurring') === 'recurring').length;

  const handleLessonStartTime = (text) => {
    setLessonForm((prev) => ({ ...prev, startTime: text, endTime: addMinutesToTime(text, 50) || prev.endTime }));
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
    if (!lessonForm.schoolId || !lessonForm.classId || !lessonForm.subjectId) {
      return Alert.alert('Campos obrigatórios', 'Selecione escola, turma e disciplina.');
    }
    const lessonToSave = {
      id: uid(),
      ...lessonForm,
      weekday: lessonForm.lessonType === 'single' ? parseDateKey(lessonForm.date).getDay() : lessonForm.weekday,
    };
    setData((prev) => ({ ...prev, lessons: [...prev.lessons, lessonToSave] }));
    setLessonForm({
      lessonType: 'recurring',
      schoolId: '',
      classId: '',
      subjectId: '',
      weekday: 1,
      startDate: todayKey(),
      date: todayKey(),
      startTime: '07:00',
      endTime: '07:50',
    });
    setModalMode(null);
    setModalOpen(false);
  };

  const saveCommitment = () => {
    if (!commitmentForm.title.trim()) return Alert.alert('Campo obrigatório', 'Informe um título para o compromisso.');
    setData((prev) => ({
      ...prev,
      commitments: [...prev.commitments, { id: uid(), ...commitmentForm, title: commitmentForm.title.trim(), description: commitmentForm.description.trim() }],
    }));
    setCommitmentForm({ type: COMMITMENT_TYPES[0], title: '', description: '', schoolId: '', date: todayKey(), time: '08:00', recurrence: 'Não repetir' });
    setModalMode(null);
    setModalOpen(false);
  };

  const previousLessonReminderCommitments = (exam) => {
    const examDate = parseDateKey(exam.date);
    const reminders = [];
    for (let i = 1; i <= 120 && reminders.length < 2; i += 1) {
      const candidate = addDays(examDate, -i);
      const candidateKey = toDateKey(candidate);
      const matchingLessons = data.lessons.filter((lesson) =>
        lesson.schoolId === exam.schoolId &&
        lesson.classId === exam.classId &&
        (!exam.subjectId || lesson.subjectId === exam.subjectId) &&
        isLessonOnDate(lesson, candidateKey)
      );
      matchingLessons.forEach((lesson) => {
        if (reminders.length < 2) {
          reminders.push({
            id: uid(),
            type: 'Avaliação',
            title: `Avaliação dessa turma dia ${shortDate(exam.date)}, foco na revisão!!!`,
            description: 'Lembrete criado automaticamente duas aulas antes da avaliação.',
            schoolId: exam.schoolId,
            date: candidateKey,
            time: lesson.startTime || '08:00',
            recurrence: 'Não repetir',
          });
        }
      });
    }
    return reminders;
  };

  const saveExam = () => {
    if (!examForm.schoolId || !examForm.classId || !examForm.subjectId) {
      return Alert.alert('Campos obrigatórios', 'Selecione escola, turma e disciplina para a avaliação.');
    }
    const subject = findById(data.subjects, examForm.subjectId);
    const exam = {
      id: uid(),
      ...examForm,
      title: examForm.title.trim() || `Avaliação de ${subject?.name || 'disciplina'}`,
      attachmentName: examForm.attachmentName.trim(),
    };
    const reminders = previousLessonReminderCommitments(exam);
    setData((prev) => ({ ...prev, exams: [...prev.exams, exam], commitments: [...prev.commitments, ...reminders] }));
    setExamForm({ schoolId: '', classId: '', subjectId: '', title: '', date: todayKey(), time: '08:00', attachmentName: '' });
    setModalMode(null);
    setModalOpen(false);
    Alert.alert('Avaliação salva', reminders.length ? `Também criei ${reminders.length} lembrete(s) de revisão nas aulas anteriores.` : 'Não encontrei aulas anteriores cadastradas para criar lembretes automáticos.');
  };

  const updateProfile = (patch) => setData((prev) => ({ ...prev, profile: { ...prev.profile, ...patch } }));

  const openCalendar = (field) => {
    setCalendarTargetField(field);
    setCalendarPickerOpen(true);
  };

  const handleCalendarSelect = (dateKey) => {
    if (calendarTargetField === 'commitmentDate') setCommitmentForm((prev) => ({ ...prev, date: dateKey }));
    if (calendarTargetField === 'lessonStartDate') setLessonForm((prev) => ({ ...prev, startDate: dateKey }));
    if (calendarTargetField === 'lessonDate') setLessonForm((prev) => ({ ...prev, date: dateKey }));
    if (calendarTargetField === 'examDate') setExamForm((prev) => ({ ...prev, date: dateKey }));
    setCalendarPickerOpen(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <Header teacherName={data.profile.teacherName} />

        <View style={styles.body}>
          {activeTab === 'Hoje' && <TodayTab events={todaysEvents} counts={counts} />}
          {activeTab === 'Semana' && <WeekTab events={weekEvents} weekStart={weekStart} weekEnd={weekEnd} weeklyLessonCount={weeklyLessonCount} />}
          {activeTab === 'Calendário' && (
            <CalendarTab
              monthCells={monthCells}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              selectedDayEvents={selectedDayEvents}
              eventCountByDay={eventCountByDay}
              viewMonth={viewMonth}
              setViewMonth={setViewMonth}
            />
          )}
          {activeTab === 'Gestão' && <ManagementTab data={data} counts={counts} openManage={setManagementModal} />}
          {activeTab === 'Avaliações' && (
            <ExamsTab
              exams={data.exams}
              data={data}
              monthCells={monthCells}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              examCountByDay={examCountByDay}
              viewMonth={viewMonth}
              setViewMonth={setViewMonth}
            />
          )}
          {activeTab === 'Configurações' && <SettingsTab profile={data.profile} updateProfile={updateProfile} />}
        </View>

        <BottomTabs activeTab={activeTab} setActiveTab={setActiveTab} />

        <Pressable style={styles.fab} onPress={() => setModalOpen(true)}>
          <Text style={styles.fabIcon}>＋</Text>
        </Pressable>
      </View>

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {!modalMode && (
              <View>
                <Text style={styles.modalTitle}>Adicionar</Text>
                <Text style={styles.modalSubtitle}>Escolha o que deseja cadastrar agora.</Text>
                <ActionButton title="Nova aula" subtitle="Aula recorrente ou aula isolada" onPress={() => setModalMode('lesson')} />
                <ActionButton title="Novo compromisso" subtitle="Avaliações, reuniões pedagógicas e outros" onPress={() => setModalMode('commitment')} />
                <ActionButton title="Nova avaliação" subtitle="Cria avaliação e lembretes de revisão" onPress={() => setModalMode('exam')} />
                <SecondaryButton title="Fechar" onPress={() => setModalOpen(false)} />
              </View>
            )}

            {modalMode === 'lesson' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>Nova aula</Text>
                <Text style={styles.modalSubtitle}>Escolha se a aula será semanal ou apenas em um dia específico.</Text>
                <View style={styles.choiceRow}>
                  <ChoiceChip active={lessonForm.lessonType === 'recurring'} label="Recorrente" onPress={() => setLessonForm((prev) => ({ ...prev, lessonType: 'recurring' }))} />
                  <ChoiceChip active={lessonForm.lessonType === 'single'} label="Aula isolada" onPress={() => setLessonForm((prev) => ({ ...prev, lessonType: 'single' }))} />
                </View>
                <SelectField label="Escola" placeholder="Selecione uma escola" value={lessonForm.schoolId} options={data.schools.map((item) => ({ label: item.name, value: item.id, color: item.color }))} onChange={(value) => setLessonForm((prev) => ({ ...prev, schoolId: value }))} />
                <SelectField label="Turma" placeholder="Selecione uma turma" value={lessonForm.classId} options={data.classes.map((item) => ({ label: item.name, value: item.id }))} onChange={(value) => setLessonForm((prev) => ({ ...prev, classId: value }))} />
                <SelectField label="Disciplina" placeholder="Selecione uma disciplina" value={lessonForm.subjectId} options={data.subjects.map((item) => ({ label: item.name, value: item.id }))} onChange={(value) => setLessonForm((prev) => ({ ...prev, subjectId: value }))} />
                {lessonForm.lessonType === 'recurring' ? (
                  <>
                    <SelectField label="Dia da semana" value={lessonForm.weekday} options={WEEKDAY_OPTIONS} onChange={(value) => setLessonForm((prev) => ({ ...prev, weekday: value }))} />
                    <DateButton label="Incluir a partir de" value={lessonForm.startDate} onPress={() => openCalendar('lessonStartDate')} />
                  </>
                ) : (
                  <DateButton label="Data da aula isolada" value={lessonForm.date} onPress={() => openCalendar('lessonDate')} />
                )}
                <View style={styles.rowGap}>
                  <InputField label="Início" value={lessonForm.startTime} onChangeText={handleLessonStartTime} placeholder="07:00" />
                  <InputField label="Fim" value={lessonForm.endTime} onChangeText={(text) => setLessonForm((prev) => ({ ...prev, endTime: text }))} placeholder="07:50" />
                </View>
                <Text style={styles.helperText}>Ao digitar o início, o fim é preenchido automaticamente com 50 minutos. Você pode alterar o fim manualmente.</Text>
                <PrimaryButton title="Salvar aula" onPress={saveLesson} />
                <SecondaryButton title="Voltar" onPress={() => setModalMode(null)} />
              </ScrollView>
            )}

            {modalMode === 'commitment' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>Novo compromisso</Text>
                <Text style={styles.modalSubtitle}>Escolha data, tipo e recorrência.</Text>
                <SelectField label="Tipo" value={commitmentForm.type} options={COMMITMENT_TYPES.map((item) => ({ label: item, value: item }))} onChange={(value) => setCommitmentForm((prev) => ({ ...prev, type: value }))} />
                <InputField label="Título" value={commitmentForm.title} onChangeText={(text) => setCommitmentForm((prev) => ({ ...prev, title: text }))} placeholder="Ex.: Entregar notas" />
                <InputField label="Descrição" multiline value={commitmentForm.description} onChangeText={(text) => setCommitmentForm((prev) => ({ ...prev, description: text }))} placeholder="Observações" />
                <SelectField label="Escola (opcional)" placeholder="Sem escola vinculada" value={commitmentForm.schoolId} options={[{ label: 'Sem escola vinculada', value: '' }, ...data.schools.map((item) => ({ label: item.name, value: item.id, color: item.color }))]} onChange={(value) => setCommitmentForm((prev) => ({ ...prev, schoolId: value }))} />
                <DateButton label="Data" value={commitmentForm.date} onPress={() => openCalendar('commitmentDate')} />
                <View style={styles.rowGap}>
                  <InputField label="Horário" value={commitmentForm.time} onChangeText={(text) => setCommitmentForm((prev) => ({ ...prev, time: text }))} placeholder="14:00" />
                  <SelectField label="Repetição" value={commitmentForm.recurrence} options={RECURRENCE_OPTIONS.map((item) => ({ label: item, value: item }))} onChange={(value) => setCommitmentForm((prev) => ({ ...prev, recurrence: value }))} />
                </View>
                <PrimaryButton title="Salvar compromisso" onPress={saveCommitment} />
                <SecondaryButton title="Voltar" onPress={() => setModalMode(null)} />
              </ScrollView>
            )}

            {modalMode === 'exam' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>Nova avaliação</Text>
                <Text style={styles.modalSubtitle}>A avaliação entra no calendário e cria lembretes nas duas aulas anteriores da turma.</Text>
                <SelectField label="Escola" value={examForm.schoolId} options={data.schools.map((item) => ({ label: item.name, value: item.id, color: item.color }))} onChange={(value) => setExamForm((prev) => ({ ...prev, schoolId: value }))} />
                <SelectField label="Turma" value={examForm.classId} options={data.classes.map((item) => ({ label: item.name, value: item.id }))} onChange={(value) => setExamForm((prev) => ({ ...prev, classId: value }))} />
                <SelectField label="Disciplina" value={examForm.subjectId} options={data.subjects.map((item) => ({ label: item.name, value: item.id }))} onChange={(value) => setExamForm((prev) => ({ ...prev, subjectId: value }))} />
                <InputField label="Título da avaliação" value={examForm.title} onChangeText={(text) => setExamForm((prev) => ({ ...prev, title: text }))} placeholder="Ex.: Avaliação bimestral" />
                <DateButton label="Data da avaliação" value={examForm.date} onPress={() => openCalendar('examDate')} />
                <InputField label="Horário" value={examForm.time} onChangeText={(text) => setExamForm((prev) => ({ ...prev, time: text }))} placeholder="08:00" />
                <InputField label="Anexo da prova (opcional)" value={examForm.attachmentName} onChangeText={(text) => setExamForm((prev) => ({ ...prev, attachmentName: text }))} placeholder="Nome do arquivo ou observação" />
                <Text style={styles.helperText}>Nesta versão, o anexo fica registrado como nome/observação. O seletor real de arquivos será feito depois com biblioteca própria.</Text>
                <PrimaryButton title="Salvar avaliação" onPress={saveExam} />
                <SecondaryButton title="Voltar" onPress={() => setModalMode(null)} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <CalendarPicker visible={calendarPickerOpen} value={selectedDate} onClose={() => setCalendarPickerOpen(false)} onSelect={handleCalendarSelect} />

      <ManagementModal type={managementModal} onClose={() => setManagementModal(null)} schoolForm={schoolForm} setSchoolForm={setSchoolForm} classForm={classForm} setClassForm={setClassForm} subjectForm={subjectForm} setSubjectForm={setSubjectForm} saveSchool={saveSchool} saveClass={saveClass} saveSubject={saveSubject} />
    </SafeAreaView>
  );
}

function Header({ teacherName }) {
  return (
    <View style={styles.headerHero}>
      <View style={styles.logoWrap}>
        <View style={styles.logoBadge}>
          <Image source={require('./assets/icon.png')} style={styles.logoImage} resizeMode="contain" />
        </View>
        <View style={styles.headerTextWrap}>
          <Text style={styles.brand}>Agenda Prof</Text>
          <Text style={styles.brandSub}>{teacherName ? `Olá, ${teacherName}` : 'Organize • Planeje • Conquiste'}</Text>
        </View>
      </View>
      <Text style={styles.headerHighlight}>Hoje</Text>
    </View>
  );
}

function TodayTab({ events, counts }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>{longDate(new Date())}</Text>
        <Text style={styles.heroParagraph}>Visualize rapidamente as próximas aulas, compromissos e avaliações do dia.</Text>
      </View>
      <View style={styles.statsRow}>
        <StatCard label="Escolas" value={counts.schools} />
        <StatCard label="Turmas" value={counts.classes} />
        <StatCard label="Avaliações" value={counts.exams} />
      </View>
      <SectionTitle title="Agenda do dia" />
      {events.length === 0 ? <EmptyState text="Nenhum item programado para hoje." /> : events.map((event) => <EventCard key={event.id} event={event} />)}
    </ScrollView>
  );
}

function WeekTab({ events, weekStart, weekEnd, weeklyLessonCount }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <SectionTitle title="Tarefas da Semana" subtitle={`${weekStart.toLocaleDateString('pt-BR')} até ${weekEnd.toLocaleDateString('pt-BR')}`} />
      {events.length === 0 ? <EmptyState text="Nenhuma tarefa programada nesta semana." /> : events.map((event) => <EventCard key={event.id} event={event} />)}
      <View style={styles.weekTotalCard}>
        <Text style={styles.weekTotalText}>Você possui {weeklyLessonCount} aulas semanais 😅</Text>
      </View>
    </ScrollView>
  );
}

function CalendarTab({ monthCells, selectedDate, setSelectedDate, selectedDayEvents, eventCountByDay, viewMonth, setViewMonth }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <MonthCalendar monthCells={monthCells} selectedDate={selectedDate} setSelectedDate={setSelectedDate} countByDay={eventCountByDay} viewMonth={viewMonth} setViewMonth={setViewMonth} />
      <SectionTitle title={`Agenda de ${shortDate(selectedDate)}`} />
      {selectedDayEvents.length === 0 ? <EmptyState text="Nenhuma tarefa neste dia." /> : selectedDayEvents.map((event) => <EventCard key={event.id} event={event} />)}
    </ScrollView>
  );
}

function ExamsTab({ exams, data, monthCells, selectedDate, setSelectedDate, examCountByDay, viewMonth, setViewMonth }) {
  const selectedExams = exams.filter((exam) => exam.date === selectedDate);
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <SectionTitle title="Calendário de Avaliações" subtitle="Acompanhe provas e revisões programadas." />
      <MonthCalendar monthCells={monthCells} selectedDate={selectedDate} setSelectedDate={setSelectedDate} countByDay={examCountByDay} viewMonth={viewMonth} setViewMonth={setViewMonth} markerColor={palette.danger} />
      <SectionTitle title={`Avaliações de ${shortDate(selectedDate)}`} />
      {selectedExams.length === 0 ? <EmptyState text="Nenhuma avaliação neste dia." /> : selectedExams.map((exam) => {
        const school = findById(data.schools, exam.schoolId);
        const classItem = findById(data.classes, exam.classId);
        const subject = findById(data.subjects, exam.subjectId);
        return (
          <View key={exam.id} style={styles.eventCard}>
            <View style={[styles.eventColor, { backgroundColor: palette.danger }]} />
            <View style={styles.eventContent}>
              <View style={styles.eventTopRow}>
                <Text style={styles.eventTitle}>{exam.title || `Avaliação de ${subject?.name || 'disciplina'}`}</Text>
                <Text style={styles.eventTime}>{exam.time || '--:--'}</Text>
              </View>
              <Text style={styles.eventSubtitle}>{classItem?.name || 'Turma'} • {school?.name || 'Escola'}</Text>
              <Text style={styles.eventDate}>{subject?.name || 'Disciplina'}</Text>
              {exam.attachmentName ? <Text style={styles.eventDescription}>Prova/anexo: {exam.attachmentName}</Text> : null}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function MonthCalendar({ monthCells, selectedDate, setSelectedDate, countByDay, viewMonth, setViewMonth, markerColor = palette.accent }) {
  return (
    <View style={styles.calendarCard}>
      <View style={styles.calendarHeaderRow}>
        <Pressable style={styles.monthNav} onPress={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}>
          <Text style={styles.monthNavText}>‹</Text>
        </Pressable>
        <Text style={styles.calendarTitle}>{monthTitle(viewMonth)}</Text>
        <Pressable style={styles.monthNav} onPress={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}>
          <Text style={styles.monthNavText}>›</Text>
        </Pressable>
      </View>
      <View style={styles.weekHeader}>
        {DAYS.map((day) => <Text key={day} style={styles.weekHeaderText}>{day}</Text>)}
      </View>
      <View style={styles.calendarGrid}>
        {monthCells.map((cell) => {
          const selected = cell.key === selectedDate;
          const hasEvent = countByDay[cell.key] > 0;
          return (
            <Pressable key={cell.key} onPress={() => setSelectedDate(cell.key)} style={[styles.dayCell, selected && styles.dayCellSelected, !cell.inMonth && styles.dayCellMuted]}>
              <Text style={[styles.dayCellText, selected && styles.dayCellTextSelected]}>{parseDateKey(cell.key).getDate()}</Text>
              {hasEvent ? <View style={[styles.dayDot, { backgroundColor: markerColor }]} /> : <View style={styles.dayDotSpacer} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

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
        <SwitchRow label="Modo compacto" value={profile.compactMode} onValueChange={(value) => updateProfile({ compactMode: value })} />
        <SwitchRow label="Notificações locais (preparação)" value={profile.notifications} onValueChange={(value) => updateProfile({ notifications: value })} />
      </View>
    </ScrollView>
  );
}

function EventCard({ event }) {
  return (
    <View style={styles.eventCard}>
      <View style={[styles.eventColor, { backgroundColor: event.color }]} />
      <View style={styles.eventContent}>
        <View style={styles.eventTopRow}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.eventTime}>{event.timeLabel}</Text>
        </View>
        <Text style={styles.eventSubtitle}>{event.subtitle}</Text>
        <Text style={styles.eventDate}>{shortDate(event.date)} • {event.eventType}</Text>
        {event.description ? <Text style={styles.eventDescription}>{event.description}</Text> : null}
      </View>
    </View>
  );
}

function BottomTabs({ activeTab, setActiveTab }) {
  const tabs = ['Hoje', 'Semana', 'Calendário', 'Gestão', 'Avaliações', 'Configurações'];
  return (
    <View style={styles.tabsWrap}>
      {tabs.map((tab) => (
        <Pressable key={tab} style={[styles.tabItem, activeTab === tab && styles.tabItemActive]} onPress={() => setActiveTab(tab)}>
          <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab === 'Configurações' ? 'Config.' : tab}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ManagementModal(props) {
  const { type, onClose, schoolForm, setSchoolForm, classForm, setClassForm, subjectForm, setSubjectForm, saveSchool, saveClass, saveSubject } = props;
  return (
    <Modal visible={!!type} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCardLarge}>
          {type === 'school' && (
            <View style={styles.manageModalCard}>
              <Text style={styles.modalTitle}>Nova escola</Text>
              <InputField inputStyle={styles.manageInput} label="Nome da escola" value={schoolForm.name} onChangeText={(text) => setSchoolForm((prev) => ({ ...prev, name: text }))} placeholder="Ex.: Escola Estadual Central" />
              <Text style={styles.inputLabel}>Cor de identificação</Text>
              <View style={styles.colorRow}>
                {SCHOOL_COLORS.map((color) => (
                  <Pressable key={color} onPress={() => setSchoolForm((prev) => ({ ...prev, color }))} style={[styles.colorBubble, { backgroundColor: color }, schoolForm.color === color && styles.colorBubbleSelected]} />
                ))}
              </View>
              <PrimaryButton title="Salvar escola" onPress={saveSchool} />
              <SecondaryButton title="Cancelar" onPress={onClose} />
            </View>
          )}
          {type === 'class' && (
            <View style={styles.manageModalCard}>
              <Text style={styles.modalTitle}>Nova turma</Text>
              <InputField inputStyle={styles.manageInput} label="Nome da turma" value={classForm.name} onChangeText={(text) => setClassForm({ name: text })} placeholder="Ex.: 1º ano 1" />
              <PrimaryButton title="Salvar turma" onPress={saveClass} />
              <SecondaryButton title="Cancelar" onPress={onClose} />
            </View>
          )}
          {type === 'subject' && (
            <View style={styles.manageModalCard}>
              <Text style={styles.modalTitle}>Nova disciplina</Text>
              <InputField inputStyle={styles.manageInput} label="Nome da disciplina" value={subjectForm.name} onChangeText={(text) => setSubjectForm({ name: text })} placeholder="Ex.: História" />
              <PrimaryButton title="Salvar disciplina" onPress={saveSubject} />
              <SecondaryButton title="Cancelar" onPress={onClose} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function CalendarPicker({ visible, value, onClose, onSelect }) {
  const [viewDate, setViewDate] = useState(value ? parseDateKey(value) : new Date());
  useEffect(() => {
    if (visible) setViewDate(value ? parseDateKey(value) : new Date());
  }, [visible, value]);
  const cells = buildMonthCells(viewDate);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Selecione a data</Text>
          <MonthCalendar monthCells={cells} selectedDate={value} setSelectedDate={onSelect} countByDay={{}} viewMonth={viewDate} setViewMonth={setViewDate} />
          <SecondaryButton title="Fechar" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function ActionButton({ title, subtitle, onPress }) {
  return (
    <Pressable style={styles.actionButton} onPress={onPress}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

function ChoiceChip({ label, active, onPress }) {
  return (
    <Pressable style={[styles.choiceChip, active && styles.choiceChipActive]} onPress={onPress}>
      <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function DateButton({ label, value, onPress }) {
  return (
    <Pressable style={styles.calendarField} onPress={onPress}>
      <Text style={styles.inputLabel}>{label}</Text>
      <Text style={styles.calendarFieldText}>{shortDate(value)}</Text>
      <Text style={styles.calendarFieldHint}>Toque para abrir o calendário</Text>
    </Pressable>
  );
}

function PrimaryButton({ title, onPress }) {
  return <Pressable style={styles.primaryButton} onPress={onPress}><Text style={styles.primaryButtonText}>{title}</Text></Pressable>;
}
function SecondaryButton({ title, onPress }) {
  return <Pressable style={styles.secondaryButton} onPress={onPress}><Text style={styles.secondaryButtonText}>{title}</Text></Pressable>;
}
function SectionTitle({ title, subtitle }) {
  return <View style={styles.sectionTitleWrap}><Text style={styles.sectionTitle}>{title}</Text>{subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}</View>;
}
function EmptyState({ text }) {
  return <View style={styles.emptyCard}><Text style={styles.emptyText}>{text}</Text></View>;
}
function StatCard({ label, value }) {
  return <View style={styles.statCard}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}
function ManagementCard({ title, subtitle, button, onPress }) {
  return <View style={styles.managementCard}><Text style={styles.managementTitle}>{title}</Text><Text style={styles.managementSubtitle}>{subtitle}</Text><Pressable style={styles.miniButton} onPress={onPress}><Text style={styles.miniButtonText}>{button}</Text></Pressable></View>;
}
function SummaryList({ title, items, empty, colors = {} }) {
  return <View style={styles.card}><Text style={styles.summaryTitle}>{title}</Text>{items.length === 0 ? <Text style={styles.summaryEmpty}>{empty}</Text> : items.map((item) => <View key={item} style={styles.summaryRow}><View style={[styles.summaryBullet, colors[item] ? { backgroundColor: colors[item] } : null]} /><Text style={styles.summaryItem}>{item}</Text></View>)}</View>;
}
function SwitchRow({ label, value, onValueChange }) {
  return <View style={styles.switchRow}><Text style={styles.switchLabel}>{label}</Text><Switch value={value} onValueChange={onValueChange} thumbColor={palette.white} trackColor={{ false: '#B8C4D6', true: palette.primary }} /></View>;
}
function InputField({ label, multiline = false, inputStyle, ...props }) {
  return <View style={styles.inputWrapFlex}><Text style={styles.inputLabel}>{label}</Text><TextInput {...props} placeholderTextColor={palette.muted} multiline={multiline} style={[styles.input, multiline && styles.inputMultiline, inputStyle]} /></View>;
}
function SelectField({ label, options, value, onChange, placeholder = 'Selecione' }) {
  const selected = options.find((item) => item.value === value);
  return (
    <View style={styles.inputWrapFlex}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.selectWrap}>
        {options.map((option) => {
          const active = option.value === value;
          return <Pressable key={`${label}-${String(option.value)}`} onPress={() => onChange(option.value)} style={[styles.selectChip, active && styles.selectChipActive]}>{option.color ? <View style={[styles.selectColorDot, { backgroundColor: option.color }]} /> : null}<Text style={[styles.selectChipText, active && styles.selectChipTextActive]}>{option.label || placeholder}</Text></Pressable>;
        })}
        {!selected && value === '' && placeholder ? <Text style={styles.selectPlaceholder}>{placeholder}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  container: { flex: 1, backgroundColor: palette.bg },
  body: { flex: 1 },
  headerHero: { backgroundColor: palette.primary, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 16, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  logoWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoBadge: { width: 62, height: 62, borderRadius: 31, backgroundColor: palette.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImage: { width: 58, height: 58 },
  headerTextWrap: { flex: 1 },
  brand: { color: palette.white, fontSize: 22, fontWeight: '800' },
  brandSub: { color: '#EAF0FF', fontSize: 12, marginTop: 2 },
  headerHighlight: { color: palette.accent, fontSize: 30, fontWeight: '900', marginTop: 14 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 120, paddingTop: 14 },
  heroCard: { backgroundColor: palette.card, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: palette.border },
  heroTitle: { color: palette.text, fontSize: 19, fontWeight: '800' },
  heroParagraph: { color: palette.muted, fontSize: 14, marginTop: 8, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  statCard: { flex: 1, backgroundColor: palette.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: palette.border },
  statValue: { color: palette.primary, fontSize: 22, fontWeight: '900' },
  statLabel: { color: palette.muted, fontSize: 12, marginTop: 4 },
  sectionTitleWrap: { marginTop: 18, marginBottom: 10 },
  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '800' },
  sectionSubtitle: { color: palette.muted, fontSize: 13, marginTop: 2 },
  eventCard: { flexDirection: 'row', backgroundColor: palette.card, borderRadius: 20, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: palette.border },
  eventColor: { width: 7 },
  eventContent: { flex: 1, padding: 14 },
  eventTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  eventTitle: { color: palette.text, fontSize: 15, fontWeight: '800', flex: 1 },
  eventTime: { color: palette.primary, fontSize: 13, fontWeight: '800' },
  eventSubtitle: { color: palette.muted, fontSize: 13, marginTop: 6 },
  eventDate: { color: palette.text, fontSize: 12, marginTop: 8 },
  eventDescription: { color: palette.muted, fontSize: 12, marginTop: 8, lineHeight: 18 },
  tabsWrap: { position: 'absolute', left: 10, right: 10, bottom: 10, backgroundColor: palette.white, borderRadius: 24, flexDirection: 'row', padding: 7, borderWidth: 1, borderColor: palette.border, justifyContent: 'space-between', elevation: 10 },
  tabItem: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 18, paddingHorizontal: 2 },
  tabItemActive: { backgroundColor: palette.primarySoft },
  tabText: { color: palette.muted, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  tabTextActive: { color: palette.primary },
  fab: { position: 'absolute', right: 22, bottom: 88, width: 62, height: 62, borderRadius: 31, backgroundColor: palette.accent, justifyContent: 'center', alignItems: 'center', elevation: 8 },
  fabIcon: { color: palette.white, fontSize: 32, fontWeight: '900', marginTop: -2 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(16,37,68,0.45)', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: palette.white, borderRadius: 24, padding: 18, maxHeight: '88%', borderWidth: 1, borderColor: palette.border },
  modalCardLarge: { backgroundColor: palette.white, borderRadius: 28, padding: 18, maxHeight: '92%', borderWidth: 1, borderColor: palette.border },
  manageModalCard: { backgroundColor: palette.white, borderRadius: 26, padding: 2 },
  modalTitle: { color: palette.text, fontSize: 22, fontWeight: '900', marginBottom: 8 },
  modalSubtitle: { color: palette.muted, fontSize: 13, marginTop: 2, marginBottom: 16, lineHeight: 18 },
  actionButton: { backgroundColor: palette.bgSoft, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: palette.border },
  actionTitle: { color: palette.text, fontSize: 16, fontWeight: '800' },
  actionSubtitle: { color: palette.muted, fontSize: 13, marginTop: 6 },
  primaryButton: { backgroundColor: palette.primary, paddingVertical: 15, borderRadius: 18, alignItems: 'center', marginTop: 12 },
  primaryButtonText: { color: palette.white, fontSize: 15, fontWeight: '900' },
  secondaryButton: { backgroundColor: palette.white, paddingVertical: 14, borderRadius: 18, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: palette.border },
  secondaryButtonText: { color: palette.text, fontSize: 14, fontWeight: '800' },
  inputWrapFlex: { flex: 1, marginBottom: 12 },
  inputLabel: { color: palette.text, fontSize: 13, fontWeight: '800', marginBottom: 7 },
  input: { backgroundColor: palette.white, color: palette.text, borderRadius: 16, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, minHeight: 48 },
  manageInput: { minHeight: 58, fontSize: 16 },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  helperText: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: -2, marginBottom: 6 },
  rowGap: { flexDirection: 'row', gap: 10 },
  choiceRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  choiceChip: { flex: 1, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.white, borderRadius: 16, paddingVertical: 12, alignItems: 'center' },
  choiceChipActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  choiceChipText: { color: palette.text, fontWeight: '800' },
  choiceChipTextActive: { color: palette.white },
  calendarField: { backgroundColor: palette.white, borderRadius: 16, borderWidth: 1, borderColor: palette.border, padding: 14, marginBottom: 12 },
  calendarFieldText: { color: palette.primary, fontSize: 15, fontWeight: '900' },
  calendarFieldHint: { color: palette.muted, fontSize: 12, marginTop: 6 },
  calendarCard: { backgroundColor: palette.card, borderRadius: 24, padding: 14, borderWidth: 1, borderColor: palette.border },
  calendarHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calendarTitle: { color: palette.text, fontSize: 16, fontWeight: '900' },
  monthNav: { width: 40, height: 40, borderRadius: 14, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  monthNavText: { color: palette.primary, fontSize: 22, fontWeight: '900' },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  weekHeaderText: { width: '14.285%', textAlign: 'center', color: palette.muted, fontSize: 12, fontWeight: '800' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.285%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  dayCellSelected: { backgroundColor: palette.primary },
  dayCellMuted: { opacity: 0.38 },
  dayCellText: { color: palette.text, fontSize: 13, fontWeight: '800' },
  dayCellTextSelected: { color: palette.white },
  dayDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },
  dayDotSpacer: { width: 6, height: 6, marginTop: 4 },
  emptyCard: { backgroundColor: palette.card, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: palette.border },
  emptyText: { color: palette.muted, fontSize: 14 },
  managementGrid: { gap: 12 },
  managementCard: { backgroundColor: palette.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: palette.border },
  managementTitle: { color: palette.text, fontSize: 16, fontWeight: '800' },
  managementSubtitle: { color: palette.muted, fontSize: 13, marginTop: 4 },
  miniButton: { alignSelf: 'flex-start', backgroundColor: palette.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, marginTop: 12 },
  miniButtonText: { color: palette.white, fontWeight: '800', fontSize: 13 },
  card: { backgroundColor: palette.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: palette.border, marginBottom: 12 },
  summaryTitle: { color: palette.text, fontWeight: '800', fontSize: 15, marginBottom: 10 },
  summaryEmpty: { color: palette.muted, fontSize: 13 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  summaryBullet: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.primary },
  summaryItem: { color: palette.text, fontSize: 14 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  colorBubble: { width: 46, height: 46, borderRadius: 23 },
  colorBubbleSelected: { borderWidth: 4, borderColor: palette.text },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 12 },
  switchLabel: { color: palette.text, fontSize: 14, flex: 1, paddingRight: 10 },
  selectWrap: { backgroundColor: palette.white, borderRadius: 16, borderWidth: 1, borderColor: palette.border, padding: 10, gap: 8 },
  selectChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: palette.bgSoft, borderRadius: 14 },
  selectChipActive: { backgroundColor: palette.primary },
  selectChipText: { color: palette.text, fontSize: 13, fontWeight: '700' },
  selectChipTextActive: { color: palette.white },
  selectColorDot: { width: 10, height: 10, borderRadius: 5 },
  selectPlaceholder: { color: palette.muted, fontSize: 12, marginTop: 2 },
  weekTotalCard: { backgroundColor: palette.primarySoft, borderRadius: 18, padding: 16, marginTop: 10, borderWidth: 1, borderColor: palette.border },
  weekTotalText: { color: palette.primary, fontSize: 15, fontWeight: '900', textAlign: 'center' },
});

export default App;
