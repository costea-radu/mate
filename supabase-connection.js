// supabase-connection.js
// Configurație și funcții pentru conectarea la Supabase

// Configurația Supabase - înlocuiește cu datele tale
const SUPABASE_URL = 'https://bdorzekhilycgonmumga.supabase.co'; // ex: https://your-project.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkb3J6ZWtoaWx5Y2dvbm11bWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NTEyOTksImV4cCI6MjA3MzMyNzI5OX0.uLb9-u8IbJu8CHVNm_Tlkg2sHqBtYAK1RyWferoYK9A';

// Inițializează clientul Supabase
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variabile globale pentru starea aplicației
let currentUser = null;
let currentSession = null;

// ====================
// FUNCȚII DE AUTENTIFICARE
// ====================

// Înregistrare utilizator nou
async function registerUser(fullName, email, password, grade = null) {
    try {
        showLoading('registerSubmitBtn', 'Se înregistrează...');
        
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });

        if (error) throw error;

        // Dacă înregistrarea a fost cu succes, actualizează profilul cu clasa
        if (data.user && grade) {
            await updateUserProfile(data.user.id, { grade: grade });
        }

        showAlert('Înregistrare reușită! Verifică emailul pentru confirmare.', 'success');
        closeModal('registerModal');
        return { success: true, data };

    } catch (error) {
        console.error('Eroare înregistrare:', error);
        showError('registerError', getErrorMessage(error));
        return { success: false, error };
    } finally {
        hideLoading('registerSubmitBtn', 'Înregistrează-te');
    }
}

// Autentificare utilizator
async function loginUser(email, password) {
    try {
        showLoading('loginSubmitBtn', 'Se conectează...');
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        showAlert('Conectare reușită!', 'success');
        closeModal('loginModal');
        return { success: true, data };

    } catch (error) {
        console.error('Eroare conectare:', error);
        showError('loginError', getErrorMessage(error));
        return { success: false, error };
    } finally {
        hideLoading('loginSubmitBtn', 'Conectează-te');
    }
}

// Deconectare utilizator
async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        currentUser = null;
        currentSession = null;
        updateUI();
        showAlert('Deconectat cu succes!', 'info');
        
        // Redirecționează la pagina principală dacă e pe o pagină protejată
        if (window.location.pathname.includes('admin') || 
            window.location.pathname.includes('teste')) {
            window.location.href = '/';
        }

    } catch (error) {
        console.error('Eroare deconectare:', error);
        showAlert('Eroare la deconectare', 'error');
    }
}

// ====================
// FUNCȚII PENTRU PROFILURI
// ====================

// Obține profilul utilizatorului curent
async function getCurrentUserProfile() {
    try {
        const user = supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Eroare obținere profil:', error);
        return null;
    }
}

// Actualizează profilul utilizatorului
async function updateUserProfile(userId, updates) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Eroare actualizare profil:', error);
        return { success: false, error };
    }
}

// ====================
// FUNCȚII PENTRU TESTE
// ====================

// Obține toate testele disponibile pentru o clasă
async function getTestsForGrade(grade) {
    try {
        const { data, error } = await supabase
            .from('tests')
            .select('*')
            .eq('grade', grade)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Eroare obținere teste:', error);
        return [];
    }
}

