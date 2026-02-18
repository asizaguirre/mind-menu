const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Configurações
const PORT = process.env.PORT || 4000;
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgres:5432/railway';

// O ID do restaurante deve ser injetado via variável de ambiente pelo Admin ao criar o container
// Se não estiver definido (ex: rodando via docker-compose padrão), assume ID 1 para testes
const RESTAURANT_ID = process.env.RESTAURANT_ID || 1;

const pool = new Pool({ connectionString: DATABASE_URL });

console.log(`Iniciando Restaurant Service para ID: ${RESTAURANT_ID}`);

// --- Rotas Públicas (Cliente Final) ---

// 1. Obter Cardápio
app.get('/menu', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, price FROM menu_items WHERE restaurant_id = $1',
      [RESTAURANT_ID]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar cardápio' });
  }
});

// 2. Fazer Pedido
app.post('/orders', async (req, res) => {
  const client = await pool.connect();
  try {
    const { clientName, items } = req.body; // items: [{ name: "Pizza", quantity: 1 }]
    
    await client.query('BEGIN');

    // Criar o pedido
    const orderResult = await client.query(
      'INSERT INTO orders (client_name, status, restaurant_id) VALUES ($1, $2, $3) RETURNING id',
      [clientName, 'pendente', RESTAURANT_ID]
    );
    const orderId = orderResult.rows[0].id;

    // Inserir itens do pedido
    if (items && items.length > 0) {
      for (const item of items) {
        await client.query(
          'INSERT INTO order_items (order_id, menu_item_name, quantity) VALUES ($1, $2, $3)',
          [orderId, item.name, item.quantity]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ status: 'Pedido realizado', orderId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Erro ao processar pedido' });
  } finally {
    client.release();
  }
});

// 3. Consultar Status do Pedido
app.get('/orders/:id', async (req, res) => {
  const result = await pool.query('SELECT status FROM orders WHERE id = $1 AND restaurant_id = $2', [req.params.id, RESTAURANT_ID]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido não encontrado' });
  res.json(result.rows[0]);
});

app.get('/', (req, res) => res.send(`Restaurant Service (ID: ${RESTAURANT_ID}) rodando!`));

app.listen(PORT, () => console.log(`Restaurant Service rodando na porta ${PORT}`));