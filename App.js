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
const VERSION_LABEL = 'Versão 5.8 ativa — feriados, ano letivo e eventos vencidos';

const palette = {
  bg: '#F4F7FB',
  bgSoft: '#EAF1F8',
  card: '#FFFFFF',
  border: '#D8E3EE',
  text: '#082B5F',
  muted: '#6B7A90',
  primary: '#356DCC',
  primarySoft: '#E8F0FF',
  accent: '#F9AA1B',
  danger: '#DF3F3F',
  dangerSoft: '#FDECEC',
  success: '#20A874',
  white: '#FFFFFF',
};

const SCHOOL_COLORS = ['#FF7A1A', '#2D7FF9', '#34C38F', '#FDBA2D', '#A855F7', '#EF4444', '#14B8A6'];
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

const HOLIDAY_LABELS = {
  '01-01': 'Confraternização Universal',
  '04-21': 'Tiradentes',
  '05-01': 'Dia do Trabalhador',
  '09-07': 'Independência do Brasil',
  '10-12': 'Nossa Senhora Aparecida',
  '11-02': 'Finados',
  '11-15': 'Proclamação da República',
  '11-20': 'Consciência Negra',
  '12-25': 'Natal',
};

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
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const pad = (n) => String(n).padStart(2, '0');
const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const dateKeyToMonthDay = (dateKey) => dateKey.slice(5);
const isValidDateKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '');
const parseDateKey = (key) => {
  const [y, m, d] = String(key || '').split('-').map(Number);
  return new Date(y || 2000, (m || 1) - 1, d || 1, 12, 0, 0);
};
const parseTimeParts = (time) => {
  const [h, m] = String(time || '00:00').split(':').map(Number);
  return { h: Number.isFinite(h) ? h : 0, m: Number.isFinite(m) ? m : 0 };
};
const addMinutesToTime = (time, minutes) => {
  const { h, m } = parseTimeParts(time);
  const date = new Date(2000, 0, 1, h, m + minutes, 0, 0);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
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
const isNationalHoliday = (dateKey) => Boolean(HOLIDAY_LABELS[dateKeyToMonthDay(dateKey)]);
const holidayName = (dateKey) => HOLIDAY_LABELS[dateKeyToMonthDay(dateKey)] || '';
const isAfterSchoolYearEnd = (dateKey, schoolYearEnd) => {
  if (!isValidDateKey(schoolYearEnd)) return false;
  return parseDateKey(dateKey) > parseDateKey(schoolYearEnd);
};
const isEventExpiredForTodayWeek = (event, now = new Date()) => {
  const eventDate = parseDateKey(event.date);
  const endTime = event.endTime || event.sortTime || '00:00';
  const { h, m } = parseTimeParts(endTime);
  eventDate.setHours(h, m + 30, 0, 0);
  return now > eventDate;
};

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
  if (lesson.kind === 'isolada') return lesson.date === dateKey;
  const target = parseDateKey(dateKey);
  const startDate = lesson.startDate || lesson.date;
  if (startDate && target < parseDateKey(startDate)) return false;
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

function normalizeLoadedData(parsed) {
  return {
    ...initialData,
    ...parsed,
    profile: { ...initialData.profile, ...(parsed?.profile || {}) },
    lessons: Array.isArray(parsed?.lessons) ? parsed.lessons.map((lesson) => ({ kind: 'recorrente', ...lesson, startDate: lesson.startDate || lesson.date || toDateKey(new Date()) })) : [],
    commitments: Array.isArray(parsed?.commitments) ? parsed.commitments : [],
    schools: Array.isArray(parsed?.schools) ? parsed.schools : [],
    classes: Array.isArray(parsed?.classes) ? parsed.classes : [],
    subjects: Array.isArray(parsed?.subjects) ? parsed.subjects : [],
  };
}

function App() {
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState('Hoje');
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState(null);
  const [calendarPickerOpen, setCalendarPickerOpen] = useState(false);
  const [calendarTargetField, setCalendarTargetField] = useState('commitmentDate');
  const [managementModal, setManagementModal] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [tick, setTick] = useState(Date.now());
  const [lessonForm, setLessonForm] = useState({
    kind: 'recorrente',
    schoolId: '',
    classId: '',
    subjectId: '',
    weekday: 1,
    date: toDateKey(new Date()),
    startDate: toDateKey(new Date()),
    startTime: '07:00',
    endTime: '07:50',
  });
  const [commitmentForm, setCommitmentForm] = useState({ type: COMMITMENT_TYPES[0], title: '', description: '', schoolId: '', date: toDateKey(new Date()), time: '08:00', recurrence: 'Não repetir' });
  const [schoolForm, setSchoolForm] = useState({ name: '', color: SCHOOL_COLORS[0] });
  const [classForm, setClassForm] = useState({ name: '' });
  const [subjectForm, setSubjectForm] = useState({ name: '' });

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) setData(normalizeLoadedData(JSON.parse(saved)));
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

  useEffect(() => {
    const interval = setInterval(() => setTick(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const enrichedEvents = useMemo(() => {
    const events = [];
    const current = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const start = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    const end = new Date(current.getFullYear(), current.getMonth() + 2, 0);
    const schoolYearEnd = data.profile.schoolYearEnd;

    for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
      const dateKey = toDateKey(cursor);
      if (isNationalHoliday(dateKey)) continue;
      if (isAfterSchoolYearEnd(dateKey, schoolYearEnd)) continue;

      data.lessons.forEach((lesson) => {
        if (isLessonOnDate(lesson, dateKey)) {
          const school = findById(data.schools, lesson.schoolId);
          const schoolColor = school?.color || palette.primary;
          const classItem = findById(data.classes, lesson.classId);
          const subject = findById(data.subjects, lesson.subjectId);
          events.push({
            id: `${lesson.id}-${dateKey}`,
            originalId: lesson.id,
            eventType: 'aula',
            title: subject?.name || 'Aula',
            subtitle: `${classItem?.name || 'Turma'} • ${school?.name || 'Escola'}`,
            date: dateKey,
            sortTime: lesson.startTime,
            endTime: lesson.endTime,
            timeLabel: `${lesson.startTime} - ${lesson.endTime}`,
            color: schoolColor,
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
            endTime: item.time || '00:00',
            timeLabel: item.time || '--:--',
            color: school?.color || palette.accent,
            description: item.description,
          });
        }
      });
    }

    return events.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return compareTime(a.sortTime, b.sortTime);
    });
  }, [data, viewMonth, tick]);

  const now = useMemo(() => new Date(tick), [tick]);
  const todayKey = toDateKey(now);
  const visibleForTodayWeek = (event) => !isEventExpiredForTodayWeek(event, now);
  const todaysEvents = enrichedEvents.filter((event) => event.date === todayKey && visibleForTodayWeek(event));
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  const weekEvents = enrichedEvents.filter((event) => {
    const eventDate = parseDateKey(event.date);
    return isWithinRange(eventDate, weekStart, weekEnd) && visibleForTodayWeek(event);
  });

  const selectedDayEvents = isNationalHoliday(selectedDate) || isAfterSchoolYearEnd(selectedDate, data.profile.schoolYearEnd)
    ? []
    : enrichedEvents.filter((event) => event.date === selectedDate);
  const monthCells = buildMonthCells(viewMonth);

  const eventCountByDay = useMemo(() => {
    const counts = {};
    enrichedEvents.forEach((event) => {
      counts[event.date] = (counts[event.date] || 0) + 1;
    });
    return counts;
  }, [enrichedEvents]);

  const counts = {
    schools: data.schools.length,
    classes: data.classes.length,
    subjects: data.subjects.length,
    lessons: data.lessons.length,
    commitments: data.commitments.length,
  };

  const updateProfile = (patch) => setData((prev) => ({ ...prev, profile: { ...prev.profile, ...patch } }));

  const blockedDateMessage = (dateKey) => {
    if (isNationalHoliday(dateKey)) return `Não é possível cadastrar eventos em feriado nacional: ${holidayName(dateKey)}.`;
    if (isAfterSchoolYearEnd(dateKey, data.profile.schoolYearEnd)) return `A data está após o fim do ano letivo (${shortDate(data.profile.schoolYearEnd)}).`;
    return '';
  };

  const resetLessonForm = () => setLessonForm({ kind: 'recorrente', schoolId: '', classId: '', subjectId: '', weekday: 1, date: toDateKey(new Date()), startDate: toDateKey(new Date()), startTime: '07:00', endTime: '07:50' });
  const resetCommitmentForm = () => setCommitmentForm({ type: COMMITMENT_TYPES[0], title: '', description: '', schoolId: '', date: toDateKey(new Date()), time: '08:00', recurrence: 'Não repetir' });

  const openCreateMenu = () => {
    setEditingEvent(null);
    setModalMode(null);
    setModalOpen(true);
  };

  const saveSchool = () => {
    if (!schoolForm.name.trim()) {
      Alert.alert('Campo obrigatório', 'Digite o nome da escola.');
      return;
    }
    setData((prev) => ({ ...prev, schools: [...prev.schools, { id: uid(), name: schoolForm.name.trim(), color: schoolForm.color }] }));
    setSchoolForm({ name: '', color: SCHOOL_COLORS[0] });
    setManagementModal(null);
  };

  const saveClass = () => {
    if (!classForm.name.trim()) {
      Alert.alert('Campo obrigatório', 'Digite o nome da turma.');
      return;
    }
    setData((prev) => ({ ...prev, classes: [...prev.classes, { id: uid(), name: classForm.name.trim() }] }));
    setClassForm({ name: '' });
    setManagementModal(null);
  };

  const saveSubject = () => {
    if (!subjectForm.name.trim()) {
      Alert.alert('Campo obrigatório', 'Digite o nome da disciplina.');
      return;
    }
    setData((prev) => ({ ...prev, subjects: [...prev.subjects, { id: uid(), name: subjectForm.name.trim() }] }));
    setSubjectForm({ name: '' });
    setManagementModal(null);
  };

  const saveLesson = () => {
    if (!lessonForm.schoolId || !lessonForm.classId || !lessonForm.subjectId) {
      Alert.alert('Campos obrigatórios', 'Selecione escola, turma e disciplina.');
      return;
    }
    const referenceDate = lessonForm.kind === 'isolada' ? lessonForm.date : lessonForm.startDate;
    const blocked = blockedDateMessage(referenceDate);
    if (blocked) {
      Alert.alert('Data bloqueada', blocked);
      return;
    }
    const normalized = {
      ...lessonForm,
      date: lessonForm.kind === 'isolada' ? lessonForm.date : lessonForm.startDate,
      startDate: lessonForm.kind === 'isolada' ? lessonForm.date : lessonForm.startDate,
    };
    setData((prev) => ({
      ...prev,
      lessons: editingEvent?.eventType === 'aula'
        ? prev.lessons.map((item) => (item.id === editingEvent.originalId ? { ...item, ...normalized } : item))
        : [...prev.lessons, { id: uid(), ...normalized }],
    }));
    resetLessonForm();
    setEditingEvent(null);
    setModalMode(null);
    setModalOpen(false);
  };

  const saveCommitment = () => {
    if (!commitmentForm.title.trim()) {
      Alert.alert('Campo obrigatório', 'Informe um título para o compromisso.');
      return;
    }
    const blocked = blockedDateMessage(commitmentForm.date);
    if (blocked) {
      Alert.alert('Data bloqueada', blocked);
      return;
    }
    const normalized = { ...commitmentForm, title: commitmentForm.title.trim(), description: commitmentForm.description.trim() };
    setData((prev) => ({
      ...prev,
      commitments: editingEvent?.eventType === 'compromisso'
        ? prev.commitments.map((item) => (item.id === editingEvent.originalId ? { ...item, ...normalized } : item))
        : [...prev.commitments, { id: uid(), ...normalized }],
    }));
    resetCommitmentForm();
    setEditingEvent(null);
    setModalMode(null);
    setModalOpen(false);
  };

  const editEvent = (event) => {
    if (event.eventType === 'aula') {
      const lesson = data.lessons.find((item) => item.id === event.originalId);
      if (!lesson) return;
      setLessonForm({ kind: 'recorrente', startDate: lesson.startDate || lesson.date || event.date, date: lesson.date || event.date, ...lesson });
      setEditingEvent(event);
      setModalMode('lesson');
      setModalOpen(true);
      return;
    }
    if (event.eventType === 'compromisso') {
      const commitment = data.commitments.find((item) => item.id === event.originalId);
      if (!commitment) return;
      setCommitmentForm({ type: COMMITMENT_TYPES[0], title: '', description: '', schoolId: '', date: event.date, time: '08:00', recurrence: 'Não repetir', ...commitment });
      setEditingEvent(event);
      setModalMode('commitment');
      setModalOpen(true);
    }
  };

  const deleteEvent = (event) => {
    if (event.eventType === 'aula') {
      setData((prev) => ({ ...prev, lessons: prev.lessons.filter((item) => item.id !== event.originalId) }));
    }
    if (event.eventType === 'compromisso') {
      setData((prev) => ({ ...prev, commitments: prev.commitments.filter((item) => item.id !== event.originalId) }));
    }
  };

  const handleEventPress = (event) => {
    Alert.alert(event.title, 'O que deseja fazer com este evento?', [
      { text: 'Editar', onPress: () => editEvent(event) },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteEvent(event) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <Header teacherName={data.profile.teacherName} />

        <View style={styles.body}>
          {activeTab === 'Hoje' && <TodayTab events={todaysEvents} counts={counts} onEventPress={handleEventPress} />}
          {activeTab === 'Semana' && <WeekTab events={weekEvents} weekStart={weekStart} weekEnd={weekEnd} weeklyLessons={data.lessons.filter((item) => item.kind !== 'isolada').length} onEventPress={handleEventPress} />}
          {activeTab === 'Calendário' && (
            <CalendarTab
              monthCells={monthCells}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              selectedDayEvents={selectedDayEvents}
              eventCountByDay={eventCountByDay}
              viewMonth={viewMonth}
              setViewMonth={setViewMonth}
              schoolYearEnd={data.profile.schoolYearEnd}
              onEventPress={handleEventPress}
            />
          )}
          {activeTab === 'Gestão' && <ManagementTab data={data} counts={counts} openManage={setManagementModal} />}
          {activeTab === 'Configurações' && <SettingsTab profile={data.profile} updateProfile={updateProfile} />}
        </View>

        <BottomTabs activeTab={activeTab} setActiveTab={setActiveTab} />

        <Pressable style={styles.fab} onPress={openCreateMenu}>
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
                <SecondaryButton title="Fechar" onPress={() => setModalOpen(false)} />
              </View>
            )}

            {modalMode === 'lesson' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>{editingEvent ? 'Editar aula' : 'Nova aula'}</Text>
                <Text style={styles.modalSubtitle}>Eventos em feriados nacionais ou após o fim do ano letivo serão bloqueados.</Text>
                <SelectField
                  label="Tipo de aula"
                  value={lessonForm.kind}
                  options={[{ label: 'Aula recorrente', value: 'recorrente' }, { label: 'Aula isolada', value: 'isolada' }]}
                  onChange={(value) => setLessonForm((prev) => ({ ...prev, kind: value }))}
                />
                <SelectField label="Escola" placeholder="Selecione uma escola" value={lessonForm.schoolId} options={data.schools.map((item) => ({ label: item.name, value: item.id, color: item.color }))} onChange={(value) => setLessonForm((prev) => ({ ...prev, schoolId: value }))} />
                <SelectField label="Turma" placeholder="Selecione uma turma" value={lessonForm.classId} options={data.classes.map((item) => ({ label: item.name, value: item.id }))} onChange={(value) => setLessonForm((prev) => ({ ...prev, classId: value }))} />
                <SelectField label="Disciplina" placeholder="Selecione uma disciplina" value={lessonForm.subjectId} options={data.subjects.map((item) => ({ label: item.name, value: item.id }))} onChange={(value) => setLessonForm((prev) => ({ ...prev, subjectId: value }))} />
                {lessonForm.kind === 'recorrente' ? (
                  <>
                    <SelectField label="Dia da semana" value={lessonForm.weekday} options={WEEKDAY_OPTIONS} onChange={(value) => setLessonForm((prev) => ({ ...prev, weekday: value }))} />
                    <DateButton label="Data inicial" value={lessonForm.startDate} onPress={() => { setCalendarTargetField('lessonStartDate'); setCalendarPickerOpen(true); }} />
                  </>
                ) : (
                  <DateButton label="Data da aula isolada" value={lessonForm.date} onPress={() => { setCalendarTargetField('lessonDate'); setCalendarPickerOpen(true); }} />
                )}
                <View style={styles.rowGap}>
                  <InputField
                    label="Início"
                    value={lessonForm.startTime}
                    onChangeText={(text) => setLessonForm((prev) => ({ ...prev, startTime: text, endTime: addMinutesToTime(text, 50) }))}
                    placeholder="07:00"
                  />
                  <InputField label="Fim" value={lessonForm.endTime} onChangeText={(text) => setLessonForm((prev) => ({ ...prev, endTime: text }))} placeholder="07:50" />
                </View>
                <PrimaryButton title={editingEvent ? 'Salvar alterações' : 'Salvar aula'} onPress={saveLesson} />
                <SecondaryButton title="Voltar" onPress={() => { setModalMode(null); setEditingEvent(null); }} />
              </ScrollView>
            )}

            {modalMode === 'commitment' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>{editingEvent ? 'Editar compromisso' : 'Novo compromisso'}</Text>
                <Text style={styles.modalSubtitle}>Escolha data, tipo e recorrência.</Text>
                <SelectField label="Tipo" value={commitmentForm.type} options={COMMITMENT_TYPES.map((item) => ({ label: item, value: item }))} onChange={(value) => setCommitmentForm((prev) => ({ ...prev, type: value }))} />
                <InputField label="Título" value={commitmentForm.title} onChangeText={(text) => setCommitmentForm((prev) => ({ ...prev, title: text }))} placeholder="Ex.: Entregar notas do 2º bimestre" />
                <InputField label="Descrição" multiline value={commitmentForm.description} onChangeText={(text) => setCommitmentForm((prev) => ({ ...prev, description: text }))} placeholder="Observações do compromisso" />
                <SelectField label="Escola (opcional)" placeholder="Sem escola vinculada" value={commitmentForm.schoolId} options={[{ label: 'Sem escola vinculada', value: '' }, ...data.schools.map((item) => ({ label: item.name, value: item.id, color: item.color }))]} onChange={(value) => setCommitmentForm((prev) => ({ ...prev, schoolId: value }))} />
                <DateButton label="Data" value={commitmentForm.date} onPress={() => { setCalendarTargetField('commitmentDate'); setCalendarPickerOpen(true); }} />
                <View style={styles.rowGap}>
                  <InputField label="Horário" value={commitmentForm.time} onChangeText={(text) => setCommitmentForm((prev) => ({ ...prev, time: text }))} placeholder="14:00" />
                  <SelectField label="Repetição" value={commitmentForm.recurrence} options={RECURRENCE_OPTIONS.map((item) => ({ label: item, value: item }))} onChange={(value) => setCommitmentForm((prev) => ({ ...prev, recurrence: value }))} />
                </View>
                <PrimaryButton title={editingEvent ? 'Salvar alterações' : 'Salvar compromisso'} onPress={saveCommitment} />
                <SecondaryButton title="Voltar" onPress={() => { setModalMode(null); setEditingEvent(null); }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <CalendarPicker
        visible={calendarPickerOpen}
        value={calendarTargetField === 'lessonDate' ? lessonForm.date : calendarTargetField === 'lessonStartDate' ? lessonForm.startDate : commitmentForm.date}
        schoolYearEnd={data.profile.schoolYearEnd}
        onClose={() => setCalendarPickerOpen(false)}
        onSelect={(dateKey) => {
          if (calendarTargetField === 'lessonDate') setLessonForm((prev) => ({ ...prev, date: dateKey, startDate: dateKey }));
          if (calendarTargetField === 'lessonStartDate') setLessonForm((prev) => ({ ...prev, startDate: dateKey, date: dateKey }));
          if (calendarTargetField === 'commitmentDate') setCommitmentForm((prev) => ({ ...prev, date: dateKey }));
          setCalendarPickerOpen(false);
        }}
      />

      <ManagementModal type={managementModal} onClose={() => setManagementModal(null)} schoolForm={schoolForm} setSchoolForm={setSchoolForm} classForm={classForm} setClassForm={setClassForm} subjectForm={subjectForm} setSubjectForm={setSubjectForm} saveSchool={saveSchool} saveClass={saveClass} saveSubject={saveSubject} />
    </SafeAreaView>
  );
}

function Header({ teacherName }) {
  return (
    <View style={styles.header}>
      <View style={styles.logoWrap}>
        <Image source={require('./assets/icon.png')} style={styles.logoImage} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>Agenda Prof</Text>
          <Text style={styles.brandSub}>{teacherName ? `Olá, ${teacherName}` : 'Organize aulas, tarefas e compromissos'}</Text>
        </View>
      </View>
    </View>
  );
}

function TodayTab({ events, counts, onEventPress }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Hoje</Text>
        <Text style={styles.heroSubtitle}>{longDate(new Date())}</Text>
        <Text style={styles.heroParagraph}>Visualize rapidamente as próximas aulas, compromissos e pendências do dia.</Text>
      </View>
      <View style={styles.statsRow}>
        <StatCard label="Escolas" value={counts.schools} />
        <StatCard label="Turmas" value={counts.classes} />
        <StatCard label="Disciplinas" value={counts.subjects} />
      </View>
      <SectionTitle title="Próximas tarefas do dia" />
      {events.length === 0 ? <EmptyState text="Nenhum item programado para hoje." /> : events.map((event) => <EventCard key={event.id} event={event} onPress={() => onEventPress(event)} />)}
    </ScrollView>
  );
}

function WeekTab({ events, weekStart, weekEnd, weeklyLessons, onEventPress }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <SectionTitle title="Tarefas da Semana" subtitle={`${weekStart.toLocaleDateString('pt-BR')} até ${weekEnd.toLocaleDateString('pt-BR')}`} />
      {events.length === 0 ? <EmptyState text="Nenhuma tarefa programada nesta semana." /> : events.map((event) => <EventCard key={event.id} event={event} onPress={() => onEventPress(event)} />)}
      <View style={styles.infoCard}><Text style={styles.infoText}>Você possui {weeklyLessons} aulas semanais 😅</Text></View>
    </ScrollView>
  );
}

