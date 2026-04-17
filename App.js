import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
  bg: '#08111F',
  bgSoft: '#0F1C2E',
  card: '#13243B',
  border: '#203656',
  text: '#F5F7FB',
  muted: '#9EB0C9',
  primary: '#2D7FF9',
  accent: '#FDBA2D',
  danger: '#E45C5C',
  success: '#34C38F',
  white: '#FFFFFF',
};

const SCHOOL_COLORS = ['#2D7FF9', '#34C38F', '#FDBA2D', '#A855F7', '#EF4444', '#14B8A6', '#F97316'];
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
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const pad = (n) => String(n).padStart(2, '0');
const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseDateKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
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
const sameDay = (a, b) => toDateKey(a) === toDateKey(b);
const isWithinRange = (date, start, end) => date >= start && date <= end;

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
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState(null);
  const [calendarPickerOpen, setCalendarPickerOpen] = useState(false);
  const [calendarTargetField, setCalendarTargetField] = useState('date');
  const [lessonForm, setLessonForm] = useState({ schoolId: '', classId: '', subjectId: '', weekday: 1, startTime: '07:00', endTime: '07:50' });
  const [commitmentForm, setCommitmentForm] = useState({ type: COMMITMENT_TYPES[0], title: '', description: '', schoolId: '', date: toDateKey(new Date()), time: '08:00', recurrence: 'Não repetir' });
  const [managementModal, setManagementModal] = useState(null);
  const [schoolForm, setSchoolForm] = useState({ name: '', color: SCHOOL_COLORS[0] });
  const [classForm, setClassForm] = useState({ name: '' });
  const [subjectForm, setSubjectForm] = useState({ name: '' });

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setData({ ...initialData, ...parsed });
        }
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
  }, [data, viewMonth]);

  const todayKey = toDateKey(new Date());
  const todaysEvents = enrichedEvents.filter((event) => event.date === todayKey);
  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfWeek(new Date());
  const weekEvents = enrichedEvents.filter((event) => {
    const eventDate = parseDateKey(event.date);
    return isWithinRange(eventDate, weekStart, weekEnd);
  });

  const selectedDayEvents = enrichedEvents.filter((event) => event.date === selectedDate);
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

  const openCreateMenu = () => setModalOpen(true);

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
    setData((prev) => ({
      ...prev,
      lessons: [...prev.lessons, { id: uid(), ...lessonForm }],
    }));
    setLessonForm({ schoolId: '', classId: '', subjectId: '', weekday: 1, startTime: '07:00', endTime: '07:50' });
    setModalMode(null);
    setModalOpen(false);
  };

  const saveCommitment = () => {
    if (!commitmentForm.title.trim()) {
      Alert.alert('Campo obrigatório', 'Informe um título para o compromisso.');
      return;
    }
    setData((prev) => ({
      ...prev,
      commitments: [...prev.commitments, { id: uid(), ...commitmentForm, title: commitmentForm.title.trim(), description: commitmentForm.description.trim() }],
    }));
    setCommitmentForm({ type: COMMITMENT_TYPES[0], title: '', description: '', schoolId: '', date: toDateKey(new Date()), time: '08:00', recurrence: 'Não repetir' });
    setModalMode(null);
    setModalOpen(false);
  };

  const markCommitmentDone = (event) => {
    if (event.eventType !== 'compromisso') return;
    setData((prev) => ({
      ...prev,
      commitments: prev.commitments.filter((item) => item.id !== event.originalId),
    }));
  };

  const updateProfile = (patch) => setData((prev) => ({ ...prev, profile: { ...prev.profile, ...patch } }));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <Header teacherName={data.profile.teacherName} />

        <View style={styles.body}>
          {activeTab === 'Hoje' && <TodayTab events={todaysEvents} counts={counts} />}
          {activeTab === 'Semana' && <WeekTab events={weekEvents} weekStart={weekStart} weekEnd={weekEnd} />}
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
          {activeTab === 'Gestão' && (
            <ManagementTab
              data={data}
              counts={counts}
              openManage={setManagementModal}
            />
          )}
          {activeTab === 'Configurações' && (
            <SettingsTab profile={data.profile} updateProfile={updateProfile} />
          )}
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
                <ActionButton title="Nova aula" subtitle="Horários recorrentes por escola, turma e disciplina" onPress={() => setModalMode('lesson')} />
                <ActionButton title="Novo compromisso" subtitle="Avaliações, reuniões pedagógicas e outros" onPress={() => setModalMode('commitment')} />
                <SecondaryButton title="Fechar" onPress={() => setModalOpen(false)} />
              </View>
            )}

            {modalMode === 'lesson' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>Nova aula</Text>
                <Text style={styles.modalSubtitle}>As aulas se repetem semanalmente automaticamente.</Text>
                <SelectField
                  label="Escola"
                  placeholder="Selecione uma escola"
                  value={lessonForm.schoolId}
                  options={data.schools.map((item) => ({ label: item.name, value: item.id, color: item.color }))}
                  onChange={(value) => setLessonForm((prev) => ({ ...prev, schoolId: value }))}
                />
                <SelectField
                  label="Turma"
                  placeholder="Selecione uma turma"
                  value={lessonForm.classId}
                  options={data.classes.map((item) => ({ label: item.name, value: item.id }))}
                  onChange={(value) => setLessonForm((prev) => ({ ...prev, classId: value }))}
                />
                <SelectField
                  label="Disciplina"
                  placeholder="Selecione uma disciplina"
                  value={lessonForm.subjectId}
                  options={data.subjects.map((item) => ({ label: item.name, value: item.id }))}
                  onChange={(value) => setLessonForm((prev) => ({ ...prev, subjectId: value }))}
                />
                <SelectField
                  label="Dia da semana"
                  value={lessonForm.weekday}
                  options={WEEKDAY_OPTIONS}
                  onChange={(value) => setLessonForm((prev) => ({ ...prev, weekday: value }))}
                />
                <View style={styles.rowGap}>
                  <InputField label="Início" value={lessonForm.startTime} onChangeText={(text) => setLessonForm((prev) => ({ ...prev, startTime: text }))} placeholder="07:00" />
                  <InputField label="Fim" value={lessonForm.endTime} onChangeText={(text) => setLessonForm((prev) => ({ ...prev, endTime: text }))} placeholder="07:50" />
                </View>
                <PrimaryButton title="Salvar aula" onPress={saveLesson} />
                <SecondaryButton title="Voltar" onPress={() => setModalMode(null)} />
              </ScrollView>
            )}

            {modalMode === 'commitment' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>Novo compromisso</Text>
                <Text style={styles.modalSubtitle}>Escolha data, tipo e recorrência.</Text>
                <SelectField
                  label="Tipo"
                  value={commitmentForm.type}
                  options={COMMITMENT_TYPES.map((item) => ({ label: item, value: item }))}
                  onChange={(value) => setCommitmentForm((prev) => ({ ...prev, type: value }))}
                />
                <InputField label="Título" value={commitmentForm.title} onChangeText={(text) => setCommitmentForm((prev) => ({ ...prev, title: text }))} placeholder="Ex.: Entregar notas do 2º bimestre" />
                <InputField label="Descrição" multiline value={commitmentForm.description} onChangeText={(text) => setCommitmentForm((prev) => ({ ...prev, description: text }))} placeholder="Observações do compromisso" />
                <SelectField
                  label="Escola (opcional)"
                  placeholder="Sem escola vinculada"
                  value={commitmentForm.schoolId}
                  options={[{ label: 'Sem escola vinculada', value: '' }, ...data.schools.map((item) => ({ label: item.name, value: item.id, color: item.color }))]}
                  onChange={(value) => setCommitmentForm((prev) => ({ ...prev, schoolId: value }))}
                />
                <Pressable
                  style={styles.calendarField}
                  onPress={() => {
                    setCalendarTargetField('date');
                    setCalendarPickerOpen(true);
                  }}
                >
                  <Text style={styles.inputLabel}>Data</Text>
                  <Text style={styles.calendarFieldText}>{shortDate(commitmentForm.date)}</Text>
                  <Text style={styles.calendarFieldHint}>Toque para abrir o calendário</Text>
                </Pressable>
                <View style={styles.rowGap}>
                  <InputField label="Horário" value={commitmentForm.time} onChangeText={(text) => setCommitmentForm((prev) => ({ ...prev, time: text }))} placeholder="14:00" />
                  <SelectField
                    label="Repetição"
                    value={commitmentForm.recurrence}
                    options={RECURRENCE_OPTIONS.map((item) => ({ label: item, value: item }))}
                    onChange={(value) => setCommitmentForm((prev) => ({ ...prev, recurrence: value }))}
                  />
                </View>
                <PrimaryButton title="Salvar compromisso" onPress={saveCommitment} />
                <SecondaryButton title="Voltar" onPress={() => setModalMode(null)} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <CalendarPicker
        visible={calendarPickerOpen}
        value={commitmentForm.date}
        onClose={() => setCalendarPickerOpen(false)}
        onSelect={(dateKey) => {
          if (calendarTargetField === 'date') {
            setCommitmentForm((prev) => ({ ...prev, date: dateKey }));
          }
          setCalendarPickerOpen(false);
        }}
      />

      <ManagementModal
        type={managementModal}
        onClose={() => setManagementModal(null)}
        schoolForm={schoolForm}
        setSchoolForm={setSchoolForm}
        classForm={classForm}
        setClassForm={setClassForm}
        subjectForm={subjectForm}
        setSubjectForm={setSubjectForm}
        saveSchool={saveSchool}
        saveClass={saveClass}
        saveSubject={saveSubject}
      />
    </SafeAreaView>
  );
}

