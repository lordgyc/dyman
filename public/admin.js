const { ipcRenderer } = require('electron');
const XLSX = require('xlsx');

function generateExcelFile(orders, filename) {
    const wb = XLSX.utils.book_new();
    function formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString(); // Format the timestamp to a readable format
    }
    // Flatten the orders data
    const flattenedOrders = orders.flatMap(order => {
        return order.items.map(item => ({
            order_id: order.id,
            chef_name: order.chef_name,
            waiter_name: order.waiter_name,
            guest_name: order.guest_name,
            order_timestamp: formatTimestamp(order.order_timestamp),
            completion_timestamp: formatTimestamp(order.completion_timestamp),
            time_taken: order.time_taken,
            item_name: item.name,
            item_price: item.price,
            item_quantity: item.quantity
        }));
    });

    // Create a worksheet from the flattened data
    const ws = XLSX.utils.json_to_sheet(flattenedOrders);

    // Append the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Completed Orders');
    XLSX.writeFile(wb, `${filename}.xlsx`);

}

module.exports = generateExcelFile;



document.getElementById('guestManagementTab').addEventListener('click', () => {
    fetch('/all-completed-orders')
        .then(response => response.json())
        .then(data => {
            console.log(data);
            displayCompletedGuestOrders(data.orders);
        })
        .catch(error => {
            console.error('Error fetching completed guest orders:', error);
        });
});

function printContent(content, title) {
    // Clone the content element to avoid modifying the original content
    const clonedContent = content.cloneNode(true);

    // Remove the button from the cloned content
    const buttonsToRemove = clonedContent.querySelectorAll('#printGuestManagementButton, .delete-btn');
    if (buttonsToRemove) {
        buttonsToRemove.forEach(button => button.remove());
    }
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>${title}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        font-size: 8pt; /* Reduced base font size */
                        margin: 10px;
                    }
                    h1 {
                        font-size: 12pt;
                        margin: 5px 0;
                    }
                    h3, h4 {
                        font-size: 9pt;
                        margin: 3px 0;
                        padding: 2px;
                        background-color: #f2f2f2;
                    }
                    table {
                        border-collapse: collapse;
                        width: 100%;
                        margin: 5px 0;
                    }
                    th, td {
                        border: 0.5px solid #ddd;
                        padding: 3px 4px;
                        text-align: left;
                        font-size: 7pt;
                        line-height: 1.1;
                    }
                    th {
                        background-color: #f2f2f2;
                        font-weight: bold;
                    }
                    .total-row td {
                        font-weight: bold;
                        background-color: #f9f9f9;
                    }
                    .analysis-table, #dailySummaryTable {
                        page-break-inside: avoid;
                        margin-bottom: 8px;
                    }
                    .order-count-bar {
                        font-size: 9pt;
                        margin: 5px 0;
                        padding: 3px;
                        background-color: #f2f2f2;
                        text-align: center;
                    }
                    @page {
                        margin: 0.5cm;
                    }
                </style>
            </head>
            <body>
                <h1>${title}</h1>
                ${clonedContent.outerHTML}
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();

    // Use Electron's IPC to handle PDF generation
    ipcRenderer.send('print-to-pdf', printWindow.document.documentElement.outerHTML);
}
async function displayCompletedGuestOrders(data) {
    if (!Array.isArray(data)) {
        console.error('Invalid data format. Expected an array.');
        return;
    }

    const ordersByGuest = {};

    data.forEach((order) => {
        if (!order.guest_name) return;

        if (!ordersByGuest[order.guest_name]) {
            ordersByGuest[order.guest_name] = {
                meals: {},
                total: 0,
                guestId: order.guest_id, // Store the guest ID
            };
        }

        order.items.forEach((item) => {
            const mealName = item.name;
            const mealPrice = item.price;
            const mealQuantity = item.quantity;

            if (!ordersByGuest[order.guest_name].meals[mealName]) {
                ordersByGuest[order.guest_name].meals[mealName] = {
                    quantity: 0,
                    price: mealPrice,
                    total: 0,
                };
            }

            ordersByGuest[order.guest_name].meals[mealName].quantity += mealQuantity;
            ordersByGuest[order.guest_name].meals[mealName].total += mealPrice * mealQuantity;
            ordersByGuest[order.guest_name].total += mealPrice * mealQuantity;
        });
    });

    const container = document.getElementById('guestList');

    function renderGuests(filteredGuests) {
        container.innerHTML = '';

        for (const [guestName, { meals, total, guestId }] of Object.entries(filteredGuests)) {
            const guestDiv = document.createElement('div');
            guestDiv.className = 'guest-section';
            guestDiv.innerHTML = `
                <h2>${guestName}'s Orders (Total: $${total.toFixed(2)}) <button class="delete-btn" data-guest-id="${guestId}">Delete</button></h2>
                <table>
                    <thead>
                        <tr>
                            <th>Meal</th>
                            <th>Quantity</th>
                            <th>Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(meals)
                            .map(
                                ([mealName, { quantity, price, total }]) => `
                                <tr>
                                    <td>${mealName}</td>
                                    <td>${quantity}</td>
                                    <td>$${price.toFixed(2)}</td>
                                    <td>$${total.toFixed(2)}</td>
                                </tr>
                            `
                            )
                            .join('')}
                    </tbody>
                </table>
            `;
            container.appendChild(guestDiv);
        }

        // Add event listener for delete buttons
        document.querySelectorAll('.delete-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const guestId = btn.dataset.guestId;
                showVerificationModal(guestId);
            });
        });
    }

    // Initial render of all guests
    renderGuests(ordersByGuest);

    // Add event listener for the search bar
    document.getElementById('searchBar').addEventListener('input', (event) => {
        const searchTerm = event.target.value.toLowerCase();
        const filteredGuests = Object.fromEntries(
            Object.entries(ordersByGuest).filter(([guestName]) =>
                guestName.toLowerCase().includes(searchTerm)
            )
        );
        renderGuests(filteredGuests);
    });

    // Close modal when close button is clicked
    document.querySelector('.close-btn').addEventListener('click', () => {
        document.getElementById('verificationModal').style.display = 'none';
    });

    // Handle form submission
    document.getElementById('verificationForm').addEventListener('submit', (event) => {
        event.preventDefault();
        const guestId = event.target.dataset.guestId;
        const username = event.target.username.value;
        const password = event.target.password.value;

        // Send verification request to the server
        fetch('/verify-admin-and-delete-guest', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ guestId, username, password }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Close the modal
                document.getElementById('verificationModal').style.display = 'none';
                // Remove the guest section
                document.querySelector(`.guest-section [data-guest-id="${guestId}"]`).parentElement.parentElement.remove();
            } else {
                alert('Verification failed: ' + data.message);
            }
            // Clear the form inputs
            event.target.reset();
        })
        .catch(error => {
            console.error('Error:', error);
            // Clear the form inputs in case of error
            event.target.reset();
        });
    });
}

