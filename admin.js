document.addEventListener('DOMContentLoaded', () => {

    // ========= 1. SETUP & CONFIGURATION =========
    const SUPABASE_URL = 'https://fiuckqvkzcbbufueomff.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpdWNrcXZremNiYnVmdWVvbWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxOTM0ODAsImV4cCI6MjA3Mzc2OTQ4MH0.ETayy6vn87DyfkpdnNCoO5GCnR2a88H9aqD5aGdoCZ4';
    const ADMIN_PASSWORD = '0000';
    const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // ========= 2. ELEMENT SELECTORS =========
    const getEl = (id) => document.getElementById(id);
    const queryAll = (selector) => document.querySelectorAll(selector);
    const passwordPrompt = getEl('password-prompt');
    const passwordInput = getEl('password-input');
    const passwordSubmit = getEl('password-submit');
    const adminPanel = getEl('admin-panel');
    const ordersFeed = getEl('orders-feed');
    const loadingOrders = getEl('loading-orders');
    const notificationSound = getEl('notification-sound');
    const noOrderSelected = getEl('no-order-selected');
    const detailsContent = getEl('details-content');
    const soundToggleButton = getEl('sound-toggle-btn');
    const soundOnIcon = getEl('sound-on-icon');
    const soundOffIcon = getEl('sound-off-icon');
    const soundStatusText = getEl('sound-status-text');
    const statNewOrders = getEl('stat-new-orders');
    const statInProgress = getEl('stat-in-progress');
    const statSalesToday = getEl('stat-sales-today');
    const logoutBtn = getEl('logout-btn');
    const navOrdersBtn = getEl('nav-orders-btn');
    const navMenuBtn = getEl('nav-menu-btn');
    const ordersPage = getEl('orders-page');
    const menuPage = getEl('menu-page');
    const menuManagementList = getEl('menu-management-list');
    const addNewItemBtn = getEl('add-new-item-btn');
    const itemModal = getEl('item-modal');
    const itemForm = getEl('item-form');
    const modalTitle = getEl('modal-title');
    const cancelItemBtn = getEl('cancel-item-btn');
    const itemIdInput = getEl('item-id-input');

    // ========= 3. GLOBAL STATE =========
    let allOrders = [];
    let allMenuItems = [];
    let soundEnabled = false;
    let ordersChannel = null;
    let activeFilter = 'active';

    // ========= 4. FUNCTION DEFINITIONS (DEFINED BEFORE USE) =========

    // --- PASSWORD & INITIALIZATION ---
    function checkPassword() {
        if (passwordInput.value.trim() === ADMIN_PASSWORD.trim()) {
            notificationSound.muted = false;
            notificationSound.play().catch(() => {});
            notificationSound.pause();
            notificationSound.currentTime = 0;
            passwordPrompt.style.display = 'none';
            adminPanel.classList.remove('hidden');
            initializeApp();
        } else {
            alert('Incorrect password.');
        }
    }
    
    async function initializeApp() {
        setupEventListeners();
        console.log("Admin Panel Initialized.");
        await fetchInitialOrders();
        listenForNewOrders();
        updateDashboardStats();
    }
    
    // --- DATA & REAL-TIME FUNCTIONS ---
    async function fetchInitialOrders() {
        const { data, error } = await db.from('orders').select('*').order('created_at', { ascending: false });
        if (error) { console.error("Error fetching orders:", error); loadingOrders.textContent = 'Could not fetch orders.'; return; }
        ordersFeed.innerHTML = '';
        if (data.length === 0) {
            ordersFeed.innerHTML = '<p class="text-gray-500">No orders found yet.</p>';
        } else {
            allOrders = data;
            allOrders.forEach(order => {
                const orderCard = renderOrderCard(order);
                ordersFeed.appendChild(orderCard);
            });
        }
        filterOrders();
    }

    function listenForNewOrders() {
        const allSubscriptions = db.getChannels();
        if (allSubscriptions.length > 0) { db.removeChannel(...allSubscriptions); }
        ordersChannel = db.channel('public:orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    if (soundEnabled) { notificationSound.play().catch(e => console.error("Audio playback failed:", e)); }
                    const newOrder = payload.new;
                    allOrders.unshift(newOrder);
                    const newOrderCard = renderOrderCard(newOrder);
                    newOrderCard.classList.add('new-order-animation', 'bg-green-100');
                    const newTag = document.createElement('span');
                    newTag.className = 'bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full ml-2';
                    newTag.textContent = 'NEW';
                    newOrderCard.querySelector('h3').appendChild(newTag);
                    ordersFeed.insertBefore(newOrderCard, ordersFeed.firstChild);
                    setTimeout(() => { newOrderCard.classList.remove('bg-green-100'); }, 15000);
                }
                if (payload.eventType === 'UPDATE') {
                    const updatedOrder = payload.new;
                    const orderIndex = allOrders.findIndex(o => o.id === updatedOrder.id);
                    if (orderIndex > -1) { allOrders[orderIndex] = updatedOrder; }
                    const cardToUpdate = ordersFeed.querySelector(`[data-order-id="${updatedOrder.id}"]`);
                    if (cardToUpdate) {
                        cardToUpdate.classList.remove('status-pending', 'status-preparing', 'status-completed');
                        cardToUpdate.classList.add(`status-${updatedOrder.status.toLowerCase()}`);
                    }
                    const selectedView = detailsContent.querySelector('h2');
                    if (selectedView && selectedView.textContent === `Order #${updatedOrder.id}`) {
                        showOrderDetails(updatedOrder);
                    }
                }
                filterOrders();
                updateDashboardStats();
            })
            .subscribe();
    }
    // ADD this new function