function CalendarTab({ monthCells, selectedDate, setSelectedDate, selectedDayEvents, eventCountByDay, viewMonth, setViewMonth, schoolYearEnd, onEventPress }) {
  const selectedHoliday = isNationalHoliday(selectedDate);
  const selectedAfterYearEnd = isAfterSchoolYearEnd(selectedDate, schoolYearEnd);
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
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
            const hasEvent = eventCountByDay[cell.key] > 0;
            const holiday = isNationalHoliday(cell.key);
            const afterYearEnd = isAfterSchoolYearEnd(cell.key, schoolYearEnd);
            return (
              <Pressable key={cell.key} onPress={() => setSelectedDate(cell.key)} style={[styles.dayCell, selected && styles.dayCellSelected, holiday && styles.dayCellHoliday, !cell.inMonth && styles.dayCellMuted, afterYearEnd && styles.dayCellBlocked]}>
                <Text style={[styles.dayCellText, selected && styles.dayCellTextSelected, holiday && styles.dayCellTextHoliday]}>{parseDateKey(cell.key).getDate()}</Text>
                {holiday ? <Text style={styles.holidayBadge}>FER</Text> : hasEvent ? <View style={styles.dayDot} /> : <View style={styles.dayDotSpacer} />}
              </Pressable>
            );
          })}
        </View>
        <View style={styles.legendRow}>
          <Text style={styles.legendHoliday}>● Feriado nacional</Text>
          <Text style={styles.legendEvent}>● Evento</Text>
        </View>
      </View>
      <SectionTitle title={`Agenda de ${shortDate(selectedDate)}`} />
      {selectedHoliday ? (
        <HolidayCard dateKey={selectedDate} />
      ) : selectedAfterYearEnd ? (
        <EmptyState text="Data após o fim do ano letivo." />
      ) : selectedDayEvents.length === 0 ? (
        <EmptyState text="Nenhuma tarefa neste dia." />
      ) : (
        selectedDayEvents.map((event) => <EventCard key={event.id} event={event} onPress={() => onEventPress(event)} />)
      )}
    </ScrollView>
  );
}

