document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('adminToken');
    const API_URL = 'http://localhost:3000'; // URL do Admin Service

    // --- Lógica de Roteamento Simples ---
    if (document.getElementById('login-form')) {
        // Página de Login
        if (token) {
            window.location.href = 'index.html'; // Redireciona se já estiver logado
        }
        setupLoginPage();
    } else if (document.querySelector('header')) {
        // Páginas do Dashboard
        if (!token) {
            window.location.href = 'login.html'; // Redireciona se não estiver logado
            return;
        }
        setupDashboardPage();
    }

    // --- Lógica da Página de Login ---
    function setupLoginPage() {
        const loginForm = document.getElementById('login-form');
        const errorMessage = document.getElementById('error-message');

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('adminToken', data.token);
                    window.location.href = 'index.html';
                } else {
                    errorMessage.textContent = data.error || 'Erro ao fazer login.';
                }
            } catch (error) {
                errorMessage.textContent = 'Não foi possível conectar ao servidor.';
            }
        });
    }

    // --- Lógica do Dashboard ---
    function setupDashboardPage() {
        const logoutBtn = document.getElementById('logout-btn');
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('adminToken');
            window.location.href = 'login.html';
        });

        loadRestaurants();
        loadOrders();
        setupRestaurantForm();
        setupMenuModal();
    }

    async function fetchWithAuth(url, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
            ...options.headers,
        };
        return fetch(url, { ...options, headers });
    }

    // Carregar Restaurantes
    async function loadRestaurants() {
        const response = await fetchWithAuth(`${API_URL}/restaurants`);
        const restaurants = await response.json();
        const tableBody = document.querySelector('#restaurants-table tbody');
        tableBody.innerHTML = '';

        restaurants.forEach(r => {
            const row = `
                <tr>
                    <td>${r.id}</td>
                    <td>${r.name}</td>
                    <td>${r.address}</td>
                    <td><a href="${r.endpoint}" target="_blank">${r.endpoint}</a></td>
                    <td>
                        <button class="action-btn menu-btn" data-id="${r.id}" data-name="${r.name}">Cardápio</button>
                        <button class="action-btn delete-btn" data-id="${r.id}">Apagar</button>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });

        // Adicionar eventos aos botões
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                if (confirm(`Tem certeza que deseja apagar o restaurante ${id}?`)) {
                    await fetchWithAuth(`${API_URL}/restaurants/${id}`, { method: 'DELETE' });
                    loadRestaurants();
                }
            });
        });
        
        document.querySelectorAll('.menu-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const name = e.target.dataset.name;
                openMenuModal(id, name);
            });
        });
    }

    // Carregar Pedidos
    async function loadOrders() {
        const response = await fetchWithAuth(`${API_URL}/orders`);
        const orders = await response.json();
        const tableBody = document.querySelector('#orders-table tbody');
        tableBody.innerHTML = '';

        orders.forEach(o => {
            const row = `
                <tr>
                    <td>${o.id}</td>
                    <td>${o.client_name}</td>
                    <td>${o.restaurant_id}</td>
                    <td>
                        <select class="status-select" data-id="${o.id}">
                            <option value="pendente" ${o.status === 'pendente' ? 'selected' : ''}>Pendente</option>
                            <option value="em preparo" ${o.status === 'em preparo' ? 'selected' : ''}>Em Preparo</option>
                            <option value="entregue" ${o.status === 'entregue' ? 'selected' : ''}>Entregue</option>
                        </select>
                    </td>
                    <td>${new Date(o.created_at).toLocaleString()}</td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });

        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const orderId = e.target.dataset.id;
                const newStatus = e.target.value;
                await fetchWithAuth(`${API_URL}/orders/${orderId}/status`, {
                    method: 'PUT',
                    body: JSON.stringify({ status: newStatus })
                });
                // Poderia adicionar um feedback visual aqui
            });
        });
    }

    // Formulário de Restaurante
    function setupRestaurantForm() {
        const form = document.getElementById('restaurant-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('name').value;
            const address = document.getElementById('address').value;
            const category = document.getElementById('category').value;

            await fetchWithAuth(`${API_URL}/restaurants`, {
                method: 'POST',
                body: JSON.stringify({ name, address, category }),
            });

            form.reset();
            loadRestaurants();
        });
    }

    // Modal do Cardápio
    function setupMenuModal() {
        const modal = document.getElementById('menu-modal');
        const closeBtn = document.querySelector('.close-btn');
        const menuForm = document.getElementById('menu-form');

        closeBtn.onclick = () => modal.style.display = "none";
        window.onclick = (event) => {
            if (event.target == modal) {
                modal.style.display = "none";
            }
        }

        menuForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const restaurantId = document.getElementById('menu-restaurant-id').value;
            const name = document.getElementById('dish-name').value;
            const price = document.getElementById('dish-price').value;

            await fetchWithAuth(`${API_URL}/restaurants/${restaurantId}/menu`, {
                method: 'POST',
                body: JSON.stringify({ name, price })
            });
            
            menuForm.reset();
            loadMenuItems(restaurantId);
        });
    }

    async function openMenuModal(restaurantId, restaurantName) {
        const modal = document.getElementById('menu-modal');
        document.getElementById('menu-restaurant-name').textContent = `Cardápio de: ${restaurantName}`;
        document.getElementById('menu-restaurant-id').value = restaurantId;
        
        await loadMenuItems(restaurantId);
        
        modal.style.display = 'block';
    }

    async function loadMenuItems(restaurantId) {
        const response = await fetchWithAuth(`${API_URL}/restaurants/${restaurantId}/menu`);
        const items = await response.json();
        const list = document.getElementById('menu-items-list');
        list.innerHTML = '';

        if (items.length === 0) {
            list.innerHTML = '<li>Nenhum item no cardápio.</li>';
        } else {
            items.forEach(item => {
                list.innerHTML += `<li>${item.name} - R$ ${Number(item.price).toFixed(2)}</li>`;
            });
        }
    }
});