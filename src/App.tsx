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
  Video
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';

// --- Types ---

interface User {
  id: string;
  name: string;
  email: string;
  isPremium: boolean;
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
  reminderType?: 'none' | 'email';
  reminderTiming?: '1h' | '24h';
  contactInfo?: string;
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'app'>('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [priority, setPriority] = useState<Todo['priority']>('medium');
  const [dueDate, setDueDate] = useState('');
  const [syncWithGoogle, setSyncWithGoogle] = useState(false);
  
  const [reminderType, setReminderType] = useState<Todo['reminderType']>('none');
  const [reminderTiming, setReminderTiming] = useState<Todo['reminderTiming']>('1h');
  const [contactInfo, setContactInfo] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'finance' | 'settings'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifiedTasks, setNotifiedTasks] = useState<Set<string>>(new Set());

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

  const fetchTasks = async () => {
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
      const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);

      todos.forEach(todo => {
        if (todo.completed || !todo.dueDate || notifiedTasks.has(todo.id)) return;

        const due = new Date(todo.dueDate);
        if (due > now && due <= tenMinutesFromNow) {
          new Notification("Tarefa Próxima", {
            body: `"${todo.text}" vence às ${due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}!`,
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
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
        }
        // Force immediate check and transition
        const token = localStorage.getItem('auth_token');
        const statusRes = await fetch('/api/auth/status', { 
          credentials: 'include',
          headers: {
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });
        const statusData = await statusRes.json();
        if (statusData.isAuthenticated) {
          setUser(statusData.user);
          setAuthMode('app');
        } else {
          setAuthError('Erro ao validar sessão. Verifique se seu navegador permite cookies de terceiros.');
        }
      } else {
        const data = await res.json();
        setAuthError(data.error || 'Erro ao entrar');
      }
    } catch (err) {
      setAuthError('Erro de conexão');
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
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
        }
        // The server now sets the session token during registration
        const token = localStorage.getItem('auth_token');
        const statusRes = await fetch('/api/auth/status', { 
          credentials: 'include',
          headers: {
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });
        const statusData = await statusRes.json();
        if (statusData.isAuthenticated) {
          setUser(statusData.user);
          setAuthMode('app');
        } else {
          setAuthError('Erro ao validar sessão após registro. Verifique se seu navegador permite cookies de terceiros.');
        }
      } else {
        const data = await res.json();
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
        alert("Branding atualizado com sucesso!");
      }
    } catch (err) {
      console.error("Failed to save branding", err);
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
  };

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim()) return;

    let googleEventId = undefined;

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
          fetchEvents(); // Refresh events
        }
      } catch (err) {
        console.error("Failed to sync with Google Calendar", err);
      }
    }

    const todo: Todo = {
      id: Math.random().toString(36).substring(2, 15) + Date.now(),
      text: newTodo,
      completed: false,
      priority,
      dueDate: dueDate || undefined,
      googleEventId,
      reminderType,
      reminderTiming,
      contactInfo: (reminderType !== 'none') ? contactInfo : undefined,
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
        setTodos(prev => [todo, ...prev]);
        setNewTodo('');
        setDueDate('');
        setSyncWithGoogle(false);
        setReminderType('none');
        setContactInfo('');
        
        // Show confirmation
        setShowConfirmation(true);
        setTimeout(() => setShowConfirmation(false), 3000);
      } else {
        const errorData = await res.json();
        alert(`Erro ao salvar tarefa: ${errorData.error || 'Erro desconhecido'}`);
      }
    } catch (err) {
      console.error("Failed to save task", err);
      alert("Erro de conexão ao salvar tarefa.");
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
      }
    } catch (err) {
      console.error("Failed to toggle task", err);
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
    }
  };

  const generateSuggestions = async () => {
    setIsGeneratingAI(true);
    const suggestions = await getAISuggestions(todos, events);
    setAiSuggestions(suggestions || "Nenhuma sugestão disponível.");
    setIsGeneratingAI(false);
  };

  const sortedTodos = useMemo(() => {
    return [...todos].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const priorityMap = { high: 0, medium: 1, low: 2 };
      return priorityMap[a.priority] - priorityMap[b.priority];
    });
  }, [todos]);

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
      .map(t => ({ id: t.id, summary: t.text, isLocal: true, completed: t.completed, hangoutLink: undefined }));
      
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
            <h1 className="text-2xl font-bold text-slate-900">SmartSync Todo</h1>
            <p className="text-slate-500 text-sm mt-1">Sua produtividade em sincronia</p>
          </div>

          <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-4">
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
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Senha</label>
              <input 
                type="password" 
                required
                value={authForm.password}
                onChange={e => setAuthForm({...authForm, password: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="••••••••"
              />
            </div>

            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-medium flex items-center gap-2">
                <AlertCircle size={14} />
                {authError}
              </div>
            )}

            <button 
              type="submit"
              disabled={isAuthenticating}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isAuthenticating && <Loader2 className="animate-spin" size={18} />}
              {authMode === 'login' ? 'Entrar' : 'Criar Conta'}
            </button>
          </form>

          <div className="mt-6 space-y-4">
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

            <p className="text-center text-sm text-slate-500">
              {authMode === 'login' ? 'Não tem uma conta?' : 'Já tem uma conta?'}
              <button 
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
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
                className={`text-sm font-bold transition-all ${viewMode === 'calendar' ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                style={{ color: viewMode === 'calendar' && user?.isPremium ? branding.primaryColor : undefined }}
              >
                Calendário
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

                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-slate-400" />
                      <input 
                        type="datetime-local" 
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-emerald-500"
                      />
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

                      {reminderType !== 'none' && (
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
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id="syncGoogle"
                            checked={syncWithGoogle}
                            onChange={(e) => setSyncWithGoogle(e.target.checked)}
                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                          />
                          <label htmlFor="syncGoogle" className="text-sm text-slate-600 cursor-pointer flex items-center gap-1">
                            <Calendar size={14} />
                            Sincronizar com Google Agenda
                          </label>
                        </div>
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
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Tarefas</h2>
                  <span className="text-xs text-slate-400">{todos.filter(t => !t.completed).length} restantes</span>
                </div>
                
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {sortedTodos.map((todo) => (
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
                          </div>
                        </div>

                        <button 
                          onClick={() => deleteTodo(todo.id)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-rose-600 transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
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
                ) : events.length > 0 ? (
                  <div className="space-y-4">
                    {events.slice(0, 5).map(e => (
                      <div key={e.id} className="flex gap-3 items-start">
                        <div className="text-[10px] font-bold text-slate-400 w-12 pt-1 uppercase">
                          {e.start.dateTime ? new Date(e.start.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Dia Todo'}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-700">{e.summary}</p>
                          {e.hangoutLink && (
                            <a 
                              href={e.hangoutLink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-bold hover:underline mt-1"
                            >
                              <Video size={10} />
                              Entrar no Meet
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
        ) : viewMode === 'calendar' ? (
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
                            className={`text-[10px] p-1.5 rounded-md truncate font-medium border flex flex-col gap-1 ${
                              event.isLocal 
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                                : 'bg-slate-100 border-slate-200 text-slate-600'
                            } ${event.completed ? 'line-through opacity-50' : ''}`}
                            style={{ 
                              backgroundColor: event.isLocal && user?.isPremium ? `${branding.primaryColor}10` : undefined,
                              borderColor: event.isLocal && user?.isPremium ? `${branding.primaryColor}30` : undefined,
                              color: event.isLocal && user?.isPremium ? branding.primaryColor : undefined
                            }}
                            title={event.summary}
                          >
                            <span>{event.summary}</span>
                            {event.hangoutLink && (
                              <a 
                                href={event.hangoutLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[8px] font-bold hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Video size={8} />
                                Meet
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
          <div className="max-w-2xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
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
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Customização de Marca</h2>
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
                  Salvar Alterações
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  );
}