async function submitItemFormData() {
    const itemId = itemIdInput.value;
    const itemData = {
        name: getEl('item-name').value, description: getEl('item-description').value, category: getEl('item-category').value,
        image_url: getEl('item-image-url').value, price: getEl('item-price').value || null, original_price: getEl('item-original-price').value || null,
        price_small: getEl('price-small').value || null, price_medium: getEl('price-medium').value || null, price_large: getEl('price-large').value || null,
        price_xl: getEl('price-xl').value || null, is_featured: getEl('item-featured').checked,
    };
    
    let result;
    if (itemId) {
        result = await db.from('menu_items').update(itemData).eq('id', itemId);
    } else {
        result = await db.from('menu_items').insert([itemData]);
    }

    if (result.error) {
        console.error("Error saving item:", result.error);
        alert(`Failed to save item: ${result.error.message}`);
    } else {
        itemModal.classList.replace('flex', 'hidden');
        await fetchAndDisplayMenu();
    }
}
    // REPLACE this function
async function fetchAndDisplayMenu() {
    menuManagementList.innerHTML = '<p>Loading menu...</p>';
    const { data, error } = await db.from('menu_items').select('*').order('category').order('name');
    if (error) {
        menuManagementList.innerHTML = '<p class="text-red-500">Could not load menu.</p>';
        return;
    }
    allMenuItems = data;
    menuManagementList.innerHTML = '';
    allMenuItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex items-center justify-between py-4';
        const isChecked = item.is_available ? 'checked' : '';
        itemDiv.innerHTML = `<div class="flex items-center"><img src="${item.image_url}" alt="${item.name}" class="h-12 w-12 object-cover rounded-md mr-4"><div><p class="font-bold">${item.name}</p><p class="text-sm text-gray-500">${item.category}</p></div></div><div class="flex items-center space-x-4"><label class="flex items-center cursor-pointer"><div class="relative"><input type="checkbox" data-id="${item.id}" class="sr-only availability-toggle" ${isChecked}><div class="block bg-gray-600 w-14 h-8 rounded-full"></div><div class="dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition"></div></div></label><button data-id="${item.id}" class="edit-item-btn text-blue-500 hover:text-blue-700">Edit</button></div>`;
        menuManagementList.appendChild(itemDiv);
    });
    // NOTE: We have removed all event listener attachments from this function.
}
    async function openItemModal(itemId = null) {
    itemForm.reset();
    itemIdInput.value = '';
    const categorySelect = getEl('item-category');
    const { data: categories } = await db.from('categories').select('name');
    if (categories) {
        categorySelect.innerHTML = categories.map(cat => `<option value="${cat.name.toLowerCase().replace(/\s+/g, '-')}">${cat.name}</option>`).join('');
    }
    if (itemId) {
        modalTitle.textContent = 'Edit Menu Item';
        const itemToEdit = allMenuItems.find(item => item.id == itemId); // [THE FIX] Removed duplicate
        if (!itemToEdit) { alert("Item not found!"); return; }
        itemIdInput.value = itemToEdit.id;
        getEl('item-name').value = itemToEdit.name;
        getEl('item-description').value = itemToEdit.description || '';
        getEl('item-category').value = itemToEdit.category;
        getEl('item-image-url').value = itemToEdit.image_url;
        getEl('item-price').value = itemToEdit.price;
        getEl('item-original-price').value = itemToEdit.original_price;
        getEl('price-small').value = itemToEdit.price_small;
        getEl('price-medium').value = itemToEdit.price_medium;
        getEl('price-large').value = itemToEdit.price_large;
        getEl('price-xl').value = itemToEdit.price_xl;
        getEl('item-featured').checked = itemToEdit.is_featured;
    } else {
        modalTitle.textContent = 'Add New Item';
    }
    itemModal.classList.replace('hidden', 'flex');
}    
        async function handleStatusUpdate(event) {
        const button = event.currentTarget;
        const orderId = Number(button.dataset.id);
        const nextStatus = button.dataset.nextStatus;
        const originalButtonHTML = button.innerHTML;
        button.innerHTML = 'Updating...';
        button.disabled = true;
        const { error } = await db.from('orders').update({ status: nextStatus }).eq('id', orderId);
        if (error) {
            alert(`Error: ${error.message}`);
            button.innerHTML = originalButtonHTML;
            button.disabled = false;
        } else {
            console.log(`Order #${orderId} status updated to ${nextStatus}`);
            const updatedOrder = allOrders.find(o => o.id === orderId);
            if (updatedOrder) {
                updatedOrder.status = nextStatus;
                showOrderDetails(updatedOrder);
            }
        }
    }
