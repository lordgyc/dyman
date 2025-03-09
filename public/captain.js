
const { ipcRenderer } = require('electron');

// Add showNotification function at the top
function showNotification(message, type = 'info') {
    // Remove any existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create new notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    // Add to document
    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Place this function at the top of the file, outside any event listeners

function completeOrder(orderId) {
    fetch(`/complete-order/${orderId}`, { method: 'POST' })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('Order completed successfully', 'success'); // Non-blocking
            // Delay update to ensure proper DOM state
            setTimeout(() => {
                updateLiveOrders();
                reattachEventListeners(); // Explicitly reattach listeners
            }, 100);
        } else {
            showNotification('Failed to complete order: ' + data.message, 'error');
        }
    })
    .catch(() => {
        // Removed unused error parameter
        showNotification('An error occurred while completing the order', 'error');
    });
}
document.addEventListener('DOMContentLoaded', () => {


    // Debug element
    const debugElement = document.getElementById('debug');
    if (debugElement) {
        debugElement.textContent = 'captain.js loaded, DOM ready';
    } else {
        console.warn('Debug element not found');
    }

    function updateDebug(message) {
        if (debugElement) {
            debugElement.textContent += '\n' + message;
        } else {
            console.log('Debug:', message);
        }
    }

    function fetchData(url, elementId) {
        updateDebug(`Fetching data from ${url}`);
        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
    
                updateDebug(`Data received from ${url}`);
                const element = document.getElementById(elementId);
                if (!element) {
                    console.error(`Element with id "${elementId}" not found`);
                    updateDebug(`Error: Element with id "${elementId}" not found`);
                    return;
                }
                // Process and display the data
                element.innerHTML = ''; // Clear existing content
                const items = data.waiters || data.chefs || data.categories || [];
                items.forEach(item => {
                    const button = document.createElement('button');
                    button.textContent = item.name;
                    if (elementId === 'waiterList') {
                        button.addEventListener('click', () => selectWaiter(item));
                    } else if (elementId === 'chefList') {
                        button.addEventListener('click', () => selectChef(item));
                    } else if (elementId === 'categoryList') {

                        button.addEventListener('click', () => {
                            switchTab('subcategory');
                            loadSubcategoriesOrMeals(item.id);
                            currentCategory = { id: item.id, name: item.name }; // Assume categoryName is returned
                            currentSubcategory = null;
                      
                        });
                    }
                    element.appendChild(button);
                });
                updateDebug(`Data displayed in ${elementId}`);
            })
            .catch(error => {
                console.error(`Error fetching data from ${url}:`, error);
                updateDebug(`Error fetching data from ${url}: ${error.message}`);
            });
    }

    function selectWaiter(waiter) {
        const selectedWaiter = document.getElementById('selectedWaiter');
        const currentWaiter = document.getElementById('currentWaiter');
        if (selectedWaiter) {
            selectedWaiter.textContent = `Selected Waiter: ${waiter.name}`;
            selectedWaiter.dataset.waiterId = waiter.id;
        }
        if (currentWaiter) {
            currentWaiter.textContent = `Current Waiter: ${waiter.name}`;
        }
        switchTab('chef'); // Change to switch to the chefs tab
    }

    function selectChef(chef) {
        const selectedChef = document.getElementById('selectedChef');
        const currentChef = document.getElementById('currentChef');
        if (selectedChef) {
            selectedChef.textContent = `Selected Chef: ${chef.name}`;
            selectedChef.dataset.chefId = chef.id;
        }
        if (currentChef) {
            currentChef.textContent = `Current Chef: ${chef.name}`;
        }
        switchTab('meal'); // Remains the same to switch to the meals tab
    }
    function selectGuest(guest) {
        const selectedGuest = document.getElementById('selectedGuest');
        const currentGuest = document.getElementById('selected-guest');
        if (selectedGuest) {
            selectedGuest.textContent = `Selected Guest: ${guest.name}`;
            selectedGuest.dataset.guestId = guest.id;
        }
        if (currentGuest) {
            currentGuest.textContent = `Current Guest: ${guest.name}`;
        }
        switchTab('meal'); // Remains the same to switch to the meals tab
    }

    function createTreeLine(startElement, endElement, isVertical = false) {
        if (!startElement || !endElement) {
            console.error('One or both elements are null:', startElement, endElement);
            return;
        }

        const line = document.createElement('div');
        line.className = isVertical ? 'tree-line tree-vertical' : 'tree-line tree-horizontal';
        document.body.appendChild(line);

        const startRect = startElement.getBoundingClientRect();
        const endRect = endElement.getBoundingClientRect();

        if (isVertical) {
            const startX = startRect.left + startRect.width / 2;
            const startY = startRect.bottom;
            const endY = endRect.top;

            line.style.left = `${startX}px`;
            line.style.top = `${startY}px`;
            line.style.height = `${endY - startY}px`;
        } else {
            const startX = startRect.right;
            const startY = startRect.top + startRect.height / 2;
            const endX = endRect.left;

            line.style.left = `${startX}px`;
            line.style.top = `${startY}px`;
            line.style.width = `${endX - startX}px`;
        }
    }

    let currentCategory = null;
    let currentSubcategory = null;
    function fetchGuests() {
      fetch('/guests')
        .then(response => response.json())
        .then(data => {
          const guestList = document.getElementById('guestList');
          guestList.innerHTML = '';
    
          data.forEach(guest => {
            const guestButton = document.createElement('button');
            guestButton.textContent = guest.name;
            guestButton.className = 'guest-button';
            guestList.appendChild(guestButton);
    
            guestButton.addEventListener('click', () => {
              selectGuest(guest);
            });
          });
        })
        .catch(error => console.error('Error fetching guests:', error));
    }
 


    function loadSubcategoriesOrMeals(categoryId) {

        fetch(`/subcategories/${categoryId}`)
            .then(response => response.json())
            .then(data => {

                const subcategoryList = document.getElementById('subcategoryList');
                subcategoryList.innerHTML = '';
       
                if (data.subcategories.length > 0) {// Switch to subcategory tab
                    data.subcategories.forEach(subcategory => {
                        const button = document.createElement('button');
                        button.textContent = subcategory.name;
                        button.dataset.id = subcategory.id;
                        button.addEventListener('click', () => {
                            loadMeals(categoryId, subcategory.id);
                            currentSubcategory = { id: subcategory.id, name: subcategory.name };
                    
                            switchTab('mealSelector'); // Switch to meal selector tab
                        });
                        subcategoryList.appendChild(button);
                    });
                } else {
                    loadMeals(categoryId);
                    switchTab('mealSelector'); // Switch to meal selector tab if no subcategories
                }
            })
            .catch(error => console.error('Error loading subcategories:', error));
    }

    function loadMeals(categoryId, subcategoryId = null) {
        let url = `/meals/${categoryId}`;
        if (subcategoryId) url += `/${subcategoryId}`;
        fetch(url)
            .then(response => response.json())
            .then(data => {
                const mealList = document.getElementById('mealList');
                mealList.innerHTML = '';
                data.meals.forEach(meal => {
                    const button = document.createElement('button');
                    button.textContent = `${meal.name} - $${meal.price.toFixed(2)}`;
                    button.addEventListener('click', () => addMealToOrder(meal));
                    mealList.appendChild(button);
                });
            })
            .catch(error => console.error('Error loading meals:', error));
    }

    function addMealToOrder(meal) {
        const orderList = document.getElementById('orderList');
        let existingItem = Array.from(orderList.children).find(li => li.dataset.mealId === meal.id.toString());

        if (existingItem) {
            // Update the quantity if the meal already exists
            let quantity = parseInt(existingItem.dataset.quantity, 10) + 1;
            existingItem.dataset.quantity = quantity;
            existingItem.dataset.mealId = meal.id;
            updateOrderItemDisplay(existingItem, meal, quantity, meal.id);
        } else {
            // Add new meal to the order list
            const listItem = document.createElement('li');
            listItem.dataset.mealId = meal.id;
            listItem.dataset.quantity = 1;
            updateOrderItemDisplay(listItem, meal, 1,meal.id);
            orderList.appendChild(listItem);
        }

        updateOrderTotal(meal.price);// Clear breadcrumb after adding a meal
    }

    function updateOrderItemDisplay(listItem, meal, quantity, mealId) {
        console.log(mealId)
        listItem.innerHTML = `
            ${meal.name} - $${meal.price.toFixed(2)} x ${quantity}
            <button class="delete-meal-btn" data-meal-id="${mealId}">Delete</button>
        `;
        listItem.querySelector('.delete-meal-btn').addEventListener('click', () => deleteMealFromOrder(mealId));
    } 
    let mealToDelete = null;

    function deleteMealFromOrder(mealId) {
        mealToDelete = mealId;
    
        if (isUpdateMode) {
            // Show the admin credentials modal for verification
            document.getElementById('adminCredentialsDialog').style.display = 'block';
        } else {
            // Proceed with deletion directly if not in update mode
            deleteMealDirectly(mealId);
        }
    }
    
    function deleteMealDirectly(mealId) {
        console.log(mealId)
        const orderList = document.getElementById('orderList');
        const listItem = Array.from(orderList.children).find(li => li.dataset.mealId === mealId.toString());
    
        if (listItem) {
            const quantity = parseInt(listItem.dataset.quantity, 10);
            const price = parseFloat(listItem.textContent.split('$')[1].split('x')[0].trim());
    
            if (quantity > 1) {
                // Decrease quantity by 1
                listItem.dataset.quantity = quantity - 1;
                const meal = { id: mealId, name: listItem.textContent.split('-')[0].trim(), price: price };
                updateOrderItemDisplay(listItem, meal, quantity - 1, mealId);
            } else {
                // Remove the item if quantity is 1
                orderList.removeChild(listItem);
            }
    
            updateOrderTotal(-price);
        }
    }
    