function HolidayCard({ dateKey }) {
  return <View style={styles.holidayCard}><Text style={styles.holidayTitle}>Feriado Nacional</Text><Text style={styles.holidayName}>{holidayName(dateKey)}</Text><Text style={styles.holidayText}>Aulas e compromissos recorrentes não são exibidos neste dia.</Text></View>;
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
        <InputField label="Fim do ano letivo (AAAA-MM-DD)" value={profile.schoolYearEnd || ''} onChangeText={(text) => updateProfile({ schoolYearEnd: text })} placeholder="Ex.: 2026-12-20" />
        <SwitchRow label="Modo compacto" value={profile.compactMode} onValueChange={(value) => updateProfile({ compactMode: value })} />
        <SwitchRow label="Notificações locais (preparação)" value={profile.notifications} onValueChange={(value) => updateProfile({ notifications: value })} />
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Versão instalada</Text>
        <Text style={styles.infoText}>{VERSION_LABEL}</Text>
        <Text style={styles.infoText}>Feriados nacionais são marcados com FER. Eventos somem das abas Hoje e Semana 30 minutos após o horário final.</Text>
      </View>
    </ScrollView>
  );
}

function EventCard({ event, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.eventCard}>
      <View style={[styles.eventColor, { backgroundColor: event.color }]} />
      <View style={styles.eventContent}>
        <View style={styles.eventTopRow}><Text style={styles.eventTitle}>{event.title}</Text><Text style={styles.eventTime}>{event.timeLabel}</Text></View>
        <Text style={styles.eventSubtitle}>{event.subtitle}</Text>
        <Text style={styles.eventDate}>{shortDate(event.date)}</Text>
        {event.description ? <Text style={styles.eventDescription}>{event.description}</Text> : null}
      </View>
    </Pressable>
  );
}

