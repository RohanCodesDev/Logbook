// In-memory log store with sample initial entries
let logs = [
  {
    id: 'log-1',
    title: 'Workspace Initialized',
    category: 'Development',
    notes: 'Configured React frontend with Vite & Tailwind CSS, and Node.js Express backend.',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'log-2',
    title: 'Routing & Pages Created',
    category: 'Design',
    notes: 'Configured src/pages/ structure with Home, Dashboard, About, and NotFound views.',
    createdAt: new Date().toISOString(),
  },
];

export const getAllLogs = (req, res) => {
  res.json({ success: true, count: logs.length, data: logs });
};

export const getLogById = (req, res) => {
  const log = logs.find((l) => l.id === req.params.id);
  if (!log) {
    return res.status(404).json({ success: false, message: 'Log entry not found' });
  }
  res.json({ success: true, data: log });
};

export const createLog = (req, res) => {
  const { title, category, notes } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, message: 'Title is required' });
  }

  const newLog = {
    id: `log-${Date.now()}`,
    title: title.trim(),
    category: category || 'General',
    notes: notes || '',
    createdAt: new Date().toISOString(),
  };

  logs.unshift(newLog);
  res.status(201).json({ success: true, data: newLog });
};

export const deleteLog = (req, res) => {
  const { id } = req.params;
  const initialLength = logs.length;
  logs = logs.filter((l) => l.id !== id);

  if (logs.length === initialLength) {
    return res.status(404).json({ success: false, message: 'Log entry not found' });
  }

  res.json({ success: true, message: 'Log entry removed' });
};