// ADD THIS FUNCTION
async function handleAvailabilityToggle(toggle) { // Now accepts the element directly
    const itemId = toggle.dataset.id;
    const isAvailable = toggle.checked;
    toggle.disabled = true;
    const { error } = await db.from('menu_items').update({ is_available: isAvailable }).eq('id', itemId);
    if (error) {
        alert("Could not update item availability.");
        toggle.checked = !isAvailable;
    } else {
        showToastNotification("Availability updated!", 'success');
    }
    toggle.disabled = false;
}
// ADD THIS FUNCTION
async function handleFormSubmit(event) {
    event.preventDefault();
    const saveButton = getEl('save-item-btn');
    saveButton.textContent = 'Saving...';
    saveButton.disabled = true;

    const itemId = itemIdInput.value;
    const itemData = {
        name: getEl('item-name').value, description: getEl('item-description').value, category: getEl('item-category').value,
        image_url: getEl('item-image-url').value, price: getEl('item-price').value || null, original_price: getEl('item-original-price').value || null,
        price_small: getEl('price-small').value || null, price_medium: getEl('price-medium').value || null, price_large: getEl('price-large').value || null,
        price_xl: getEl('price-xl').value || null, is_featured: getEl('item-featured').checked,
    };
    
    let result;
    if (itemId) {
        result = await db.from('menu_items').update(itemData).eq('id', itemId);
    } else {
        result = await db.from('menu_items').insert([itemData]);
    }

    if (result.error) {
        console.error("Error saving item:", result.error);
        // --- [THE FIX] Use the toast for errors ---
        showToastNotification(`Failed to save: ${result.error.message}`, 'error');
    } else {
        itemModal.classList.replace('flex', 'hidden');
        
        // --- [THE FIX] Use the toast for success ---
        const message = itemId ? "Item updated successfully!" : "New item added successfully!";
        showToastNotification(message, 'success');
        
        await fetchAndDisplayMenu(); 
    }

    saveButton.textContent = 'Save Item';
    saveButton.disabled = false;
}
    async function updateDashboardStats() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();
        const { data: todaysOrders, error } = await db.from('orders').select('status, total_price').gte('created_at', todayISO);
        if (error) { console.error("Error fetching dashboard data:", error); return; }
        let newOrdersCount = 0;
        let inProgressCount = 0;
        let totalSales = 0;
        todaysOrders.forEach(order => {
            if (order.status === 'Pending') newOrdersCount++;
            if (order.status === 'Preparing') inProgressCount++;
            totalSales += order.total_price;
        });
        statNewOrders.textContent = newOrdersCount;
        statInProgress.textContent = inProgressCount;
        statSalesToday.textContent = `PKR ${totalSales.toFixed(2)}`;
    }async function submitItemFormData() {
    const itemId = itemIdInput.value;
    const itemData = { /* ... your itemData object ... */ };
    
    let result;
    if (itemId) {
        result = await db.from('menu_items').update(itemData).eq('id', itemId);
    } else {
        result = await db.from('menu_items').insert([itemData]);
    }

    if (result.error) {
        console.error("Error saving item:", result.error);
        alert(`Failed to save item: ${result.error.message}`);
    } else {
        itemModal.classList.replace('flex', 'hidden');
        const message = itemId ? "Item updated successfully!" : "New item added successfully!";
        alert(message); // Use a simple alert for confirmation
        await fetchAndDisplayMenu();
    }
}
    // --- UI RENDERING FUNCTIONS ---
