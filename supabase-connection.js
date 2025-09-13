// supabase-connection.js
// Conexiunea la Supabase pentru platforma de matematică

// Configurarea Supabase - ÎNLOCUIEȘTE CU DATELE TALE REALE
const SUPABASE_URL = 'https://iswbotetinyfihfjnhvf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlzd2JvdGV0aW55ZmloZmpuaHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NTMwMDQsImV4cCI6MjA3MzMyOTAwNH0.F8bqKnBVWTjfS8X0Leke5XRa_0OyhalgVvxKx7B6zgc';

// Inițializarea clientului Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variabile globale pentru starea aplicației
let currentUser = null;
let userProfile = null;

// ===========================================
// FUNCȚII DE AUTENTIFICARE
// ===========================================

// Înregistrare utilizator nou
async function registerUser(email, password, fullName, classLevel) {
    try {
        showLoading('registerSubmitBtn');
        
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    name: fullName,
                    class_level: parseInt(classLevel)
                }
            }
        });

        if (error) throw error;

        showAlert('Înregistrare reușită! Verifică-ți email-ul pentru confirmare.', 'success');
        closeModal('registerModal');
        
        return data;
    } catch (error) {
        console.error('Eroare înregistrare:', error);
        showError('registerError', error.message);
        return null;
    } finally {
        hideLoading('registerSubmitBtn', '<i class="fas fa-user-plus"></i> Înregistrează-te');
    }
}

// Conectare utilizator
async function loginUser(email, password) {
    try {
        showLoading('loginSubmitBtn');
        
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        showAlert('Conectare reușită!', 'success');
        closeModal('loginModal');
        
        return data;
    } catch (error) {
        console.error('Eroare conectare:', error);
        showError('loginError', error.message);
        return null;
    } finally {
        hideLoading('loginSubmitBtn', '<i class="fas fa-sign-in-alt"></i> Conectează-te');
    }
}

// Deconectare utilizator
async function logout() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        
        currentUser = null;
        userProfile = null;
        updateUIForAuth();
        showAlert('Deconectare reușită!', 'info');
    } catch (error) {
        console.error('Eroare deconectare:', error);
        showAlert('Eroare la deconectare!', 'error');
    }
}

// ===========================================
// FUNCȚII PENTRU PROFILUL UTILIZATORULUI
// ===========================================

// Obține profilul utilizatorului curent
async function getCurrentUserProfile() {
    try {
        if (!currentUser) return null;

        const { data, error } = await supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Eroare obținere profil:', error);
        return null;
    }
}

// Actualizează profilul utilizatorului
async function updateUserProfile(updates) {
    try {
        if (!currentUser) throw new Error('Utilizator neautentificat');

        const { data, error } = await supabaseClient
            .from('user_profiles')
            .update(updates)
            .eq('id', currentUser.id)
            .select()
            .single();

        if (error) throw error;
        
        userProfile = data;
        updateUIForAuth();
        return data;
    } catch (error) {
        console.error('Eroare actualizare profil:', error);
        return null;
    }
}

// ===========================================
// FUNCȚII PENTRU TESTE
// ===========================================

// Obține testele disponibile pentru clasa utilizatorului
async function getAvailableTests() {
    try {
        if (!userProfile) await getCurrentUserProfile();
        if (!userProfile) return [];

        const { data, error } = await supabaseClient
            .rpc('get_available_tests', {
                p_class_level: userProfile.class_level
            });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Eroare obținere teste:', error);
        return [];
    }
}

