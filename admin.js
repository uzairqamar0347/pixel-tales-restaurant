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
    // ========= 3. PASSWORD PROTECTION =========
    // ... all your functions go here, unchanged ...
    // REPLACE this function
// ========= 3. PASSWORD PROTECTION =========
// ========= 3. PASSWORD PROTECTION =========
// ========= 3. PASSWORD PROTECTION =========
let audioUnlocked = false;

function primeAudio() {
    if (audioUnlocked) return;
    // This is the key: play() returns a Promise. We handle it to prevent console errors.
    // The browser now considers audio "unlocked" for this page.
    notificationSound.play().then(() => {
        notificationSound.pause();
        notificationSound.currentTime = 0;
        audioUnlocked = true;
        console.log("Audio context unlocked by user interaction.");
    }).catch(error => {
        // This catch block prevents a crash if the browser still blocks it.
        console.error("Audio priming failed:", error);
    });
}

function checkPassword() {
    const enteredPassword = passwordInput.value.trim();
    const correctPassword = ADMIN_PASSWORD.trim();

    if (enteredPassword === correctPassword) {
        passwordPrompt.style.display = 'none';
        adminPanel.classList.remove('hidden');
        initializeApp();
    } else {
        alert('Incorrect password.');
    }
}

// Attach the audio priming function to the very first click
passwordSubmit.addEventListener('click', () => {
    primeAudio();
    checkPassword();
});

passwordInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        primeAudio();
        checkPassword();
    }
});
// ========= 4. MAIN APP LOGIC =========
let allOrders = [];
let ordersChannel = null; // Keep track of our channel subscription

// --- Main Initializer ---
async function initializeApp() {
    console.log("Admin Panel Initialized.");
    await fetchInitialOrders();
    // Start listening AFTER the initial fetch is complete
    listenForChanges();
}

// --- Data Fetching ---
async function fetchInitialOrders() {
    console.log("Fetching initial orders...");
    const { data, error } = await db
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false }); 

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

// --- [REBUILT] Real-time Listener ---
function listenForChanges() {
    console.log("Attempting to subscribe to real-time changes...");

    // If we already have a subscription, remove it first to ensure a clean state
    if (ordersChannel) {
        db.removeChannel(ordersChannel);
    }

    // Create a new channel subscription
    ordersChannel = db.channel('public:orders')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'orders' }, // Listen for ALL changes (INSERT, UPDATE, DELETE)
            (payload) => {
                console.log('Change received!', payload);

                // --- Handle NEW orders ---
                if (payload.eventType === 'INSERT') {
                    console.log('New order received!', payload.new);
                    notificationSound.play().catch(e => console.error("Audio playback failed:", e));

                    const newOrder = payload.new;
                    allOrders.unshift(newOrder); // Add to the start of our local array
                    
                    const newOrderCard = renderOrderCard(newOrder);
                    newOrderCard.classList.add('bg-green-100');
                    const newTag = document.createElement('span');
                    newTag.className = 'bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full ml-2';
                    newTag.textContent = 'NEW';
                    newOrderCard.querySelector('h3').appendChild(newTag);
                    ordersFeed.insertBefore(newOrderCard, ordersFeed.firstChild);
                    setTimeout(() => { newOrderCard.classList.remove('bg-green-100'); }, 15000);
                }

                // --- Handle UPDATED orders ---
                if (payload.eventType === 'UPDATE') {
                    console.log('Order status updated!', payload.new);
                    const updatedOrder = payload.new;

                    const orderIndex = allOrders.findIndex(o => o.id === updatedOrder.id);
                    if (orderIndex > -1) {
                        allOrders[orderIndex] = updatedOrder;
                    }

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
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('Successfully subscribed to orders channel! Waiting for changes.');
            }
            if (status === 'CHANNEL_ERROR') {
                console.error('Real-time channel error. Retrying...');
            }
            if (status === 'TIMED_OUT') {
                console.warn('Real-time connection timed out. Retrying...');
            }
        });
}