function Header({ teacherName }) {
  return (
    <View style={styles.header}>
      <View style={styles.logoWrap}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoBadgeText}>AP</Text>
        </View>
        <View>
          <Text style={styles.brand}>Agenda Prof</Text>
          <Text style={styles.brandSub}>{teacherName ? `Olá, ${teacherName}` : 'Organize aulas, tarefas e compromissos'}</Text>
        </View>
      </View>
    </View>
  );
}

function TodayTab({ events, counts }) {
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
      {events.length === 0 ? <EmptyState text="Nenhum item programado para hoje." /> : events.map((event) => <EventCard key={event.id} event={event} />)}
    </ScrollView>
  );
}

function WeekTab({ events, weekStart, weekEnd }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <SectionTitle title="Tarefas da Semana" subtitle={`${weekStart.toLocaleDateString('pt-BR')} até ${weekEnd.toLocaleDateString('pt-BR')}`} />
      {events.length === 0 ? <EmptyState text="Nenhuma tarefa programada nesta semana." /> : events.map((event) => <EventCard key={event.id} event={event} />)}
    </ScrollView>
  );
}

function CalendarTab({ monthCells, selectedDate, setSelectedDate, selectedDayEvents, eventCountByDay, viewMonth, setViewMonth }) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
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
          {DAYS.map((day) => (
            <Text key={day} style={styles.weekHeaderText}>{day}</Text>
          ))}
        </View>
        <View style={styles.calendarGrid}>
          {monthCells.map((cell) => {
            const selected = cell.key === selectedDate;
            const hasEvent = eventCountByDay[cell.key] > 0;
            return (
              <Pressable
                key={cell.key}
                onPress={() => setSelectedDate(cell.key)}
                style={[styles.dayCell, selected && styles.dayCellSelected, !cell.inMonth && styles.dayCellMuted]}
              >
                <Text style={[styles.dayCellText, selected && styles.dayCellTextSelected]}>{parseDateKey(cell.key).getDate()}</Text>
                {hasEvent ? <View style={styles.dayDot} /> : <View style={styles.dayDotSpacer} />}
              </Pressable>
            );
          })}
        </View>
      </View>

      <SectionTitle title={`Agenda de ${shortDate(selectedDate)}`} />
      {selectedDayEvents.length === 0 ? <EmptyState text="Nenhuma tarefa neste dia." /> : selectedDayEvents.map((event) => <EventCard key={event.id} event={event} />)}
    </ScrollView>
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
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Próximas evoluções sugeridas</Text>
        <Text style={styles.infoText}>Login Google real, sincronização com Google Agenda e Google Drive podem ser adicionados depois.</Text>
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
        <Text style={styles.eventDate}>{shortDate(event.date)}</Text>
        {event.description ? <Text style={styles.eventDescription}>{event.description}</Text> : null}
      </View>
    </View>
  );
}

