const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(cors());

// Configurações
const JWT_SECRET = process.env.JWT_SECRET || 'mind-menu-secret-key';
const PORT = process.env.PORT || 3002;
const ORCHESTRATION_TYPE = process.env.ORCHESTRATION_TYPE || 'mock'; // 'kubernetes', 'mock'
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgres:5432/railway';

// --- Banco de Dados (Postgres) ---
const pool = new Pool({ connectionString: DATABASE_URL });

// Inicialização das Tabelas
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, name TEXT, email TEXT UNIQUE, password TEXT, role TEXT
      );
      CREATE TABLE IF NOT EXISTS restaurants (
        id SERIAL PRIMARY KEY, name TEXT, address TEXT, category TEXT, endpoint TEXT, k8s_deployment TEXT
      );
      CREATE TABLE IF NOT EXISTS menu_items (
        id SERIAL PRIMARY KEY, name TEXT, price NUMERIC, restaurant_id INTEGER
      );
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY, client_name TEXT, status TEXT, restaurant_id INTEGER, created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY, order_id INTEGER, menu_item_name TEXT, quantity INTEGER
      );
    `);
    console.log('Banco de dados inicializado com sucesso.');
  } catch (err) {
    console.error('Erro ao inicializar DB:', err);
  }
}
initDB();

// --- Middlewares ---

// Middleware de Autenticação
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Espera formato "Bearer TOKEN"

  if (!token) return res.status(401).json({ error: 'Token necessário' });

  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Token inválido ou expirado' });
  }
}

// Middleware de Autorização (Roles)
function authorizeRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado: Permissão insuficiente' });
    }
    next();
  };
}

// --- Rotas de Autenticação e Usuários ---

app.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    // Em produção: verificar se email já existe
    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role || 'attendant';
    
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hashedPassword, userRole]
    );
    
    res.status(201).json({ status: 'ok', user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao registrar usuário' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ status: 'ok', token });
});

// Listar usuários (Apenas Admin)
app.get('/users', authMiddleware, authorizeRole(['admin']), async (req, res) => {
  const result = await pool.query('SELECT id, name, email, role FROM users');
  res.json(result.rows);
});

// Remover usuário (Apenas Admin)
app.delete('/users/:id', authMiddleware, authorizeRole(['admin']), async (req, res) => {
  await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.json({ status: 'Usuário removido' });
});

// --- Gestão de Restaurantes ---

app.post('/restaurants', authMiddleware, authorizeRole(['admin']), async (req, res) => {
  try {
    const { name, address, category } = req.body;
    
    // Primeiro, inserimos no banco para obter o ID
    const insertResult = await pool.query(
      'INSERT INTO restaurants (name, address, category) VALUES ($1, $2, $3) RETURNING id',
      [name, address, category]
    );
    const id = insertResult.rows[0].id;

    const deploymentName = `restaurant-${id}`;
    const serviceName = `restaurant-${id}-service`;

    let endpoint;

    if (ORCHESTRATION_TYPE === 'kubernetes') {
      console.log(`Gerando manifesto Kubernetes para restaurante ${id}...`);

      // Manifesto YAML Dinâmico
      const yamlContent = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${deploymentName}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${deploymentName}
  template:
    metadata:
      labels:
        app: ${deploymentName}
    spec:
      containers:
      - name: restaurant-service
        image: restaurant-service:latest
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 4000
        env:
        - name: RESTAURANT_ID
          value: "${id}"
        - name: DATABASE_URL
          value: "${DATABASE_URL}"
        - name: PORT
          value: "4000"
---
apiVersion: v1
kind: Service
metadata:
  name: ${serviceName}
spec:
  selector:
    app: ${deploymentName}
  ports:
    - protocol: TCP
      port: 80
      targetPort: 4000
  type: LoadBalancer
`;

      const filePath = path.join('/tmp', `${deploymentName}.yaml`);
      fs.writeFileSync(filePath, yamlContent);

      // Aplica o manifesto no cluster via kubectl
      await new Promise((resolve, reject) => {
        exec(`kubectl apply -f ${filePath}`, (error, stdout, stderr) => {
          if (error) {
            console.error(`Erro kubectl: ${stderr}`);
            return reject(error);
          }
          console.log(`Kubectl output: ${stdout}`);
          resolve(stdout);
        });
      });

      // Em um cenário real, o endpoint do LoadBalancer pode demorar para ser provisionado.
      // Aqui retornamos o nome do serviço interno como referência.
      endpoint = `http://${serviceName}`;
    } else {
      // Modo Mock (Local)
      console.log(`[MOCK] Simulando criação do restaurante ${id} (Sem Kubernetes)`);
      // Assume que o usuário subirá o serviço manualmente em uma porta local
      endpoint = `http://localhost:${4000 + id}`;
    }
    
    const k8sDeployment = ORCHESTRATION_TYPE === 'kubernetes' ? deploymentName : null;
    
    // Atualiza o registro com o endpoint e deployment
    await pool.query(
      'UPDATE restaurants SET endpoint = $1, k8s_deployment = $2 WHERE id = $3',
      [endpoint, k8sDeployment, id]
    );
    
    const newRestaurant = { id, name, address, category, endpoint, k8sDeployment };
    
    res.status(201).json(newRestaurant);
  } catch (error) {
    console.error('Erro ao criar recursos K8s:', error);
    res.status(500).json({ error: 'Erro ao criar restaurante no cluster', details: error.message });
  }
});