// Obține un test specific cu întrebările
async function getTestById(testId) {
    try {
        const { data, error } = await supabase
            .from('tests')
            .select('*')
            .eq('id', testId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Eroare obținere test:', error);
        return null;
    }
}

// Pornește o încercare de test
async function startTestAttempt(testId) {
    try {
        if (!currentUser) throw new Error('Utilizatorul nu este autentificat');

        const { data, error } = await supabase
            .from('test_attempts')
            .insert([{
                test_id: testId,
                user_id: currentUser.id,
                answers: {},
                started_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Eroare pornire test:', error);
        return null;
    }
}

// Salvează progresul testului (răspunsuri parțiale)
async function saveTestProgress(attemptId, answers) {
    try {
        const { data, error } = await supabase
            .from('test_attempts')
            .update({ 
                answers: answers,
                updated_at: new Date().toISOString()
            })
            .eq('id', attemptId)
            .select();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Eroare salvare progres:', error);
        return null;
    }
}

// Finalizează testul și calculează scorul
async function submitTest(attemptId, answers, timeSpent) {
    try {
        const { data, error } = await supabase
            .from('test_attempts')
            .update({
                answers: answers,
                time_spent: timeSpent,
                completed_at: new Date().toISOString(),
                is_completed: true
            })
            .eq('id', attemptId)
            .select();

        if (error) throw error;
        
        // Triggerul va calcula automat scorul
        return data[0];
    } catch (error) {
        console.error('Eroare finalizare test:', error);
        return null;
    }
}

// Obține istoricul testelor pentru utilizatorul curent
async function getUserTestHistory(limit = 20) {
    try {
        if (!currentUser) return [];

        const { data, error } = await supabase
            .from('test_attempts')
            .select(`
                *,
                tests (
                    title,
                    subject,
                    grade,
                    total_points
                )
            `)
            .eq('user_id', currentUser.id)
            .eq('is_completed', true)
            .order('completed_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Eroare obținere istoric:', error);
        return [];
    }
}

// ====================
// FUNCȚII PENTRU STATISTICI ȘI CLASAMENTE
// ====================

// Obține statisticile utilizatorului curent
async function getUserStatistics() {
    try {
        if (!currentUser) return null;

        const { data, error } = await supabase
            .rpc('get_user_progress', { user_uuid: currentUser.id });

        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error('Eroare obținere statistici:', error);
        return null;
    }
}

// Obține clasamentul pentru o clasă
async function getLeaderboard(grade = null, limit = 50) {
    try {
        const { data, error } = await supabase
            .rpc('get_grade_leaderboard', { 
                grade_filter: grade 
            })
            .limit(limit);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Eroare obținere clasament:', error);
        return [];
    }
}

// ====================
// FUNCȚII PENTRU ADMINISTRARE (doar pentru admini)
// ====================

// Creează un test nou (doar admin/teacher)
async function createTest(testData) {
    try {
        if (!currentUser || !['admin', 'teacher'].includes(currentUser.role)) {
            throw new Error('Acces interzis');
        }

        const { data, error } = await supabase
            .from('tests')
            .insert([{
                ...testData,
                created_by: currentUser.id
            }])
            .select();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Eroare creare test:', error);
        return { success: false, error };
    }
}

// Obține toate profilurile (doar admin)
async function getAllProfiles() {
    try {
        if (!currentUser || currentUser.role !== 'admin') {
            throw new Error('Acces interzis');
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Eroare obținere profiluri:', error);
        return [];
    }
}

// ====================
// GESTIONAREA STĂRII AUTENTIFICĂRII
// ====================

// Verifică starea autentificării la încărcarea paginii
async function checkAuth() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
            console.error('Eroare verificare sesiune:', error);
            return;
        }

        currentSession = session;
        
        if (session?.user) {
            // Obține profilul complet al utilizatorului
            const profile = await getCurrentUserProfile();
            currentUser = profile ? { ...session.user, ...profile } : session.user;
        } else {
            currentUser = null;
        }

        updateUI();
    } catch (error) {
        console.error('Eroare verificare autentificare:', error);
        currentUser = null;
        updateUI();
    }
}

// Ascultă schimbările în autentificare
supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth state changed:', event, session);
    
    currentSession = session;
    
    if (session?.user) {
        // Obține profilul complet
        const profile = await getCurrentUserProfile();
        currentUser = profile ? { ...session.user, ...profile } : session.user;
    } else {
        currentUser = null;
    }
    
    updateUI();
    
    // Redirecționează după autentificare
    if (event === 'SIGNED_IN') {
        const urlParams = new URLSearchParams(window.location.search);
        const redirectTo = urlParams.get('redirect') || '/';
        if (redirectTo !== window.location.pathname) {
            window.location.href = redirectTo;
        }
    }
});

// ====================
// FUNCȚII UI ȘI UTILITĂȚI
// ====================

// Actualizează interfața în funcție de starea autentificării
function updateUI() {
    const authButtons = document.getElementById('authButtons');
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    const heroMessage = document.getElementById('heroMessage');

    if (currentUser) {
        // Utilizator autentificat
        if (authButtons) authButtons.style.display = 'none';
        if (userInfo) userInfo.classList.add('show');
        if (userName) userName.textContent = currentUser.full_name || currentUser.email;
        
        // Arată rolul dacă e admin
        if (userRole && currentUser.role === 'admin') {
            userRole.style.display = 'inline-block';
        }

        // Actualizează mesajul de bun venit
        if (heroMessage) {
            const greeting = getGreeting();
            heroMessage.textContent = `${greeting}, ${currentUser.full_name || 'Utilizator'}! Continuă să excelezi la matematică!`;
        }

        // Deblochează conținutul care necesită autentificare
        unlockProtectedContent();

    } else {
        // Utilizator neautentificat
        if (authButtons) authButtons.style.display = 'flex';
        if (userInfo) userInfo.classList.remove('show');
        if (heroMessage) {
            heroMessage.textContent = 'Alătură-te comunității noastre pentru a excela la matematică!';
        }

        // Blochează conținutul protejat
        lockProtectedContent();
    }
}

// Deblochează conținutul pentru utilizatori autentificați
function unlockProtectedContent() {
    const protectedLinks = document.querySelectorAll('[data-requires-auth="true"]');
    protectedLinks.forEach(link => {
        link.classList.remove('locked');
        const lockIcon = link.querySelector('.auth-lock');
        if (lockIcon) lockIcon.style.display = 'none';
        
        // Elimină event listener-ul care previne click-ul
        link.onclick = null;
    });
}