function showToastNotification(message, type = 'success') {
    const div = document.createElement('div');
    const isError = type === 'error';
    const bgColor = isError ? 'bg-red-600' : 'bg-green-600';
    const icon = isError 
        ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>`;
        
    div.className = `fixed bottom-5 right-5 ${bgColor} text-white px-5 py-3 rounded-lg shadow-xl flex items-center space-x-3 opacity-0 transition-all duration-500 transform translate-y-3 z-[150]`;
    div.innerHTML = `${icon}<span>${message}</span>`;
    
    document.body.appendChild(div);
    
    // Animate in
    setTimeout(() => { 
        div.style.opacity = '1'; 
        div.style.transform = 'translateY(0)'; 
    }, 10);
    
    // Animate out and remove
    setTimeout(() => { 
        div.style.opacity = '0'; 
        div.style.transform = 'translateY(3px)'; 
        setTimeout(() => div.remove(), 500); 
    }, 3000);
}
    function renderOrderCard(order) {
        const orderDate = new Date(order.created_at);
        const time = orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const card = document.createElement('div');
        card.className = `order-card status-${order.status.toLowerCase()} p-4 rounded-lg shadow cursor-pointer border-l-4`;
        card.dataset.orderId = order.id;
        card.innerHTML = `<div class="flex justify-between items-center"><h3 class="font-bold text-lg">Order #${order.id}</h3><span class="text-sm font-semibold">${time}</span></div><p class="text-gray-600">${order.customer_details.name}</p><p class="text-gray-800 font-bold mt-2">PKR ${order.total_price.toFixed(2)}</p>`;
        card.addEventListener('click', () => {
            const clickedOrder = allOrders.find(o => o.id === order.id);
            if (clickedOrder) {
                showOrderDetails(clickedOrder);
                document.querySelectorAll('.order-card.selected').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            }
        });
        return card;
    }
    // REPLACE this function