function showVerificationModal(guestId) {
    const modal = document.getElementById('verificationModal');
    const form = document.getElementById('verificationForm');
    form.dataset.guestId = guestId;
    modal.style.display = 'block';
}

const printButton = document.getElementById('printGuestManagementButton');
printButton.addEventListener('click', () => {
    const content = document.getElementById('guestList');
    printContent(content, 'Guest Management Report');
});


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

document.addEventListener('DOMContentLoaded', () => {
    // Tab management
    const tabs = {
        addCaptain: document.getElementById('addCaptainTab'),
        changePassword: document.getElementById('changePasswordTab'),
        manageRestaurant: document.getElementById('manageRestaurantTab'),
        analysis: document.getElementById('analysisTab'),
        dailySummary: document.getElementById('dailySummaryTab'),
        manageCompletedOrders: document.getElementById('manageCompletedOrdersTab'),
        guestManagement: document.getElementById('guestManagementTab')
      
    };

    const contents = {
        addCaptain: document.getElementById('addCaptainContent'),
        changePassword: document.getElementById('changePasswordContent'),
        manageRestaurant: document.getElementById('manageRestaurantContent'),
        analysis: document.getElementById('analysisContent'),
        dailySummary: document.getElementById('dailySummaryContent'),
        manageCompletedOrders: document.getElementById('manageCompletedOrdersContent'),
        guestManagement: document.getElementById('guestManagementContent')
    };

    const subTabs = {
        waiter: document.getElementById('waiterTab'),
        menu: document.getElementById('menuTab'),
        chef: document.getElementById('chefTab')
    };

    const subContents = {
        waiter: document.getElementById('waiterContent'),
        menu: document.getElementById('menuContent'),
        chef: document.getElementById('chefContent')
    };

    // Tab switching logic
    function showTab(tabContent) {
        Object.values(contents).forEach(content => content.classList.remove('active'));
        tabContent.classList.add('active');
        Object.values(tabs).forEach(tab => tab.classList.remove('selected'));
        document.querySelector(`[id="${tabContent.id.replace('Content', 'Tab')}"]`).classList.add('selected');
    }

    function showSubTab(subTabContent) {
        Object.values(subContents).forEach(content => content.classList.remove('active'));
        subTabContent.classList.add('active');
        Object.values(subTabs).forEach(subTab => subTab.classList.remove('selected'));
        document.querySelector(`[id="${subTabContent.id.replace('Content', 'Tab')}"]`).classList.add('selected');
    }

    Object.entries(tabs).forEach(([key, tab]) => {
        tab.addEventListener('click', () => showTab(contents[key]));
    });

    Object.entries(subTabs).forEach(([key, subTab]) => {
        subTab.addEventListener('click', () => showSubTab(subContents[key]));
    });

    // Show Add Captain tab by default
    showTab(contents.addCaptain);

    // Add Captain Form
    document.getElementById('addCaptainForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('newCaptainUsername').value;
        const password = document.getElementById('newCaptainPassword').value;

        try {
            const response = await fetch('/add-captain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();
            document.getElementById('message').textContent = data.message;
        } catch (error) {
            console.error('Error:', error);
            document.getElementById('message').textContent = 'An error occurred. Please try again.';
        }
    });

    // Change Password Form
    document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;

        if (newPassword !== confirmNewPassword) {
            document.getElementById('message').textContent = 'New passwords do not match.';
            return;
        }

        try {
            const response = await fetch('/change-admin-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            const data = await response.json();
            document.getElementById('message').textContent = data.message;
        } catch (error) {
            console.error('Error:', error);
            document.getElementById('message').textContent = 'An error occurred. Please try again.';
        }
    });

    // Waiter Management
    document.getElementById('addWaiterForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const waiterName = document.getElementById('waiterName').value;
        const waiterPassword = document.getElementById('waiterPassword').value;

        try {
            const response = await fetch('/add-waiter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: waiterName, password: waiterPassword }),
            });

            const data = await response.json();
            document.getElementById('message').textContent = data.message;
            if (data.success) {
                loadWaiters();
            }
        } catch (error) {
            console.error('Error:', error);
            document.getElementById('message').textContent = 'An error occurred. Please try again.';
        }
    });

    // Menu Management
    let selectedCategory = null;
    let selectedSubcategory = null;

    document.getElementById('addCategoryForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const categoryName = document.getElementById('categoryName').value;

        try {
            const response = await fetch('/add-category', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: categoryName }),
            });

            const data = await response.json();
            document.getElementById('message').textContent = data.message;
            if (data.success) {
                loadCategories();
            }
        } catch (error) {
            console.error('Error:', error);
            document.getElementById('message').textContent = 'An error occurred. Please try again.';
        }
    });

    document.getElementById('addSubcategoryForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedCategory) {
            document.getElementById('message').textContent = 'Please select a category first.';
            return;
        }
        const subcategoryName = document.getElementById('subcategoryName').value;

        try {
            const response = await fetch('/add-subcategory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: subcategoryName, categoryId: selectedCategory }),
            });

            const data = await response.json();
            document.getElementById('message').textContent = data.message;
            if (data.success) {
                loadSubcategories(selectedCategory);
            }
        } catch (error) {
            console.error('Error:', error);
            document.getElementById('message').textContent = 'An error occurred. Please try again.';
        }
    });

    document.getElementById('addMealForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedCategory && !selectedSubcategory) {
            document.getElementById('message').textContent = 'Please select a category or subcategory first.';
            return;
        }
        const mealName = document.getElementById('mealName').value;
        const mealPrice = document.getElementById('mealPrice').value;

        try {
            const response = await fetch('/add-meal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: mealName,
                    price: mealPrice,
                    categoryId: selectedCategory,
                    subcategoryId: selectedSubcategory
                }),
            });

            const data = await response.json();
            document.getElementById('message').textContent = data.message;
            if (data.success) {
                loadMeals(selectedCategory, selectedSubcategory);
            }
        } catch (error) {
            console.error('Error:', error);
            document.getElementById('message').textContent = 'An error occurred. Please try again.';
        }
    });

    let selectedWaiter = null;
    let selectedChef = null;
    let selectedMeal = null;

    async function loadWaiters() {
        try {
            const response = await fetch('/waiters');
            const data = await response.json();
            if (data.success) {
                const waiterList = document.getElementById('waiterList');
                waiterList.innerHTML = '';
                data.waiters.forEach(waiter => {
                    const waiterButton = document.createElement('button');
                    waiterButton.textContent = waiter.name;
                    waiterButton.addEventListener('click', () => {
                        selectedWaiter = waiter.id;
                        document.querySelectorAll('#waiterList button').forEach(btn => btn.classList.remove('active'));
                        waiterButton.classList.add('active');
                        document.getElementById('deleteWaiterButton').disabled = false;
                    });
                    waiterList.appendChild(waiterButton);
                });
            }
        } catch (error) {
            console.error('Error loading waiters:', error);
        }
    }

    async function deleteWaiter() {
        if (!selectedWaiter) return;
        try {
            const response = await fetch(`/delete-waiter/${selectedWaiter}`, { method: 'DELETE' });
            const data = await response.json();
            document.getElementById('message').textContent = data.message;
            if (data.success) {
                loadWaiters();
                document.getElementById('deleteWaiterButton').disabled = true;
            }
        } catch (error) {
            console.error('Error deleting waiter:', error);
        }
    }

    document.getElementById('deleteWaiterButton').addEventListener('click', deleteWaiter);

    async function loadChefs() {
        try {
            const response = await fetch('/chefs');
            const data = await response.json();
            if (data.success) {
                const chefList = document.getElementById('chefList');
                chefList.innerHTML = '';
                data.chefs.forEach(chef => {
                    const chefButton = document.createElement('button');
                    chefButton.textContent = chef.name;
                    chefButton.addEventListener('click', () => {
                        selectedChef = chef.id;
                        document.querySelectorAll('#chefList button').forEach(btn => btn.classList.remove('active'));
                        chefButton.classList.add('active');
                        document.getElementById('deleteChefButton').disabled = false;
                    });
                    chefList.appendChild(chefButton);
                });
            }
        } catch (error) {
            console.error('Error loading chefs:', error);
        }
    }

    async function deleteChef() {
        if (!selectedChef) return;
        try {
            const response = await fetch(`/delete-chef/${selectedChef}`, { method: 'DELETE' });
            const data = await response.json();
            document.getElementById('message').textContent = data.message;
            if (data.success) {
                loadChefs();
                document.getElementById('deleteChefButton').disabled = true;
            }
        } catch (error) {
            console.error('Error deleting chef:', error);
        }
    }

    document.getElementById('deleteChefButton').addEventListener('click', deleteChef);

    async function loadMeals(categoryId, subcategoryId = null) {
        try {
            const response = await fetch(`/meals/${categoryId}${subcategoryId ? `/${subcategoryId}` : ''}`);
            const data = await response.json();
            if (data.success) {
                const mealList = document.getElementById('mealList');
                mealList.innerHTML = '';
                data.meals.forEach(meal => {
                    const mealButton = document.createElement('button');
                    mealButton.textContent = `${meal.name} - $${meal.price.toFixed(2)}`;
                    mealButton.addEventListener('click', () => {
                        selectedMeal = meal.id;
                        document.querySelectorAll('#mealList button').forEach(btn => btn.classList.remove('active'));
                        mealButton.classList.add('active');
                        document.getElementById('deleteMealButton').disabled = false;
                    });
                    mealList.appendChild(mealButton);
                });
            }
        } catch (error) {
            console.error('Error loading meals:', error);
        }
    }

    async function deleteMeal() {
        if (!selectedMeal) return;
        try {
            const response = await fetch(`/delete-meal/${selectedMeal}`, { method: 'DELETE' });
            const data = await response.json();
            document.getElementById('message').textContent = data.message;
            if (data.success) {
                loadMeals(selectedCategory, selectedSubcategory);
                document.getElementById('deleteMealButton').disabled = true;
            }
        } catch (error) {
            console.error('Error deleting meal:', error);
        }
    }

    document.getElementById('deleteMealButton').addEventListener('click', deleteMeal);

    async function loadCategories() {
        try {
            const response = await fetch('/categories');
            const data = await response.json();
            if (data.success) {
                const categoryList = document.getElementById('categoryList');
                categoryList.innerHTML = '';
                data.categories.forEach(category => {
                    const categoryButton = document.createElement('button');
                    categoryButton.textContent = category.name;
                    categoryButton.addEventListener('click', () => {
                        selectedCategory = category.id;
                        document.querySelectorAll('#categoryList button').forEach(btn => btn.classList.remove('active'));
                        categoryButton.classList.add('active');
                        document.getElementById('deleteCategoryButton').disabled = false;
                        loadSubcategories(category.id); // Load subcategories for the selected category
                    });
                    categoryList.appendChild(categoryButton);
                });
            }
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    async function loadSubcategories(categoryId) {
        try {
            const response = await fetch(`/subcategories/${categoryId}`);
            const data = await response.json();
            if (data.success) {
                const subcategoryList = document.getElementById('subcategoryList');
                subcategoryList.innerHTML = '';
                data.subcategories.forEach(subcategory => {
                    const subcategoryButton = document.createElement('button');
                    subcategoryButton.textContent = subcategory.name;
                    subcategoryButton.addEventListener('click', () => {
                        selectedSubcategory = subcategory.id;
                        document.querySelectorAll('#subcategoryList button').forEach(btn => btn.classList.remove('active'));
                        subcategoryButton.classList.add('active');
                        document.getElementById('deleteSubcategoryButton').disabled = false;
                    });
                    subcategoryList.appendChild(subcategoryButton);
                });
            }
        } catch (error) {
            console.error('Error loading subcategories:', error);
        }
    }

    async function deleteCategory() {
        if (!selectedCategory) return;
        try {
            const response = await fetch(`/delete-category/${selectedCategory}`, { method: 'DELETE' });
            const data = await response.json();
            document.getElementById('message').textContent = data.message;
            if (data.success) {
                loadCategories();
                document.getElementById('deleteCategoryButton').disabled = true;
            }
        } catch (error) {
            console.error('Error deleting category:', error);
        }
    }

    document.getElementById('deleteCategoryButton').addEventListener('click', deleteCategory);

    async function deleteSubcategory() {
        if (!selectedSubcategory) return;
        try {
            const response = await fetch(`/delete-subcategory/${selectedSubcategory}`, { method: 'DELETE' });
            const data = await response.json();
            document.getElementById('message').textContent = data.message;
            if (data.success) {
                loadSubcategories(selectedCategory);
                document.getElementById('deleteSubcategoryButton').disabled = true;
            }
        } catch (error) {
            console.error('Error deleting subcategory:', error);
        }
    }

    document.getElementById('deleteSubcategoryButton').addEventListener('click', deleteSubcategory);

 
// Chef Management
    document.getElementById('addChefForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const chefName = document.getElementById('chefName').value;

        try {
            const response = await fetch('/add-chef', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: chefName }),
            });

            const data = await response.json();
            document.getElementById('message').textContent = data.message;
            if (data.success) {
                loadChefs();
            }
        } catch (error) {
            console.error('Error:', error);
            document.getElementById('message').textContent = 'An error occurred. Please try again.';
        }
    });

    // Initial load
    loadCategories();
    loadWaiters();
    loadChefs(); // Load chefs on initial load


    function loadAnalysisOrders() {
        fetch('/completed-orders') // Assuming the same endpoint is used
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    applyAnalysisFilters(data.orders);
                } else {
                    console.error('Failed to fetch analysis orders:', data.message);
                }
            })
            .catch(error => console.error('Error fetching analysis orders:', error));
    }



    // Event listeners for analysis filters

    // Initial call to load analysis orders


    function formatTimeTaken(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        return `${hours}h ${minutes}m ${remainingSeconds}s`;
    }


    // Call the function to populate the chef filter

    // Ensure this function is called when a category or subcategory is selected
    document.getElementById('categoryList').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            loadMeals(selectedCategory, selectedSubcategory);
        }
    });

    document.getElementById('subcategoryList').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            loadMeals(selectedCategory, selectedSubcategory);
        }
    });

    // Back to Login Button
    document.getElementById('backToLogin').addEventListener('click', () => {
        ipcRenderer.send('load-page', 'login');
    });

    // Function to load captains
    async function loadCaptains() {
        try {
            const response = await fetch('/captains');
            const data = await response.json();
            if (data.success) {
                const captainList = document.getElementById('captainList');
                captainList.innerHTML = '';
                data.captains.forEach(captain => {
                    const captainDiv = document.createElement('div');
                    captainDiv.className = 'captain-item';
                    captainDiv.innerHTML = `
                        <span>${captain.username} - ${captain.password}</span>
                        <button class="delete-captain" data-id="${captain.id}">Delete</button>
                    `;
                    captainList.appendChild(captainDiv);
                });

                // Add event listeners for delete buttons
                document.querySelectorAll('.delete-captain').forEach(button => {
                    button.addEventListener('click', async (e) => {
                        const captainId = e.target.getAttribute('data-id');
                        await deleteCaptain(captainId);
                    });
                });
            }
        } catch (error) {
            console.error('Error loading captains:', error);
        }
    }

    // Function to delete a captain
    async function deleteCaptain(captainId) {
        try {
            const response = await fetch(`/delete-captain/${captainId}`, { method: 'DELETE' });
            const data = await response.json();
            document.getElementById('message').textContent = data.message;
            if (data.success) {
                loadCaptains(); // Reload captains after deletion
            }
        } catch (error) {
            console.error('Error deleting captain:', error);
        }
    }

    // Initial load
    loadCaptains();

    // Event listener for loading analysis data

    async function loadAnalysisData(date) {
        try {
            const response = await fetch(`/analysis-data?date=${date}`);
            const data = await response.json();
            const selectedDate = date;
            showNotification('Analysis data received:', data);
            if (data.success) {
                await displayAnalysisData(data.categories,selectedDate, 'Single Day Analysis');
            } else {
                showNotification('Failed to fetch analysis data:', data.message);
            }
        } catch (error) {
            showNotification('Error fetching analysis data:', error);
        }
    }

    async function loadDateRangeAnalysis(startDate, endDate) {
        try {
            const aggregatedData = await fetchDateRangeData(startDate, endDate);
            const selectedDate = startDate + '--to--' + endDate;
            showNotification('Aggregated data:', aggregatedData);
            await displayAnalysisData(aggregatedData,selectedDate, 'Date Range Analysis');
        } catch (error) {
            showNotification('Error fetching date range analysis data:', error);
        }
    }

    async function displayAnalysisData(categories, analysisType, selectedDate) {
        showNotification('Displaying analysis data:', categories, analysisType);
        const container = document.getElementById('analysisDataContainer');
        container.innerHTML = `<h2>${analysisType} for ${selectedDate}</h2>`;

        let totalOrders = 0;
        for (const [categoryId, category] of Object.entries(categories)) {
            const categoryDiv = document.createElement('div');
            categoryDiv.innerHTML = `<h3>Category ${category.name}</h3>`;

            for (const [subcategoryId, subcategory] of Object.entries(category.subcategories)) {
                const subcategoryDiv = document.createElement('div');
                subcategoryDiv.innerHTML = `<h4>${subcategoryId}</h4>`;

                const table = document.createElement('table');
                table.className = 'analysis-table';

                const headerRow = document.createElement('tr');
                headerRow.innerHTML = `
                    <th>Meal</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Total Price</th>
                `;
                table.appendChild(headerRow);

                let subcategoryTotal = { quantity: 0, totalPrice: 0 };

                // Display meal data
                subcategory.meals.forEach(meal => {
                    if (meal.name !== 'Total') {
                        const mealRow = document.createElement('tr');
                        mealRow.innerHTML = `
                            <td>${meal.name}</td>
                            <td>${meal.quantity}</td>
                            <td>$${meal.unitPrice.toFixed(2)}</td>
                            <td>$${meal.totalPrice.toFixed(2)}</td>
                        `;
                        table.appendChild(mealRow);
                        subcategoryTotal.quantity += meal.quantity;
                        subcategoryTotal.totalPrice += meal.totalPrice;
                        totalOrders += meal.quantity;
                    }
                });

                // Add total row for subcategory
                const totalRow = document.createElement('tr');
                totalRow.className = 'total-row';
                totalRow.innerHTML = `
                    <td><strong>Total</strong></td>
                    <td><strong>${subcategoryTotal.quantity}</strong></td>
                    <td>-</td>
                    <td><strong>$${subcategoryTotal.totalPrice.toFixed(2)}</strong></td>
                `;
                table.appendChild(totalRow);

                subcategoryDiv.appendChild(table);
                categoryDiv.appendChild(subcategoryDiv);
            }

            container.appendChild(categoryDiv);
        }

        updateOrderCount(totalOrders);
    }


    function updateOrderCount(count) {
        const orderCountBar = document.getElementById('orderCountBar');
        orderCountBar.textContent = `Total Orders: ${count}`;
    }

    // Event listeners for analysis buttons
    document.getElementById('loadSingleDayAnalysis').addEventListener('click', () => {
        const selectedDate = document.getElementById('analysisDatePicker').value;
        if (selectedDate) {
            loadAnalysisData(selectedDate);
        } else {
            alert('Please select a date for analysis.');
        }
    });

    document.getElementById('loadDateRangeAnalysis').addEventListener('click', () => {
        const startDate = document.getElementById('analysisStartDate').value;
        const endDate = document.getElementById('analysisEndDate').value;
        if (startDate && endDate) {
            loadDateRangeAnalysis(startDate, endDate);
        } else {
            alert('Please select both start and end dates for analysis.');
        }
    });

    // Helper functions to fetch categories and meals
    async function fetchCategories() {
        try {
            const response = await fetch('/categories');
            const data = await response.json();
            console.log('Categories fetched:', data.categories);
            return data.categories;
        } catch (error) {
            console.error('Error fetching categories:', error);
            return [];
        }
    }

    async function fetchMeals() {
        try {
            const response = await fetch('/all-meals');
            const data = await response.json();
            console.log('Meals fetched:', data.meals);
            return data.meals;
        } catch (error) {
            console.error('Error fetching meals:', error);
            return [];
        }
    }

    async function fetchDateRangeData(startDate, endDate) {
        const response = await fetch(`/analysis-data?startDate=${startDate}&endDate=${endDate}`);
        const data = await response.json();
        if (data.success) {
            return data.categories;
        } else {
            throw new Error(data.message);
        }
    }

    // Add this function to load the daily summary
    async function loadDailySummary() {
        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const formattedDate = yesterday.toISOString().split('T')[0]; // Format: YYYY-MM-DD

            console.log('Fetching daily summary for:', formattedDate);

            const response = await fetch(`/daily-summary?date=${formattedDate}`);
            const data = await response.json();
            console.log('Received daily summary data:', data);

            if (data.success) {
                displayDailySummary(data.orders, formattedDate);
            } else {
                console.error('Failed to fetch daily summary:', data.message);
            }
        } catch (error) {
            console.error('Error fetching daily summary:', error);
        }
    }

    // Add this function to display the daily summary
    function displayDailySummary(orders, date) {
        console.log('Displaying daily summary for:', date);
        console.log('Orders to display:', orders);

        const tableBody = document.querySelector('#dailySummaryTable tbody');
        tableBody.innerHTML = '';

        // Add a header row with the date
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `<th colspan="5">Summary for ${new Date(date).toLocaleDateString()}</th>`;
        tableBody.appendChild(headerRow);

        // Add column headers
        const columnHeaders = document.createElement('tr');
        columnHeaders.innerHTML = `
            <th>Time Taken</th>
            <th>Chef</th>
            <th>Waiter</th>
            <th>Meals</th>
            <th>Total</th>
        `;
        tableBody.appendChild(columnHeaders);

        orders.forEach(order => {
            console.log('Processing order:', order);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${formatTimeTaken(order.time_taken)}</td>
                <td>${order.chef_name}</td>
                <td>${order.waiter_name}</td>
                <td>${formatMeals(order.meals)}</td>
                <td>$${order.calculated_total.toFixed(2)}</td>
            `;
            tableBody.appendChild(row);
        });

        // Add a summary row
        const summaryRow = document.createElement('tr');
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, order) => sum + order.calculated_total, 0);
        console.log('Total revenue calculated:', totalRevenue);

        summaryRow.innerHTML = `
            <td colspan="4"><strong>Total Orders: ${totalOrders}</strong></td>
            <td><strong>Total Revenue: $${totalRevenue.toFixed(2)}</strong></td>
        `;
        tableBody.appendChild(summaryRow);
    }

    // Helper function to format meals
    function formatMeals(meals) {
        return meals.map(meal => `${meal.name} (${meal.quantity} x $${meal.price})`).join(', ');
    }

    // Add this to your existing tab switching logic
    dailySummaryTab.addEventListener('click', () => {
        showTab(dailySummaryContent);
        loadDailySummary();
    });

    // Print Analysis Button
    const printAnalysisButton = document.getElementById('printAnalysisButton');
    printAnalysisButton.addEventListener('click', () => {
        const content = document.getElementById('analysisDataContainer');
        printContent(content, 'Analysis Report');
    });

    // Print Daily Summary Button
    const printDailySummaryButton = document.getElementById('printDailySummaryButton');
    printDailySummaryButton.addEventListener('click', () => {
        const content = document.getElementById('dailySummaryTable');
        printContent(content, 'Daily Summary Report');
    });

    
    ipcRenderer.on('wrote-pdf', (event, pdfData) => {
        const blob = new Blob([pdfData], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'report.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    ipcRenderer.on('error', (event, error) => {
        showNotification('Error generating PDF: ' + error, 'error');
    });

    const dailySummaryDatePicker = document.getElementById('dailySummaryDatePicker');
    const loadDailySummaryButton = document.getElementById('loadDailySummary');

    // Set default date to yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    dailySummaryDatePicker.valueAsDate = yesterday;

    // Event listener for the Load Summary button
    loadDailySummaryButton.addEventListener('click', () => {
        const selectedDate = dailySummaryDatePicker.value;
        if (selectedDate) {
            loadDailySummary(selectedDate);
        } else {
            showNotification('Please select a date for the daily summary.', 'info');
        }
    });
    // public/admin.js
// public/admin.js
document.getElementById('updateMealPriceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newMealPrice = document.getElementById('newMealPrice').value;

    try {
        const response = await fetch(`/update-meal-price/${selectedMeal}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ newPrice: newMealPrice }),
        });
        const data = await response.json();
        if (data.success) {
            showNotification('Meal price updated successfully');
            // Update the meal list with the new price
            loadMeals();
        } else {
           showNotification('Failed to update meal price:', data.message);
        }
    } catch (error) {
        showNotification('Error updating meal price:', error);
    }
});
    // Update the loadDailySummary function to accept a date parameter
    async function loadDailySummary(date) {
        try {
            console.log('Fetching daily summary for:', date);

            const response = await fetch(`/daily-summary?date=${date}`);
            const data = await response.json();
            console.log('Received daily summary data:', data);

            if (data.success) {
                displayDailySummary(data.orders, date);
            } else {
                showNotification('Failed to fetch daily summary: ' + data.message, 'error');
            }
        } catch (error) {
            showNotification('Error fetching daily summary: ' + error.message, 'error');
        }
    }

    // Update the tab switching logic for the daily summary
    dailySummaryTab.addEventListener('click', () => {
        showTab(dailySummaryContent);
        // Load the summary for the date in the date picker (which defaults to yesterday)
        loadDailySummary(dailySummaryDatePicker.value);
    });

    // Add event listener for the new tab
    document.getElementById('manageCompletedOrdersTab').addEventListener('click', () => {
        showTab(document.getElementById('manageCompletedOrdersContent'));
        loadCompletedOrders();
    });
    async function exportAndDeleteCompletedOrders(filename) {
        try {
            // Fetch all completed orders and their items
            const response = await fetch('/all-completed-orders');
            const data = await response.json();
    
            if (!data.success) {
                throw new Error(data.message);
            }
    
            // Generate an Excel file from the fetched data
            generateExcelFile(data.orders, filename);
    
            // Delete all completed orders and their items
            const deleteResponse = await fetch('/delete-completed-orders', { method: 'DELETE' });
            const deleteData = await deleteResponse.json();
    
            if (!deleteData.success) {
                throw new Error(deleteData.message);
            }
    
            showNotification('All completed orders exported and deleted successfully', 'success');
            loadCompletedOrders(); // Reload orders after deletion
        } catch (error) {
            showNotification('Error exporting and deleting completed orders: ' + error.message, 'error');
        }
    }
    
    function showFilenamePrompt() {
        const modal = document.createElement('div');
        modal.className = 'filename-modal';
        modal.innerHTML = `
            <div class="filename-modal-content">
                <h2>Enter Filename</h2>
                <input type="text" id="filenameInput" placeholder="Enter filename">
                <button id="confirmFilename">OK</button>
                <button id="cancelFilename">Cancel</button>
            </div>
        `;
        document.body.appendChild(modal);
    
        document.getElementById('confirmFilename').addEventListener('click', () => {
            const filename = document.getElementById('filenameInput').value;
            if (filename) {
                modal.remove();
                exportAndDeleteCompletedOrders(filename);
            } else {
                showNotification('Filename is required', 'error');
            }
        });
    
        document.getElementById('cancelFilename').addEventListener('click', () => {
            modal.remove();
        });
    }
    
    // Function to load completed orders
    async function loadCompletedOrders() {
        try {
            const response = await fetch('/all-completed-orders');
            const data = await response.json();
            if (data.success) {
                const completedOrdersList = document.getElementById('completedOrdersList');
                completedOrdersList.innerHTML = '';
                data.orders.forEach(order => {
                    const orderDiv = document.createElement('div');
                    orderDiv.textContent = `Order ID: ${order.id}, Total: $${order.total.toFixed(2)}`;
                    completedOrdersList.appendChild(orderDiv);
                });
            } else {
                showNotification('Failed to load completed orders: ' + data.message, 'error');
            }
        } catch (error) {
            showNotification('Error loading completed orders: ' + error.message, 'error');
        }
    }

    // Add event listener for the delete button
    document.getElementById('deleteCompletedOrdersButton').addEventListener('click', () => {
        // Create a custom confirmation notification
        const confirmationMessage = 'Are you sure you want to delete all completed orders from the entire database?';
        const confirmationNotification = document.createElement('div');
        confirmationNotification.className = 'notification confirm';
        confirmationNotification.innerHTML = `
            <p>${confirmationMessage}</p>
            <button id="confirmDelete">Yes</button>
            <button id="cancelDelete">No</button>
        `;
        document.body.appendChild(confirmationNotification);

        // Add event listeners for the confirmation buttons
        document.getElementById('confirmDelete').addEventListener('click', async () => {
            confirmationNotification.remove();
            showFilenamePrompt();

        });

        document.getElementById('cancelDelete').addEventListener('click', () => {
            confirmationNotification.remove(); // Remove the confirmation notification
        });
    });
});