function BottomTabs({ activeTab, setActiveTab }) {
  const tabs = ['Hoje', 'Semana', 'Calendário', 'Gestão', 'Configurações'];
  return (
    <View style={styles.tabsWrap}>
      {tabs.map((tab) => (
        <Pressable key={tab} style={[styles.tabItem, activeTab === tab && styles.tabItemActive]} onPress={() => setActiveTab(tab)}>
          <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
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
        <View style={styles.modalCard}>
          {type === 'school' && (
            <View>
              <Text style={styles.modalTitle}>Nova escola</Text>
              <InputField label="Nome da escola" value={schoolForm.name} onChangeText={(text) => setSchoolForm((prev) => ({ ...prev, name: text }))} placeholder="Ex.: Escola Estadual Central" />
              <Text style={styles.inputLabel}>Cor de identificação</Text>
              <View style={styles.colorRow}>
                {SCHOOL_COLORS.map((color) => (
                  <Pressable
                    key={color}
                    onPress={() => setSchoolForm((prev) => ({ ...prev, color }))}
                    style={[styles.colorBubble, { backgroundColor: color }, schoolForm.color === color && styles.colorBubbleSelected]}
                  />
                ))}
              </View>
              <PrimaryButton title="Salvar escola" onPress={saveSchool} />
              <SecondaryButton title="Cancelar" onPress={onClose} />
            </View>
          )}
          {type === 'class' && (
            <View>
              <Text style={styles.modalTitle}>Nova turma</Text>
              <InputField label="Nome da turma" value={classForm.name} onChangeText={(text) => setClassForm({ name: text })} placeholder="Ex.: 1º ano 1" />
              <PrimaryButton title="Salvar turma" onPress={saveClass} />
              <SecondaryButton title="Cancelar" onPress={onClose} />
            </View>
          )}
          {type === 'subject' && (
            <View>
              <Text style={styles.modalTitle}>Nova disciplina</Text>
              <InputField label="Nome da disciplina" value={subjectForm.name} onChangeText={(text) => setSubjectForm({ name: text })} placeholder="Ex.: História" />
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
          <View style={styles.calendarHeaderRow}>
            <Pressable style={styles.monthNav} onPress={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}>
              <Text style={styles.monthNavText}>‹</Text>
            </Pressable>
            <Text style={styles.calendarTitle}>{monthTitle(viewDate)}</Text>
            <Pressable style={styles.monthNav} onPress={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}>
              <Text style={styles.monthNavText}>›</Text>
            </Pressable>
          </View>
          <View style={styles.weekHeader}>
            {DAYS.map((day) => (
              <Text key={day} style={styles.weekHeaderText}>{day}</Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {cells.map((cell) => {
              const selected = cell.key === value;
              return (
                <Pressable key={cell.key} onPress={() => onSelect(cell.key)} style={[styles.dayCell, selected && styles.dayCellSelected, !cell.inMonth && styles.dayCellMuted]}>
                  <Text style={[styles.dayCellText, selected && styles.dayCellTextSelected]}>{parseDateKey(cell.key).getDate()}</Text>
                </Pressable>
              );
            })}
          </View>
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

function PrimaryButton({ title, onPress }) {
  return (
    <Pressable style={styles.primaryButton} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{title}</Text>
    </Pressable>
  );
}

function SecondaryButton({ title, onPress }) {
  return (
    <Pressable style={styles.secondaryButton} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{title}</Text>
    </Pressable>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <View style={styles.sectionTitleWrap}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function EmptyState({ text }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function StatCard({ label, value }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ManagementCard({ title, subtitle, button, onPress }) {
  return (
    <View style={styles.managementCard}>
      <Text style={styles.managementTitle}>{title}</Text>
      <Text style={styles.managementSubtitle}>{subtitle}</Text>
      <Pressable style={styles.miniButton} onPress={onPress}>
        <Text style={styles.miniButtonText}>{button}</Text>
      </Pressable>
    </View>
  );
}

function SummaryList({ title, items, empty, colors = {} }) {
  return (
    <View style={styles.card}>
      <Text style={styles.summaryTitle}>{title}</Text>
      {items.length === 0 ? (
        <Text style={styles.summaryEmpty}>{empty}</Text>
      ) : (
        items.map((item) => (
          <View key={item} style={styles.summaryRow}>
            <View style={[styles.summaryBullet, colors[item] ? { backgroundColor: colors[item] } : null]} />
            <Text style={styles.summaryItem}>{item}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function SwitchRow({ label, value, onValueChange }) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} thumbColor={palette.white} trackColor={{ false: '#526581', true: palette.primary }} />
    </View>
  );
}

function InputField({ label, multiline = false, ...props }) {
  return (
    <View style={styles.inputWrapFlex}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={palette.muted}
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

function SelectField({ label, options, value, onChange, placeholder = 'Selecione' }) {
  const selected = options.find((item) => item.value === value);
  return (
    <View style={styles.inputWrapFlex}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.selectWrap}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable key={`${label}-${String(option.value)}`} onPress={() => onChange(option.value)} style={[styles.selectChip, active && styles.selectChipActive]}>
              {option.color ? <View style={[styles.selectColorDot, { backgroundColor: option.color }]} /> : null}
              <Text style={[styles.selectChipText, active && styles.selectChipTextActive]}>{option.label || placeholder}</Text>
            </Pressable>
          );
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
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10 },
  logoWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoBadge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  logoBadgeText: { color: palette.bg, fontSize: 22, fontWeight: '800' },
  brand: { color: palette.text, fontSize: 24, fontWeight: '800' },
  brandSub: { color: palette.muted, fontSize: 13, marginTop: 2 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 110 },
  heroCard: { backgroundColor: palette.card, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: palette.border },
  heroTitle: { color: palette.text, fontSize: 24, fontWeight: '800' },
  heroSubtitle: { color: palette.accent, fontSize: 14, marginTop: 4, fontWeight: '600' },
  heroParagraph: { color: palette.muted, fontSize: 14, marginTop: 10, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  statCard: { flex: 1, backgroundColor: palette.bgSoft, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: palette.border },
  statValue: { color: palette.text, fontSize: 22, fontWeight: '800' },
  statLabel: { color: palette.muted, fontSize: 12, marginTop: 4 },
  sectionTitleWrap: { marginTop: 18, marginBottom: 10 },
  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '700' },
  sectionSubtitle: { color: palette.muted, fontSize: 13, marginTop: 2 },
  eventCard: { flexDirection: 'row', backgroundColor: palette.card, borderRadius: 20, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: palette.border },
  eventColor: { width: 7 },
  eventContent: { flex: 1, padding: 14 },
  eventTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  eventTitle: { color: palette.text, fontSize: 15, fontWeight: '700', flex: 1 },
  eventTime: { color: palette.accent, fontSize: 13, fontWeight: '700' },
  eventSubtitle: { color: palette.muted, fontSize: 13, marginTop: 6 },
  eventDate: { color: palette.text, fontSize: 12, marginTop: 8 },
  eventDescription: { color: palette.muted, fontSize: 12, marginTop: 8, lineHeight: 18 },
  tabsWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 14,
    backgroundColor: '#102238',
    borderRadius: 24,
    flexDirection: 'row',
    padding: 8,
    borderWidth: 1,
    borderColor: palette.border,
    justifyContent: 'space-between',
  },
  tabItem: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 18, paddingHorizontal: 4 },
  tabItemActive: { backgroundColor: palette.primary },
  tabText: { color: palette.muted, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  tabTextActive: { color: palette.white },
  fab: {
    position: 'absolute',
    right: 22,
    bottom: 96,
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: palette.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
  fabIcon: { color: palette.bg, fontSize: 32, fontWeight: '800', marginTop: -2 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.56)', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: palette.bgSoft, borderRadius: 24, padding: 18, maxHeight: '88%', borderWidth: 1, borderColor: palette.border },
  modalTitle: { color: palette.text, fontSize: 22, fontWeight: '800' },
  modalSubtitle: { color: palette.muted, fontSize: 13, marginTop: 4, marginBottom: 16, lineHeight: 18 },
  actionButton: { backgroundColor: palette.card, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: palette.border },
  actionTitle: { color: palette.text, fontSize: 16, fontWeight: '700' },
  actionSubtitle: { color: palette.muted, fontSize: 13, marginTop: 6 },
  primaryButton: { backgroundColor: palette.primary, paddingVertical: 15, borderRadius: 18, alignItems: 'center', marginTop: 12 },
  primaryButtonText: { color: palette.white, fontSize: 15, fontWeight: '800' },
  secondaryButton: { backgroundColor: 'transparent', paddingVertical: 14, borderRadius: 18, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: palette.border },
  secondaryButtonText: { color: palette.text, fontSize: 14, fontWeight: '700' },
  inputWrapFlex: { flex: 1, marginBottom: 12 },
  inputLabel: { color: palette.text, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: {
    backgroundColor: palette.card,
    color: palette.text,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
  },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  rowGap: { flexDirection: 'row', gap: 10 },
  calendarField: { backgroundColor: palette.card, borderRadius: 16, borderWidth: 1, borderColor: palette.border, padding: 14, marginBottom: 12 },
  calendarFieldText: { color: palette.text, fontSize: 15, fontWeight: '700' },
  calendarFieldHint: { color: palette.muted, fontSize: 12, marginTop: 6 },
  calendarCard: { backgroundColor: palette.card, borderRadius: 24, padding: 14, borderWidth: 1, borderColor: palette.border },
  calendarHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calendarTitle: { color: palette.text, fontSize: 16, fontWeight: '800' },
  monthNav: { width: 40, height: 40, borderRadius: 14, backgroundColor: palette.bgSoft, alignItems: 'center', justifyContent: 'center' },
  monthNavText: { color: palette.text, fontSize: 22, fontWeight: '800' },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  weekHeaderText: { width: '14.285%', textAlign: 'center', color: palette.muted, fontSize: 12, fontWeight: '700' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.285%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  dayCellSelected: { backgroundColor: palette.primary },
  dayCellMuted: { opacity: 0.45 },
  dayCellText: { color: palette.text, fontSize: 13, fontWeight: '700' },
  dayCellTextSelected: { color: palette.white },
  dayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.accent, marginTop: 4 },
  dayDotSpacer: { width: 6, height: 6, marginTop: 4 },
  emptyCard: { backgroundColor: palette.card, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: palette.border },
  emptyText: { color: palette.muted, fontSize: 14 },
  managementGrid: { gap: 12 },
  managementCard: { backgroundColor: palette.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: palette.border },
  managementTitle: { color: palette.text, fontSize: 16, fontWeight: '700' },
  managementSubtitle: { color: palette.muted, fontSize: 13, marginTop: 4 },
  miniButton: { alignSelf: 'flex-start', backgroundColor: palette.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, marginTop: 12 },
  miniButtonText: { color: palette.white, fontWeight: '700', fontSize: 13 },
  card: { backgroundColor: palette.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: palette.border, marginBottom: 12 },
  infoCard: { backgroundColor: '#122946', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: palette.border },
  infoTitle: { color: palette.text, fontWeight: '700', fontSize: 15 },
  infoText: { color: palette.muted, fontSize: 13, marginTop: 8, lineHeight: 19 },
  summaryTitle: { color: palette.text, fontWeight: '700', fontSize: 15, marginBottom: 10 },
  summaryEmpty: { color: palette.muted, fontSize: 13 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  summaryBullet: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.primary },
  summaryItem: { color: palette.text, fontSize: 14 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  colorBubble: { width: 36, height: 36, borderRadius: 18 },
  colorBubbleSelected: { borderWidth: 3, borderColor: palette.white },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 12 },
  switchLabel: { color: palette.text, fontSize: 14, flex: 1, paddingRight: 10 },
  selectWrap: { backgroundColor: palette.card, borderRadius: 16, borderWidth: 1, borderColor: palette.border, padding: 10, gap: 8 },
  selectChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#0C1830', borderRadius: 14 },
  selectChipActive: { backgroundColor: palette.primary },
  selectChipText: { color: palette.text, fontSize: 13, fontWeight: '600' },
  selectChipTextActive: { color: palette.white },
  selectColorDot: { width: 10, height: 10, borderRadius: 5 },
  selectPlaceholder: { color: palette.muted, fontSize: 12, marginTop: 2 },
});

export default App;