// ... the rest of your UI Rendering Functions (renderOrderCard, showOrderDetails, etc.) and handleStatusUpdate remain the same.
// REPLACE this function
function generateStatusButtons(orderId, currentStatus) {
    const buttonContainer = getEl('status-buttons');
    if (!buttonContainer) return;
    let buttonsHTML = '';
    const buttonClasses = "w-full text-white font-semibold py-3 px-6 rounded-full transition duration-300";
    if (currentStatus === 'Pending') {
        buttonsHTML = `
            <button data-id="${orderId}" data-next-status="Preparing" class="status-btn bg-orange-500 hover:bg-orange-600 ${buttonClasses}">
                Accept & Prepare Order
            </button>
        `;
    } else if (currentStatus === 'Preparing') {
        buttonsHTML = `
            <button data-id="${orderId}" data-next-status="Completed" class="status-btn bg-blue-600 hover:bg-blue-700 ${buttonClasses}">
                Mark as Completed
            </button>
        `;
    } else if (currentStatus === 'Completed') {
        buttonsHTML = `
            <p class="text-center text-gray-500 font-semibold p-4 bg-gray-100 rounded-lg">This order is complete.</p>
        `;
    }
    buttonContainer.innerHTML = buttonsHTML;
    // Re-add event listeners
    document.querySelectorAll('.status-btn').forEach(button => {
        button.addEventListener('click', handleStatusUpdate);
    });
}
/**
 * [NEW] Handles the click of a status button, updating the order in Supabase.
 */
// REPLACE this whole function
// REPLACE this whole function
async function handleStatusUpdate(event) {
    const button = event.currentTarget;
    const orderId = Number(button.dataset.id);
    const nextStatus = button.dataset.nextStatus;

    button.textContent = 'Updating...';
    button.disabled = true;

    // --- The ONLY thing this function does is update the database ---
    const { error } = await db
        .from('orders')
        .update({ status: nextStatus })
        .eq('id', orderId);

    if (error) {
        console.error('Error updating status:', error);
        alert('Could not update order status. Please check permissions.');
        // If it fails, we need to find the original text to revert to.
        const originalText = (nextStatus === 'Preparing') ? 'Accept & Prepare Order' : 'Mark as Completed';
        button.textContent = originalText;
        button.disabled = false;
    } else {
        // --- SUCCESS ---
        console.log(`Order #${orderId} status updated to ${nextStatus}`);
        // On success, we do NOTHING to the UI here.
        // The real-time listener below will now handle ALL UI updates.
        // We can just show a temporary success message in the button area.
        button.parentElement.innerHTML = `<p class="text-green-600 font-semibold">Status updated!</p>`;
    }
}
/**
 * [NEW HELPER FUNCTION] Separates the database logic from the UI logic.
 * This function is responsible for updating the status and fetching the result.
 */
