document.addEventListener('DOMContentLoaded', () => {

    // ========= 1. SETUP & CONFIGURATION =========
    const SUPABASE_URL = 'https://fiuckqvkzcbbufueomff.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpdWNrcXZremNiYnVmdWVvbWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxOTM0ODAsImV4cCI6MjA3Mzc2OTQ4MH0.ETayy6vn87DyfkpdnNCoO5GCnR2a88H9aqD5aGdoCZ4';
    const ADMIN_PASSWORD = 'UZAIRQAMAR0347@';
    const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // ========= 2. ELEMENT SELECTORS =========
    const getEl = (id) => document.getElementById(id);
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

    // ========= 3. GLOBAL STATE =========
    let allOrders = [];
    let soundEnabled = false;
    let ordersChannel = null;

    // ========= 4. FUNCTION DEFINITIONS (DEFINED BEFORE USE) =========

    // --- PASSWORD & INITIALIZATION ---
    function checkPassword() {
        if (passwordInput.value.trim() === ADMIN_PASSWORD.trim()) {
            // A direct user click is happening, so this is the best time to "unlock" audio.
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
    }
    
    // --- DATA & REAL-TIME FUNCTIONS ---
    async function fetchInitialOrders() {
        console.log("Fetching initial orders...");
        const { data, error } = await db.from('orders').select('*').order('created_at', { ascending: false });
        if (error) {
            console.error("Error fetching orders:", error);
            loadingOrders.textContent = 'Could not fetch orders.';
            return;
        }
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
    }

    function listenForNewOrders() {
        console.log("Subscribing to real-time changes...");
        if (ordersChannel) { db.removeChannel(ordersChannel); }

        ordersChannel = db.channel('public:orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                console.log('Change received!', payload);
                if (payload.eventType === 'INSERT') {
                    if (soundEnabled) {
                        notificationSound.play().catch(e => console.error("Audio playback failed:", e));
                    }
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
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') { console.log('Successfully subscribed to orders channel!'); }
            });
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
            // The real-time listener will now handle the UI update.
            // For instant feedback, we can manually update the details view.
            const updatedOrder = allOrders.find(o => o.id === orderId);
            if (updatedOrder) {
                updatedOrder.status = nextStatus;
                showOrderDetails(updatedOrder);
            }
        }
    }

    // --- UI RENDERING FUNCTIONS ---
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
        passwordSubmit.addEventListener('click', checkPassword);
        passwordInput.addEventListener('keyup', (event) => { if (event.key === 'Enter') { checkPassword(); } });
        soundToggleButton.addEventListener('click', handleSoundToggle);
    }

    // --- Let's go! ---
    setupEventListeners();

});