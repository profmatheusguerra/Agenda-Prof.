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
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

const STORAGE_KEY = 'agenda_prof_state_v1';
const PRIMARY = '#D4A83D';
const BG = '#0F1115';
const CARD = '#181C24';
const CARD_2 = '#202635';
const TEXT = '#F3F4F6';
const MUTED = '#9CA3AF';
const DANGER = '#E05252';
const SUCCESS = '#3DBE7A';

const demoState = {
  auth: {
    loggedIn: false,
    email: '',
    provider: 'google-simulado',
  },
  profile: {
    teacherName: '',
    theme: 'noite-profissional',
    reminders: true,
    syncOnWifiOnly: false,
  },
  schools: [
    {
      id: 'school-1',
      name: 'Escola Exemplo',
      city: 'Belo Horizonte',
      subjects: ['História'],
      classes: [
        {
          id: 'class-1',
          name: '1º ano 1',
          subject: 'História',
          schedules: [
            { id: 'sch-1', day: 'Segunda-feira', start: '07:50', end: '08:40' },
            { id: 'sch-2', day: 'Quinta-feira', start: '07:00', end: '08:00' },
          ],
        },
      ],
    },
  ],
  tasks: [
    {
      id: 'task-1',
      title: 'Enviar planejamento mensal',
      type: 'Planejamento',
      dueDate: '2026-04-20',
      school: 'Escola Exemplo',
      className: 'Coordenação',
      notes: 'Levar cronograma das turmas do 1º ano.',
    },
    {
      id: 'task-2',
      title: 'Corrigir atividade diagnóstica',
      type: 'Atividade',
      dueDate: '2026-04-18',
      school: 'Escola Exemplo',
      className: '1º ano 1',
      notes: 'Separar devolutiva por habilidade.',
    },
  ],
};