async function updateOrderStatus(orderId, newStatus) {
    // First, perform only the update
    const { error: updateError } = await db
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

    if (updateError) {
        // If the update fails, return the error
        return { data: null, error: updateError };
    }

    // If the update succeeds, fetch the updated row to get the fresh data
    const { data, error: selectError } = await db
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

    return { data, error: selectError };
}
// REPLACE this whole function
function listenForNewOrders() {
    console.log("Listening for new orders and updates...");

    const ordersChannel = db.channel('public:orders');

    ordersChannel
        // --- Listener for NEW orders ---
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
            console.log('New order received!', payload);
            
            notificationSound.play().catch(e => console.error("Audio playback failed:", e));

            const newOrder = payload.new;
            allOrders.unshift(newOrder); // Add to the start of our local array
            
            const newOrderCard = renderOrderCard(newOrder);
            newOrderCard.classList.add('bg-green-100');
            
            const newTag = document.createElement('span');
            newTag.className = 'bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full ml-2';
            newTag.textContent = 'NEW';
            newOrderCard.querySelector('h3').appendChild(newTag);

            ordersFeed.insertBefore(newOrderCard, ordersFeed.firstChild);

            setTimeout(() => { newOrderCard.classList.remove('bg-green-100'); }, 15000);
        })

        // --- Listener for UPDATED orders ---
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
            console.log('Order status updated!', payload);
            const updatedOrder = payload.new;

            // --- THE FIX IS IN THESE THREE STEPS ---

            // STEP 1: Update the order in our local 'allOrders' array. This is the most critical fix.
            const orderIndex = allOrders.findIndex(o => o.id === updatedOrder.id);
            if (orderIndex > -1) {
                allOrders[orderIndex] = updatedOrder;
                console.log('Local order state updated:', allOrders[orderIndex]);
            }

            // STEP 2: Update the visual card in the left-hand feed.
            const cardToUpdate = ordersFeed.querySelector(`[data-order-id="${updatedOrder.id}"]`);
            if (cardToUpdate) {
                cardToUpdate.classList.remove('status-pending', 'status-preparing', 'status-completed');
                cardToUpdate.classList.add(`status-${updatedOrder.status.toLowerCase()}`);
            }

            // STEP 3: Check if the updated order is currently being viewed. If so, refresh the details panel.
            const selectedViewHeader = detailsContent.querySelector('h2');
            const selectedOrderId = selectedViewHeader ? selectedViewHeader.textContent.replace('Order #', '') : null;
            
            if (selectedOrderId && Number(selectedOrderId) === updatedOrder.id) {
                console.log('Refreshing details view for the updated order.');
                showOrderDetails(updatedOrder);
            }
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('Successfully subscribed to orders channel!');
            }
        });
}
// --- UI Rendering Functions ---
function renderOrderCard(order) {
    const orderDate = new Date(order.created_at);
    const time = orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const card = document.createElement('div');
    card.className = `order-card status-${order.status.toLowerCase()} p-4 rounded-lg shadow cursor-pointer border-l-4`;
    card.dataset.orderId = order.id;    
    card.innerHTML = `
        <div class="flex justify-between items-center">
            <h3 class="font-bold text-lg">Order #${order.id}</h3>
            <span class="text-sm font-semibold">${time}</span>
        </div>
        <p class="text-gray-600">${order.customer_details.name}</p>
        <p class="text-gray-800 font-bold mt-2">PKR ${order.total_price.toFixed(2)}</p>
    `;    
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
    detailsContent.innerHTML = `
        <div class="border-b pb-4 mb-6">
            <h2 class="text-3xl font-bold">Order #${id}</h2>
            <p class="text-gray-500">Status: <span class="font-semibold text-black">${status}</span></p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
                <h3 class="text-xl font-semibold mb-2">Customer Details</h3>
                <p><strong>Name:</strong> ${customer.name}</p>
                <p><strong>Phone:</strong> ${customer.phone}</p>
                <p class="mt-2"><strong>Address:</strong><br>${customer.address}</p>
            </div>
            <div>
                <h3 class="text-xl font-semibold mb-2">Order Notes</h3>
                <p><strong>Comments:</strong> ${customer.comments || 'None'}</p>
                <p><strong>Cutlery:</strong> ${customer.wants_cutlery ? 'Yes' : 'No'}</p>
            </div>
        </div>
        <div>
            <h3 class="text-xl font-semibold mb-2 border-t pt-4">Items Ordered</h3>
            <ul class="space-y-2">
                ${items.map(item => `
                    <li class="flex justify-between items-center">
                        <span><strong>${item.quantity}x</strong> ${item.name}</span>
                        <span class="font-semibold">PKR ${(item.price * item.quantity).toFixed(2)}</span>
                    </li>
                `).join('')}
            </ul>
            <div class="flex justify-between font-bold text-2xl mt-4 pt-4 border-t">
                <span>Total:</span>
                <span>PKR ${total_price.toFixed(2)}</span>
            </div>
        </div>
        <div id="status-buttons" class="mt-8 pt-6 border-t">
            <!-- Status buttons will be generated here -->
        </div>
    `;
generateStatusButtons(id, status);
}
});