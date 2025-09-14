// Configurare Supabase - Înlocuiește cu datele tale
const SUPABASE_URL = 'https://lyeyfrdhjqqiedngvlfe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5ZXlmcmRoanFxaWVkbmd2bGZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4MzI1MTYsImV4cCI6MjA3MzQwODUxNn0.UuwwPDG0_7ad5IRdrVgQOhbE4Bni2v0YuShTNyngm2I';

// Inițializare client Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variabile globale
let currentUser = null;

// Verifică sesiunea curentă la încărcarea paginii
document.addEventListener('DOMContentLoaded', async () => {
    await checkSession();
    updateAuthUI();
    setupFormListeners();
    updateAuthLinks();
});

// Verifică sesiunea utilizatorului
async function checkSession() {
    const sessionData = localStorage.getItem('userSession');
    if (sessionData) {
        currentUser = JSON.parse(sessionData);
        console.log('Utilizator autentificat:', currentUser);
    }
}

// Actualizează interfața în funcție de starea autentificării
function updateAuthUI() {
    const authButtons = document.getElementById('authButtons');
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    const adminBtn = document.getElementById('adminBtn');
    const heroMessage = document.getElementById('heroMessage');

    if (currentUser) {
        // Utilizator autentificat
        authButtons.style.display = 'none';
        userInfo.classList.add('show');
        userName.textContent = currentUser.name;
        
        if (currentUser.role === 'admin') {
            userRole.style.display = 'inline';
            adminBtn.style.display = 'inline-block';
        }
        
        // Personalizează mesajul
        if (heroMessage) {
            heroMessage.textContent = `Bine ai venit, ${currentUser.name}! Continuă să înveți!`;
        }
    } else {
        // Utilizator neautentificat
        authButtons.style.display = 'flex';
        userInfo.classList.remove('show');
        
        if (heroMessage) {
            heroMessage.textContent = 'Alătură-te comunității noastre pentru a excela la matematică!';
        }
    }
}

// Actualizează link-urile care necesită autentificare
function updateAuthLinks() {
    const authRequiredLinks = document.querySelectorAll('[data-requires-auth="true"]');
    
    authRequiredLinks.forEach(link => {
        if (currentUser) {
            // Elimină blocarea dacă utilizatorul este autentificat
            link.classList.remove('locked');
            link.onclick = null;
            const lockIcon = link.querySelector('.auth-lock');
            if (lockIcon) {
                lockIcon.style.display = 'none';
            }
        } else {
            // Blochează link-ul dacă nu este autentificat
            link.classList.add('locked');
            link.onclick = (e) => {
                e.preventDefault();
                showAlert('Te rugăm să te conectezi pentru a accesa această secțiune!', 'warning');
                openModal('loginModal');
            };
        }
    });
}

// Configurează ascultătorii pentru formulare
function setupFormListeners() {
    // Formular de înregistrare
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }

    // Formular de conectare
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
}

// Gestionează înregistrarea
async function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const classValue = parseInt(document.getElementById('registerClass').value);
    
    const registerError = document.getElementById('registerError');
    const registerSuccess = document.getElementById('registerSuccess');
    const registerSubmitBtn = document.getElementById('registerSubmitBtn');
    
    // Reset mesaje
    registerError.style.display = 'none';
    registerSuccess.style.display = 'none';
    
    // Dezactivează butonul
    registerSubmitBtn.disabled = true;
    registerSubmitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Se înregistrează...';
    
    try {
        // Verifică dacă email-ul există deja
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();
        
        if (existingUser) {
            throw new Error('Acest email este deja înregistrat!');
        }
        
        // Hash-uiește parola (în producție, folosește bcrypt pe server)
        const hashedPassword = btoa(password); // Simplu pentru demo
        
        // Înregistrează utilizatorul
        const { data, error } = await supabase
            .from('users')
            .insert([{
                name: name,
                email: email,
                password_hash: hashedPassword,
                class: classValue,
                role: 'student'
            }])
            .select()
            .single();
        
        if (error) throw error;
        
        registerSuccess.textContent = 'Înregistrare reușită! Te poți conecta acum.';
        registerSuccess.style.display = 'block';
        
        // Resetează formularul
        registerForm.reset();
        
        // Închide modalul după 2 secunde
        setTimeout(() => {
            closeModal('registerModal');
            openModal('loginModal');
        }, 2000);
        
    } catch (error) {
        registerError.textContent = error.message;
        registerError.style.display = 'block';
    } finally {
        registerSubmitBtn.disabled = false;
        registerSubmitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Înregistrează-te';
    }
}