function BottomTabs({ activeTab, setActiveTab }) {
  const tabs = ['Hoje', 'Semana', 'Calendário', 'Gestão', 'Configurações'];
  return <View style={styles.tabsWrap}>{tabs.map((tab) => <Pressable key={tab} style={[styles.tabItem, activeTab === tab && styles.tabItemActive]} onPress={() => setActiveTab(tab)}><Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text></Pressable>)}</View>;
}

function ManagementModal(props) {
  const { type, onClose, schoolForm, setSchoolForm, classForm, setClassForm, subjectForm, setSubjectForm, saveSchool, saveClass, saveSubject } = props;
  return (
    <Modal visible={!!type} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}><View style={styles.modalCard}>
        {type === 'school' && <View><Text style={styles.modalTitle}>Nova escola</Text><InputField label="Nome da escola" value={schoolForm.name} onChangeText={(text) => setSchoolForm((prev) => ({ ...prev, name: text }))} placeholder="Ex.: Escola Estadual Central" /><Text style={styles.inputLabel}>Cor de identificação</Text><View style={styles.colorRow}>{SCHOOL_COLORS.map((color) => <Pressable key={color} onPress={() => setSchoolForm((prev) => ({ ...prev, color }))} style={[styles.colorBubble, { backgroundColor: color }, schoolForm.color === color && styles.colorBubbleSelected]} />)}</View><PrimaryButton title="Salvar escola" onPress={saveSchool} /><SecondaryButton title="Cancelar" onPress={onClose} /></View>}
        {type === 'class' && <View><Text style={styles.modalTitle}>Nova turma</Text><InputField label="Nome da turma" value={classForm.name} onChangeText={(text) => setClassForm({ name: text })} placeholder="Ex.: 1º ano 1" /><PrimaryButton title="Salvar turma" onPress={saveClass} /><SecondaryButton title="Cancelar" onPress={onClose} /></View>}
        {type === 'subject' && <View><Text style={styles.modalTitle}>Nova disciplina</Text><InputField label="Nome da disciplina" value={subjectForm.name} onChangeText={(text) => setSubjectForm({ name: text })} placeholder="Ex.: História" /><PrimaryButton title="Salvar disciplina" onPress={saveSubject} /><SecondaryButton title="Cancelar" onPress={onClose} /></View>}
      </View></View>
    </Modal>
  );
}

