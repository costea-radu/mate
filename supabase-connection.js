// Configurația Supabase
// Înlocuiește cu datele tale din Supabase Dashboard
const SUPABASE_URL = 'https://hwepdhwcctbpihnhchww.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3ZXBkaHdjY3RicGlobmhjaHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NTU2MDcsImV4cCI6MjA3MzMzMTYwN30.SsDkrmLePh4wb_KGm-C5Y2cdevRynjozGydXc9yTpHE';

// Inițializarea clientului Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variabile globale
let currentUser = null;

// Inițializarea aplicației
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    setupEventListeners();
    updateAuthRequiredLinks();
});

// Verificarea stării de autentificare
async function checkAuthStatus() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            await loadUserData();
            showUserInterface();
        } else {
            showAuthInterface();
        }
    } catch (error) {
        console.error('Eroare la verificarea autentificării:', error);
        showAuthInterface();
    }
}

// Încărcarea datelor utilizatorului
async function loadUserData() {
    try {
        const { data, error } = await supabase.rpc('get_current_user');
        
        if (error) throw error;
        
        if (data && !data.error) {
            currentUser = data;
            updateUserInfo();
        } else {
            throw new Error(data?.error || 'Datele utilizatorului nu au fost găsite');
        }
    } catch (error) {
        console.error('Eroare la încărcarea datelor utilizatorului:', error);
        showAlert('Eroare la încărcarea profilului', 'error');
    }
}

// Actualizarea interfeței cu informațiile utilizatorului
function updateUserInfo() {
    if (!currentUser) return;
    
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    const adminBtn = document.getElementById('adminBtn');
    const heroMessage = document.getElementById('heroMessage');
    
    if (userName) {
        userName.textContent = currentUser.name;
    }
    
    if (currentUser.is_admin) {
        userRole.style.display = 'inline-block';
        adminBtn.style.display = 'inline-block';
    }
    
    if (heroMessage) {
        heroMessage.textContent = `Bun venit înapoi, ${currentUser.name}! Continuă să înveți!`;
    }
}

// Afișarea interfeței pentru utilizatori autentificați
function showUserInterface() {
    const authButtons = document.getElementById('authButtons');
    const userInfo = document.getElementById('userInfo');
    
    authButtons.style.display = 'none';
    userInfo.classList.add('show');
    
    updateAuthRequiredLinks();
}

// Afișarea interfeței pentru utilizatori neautentificați
function showAuthInterface() {
    const authButtons = document.getElementById('authButtons');
    const userInfo = document.getElementById('userInfo');
    
    authButtons.style.display = 'flex';
    userInfo.classList.remove('show');
    
    updateAuthRequiredLinks();
}

// Actualizarea link-urilor care necesită autentificare
function updateAuthRequiredLinks() {
    const authRequiredLinks = document.querySelectorAll('[data-requires-auth="true"]');
    
    authRequiredLinks.forEach(link => {
        if (currentUser) {
            link.classList.remove('locked');
            const lockIcon = link.querySelector('.auth-lock');
            if (lockIcon) lockIcon.style.display = 'none';
        } else {
            link.classList.add('locked');
            const lockIcon = link.querySelector('.auth-lock');
            if (lockIcon) lockIcon.style.display = 'inline';
            
            // Adaugă event listener pentru click
            link.addEventListener('click', function(e) {
                e.preventDefault();
                showAlert('Trebuie să te conectezi pentru a accesa această secțiune', 'warning');
                openModal('loginModal');
            });
        }
    });
}

// Configurarea event listener-ilor
function setupEventListeners() {
    // Formularul de conectare
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Formularul de înregistrare
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // Ascultarea schimbărilor în starea de autentificare
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN') {
            await loadUserData();
            showUserInterface();
            closeAllModals();
            showAlert('Conectare reușită!', 'success');
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            showAuthInterface();
            showAlert('Te-ai deconectat cu succes!', 'info');
        }
    });
}