function filterOrders() {
        const orderCards = document.querySelectorAll('.order-card');
    orderCards.forEach(card => {
        const orderId = Number(card.dataset.orderId);
        const order = allOrders.find(o => o.id === orderId);
        if (!order) return;
        // --- [NEW LOGIC] ---
        // Handle the new "active" filter
        if (activeFilter === 'active') {
            if (order.status === 'Pending' || order.status === 'Preparing') {
                card.style.display = 'block';
            } else {
                card.style.display = 'none'; // Hide completed orders
            }
        } else {
            // Handle specific status filters (Pending, Preparing, Completed)
            if (order.status === activeFilter) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        }
    });
    // Update the visual state of the filter buttons
        const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        if (button.dataset.status === activeFilter) {
            button.classList.remove('bg-gray-200', 'text-gray-700');
            button.classList.add('bg-blue-600', 'text-white');
        } else {
            button.classList.remove('bg-blue-600', 'text-white');
            button.classList.add('bg-gray-200', 'text-gray-700');
        }
    });
}
// ADD this new function to the UI RENDERING section
function showPage(pageName) {
    // Hide all pages
    ordersPage.classList.add('hidden');
    menuPage.classList.add('hidden');
    // Deactivate all nav buttons
    navOrdersBtn.classList.remove('active', 'bg-white', 'text-blue-600', 'shadow');
    navMenuBtn.classList.remove('active', 'bg-white', 'text-blue-600', 'shadow');
    // Show the selected page and activate its button
    if (pageName === 'orders') {
        ordersPage.classList.remove('hidden');
        navOrdersBtn.classList.add('active', 'bg-white', 'text-blue-600', 'shadow');
    } else if (pageName === 'menu') {
        menuPage.classList.remove('hidden');
        navMenuBtn.classList.add('active', 'bg-white', 'text-blue-600', 'shadow');
        // Fetch the menu list when the page is shown for the first time
        if (menuManagementList.children.length <= 1) { // Checks if it's empty/has placeholder
            fetchAndDisplayMenu();
        }
    }
}
    function showOrderDetails(order) {
        noOrderSelected.style.display = 'none';
        detailsContent.classList.remove('hidden');
        const { customer_details: customer, items, total_price, status, id } = order;
        detailsContent.innerHTML = `<div class="border-b pb-4 mb-6"><h2 class="text-3xl font-bold">Order #${id}</h2><p class="text-gray-500">Status: <span class="font-semibold text-black">${status}</span></p></div><div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6"><div><h3 class="text-xl font-semibold mb-2">Customer Details</h3><p><strong>Name:</strong> ${customer.name}</p><p><strong>Phone:</strong> ${customer.phone}</p><p class="mt-2"><strong>Address:</strong><br>${customer.address}</p></div><div><h3 class="text-xl font-semibold mb-2">Order Notes</h3><p><strong>Comments:</strong> ${customer.comments || 'None'}</p><p><strong>Cutlery:</strong> ${customer.wants_cutlery ? 'Yes' : 'No'}</p></div></div><div><h3 class="text-xl font-semibold mb-2 border-t pt-4">Items Ordered</h3><ul class="space-y-2">${items.map(item => `<li class="flex justify-between items-center"><span><strong>${item.quantity}x</strong> ${item.name}</span><span class="font-semibold">PKR ${(item.price * item.quantity).toFixed(2)}</span></li>`).join('')}</ul><div class="flex justify-between font-bold text-2xl mt-4 pt-4 border-t"><span>Total:</span><span>PKR ${total_price.toFixed(2)}</span></div></div><div id="status-buttons" class="mt-8 pt-6 border-t"></div>`;
        generateStatusButtons(id, status);
    }
    function generateStatusButtons(orderId, currentStatus) {
        const buttonContainer = getEl('status-buttons');
        if (!buttonContainer) return;
        let buttonsHTML = '';
        const buttonClasses = "w-full text-white font-semibold py-3 px-6 rounded-full transition duration-300";
        if (currentStatus === 'Pending') {
            buttonsHTML = `<button data-id="${orderId}" data-next-status="Preparing" class="status-btn bg-orange-500 hover:bg-orange-600 ${buttonClasses}">Accept & Prepare Order</button>`;
        } else if (currentStatus === 'Preparing') {
            buttonsHTML = `<button data-id="${orderId}" data-next-status="Completed" class="status-btn bg-blue-600 hover:bg-blue-700 ${buttonClasses}">Mark as Completed</button>`;
        } else if (currentStatus === 'Completed') {
            buttonsHTML = `<p class="text-center text-gray-500 font-semibold p-4 bg-gray-100 rounded-lg">This order is complete.</p>`;
        }
        buttonContainer.innerHTML = buttonsHTML;
        document.querySelectorAll('.status-btn').forEach(button => {
            button.addEventListener('click', handleStatusUpdate);
        });
    }
    function handleSoundToggle() {
        soundEnabled = !soundEnabled;
        if (soundEnabled) {
            soundToggleButton.classList.replace('bg-red-500', 'bg-green-500');
            soundOnIcon.classList.remove('hidden');
            soundOffIcon.classList.add('hidden');
            soundStatusText.textContent = 'Sounds On';
        } else {
            soundToggleButton.classList.replace('bg-green-500', 'bg-red-500');
            soundOffIcon.classList.remove('hidden');
            soundOnIcon.classList.add('hidden');
            soundStatusText.textContent = 'Sounds Off';
        }
    }
     // ========= 5. EVENT LISTENERS SETUP =========
    function setupEventListeners() {
    // --- Static Page Listeners (Setup once) ---
    passwordSubmit.addEventListener('click', checkPassword);
    passwordInput.addEventListener('keyup', (event) => { if (event.key === 'Enter') { checkPassword(); } });
    soundToggleButton.addEventListener('click', handleSoundToggle);
    if (logoutBtn) { logoutBtn.addEventListener('click', () => { location.reload(); }); }
    const filterButtons = queryAll('.filter-btn');
    filterButtons.forEach(button => button.addEventListener('click', () => { activeFilter = button.dataset.status; filterOrders(); }));
    if (navOrdersBtn) navOrdersBtn.addEventListener('click', () => showPage('orders'));
    if (navMenuBtn) navMenuBtn.addEventListener('click', () => showPage('menu'));
    if (addNewItemBtn) addNewItemBtn.addEventListener('click', () => openItemModal());
    if (itemForm) itemForm.addEventListener('submit', handleFormSubmit);
    if (cancelItemBtn) cancelItemBtn.addEventListener('click', () => itemModal.classList.replace('flex', 'hidden'));

    // --- [THE FIX: EVENT DELEGATION FOR THE DYNAMIC LIST] ---
    // Add ONE smart listener to the parent container.
    menuManagementList.addEventListener('click', (event) => {
        // Check if an "Edit" button was the target of the click
        const editButton = event.target.closest('.edit-item-btn');
        if (editButton) {
            const itemId = editButton.dataset.id;
            openItemModal(itemId);
        }
    });

    menuManagementList.addEventListener('change', (event) => {
        // Check if an "Availability Toggle" was the target of the change
        const availabilityToggle = event.target.closest('.availability-toggle');
        if (availabilityToggle) {
            // We pass the actual element to the handler
            handleAvailabilityToggle(availabilityToggle);
        }
    });
}
    // --- Let's go! ---
    setupEventListeners();
});