function CalendarPicker({ visible, value, onClose, onSelect, schoolYearEnd }) {
  const [viewDate, setViewDate] = useState(value ? parseDateKey(value) : new Date());
  useEffect(() => { if (visible) setViewDate(value ? parseDateKey(value) : new Date()); }, [visible, value]);
  const cells = buildMonthCells(viewDate);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}><View style={styles.modalCard}>
        <Text style={styles.modalTitle}>Selecione a data</Text>
        <View style={styles.calendarHeaderRow}><Pressable style={styles.monthNav} onPress={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}><Text style={styles.monthNavText}>‹</Text></Pressable><Text style={styles.calendarTitle}>{monthTitle(viewDate)}</Text><Pressable style={styles.monthNav} onPress={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}><Text style={styles.monthNavText}>›</Text></Pressable></View>
        <View style={styles.weekHeader}>{DAYS.map((day) => <Text key={day} style={styles.weekHeaderText}>{day}</Text>)}</View>
        <View style={styles.calendarGrid}>{cells.map((cell) => {
          const selected = cell.key === value;
          const holiday = isNationalHoliday(cell.key);
          const blocked = isAfterSchoolYearEnd(cell.key, schoolYearEnd);
          return <Pressable key={cell.key} disabled={blocked} onPress={() => onSelect(cell.key)} style={[styles.dayCell, selected && styles.dayCellSelected, holiday && styles.dayCellHoliday, !cell.inMonth && styles.dayCellMuted, blocked && styles.dayCellBlocked]}><Text style={[styles.dayCellText, selected && styles.dayCellTextSelected, holiday && styles.dayCellTextHoliday]}>{parseDateKey(cell.key).getDate()}</Text>{holiday ? <Text style={styles.holidayBadge}>FER</Text> : <View style={styles.dayDotSpacer} />}</Pressable>;
        })}</View>
        <SecondaryButton title="Fechar" onPress={onClose} />
      </View></View>
    </Modal>
  );
}