// Gestionarea conectării
async function handleLogin(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('loginSubmitBtn');
    const errorDiv = document.getElementById('loginError');
    
    // Resetarea erorilor
    errorDiv.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Se conectează...';
    
    try {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        // Conectarea se va gestiona prin onAuthStateChange
        
    } catch (error) {
        console.error('Eroare la conectare:', error);
        errorDiv.textContent = getErrorMessage(error.message);
        errorDiv.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Conectează-te';
    }
}

// Gestionarea înregistrării
async function handleRegister(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('registerSubmitBtn');
    const errorDiv = document.getElementById('registerError');
    const successDiv = document.getElementById('registerSuccess');
    
    // Resetarea mesajelor
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Se înregistrează...';
    
    try {
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const userClass = parseInt(document.getElementById('registerClass').value);
        
        // Validări
        if (password.length < 6) {
            throw new Error('Parola trebuie să aibă cel puțin 6 caractere');
        }
        
        // Înregistrarea utilizatorului
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    name: name,
                    class: userClass
                }
            }
        });
        
        if (error) throw error;
        
        // Adăugarea în tabelul users după confirmarea email-ului
        if (data.user && !data.user.email_confirmed_at) {
            // Dacă Supabase necesită confirmarea email-ului
            successDiv.textContent = 'Cont creat! Verifică email-ul pentru confirmare.';
            successDiv.style.display = 'block';
        } else {
            // Dacă nu necesită confirmare, adaugă direct în tabel
            await addUserToDatabase(data.user.id, email, name, userClass);
            successDiv.textContent = 'Înregistrare reușită! Poți să te conectezi acum.';
            successDiv.style.display = 'block';
        }
        
        // Resetarea formularului
        document.getElementById('registerForm').reset();
        
    } catch (error) {
        console.error('Eroare la înregistrare:', error);
        errorDiv.textContent = getErrorMessage(error.message);
        errorDiv.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Înregistrează-te';
    }
}

// Adăugarea utilizatorului în baza de date
async function addUserToDatabase(userId, email, name, userClass) {
    const { error } = await supabase
        .from('users')
        .insert([
            {
                id: userId,
                email: email,
                name: name,
                class: userClass
            }
        ]);
    
    if (error) throw error;
}

// Deconectarea
async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    } catch (error) {
        console.error('Eroare la deconectare:', error);
        showAlert('Eroare la deconectare', 'error');
    }
}

// Navigarea către panoul admin
function goToAdmin() {
    if (currentUser && currentUser.is_admin) {
        // Aici poți naviga către pagina admin
        window.location.href = 'admin/admin.html';
    } else {
        showAlert('Nu ai permisiuni de administrator', 'error');
    }
}

// Funcții pentru modal-uri
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    }
}

function closeAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.classList.remove('show');
    });
}

// Închiderea modal-urilor la click pe fundal
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('show');
    }
});

// Toggle pentru meniul mobil
function toggleMobileMenu() {
    const navLinks = document.getElementById('navLinks');
    navLinks.classList.toggle('active');
}

// Afișarea alertelor
function showAlert(message, type = 'info') {
    // Eliminarea alertelor existente
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    document.body.appendChild(alert);
    
    // Eliminarea automată după 5 secunde
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}

// Traducerea mesajelor de eroare
function getErrorMessage(error) {
    const errorMessages = {
        'Invalid login credentials': 'Email sau parolă incorectă',
        'User already registered': 'Utilizatorul este deja înregistrat',
        'Password should be at least 6 characters': 'Parola trebuie să aibă cel puțin 6 caractere',
        'Invalid email': 'Email invalid',
        'Email not confirmed': 'Email-ul nu a fost confirmat'
    };
    
    return errorMessages[error] || error || 'A apărut o eroare neașteptată';
}

// Export pentru utilizare în alte fișiere
window.MateAuth = {
    currentUser: () => currentUser,
    isLoggedIn: () => !!currentUser,
    isAdmin: () => currentUser && currentUser.is_admin,
    logout: logout
};
