// Global JavaScript functions

// Function to handle logout
function handleLogout() {
    // Clear localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');

    // Redirect to login page
    window.location.href = 'index.html';
}

// Function to initialize sidebar (if needed)
function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        // Get current page to set active nav item
        const currentPage = window.location.pathname.split('/').pop();

        // Add basic sidebar content if it's empty
        if (sidebar.innerHTML.trim() === '') {
            sidebar.innerHTML = `
                <div class="sidebar-content">
                    <div class="sidebar-header">
                        <h3>TechNoteCore</h3>
                    </div>
                    <nav class="sidebar-nav">
                        <a href="dashboard.html" class="nav-item ${currentPage === 'dashboard.html' ? 'active' : ''}">
                            <i class="fas fa-home"></i> Dashboard
                        </a>
                        <a href="upload.html" class="nav-item ${currentPage === 'upload.html' ? 'active' : ''}">
                            <i class="fas fa-upload"></i> Upload Materials
                        </a>
                        <a href="my-materials.html" class="nav-item ${currentPage === 'my-materials.html' ? 'active' : ''}">
                            <i class="fas fa-file-alt"></i> My Materials
                        </a>
                        <a href="#" class="nav-item" onclick="handleLogout()">
                            <i class="fas fa-sign-out-alt"></i> Logout
                        </a>
                    </nav>
                </div>
            `;
        }
    }
}

// Function to initialize hamburger menu for mobile
function initHamburger() {
    const hamburger = document.getElementById('hamburger');
    const sidebar = document.getElementById('sidebar');

    if (hamburger && sidebar) {
        hamburger.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }
}

// Initialize common features when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    initHamburger();
});