function verifyAndDeleteMeal() {
    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;

    fetch('/verify-admin-and-delete-meal', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mealId: mealToDelete, username, password }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('Meal deleted successfully', 'success');
            const orderList = document.getElementById('orderList');
            const listItem = Array.from(orderList.children).find(li => li.dataset.mealId === mealToDelete.toString());
            if (listItem) {
                orderList.removeChild(listItem);
                updateOrderTotal(-parseFloat(listItem.textContent.split('$')[1].split('x')[0].trim()));
            }
        } else {
            showNotification('Failed to delete meal: ' + data.message, 'error');
        }
        document.getElementById('adminCredentialsDialog').style.display = 'none';
        mealToDelete = null;
    })
    .catch(error => {
        showNotification('Error deleting meal: ' + error.message, 'error');
        document.getElementById('adminCredentialsDialog').style.display = 'none';
        mealToDelete = null;
    });
}


function cancelAdminCredentials() {
    document.getElementById('adminCredentialsDialog').style.display = 'none';
    mealToDelete = null;
}

document.getElementById('submitAdminCredentials').addEventListener('click', verifyAndDeleteMeal);
document.getElementById('cancelAdminCredentials').addEventListener('click', cancelAdminCredentials);

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('submitAdminCredentials').addEventListener('click', verifyAndDeleteMeal);
    document.getElementById('cancelAdminCredentials').addEventListener('click', cancelAdminCredentials);
});


    function updateOrderTotal(priceChange) {
        const orderTotal = document.getElementById('orderTotal');
        const currentTotal = parseFloat(orderTotal.textContent.replace('$', ''));
        const newTotal = Math.max(currentTotal + priceChange, 0).toFixed(2);
        orderTotal.textContent = `$${newTotal}`;
    }

    // Add this function for tab switching
    function switchTab(tabId) {
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        document.querySelectorAll('.tab-button').forEach(button => button.classList.remove('active'));
        
        const tabContent = document.getElementById(tabId + 'Content');
        const tabButton = document.getElementById(tabId + 'Tab');
        if (tabContent && tabButton) {
            tabContent.classList.add('active');
            tabButton.classList.add('active');
        } else {
            console.error(`Tab content or button not found for ID: ${tabId}`);
        }


      
    }

    // Add event listeners for tab buttons
    document.getElementById('waiterTab').addEventListener('click', () => {
        switchTab('waiter');
 // Clear breadcrumb when waiter tab is clicked
    });
    document.getElementById('chefTab').addEventListener('click', () => {
        switchTab('chef');
 // Clear breadcrumb when chef tab is clicked
    });
    document.getElementById('mealTab').addEventListener('click', () => {
        switchTab('meal');

    });
    document.getElementById('liveOrdersTab').addEventListener('click', () => {
        switchTab('liveOrders');
        loadLiveOrders();
    });
    document.getElementById('completedOrdersTab').addEventListener('click', () => {
        switchTab('completedOrders');
        loadCompletedOrders();
    });

    fetchData('/waiters', 'waiterList');
    fetchData('/chefs', 'chefList');
    fetchData('/categories', 'categoryList');

    // Add these new functions
    function addOrder() {
        const selectedWaiter = document.getElementById('selectedWaiter');
        const selectedChef = document.getElementById('selectedChef');
        const orderList = document.getElementById('orderList');
        const orderTotal = document.getElementById('orderTotal');

        if (!selectedWaiter || !selectedChef || !orderList || !orderTotal) {
            showNotification('Required elements for adding order not found', 'error');
            return;
        }

        const waiterId = selectedWaiter.dataset.waiterId;
        const waiterName = selectedWaiter.textContent.replace('Selected Waiter: ', '');
        const chefId = selectedChef.dataset.chefId;
        const chefName = selectedChef.textContent.replace('Selected Chef: ', '');
        const orderItems = Array.from(orderList.children).map(li => {
            const [name, price] = li.textContent.split(' - $');
            return {
                meal_id: li.dataset.mealId,
                name: name,
                price: parseFloat(price),
                quantity: parseInt(li.dataset.quantity, 10) // Ensure quantity is captured correctly
            };
        });

        const total = parseFloat(orderTotal.textContent);

        fetch('/add-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                waiter_id: waiterId,
                waiter_name: waiterName,
                chef_id: chefId,
                chef_name: chefName,
                items: orderItems,
                total: total
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('Order added successfully', 'success');
                clearOrder();
                loadLiveOrders();
            } else {
                showNotification('Failed to add order: ' + data.message, 'error');
            }
        })
        .catch(error => {
            showNotification('Error adding order: ' + error.message, 'error');
        });
    }

    function clearOrder() {
        document.getElementById('orderList').innerHTML = '';
        document.getElementById('orderTotal').textContent = '$0.00';
        document.getElementById('currentWaiter').textContent = 'No waiter selected';
        document.getElementById('currentChef').textContent = 'No chef selected';
        document.getElementById('selected-guest').textContent = 'No guest selected';
        const selectedWaiter = document.getElementById('selectedWaiter');
        const selectedChef = document.getElementById('selectedChef');
        if (selectedWaiter) selectedWaiter.textContent = '';
        if (selectedChef) selectedChef.textContent = '';
        location.reload(); // Refresh the page
    }

    // Helper function to create and style order items
    function createOrderItem(order) {
        const orderDiv = document.createElement('div');
        orderDiv.className = 'order-item';
        orderDiv.id = `order-${order.id}`;
    
        // Add click handler for update mode
        orderDiv.addEventListener('click', () => {
            if (isUpdateMode) {
                selectOrderForUpdate(order);
            }
        });
    
        // Create header
        const headerDiv = document.createElement('div');
        headerDiv.className = 'order-item-header';
    
        const guestPara = document.createElement('p');
        if (order.guest_name) {
            guestPara.innerHTML = `<span class="static-text">Guest:</span> ${order.guest_name}`;
            headerDiv.appendChild(guestPara);
        }
    
        headerDiv.innerHTML += `
            <p><span class="static-text">Waiter:</span> ${order.waiter_name || 'Unknown'}</p>
            <p><span class="static-text">Chef:</span> ${order.chef_name || 'Unknown'}</p>
            <p><span class="static-text">Time:</span> ${order.timestamp ? new Date(order.timestamp).toLocaleString() : 'N/A'}</p>
            <p><span class="static-text">Elapsed Time:</span> <span class="elapsed-time">Calculating...</span></p>
            <p><span class="static-text">Total:</span> $${order.total != null ? order.total.toFixed(2) : 'N/A'}</p>
        `;
        orderDiv.appendChild(headerDiv);
    
        // Create meals list
        const mealsDiv = document.createElement('div');
        mealsDiv.innerHTML = `<p><span class="static-text">Meals:</span></p>`;
        const mealsList = document.createElement('ul');
    
        if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
                const li = document.createElement('li');
                const itemPrice = item.price != null ? item.price.toFixed(2) : 'N/A';
                li.innerHTML = `
                    <input type="checkbox" id="meal-${order.id}-${item.meal_id}"
                           class="meal-checkbox"
                           data-order-id="${order.id}"
                           data-meal-id="${item.meal_id}"
                           ${item.is_completed ? 'checked' : ''}>
                    <label for="meal-${order.id}-${item.meal_id}">
                        <span class="static-text">Meal:</span> ${item.name || 'Unknown item'} - $${itemPrice} x ${item.quantity || 1}
                    </label>
                    <button class="delete-meal-btn"
                            data-meal-id="${item.meal_id}"
                            data-meal-name="${item.name}"
                            data-price="${itemPrice}"
                            data-quantity="${item.quantity || 1}">
                        ×
                    </button>
                `;
                mealsList.appendChild(li);
    
                // Add click handler for delete button
                const deleteBtn = li.querySelector('.delete-meal-btn');
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent order selection
                  
                    deleteMealFromOrder(item.meal_id);
                });
            });
        } else {
            mealsList.innerHTML = '<li>No items found</li>';
        }
        mealsDiv.appendChild(mealsList);
        orderDiv.appendChild(mealsDiv);
    
        // Create buttons container
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'order-item-buttons';
    
        // Add Complete Order button
        const completeButton = document.createElement('button');
        completeButton.textContent = 'Complete Order';
        completeButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent order selection when clicking button
            completeOrder(order.id);
        });
        buttonsDiv.appendChild(completeButton);
    
        // Add Update Order button
        const updateButton = document.createElement('button');
        updateButton.textContent = 'Update Order';
        updateButton.className = 'update-order-btn';
        updateButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent order selection when clicking button
            toggleUpdateMode();
            selectOrderForUpdate(order);
        });
        buttonsDiv.appendChild(updateButton);
    
        // Add Cancel Order button
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel Order';
        cancelButton.className = 'cancel-order-btn';
        cancelButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent order selection when clicking button
            promptAdminCredentials(order.id);
        });
        buttonsDiv.appendChild(cancelButton);
        orderDiv.appendChild(buttonsDiv);
    
        // Add hover effect for update mode
        if (isUpdateMode) {
            orderDiv.style.cursor = 'pointer';
        }
    
        // Add checkbox event listeners
        orderDiv.querySelectorAll('.meal-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', handleMealCheckboxChange);
        });
    
        return orderDiv;
    }
    

    function handleMealCheckboxChange(event) {
        const checkbox = event.target;
        const orderId = checkbox.dataset.orderId;
        const mealId = checkbox.dataset.mealId;
        const isChecked = checkbox.checked;

        fetch('/update-meal-status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ orderId, mealId, isCompleted: isChecked }),
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                console.error('Failed to update meal status:', data.message);
                // Revert the checkbox if the update failed
                checkbox.checked = !isChecked;
            }
        })
        .catch(error => {
            console.error('Error updating meal status:', error);
            // Revert the checkbox if there was an error
            checkbox.checked = !isChecked;
        });
    }

    // Refactor displayLiveOrders to use the helper function
    function displayLiveOrders(orders) {
        const liveOrdersList = document.getElementById('liveOrdersList');
        liveOrdersList.innerHTML = ''; // Clear existing orders

        orders.forEach(order => {
            const orderDiv = createOrderItem(order);
            liveOrdersList.appendChild(orderDiv);
        });

        // Start updating elapsed time for each order
        updateElapsedTimeForOrders(orders);
    }

    // Refactor loadLiveOrders to use the helper function
    function loadLiveOrders() {
        const liveOrdersList = document.getElementById('liveOrdersList');
        const liveOrderCount = document.getElementById('liveOrderCount');
        
        fetch('/live-orders')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    liveOrdersList.innerHTML = ''; // Clear existing orders
                    liveOrderCount.textContent = `Total Live Orders: ${data.orders.length}`;
                    
                    data.orders.forEach(order => {
                        const orderDiv = createOrderItem(order);
                        liveOrdersList.appendChild(orderDiv);
                    });

                    // Start updating elapsed time for orders
                    updateElapsedTimeForOrders(data.orders);
                    // Update elapsed time every second
                    setInterval(() => updateElapsedTimeForOrders(data.orders), 1000);
                }
            })
            .catch(error => {
                console.error('Error loading live orders:', error);
                showNotification('Failed to load live orders', 'error');
            });
    }

    function loadCompletedOrders() {
        fetch('/completed-orders')
            .then(response => response.json())
            .then(data => {
                const completedOrdersList = document.getElementById('completedOrdersList');
                if (!completedOrdersList) {
                    console.error('Completed orders list element not found');
                    return;
                }
                completedOrdersList.innerHTML = '';
                if (!data.orders || !Array.isArray(data.orders)) {
                    console.error('Invalid completed orders data received:', data);
                    completedOrdersList.innerHTML = '<p>Error loading completed orders</p>';
                    return;
                }
                data.orders.forEach(order => {
                    const orderDiv = document.createElement('div');
                    orderDiv.className = 'order-item completed';
                    const total = order.total != null ? order.total.toFixed(2) : 'N/A';
                    const orderTimestamp = order.order_timestamp ? new Date(order.order_timestamp).toLocaleString() : 'N/A';
                    const completionTimestamp = order.completion_timestamp ? new Date(order.completion_timestamp).toLocaleString() : 'N/A';
                    const timeTaken = order.time_taken != null ? formatTimeTaken(order.time_taken) : 'N/A';
                    
                    let mealsList = '<ul>';
                    if (order.items && Array.isArray(order.items)) {
                        order.items.forEach(item => {
                            const itemPrice = item.price != null ? item.price.toFixed(2) : 'N/A';
                            mealsList += `<li><span class="static-text">Meal:</span> ${item.name || 'Unknown item'} - $${itemPrice} x ${item.quantity || 1}</li>`;
                        });
                    } else {
                        mealsList += '<li>No items found</li>';
                    }
                    mealsList += '</ul>';

                    orderDiv.innerHTML = `
                        <p><span class="static-text">Guest:</span> ${order.guest_name_name || 'Unknown'}</p>
                        <p><span class="static-text">Waiter:</span> ${order.waiter_name || 'Unknown'}</p>
                        <p><span class="static-text">Chef:</span> ${order.chef_name || 'Unknown'}</p>
                        <p><span class="static-text">Order Time:</span> ${orderTimestamp}</p>
                        <p><span class="static-text">Completion Time:</span> ${completionTimestamp}</p>
                        <p><span class="static-text">Time Taken:</span> ${timeTaken}</p>
                        <p><span class="static-text">Meals:</span></p>
                        ${mealsList}
                        <p><span class="static-text">Total:</span> $${total}</p>
                    `;
                    completedOrdersList.appendChild(orderDiv);
                });
            })
            .catch(error => {
                console.error('Error loading completed orders:', error);
                const completedOrdersList = document.getElementById('completedOrdersList');
                if (completedOrdersList) {
                    completedOrdersList.innerHTML = '<p>Error loading completed orders</p>';
                }
            });
    }

    function formatTimeTaken(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        return `${hours}h ${minutes}m ${remainingSeconds}s`;
    }

    // Add event listeners
    document.getElementById('addOrderBtn').addEventListener('click', addOrder);
    document.getElementById('liveOrdersTab').addEventListener('click', () => {
        switchTab('liveOrders');
        loadLiveOrders();
    });
    document.getElementById('completedOrdersTab').addEventListener('click', () => {
        switchTab('completedOrders');
        loadCompletedOrders();
    });

    // ... (existing code)

    function populateFilters() {
        // Fetch waiters and populate waiter filters
        fetch('/waiters')
            .then(response => response.json())
            .then(data => {
                const waiterOptions = data.waiters.map(waiter => `<option value="${waiter.id}">${waiter.name}</option>`).join('');
                document.querySelectorAll('#liveOrdersWaiterFilter, #completedOrdersWaiterFilter').forEach(select => {
                    select.innerHTML = '<option value="">Filter by Waiter</option>' + waiterOptions;
                });
            })
            .catch(error => console.error('Error fetching waiters:', error));

        // Fetch chefs and populate chef filters
        fetch('/chefs')
            .then(response => response.json())
            .then(data => {
                const chefOptions = data.chefs.map(chef => `<option value="${chef.id}">${chef.name}</option>`).join('');
                document.querySelectorAll('#liveOrdersChefFilter, #completedOrdersChefFilter').forEach(select => {
                    select.innerHTML = '<option value="">Filter by Chef</option>' + chefOptions;
                });
            })
            .catch(error => console.error('Error fetching chefs:', error));

        // Fetch all meals and store them
        fetch('/meals')
            .then(response => response.json())
            .then(data => {
                allMeals = data.meals;
            })
            .catch(error => console.error('Error fetching meals:', error));
    }

    populateFilters();

    function applyFilters() {
        const liveOrdersWaiterFilter = document.getElementById('liveOrdersWaiterFilter').value;
        const liveOrdersChefFilter = document.getElementById('liveOrdersChefFilter').value;
        const liveOrdersMealFilter = document.getElementById('liveOrdersMealFilter').value.trim().toLowerCase();
        const completedOrdersWaiterFilter = document.getElementById('completedOrdersWaiterFilter').value;
        const completedOrdersChefFilter = document.getElementById('completedOrdersChefFilter').value;
        const completedOrdersMealFilter = document.getElementById('completedOrdersMealFilter').value.trim().toLowerCase();

        localStorage.setItem('currentFilters', JSON.stringify({
            liveOrdersWaiterFilter,
            liveOrdersChefFilter,
            liveOrdersMealFilter,
            completedOrdersWaiterFilter,
            completedOrdersChefFilter,
            completedOrdersMealFilter
        }));

        // Helper function to safely compare IDs
        const safeIdMatch = (orderId, filterId) => {
            if (!filterId) return true; // If no filter is set, include all
            if (orderId === null || orderId === undefined) return false;
            return orderId.toString() === filterId;
        };

        fetch('/live-orders')
            .then(response => response.json())
            .then(data => {
                const filteredOrders = data.orders.filter(order => {
                    const waiterMatch = safeIdMatch(order.waiter_id, liveOrdersWaiterFilter);
                    const chefMatch = safeIdMatch(order.chef_id, liveOrdersChefFilter);
                    const mealMatch = !liveOrdersMealFilter || (order.items && order.items.some(item => 
                        item.name.toLowerCase().includes(liveOrdersMealFilter)
                    ));
                    return waiterMatch && chefMatch && mealMatch;
                });
                displayLiveOrders(filteredOrders);
                updateLiveOrderCount(filteredOrders.length);
            })
            .catch(error => console.error('Error fetching live orders:', error));

        fetch('/completed-orders')
            .then(response => response.json())
            .then(data => {
                const filteredOrders = data.orders.filter(order => {
                    const waiterMatch = safeIdMatch(order.waiter_id, completedOrdersWaiterFilter);
                    const chefMatch = safeIdMatch(order.chef_id, completedOrdersChefFilter);
                    const mealMatch = !completedOrdersMealFilter || (order.items && order.items.some(item => 
                        item.name.toLowerCase().includes(completedOrdersMealFilter)
                    ));
                    return waiterMatch && chefMatch && mealMatch;
                });
                displayCompletedOrders(filteredOrders);
            })
            .catch(error => console.error('Error fetching completed orders:', error));
    }

    // Update the periodic refresh functions similarly
    function updateLiveOrders() {
        const currentFilters = JSON.parse(localStorage.getItem('currentFilters') || '{}');
        const selectedOrderId = selectedOrderForUpdate ? selectedOrderForUpdate.id : null; // Store selected order ID

        const safeIdMatch = (orderId, filterId) => {
            if (!filterId) return true;
            if (orderId === null || orderId === undefined) return false;
            return orderId.toString() === filterId;
        };

        fetch('/live-orders')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const filteredOrders = data.orders.filter(order => {
                        const waiterMatch = safeIdMatch(order.waiter_id, currentFilters.liveOrdersWaiterFilter);
                        const chefMatch = safeIdMatch(order.chef_id, currentFilters.liveOrdersChefFilter);
                        const mealMatch = !currentFilters.liveOrdersMealFilter || (order.items && order.items.some(item => 
                            item.name.toLowerCase().includes(currentFilters.liveOrdersMealFilter.toLowerCase())
                        ));
                        return waiterMatch && chefMatch && mealMatch;
                    });
                    displayLiveOrders(filteredOrders);
                    updateLiveOrderCount(filteredOrders.length);

                    // Reapply the selected-for-update class
                    if (selectedOrderId) {
                        const selectedOrderElement = document.getElementById(`order-${selectedOrderId}`);
                        if (selectedOrderElement) {
                            selectedOrderElement.classList.add('selected-for-update');
                        }
                    }
                }
            })
            .catch(error => console.error('Error fetching live orders:', error));
    }

    function updateCompletedOrders() {
        const currentFilters = JSON.parse(localStorage.getItem('currentFilters') || '{}');
        
        const safeIdMatch = (orderId, filterId) => {
            if (!filterId) return true;
            if (orderId === null || orderId === undefined) return false;
            return orderId.toString() === filterId;
        };

        fetch('/completed-orders')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const filteredOrders = data.orders.filter(order => {
                        const waiterMatch = safeIdMatch(order.waiter_id, currentFilters.completedOrdersWaiterFilter);
                        const chefMatch = safeIdMatch(order.chef_id, currentFilters.completedOrdersChefFilter);
                        const mealMatch = !currentFilters.completedOrdersMealFilter || (order.items && order.items.some(item => 
                            item.name.toLowerCase().includes(currentFilters.completedOrdersMealFilter.toLowerCase())
                        ));
                        return waiterMatch && chefMatch && mealMatch;
                    });
                    displayCompletedOrders(filteredOrders);
                }
            })
            .catch(error => console.error('Error fetching completed orders:', error));
    }

    function displayCompletedOrders(orders) {
        const completedOrdersList = document.getElementById('completedOrdersList');
        completedOrdersList.innerHTML = ''; // Clear existing orders

        // Sort orders by completion timestamp from latest to oldest
        orders.sort((a, b) => new Date(b.completion_timestamp) - new Date(a.completion_timestamp));

        orders.forEach(order => {
            const orderDiv = document.createElement('div');
            orderDiv.className = 'order-item completed';

            const total = order.total != null ? order.total.toFixed(2) : 'N/A';
            const orderTimestamp = order.order_timestamp ? new Date(order.order_timestamp).toLocaleString() : 'N/A';
            const completionTimestamp = order.completion_timestamp ? new Date(order.completion_timestamp).toLocaleString() : 'N/A';
            const timeTaken = order.time_taken != null ? formatTimeTaken(order.time_taken) : 'N/A';

            let mealsList = '<ul>';
            if (order.items && Array.isArray(order.items)) {
                order.items.forEach(item => {
                    const itemPrice = item.price != null ? item.price.toFixed(2) : 'N/A';
                    mealsList += `<li><span class="static-text">Meal:</span> ${item.name || 'Unknown item'} - $${itemPrice} x ${item.quantity || 1}</li>`;
                });
            } else {
                mealsList += '<li>No items found</li>';
            }
            mealsList += '</ul>';

            orderDiv.innerHTML = `
                <p><span class="static-text">Guest:</span> ${order.guest_name || 'Unknown'}</p>
                <p><span class="static-text">Waiter:</span> ${order.waiter_name || 'Unknown'}</p>
                <p><span class="static-text">Chef:</span> ${order.chef_name || 'Unknown'}</p>
                <p><span class="static-text">Order Time:</span> ${orderTimestamp}</p>
                <p><span class="static-text">Completion Time:</span> ${completionTimestamp}</p>
                <p><span class="static-text">Time Taken:</span> ${timeTaken}</p>
                <p><span class="static-text">Meals:</span></p>
                ${mealsList}
                <p><span class="static-text">Total:</span> $${total}</p>
            `;
            completedOrdersList.appendChild(orderDiv);
        });
    }

    // Event listeners for filters
    document.getElementById('liveOrdersWaiterFilter').addEventListener('change', () => {
        applyFilters();
        saveFilterValues();
    });
    document.getElementById('liveOrdersChefFilter').addEventListener('change', () => {
        applyFilters();
        saveFilterValues();
    });
    document.getElementById('liveOrdersMealFilter').addEventListener('change', () => {
        applyFilters();
        saveFilterValues();
    });
    document.getElementById('completedOrdersWaiterFilter').addEventListener('change', () => {
        applyFilters();
        saveFilterValues();
    });
    document.getElementById('completedOrdersMealFilter').addEventListener('change', () => {
        applyFilters();
        saveFilterValues();
    });
    document.getElementById('completedOrdersChefFilter').addEventListener('change', () => {
        applyFilters();
        saveFilterValues();
    });

    // Add event listener for the Void button
    document.getElementById('voidOrderBtn').addEventListener('click', clearOrder);

    function saveFilterValues() {
        const liveOrdersWaiterFilter = document.getElementById('liveOrdersWaiterFilter').value;
        const liveOrdersChefFilter = document.getElementById('liveOrdersChefFilter').value;
        const liveOrdersMealFilter = document.getElementById('liveOrdersMealFilter').value;
        const completedOrdersWaiterFilter = document.getElementById('completedOrdersWaiterFilter').value;
        const completedOrdersChefFilter = document.getElementById('completedOrdersChefFilter').value;
        const completedOrdersMealFilter = document.getElementById('completedOrdersMealFilter').value;

        localStorage.setItem('liveOrdersWaiterFilter', liveOrdersWaiterFilter);
        localStorage.setItem('liveOrdersChefFilter', liveOrdersChefFilter);
        localStorage.setItem('liveOrdersMealFilter', liveOrdersMealFilter);
        localStorage.setItem('completedOrdersWaiterFilter', completedOrdersWaiterFilter);
        localStorage.setItem('completedOrdersChefFilter', completedOrdersChefFilter);
        localStorage.setItem('completedOrdersMealFilter', completedOrdersMealFilter);
    }

    function loadFilterValues() {
        const liveOrdersWaiterFilter = localStorage.getItem('liveOrdersWaiterFilter');
        const liveOrdersChefFilter = localStorage.getItem('liveOrdersChefFilter');
        const liveOrdersMealFilter = localStorage.getItem('liveOrdersMealFilter');
        const completedOrdersWaiterFilter = localStorage.getItem('completedOrdersWaiterFilter');
        const completedOrdersChefFilter = localStorage.getItem('completedOrdersChefFilter');
        const completedOrdersMealFilter = localStorage.getItem('completedOrdersMealFilter');

        if (liveOrdersWaiterFilter !== null) {
            document.getElementById('liveOrdersWaiterFilter').value = liveOrdersWaiterFilter;
        }
        if (liveOrdersChefFilter !== null) {
            document.getElementById('liveOrdersChefFilter').value = liveOrdersChefFilter;
        }
        if (liveOrdersMealFilter !== null) {
            document.getElementById('liveOrdersMealFilter').value = liveOrdersMealFilter;
        }
        if (completedOrdersWaiterFilter !== null) {
            document.getElementById('completedOrdersWaiterFilter').value = completedOrdersWaiterFilter;
        }
        if (completedOrdersChefFilter !== null) {
            document.getElementById('completedOrdersChefFilter').value = completedOrdersChefFilter;
        }
        if (completedOrdersMealFilter !== null) {
            document.getElementById('completedOrdersMealFilter').value = completedOrdersMealFilter;
        }
    }

    // Load filter values from local storage
    loadFilterValues();

    // Apply filters initially
    applyFilters();

    // Set up periodic updates
    setInterval(updateLiveOrders, 5000);
    setInterval(updateCompletedOrders, 5000);

    // Back to Login Button
    document.getElementById('backToLogin').addEventListener('click', () => {
        ipcRenderer.send('load-page', 'login');
    });

    function updateLiveOrderCount(count) {
        const liveOrderCount = document.getElementById('liveOrderCount');
        if (liveOrderCount) {
            liveOrderCount.textContent = `Total Live Orders: ${count}`;
        }
    }

    // Add event listeners for redirect buttons
    document.getElementById('goToMealsFromSubcategories').addEventListener('click', () => {
        switchTab('meal');
    });

    document.getElementById('goToMealsFromMealSelector').addEventListener('click', () => {
        switchTab('meal');
    });

    function updateElapsedTimeForOrders(orders) {
        orders.forEach(order => {
            const orderElement = document.getElementById(`order-${order.id}`);
            if (orderElement) {
                const elapsedTimeElement = orderElement.querySelector('.elapsed-time');
                if (elapsedTimeElement && order.timestamp) {
                    const orderTimestamp = new Date(order.timestamp);
                    const elapsedSeconds = Math.floor((Date.now() - orderTimestamp) / 1000);
                    elapsedTimeElement.textContent = formatTimeTaken(elapsedSeconds);

                    // Apply the overdue class if the order has been active for more than an hour
                    if (elapsedSeconds > 3600) {
                        orderElement.classList.add('overdue');
                    } else {
                        orderElement.classList.remove('overdue');
                    }
                }
            }
        });
    }

    // Add this function to create the cancel button for each order
    function createCancelButton(orderId) {
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel Order';
        cancelButton.className = 'cancel-order-btn';
        cancelButton.addEventListener('click', () => promptAdminCredentials(orderId));
        return cancelButton;
    }

    // Add this function to prompt for admin credentials
    function promptAdminCredentials(orderId) {
        const dialog = document.getElementById('adminCredentialsDialog');
        const submitButton = document.getElementById('submitAdminCredentials');
        const cancelButton = document.getElementById('cancelAdminCredentials');
        const usernameInput = document.getElementById('adminUsername');
        const passwordInput = document.getElementById('adminPassword');
        
        // Clear previous values
        usernameInput.value = '';
        passwordInput.value = '';
        
        // Show dialog
        dialog.style.display = 'block';
        
        // Focus the username input after a short delay
        setTimeout(() => {
            usernameInput.focus();
        }, 100);

        // Remove any existing event listeners
        const newSubmitButton = submitButton.cloneNode(true);
        const newCancelButton = cancelButton.cloneNode(true);
        submitButton.parentNode.replaceChild(newSubmitButton, submitButton);
        cancelButton.parentNode.replaceChild(newCancelButton, cancelButton);

        // Add new event listeners
        newSubmitButton.addEventListener('click', (e) => {
            e.preventDefault();
            const username = usernameInput.value;
            const password = passwordInput.value;
            dialog.style.display = 'none';
            verifyAdminAndCancelOrder(orderId, username, password);
        });

        newCancelButton.addEventListener('click', (e) => {
            e.preventDefault();
            dialog.style.display = 'none';
        });

        // Add keyboard event listener for Enter key
        dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                newSubmitButton.click();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                newCancelButton.click();
            }
        });
    }

    // Add this function to verify admin credentials and cancel the order
    function verifyAdminAndCancelOrder(orderId, username, password) {
        fetch('/verify-admin-and-cancel-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ orderId, username, password }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('Order cancelled successfully', 'success');
                loadLiveOrders();
            } else {
                showNotification('Failed to cancel order: ' + data.message, 'error');
            }
        })
        .catch(error => {
            showNotification('Error cancelling order: ' + error.message, 'error');
        });
    }

    // Replace the meal filter event listeners
    document.getElementById('liveOrdersMealFilter').addEventListener('input', (e) => {
        handleMealSearch(e.target.value, 'liveOrdersMealSuggestions', 'liveOrdersMealFilter');
    });

    document.getElementById('completedOrdersMealFilter').addEventListener('input', (e) => {
        handleMealSearch(e.target.value, 'completedOrdersMealSuggestions', 'completedOrdersMealFilter');
    });

    // Add these new functions for search and suggestions
    let allMeals = []; // Store all meals for suggestions

    function handleMealSearch(searchText, suggestionsId, inputId) {
        const suggestionsDiv = document.getElementById(suggestionsId);
        
        if (searchText.length === 0) {
            suggestionsDiv.style.display = 'none';
            applyFilters(); // Apply filters with empty search
            return;
        }

        const matchingMeals = allMeals.filter(meal => 
            meal.name.toLowerCase().includes(searchText.toLowerCase())
        );

        displaySuggestions(matchingMeals, suggestionsDiv, inputId);
    }

    function displaySuggestions(meals, suggestionsDiv, inputId) {
        if (meals.length === 0) {
            suggestionsDiv.style.display = 'none';
            return;
        }

        suggestionsDiv.innerHTML = '';
        meals.forEach(meal => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.textContent = meal.name;
            div.addEventListener('click', () => {
                document.getElementById(inputId).value = meal.name;
                suggestionsDiv.style.display = 'none';
                applyFilters();
            });
            suggestionsDiv.appendChild(div);
        });
        suggestionsDiv.style.display = 'block';
    }

    // Add click event listener to close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        const suggestions = document.querySelectorAll('.suggestions-dropdown');
        suggestions.forEach(dropdown => {
            if (!dropdown.contains(e.target) && !e.target.matches('input')) {
                dropdown.style.display = 'none';
            }
        });
    });

    // Add keyboard navigation for suggestions
    document.querySelectorAll('#liveOrdersMealFilter, #completedOrdersMealFilter').forEach(input => {
        input.addEventListener('keydown', (e) => {
            const suggestionsDiv = input.nextElementSibling;
            const suggestions = suggestionsDiv.querySelectorAll('.suggestion-item');
            let activeIndex = Array.from(suggestions).findIndex(item => item.classList.contains('active-suggestion'));

            switch(e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    if (activeIndex < suggestions.length - 1) {
                        if (activeIndex >= 0) suggestions[activeIndex].classList.remove('active-suggestion');
                        suggestions[activeIndex + 1].classList.add('active-suggestion');
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (activeIndex > 0) {
                        suggestions[activeIndex].classList.remove('active-suggestion');
                        suggestions[activeIndex - 1].classList.add('active-suggestion');
                    }
                    break;
                case 'Enter':
                    e.preventDefault();
                    const activeItem = suggestionsDiv.querySelector('.active-suggestion');
                    if (activeItem) {
                        input.value = activeItem.textContent;
                        suggestionsDiv.style.display = 'none';
                        applyFilters();
                    }
                    break;
                case 'Escape':
                    suggestionsDiv.style.display = 'none';
                    break;
            }
        });
    });
    document.getElementById('addGuestBtn').addEventListener('click', () => {
        switchTab('guests');
        fetchGuests();

      });
      // Create input field and button to add guests
const guestInput = document.createElement('input');
guestInput.type = 'text';
guestInput.placeholder = 'Enter guest name';

const addGuestButton = document.createElement('button');
addGuestButton.textContent = 'Add Guest';

// Add input field and button to Guest tab content
document.getElementById('guestsContent').appendChild(guestInput);
document.getElementById('guestsContent').appendChild(addGuestButton);

// Add event listener to add guest button
addGuestButton.addEventListener('click', () => {
  const guestName = guestInput.value;
  if (guestName !== '') {
    // Send request to server to add guest
    fetch('/add-guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: guestName }),
    })
      .then(response => response.json())
      .then(data => {
        fetchGuests(); // Update guest list
      })
      .catch(error => console.error('Error adding guest:', error));
    guestInput.value = ''; // Clear input field
  }
});
    function reattachEventListeners() {
        // Filter listeners
        const filterElements = {
            'liveOrdersWaiterFilter': 'change',
            'liveOrdersChefFilter': 'change',
            'liveOrdersMealFilter': ['change', 'input'],
            'completedOrdersWaiterFilter': 'change',
            'completedOrdersChefFilter': 'change',
            'completedOrdersMealFilter': ['change', 'input']
        };

        Object.entries(filterElements).forEach(([id, events]) => {
            const element = document.getElementById(id);
            if (element) {
                if (Array.isArray(events)) {
                    events.forEach(event => {
                        if (event === 'input') {
                            element.addEventListener(event, (e) => {
                                handleMealSearch(e.target.value, `${id}Suggestions`, id);
                            });
                        } else {
                            element.addEventListener(event, () => {
                                applyFilters();
                                saveFilterValues();
                            });
                        }
                    });
                } else {
                    element.addEventListener(events, () => {
                        applyFilters();
                        saveFilterValues();
                    });
                }
            }
        });

        // Other button listeners
        const buttonListeners = {
            'voidOrderBtn': () => clearOrder(),
            'backToLogin': () => ipcRenderer.send('load-page', 'login'),
            'goToMealsFromSubcategories': () => switchTab('meal'),
            'goToMealsFromMealSelector': () => switchTab('meal')
        };

        Object.entries(buttonListeners).forEach(([id, handler]) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('click', handler);
            }
        });
    }

    // New non-blocking notification system
    function showNotification(message, type = 'info') {
        // Remove any existing notifications
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Create new notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        // Add to document
        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Helper function for formatting time
    function formatTimeTaken(seconds) {
        if (seconds < 60) {
            return `${seconds}s`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes}m ${remainingSeconds}s`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const remainingMinutes = Math.floor((seconds % 3600) / 60);
            return `${hours}h ${remainingMinutes}m`;
        }
    }

    // Add these new functions and event listeners
    let isUpdateMode = false;
    let selectedOrderForUpdate = null;

    function toggleUpdateMode() {
        const updateBtn = document.getElementById('updateOrderBtn');
        isUpdateMode = !isUpdateMode;
        updateBtn.classList.toggle('active');
        
        if (isUpdateMode) {
            showNotification('Select an order to update', 'info');
            document.getElementById('addOrderBtn').textContent = 'Update Order';
        } else {
            showNotification('Update mode cancelled', 'info');
            document.getElementById('addOrderBtn').textContent = 'Add Order';
            clearOrder();
            selectedOrderForUpdate = null;
            // Remove selection styling from all orders
            document.querySelectorAll('.order-item').forEach(item => {
                item.classList.remove('selected-for-update');
            });
        }
    }

    function selectOrderForUpdate(order) {
        if (!isUpdateMode) return;

        selectedOrderForUpdate = order;
        
        // Update sidebar with order details
        document.getElementById('currentWaiter').textContent = `Current Waiter: ${order.waiter_name}`;
        document.getElementById('currentChef').textContent = `Current Chef: ${order.chef_name}`;
        document.getElementById('selectedWaiter').textContent = `Selected Waiter: ${order.waiter_name}`;
        document.getElementById('selectedWaiter').dataset.waiterId = order.waiter_id;
        document.getElementById('selectedChef').textContent = `Selected Chef: ${order.chef_name}`;
        document.getElementById('selectedChef').dataset.chefId = order.chef_id;
        
        // Update order items
        const orderList = document.getElementById('orderList');
        orderList.innerHTML = '';
        order.items.forEach(item => {
            const listItem = document.createElement('li');
            listItem.dataset.mealId = item.meal_id;
            listItem.dataset.quantity = item.quantity;
            updateOrderItemDisplay(listItem, item, item.quantity, item.meal_id);
            orderList.appendChild(listItem);
        });
        
        // Update total
        document.getElementById('orderTotal').textContent = `$${order.total.toFixed(2)}`;
        
        // Highlight selected order
        document.querySelectorAll('.order-item').forEach(item => {
            item.classList.remove('selected-for-update');
        });
        document.getElementById(`order-${order.id}`).classList.add('selected-for-update');
        
        showNotification('Order loaded for updating', 'info');
    }

    // Modify the createOrderItem function to add click handler for update mode
    function createOrderItem(order) {
        const orderDiv = document.createElement('div');
        orderDiv.className = 'order-item';
        orderDiv.id = `order-${order.id}`;

        // Add click handler for update mode
        orderDiv.addEventListener('click', () => {
            if (isUpdateMode) {
                selectOrderForUpdate(order);
            }
        });

        // Create header
        const headerDiv = document.createElement('div');
        headerDiv.className = 'order-item-header';

        const guestPara = document.createElement('p');
        if (order.guest_name) {
            guestPara.innerHTML = `<span class="static-text">Guest:</span> ${order.guest_name}`;
            headerDiv.appendChild(guestPara);
        }

        headerDiv.innerHTML += `
            <p><span class="static-text">Waiter:</span> ${order.waiter_name || 'Unknown'}</p>
            <p><span class="static-text">Chef:</span> ${order.chef_name || 'Unknown'}</p>
            <p><span class="static-text">Time:</span> ${order.timestamp ? new Date(order.timestamp).toLocaleString() : 'N/A'}</p>
            <p><span class="static-text">Elapsed Time:</span> <span class="elapsed-time">Calculating...</span></p>
            <p><span class="static-text">Total:</span> $${order.total != null ? order.total.toFixed(2) : 'N/A'}</p>
        `;
        orderDiv.appendChild(headerDiv);

        // Create meals list
        const mealsDiv = document.createElement('div');
        mealsDiv.innerHTML = `<p><span class="static-text">Meals:</span></p>`;
        const mealsList = document.createElement('ul');
        
        if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
                const li = document.createElement('li');
                const itemPrice = item.price != null ? item.price.toFixed(2) : 'N/A';
                li.innerHTML = `
                    <input type="checkbox" id="meal-${order.id}-${item.meal_id}" 
                           class="meal-checkbox" 
                           data-order-id="${order.id}" 
                           data-meal-id="${item.meal_id}"
                           ${item.is_completed ? 'checked' : ''}>
                    <label for="meal-${order.id}-${item.meal_id}">
                        <span class="static-text">Meal:</span> ${item.name || 'Unknown item'} - $${itemPrice} x ${item.quantity || 1}
                    </label>
                `;
                mealsList.appendChild(li);

                // Add click handler for delete button if in update mode

            });
        } else {
            mealsList.innerHTML = '<li>No items found</li>';
        }
        mealsDiv.appendChild(mealsList);
        orderDiv.appendChild(mealsDiv);

        // Create buttons container
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'order-item-buttons';

        // Add Complete Order button
        const completeButton = document.createElement('button');
        completeButton.textContent = 'Complete Order';
        completeButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent order selection when clicking button
            completeOrder(order.id);
        });
        buttonsDiv.appendChild(completeButton);

        // Add Update Order button
        const updateButton = document.createElement('button');
        updateButton.textContent = 'Update Order';
        updateButton.className = 'update-order-btn';
        updateButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent order selection when clicking button
            toggleUpdateMode();
            selectOrderForUpdate(order);
        });
        buttonsDiv.appendChild(updateButton);

        // Add Cancel Order button
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel Order';
        cancelButton.className = 'cancel-order-btn';
        cancelButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent order selection when clicking button
            promptAdminCredentials(order.id);
        });
        buttonsDiv.appendChild(cancelButton);
        orderDiv.appendChild(buttonsDiv);

        // Add hover effect for update mode
        if (isUpdateMode) {
            orderDiv.style.cursor = 'pointer';
        }

        // Add checkbox event listeners
        orderDiv.querySelectorAll('.meal-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', handleMealCheckboxChange);
        });

        return orderDiv;
    }

    // Modify the addOrder function to handle updates
    function addOrder() {
        if (isUpdateMode && !selectedOrderForUpdate) {
            showNotification('Please select an order to update', 'error');
            return;
        }

        const selectedWaiter = document.getElementById('selectedWaiter');
        const selectedChef = document.getElementById('selectedChef');
        const selectedguest = document.getElementById('selectedGuest');
        const orderList = document.getElementById('orderList');
        const orderTotal = document.getElementById('orderTotal');

        // ... existing validation code ...

        const orderData = {
            waiter_id: selectedWaiter.dataset.waiterId,
            waiter_name: selectedWaiter.textContent.replace('Selected Waiter: ', ''),
            chef_id: selectedChef.dataset.chefId,
            chef_name: selectedChef.textContent.replace('Selected Chef: ', ''),
            guest_id: selectedguest.dataset.guestId,
            guest_name: selectedguest.textContent.replace('Selected Guest: ', ''),
            items: Array.from(orderList.children).map(li => ({
                meal_id: li.dataset.mealId,
                name: li.textContent.split(' - $')[0],
                price: parseFloat(li.textContent.split('$')[1].split('x')[0]),
                quantity: parseInt(li.dataset.quantity, 10)
            })),
            total: parseFloat(orderTotal.textContent.replace('$', ''))
        };

        const endpoint = isUpdateMode ? `/update-order/${selectedOrderForUpdate.id}` : '/add-order';
        
        fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification(
                    isUpdateMode ? 'Order updated successfully' : 'Order added successfully', 
                    'success'
                );
                if (isUpdateMode) {
                    toggleUpdateMode(); // Exit update mode
                }
                clearOrder();
                loadLiveOrders();
            } else {
                showNotification(
                    isUpdateMode ? 'Failed to update order: ' : 'Failed to add order: ' + data.message, 
                    'error'
                );
            }
        })
        .catch(error => {
            showNotification(
                isUpdateMode ? 'Error updating order: ' : 'Error adding order: ' + error.message, 
                'error'
            );
        });
    }
    document.querySelectorAll('.guest-button').forEach(button => {
      button.addEventListener('click', () => {
        const guestName = button.textContent;
        document.getElementById('selected-guest').textContent = guestName;
      });
    });
    // Add event listener for update button
    document.getElementById('updateOrderBtn').addEventListener('click', toggleUpdateMode);

    // Make sure to call loadLiveOrders when the tab is clicked
    document.getElementById('liveOrdersTab').addEventListener('click', () => {
        // ... existing tab switching code ...
        loadLiveOrders();
    });

    // Also load orders when the page first loads
    document.addEventListener('DOMContentLoaded', () => {
        // ... other initialization code ...
        if (document.getElementById('liveOrdersContent').classList.contains('active')) {
            loadLiveOrders();
        }
    });
});

console.log('captain.js finished loading');