app.get('/restaurants', authMiddleware, async (req, res) => {
  const result = await pool.query('SELECT * FROM restaurants');
  res.json(result.rows);
});

app.get('/restaurants/:id', authMiddleware, async (req, res) => {
  const result = await pool.query('SELECT * FROM restaurants WHERE id = $1', [req.params.id]);
  const restaurant = result.rows[0];
  if (!restaurant) return res.status(404).json({ error: 'Restaurante não encontrado' });
  res.json(restaurant);
});

app.put('/restaurants/:id', authMiddleware, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { name, address, category } = req.body;
  const result = await pool.query(
    'UPDATE restaurants SET name = $1, address = $2, category = $3 WHERE id = $4 RETURNING *',
    [name, address, category, req.params.id]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'Restaurante não encontrado' });
  res.json(result.rows[0]);
});

app.delete('/restaurants/:id', authMiddleware, authorizeRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM restaurants WHERE id = $1', [req.params.id]);
    const restaurant = result.rows[0];
    
    if (!restaurant) return res.status(404).json({ error: 'Restaurante não encontrado' });

    // Remove os recursos do Kubernetes
    if (restaurant.k8sDeployment) {
      const deploymentName = restaurant.k8sDeployment;
      const serviceName = `${deploymentName}-service`;
      
      // Executa a remoção sem bloquear se falhar (fire and forget ou logar erro)
      exec(`kubectl delete deployment ${deploymentName} && kubectl delete service ${serviceName}`, (err, stdout) => {
        if (err) console.error(`Erro ao remover recursos K8s: ${err.message}`);
        else console.log(`Recursos removidos: ${stdout}`);
      });
    }

    await pool.query('DELETE FROM restaurants WHERE id = $1', [req.params.id]);
    res.json({ status: 'Restaurante e recursos K8s removidos' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover restaurante', details: error.message });
  }
});

// --- Gestão de Cardápio ---

app.post('/restaurants/:id/menu', authMiddleware, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { name, price } = req.body;
  const result = await pool.query(
    'INSERT INTO menu_items (name, price, restaurant_id) VALUES ($1, $2, $3) RETURNING *',
    [name, price, req.params.id]
  );
  res.status(201).json(result.rows[0]);
});

app.get('/restaurants/:id/menu', authMiddleware, async (req, res) => {
  const result = await pool.query('SELECT * FROM menu_items WHERE restaurant_id = $1', [req.params.id]);
  res.json(result.rows);
});

// --- Gestão de Pedidos ---

app.get('/orders', authMiddleware, async (req, res) => {
  // Filtro simples opcional por status
  const { status } = req.query;
  let query = 'SELECT * FROM orders';
  let params = [];
  
  if (status) {
    query += ' WHERE status = $1';
    params.push(status);
  }
  
  const result = await pool.query(query, params);
  
  // Opcional: Buscar itens de cada pedido (simplificado aqui)
  res.json(result.rows);
});

app.put('/orders/:id/status', authMiddleware, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { status } = req.body; // pendente, em preparo, entregue
  const result = await pool.query(
    'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
    [status, req.params.id]
  );
  
  if (result.rowCount === 0) return res.status(404).json({ error: 'Pedido não encontrado' });
  res.json({ status: 'ok', order: result.rows[0] });
});

app.get('/', (req, res) => res.send('Mindmenu Admin API rodando!'));

app.listen(PORT, () => console.log(`Mindmenu Admin na porta ${PORT}`));