function DateButton({ label, value, onPress }) {
  const holiday = isNationalHoliday(value);
  return <Pressable style={[styles.calendarField, holiday && styles.calendarFieldHoliday]} onPress={onPress}><Text style={styles.inputLabel}>{label}</Text><Text style={styles.calendarFieldText}>{shortDate(value)}</Text><Text style={styles.calendarFieldHint}>{holiday ? `Feriado: ${holidayName(value)}` : 'Toque para abrir o calendário'}</Text></Pressable>;
}
function ActionButton({ title, subtitle, onPress }) { return <Pressable style={styles.actionButton} onPress={onPress}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionSubtitle}>{subtitle}</Text></Pressable>; }
function PrimaryButton({ title, onPress }) { return <Pressable style={styles.primaryButton} onPress={onPress}><Text style={styles.primaryButtonText}>{title}</Text></Pressable>; }
function SecondaryButton({ title, onPress }) { return <Pressable style={styles.secondaryButton} onPress={onPress}><Text style={styles.secondaryButtonText}>{title}</Text></Pressable>; }
function SectionTitle({ title, subtitle }) { return <View style={styles.sectionTitleWrap}><Text style={styles.sectionTitle}>{title}</Text>{subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}</View>; }
function EmptyState({ text }) { return <View style={styles.emptyCard}><Text style={styles.emptyText}>{text}</Text></View>; }
function StatCard({ label, value }) { return <View style={styles.statCard}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function ManagementCard({ title, subtitle, button, onPress }) { return <View style={styles.managementCard}><Text style={styles.managementTitle}>{title}</Text><Text style={styles.managementSubtitle}>{subtitle}</Text><Pressable style={styles.miniButton} onPress={onPress}><Text style={styles.miniButtonText}>{button}</Text></Pressable></View>; }
function SummaryList({ title, items, empty, colors = {} }) { return <View style={styles.card}><Text style={styles.summaryTitle}>{title}</Text>{items.length === 0 ? <Text style={styles.summaryEmpty}>{empty}</Text> : items.map((item) => <View key={item} style={styles.summaryRow}><View style={[styles.summaryBullet, colors[item] ? { backgroundColor: colors[item] } : null]} /><Text style={styles.summaryItem}>{item}</Text></View>)}</View>; }
function SwitchRow({ label, value, onValueChange }) { return <View style={styles.switchRow}><Text style={styles.switchLabel}>{label}</Text><Switch value={value} onValueChange={onValueChange} thumbColor={palette.white} trackColor={{ false: '#CBD5E1', true: palette.primary }} /></View>; }
function InputField({ label, multiline = false, ...props }) { return <View style={styles.inputWrapFlex}><Text style={styles.inputLabel}>{label}</Text><TextInput {...props} placeholderTextColor={palette.muted} multiline={multiline} style={[styles.input, multiline && styles.inputMultiline]} /></View>; }
function SelectField({ label, options, value, onChange, placeholder = 'Selecione' }) {
  const selected = options.find((item) => item.value === value);
  return <View style={styles.inputWrapFlex}><Text style={styles.inputLabel}>{label}</Text><View style={styles.selectWrap}>{options.map((option) => { const active = option.value === value; return <Pressable key={`${label}-${String(option.value)}`} onPress={() => onChange(option.value)} style={[styles.selectChip, active && styles.selectChipActive]}>{option.color ? <View style={[styles.selectColorDot, { backgroundColor: option.color }]} /> : null}<Text style={[styles.selectChipText, active && styles.selectChipTextActive]}>{option.label || placeholder}</Text></Pressable>; })}{!selected && value === '' && placeholder ? <Text style={styles.selectPlaceholder}>{placeholder}</Text> : null}</View></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg }, container: { flex: 1, backgroundColor: palette.bg }, body: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 10 }, logoWrap: { flexDirection: 'row', alignItems: 'center', gap: 14 }, logoImage: { width: 72, height: 72, borderRadius: 22 }, brand: { color: palette.text, fontSize: 31, fontWeight: '900' }, brandSub: { color: '#28B7C8', fontSize: 15, marginTop: 2, fontWeight: '800' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 130 }, heroCard: { backgroundColor: palette.card, borderRadius: 28, padding: 22, borderWidth: 1, borderColor: palette.border, elevation: 2 }, heroTitle: { color: palette.text, fontSize: 34, fontWeight: '900' }, heroSubtitle: { color: palette.accent, fontSize: 17, marginTop: 8, fontWeight: '900' }, heroParagraph: { color: palette.muted, fontSize: 18, marginTop: 18, lineHeight: 28 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 16 }, statCard: { flex: 1, backgroundColor: palette.card, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: palette.border, elevation: 1 }, statValue: { color: palette.text, fontSize: 30, fontWeight: '900' }, statLabel: { color: palette.muted, fontSize: 15, marginTop: 8 }, sectionTitleWrap: { marginTop: 22, marginBottom: 12 }, sectionTitle: { color: palette.text, fontSize: 26, fontWeight: '900' }, sectionSubtitle: { color: palette.muted, fontSize: 16, marginTop: 4 },
  eventCard: { flexDirection: 'row', backgroundColor: palette.card, borderRadius: 22, marginBottom: 14, overflow: 'hidden', borderWidth: 1, borderColor: palette.border, elevation: 2 }, eventColor: { width: 8 }, eventContent: { flex: 1, padding: 18 }, eventTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, eventTitle: { color: palette.text, fontSize: 20, fontWeight: '900', flex: 1 }, eventTime: { color: palette.accent, fontSize: 17, fontWeight: '900' }, eventSubtitle: { color: palette.muted, fontSize: 16, marginTop: 8 }, eventDate: { color: palette.text, fontSize: 15, marginTop: 12 }, eventDescription: { color: palette.muted, fontSize: 14, marginTop: 8, lineHeight: 20 },
  tabsWrap: { position: 'absolute', left: 18, right: 18, bottom: 18, backgroundColor: palette.card, borderRadius: 28, flexDirection: 'row', padding: 8, borderWidth: 1, borderColor: palette.border, justifyContent: 'space-between', elevation: 6 }, tabItem: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 22, paddingHorizontal: 3 }, tabItemActive: { backgroundColor: palette.primary }, tabText: { color: palette.muted, fontSize: 12, fontWeight: '800', textAlign: 'center' }, tabTextActive: { color: palette.white },
  fab: { position: 'absolute', right: 28, bottom: 112, width: 78, height: 78, borderRadius: 39, backgroundColor: palette.accent, justifyContent: 'center', alignItems: 'center', elevation: 8 }, fabIcon: { color: palette.text, fontSize: 48, fontWeight: '900', marginTop: -4 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(8, 43, 95, 0.35)', justifyContent: 'center', padding: 16 }, modalCard: { backgroundColor: palette.card, borderRadius: 26, padding: 18, maxHeight: '90%', borderWidth: 1, borderColor: palette.border }, modalTitle: { color: palette.text, fontSize: 24, fontWeight: '900' }, modalSubtitle: { color: palette.muted, fontSize: 14, marginTop: 4, marginBottom: 16, lineHeight: 20 },
  actionButton: { backgroundColor: palette.bgSoft, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: palette.border }, actionTitle: { color: palette.text, fontSize: 16, fontWeight: '900' }, actionSubtitle: { color: palette.muted, fontSize: 13, marginTop: 6 }, primaryButton: { backgroundColor: palette.primary, paddingVertical: 15, borderRadius: 18, alignItems: 'center', marginTop: 12 }, primaryButtonText: { color: palette.white, fontSize: 15, fontWeight: '900' }, secondaryButton: { backgroundColor: palette.card, paddingVertical: 14, borderRadius: 18, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: palette.border }, secondaryButtonText: { color: palette.text, fontSize: 14, fontWeight: '800' },
  inputWrapFlex: { flex: 1, marginBottom: 12 }, inputLabel: { color: palette.text, fontSize: 14, fontWeight: '900', marginBottom: 7 }, input: { backgroundColor: palette.white, color: palette.text, borderRadius: 18, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 }, inputMultiline: { minHeight: 88, textAlignVertical: 'top' }, rowGap: { flexDirection: 'row', gap: 10 }, calendarField: { backgroundColor: palette.white, borderRadius: 18, borderWidth: 1, borderColor: palette.border, padding: 14, marginBottom: 12 }, calendarFieldHoliday: { borderColor: palette.danger, backgroundColor: palette.dangerSoft }, calendarFieldText: { color: palette.text, fontSize: 16, fontWeight: '900' }, calendarFieldHint: { color: palette.muted, fontSize: 12, marginTop: 6 },
  calendarCard: { backgroundColor: palette.card, borderRadius: 28, padding: 16, borderWidth: 1, borderColor: palette.border, elevation: 2 }, calendarHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }, calendarTitle: { color: palette.text, fontSize: 22, fontWeight: '900' }, monthNav: { width: 52, height: 52, borderRadius: 18, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' }, monthNavText: { color: palette.text, fontSize: 28, fontWeight: '900' }, weekHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }, weekHeaderText: { width: '14.285%', textAlign: 'center', color: palette.muted, fontSize: 14, fontWeight: '900' }, calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' }, dayCell: { width: '14.285%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 18, marginVertical: 2 }, dayCellSelected: { backgroundColor: palette.primary }, dayCellHoliday: { backgroundColor: palette.dangerSoft, borderWidth: 1, borderColor: palette.danger }, dayCellBlocked: { opacity: 0.35 }, dayCellMuted: { opacity: 0.45 }, dayCellText: { color: palette.text, fontSize: 16, fontWeight: '900' }, dayCellTextSelected: { color: palette.white }, dayCellTextHoliday: { color: palette.danger }, holidayBadge: { color: palette.danger, fontSize: 8, fontWeight: '900', marginTop: 2 }, dayDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.accent, marginTop: 4 }, dayDotSpacer: { width: 7, height: 7, marginTop: 4 }, legendRow: { flexDirection: 'row', gap: 18, marginTop: 12, justifyContent: 'center' }, legendHoliday: { color: palette.danger, fontWeight: '800' }, legendEvent: { color: palette.accent, fontWeight: '800' },
  emptyCard: { backgroundColor: palette.card, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: palette.border }, emptyText: { color: palette.muted, fontSize: 15 }, holidayCard: { backgroundColor: palette.dangerSoft, borderColor: palette.danger, borderWidth: 1, borderRadius: 22, padding: 18, marginBottom: 14 }, holidayTitle: { color: palette.danger, fontWeight: '900', fontSize: 18 }, holidayName: { color: palette.text, fontWeight: '900', fontSize: 16, marginTop: 6 }, holidayText: { color: palette.muted, marginTop: 8, lineHeight: 20 },
  managementGrid: { gap: 12 }, managementCard: { backgroundColor: palette.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: palette.border }, managementTitle: { color: palette.text, fontSize: 16, fontWeight: '900' }, managementSubtitle: { color: palette.muted, fontSize: 13, marginTop: 4 }, miniButton: { alignSelf: 'flex-start', backgroundColor: palette.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, marginTop: 12 }, miniButtonText: { color: palette.white, fontWeight: '800', fontSize: 13 }, card: { backgroundColor: palette.card, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: palette.border, marginBottom: 12 }, infoCard: { backgroundColor: palette.card, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: palette.border, marginTop: 12 }, infoTitle: { color: palette.text, fontWeight: '900', fontSize: 17 }, infoText: { color: palette.muted, fontSize: 15, marginTop: 8, lineHeight: 22 }, summaryTitle: { color: palette.text, fontWeight: '900', fontSize: 15, marginBottom: 10 }, summaryEmpty: { color: palette.muted, fontSize: 13 }, summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }, summaryBullet: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.primary }, summaryItem: { color: palette.text, fontSize: 14 }, colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 }, colorBubble: { width: 42, height: 42, borderRadius: 21 }, colorBubbleSelected: { borderWidth: 4, borderColor: palette.text }, switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 12 }, switchLabel: { color: palette.text, fontSize: 16, flex: 1, paddingRight: 10 }, selectWrap: { backgroundColor: palette.white, borderRadius: 18, borderWidth: 1, borderColor: palette.border, padding: 10, gap: 8 }, selectChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: palette.bgSoft, borderRadius: 14 }, selectChipActive: { backgroundColor: palette.primary }, selectChipText: { color: palette.text, fontSize: 14, fontWeight: '800' }, selectChipTextActive: { color: palette.white }, selectColorDot: { width: 10, height: 10, borderRadius: 5 }, selectPlaceholder: { color: palette.muted, fontSize: 12, marginTop: 2 },
});

export default App;
