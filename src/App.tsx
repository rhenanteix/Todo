import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Calendar, 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  Sparkles, 
  LogOut, 
  CalendarDays,
  Clock,
  AlertCircle,
  Loader2,
  ChevronRight,
  Bell,
  BellOff,
  Video,
  BarChart3,
  PieChart as PieChartIcon,
  Building2,
  User as UserIcon,
  Edit2,
  Eye,
  X,
  Lock,
  Filter,
  XCircle,
  Copy,
  Check,
  ExternalLink,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend 
} from 'recharts';

// --- Types ---

interface User {
  id: string;
  name: string;
  email: string;
  isPremium: boolean;
  isGoogleConnected?: boolean;
  brandName?: string;
  logoUrl?: string;
  primaryColor?: string;
  customDomain?: string;
}

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  googleEventId?: string;
  reminderType?: 'none' | 'email' | 'in-app';
  reminderTiming?: '1h' | '24h';
  contactInfo?: string;
  leadName?: string;
  leadReason?: string;
  companySize?: string;
  estimatedBudget?: number;
  documentUrl?: string;
  segmentation?: string;
  leadType?: 'company' | 'individual';
  meetingLink?: string;
}

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  isLocal?: boolean;
  completed?: boolean;
  hangoutLink?: string;
}

// --- AI Service ---

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function getAISuggestions(todos: Todo[], events: CalendarEvent[]) {
  const prompt = `
    Você é um assistente de tarefas inteligente. Analise os todos atuais do usuário e os eventos do Google Agenda.
    
    Todos Atuais:
    ${todos.map(t => `- [${t.completed ? 'x' : ' '}] ${t.text} (Prioridade: ${t.priority}, Prazo: ${t.dueDate || 'Nenhum'})`).join('\n')}
    
    Eventos do Calendário:
    ${events.map(e => `- ${e.summary} em ${e.start.dateTime || e.start.date}`).join('\n')}
    
    Forneça 3 sugestões concisas e acionáveis para melhorar a produtividade do usuário hoje. 
    Considere conflitos entre tarefas e reuniões, priorize itens urgentes e sugira pausas se a agenda estiver cheia.
    Responda obrigatoriamente em Português do Brasil (PT-BR).
    Formate a saída como uma lista Markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("AI Error:", error);
    return "Não foi possível gerar sugestões no momento.";
  }
}

// --- Components ---

const EditTaskModal = ({ 
  todo, 
  onClose, 
  onSave,
  branding,
  isPremium
}: { 
  todo: Todo, 
  onClose: () => void, 
  onSave: (id: string, updates: Partial<Todo>) => void,
  branding: any,
  isPremium: boolean
}) => {
  const [formData, setFormData] = useState<Partial<Todo>>({ ...todo });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(todo.id, formData);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Edit2 size={20} className="text-emerald-600" />
            Editar Tarefa
          </h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Descrição da Tarefa</label>
              <input 
                type="text" 
                value={formData.text || ''}
                onChange={e => setFormData({ ...formData, text: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Prioridade</label>
                <select 
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Prazo</label>
                <input 
                  type="datetime-local" 
                  value={formData.dueDate || ''}
                  onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Lembrete</label>
                <select 
                  value={formData.reminderType}
                  onChange={e => setFormData({ ...formData, reminderType: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                >
                  <option value="none">Nenhum</option>
                  <option value="email">E-mail</option>
                  <option value="in-app">Notificação no App</option>
                </select>
              </div>
              {formData.reminderType !== 'none' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Antecedência</label>
                  <select 
                    value={formData.reminderTiming}
                    onChange={e => setFormData({ ...formData, reminderTiming: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  >
                    <option value="1h">1 hora antes</option>
                    <option value="24h">24 horas antes</option>
                  </select>
                </div>
              )}
            </div>

            {formData.reminderType === 'email' && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">E-mail de Contato</label>
                <input 
                  type="email" 
                  value={formData.contactInfo || ''}
                  onChange={e => setFormData({ ...formData, contactInfo: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="seu@email.com"
                />
              </div>
            )}

            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Building2 size={16} className="text-emerald-600" />
                Informações do Lead
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nome do Lead</label>
                  <input 
                    type="text" 
                    value={formData.leadName || ''}
                    onChange={e => setFormData({ ...formData, leadName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Motivo</label>
                  <input 
                    type="text" 
                    value={formData.leadReason || ''}
                    onChange={e => setFormData({ ...formData, leadReason: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
              style={{ backgroundColor: isPremium ? branding.primaryColor : undefined }}
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'app' | 'forgot-password' | 'reset-password'>('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [resetParams, setResetParams] = useState({ email: '', token: '' });
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' }[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [newTodo, setNewTodo] = useState('');
  const [priority, setPriority] = useState<Todo['priority']>('medium');
  const [dueDate, setDueDate] = useState('');
  const [syncWithGoogle, setSyncWithGoogle] = useState(false);
  const [autoMeetingLink, setAutoMeetingLink] = useState(false);
  const [meetingProvider, setMeetingProvider] = useState<'google_meet' | 'zoom'>('google_meet');
  
  const [reminderType, setReminderType] = useState<Todo['reminderType']>('none');
  const [reminderTiming, setReminderTiming] = useState<Todo['reminderTiming']>('1h');
  const [contactInfo, setContactInfo] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'finance' | 'settings' | 'dashboard'>('list');
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [timeSuggestion, setTimeSuggestion] = useState<{ time: string, reason: string } | null>(null);
  const [isSuggestingTime, setIsSuggestingTime] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'profile' | 'company'>('profile');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifiedTasks, setNotifiedTasks] = useState<Set<string>>(new Set());
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Filter States
  const [filterPriority, setFilterPriority] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'pending'>('all');
  const [filterLeadType, setFilterLeadType] = useState<'all' | 'company' | 'individual'>('all');

  // Lead Form States
  const [leadName, setLeadName] = useState('');
  const [leadReason, setLeadReason] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [estimatedBudget, setEstimatedBudget] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [leadType, setLeadType] = useState<'company' | 'individual'>('company');
  const [showLeadForm, setShowLeadForm] = useState(false);

  // Branding states
  const [branding, setBranding] = useState({
    brandName: '',
    logoUrl: '',
    primaryColor: '#059669',
    customDomain: ''
  });

  // Finance states
  const [pixData, setPixData] = useState<{ qrCode: string; payload: string } | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    if (viewMode === 'dashboard') {
      fetchAnalytics();
    }
  }, [viewMode]);

  const fetchAnalytics = async () => {
    setIsLoadingAnalytics(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/analytics', { 
        credentials: 'include',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch (err) {
      console.error("Failed to fetch analytics", err);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const suggestBestTime = async () => {
    setIsSuggestingTime(true);
    setTimeSuggestion(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Prepare history data for AI
      const historySummary = todos.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).map(t => ({
        hour: new Date(t.dueDate!).getHours(),
        type: t.leadType || 'company',
        completed: t.completed
      }));

      const prompt = `Com base no histórico de reuniões abaixo, sugira o melhor horário (apenas a hora, ex: 14:00) para fechar um negócio com um cliente do tipo "${leadType === 'company' ? 'Empresa' : 'Pessoa'}".
      
      Histórico:
      ${JSON.stringify(historySummary)}
      
      Considere:
      1. Taxa de conversão (reuniões completadas).
      2. Taxa de no-show (reuniões não completadas no passado).
      3. Perfil do cliente (${leadType}).
      
      Responda EXATAMENTE no formato JSON:
      {
        "time": "HH:00",
        "reason": "Breve explicação do porquê este horário é o melhor."
      }`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text || '{}');
      if (result.time && result.reason) {
        setTimeSuggestion(result);
      }
    } catch (error) {
      console.error("Failed to suggest time:", error);
    } finally {
      setIsSuggestingTime(false);
    }
  };

  const fetchTasks = async () => {
    setIsLoadingTasks(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/tasks', { 
        credentials: 'include',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      if (res.ok) {
        const data = await res.json();
        setTodos(data);
      }
    } catch (err) {
      console.error("Failed to fetch tasks", err);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  // --- Notification System ---

  useEffect(() => {
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        setNotificationsEnabled(true);
      }
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      alert("This browser does not support desktop notifications");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationsEnabled(true);
      new Notification("SmartSync Todo", {
        body: "Notificações ativadas! Vamos te avisar sobre as próximas tarefas.",
        icon: "https://cdn-icons-png.flaticon.com/512/190/190411.png"
      });
    }
  };

  useEffect(() => {
    if (!notificationsEnabled) return;

    const checkUpcomingTasks = () => {
      const now = new Date();

      todos.forEach(todo => {
        if (todo.completed || !todo.dueDate || notifiedTasks.has(todo.id) || todo.reminderType !== 'in-app') return;

        const due = new Date(todo.dueDate);
        const timingMs = todo.reminderTiming === '24h' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
        const notifyAt = new Date(due.getTime() - timingMs);

        if (now >= notifyAt && now < due) {
          new Notification("Lembrete de Tarefa", {
            body: `"${todo.text}" vence em breve (${due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})!`,
            icon: "https://cdn-icons-png.flaticon.com/512/190/190411.png"
          });
          setNotifiedTasks(prev => new Set(prev).add(todo.id));
        }
      });
    };

    const interval = setInterval(checkUpcomingTasks, 30000); // Check every 30 seconds
    checkUpcomingTasks(); // Initial check

    return () => clearInterval(interval);
  }, [todos, notificationsEnabled, notifiedTasks]);

  useEffect(() => {
    checkAuthStatus();
    
    // Check for reset password token in URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const email = params.get('email');
    if (token && email) {
      setResetParams({ email, token });
      setAuthMode('reset-password');
      // Clear URL params without refreshing
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        checkAuthStatus();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (user) {
      fetchEvents();
      fetchTasks();
    }
  }, [user]);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/auth/status', { 
        credentials: 'include',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      const data = await res.json();
      if (data.isAuthenticated) {
        setUser(data.user);
        setAuthMode('app');
        setBranding({
          brandName: data.user.brandName || '',
          logoUrl: data.user.logoUrl || '',
          primaryColor: data.user.primaryColor || '#059669',
          customDomain: data.user.customDomain || ''
        });
      } else {
        setAuthMode('login');
      }
    } catch (err) {
      console.error("Auth check failed", err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthenticating(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authForm.email, password: authForm.password }),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
        }
        await checkAuthStatus();
      } else {
        setAuthError(data.error || 'Erro ao entrar');
      }
    } catch (err) {
      setAuthError('Erro de conexão');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setIsAuthenticating(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authForm.email }),
      });
      const data = await res.json();
      if (res.ok) {
        setAuthSuccess(data.message);
      } else {
        setAuthError(data.error || 'Erro ao solicitar redefinição');
      }
    } catch (err) {
      setAuthError('Erro de conexão com o servidor');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setIsAuthenticating(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: resetParams.email, 
          token: resetParams.token, 
          password: authForm.password 
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAuthSuccess(data.message);
        setTimeout(() => {
          setAuthMode('login');
          setAuthSuccess('');
        }, 3000);
      } else {
        setAuthError(data.error || 'Erro ao redefinir senha');
      }
    } catch (err) {
      setAuthError('Erro de conexão com o servidor');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthenticating(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
        }
        await checkAuthStatus();
      } else {
        setAuthError(data.error || 'Erro ao registrar');
      }
    } catch (err) {
      setAuthError('Erro de conexão');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const fetchPixQR = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/finance/pix-qr', { 
        credentials: 'include',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      const data = await res.json();
      setPixData(data);
    } catch (err) {
      console.error("Failed to fetch PIX QR", err);
    }
  };

  const confirmPayment = async () => {
    setIsPaying(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/finance/confirm-payment', { 
        method: 'POST', 
        credentials: 'include',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      if (res.ok) {
        await checkAuthStatus();
        setViewMode('list');
      }
    } catch (err) {
      console.error("Payment confirmation failed", err);
    } finally {
      setIsPaying(false);
    }
  };

  const saveBranding = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/user/branding', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(branding),
        credentials: 'include'
      });
      if (res.ok) {
        await checkAuthStatus();
        alert("Configurações da empresa atualizadas com sucesso!");
      }
    } catch (err) {
      console.error("Failed to save branding", err);
    }
  };

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ name: user?.name, email: user?.email }),
        credentials: 'include'
      });
      if (res.ok) {
        await checkAuthStatus();
        alert("Perfil atualizado com sucesso!");
      }
    } catch (err) {
      console.error("Failed to update profile", err);
    }
  };

  const sendTestReminder = async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/test-reminder', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ email: user.email }),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        fetchTasks();
      }
    } catch (err) {
      console.error("Failed to send test reminder", err);
    }
  };

  const fetchEvents = async () => {
    setIsLoadingEvents(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/calendar/events', { 
        credentials: 'include',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error("Failed to fetch events", err);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const handleConnect = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/auth/google/url', { 
        credentials: 'include',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      const { url } = await res.json();
      window.open(url, 'google_auth', 'width=600,height=700');
    } catch (err) {
      console.error("Failed to get auth URL", err);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Tem certeza que deseja sair?')) return;
    const token = localStorage.getItem('auth_token');
    await fetch('/api/auth/logout', { 
      method: 'POST', 
      credentials: 'include',
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      }
    });
    localStorage.removeItem('auth_token');
    setUser(null);
    setAuthMode('login');
    setEvents([]);
    addToast('Sessão encerrada com sucesso', 'info');
  };

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim()) return;

    let googleEventId = undefined;
    let meetingLink = undefined;

    if (syncWithGoogle && user && dueDate) {
      try {
        const start = new Date(dueDate);
        const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour later
        
        const token = localStorage.getItem('auth_token');
        const res = await fetch('/api/calendar/events', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify({
            summary: newTodo,
            description: `Priority: ${priority}`,
            startDateTime: start.toISOString(),
            endDateTime: end.toISOString(),
          }),
          credentials: 'include'
        });
        
        if (res.ok) {
          const data = await res.json();
          googleEventId = data.id;
          if (autoMeetingLink && meetingProvider === 'google_meet') {
            meetingLink = data.hangoutLink;
          }
          fetchEvents(); // Refresh events
        } else {
          const errorData = await res.json();
          console.error("Google Calendar Sync Error:", errorData);
        }
      } catch (err) {
        console.error("Failed to sync with Google Calendar", err);
      }
    }

    if (autoMeetingLink && meetingProvider === 'zoom' && !meetingLink) {
      // Mock Zoom link generation
      meetingLink = `https://zoom.us/j/${Math.floor(Math.random() * 1000000000)}`;
    }

    const todo: Todo = {
      id: Math.random().toString(36).substring(2, 15) + Date.now(),
      text: newTodo,
      completed: false,
      priority,
      dueDate: dueDate || undefined,
      googleEventId,
      meetingLink,
      reminderType,
      reminderTiming,
      contactInfo: (reminderType === 'email') ? contactInfo : undefined,
      leadName: syncWithGoogle ? leadName : undefined,
      leadReason: syncWithGoogle ? leadReason : undefined,
      companySize: syncWithGoogle && leadType === 'company' ? companySize : undefined,
      estimatedBudget: syncWithGoogle && leadType === 'company' ? parseFloat(estimatedBudget) : undefined,
      documentUrl: syncWithGoogle ? documentUrl : undefined,
      leadType: syncWithGoogle ? leadType : undefined,
    };
    
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(todo),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        const savedTodo = { ...todo, segmentation: data.segmentation };
        setTodos(prev => [savedTodo, ...prev]);
        setNewTodo('');
        setDueDate('');
        setSyncWithGoogle(false);
        setAutoMeetingLink(false);
        setMeetingProvider('google_meet');
        setReminderType('none');
        setContactInfo('');
        setLeadName('');
        setLeadReason('');
        setCompanySize('');
        setEstimatedBudget('');
        setDocumentUrl('');
        setLeadType('company');
        
        // Show confirmation
        setShowConfirmation(true);
        addToast('Tarefa adicionada com sucesso!');
        setTimeout(() => setShowConfirmation(false), 3000);
      } else {
        const errorData = await res.json();
        addToast(`Erro ao salvar tarefa: ${errorData.error || 'Erro desconhecido'}`, 'error');
      }
    } catch (err) {
      console.error("Failed to save task", err);
      addToast("Erro de conexão ao salvar tarefa.", 'error');
    }
  };

  const toggleTodo = async (id: string) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ completed: !todo.completed }),
        credentials: 'include'
      });
      if (res.ok) {
        setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
        addToast(!todo.completed ? 'Tarefa concluída!' : 'Tarefa reaberta');
      }
    } catch (err) {
      console.error("Failed to toggle task", err);
      addToast('Erro ao atualizar status da tarefa', 'error');
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/tasks/${id}`, { 
        method: 'DELETE', 
        credentials: 'include',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      if (res.ok) {
        setTodos(todos.filter(t => t.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete task", err);
      addToast('Erro ao excluir tarefa', 'error');
    }
  };

  const updateTodo = async (id: string, updates: Partial<Todo>) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(updates),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setTodos(todos.map(t => t.id === id ? { ...t, ...updates, segmentation: data.segmentation || t.segmentation } : t));
        setIsEditModalOpen(false);
        setEditingTodo(null);
      }
    } catch (err) {
      console.error("Failed to update task", err);
    }
  };

  const startEditing = (todo: Todo) => {
    setEditingTodo(todo);
    setIsEditModalOpen(true);
  };

  const generateSuggestions = async () => {
    setIsGeneratingAI(true);
    const suggestions = await getAISuggestions(todos, events);
    setAiSuggestions(suggestions || "Nenhuma sugestão disponível.");
    setIsGeneratingAI(false);
  };

  const filteredAndSortedTodos = useMemo(() => {
    return todos
      .filter(todo => {
        const matchesPriority = filterPriority === 'all' || todo.priority === filterPriority;
        const matchesStatus = filterStatus === 'all' || 
          (filterStatus === 'completed' ? todo.completed : !todo.completed);
        const matchesLeadType = filterLeadType === 'all' || todo.leadType === filterLeadType;
        return matchesPriority && matchesStatus && matchesLeadType;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const priorityMap = { high: 0, medium: 1, low: 2 };
        return priorityMap[a.priority] - priorityMap[b.priority];
      });
  }, [todos, filterPriority, filterStatus, filterLeadType]);

  // --- Calendar Logic ---

  const daysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const firstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const calendarDays = useMemo(() => {
    const days = [];
    const totalDays = daysInMonth(currentMonth);
    const startOffset = firstDayOfMonth(currentMonth);
    
    // Previous month padding
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }
    
    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));
    }
    
    return days;
  }, [currentMonth]);

  const getEventsForDay = (day: Date) => {
    const dayStr = day.toISOString().split('T')[0];
    
    const localEvents = todos
      .filter(t => t.dueDate && t.dueDate.startsWith(dayStr))
      .map(t => ({ id: t.id, summary: t.text, isLocal: true, completed: t.completed, hangoutLink: t.meetingLink }));
      
    const googleEvents = events
      .filter(e => {
        const start = e.start.dateTime || e.start.date;
        return start && start.startsWith(dayStr);
      })
      .map(e => ({ id: e.id, summary: e.summary, isLocal: false, completed: false, hangoutLink: e.hangoutLink }));
      
    return [...localEvents, ...googleEvents];
  };

  if (authMode !== 'app') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-emerald-200">
              <CheckCircle2 size={28} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              {authMode === 'login' ? 'SmartSync Todo' : 
               authMode === 'register' ? 'Criar Conta' : 
               authMode === 'forgot-password' ? 'Recuperar Senha' : 'Nova Senha'}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {authMode === 'forgot-password' ? 'Enviaremos um link de redefinição' : 'Sua produtividade em sincronia'}
            </p>
          </div>

          <form 
            onSubmit={
              authMode === 'login' ? handleLogin : 
              authMode === 'register' ? handleRegister : 
              authMode === 'forgot-password' ? handleForgotPassword : handleResetPassword
            } 
            className="space-y-4"
          >
            {authMode === 'register' && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nome</label>
                <input 
                  type="text" 
                  required
                  value={authForm.name}
                  onChange={e => setAuthForm({...authForm, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="Seu nome"
                />
              </div>
            )}
            
            {(authMode === 'login' || authMode === 'register' || authMode === 'forgot-password') && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">E-mail</label>
                <input 
                  type="email" 
                  required
                  value={authForm.email}
                  onChange={e => setAuthForm({...authForm, email: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="seu@email.com"
                />
              </div>
            )}

            {authMode === 'reset-password' && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-4 text-center">
                <p className="text-xs text-slate-500 font-medium">Redefinindo senha para:</p>
                <p className="text-sm font-bold text-slate-700">{resetParams.email}</p>
              </div>
            )}

            {(authMode === 'login' || authMode === 'register' || authMode === 'reset-password') && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {authMode === 'reset-password' ? 'Nova Senha' : 'Senha'}
                  </label>
                  {authMode === 'login' && (
                    <button 
                      type="button"
                      onClick={() => { setAuthMode('forgot-password'); setAuthError(''); setAuthSuccess(''); }}
                      className="text-[10px] font-bold text-emerald-600 hover:underline"
                    >
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
                <input 
                  type="password" 
                  required
                  value={authForm.password}
                  onChange={e => setAuthForm({...authForm, password: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="••••••••"
                />
              </div>
            )}

            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-medium flex items-center gap-2">
                <AlertCircle size={14} />
                {authError}
              </div>
            )}

            {authSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 size={14} />
                {authSuccess}
              </div>
            )}

            <button 
              type="submit"
              disabled={isAuthenticating}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isAuthenticating && <Loader2 className="animate-spin" size={18} />}
              {authMode === 'login' ? 'Entrar' : 
               authMode === 'register' ? 'Criar Conta' : 
               authMode === 'forgot-password' ? 'Enviar Link' : 'Redefinir Senha'}
            </button>
          </form>

          <div className="mt-6 space-y-4">
            {(authMode === 'login' || authMode === 'register') && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400 font-medium">Ou continue com</span></div>
                </div>

                <button 
                  onClick={handleConnect}
                  className="w-full bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                >
                  <Calendar size={18} className="text-emerald-600" />
                  Google Agenda
                </button>
              </>
            )}

            <p className="text-center text-sm text-slate-500">
              {authMode === 'login' ? 'Não tem uma conta?' : 
               authMode === 'register' ? 'Já tem uma conta?' : 
               authMode === 'forgot-password' ? 'Lembrou a senha?' : 'Voltar para'}
              <button 
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'register' : 'login');
                  setAuthError('');
                  setAuthSuccess('');
                }}
                className="ml-1 text-emerald-600 font-bold hover:underline"
              >
                {authMode === 'login' ? 'Cadastre-se' : 'Faça Login'}
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-slate-900 font-sans selection:bg-emerald-100" style={{ '--primary': branding.primaryColor } as any}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {user?.isPremium && branding.logoUrl ? (
              <img src={branding.logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
            ) : (
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: user?.isPremium ? branding.primaryColor : undefined }}>
                <CheckCircle2 size={20} />
              </div>
            )}
            <h1 className="text-xl font-semibold tracking-tight">
              {user?.isPremium && branding.brandName ? branding.brandName : 'SmartSync Todo'}
            </h1>
          </div>
          
          <div className="flex items-center gap-6">
            <nav className="flex items-center gap-4">
              <button 
                onClick={() => setViewMode('list')}
                className={`text-sm font-bold transition-all ${viewMode === 'list' ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                style={{ color: viewMode === 'list' && user?.isPremium ? branding.primaryColor : undefined }}
              >
                Tarefas
              </button>
              <button 
                onClick={() => setViewMode('calendar')}
                className={`text-sm font-bold transition-all flex items-center gap-1.5 ${viewMode === 'calendar' ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                style={{ color: viewMode === 'calendar' && user?.isPremium ? branding.primaryColor : undefined }}
              >
                Calendário
                {!user?.isPremium && <Lock size={12} className="text-slate-400" />}
              </button>
              <button 
                onClick={() => setViewMode('dashboard')}
                className={`text-sm font-bold transition-all flex items-center gap-1.5 ${viewMode === 'dashboard' ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                style={{ color: viewMode === 'dashboard' && user?.isPremium ? branding.primaryColor : undefined }}
              >
                Dashboard
                {!user?.isPremium && <Lock size={12} className="text-slate-400" />}
              </button>
              <button 
                onClick={() => { setViewMode('finance'); fetchPixQR(); }}
                className={`text-sm font-bold transition-all ${viewMode === 'finance' ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                style={{ color: viewMode === 'finance' && user?.isPremium ? branding.primaryColor : undefined }}
              >
                Financeiro
              </button>
              <button 
                onClick={() => setViewMode('settings')}
                className={`text-sm font-bold transition-all ${viewMode === 'settings' ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                style={{ color: viewMode === 'settings' && user?.isPremium ? branding.primaryColor : undefined }}
              >
                Marca
              </button>
            </nav>

            <div className="h-6 w-px bg-slate-200"></div>

            <button 
              onClick={handleConnect}
              className={`p-2 rounded-lg transition-all ${user?.isGoogleConnected ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
              title={user?.isGoogleConnected ? "Google Agenda Conectado" : "Conectar Google Agenda"}
            >
              <Calendar size={20} />
            </button>

            <button 
              onClick={requestNotificationPermission}
              className={`p-2 rounded-lg transition-all ${notificationsEnabled ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
            >
              {notificationsEnabled ? <Bell size={20} /> : <BellOff size={20} />}
            </button>

            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
            >
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {viewMode === 'list' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Todos */}
            <div className="lg:col-span-2 space-y-6">
              <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Plus size={20} className="text-emerald-600" style={{ color: user?.isPremium ? branding.primaryColor : undefined }} />
                  Nova Tarefa
                </h2>
                <form onSubmit={addTodo} className="space-y-4">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newTodo}
                      onChange={(e) => setNewTodo(e.target.value)}
                      placeholder="O que precisa ser feito?"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                    <button 
                      type="submit"
                      className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-emerald-700 transition-all shadow-sm flex items-center gap-2"
                      style={{ backgroundColor: user?.isPremium ? branding.primaryColor : undefined }}
                    >
                      Adicionar
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-slate-500 font-medium">Prioridade:</span>
                      {(['low', 'medium', 'high'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={`px-3 py-1 rounded-full capitalize transition-all ${
                            priority === p 
                              ? 'bg-slate-900 text-white' 
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {p === 'low' ? 'baixa' : p === 'medium' ? 'média' : 'alta'}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-slate-400" />
                        <input 
                          type="datetime-local" 
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={suggestBestTime}
                          disabled={isSuggestingTime}
                          className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors bg-emerald-50 px-2 py-1 rounded-md"
                        >
                          {isSuggestingTime ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                          Sugerir Horário
                        </button>
                      </div>

                      {timeSuggestion && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-emerald-50 border border-emerald-100 p-2 rounded-lg text-[10px]"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-emerald-700">Sugestão: {timeSuggestion.time}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const now = new Date();
                                const dateStr = dueDate ? dueDate.split('T')[0] : now.toISOString().split('T')[0];
                                setDueDate(`${dateStr}T${timeSuggestion.time}`);
                                setTimeSuggestion(null);
                              }}
                              className="text-emerald-600 hover:underline font-bold"
                            >
                              Aplicar
                            </button>
                          </div>
                          <p className="text-slate-600 leading-tight">{timeSuggestion.reason}</p>
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {dueDate && (
                    <div className="space-y-4 pt-2 border-t border-slate-100">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Bell size={14} className="text-slate-400" />
                          <span className="text-sm text-slate-500 font-medium">Lembrete:</span>
                          <select 
                            value={reminderType}
                            onChange={(e) => setReminderType(e.target.value as any)}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-emerald-500"
                          >
                            <option value="none">Nenhum</option>
                            <option value="email">E-mail</option>
                            <option value="in-app">Notificação no App</option>
                          </select>
                        </div>

                        {reminderType !== 'none' && (
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-slate-400" />
                            <select 
                              value={reminderTiming}
                              onChange={(e) => setReminderTiming(e.target.value as any)}
                              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-emerald-500"
                            >
                              <option value="1h">1 hora antes</option>
                              <option value="24h">24 horas antes</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {reminderType === 'email' && (
                        <div className="flex items-center gap-2">
                          <input 
                            type="email"
                            value={contactInfo}
                            onChange={(e) => setContactInfo(e.target.value)}
                            placeholder="seu@email.com"
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                            required
                          />
                        </div>
                      )}

                      {user && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <input 
                                type="checkbox" 
                                id="syncGoogle"
                                checked={syncWithGoogle}
                                onChange={(e) => setSyncWithGoogle(e.target.checked)}
                                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                                disabled={!user.isGoogleConnected}
                              />
                              <label htmlFor="syncGoogle" className={`text-sm cursor-pointer flex items-center gap-1 ${user.isGoogleConnected ? 'text-slate-600' : 'text-slate-400'}`}>
                                <Calendar size={14} />
                                Sincronizar com Google Agenda
                              </label>
                            </div>
                            
                            {!user.isGoogleConnected && (
                              <button 
                                type="button"
                                onClick={handleConnect}
                                className="text-[10px] font-bold text-emerald-600 hover:underline flex items-center gap-1"
                              >
                                <Plus size={10} />
                                Conectar Google
                              </button>
                            )}
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <input 
                                type="checkbox" 
                                id="autoMeeting"
                                checked={autoMeetingLink}
                                onChange={(e) => setAutoMeetingLink(e.target.checked)}
                                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                              />
                              <label htmlFor="autoMeeting" className="text-sm cursor-pointer flex items-center gap-1 text-slate-600">
                                <Video size={14} />
                                Gerar link de reunião automático
                              </label>
                            </div>

                            {autoMeetingLink && (
                              <div className="flex bg-slate-100 p-0.5 rounded-lg">
                                <button
                                  type="button"
                                  onClick={() => setMeetingProvider('google_meet')}
                                  className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${meetingProvider === 'google_meet' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                                >
                                  Meet
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setMeetingProvider('zoom')}
                                  className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${meetingProvider === 'zoom' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                                >
                                  Zoom
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {syncWithGoogle && user?.isGoogleConnected && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="pt-4 border-t border-slate-100 space-y-4"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-wider">
                              <Sparkles size={14} />
                              Pré-formulário da Reunião
                            </div>
                            <div className="flex bg-slate-100 p-0.5 rounded-lg">
                              <button
                                type="button"
                                onClick={() => setLeadType('company')}
                                className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${leadType === 'company' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                              >
                                Empresa
                              </button>
                              <button
                                type="button"
                                onClick={() => setLeadType('individual')}
                                className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${leadType === 'individual' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                              >
                                Pessoa
                              </button>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nome do Lead</label>
                              <input 
                                type="text" 
                                value={leadName}
                                onChange={e => setLeadName(e.target.value)}
                                placeholder="Nome completo"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Motivo</label>
                              <input 
                                type="text" 
                                value={leadReason}
                                onChange={e => setLeadReason(e.target.value)}
                                placeholder="Ex: Demonstração"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>

                          {leadType === 'company' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tamanho da Empresa</label>
                                <select 
                                  value={companySize}
                                  onChange={e => setCompanySize(e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                                >
                                  <option value="">Selecione...</option>
                                  <option value="1-10">1-10 funcionários</option>
                                  <option value="11-50">11-50 funcionários</option>
                                  <option value="51-200">51-200 funcionários</option>
                                  <option value="200+">200+ funcionários</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Orçamento Estimado (R$)</label>
                                <input 
                                  type="number" 
                                  value={estimatedBudget}
                                  onChange={e => setEstimatedBudget(e.target.value)}
                                  placeholder="Ex: 5000"
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                                />
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Upload de Documento (URL)</label>
                            <input 
                              type="text" 
                              value={documentUrl}
                              onChange={e => setDocumentUrl(e.target.value)}
                              placeholder="Link para o documento"
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}
                </form>

                <AnimatePresence>
                  {showConfirmation && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2 text-emerald-700 text-sm font-medium"
                    >
                      <CheckCircle2 size={16} />
                      Tarefa adicionada com sucesso!
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Tarefas</h2>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-400">{filteredAndSortedTodos.length} exibidas</span>
                    <span className="text-xs text-slate-400">{todos.filter(t => !t.completed).length} pendentes</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <div className="flex items-center gap-2 text-slate-400 mr-1">
                    <Filter size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Filtrar:</span>
                  </div>

                  <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                    <select 
                      value={filterPriority}
                      onChange={(e) => setFilterPriority(e.target.value as any)}
                      className="bg-transparent border-none text-[10px] font-bold text-slate-600 focus:outline-none px-2 py-1 cursor-pointer"
                    >
                      <option value="all">Prioridade: Todas</option>
                      <option value="high">Prioridade: Alta</option>
                      <option value="medium">Prioridade: Média</option>
                      <option value="low">Prioridade: Baixa</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                    <select 
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as any)}
                      className="bg-transparent border-none text-[10px] font-bold text-slate-600 focus:outline-none px-2 py-1 cursor-pointer"
                    >
                      <option value="all">Status: Todos</option>
                      <option value="pending">Status: Pendentes</option>
                      <option value="completed">Status: Concluídas</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                    <select 
                      value={filterLeadType}
                      onChange={(e) => setFilterLeadType(e.target.value as any)}
                      className="bg-transparent border-none text-[10px] font-bold text-slate-600 focus:outline-none px-2 py-1 cursor-pointer"
                    >
                      <option value="all">Lead: Todos</option>
                      <option value="company">Lead: Empresa</option>
                      <option value="individual">Lead: Pessoa</option>
                    </select>
                  </div>

                  {(filterPriority !== 'all' || filterStatus !== 'all' || filterLeadType !== 'all') && (
                    <button 
                      onClick={() => {
                        setFilterPriority('all');
                        setFilterStatus('all');
                        setFilterLeadType('all');
                      }}
                      className="flex items-center gap-1 text-[10px] font-bold text-rose-600 hover:text-rose-700 transition-colors px-2 py-1 bg-rose-50 rounded-lg"
                    >
                      <XCircle size={12} />
                      Limpar
                    </button>
                  )}
                </div>
                
                <div className="space-y-2">
                  {isLoadingTasks ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="animate-spin text-emerald-600" size={32} />
                      <p className="text-sm text-slate-400 font-medium">Carregando suas tarefas...</p>
                    </div>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {filteredAndSortedTodos.length > 0 ? (
                        filteredAndSortedTodos.map((todo) => (
                          <motion.div
                            key={todo.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={`group flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-slate-300 ${
                              todo.completed ? 'opacity-60' : ''
                            }`}
                          >
                        <button 
                          onClick={() => toggleTodo(todo.id)}
                          className="text-slate-400 hover:text-emerald-600 transition-colors"
                        >
                          {todo.completed ? (
                            <CheckCircle2 className="text-emerald-600" size={24} />
                          ) : (
                            <Circle size={24} />
                          )}
                        </button>
                        
                        <div className="flex-1">
                          <p className={`font-medium ${todo.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                            {todo.text}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                              todo.priority === 'high' ? 'bg-rose-100 text-rose-600' :
                              todo.priority === 'medium' ? 'bg-amber-100 text-amber-600' :
                              'bg-emerald-100 text-emerald-600'
                            }`}>
                              {todo.priority === 'low' ? 'baixa' : todo.priority === 'medium' ? 'média' : 'alta'}
                            </span>
                            {todo.dueDate && (
                              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Clock size={10} />
                                {new Date(todo.dueDate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            )}
                            {todo.reminderType && todo.reminderType !== 'none' && (
                              <span className="text-[10px] text-blue-600 flex items-center gap-1 font-bold">
                                <Bell size={10} />
                                Lembrete {todo.reminderType} ({todo.reminderTiming})
                              </span>
                            )}
                            {todo.googleEventId && (
                              <span className="text-[10px] text-emerald-600 flex items-center gap-1 font-bold">
                                <Calendar size={10} />
                                Sincronizado
                              </span>
                            )}
                            {todo.segmentation && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                todo.segmentation === 'High Value Lead' ? 'bg-purple-100 text-purple-600' :
                                todo.segmentation === 'Qualified Lead' ? 'bg-blue-100 text-blue-600' :
                                'bg-slate-100 text-slate-500'
                              }`}>
                                {todo.segmentation}
                              </span>
                            )}
                          </div>
                          
                          {todo.leadName && (
                            <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-100 text-[10px] space-y-1">
                              <div className="flex justify-between">
                                <span className="text-slate-400 font-bold uppercase">Tipo:</span>
                                <span className="text-slate-700 font-medium">{todo.leadType === 'company' ? 'Empresa' : 'Pessoa'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400 font-bold uppercase">Lead:</span>
                                <span className="text-slate-700 font-medium">{todo.leadName}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400 font-bold uppercase">Motivo:</span>
                                <span className="text-slate-700 font-medium">{todo.leadReason}</span>
                              </div>
                              {todo.leadType === 'company' && (
                                <>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400 font-bold uppercase">Empresa:</span>
                                    <span className="text-slate-700 font-medium">{todo.companySize} func.</span>
                                  </div>
                                  {todo.estimatedBudget && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400 font-bold uppercase">Orçamento:</span>
                                      <span className="text-slate-700 font-medium">R$ {todo.estimatedBudget.toLocaleString()}</span>
                                    </div>
                                  )}
                                </>
                              )}
                              {todo.meetingLink && (
                                <div className="pt-1 flex items-center gap-2">
                                  <span className="text-slate-400 font-bold uppercase">Reunião:</span>
                                  <a 
                                    href={todo.meetingLink} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className={`font-bold hover:underline flex items-center gap-1 ${todo.meetingLink.includes('zoom') ? 'text-blue-600' : 'text-emerald-600'}`}
                                  >
                                    <Video size={10} />
                                    Entrar na Reunião
                                  </a>
                                </div>
                              )}
                              {todo.documentUrl && (
                                <div className="pt-1">
                                  <a href={todo.documentUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline font-bold">
                                    Ver Documento
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          {todo.meetingLink && (
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(todo.meetingLink!);
                                addToast('Link copiado para a área de transferência!');
                              }}
                              className="p-2 text-slate-400 hover:text-emerald-600 transition-all"
                              title="Copiar Link da Reunião"
                            >
                              <Copy size={18} />
                            </button>
                          )}
                          <button 
                            onClick={() => startEditing(todo)}
                            className="p-2 text-slate-400 hover:text-emerald-600 transition-all"
                            title="Visualizar Detalhes"
                          >
                            <Eye size={18} />
                          </button>
                          <button 
                            onClick={() => {
                              if (confirm('Deseja excluir esta tarefa?')) {
                                deleteTodo(todo.id);
                                addToast('Tarefa excluída', 'info');
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-rose-600 transition-all"
                            title="Excluir"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </motion.div>
                      ))
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="py-12 text-center"
                      >
                        <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                          <AlertCircle size={32} />
                        </div>
                        <p className="text-slate-500 font-medium">
                          {todos.length === 0 ? 'Você ainda não tem tarefas.' : 'Nenhuma tarefa encontrada com esses filtros.'}
                        </p>
                        {todos.length > 0 && (
                          <button 
                            onClick={() => {
                              setFilterPriority('all');
                              setFilterStatus('all');
                              setFilterLeadType('all');
                            }}
                            className="text-emerald-600 font-bold text-sm mt-2 hover:underline"
                          >
                            Limpar todos os filtros
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  )}
                </div>
              </section>
            </div>

            {/* Right Column: AI & Calendar */}
            <div className="space-y-8">
              {/* AI Assistant */}
              <section className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Sparkles size={80} />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Sparkles size={20} className="text-emerald-400" />
                      Assistente IA
                    </h2>
                    <button 
                      onClick={generateSuggestions}
                      disabled={isGeneratingAI}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isGeneratingAI ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    </button>
                  </div>
                  {aiSuggestions ? (
                    <div className="text-sm text-slate-300 leading-relaxed prose prose-invert prose-sm max-w-none">
                      <Markdown>{aiSuggestions}</Markdown>
                    </div>
                  ) : (
                    <button 
                      onClick={generateSuggestions}
                      disabled={isGeneratingAI}
                      className="w-full bg-emerald-500 text-white py-2 rounded-xl text-sm font-bold hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"
                    >
                      {isGeneratingAI ? <Loader2 size={16} className="animate-spin" /> : 'Obter Sugestões'}
                    </button>
                  )}
                </div>
              </section>

              {/* Calendar Events */}
              <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <CalendarDays size={20} className="text-emerald-600" />
                  Próximos Eventos
                </h2>
                {isLoadingEvents ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin text-emerald-600" /></div>
                ) : (events.length > 0 || todos.some(t => t.dueDate && t.meetingLink)) ? (
                  <div className="space-y-4">
                    {[
                      ...events.map(e => ({
                        id: e.id,
                        summary: e.summary,
                        time: e.start.dateTime ? new Date(e.start.dateTime) : null,
                        link: e.hangoutLink,
                        type: 'google'
                      })),
                      ...todos.filter(t => t.dueDate && t.meetingLink).map(t => ({
                        id: t.id,
                        summary: t.text,
                        time: new Date(t.dueDate!),
                        link: t.meetingLink,
                        type: 'local'
                      }))
                    ]
                    .sort((a, b) => {
                      if (!a.time) return 1;
                      if (!b.time) return -1;
                      return a.time.getTime() - b.time.getTime();
                    })
                    .filter(e => !e.time || e.time > new Date())
                    .slice(0, 5)
                    .map(e => (
                      <div 
                        key={e.id} 
                        className={`flex gap-3 items-start ${e.type === 'local' ? 'cursor-pointer hover:bg-slate-50 p-1 rounded-lg transition-colors' : ''}`}
                        onClick={() => {
                          if (e.type === 'local') {
                            const todo = todos.find(t => t.id === e.id);
                            if (todo) startEditing(todo);
                          }
                        }}
                      >
                        <div className="text-[10px] font-bold text-slate-400 w-12 pt-1 uppercase">
                          {e.time ? e.time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Dia Todo'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-700">{e.summary}</p>
                            <span className={`text-[8px] px-1 rounded uppercase font-black ${e.type === 'local' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}
                              style={{ 
                                backgroundColor: e.type === 'local' && user?.isPremium ? `${branding.primaryColor}20` : undefined,
                                color: e.type === 'local' && user?.isPremium ? branding.primaryColor : undefined
                              }}
                            >
                              {e.type === 'local' ? 'Local' : 'Gcal'}
                            </span>
                          </div>
                          {e.link && (
                            <a 
                              href={e.link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all mt-2 shadow-sm ${
                                e.type === 'local' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                              }`}
                              style={{ backgroundColor: e.type === 'local' && user?.isPremium ? branding.primaryColor : undefined }}
                            >
                              <Video size={12} />
                              {e.link.includes('zoom') ? 'Entrar no Zoom' : 'Entrar no Meet'}
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-4">Nenhum evento encontrado.</p>
                )}
              </section>
            </div>
          </div>
        ) : viewMode === 'dashboard' ? (
          !user?.isPremium ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm text-center px-6">
              <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-6">
                <Lock size={40} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Dashboard Premium</h2>
              <p className="text-slate-500 max-w-md mb-8">
                O Dashboard é um recurso exclusivo para assinantes Premium. 
                Assine agora para ter acesso a análises avançadas de produtividade e leads.
              </p>
              <button 
                onClick={() => setViewMode('finance')}
                className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                style={{ backgroundColor: branding.primaryColor }}
              >
                Ver Planos Premium
              </button>
            </div>
          ) : (
            <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"
              >
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Taxa de Comparecimento</p>
                <h3 className="text-3xl font-bold text-slate-900">{analyticsData?.attendanceRate || 0}%</h3>
                <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-1000" 
                    style={{ width: `${analyticsData?.attendanceRate || 0}%`, backgroundColor: user?.isPremium ? branding.primaryColor : undefined }}
                  />
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"
              >
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Horário mais Agendado</p>
                <h3 className="text-3xl font-bold text-slate-900">{analyticsData?.mostScheduledTime || 'N/A'}</h3>
                <p className="text-[10px] text-slate-400 mt-2 font-medium">Pico de produtividade</p>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"
              >
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total de Leads</p>
                <h3 className="text-3xl font-bold text-slate-900">{analyticsData?.totalLeads || 0}</h3>
                <p className="text-[10px] text-slate-400 mt-2 font-medium">Oportunidades geradas</p>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"
              >
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Conversão Média</p>
                <h3 className="text-3xl font-bold text-slate-900">
                  {analyticsData?.conversionByType?.reduce((acc: number, curr: any) => acc + curr.rate, 0) / (analyticsData?.conversionByType?.length || 1) || 0}%
                </h3>
                <p className="text-[10px] text-slate-400 mt-2 font-medium">Eficiência de fechamento</p>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm"
              >
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <BarChart3 size={20} className="text-emerald-600" />
                  Receita por Horário (R$)
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData?.revenueByHour || []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#f8fafc' }}
                      />
                      <Bar 
                        dataKey="revenue" 
                        fill={user?.isPremium ? branding.primaryColor : "#059669"} 
                        radius={[4, 4, 0, 0]} 
                        name="Receita"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm"
              >
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <PieChartIcon size={20} className="text-emerald-600" />
                  Conversão por Tipo de Reunião
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analyticsData?.conversionByType || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="rate"
                        nameKey="name"
                      >
                        <Cell fill={user?.isPremium ? branding.primaryColor : "#059669"} />
                        <Cell fill="#94a3b8" />
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>
            </div>
          )
        ) : viewMode === 'calendar' ? (
          !user?.isPremium ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm text-center px-6">
              <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-6">
                <Lock size={40} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Calendário Premium</h2>
              <p className="text-slate-500 max-w-md mb-8">
                A visualização em Calendário é um recurso exclusivo para assinantes Premium. 
                Assine agora para gerenciar sua agenda de forma visual e intuitiva.
              </p>
              <button 
                onClick={() => setViewMode('finance')}
                className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                style={{ backgroundColor: branding.primaryColor }}
              >
                Ver Planos Premium
              </button>
            </div>
          ) : (
            /* Calendar Grid View */
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">
                {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  className="p-2 hover:bg-white rounded-lg border border-slate-200 transition-colors"
                >
                  Prev
                </button>
                <button 
                  onClick={() => setCurrentMonth(new Date())}
                  className="px-4 py-2 hover:bg-white rounded-lg border border-slate-200 text-sm font-bold transition-colors"
                >
                  Today
                </button>
                <button 
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  className="p-2 hover:bg-white rounded-lg border border-slate-200 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 bg-slate-100 gap-px">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="bg-slate-50 p-3 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {day}
                </div>
              ))}
              
              {calendarDays.map((day, idx) => (
                <div 
                  key={idx} 
                  className={`min-h-[140px] bg-white p-2 border-slate-100 transition-all hover:bg-slate-50/50 ${!day ? 'bg-slate-50/30' : ''}`}
                >
                  {day && (
                    <>
                      <div className={`text-sm font-bold mb-2 w-7 h-7 flex items-center justify-center rounded-full ${
                        day.toDateString() === new Date().toDateString() ? 'bg-emerald-600 text-white' : 'text-slate-400'
                      }`} style={{ backgroundColor: day.toDateString() === new Date().toDateString() && user?.isPremium ? branding.primaryColor : undefined }}>
                        {day.getDate()}
                      </div>
                      <div className="space-y-1">
                        {getEventsForDay(day).map((event, eIdx) => (
                          <div 
                            key={eIdx}
                            onClick={() => {
                              if (event.isLocal) {
                                const todo = todos.find(t => t.id === event.id);
                                if (todo) startEditing(todo);
                              }
                            }}
                            className={`text-[10px] p-2 rounded-lg border flex flex-col gap-1.5 cursor-pointer transition-all hover:shadow-sm ${
                              event.isLocal 
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                                : 'bg-indigo-50 border-indigo-100 text-indigo-700'
                            } ${event.completed ? 'line-through opacity-50' : ''}`}
                            style={{ 
                              backgroundColor: event.isLocal && user?.isPremium ? `${branding.primaryColor}10` : undefined,
                              borderColor: event.isLocal && user?.isPremium ? `${branding.primaryColor}30` : undefined,
                              color: event.isLocal && user?.isPremium ? branding.primaryColor : undefined
                            }}
                            title={event.summary}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate font-bold">{event.summary}</span>
                              <span className={`text-[8px] px-1 rounded uppercase font-black ${event.isLocal ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}
                                style={{ 
                                  backgroundColor: event.isLocal && user?.isPremium ? `${branding.primaryColor}20` : undefined,
                                  color: event.isLocal && user?.isPremium ? branding.primaryColor : undefined
                                }}
                              >
                                {event.isLocal ? 'Local' : 'Gcal'}
                              </span>
                            </div>
                            {event.hangoutLink && (
                              <a 
                                href={event.hangoutLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className={`flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-[9px] font-bold transition-all ${
                                  event.isLocal ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
                                style={{ backgroundColor: event.isLocal && user?.isPremium ? branding.primaryColor : undefined }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Video size={10} />
                                {event.hangoutLink.includes('zoom') ? 'Zoom' : 'Meet'}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            </div>
          )
        ) : viewMode === 'finance' ? (
          <div className="max-w-2xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 text-center"
            >
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Seja Premium</h2>
              <p className="text-slate-500 mb-8">Desbloqueie customização de marca, logo, cores e domínio próprio por apenas R$ 9,90.</p>
              
              {user?.isPremium ? (
                <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 font-bold">
                  Você já é um usuário Premium! 🎉
                </div>
              ) : (
                <div className="space-y-6">
                  {pixData ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-white border-2 border-slate-100 rounded-2xl shadow-inner">
                        <img src={pixData.qrCode} alt="Pix QR Code" className="w-48 h-48" />
                      </div>
                      <div className="w-full">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Copia e Cola</p>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[10px] font-mono break-all text-slate-600">
                          {pixData.payload}
                        </div>
                      </div>
                      <button 
                        onClick={confirmPayment}
                        disabled={isPaying}
                        className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
                      >
                        {isPaying ? <Loader2 className="animate-spin" size={20} /> : 'Confirmar Pagamento'}
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={fetchPixQR}
                      className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all"
                    >
                      Gerar QR Code Pix
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-8">
            {/* Settings Menu */}
            <div className="w-full md:w-64 space-y-2">
              <button 
                onClick={() => setSettingsTab('profile')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${settingsTab === 'profile' ? 'bg-white text-emerald-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-100'}`}
                style={{ color: settingsTab === 'profile' && user?.isPremium ? branding.primaryColor : undefined }}
              >
                <UserIcon size={20} />
                Perfil do Usuário
              </button>
              <button 
                onClick={() => setSettingsTab('company')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${settingsTab === 'company' ? 'bg-white text-emerald-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-100'}`}
                style={{ color: settingsTab === 'company' && user?.isPremium ? branding.primaryColor : undefined }}
              >
                <Building2 size={20} />
                Minha Empresa
              </button>
            </div>

            {/* Settings Content */}
            <div className="flex-1">
              <AnimatePresence mode="wait">
                {settingsTab === 'profile' ? (
                  <motion.div 
                    key="profile"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200"
                  >
                    <h2 className="text-2xl font-bold text-slate-900 mb-6">Perfil do Usuário</h2>
                    <form onSubmit={updateProfile} className="space-y-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nome Completo</label>
                        <input 
                          type="text" 
                          value={user?.name || ''}
                          onChange={e => setUser(user ? {...user, name: e.target.value} : null)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                          placeholder="Seu nome"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">E-mail</label>
                        <input 
                          type="email" 
                          value={user?.email || ''}
                          onChange={e => setUser(user ? {...user, email: e.target.value} : null)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                          placeholder="seu@email.com"
                        />
                      </div>
                      <button 
                        type="submit"
                        className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                        style={{ backgroundColor: user?.isPremium ? branding.primaryColor : undefined }}
                      >
                        Atualizar Perfil
                      </button>

                      <div className="pt-6 border-t border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Ferramentas de Teste</p>
                        <button 
                          type="button"
                          onClick={sendTestReminder}
                          className="w-full bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                        >
                          <Bell size={18} />
                          Testar Lembrete por E-mail
                        </button>
                        <p className="text-[10px] text-slate-400 mt-2 text-center">
                          Isso criará uma tarefa de teste e enviará um e-mail para {user?.email} em instantes.
                        </p>
                      </div>
                    </form>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="company"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 relative overflow-hidden"
                  >
                    {!user?.isPremium && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center p-8 text-center">
                        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
                          <Sparkles size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Funcionalidade Premium</h3>
                        <p className="text-slate-500 mb-6 max-w-xs">A customização de marca, logo e cores é exclusiva para membros Premium.</p>
                        <button 
                          onClick={() => { setViewMode('finance'); fetchPixQR(); }}
                          className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg"
                        >
                          Seja Premium Agora
                        </button>
                      </div>
                    )}
                    <h2 className="text-2xl font-bold text-slate-900 mb-6">Configurações da Empresa</h2>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nome da Marca</label>
                        <input 
                          type="text" 
                          value={branding.brandName}
                          onChange={e => setBranding({...branding, brandName: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                          placeholder="Minha Empresa"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">URL do Logo</label>
                        <input 
                          type="text" 
                          value={branding.logoUrl}
                          onChange={e => setBranding({...branding, logoUrl: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                          placeholder="https://exemplo.com/logo.png"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cor Primária</label>
                        <div className="flex gap-4 items-center">
                          <input 
                            type="color" 
                            value={branding.primaryColor}
                            onChange={e => setBranding({...branding, primaryColor: e.target.value})}
                            className="w-12 h-12 rounded-lg cursor-pointer border-none p-0"
                          />
                          <span className="text-sm font-mono text-slate-500 uppercase">{branding.primaryColor}</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Domínio Próprio</label>
                        <input 
                          type="text" 
                          value={branding.customDomain}
                          onChange={e => setBranding({...branding, customDomain: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                          placeholder="todo.minhaempresa.com"
                        />
                      </div>
                      <button 
                        onClick={saveBranding}
                        disabled={!user?.isPremium}
                        className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
                        style={{ backgroundColor: user?.isPremium ? branding.primaryColor : undefined }}
                      >
                        Salvar Alterações da Empresa
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-12 pt-8 border-t border-slate-200">
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-rose-600 font-bold hover:text-rose-700 transition-colors"
                >
                  <LogOut size={20} />
                  Sair da Conta
                </button>
                <p className="text-xs text-slate-400 mt-2">SmartSync CRM v1.0.0 - Todos os direitos reservados</p>
              </div>
            </div>
          </div>
        )}
      </main>

      <AnimatePresence>
        {isEditModalOpen && editingTodo && (
          <EditTaskModal 
            todo={editingTodo}
            branding={branding}
            isPremium={!!user?.isPremium}
            onClose={() => {
              setIsEditModalOpen(false);
              setEditingTodo(null);
            }}
            onSave={updateTodo}
          />
        )}
      </AnimatePresence>
      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border min-w-[280px] ${
                toast.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' :
                toast.type === 'error' ? 'bg-rose-600 border-rose-500 text-white' :
                'bg-slate-800 border-slate-700 text-white'
              }`}
            >
              {toast.type === 'success' ? <CheckCircle2 size={18} /> : 
               toast.type === 'error' ? <AlertCircle size={18} /> : <Info size={18} />}
              <p className="text-sm font-bold">{toast.message}</p>
              <button 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