// Blochează conținutul pentru utilizatori neautentificați
function lockProtectedContent() {
    const protectedLinks = document.querySelectorAll('[data-requires-auth="true"]');
    protectedLinks.forEach(link => {
        link.classList.add('locked');
        const lockIcon = link.querySelector('.auth-lock');
        if (lockIcon) lockIcon.style.display = 'inline-block';
        
        // Previne navigarea și arată mesaj
        link.onclick = function(e) {
            e.preventDefault();
            showAlert('Pentru a accesa această secțiune, te rugăm să te conectezi.', 'warning');
            openModal('loginModal');
            return false;
        };
    });
}

// Obține salutul în funcție de ora zilei
function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bună dimineața';
    if (hour < 18) return 'Bună ziua';
    return 'Bună seara';
}

// Funcții pentru gestionarea modalelor
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
        // Resetează formularul
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
            clearErrors(modalId);
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        clearErrors(modalId);
    }
}

// Funcții pentru afișarea erorilor și mesajelor
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

function clearErrors(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        const errorElements = modal.querySelectorAll('.error-message, .success-message');
        errorElements.forEach(el => {
            el.style.display = 'none';
            el.textContent = '';
        });
    }
}

function showAlert(message, type = 'info', duration = 5000) {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    document.body.appendChild(alert);
    
    // Elimină alertul după durata specificată
    setTimeout(() => {
        if (alert.parentNode) {
            alert.parentNode.removeChild(alert);
        }
    }, duration);
}

function showLoading(buttonId, text) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.disabled = true;
        button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${text}`;
    }
}

function hideLoading(buttonId, originalText) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

// Conversia mesajelor de eroare în română
function getErrorMessage(error) {
    const messages = {
        'Invalid email or password': 'Email sau parolă incorectă',
        'User already registered': 'Utilizatorul este deja înregistrat',
        'Password should be at least 6 characters': 'Parola trebuie să aibă cel puțin 6 caractere',
        'Email not confirmed': 'Emailul nu a fost confirmat',
        'Invalid email': 'Emailul nu este valid',
        'Weak password': 'Parola este prea slabă',
        'Email already in use': 'Emailul este deja folosit'
    };
    
    return messages[error.message] || error.message || 'A apărut o eroare neașteptată';
}

// ====================
// EVENT LISTENERS
// ====================

// Ascultă pentru încărcarea documentului
document.addEventListener('DOMContentLoaded', function() {
    // Verifică autentificarea la încărcare
    checkAuth();

    // Gestionează formularul de conectare
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            await loginUser(email, password);
        });
    }

    // Gestionează formularul de înregistrare
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const fullName = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const grade = document.getElementById('registerGrade')?.value || null;
            
            await registerUser(fullName, email, password, grade);
        });
    }

    // Închide modalele când se dă click pe backdrop
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });

    // Meniu mobil
    const mobileMenu = document.querySelector('.mobile-menu');
    if (mobileMenu) {
        mobileMenu.addEventListener('click', function() {
            toggleMobileMenu();
        });
    }
});

// Toggle pentru meniul mobil
function toggleMobileMenu() {
    const navLinks = document.getElementById('navLinks');
    if (navLinks) {
        navLinks.classList.toggle('active');
    }
}

// ====================
// FUNCȚII PENTRU VERIFICAREA ACCESULUI
// ====================

// Verifică dacă utilizatorul poate accesa o pagină protejată
function requireAuth() {
    if (!currentUser) {
        const currentPath = window.location.pathname;
        window.location.href = `/?redirect=${encodeURIComponent(currentPath)}`;
        return false;
    }
    return true;
}

// Verifică dacă utilizatorul este admin
function requireAdmin() {
    if (!currentUser || currentUser.role !== 'admin') {
        showAlert('Acces interzis. Doar administratorii pot accesa această pagină.', 'error');
        window.location.href = '/';
        return false;
    }
    return true;
}

// ====================
// EXPORT PENTRU ALTE SCRIPTURI
// ====================

// Fă funcțiile disponibile global
window.supabase = supabase;
window.currentUser = currentUser;
window.registerUser = registerUser;
window.loginUser = loginUser;
window.logout = logout;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleMobileMenu = toggleMobileMenu;
window.requireAuth = requireAuth;
window.requireAdmin = requireAdmin;
window.getUserTestHistory = getUserTestHistory;
window.getTestsForGrade = getTestsForGrade;
window.startTestAttempt = startTestAttempt;
window.saveTestProgress = saveTestProgress;
window.submitTest = submitTest;
window.getUserStatistics = getUserStatistics;
window.getLeaderboard = getLeaderboard;
window.updateUI = updateUI;