// Gestionează conectarea
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    const loginError = document.getElementById('loginError');
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');
    
    // Reset mesaje
    loginError.style.display = 'none';
    
    // Dezactivează butonul
    loginSubmitBtn.disabled = true;
    loginSubmitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Se conectează...';
    
    try {
        // Hash-uiește parola pentru comparare
        const hashedPassword = btoa(password);
        
        // Verifică credențialele
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('password_hash', hashedPassword)
            .maybeSingle(); // Folosește maybeSingle pentru a evita eroarea când nu găsește
        
        if (error || !data) {
            throw new Error('Email sau parolă incorectă!');
        }
        
        // Salvează sesiunea
        currentUser = data;
        localStorage.setItem('userSession', JSON.stringify(data));
        
        // Actualizează UI
        updateAuthUI();
        updateAuthLinks();
        
        // Închide modalul
        closeModal('loginModal');
        
        // Afișează mesaj de succes
        showAlert(`Bine ai venit, ${data.name}!`, 'success');
        
        // Redirecționează admin-ul
        if (data.role === 'admin') {
            setTimeout(() => {
                showAlert('Accesează panoul de administrare din meniu!', 'info');
            }, 1500);
        }
        
    } catch (error) {
        console.error('Eroare login:', error);
        loginError.textContent = error.message || 'Email sau parolă incorectă!';
        loginError.style.display = 'block';
    } finally {
        loginSubmitBtn.disabled = false;
        loginSubmitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Conectează-te';
    }
}

// Deconectare
function logout() {
    localStorage.removeItem('userSession');
    currentUser = null;
    updateAuthUI();
    updateAuthLinks();
    showAlert('Te-ai deconectat cu succes!', 'info');
}

// Funcții pentru modal
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

// Toggle meniu mobil
function toggleMobileMenu() {
    const navLinks = document.getElementById('navLinks');
    navLinks.classList.toggle('active');
}

// Afișează alerte
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}

// Navigare către panoul admin
function goToAdmin() {
    if (currentUser && currentUser.role === 'admin') {
        window.location.href = 'admin.html';
    } else {
        showAlert('Nu ai permisiunea de a accesa această pagină!', 'error');
    }
}

// Funcție pentru salvarea notei la test
async function saveTestGrade(testId, score, timeSpent = null) {
    if (!currentUser) {
        showAlert('Trebuie să fii conectat pentru a salva nota!', 'error');
        return false;
    }
    
    try {
        const { data, error } = await supabase
            .from('grades')
            .insert([{
                user_id: currentUser.id,
                test_id: testId,
                score: score,
                time_spent: timeSpent
            }])
            .select();
        
        if (error) {
            if (error.code === '23505') { // Duplicate key
                showAlert('Ai dat deja acest test!', 'warning');
            } else {
                throw error;
            }
            return false;
        }
        
        showAlert(`Test finalizat! Nota ta: ${score}/100`, 'success');
        return true;
        
    } catch (error) {
        console.error('Eroare la salvarea notei:', error);
        showAlert('Eroare la salvarea notei!', 'error');
        return false;
    }
}

// Funcție pentru obținerea notelor elevului curent
async function getMyGrades() {
    if (!currentUser) return [];
    
    try {
        const { data, error } = await supabase
            .from('grades')
            .select(`
                *,
                tests (test_name, class, category)
            `)
            .eq('user_id', currentUser.id)
            .order('completed_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
        
    } catch (error) {
        console.error('Eroare la obținerea notelor:', error);
        return [];
    }
}

// Export funcții pentru utilizare în alte pagini
window.supabaseConnection = {
    supabase,
    currentUser: () => currentUser,
    saveTestGrade,
    getMyGrades,
    logout,
    showAlert
};