// Începe un nou test
async function startTest(testId) {
    try {
        if (!currentUser) throw new Error('Utilizator neautentificat');

        // Obține detaliile testului
        const { data: test, error: testError } = await supabaseClient
            .from('tests')
            .select('*')
            .eq('id', testId)
            .single();

        if (testError) throw testError;

        // Creează o nouă încercare
        const { data, error } = await supabaseClient
            .from('test_attempts')
            .insert({
                user_id: currentUser.id,
                test_id: testId,
                max_score: test.total_points
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Eroare începere test:', error);
        return null;
    }
}

// Salvează progresul testului
async function saveTestProgress(attemptId, answers) {
    try {
        const { data, error } = await supabaseClient
            .from('test_attempts')
            .update({ 
                answers: answers,
                time_spent_minutes: Math.floor((Date.now() - new Date().getTime()) / 60000)
            })
            .eq('id', attemptId)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Eroare salvare progres:', error);
        return null;
    }
}

// Finalizează testul
async function submitTest(attemptId, answers, score) {
    try {
        const { data, error } = await supabaseClient
            .from('test_attempts')
            .update({
                answers: answers,
                score: score,
                completed_at: new Date().toISOString(),
                is_completed: true,
                time_spent_minutes: Math.floor((Date.now() - new Date().getTime()) / 60000)
            })
            .eq('id', attemptId)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Eroare finalizare test:', error);
        return null;
    }
}

// ===========================================
// FUNCȚII PENTRU CLASAMENT ȘI PROGRES
// ===========================================

// Obține clasamentul pentru clasa utilizatorului
async function getClassLeaderboard(subjectType = null) {
    try {
        if (!userProfile) await getCurrentUserProfile();
        if (!userProfile) return [];

        const { data, error } = await supabaseClient
            .rpc('get_class_ranking', {
                p_class_level: userProfile.class_level,
                p_subject_type: subjectType
            });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Eroare obținere clasament:', error);
        return [];
    }
}

// Obține progresul utilizatorului
async function getUserProgress() {
    try {
        if (!currentUser) return [];

        const { data, error } = await supabaseClient
            .from('user_progress')
            .select('*')
            .eq('user_id', currentUser.id);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Eroare obținere progres:', error);
        return [];
    }
}

// Obține statisticile utilizatorului
async function getUserStats() {
    try {
        if (!currentUser) return null;

        const { data, error } = await supabaseClient
            .from('user_stats')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Eroare obținere statistici:', error);
        return null;
    }
}

// Obține istoricul testelor
async function getTestHistory() {
    try {
        if (!currentUser) return [];

        const { data, error } = await supabaseClient
            .from('test_attempts')
            .select(`
                *,
                tests (
                    title,
                    subject_type,
                    class_level
                )
            `)
            .eq('user_id', currentUser.id)
            .eq('is_completed', true)
            .order('completed_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Eroare obținere istoric:', error);
        return [];
    }
}

// ===========================================
// FUNCȚII UI ȘI EVENT HANDLERS
// ===========================================

// Actualizează interfața în funcție de starea autentificării
function updateUIForAuth() {
    const authButtons = document.getElementById('authButtons');
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    const heroMessage = document.getElementById('heroMessage');

    if (currentUser && userProfile) {
        // Utilizator autentificat
        authButtons.style.display = 'none';
        userInfo.classList.add('show');
        userName.textContent = userProfile.name;
        heroMessage.textContent = `Bun venit, ${userProfile.name}! Clasa a ${userProfile.class_level}-a`;
        
        // Elimină blocările pentru conținutul premium
        document.querySelectorAll('[data-requires-auth="true"]').forEach(element => {
            element.classList.remove('locked');
            const lockIcon = element.querySelector('.auth-lock');
            if (lockIcon) lockIcon.style.display = 'none';
        });
    } else {
        // Utilizator neautentificat
        authButtons.style.display = 'flex';
        userInfo.classList.remove('show');
        heroMessage.textContent = 'Alătură-te comunității noastre pentru a excela la matematică!';
        
        // Adaugă blocări pentru conținutul premium
        document.querySelectorAll('[data-requires-auth="true"]').forEach(element => {
            element.classList.add('locked');
            const lockIcon = element.querySelector('.auth-lock');
            if (lockIcon) lockIcon.style.display = 'inline';
        });
    }
}

// Gestionarea formularelor
function setupEventHandlers() {
    // Formular de conectare
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        await loginUser(email, password);
    });

    // Formular de înregistrare
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const classLevel = document.getElementById('registerClass').value;
        await registerUser(email, password, name, classLevel);
    });

    // Verificarea accesului la conținut premium
    document.addEventListener('click', (e) => {
        const link = e.target.closest('[data-requires-auth="true"]');
        if (link && link.classList.contains('locked')) {
            e.preventDefault();
            showAlert('Pentru a accesa această secțiune, te rugăm să te conectezi!', 'warning');
            openModal('loginModal');
        }
    });
}

