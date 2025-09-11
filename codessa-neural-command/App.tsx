import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Brain, Network, Bot, Zap, Command, 
  Activity, Cpu, Shield, DollarSign, Users,
  Star, CheckCircle, Medal, X, Plus,
  TrendingUp, Server, ClipboardList, ChevronsUp, ChevronUp, Minus, ArrowLeft,
  GitBranch, ChevronDown, Pencil, Info, Filter, ArrowUpDown, Calendar
} from 'lucide-react';

// Define explicit types for Task to avoid overly-specific type inference from initial state.
type TaskStatus = 'pending' | 'in-progress' | 'completed';
type TaskPriority = 'low' | 'medium' | 'high';

interface Task {
  id: number;
  name: string;
  status: TaskStatus;
  priority: TaskPriority;
  agent: string;
  agentId?: string;
  dependencies: number[];
  progress: number;
  dueDate: string;
}

const UltimateCodessaSystem = () => {
  const [activeTab, setActiveTab] = useState('orchestration');
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [systemHealth] = useState(99.7);
  const [realTimeData, setRealTimeData] = useState({
    tokensPerSecond: 847,
    activeConnections: 223,
    revenue: 12840
  });
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, name: 'Recalibrate quantum network latency', status: 'in-progress', priority: 'high', agent: 'Master System Architect', agentId: 'master-architect', dependencies: [], progress: 35, dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
    { id: 2, name: 'Analyze Q3 market sentiment data', status: 'pending', priority: 'medium', agent: 'Market Oracle AI', agentId: 'market-oracle', dependencies: [], progress: 0, dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
    { id: 3, name: 'Deploy security patch v2.1.8', status: 'completed', priority: 'high', agent: 'Master System Architect', agentId: 'master-architect', dependencies: [], progress: 100, dueDate: '2024-08-01' },
    { id: 4, name: 'Run diagnostic on European server cluster', status: 'pending', priority: 'low', agent: 'Swarm Agents', agentId: 'swarm-agents', dependencies: [3], progress: 0, dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
    { id: 5, name: 'Generate Q3 performance report', status: 'pending', priority: 'medium', agent: 'Market Oracle AI', agentId: 'market-oracle', dependencies: [2, 4], progress: 0, dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
  ]);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [newTaskDependencies, setNewTaskDependencies] = useState<number[]>([]);
  const [newTaskAgentId, setNewTaskAgentId] = useState<string>('');
  const [isDependencyDropdownOpen, setIsDependencyDropdownOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  // State for filtering and sorting
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [filterAgentId, setFilterAgentId] = useState<string>('all');
  const [sortOption, setSortOption] = useState<string>('due-date-asc');
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dependencyDropdownRef = useRef<HTMLDivElement | null>(null);

  const systemMetrics = {
    revenue: 89420,
    uptime: 99.97,
    autonomyLevel: 87.3
  };

  const liveProjects = [
    { id: 'quantum-optimizer', name: 'Quantum Resource Optimizer', status: 'generating', completion: 73, revenue: 284750, priority: 9.8, agents: 12, marketSize: '$2.3B', confidence: 94.7, eta: '2.3 days', stakeholders: 47 },
    { id: 'climate-monitor', name: 'Global Climate Monitoring Grid', status: 'active', completion: 88, revenue: 432180, priority: 9.9, agents: 34, marketSize: '$5.7B', confidence: 96.3, eta: 'deployed', stakeholders: 156 }
  ];

  const eliteAgents = [
    { id: 'master-architect', name: 'Master System Architect', level: 'Autonomous', intelligence: 98.7, projectsCompleted: 1247, revenue: 2840000, efficiency: 97.2, status: 'architecting', currentTask: 'Designing distributed quantum processing system', capabilities: ['Full-stack architecture design', 'Performance optimization', 'Security vulnerability assessment', 'Automated scaling solutions'], achievements: ['Enterprise Architecture Excellence', 'Security Innovation Award'], performanceHistory: [{ month: 'Jan', efficiency: 96.5 }, { month: 'Feb', efficiency: 96.8 }, { month: 'Mar', efficiency: 97.0 }, { month: 'Apr', efficiency: 97.2 }, { month: 'May', efficiency: 97.1 }, { month: 'Jun', efficiency: 97.2 },], activityLog: [{ timestamp: '10:00:15Z', action: 'Task "Recalibrate quantum network latency" initiated.' }, { timestamp: '09:45:02Z', action: 'System architecture scan completed.' }, { timestamp: '08:12:54Z', action: 'Deployed security patch v2.1.8.' }, { timestamp: '07:30:00Z', action: 'System reboot cycle completed.' },] },
    { id: 'market-oracle', name: 'Market Oracle AI', level: 'Predictive', intelligence: 95.3, projectsCompleted: 892, revenue: 1920000, efficiency: 94.8, status: 'analyzing', currentTask: 'Predicting emerging technology markets for Q2 2025', capabilities: ['Market size estimation', 'Competitive landscape analysis', 'Consumer behavior prediction', 'Risk assessment modeling'], achievements: ['Market Prediction Accuracy Award', 'Revenue Generation Excellence'], performanceHistory: [{ month: 'Jan', efficiency: 94.2 }, { month: 'Feb', efficiency: 94.5 }, { month: 'Mar', efficiency: 94.4 }, { month: 'Apr', efficiency: 94.8 }, { month: 'May', efficiency: 94.7 }, { month: 'Jun', efficiency: 94.8 },], activityLog: [{ timestamp: '10:05:20Z', action: 'Initiated Q3 market sentiment analysis.' }, { timestamp: '09:55:11Z', action: 'Ingested 1.2TB of financial data.' }, { timestamp: '09:00:43Z', action: 'Model retraining complete.' }, { timestamp: '08:45:10Z', action: 'Generated weekly volatility report.' },] },
    { id: 'swarm-agents', name: 'Swarm Agents', level: 'Collective', intelligence: 92.1, projectsCompleted: 3102, revenue: 1500000, efficiency: 98.5, status: 'executing', currentTask: 'Distributed data processing for climate model', capabilities: ['Large-scale parallel processing', 'Data aggregation', 'Fault tolerance', 'Redundancy checks'], achievements: ['High-Throughput Computing Award'], performanceHistory: [{ month: 'Jan', efficiency: 98.2 }, { month: 'Feb', efficiency: 98.1 }, { month: 'Mar', efficiency: 98.4 }, { month: 'Apr', efficiency: 98.5 }, { month: 'May', efficiency: 98.6 }, { month: 'Jun', efficiency: 98.5 },], activityLog: [{ timestamp: '10:15:00Z', action: 'Executing batch job #8472.' }, { timestamp: '10:14:00Z', action: 'Node #23 reporting optimal performance.' },] }
  ];
  
  const filteredAndSortedTasks = useMemo(() => {
    let result = [...tasks];
    
    // Filtering
    if (filterStatus !== 'all') result = result.filter(t => t.status === filterStatus);
    if (filterPriority !== 'all') result = result.filter(t => t.priority === filterPriority);
    if (filterAgentId !== 'all') result = result.filter(t => t.agentId === filterAgentId);
    
    // Sorting
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    switch (sortOption) {
      case 'name-asc': result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name-desc': result.sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'priority-desc': result.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]); break;
      case 'priority-asc': result.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]); break;
      case 'due-date-asc': result.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()); break;
      case 'due-date-desc': result.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()); break;
      default: result.sort((a, b) => b.id - a.id); break;
    }
    
    return result;
  }, [tasks, filterStatus, filterPriority, filterAgentId, sortOption]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRealTimeData(prev => ({
        tokensPerSecond: Math.floor(Math.random() * 1000) + 500,
        activeConnections: Math.floor(Math.random() * 50) + 200,
        revenue: prev.revenue + Math.floor(Math.random() * 100) + 50
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    const taskInterval = setInterval(() => {
      setTasks(currentTasks =>
        currentTasks.map(task => {
          if (task.status === 'in-progress' && task.progress < 100) {
            const newProgress = Math.min(100, task.progress + Math.floor(Math.random() * 10) + 5);
            return {
              ...task,
              progress: newProgress,
              status: newProgress === 100 ? 'completed' : 'in-progress',
            };
          }
          return task;
        })
      );
    }, 3000);
    return () => clearInterval(taskInterval);
  }, []);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dependencyDropdownRef.current && !dependencyDropdownRef.current.contains(event.target as Node)) {
        setIsDependencyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (canvasRef.current && activeTab === 'neural-flow') {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      
      const particles = Array.from({ length: 30 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, size: Math.random() * 3 + 1, opacity: Math.random() * 0.8 + 0.2 }));
      
      let animationFrameId: number;
      const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
          if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fillStyle = `rgba(59, 130, 246, ${p.opacity})`; ctx.fill();
        });
        particles.forEach((p1, i) => {
          particles.slice(i + 1).forEach(p2 => {
            const dist = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
            if (dist < 100) {
              ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.strokeStyle = `rgba(59, 130, 246, ${0.3 - dist / 300})`; ctx.lineWidth = 1; ctx.stroke();
            }
          });
        });
        animationFrameId = requestAnimationFrame(animate);
      };
      animate();
      return () => cancelAnimationFrame(animationFrameId);
    }
  }, [activeTab]);
  
  const handleAddTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newTaskName.trim() || !newTaskDueDate) return;
    const assignedAgent = eliteAgents.find(a => a.id === newTaskAgentId);
    const newTask: Task = {
      id: Date.now(),
      name: newTaskName,
      status: 'pending',
      priority: newTaskPriority,
      agent: assignedAgent ? assignedAgent.name : 'Unassigned',
      agentId: newTaskAgentId,
      dependencies: newTaskDependencies,
      progress: 0,
      dueDate: newTaskDueDate
    };
    setTasks([newTask, ...tasks]);
    setNewTaskName('');
    setNewTaskPriority('medium');
    setNewTaskDependencies([]);
    setNewTaskAgentId('');
    setNewTaskDueDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setIsDependencyDropdownOpen(false);
  };
  
  const handleUpdateTask = (updatedTask: Task) => {
    setTasks(currentTasks =>
      currentTasks.map(t => (t.id === updatedTask.id ? updatedTask : t))
    );
    setEditingTask(null);
  };
  
  const handleDependencyChange = (taskId: number) => {
    setNewTaskDependencies(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const StatusBadge = ({ status, small = false }: { status: string, small?: boolean }) => {
    const styles: { [key: string]: string } = { pending: 'bg-yellow-100 text-yellow-800', 'in-progress': 'bg-blue-100 text-blue-800 animate-pulse', completed: 'bg-green-100 text-green-800', };
    const size = small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs';
    return <span className={`${size} font-semibold rounded-full ${styles[status]}`}>{status.replace('-', ' ')}</span>;
  };

  const PriorityIndicator = ({ priority }: { priority: string }) => {
    const styles: { [key: string]: string } = { high: 'text-red-500', medium: 'text-yellow-500', low: 'text-green-500', };
    const icons: { [key: string]: React.ReactNode } = { high: <ChevronsUp className="w-4 h-4" />, medium: <ChevronUp className="w-4 h-4" />, low: <Minus className="w-4 h-4" />, };
    return (
      <div className={`flex items-center gap-1 text-sm font-medium ${styles[priority]}`}>
        {icons[priority]} <span>{priority.charAt(0).toUpperCase() + priority.slice(1)}</span>
      </div>
    );
  };

  const DueDateDisplay = ({ dueDate }: { dueDate: string }) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate); due.setHours(0,0,0,0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
    let text, color;
    if (diffDays < 0) {
      text = `Overdue by ${Math.abs(diffDays)} day(s)`;
      color = 'text-red-600';
    } else if (diffDays === 0) {
      text = 'Due today';
      color = 'text-yellow-600';
    } else if (diffDays <= 3) {
      text = `Due in ${diffDays} day(s)`;
      color = 'text-yellow-600';
    } else {
      text = `Due ${due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
      color = 'text-gray-500';
    }
  
    return (
      <div className={`flex items-center gap-2 ${color}`}>
        <Calendar className="w-4 h-4 flex-shrink-0" />
        <span className="font-medium">{text}</span>
      </div>
    );
  };

  const TaskDependencyGraph = ({ tasks }: { tasks: Task[] }) => {
    const layout = useMemo(() => {
        const levels: { [key: number]: number } = {}; let remainingTasks = [...tasks]; let currentLevel = 0; const maxLevels = tasks.length + 1;
        while (remainingTasks.length > 0 && currentLevel < maxLevels) {
            const resolvedThisLevel: Task[] = [];
            remainingTasks.forEach(task => { if (task.dependencies.every(depId => levels[depId] !== undefined)) { levels[task.id] = currentLevel; resolvedThisLevel.push(task); } });
            if (resolvedThisLevel.length === 0) { console.error("Circular dependency detected or invalid dependency ID."); remainingTasks.forEach(t => levels[t.id] = -1); break; }
            remainingTasks = remainingTasks.filter(t => !resolvedThisLevel.find(rt => rt.id === t.id)); currentLevel++;
        }
        const nodesByLevel: Task[][] = []; tasks.forEach(task => { const level = levels[task.id]; if (level === -1) return; if (!nodesByLevel[level]) nodesByLevel[level] = []; nodesByLevel[level].push(task); });
        const nodePositions: { [key: number]: { x: number, y: number } } = {}; const nodeWidth = 180, nodeHeight = 80, xGap = 80, yGap = 40;
        nodesByLevel.forEach((levelTasks, levelIndex) => {
            const levelHeight = levelTasks.length * (nodeHeight + yGap);
            levelTasks.forEach((task, taskIndex) => { nodePositions[task.id] = { x: levelIndex * (nodeWidth + xGap) + xGap / 2, y: taskIndex * (nodeHeight + yGap) + yGap / 2 + (nodesByLevel.flat().length * (nodeHeight + yGap) / 2) - levelHeight / 2, }; });
        });
        const edges = tasks.flatMap(task => task.dependencies.map(depId => ({ from: depId, to: task.id })));
        const width = (nodesByLevel.length) * (nodeWidth + xGap); const height = Math.max(...nodesByLevel.map(l => l.length)) * (nodeHeight + yGap);
        return { nodePositions, edges, width, height, nodeWidth, nodeHeight };
    }, [tasks]);

    if (!tasks.length) return <div className="text-center text-gray-500 py-8">No tasks to display in graph.</div>;

    return (
        <div className="w-full overflow-x-auto bg-gray-50/50 p-4 rounded-lg border">
            <svg width={layout.width} height={layout.height} className="min-w-full">
                <defs> <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto"> <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" /> </marker> </defs>
                {layout.edges.map((edge, i) => {
                    const fromNode = layout.nodePositions[edge.from]; const toNode = layout.nodePositions[edge.to]; if (!fromNode || !toNode) return null;
                    return <path key={i} d={`M ${fromNode.x + layout.nodeWidth} ${fromNode.y + layout.nodeHeight/2} C ${fromNode.x + layout.nodeWidth + 40} ${fromNode.y + layout.nodeHeight/2}, ${toNode.x - 40} ${toNode.y + layout.nodeHeight/2}, ${toNode.x} ${toNode.y + layout.nodeHeight/2}`} fill="none" stroke="#9ca3af" strokeWidth="2" markerEnd="url(#arrowhead)" />;
                })}
                {Object.entries(layout.nodePositions).map(([taskId, pos]) => {
                    const task = tasks.find(t => t.id === Number(taskId)); if (!task) return null;
                    return (
                        <foreignObject key={taskId} x={pos.x} y={pos.y} width={layout.nodeWidth} height={layout.nodeHeight}>
                            <div className="w-full h-full bg-white border-2 rounded-lg p-2 flex flex-col justify-between text-xs shadow-md transition-transform hover:scale-105">
                                <p className="font-semibold text-gray-800 leading-tight">{task.name}</p>
                                <div className="flex justify-between items-center"> <StatusBadge status={task.status} small={true}/> <span className="text-gray-400 capitalize">{task.priority}</span> </div>
                            </div>
                        </foreignObject>
                    );
                })}
            </svg>
        </div>
    );
};

// Helper function to find all tasks that depend on a given task, directly or indirectly.
const getAllDescendants = (taskId: number, allTasks: Task[]): Set<number> => {
    const descendants = new Set<number>();
    const queue = [...allTasks.filter(t => t.dependencies.includes(taskId)).map(t => t.id)];
    const visited = new Set<number>(queue);

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        descendants.add(currentId);
        const children = allTasks.filter(t => t.dependencies.includes(currentId));
        for (const child of children) {
            if (!visited.has(child.id)) {
                visited.add(child.id);
                queue.push(child.id);
            }
        }
    }
    return descendants;
};


const EditTaskModal = ({ task, allTasks, agents, onUpdate, onClose }: { task: Task, allTasks: Task[], agents: any[], onUpdate: (task: Task) => void, onClose: () => void }) => {
    const [name, setName] = useState(task.name);
    const [priority, setPriority] = useState<TaskPriority>(task.priority);
    const [dependencies, setDependencies] = useState<number[]>(task.dependencies);
    const [agentId, setAgentId] = useState<string | undefined>(task.agentId);
    const [dueDate, setDueDate] = useState(task.dueDate);
    const [isDepDropdownOpen, setIsDepDropdownOpen] = useState(false);
    const depDropdownRef = useRef<HTMLDivElement | null>(null);

    const invalidDependencyIds = useMemo(() => {
      const descendants = getAllDescendants(task.id, allTasks);
      descendants.add(task.id); // A task cannot depend on itself
      return descendants;
    }, [task.id, allTasks]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (depDropdownRef.current && !depDropdownRef.current.contains(event.target as Node)) setIsDepDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDepChange = (taskId: number) => {
        setDependencies(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]);
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const assignedAgent = agents.find(a => a.id === agentId);
        onUpdate({ 
            ...task, 
            name, 
            priority, 
            dependencies, 
            agentId,
            dueDate,
            agent: assignedAgent ? assignedAgent.name : 'Unassigned' 
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-8 max-w-2xl w-full animate-fade-in-scale">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-gray-900">Edit Task</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="edit-task-name" className="block text-sm font-medium text-gray-700 mb-1">Task Name</label>
                        <input id="edit-task-name" type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div>
                           <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                            <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none">
                                <option value="low">Low</option> <option value="medium">Medium</option> <option value="high">High</option>
                            </select>
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-gray-700 mb-1">Assign Agent</label>
                            <select value={agentId} onChange={e => setAgentId(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none">
                                <option value="">Unassigned</option>
                                {agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
                            </select>
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Dependencies</label>
                        <div className="relative" ref={depDropdownRef}>
                            <button type="button" onClick={() => setIsDepDropdownOpen(!isDepDropdownOpen)} className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white flex justify-between items-center text-left">
                                <span>{dependencies.length > 0 ? `${dependencies.length} selected` : 'Select...'}</span> <ChevronDown className="w-4 h-4 text-gray-500" />
                            </button>
                            {isDepDropdownOpen && (
                                <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                                    {allTasks.map(dep => {
                                      const isInvalid = invalidDependencyIds.has(dep.id);
                                      return (
                                        <div key={dep.id} title={isInvalid ? "Cannot select a child task or itself as a dependency." : ""} className={`flex items-center gap-2 p-2 ${isInvalid ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 cursor-pointer'}`}>
                                          <input type="checkbox" checked={dependencies.includes(dep.id)} onChange={() => !isInvalid && handleDepChange(dep.id)} disabled={isInvalid} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:bg-gray-200" />
                                          <span className="text-sm text-gray-700">{dep.name}</span>
                                        </div>
                                      );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-end gap-4 pt-4 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const TaskDetailModal = ({ task, allTasks, onClose, onEdit }: { task: Task; allTasks: Task[]; onClose: () => void; onEdit: (task: Task) => void; }) => {
    const dependencies = task.dependencies.map(id => allTasks.find(t => t.id === id)).filter(Boolean);
    const dependents = allTasks.filter(t => t.dependencies.includes(task.id));

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-8 max-w-3xl w-full animate-fade-in-scale">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-1">{task.name}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                            <StatusBadge status={task.status} />
                            <PriorityIndicator priority={task.priority} />
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
                </div>
                
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-500 mb-1">Assigned Agent</label>
                            <div className="flex items-center gap-2 text-gray-800">
                                <Bot className="w-5 h-5 text-gray-600" />
                                <span className="font-semibold">{task.agent}</span>
                            </div>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-500 mb-1">Due Date</label>
                            <div className="flex items-center gap-2 text-gray-800">
                                <Calendar className="w-5 h-5 text-gray-600" />
                                <span className="font-semibold">{new Date(task.dueDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            </div>
                        </div>
                    </div>
                    
                    {task.status === 'in-progress' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-500 mb-1">Progress</label>
                            <div className="flex items-center gap-4">
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full" style={{ width: `${task.progress}%` }}></div>
                                </div>
                                <span className="font-semibold text-blue-600">{task.progress}%</span>
                            </div>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-500 mb-2">Dependencies (Prerequisites)</label>
                            <div className="space-y-2 max-h-24 overflow-y-auto pr-2">
                                {dependencies.length > 0 ? (
                                    dependencies.map(dep => dep && <div key={dep.id} className="text-sm bg-gray-100 p-2 rounded-md">{dep.name}</div>)
                                ) : (
                                    <div className="text-sm text-gray-400 italic">None</div>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-500 mb-2">Dependents (Blocks Following)</label>
                             <div className="space-y-2 max-h-24 overflow-y-auto pr-2">
                                {dependents.length > 0 ? (
                                    dependents.map(dep => <div key={dep.id} className="text-sm bg-gray-100 p-2 rounded-md">{dep.name}</div>)
                                ) : (
                                    <div className="text-sm text-gray-400 italic">None</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-4 pt-6 mt-6 border-t">
                    <button type="button" onClick={() => onEdit(task)} className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 flex items-center gap-2">
                        <Pencil className="w-4 h-4" /> Edit Task
                    </button>
                </div>
            </div>
        </div>
    );
};

  const renderOrchestrationHub = () => (
    <div className="space-y-8">
      {editingTask && <EditTaskModal task={editingTask} allTasks={tasks} agents={eliteAgents} onUpdate={handleUpdateTask} onClose={() => setEditingTask(null)} />}
      {selectedTask && <TaskDetailModal task={selectedTask} allTasks={tasks} onClose={() => setSelectedTask(null)} onEdit={(taskToEdit) => { setSelectedTask(null); setEditingTask(taskToEdit); }} />}
      <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-800 rounded-2xl p-8 text-white">
        <div className="flex items-center justify-between mb-8">
          <div> <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent"> Neural Orchestration Command Center </h2> <p className="text-gray-300 mt-2">Autonomous AI system coordination</p> </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-full border border-green-500/30"> <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div> <span className="text-green-400 font-medium">System Optimal</span> </div>
            <div className="text-right"> <div className="text-2xl font-bold text-cyan-400">{systemHealth}%</div> <div className="text-sm text-gray-400">Health Score</div> </div>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10"> <div className="flex items-center justify-between mb-4"> <Cpu className="w-8 h-8 text-blue-400" /> <div className="text-right"> <div className="text-2xl font-bold text-white">{realTimeData.tokensPerSecond.toLocaleString()}</div> <div className="text-sm text-gray-400">tokens/sec</div> </div> </div> <div className="h-2 bg-gray-700 rounded-full overflow-hidden"> <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 w-3/4"></div> </div> </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10"> <div className="flex items-center justify-between mb-4"> <Network className="w-8 h-8 text-green-400" /> <div className="text-right"> <div className="text-2xl font-bold text-white">{realTimeData.activeConnections}</div> <div className="text-sm text-gray-400">active nodes</div> </div> </div> <div className="h-2 bg-gray-700 rounded-full overflow-hidden"> <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 w-4/5"></div> </div> </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10"> <div className="flex items-center justify-between mb-4"> <DollarSign className="w-8 h-8 text-yellow-400" /> <div className="text-right"> <div className="text-2xl font-bold text-white">${realTimeData.revenue.toLocaleString()}</div> <div className="text-sm text-gray-400">revenue today</div> </div> </div> <div className="h-2 bg-gray-700 rounded-full overflow-hidden"> <div className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 w-3/4"></div> </div> </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10"> <div className="flex items-center justify-between mb-4"> <Activity className="w-8 h-8 text-purple-400" /> <div className="text-right"> <div className="text-2xl font-bold text-white">{systemMetrics.autonomyLevel}%</div> <div className="text-sm text-gray-400">autonomy</div> </div> </div> <div className="h-2 bg-gray-700 rounded-full overflow-hidden"> <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 w-5/6"></div> </div> </div>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div> <h3 className="text-2xl font-bold text-gray-900">Elite Project Portfolio</h3> <p className="text-gray-600">Autonomous project generation and deployment</p> </div>
          <button className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 flex items-center gap-2"> <Plus className="w-4 h-4" /> Generate Project </button>
        </div>
        <div className="space-y-6">
          {liveProjects.map(p => (
            <div key={p.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2"> <h4 className="text-xl font-semibold text-gray-900">{p.name}</h4> <div className={`px-3 py-1 rounded-full text-xs font-semibold ${p.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{p.status}</div> <div className="flex items-center gap-1"> <Star className="w-4 h-4 text-yellow-500 fill-current" /> <span className="text-sm font-medium">{p.priority}</span> </div> </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4"> <div> <div className="text-sm text-gray-500">Revenue Potential</div> <div className="font-semibold text-green-600">${p.revenue.toLocaleString()}</div> </div> <div> <div className="text-sm text-gray-500">Market Size</div> <div className="font-semibold">{p.marketSize}</div> </div> <div> <div className="text-sm text-gray-500">Confidence</div> <div className="font-semibold text-blue-600">{p.confidence}%</div> </div> <div> <div className="text-sm text-gray-500">ETA</div> <div className="font-semibold">{p.eta}</div> </div> </div>
                </div>
                <div className="text-right"> <div className="text-3xl font-bold text-blue-600 mb-1">{p.completion}%</div> <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden"> <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500" style={{ width: `${p.completion}%` }}></div> </div> </div>
              </div>
              <div className="flex items-center gap-6 text-sm text-gray-600"> <div className="flex items-center gap-2"> <Bot className="w-4 h-4" /> <span>{p.agents} agents</span> </div> <div className="flex items-center gap-2"> <Users className="w-4 h-4" /> <span>{p.stakeholders} stakeholders</span> </div> </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-6"> <div> <h3 className="text-2xl font-bold text-gray-900">Operational Task Queue</h3> <p className="text-gray-600">Manage and prioritize system-wide tasks for AI agents.</p> </div> <ClipboardList className="w-8 h-8 text-gray-400" /> </div>
        <form onSubmit={handleAddTask} className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
            <input type="text" value={newTaskName} onChange={e => setNewTaskName(e.target.value)} placeholder="Enter new task description..." className="lg:col-span-2 w-full px-4 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
            <select value={newTaskAgentId} onChange={e => setNewTaskAgentId(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none w-full">
                <option value="">Assign Agent...</option>
                {eliteAgents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
            </select>
            <div className="relative w-full" ref={dependencyDropdownRef}>
                <button type="button" onClick={() => setIsDependencyDropdownOpen(!isDependencyDropdownOpen)} className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white flex justify-between items-center text-left"> <span>{newTaskDependencies.length > 0 ? `${newTaskDependencies.length} dependencies` : 'Dependencies'}</span> <ChevronDown className="w-4 h-4 text-gray-500" /> </button>
                {isDependencyDropdownOpen && ( <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"> {tasks.map(t => ( <label key={t.id} className="flex items-center gap-2 p-2 hover:bg-gray-100 cursor-pointer"> <input type="checkbox" checked={newTaskDependencies.includes(t.id)} onChange={() => handleDependencyChange(t.id)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /> <span className="text-sm text-gray-700">{t.name}</span> </label>))} </div> )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
              <input type="date" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
            </div>
            <div className="flex gap-2">
                <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value as TaskPriority)} className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none w-full"> <option value="low">Low</option> <option value="medium">Medium</option> <option value="high">High</option> </select>
                <button type="submit" title="Add Task" className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 flex items-center justify-center"> <Plus className="w-5 h-5" /> </button>
            </div>
        </form>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 flex flex-wrap items-center gap-x-6 gap-y-4">
            <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-500" />
                <span className="font-semibold text-gray-700">Filter by:</span>
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as TaskStatus | 'all')} className="bg-white text-sm px-3 py-1.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="all">All Statuses</option> <option value="pending">Pending</option> <option value="in-progress">In Progress</option> <option value="completed">Completed</option>
            </select>
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value as TaskPriority | 'all')} className="bg-white text-sm px-3 py-1.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="all">All Priorities</option> <option value="low">Low</option> <option value="medium">Medium</option> <option value="high">High</option>
            </select>
             <select value={filterAgentId} onChange={e => setFilterAgentId(e.target.value)} className="bg-white text-sm px-3 py-1.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="all">All Agents</option>
                {eliteAgents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
            </select>
            <div className="flex items-center gap-2 ml-auto">
                <ArrowUpDown className="w-5 h-5 text-gray-500" />
                <span className="font-semibold text-gray-700">Sort by:</span>
            </div>
            <select value={sortOption} onChange={e => setSortOption(e.target.value)} className="bg-white text-sm px-3 py-1.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="due-date-asc">Due Date (Soonest)</option> <option value="due-date-desc">Due Date (Latest)</option>
                <option value="priority-desc">Priority (High-Low)</option> <option value="priority-asc">Priority (Low-High)</option>
                <option value="name-asc">Name (A-Z)</option> <option value="name-desc">Name (Z-A)</option>
            </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedTasks.map(task => { const dependentsCount = tasks.filter(t => t.dependencies.includes(task.id)).length;
                return (
                    <div key={task.id} onClick={() => setSelectedTask(task)} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between hover:shadow-md transition-shadow group cursor-pointer">
                        <div className="flex-grow">
                            <div className="flex justify-between items-start">
                              <p className="font-semibold text-gray-800 mb-3 pr-2">{task.name}</p>
                              <button onClick={(e) => { e.stopPropagation(); setEditingTask(task); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-600"> <Pencil className="w-4 h-4" /> </button>
                            </div>
                            <div className="flex items-center justify-between mb-4"> <StatusBadge status={task.status} /> <PriorityIndicator priority={task.priority} /> </div>
                            {task.status === 'in-progress' && (
                                <div className="mb-4">
                                    <div className="flex justify-between items-center text-sm text-gray-600 mb-1"> <span>Progress</span> <span className="font-semibold text-blue-600">{task.progress}%</span> </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden"> <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500 ease-out" style={{ width: `${task.progress}%` }}></div> </div>
                                </div>
                            )}
                        </div>
                        <div className="text-sm text-gray-500 border-t border-gray-200 pt-3 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <DueDateDisplay dueDate={task.dueDate} />
                          </div>
                          <div className="flex items-center gap-2 text-gray-600"> <Bot className="w-4 h-4 flex-shrink-0" /> <span>{task.agent}</span> </div>
                          <div className="flex items-center gap-2 text-gray-600"> <GitBranch className="w-4 h-4 flex-shrink-0" /> <span>Dep: {task.dependencies.length} | Blocks: {dependentsCount}</span> </div>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-6"> <div> <h3 className="text-2xl font-bold text-gray-900">Task Dependency Flow</h3> <p className="text-gray-600">Visualize task relationships and workflow.</p> </div> <GitBranch className="w-8 h-8 text-gray-400" /> </div>
        <TaskDependencyGraph tasks={tasks} />
      </div>
    </div>
  );

  const PerformanceChart = ({ data }: { data: {month: string, efficiency: number}[] }) => {
    const maxEfficiency = 100; const minEfficiency = Math.min(...data.map(p => p.efficiency)) - 1; const range = maxEfficiency - minEfficiency;
    const points = data.map((point, i) => `${(i / (data.length - 1)) * 100},${100 - ((point.efficiency - minEfficiency) / range) * 100}`).join(' ');
    return (
        <div className="mt-6">
            <h4 className="font-semibold text-lg text-gray-300 border-b border-white/10 pb-2 mb-4">Performance History (6 Months)</h4>
            <div className="bg-black/20 p-4 rounded-lg border border-white/10">
                <svg viewBox="0 0 100 100" className="w-full h-48" preserveAspectRatio="none">
                    <polyline fill="none" stroke="url(#gradient)" strokeWidth="2" points={points} />
                    <defs> <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%"> <stop offset="0%" stopColor="#0ea5e9" /> <stop offset="100%" stopColor="#a855f7" /> </linearGradient> </defs>
                </svg>
                <div className="flex justify-between text-xs text-gray-400 mt-2"> {data.map(p => <span key={p.month}>{p.month}</span>)} </div>
            </div>
        </div>
    );
  };
  
  const renderAgentDetailView = (agent: any) => (
    <div className="animate-fade-in-scale">
        <button onClick={() => setSelectedAgent(null)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"> <ArrowLeft className="w-4 h-4" /> Back to Agent Collective </button>
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-8 border border-white/20 shadow-2xl">
            <div className="flex flex-col md:flex-row items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-purple-400 rounded-xl flex items-center justify-center shadow-lg"> <Brain className="w-8 h-8 text-white" /> </div>
                    <div> <h3 className="text-3xl font-bold bg-gradient-to-r from-cyan-300 to-purple-300 bg-clip-text text-transparent">{agent.name}</h3> <p className="text-gray-400">{agent.level} Level Agent</p> </div>
                </div>
                <div className={`mt-4 md:mt-0 px-3 py-1 rounded-full text-xs font-semibold border ${ agent.status === 'architecting' ? 'bg-blue-500/20 text-blue-300 border-blue-400/30' : 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30' }`}> Status: {agent.status} </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div className="lg:col-span-3 space-y-6">
                    <h4 className="font-semibold text-xl text-gray-300 border-b border-white/10 pb-2">Performance Metrics</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 p-4 rounded-lg border border-white/10"><div className="text-sm text-gray-400 mb-1">Intelligence Score</div><div className="text-3xl font-bold text-cyan-400">{agent.intelligence}</div></div>
                        <div className="bg-white/5 p-4 rounded-lg border border-white/10"><div className="text-sm text-gray-400 mb-1">Efficiency Rate</div><div className="text-3xl font-bold text-green-400">{agent.efficiency}%</div></div>
                        <div className="bg-white/5 p-4 rounded-lg border border-white/10"><div className="text-sm text-gray-400 mb-1">Projects Completed</div><div className="text-3xl font-bold text-white">{agent.projectsCompleted.toLocaleString()}</div></div>
                        <div className="bg-white/5 p-4 rounded-lg border border-white/10"><div className="text-sm text-gray-400 mb-1">Revenue Generated</div><div className="text-3xl font-bold text-yellow-400">${(agent.revenue / 1000000).toFixed(1)}M</div></div>
                    </div>
                    <PerformanceChart data={agent.performanceHistory} />
                </div>
                <div className="lg:col-span-2 space-y-6">
                    <div> <h4 className="font-semibold text-xl text-gray-300 border-b border-white/10 pb-2 mb-4">Core Capabilities</h4> <div className="space-y-2"> {agent.capabilities.map((c: string) => <div key={c} className="flex items-center gap-3 bg-white/5 p-3 rounded-md border border-white/10"><CheckCircle className="w-5 h-5 text-purple-400 flex-shrink-0" /><span className="text-sm text-gray-300">{c}</span></div>)} </div> </div>
                    <div> <h4 className="font-semibold text-xl text-gray-300 border-b border-white/10 pb-2 mb-4">Achievements</h4> <div className="space-y-2"> {agent.achievements.map((a: string) => <div key={a} className="flex items-center gap-3 bg-white/5 p-3 rounded-md border border-white/10"><Medal className="w-5 h-5 text-yellow-400 flex-shrink-0" /><span className="text-sm text-gray-300">{a}</span></div>)} </div> </div>
                </div>
            </div>
            <div className="mt-8">
                <h4 className="font-semibold text-xl text-gray-300 border-b border-white/10 pb-2 mb-4">Recent Activity Log</h4>
                <div className="bg-black/20 p-4 rounded-lg border border-white/10 max-h-48 overflow-y-auto">
                    <div className="font-mono text-sm text-gray-400 space-y-2">
                        {agent.activityLog.map((log: any, index: number) => ( <div key={index} className="flex gap-4"> <span>{log.timestamp}</span> <span className="text-gray-500 flex-shrink-0">&gt;</span> <span className="text-gray-300">{log.action}</span> </div> ))}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
  
  const renderEliteAgents = () => {
    if (selectedAgent) return renderAgentDetailView(selectedAgent);
    return (
        <div className="space-y-8 animate-fade-in-scale">
            <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 rounded-2xl p-8 text-white">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent mb-2"> Elite Agent Collective </h2>
                <p className="text-gray-300 mb-8">Autonomous AI entities with advanced capabilities</p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {eliteAgents.map(agent => (
                    <div key={agent.id} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 hover:bg-white/15 transition-all cursor-pointer" onClick={() => setSelectedAgent(agent)}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3"> <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-purple-400 rounded-xl flex items-center justify-center"> <Brain className="w-6 h-6 text-white" /> </div> <div> <h3 className="font-semibold text-lg">{agent.name}</h3> <div className="text-sm text-gray-300">{agent.level} Level</div> </div> </div>
                        <div className="text-right"> <div className="text-2xl font-bold text-cyan-400">{agent.intelligence}</div> <div className="text-xs text-gray-400">Intelligence</div> </div>
                      </div>
                      <div className="space-y-3 mb-4"> <div className="flex justify-between"><span className="text-gray-300">Projects Completed</span><span className="text-white font-semibold">{agent.projectsCompleted.toLocaleString()}</span></div> <div className="flex justify-between"><span className="text-gray-300">Revenue Generated</span><span className="text-green-400 font-semibold">${(agent.revenue / 1000000).toFixed(1)}M</span></div> <div className="flex justify-between"><span className="text-gray-300">Efficiency Rate</span><span className="text-yellow-400 font-semibold">{agent.efficiency}%</span></div> </div>
                    </div>
                  ))}
                </div>
            </div>
        </div>
    );
  };

  const renderNeuralFlow = () => (
    <div className="space-y-8">
      <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 rounded-2xl p-8 relative overflow-hidden min-h-[500px] flex flex-col">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        <div className="relative z-10">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">Neural Flow Visualization</h2>
          <p className="text-gray-300 mb-8">Real-time cognitive processing patterns</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-cyan-400 mb-1">2.847M</div><div className="text-sm text-gray-300">Synaptic Connections</div></div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-blue-400 mb-1">847ms</div><div className="text-sm text-gray-300">Avg Processing Time</div></div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-purple-400 mb-1">94.7%</div><div className="text-sm text-gray-300">Pattern Recognition</div></div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-pink-400 mb-1">1,247</div><div className="text-sm text-gray-300">Active Pathways</div></div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderArchitecture = () => (
    <div className="space-y-8">
      <div className="bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 rounded-2xl p-8 text-white">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent mb-2">System Architecture</h2>
        <p className="text-gray-300 mb-8">Distributed intelligence infrastructure</p>
        <div className="bg-black/20 backdrop-blur-sm rounded-xl p-8 border border-white/10">
          <pre className="font-mono text-sm space-y-2 leading-relaxed whitespace-pre-wrap">
            <div className="text-emerald-400">┌─ 🌍 CODESSA NEURAL NETWORK ────────────────┐</div> <div>│</div> <div className="text-cyan-400">├─ 🌐 <span className="text-yellow-400">Edge Network Layer</span></div> <div>│  ├─ North America ─── [47 nodes] ──── <span className="text-green-400">🟢</span></div> <div>│  ├─ Europe ────────── [38 nodes] ──── <span className="text-green-400">🟢</span></div> <div>│  └─ Asia-Pacific ──── [52 nodes] ──── <span className="text-green-400">🟢</span></div> <div>│</div> <div className="text-purple-400">├─ 🧠 <span className="text-yellow-400">Neural Processing Cores</span></div> <div>│  ├─ Gemini Clusters ── [12 instances]</div> <div>│  ├─ Claude-3 Arrays ─ [8 instances]</div> <div>│  └─ Custom Networks ─ [23 instances]</div> <div>│</div> <div className="text-green-400">├─ 🤖 <span className="text-yellow-400">Agent Mesh Network</span></div> <div>│  ├─ Elite Agents ──── [89 active]</div> <div>│  └─ Swarm Agents ──── [1,247 active]</div> <div>│</div> <div className="text-orange-400">└─ 📊 <span className="text-yellow-400">Knowledge Engine (MHE)</span></div> <div>   ├─ Vector Database ─ [47M vectors]</div> <div>   └─ Graph Database ── [2.3M nodes]</div> <div className="text-emerald-400">└────────────────────────────────────────────┘</div>
          </pre>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mt-8">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 text-center"><Server className="w-6 h-6 mx-auto mb-2 text-blue-400" /><div className="text-lg font-bold text-white">137</div><div className="text-xs text-gray-300">Total Nodes</div></div>
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 text-center"><Activity className="w-6 h-6 mx-auto mb-2 text-green-400" /><div className="text-lg font-bold text-white">99.98%</div><div className="text-xs text-gray-300">Uptime</div></div>
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 text-center"><Zap className="w-6 h-6 mx-auto mb-2 text-yellow-400" /><div className="text-lg font-bold text-white">12.9M</div><div className="text-xs text-gray-300">Tokens/sec</div></div>
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 text-center"><Shield className="w-6 h-6 mx-auto mb-2 text-purple-400" /><div className="text-lg font-bold text-white">A++</div><div className="text-xs text-gray-300">Security</div></div>
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 text-center"><DollarSign className="w-6 h-6 mx-auto mb-2 text-green-400" /><div className="text-lg font-bold text-white">$2.3M</div><div className="text-xs text-gray-300">Daily Revenue</div></div>
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 text-center"><TrendingUp className="w-6 h-6 mx-auto mb-2 text-pink-400" /><div className="text-lg font-bold text-white">847%</div><div className="text-xs text-gray-300">YoY Growth</div></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <div className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div> <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 bg-clip-text text-transparent"> Codessa Neural Command </h1> <p className="text-gray-600 mt-1">Advanced AI orchestration platform</p> </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full"> <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div> <span className="font-medium">Neural Network Online</span> </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="flex flex-wrap gap-3 mb-8">
          {[
            { id: 'orchestration', label: 'Neural Orchestration', icon: Command, gradient: 'from-blue-500 to-purple-600' },
            { id: 'agents', label: 'Elite Agents', icon: Brain, gradient: 'from-purple-500 to-pink-600' },
            { id: 'neural-flow', label: 'Neural Flow', icon: Activity, gradient: 'from-cyan-500 to-blue-600' },
            { id: 'architecture', label: 'System Architecture', icon: Server, gradient: 'from-emerald-500 to-teal-600' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-3 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${ activeTab === tab.id ? `bg-gradient-to-r ${tab.gradient} text-white shadow-lg scale-105` : 'bg-white/70 backdrop-blur-sm text-gray-700 hover:bg-white border' }`}>
              <tab.icon className="w-5 h-5" /> {tab.label}
            </button>
          ))}
        </div>
        <div className="min-h-[600px]">
          {activeTab === 'orchestration' && renderOrchestrationHub()}
          {activeTab === 'agents' && renderEliteAgents()}
          {activeTab === 'neural-flow' && renderNeuralFlow()}
          {activeTab === 'architecture' && renderArchitecture()}
        </div>
      </div>
    </div>
  );
};

export default UltimateCodessaSystem;