function uid(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function weekdayPt(date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long' })
    .format(date)
    .replace(/^[a-z]/, (c) => c.toUpperCase());
}

function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function nextClassesForToday(schools) {
  const day = weekdayPt();
  const result = [];

  schools.forEach((school) => {
    school.classes.forEach((item) => {
      item.schedules.forEach((schedule) => {
        if (schedule.day === day) {
          result.push({
            school: school.name,
            className: item.name,
            subject: item.subject,
            start: schedule.start,
            end: schedule.end,
          });
        }
      });
    });
  });

  return result.sort((a, b) => a.start.localeCompare(b.start));
}

export default function App() {
  const [state, setState] = useState(demoState);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('home');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    type: 'Atividade',
    dueDate: todayIso(),
    school: '',
    className: '',
    notes: '',
  });
  const [schoolForm, setSchoolForm] = useState({
    name: '',
    city: '',
    subjects: '',
  });
  const [classForm, setClassForm] = useState({
    schoolId: '',
    name: '',
    subject: '',
    day: 'Segunda-feira',
    start: '07:00',
    end: '08:00',
  });
  const [loginForm, setLoginForm] = useState({
    email: '',
    teacherName: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setState(JSON.parse(raw));
        }
      } catch (error) {
        console.log('Erro ao carregar dados locais', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loading) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch((error) =>
        console.log('Erro ao salvar dados locais', error)
      );
    }
  }, [state, loading]);

  const todayClasses = useMemo(() => nextClassesForToday(state.schools), [state.schools]);

  const todayTasks = useMemo(
    () => state.tasks.filter((item) => item.dueDate === todayIso()).sort((a, b) => a.title.localeCompare(b.title)),
    [state.tasks]
  );

  const sortedTasks = useMemo(
    () => [...state.tasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [state.tasks]
  );

  const handleSimulatedGoogleLogin = () => {
    if (!loginForm.email.trim()) {
      Alert.alert('Informe seu e-mail', 'Digite o e-mail que será usado no modo de teste.');
      return;
    }

    setState((prev) => ({
      ...prev,
      auth: {
        loggedIn: true,
        email: loginForm.email.trim(),
        provider: 'google-simulado',
      },
      profile: {
        ...prev.profile,
        teacherName: loginForm.teacherName.trim() || prev.profile.teacherName,
      },
    }));
  };

  const addTask = () => {
    if (!taskForm.title.trim()) {
      Alert.alert('Título obrigatório', 'Digite o título da tarefa.');
      return;
    }

    setState((prev) => ({
      ...prev,
      tasks: [
        ...prev.tasks,
        {
          id: uid('task'),
          title: taskForm.title.trim(),
          type: taskForm.type,
          dueDate: taskForm.dueDate,
          school: taskForm.school.trim(),
          className: taskForm.className.trim(),
          notes: taskForm.notes.trim(),
        },
      ],
    }));

    setTaskForm({
      title: '',
      type: 'Atividade',
      dueDate: todayIso(),
      school: '',
      className: '',
      notes: '',
    });
    setShowTaskModal(false);
  };

  const completeTask = (taskId) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((item) => item.id !== taskId),
    }));
  };

  const addSchool = () => {
    if (!schoolForm.name.trim()) {
      Alert.alert('Nome obrigatório', 'Digite o nome da escola.');
      return;
    }

    setState((prev) => ({
      ...prev,
      schools: [
        ...prev.schools,
        {
          id: uid('school'),
          name: schoolForm.name.trim(),
          city: schoolForm.city.trim(),
          subjects: schoolForm.subjects
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          classes: [],
        },
      ],
    }));

    setSchoolForm({ name: '', city: '', subjects: '' });
    setShowSchoolModal(false);
  };

  const addClass = () => {
    if (!classForm.schoolId || !classForm.name.trim() || !classForm.subject.trim()) {
      Alert.alert('Campos obrigatórios', 'Selecione a escola e preencha turma e conteúdo.');
      return;
    }

    setState((prev) => ({
      ...prev,
      schools: prev.schools.map((school) => {
        if (school.id !== classForm.schoolId) return school;

        return {
          ...school,
          classes: [
            ...school.classes,
            {
              id: uid('class'),
              name: classForm.name.trim(),
              subject: classForm.subject.trim(),
              schedules: [
                {
                  id: uid('schedule'),
                  day: classForm.day,
                  start: classForm.start,
                  end: classForm.end,
                },
              ],
            },
          ],
        };
      }),
    }));

    setClassForm({
      schoolId: state.schools[0]?.id || '',
      name: '',
      subject: '',
      day: 'Segunda-feira',
      start: '07:00',
      end: '08:00',
    });
    setShowClassModal(false);
  };

  const updateProfile = (field, value) => {
    setState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        [field]: value,
      },
    }));
  };

  const resetApp = () => {
    Alert.alert('Limpar dados?', 'Isso apaga os dados locais do app de teste.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(STORAGE_KEY);
          setState(demoState);
          setTab('home');
        },
      },
    ]);
  };

  useEffect(() => {
    if (!classForm.schoolId && state.schools[0]?.id) {
      setClassForm((prev) => ({ ...prev, schoolId: state.schools[0].id }));
    }
  }, [state.schools, classForm.schoolId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={[styles.center, { flex: 1 }]}>
          <Text style={styles.title}>Agenda Prof.</Text>
          <Text style={styles.muted}>Carregando dados...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!state.auth.loggedIn) {
    return (
      <SafeAreaView style={styles.container}>
        <ExpoStatusBar style="light" />
        <ScrollView contentContainerStyle={styles.authContainer}>
          <Text style={styles.logo}>Agenda Prof.</Text>
          <Text style={styles.subtitle}>Organize aulas, tarefas, planejamentos e entregas da coordenação.</Text>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Entrar com Google (modo de teste)</Text>
            <Text style={styles.helper}>
              Nesta versão, o login é simulado. No futuro, a autenticação real poderá usar Google Sign-In,
              Calendar e Drive.
            </Text>

            <LabeledInput
              label="Seu nome"
              value={loginForm.teacherName}
              onChangeText={(value) => setLoginForm((prev) => ({ ...prev, teacherName: value }))}
              placeholder="Ex.: Professor João"
            />
            <LabeledInput
              label="E-mail Google"
              value={loginForm.email}
              onChangeText={(value) => setLoginForm((prev) => ({ ...prev, email: value }))}
              placeholder="seuemail@gmail.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Pressable style={styles.primaryButton} onPress={handleSimulatedGoogleLogin}>
              <Text style={styles.primaryButtonText}>Entrar</Text>
            </Pressable>
          </View>

          <View style={styles.cardSecondary}>
            <Text style={styles.sectionTitle}>Identidade sugerida</Text>
            <Text style={styles.listText}>• Fundo grafite/azul escuro</Text>
            <Text style={styles.listText}>• Detalhes dourados para foco visual</Text>
            <Text style={styles.listText}>• Cartões claros para próximas aulas</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="light" />
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Agenda Prof.</Text>
          <Text style={styles.headerSubtitle}>
            {state.profile.teacherName || 'Professor(a)'} • {state.auth.email}
          </Text>
        </View>
        <Pressable style={styles.plusButton} onPress={() => setShowTaskModal(true)}>
          <Text style={styles.plusButtonText}>＋</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'home' && (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Hoje • {formatDate(new Date())}</Text>
              <Text style={styles.helper}>Próximas aulas previstas para {weekdayPt()}.</Text>

              {todayClasses.length === 0 ? (
                <Text style={styles.emptyText}>Nenhuma aula cadastrada para hoje.</Text>
              ) : (
                todayClasses.map((item, index) => (
                  <View key={`${item.school}-${item.className}-${index}`} style={styles.rowCard}>
                    <Text style={styles.rowTitle}>{item.subject} • {item.className}</Text>
                    <Text style={styles.rowMeta}>{item.school}</Text>
                    <Text style={styles.rowMeta}>{item.start} às {item.end}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Tarefas do dia</Text>
              {todayTasks.length === 0 ? (
                <Text style={styles.emptyText}>Nenhuma tarefa com vencimento hoje.</Text>
              ) : (
                todayTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onComplete={() => completeTask(task.id)} />
                ))
              )}
            </View>

            <View style={styles.cardSecondary}>
              <Text style={styles.sectionTitle}>Próximas entregas</Text>
              {sortedTasks.slice(0, 5).map((task) => (
                <View key={task.id} style={styles.compactRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{task.title}</Text>
                    <Text style={styles.rowMeta}>{task.type} • {task.className || task.school || 'Geral'}</Text>
                  </View>
                  <Text style={styles.dateBadge}>{task.dueDate}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {tab === 'manage' && (
          <>
            <View style={styles.card}>
              <View style={styles.inlineHeader}>
                <Text style={styles.sectionTitle}>Gestão do professor</Text>
                <View style={styles.inlineActions}>
                  <Pressable style={styles.smallButton} onPress={() => setShowSchoolModal(true)}>
                    <Text style={styles.smallButtonText}>+ Escola</Text>
                  </Pressable>
                  <Pressable style={styles.smallButton} onPress={() => setShowClassModal(true)}>
                    <Text style={styles.smallButtonText}>+ Turma</Text>
                  </Pressable>
                </View>
              </View>

              {state.schools.map((school) => (
                <View key={school.id} style={styles.schoolCard}>
                  <Text style={styles.rowTitle}>{school.name}</Text>
                  <Text style={styles.rowMeta}>{school.city || 'Cidade não informada'}</Text>
                  {!!school.subjects.length && (
                    <Text style={styles.rowMeta}>Disciplinas: {school.subjects.join(', ')}</Text>
                  )}

                  {school.classes.length === 0 ? (
                    <Text style={styles.emptyText}>Nenhuma turma cadastrada.</Text>
                  ) : (
                    school.classes.map((item) => (
                      <View key={item.id} style={styles.classBox}>
                        <Text style={styles.rowTitle}>{item.name}</Text>
                        <Text style={styles.rowMeta}>{item.subject}</Text>
                        {item.schedules.map((schedule) => (
                          <Text key={schedule.id} style={styles.listText}>
                            • {schedule.day}: {schedule.start} às {schedule.end}
                          </Text>
                        ))}
                      </View>
                    ))
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {tab === 'settings' && (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Configurações</Text>
              <LabeledInput
                label="Nome do professor"
                value={state.profile.teacherName}
                onChangeText={(value) => updateProfile('teacherName', value)}
                placeholder="Seu nome"
              />

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>Lembretes locais</Text>
                  <Text style={styles.helper}>Ativa notificações futuras na versão avançada.</Text>
                </View>
                <Switch
                  value={state.profile.reminders}
                  onValueChange={(value) => updateProfile('reminders', value)}
                  thumbColor={state.profile.reminders ? PRIMARY : '#999'}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>Sincronizar só no Wi-Fi</Text>
                  <Text style={styles.helper}>Reserva de dados móveis para versão conectada.</Text>
                </View>
                <Switch
                  value={state.profile.syncOnWifiOnly}
                  onValueChange={(value) => updateProfile('syncOnWifiOnly', value)}
                  thumbColor={state.profile.syncOnWifiOnly ? PRIMARY : '#999'}
                />
              </View>
            </View>

            <View style={styles.cardSecondary}>
              <Text style={styles.sectionTitle}>Integrações planejadas</Text>
              <Text style={styles.listText}>• Login Google real</Text>
              <Text style={styles.listText}>• Google Agenda para tarefas e aulas</Text>
              <Text style={styles.listText}>• Google Drive para backup</Text>
              <Text style={styles.listText}>• Notificações e sincronização entre aparelhos</Text>
            </View>

            <Pressable style={styles.dangerButton} onPress={resetApp}>
              <Text style={styles.dangerButtonText}>Limpar dados do app de teste</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <View style={styles.bottomNav}>
        <TabButton label="Início" active={tab === 'home'} onPress={() => setTab('home')} />
        <TabButton label="Gestão" active={tab === 'manage'} onPress={() => setTab('manage')} />
        <TabButton label="Config." active={tab === 'settings'} onPress={() => setTab('settings')} />
      </View>

      <Modal visible={showTaskModal} animationType="slide" transparent>
        <Overlay onClose={() => setShowTaskModal(false)} title="Nova tarefa">
          <LabeledInput label="Título" value={taskForm.title} onChangeText={(value) => setTaskForm((prev) => ({ ...prev, title: value }))} placeholder="Ex.: Enviar avaliação" />
          <LabeledInput label="Tipo" value={taskForm.type} onChangeText={(value) => setTaskForm((prev) => ({ ...prev, type: value }))} placeholder="Atividade / Planejamento / Avaliação" />
          <LabeledInput label="Data (AAAA-MM-DD)" value={taskForm.dueDate} onChangeText={(value) => setTaskForm((prev) => ({ ...prev, dueDate: value }))} placeholder="2026-04-20" />
          <LabeledInput label="Escola" value={taskForm.school} onChangeText={(value) => setTaskForm((prev) => ({ ...prev, school: value }))} placeholder="Nome da escola" />
          <LabeledInput label="Turma / setor" value={taskForm.className} onChangeText={(value) => setTaskForm((prev) => ({ ...prev, className: value }))} placeholder="1º ano 1 / Coordenação" />
          <LabeledInput label="Observações" value={taskForm.notes} onChangeText={(value) => setTaskForm((prev) => ({ ...prev, notes: value }))} placeholder="Detalhes importantes" multiline />
          <Pressable style={styles.primaryButton} onPress={addTask}><Text style={styles.primaryButtonText}>Salvar tarefa</Text></Pressable>
        </Overlay>
      </Modal>

      <Modal visible={showSchoolModal} animationType="slide" transparent>
        <Overlay onClose={() => setShowSchoolModal(false)} title="Nova escola">
          <LabeledInput label="Nome da escola" value={schoolForm.name} onChangeText={(value) => setSchoolForm((prev) => ({ ...prev, name: value }))} placeholder="Ex.: Escola Estadual X" />
          <LabeledInput label="Cidade" value={schoolForm.city} onChangeText={(value) => setSchoolForm((prev) => ({ ...prev, city: value }))} placeholder="Belo Horizonte" />
          <LabeledInput label="Disciplinas (separadas por vírgula)" value={schoolForm.subjects} onChangeText={(value) => setSchoolForm((prev) => ({ ...prev, subjects: value }))} placeholder="História, Sociologia" />
          <Pressable style={styles.primaryButton} onPress={addSchool}><Text style={styles.primaryButtonText}>Salvar escola</Text></Pressable>
        </Overlay>
      </Modal>

      <Modal visible={showClassModal} animationType="slide" transparent>
        <Overlay onClose={() => setShowClassModal(false)} title="Nova turma">
          <Text style={styles.label}>Escola</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {state.schools.map((school) => (
              <Pressable
                key={school.id}
                style={[
                  styles.choiceChip,
                  classForm.schoolId === school.id && styles.choiceChipActive,
                ]}
                onPress={() => setClassForm((prev) => ({ ...prev, schoolId: school.id }))}
              >
                <Text style={styles.choiceChipText}>{school.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <LabeledInput label="Turma" value={classForm.name} onChangeText={(value) => setClassForm((prev) => ({ ...prev, name: value }))} placeholder="Ex.: 1º ano 1" />
          <LabeledInput label="Conteúdo / disciplina" value={classForm.subject} onChangeText={(value) => setClassForm((prev) => ({ ...prev, subject: value }))} placeholder="História" />
          <LabeledInput label="Dia" value={classForm.day} onChangeText={(value) => setClassForm((prev) => ({ ...prev, day: value }))} placeholder="Segunda-feira" />
          <View style={styles.rowInputs}>
            <View style={{ flex: 1 }}>
              <LabeledInput label="Início" value={classForm.start} onChangeText={(value) => setClassForm((prev) => ({ ...prev, start: value }))} placeholder="07:50" />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <LabeledInput label="Fim" value={classForm.end} onChangeText={(value) => setClassForm((prev) => ({ ...prev, end: value }))} placeholder="08:40" />
            </View>
          </View>
          <Pressable style={styles.primaryButton} onPress={addClass}><Text style={styles.primaryButtonText}>Salvar turma</Text></Pressable>
        </Overlay>
      </Modal>
    </SafeAreaView>
  );
}

function LabeledInput({ label, multiline = false, ...props }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={MUTED}
        style={[styles.input, multiline && styles.inputMultiline]}
        multiline={multiline}
        {...props}
      />
    </View>
  );
}

function TaskCard({ task, onComplete }) {
  return (
    <View style={styles.taskCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{task.title}</Text>
        <Text style={styles.rowMeta}>{task.type} • {task.school || 'Sem escola'} • {task.className || 'Geral'}</Text>
        <Text style={styles.rowMeta}>Prazo: {task.dueDate}</Text>
        {!!task.notes && <Text style={styles.helper}>{task.notes}</Text>}
      </View>
      <Pressable style={styles.doneButton} onPress={onComplete}>
        <Text style={styles.doneButtonText}>Concluir</Text>
      </Pressable>
    </View>
  );
}

function TabButton({ label, active, onPress }) {
  return (
    <Pressable style={styles.tabButton} onPress={onPress}>
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Overlay({ title, onClose, children }) {
  return (
    <View style={styles.modalBackdrop}>
      <View style={styles.modalCard}>
        <View style={styles.inlineHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Pressable onPress={onClose}><Text style={styles.closeText}>Fechar</Text></Pressable>
        </View>
        <ScrollView>{children}</ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  authContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#262B36',
  },
  headerTitle: {
    color: TEXT,
    fontSize: 26,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: MUTED,
    marginTop: 4,
  },
  logo: {
    color: PRIMARY,
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  title: {
    color: TEXT,
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: TEXT,
    opacity: 0.9,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#262B36',
  },
  cardSecondary: {
    backgroundColor: CARD_2,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2E3442',
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  helper: {
    color: MUTED,
    lineHeight: 20,
    marginBottom: 8,
  },
  emptyText: {
    color: MUTED,
    fontStyle: 'italic',
    marginTop: 6,
  },
  rowCard: {
    backgroundColor: '#121722',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
  },
  rowTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '700',
  },
  rowMeta: {
    color: MUTED,
    marginTop: 4,
  },
  listText: {
    color: TEXT,
    marginTop: 6,
    lineHeight: 20,
  },
  taskCard: {
    backgroundColor: '#121722',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    flexDirection: 'row',
    gap: 12,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#303849',
  },
  dateBadge: {
    color: BG,
    backgroundColor: PRIMARY,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
    fontWeight: '700',
  },
  plusButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusButtonText: {
    fontSize: 28,
    lineHeight: 30,
    color: BG,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryButtonText: {
    color: BG,
    fontSize: 16,
    fontWeight: '800',
  },
  smallButton: {
    backgroundColor: '#2B3140',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  smallButtonText: {
    color: TEXT,
    fontWeight: '700',
  },
  doneButton: {
    backgroundColor: SUCCESS,
    borderRadius: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  doneButtonText: {
    color: BG,
    fontWeight: '700',
  },
  dangerButton: {
    backgroundColor: DANGER,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  dangerButtonText: {
    color: TEXT,
    fontWeight: '800',
  },
  input: {
    backgroundColor: '#11151E',
    borderColor: '#32394A',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: TEXT,
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  label: {
    color: TEXT,
    marginBottom: 6,
    fontWeight: '700',
  },
  bottomNav: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: '#11151E',
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2A3242',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabButtonText: {
    color: MUTED,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: PRIMARY,
  },
  inlineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 8,
  },
  schoolCard: {
    backgroundColor: '#121722',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
  },
  classBox: {
    backgroundColor: '#1A2130',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2B3140',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '88%',
    backgroundColor: CARD,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
  },
  closeText: {
    color: PRIMARY,
    fontWeight: '700',
  },
  choiceChip: {
    backgroundColor: '#2B3140',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
  },
  choiceChipActive: {
    backgroundColor: PRIMARY,
  },
  choiceChipText: {
    color: TEXT,
    fontWeight: '700',
  },
  rowInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