// Monitorizarea stării autentificării
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN') {
        currentUser = session.user;
        userProfile = await getCurrentUserProfile();
        updateUIForAuth();
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        userProfile = null;
        updateUIForAuth();
    }
});

// ===========================================
// FUNCȚII UTILITARE UI
// ===========================================

// Afișează mesaje de alertă
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Afișează erori în formular
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

// Ascunde erorile din formular
function hideError(elementId) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}

// Afișează loading pe butoane
function showLoading(buttonId) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Se încarcă...';
        button.disabled = true;
    }
}

// Ascunde loading de pe butoane
function hideLoading(buttonId, originalText) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

// Deschide modal
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
        // Curăță erorile anterioare
        const errorElements = modal.querySelectorAll('.error-message');
        errorElements.forEach(el => el.style.display = 'none');
    }
}

// Închide modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        // Resetează formularul
        const form = modal.querySelector('form');
        if (form) form.reset();
    }
}

// Toggle pentru meniul mobil
function toggleMobileMenu() {
    const navLinks = document.getElementById('navLinks');
    navLinks.classList.toggle('active');
}

// Navigare către panoul admin (pentru utilizatori admin)
function goToAdmin() {
    // Implementează logica pentru panoul de administrare
    window.location.href = '/admin';
}

// ===========================================
// INIȚIALIZAREA APLICAȚIEI
// ===========================================

// Inițializarea când DOM-ul este încărcat
document.addEventListener('DOMContentLoaded', async () => {
    setupEventHandlers();
    
    // Verifică dacă utilizatorul este deja autentificat
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        userProfile = await getCurrentUserProfile();
        updateUIForAuth();
    }
});

// ===========================================
// FUNCȚII PENTRU TESTE (pentru paginile de test)
// ===========================================

// Calcularea scorului pentru testele cu răspunsuri multiple
function calculateMultipleChoiceScore(answers, correctAnswers) {
    let score = 0;
    const pointsPerQuestion = 6; // conform structurii din HTML
    
    Object.keys(correctAnswers).forEach(questionId => {
        if (answers[questionId] === correctAnswers[questionId]) {
            score += pointsPerQuestion;
        }
    });
    
    return score;
}

// Salvarea locală a progresului (backup)
function saveProgressLocally(testId, answers) {
    const progressKey = `test_progress_${testId}`;
    const progressData = {
        answers: answers,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem(progressKey, JSON.stringify(progressData));
}

// Încărcarea progresului local
function loadProgressLocally(testId) {
    const progressKey = `test_progress_${testId}`;
    const savedData = localStorage.getItem(progressKey);
    return savedData ? JSON.parse(savedData) : null;
}

// Export pentru utilizare globală
window.MathPlatform = {
    // Auth
    loginUser,
    registerUser,
    logout,
    getCurrentUserProfile,
    updateUserProfile,
    
    // Tests
    getAvailableTests,
    startTest,
    saveTestProgress,
    submitTest,
    
    // Progress & Rankings
    getClassLeaderboard,
    getUserProgress,
    getUserStats,
    getTestHistory,
    
    // Utils
    calculateMultipleChoiceScore,
    saveProgressLocally,
    loadProgressLocally,
    
    // UI
    showAlert,
    openModal,
    closeModal,
    
    // State
    get currentUser() { return currentUser; },
    get userProfile() { return userProfile; }
};

console.log('🔗 Supabase connection initialized for Math Platform');
