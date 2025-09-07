// ===== CONFIGURARE SUPABASE =====
// Înlocuiți cu cheile dvs. din Supabase Dashboard
const SUPABASE_URL = 'https://szzhieasoxpknjchgtky.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6emhpZWFzb3hwa25qY2hndGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyMzQyMzksImV4cCI6MjA3MjgxMDIzOX0.27WTpF4X50PbjKHDUiQ48qincH8_PfMtRKAPybUJquE';

// Inițializare Supabase Client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== VARIABILE GLOBALE =====
let currentUser = null;
let isTeacher = false;

// ===== FUNCȚII DE AUTENTIFICARE =====

// Verificare sesiune la încărcarea paginii
async function checkSession() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            currentUser = session.user;
            await loadUserDetails();
            updateUIForLoggedInUser();
        } else {
            updateUIForGuest();
        }
    } catch (error) {
        console.error('Eroare la verificarea sesiunii:', error);
    }
}

// Încărcare detalii utilizator
async function loadUserDetails() {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (data) {
            currentUser = { ...currentUser, ...data };
            isTeacher = data.role === 'teacher' || data.role === 'admin';
            
            // Salvare în localStorage pentru acces rapid
            localStorage.setItem('userRole', data.role);
            localStorage.setItem('userPremium', data.is_premium);
        }
    } catch (error) {
        console.error('Eroare la încărcarea detaliilor utilizatorului:', error);
    }
}

// Înregistrare utilizator nou
async function register(email, password, fullName, classLevel) {
    try {
        // Înregistrare în Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    class_level: classLevel
                }
            }
        });

        if (authError) throw authError;

        // Creare profil în tabelul users
        const { error: profileError } = await supabase
            .from('users')
            .insert([{
                id: authData.user.id,
                email,
                full_name: fullName,
                class_level: classLevel,
                role: 'student'
            }]);

        if (profileError) throw profileError;

        showAlert('success', 'Cont creat cu succes! Verificați email-ul pentru confirmare.');
        closeModal('registerModal');
        
        return { success: true };
    } catch (error) {
        console.error('Eroare la înregistrare:', error);
        showAlert('error', error.message);
        return { success: false, error };
    }
}

// Conectare utilizator
async function login(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        currentUser = data.user;
        await loadUserDetails();
        updateUIForLoggedInUser();
        
        showAlert('success', 'Conectare reușită!');
        closeModal('loginModal');

        // Redirecționare pentru profesori
        if (isTeacher) {
            window.location.href = '/admin.html';
        }

        return { success: true };
    } catch (error) {
        console.error('Eroare la conectare:', error);
        showAlert('error', 'Email sau parolă incorectă');
        return { success: false, error };
    }
}

// Deconectare
async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        currentUser = null;
        isTeacher = false;
        localStorage.clear();
        updateUIForGuest();
        
        showAlert('info', 'Ați fost deconectat');
        
        // Redirecționare la pagina principală
        if (window.location.pathname.includes('admin')) {
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Eroare la deconectare:', error);
    }
}

// ===== FUNCȚII UI =====

// Actualizare UI pentru utilizator conectat
function updateUIForLoggedInUser() {
    const authButtons = document.getElementById('authButtons');
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    const userPremium = document.getElementById('userPremium');
    const heroMessage = document.getElementById('heroMessage');

    if (authButtons) authButtons.style.display = 'none';
    if (userInfo) {
        userInfo.style.display = 'flex';
        userInfo.classList.add('show');
    }
    
    if (userName && currentUser) {
        userName.textContent = currentUser.full_name || currentUser.email;
    }
    
    if (userPremium && currentUser?.is_premium) {
        userPremium.style.display = 'inline-block';
    }

    if (heroMessage) {
        heroMessage.textContent = `Bine ai revenit, ${currentUser?.full_name || 'Student'}!`;
    }

    // Deblocare conținut pentru utilizatori autentificați
    unlockAuthContent();
}

// Actualizare UI pentru vizitator
function updateUIForGuest() {
    const authButtons = document.getElementById('authButtons');
    const userInfo = document.getElementById('userInfo');

    if (authButtons) authButtons.style.display = 'flex';
    if (userInfo) {
        userInfo.style.display = 'none';
        userInfo.classList.remove('show');
    }

    // Blocare conținut care necesită autentificare
    lockAuthContent();
}

// Deblocare conținut pentru utilizatori autentificați
function unlockAuthContent() {
    const authRequiredLinks = document.querySelectorAll('[data-requires-auth="true"]');
    authRequiredLinks.forEach(link => {
        link.classList.remove('locked');
        link.onclick = null;
        
        // Verificare premium pentru conținut premium
        if (link.dataset.requiresPremium === 'true' && !currentUser?.is_premium) {
            link.classList.add('locked');
            link.onclick = (e) => {
                e.preventDefault();
                showPremiumModal();
            };
            
            // Adaugă icon premium
            if (!link.querySelector('.premium-lock')) {
                const lockIcon = document.createElement('i');
                lockIcon.className = 'fas fa-crown premium-lock';
                link.appendChild(lockIcon);
            }
        }
    });
}

// Blocare conținut care necesită autentificare
function lockAuthContent() {
    const authRequiredLinks = document.querySelectorAll('[data-requires-auth="true"]');
    authRequiredLinks.forEach(link => {
        link.classList.add('locked');
        link.onclick = (e) => {
            e.preventDefault();
            showAlert('warning', 'Trebuie să vă conectați pentru a accesa acest conținut');
            openModal('loginModal');
        };
    });
}

// ===== FUNCȚII PENTRU TESTE ȘI PROGRES =====

// Salvare rezultat test
async function saveTestResult(testId, score, maxScore, answers, timeSpent) {
    if (!currentUser) {
        showAlert('error', 'Trebuie să fiți conectat pentru a salva rezultatul');
        return;
    }

    try {
        const percentage = (score / maxScore) * 100;
        
        const { data, error } = await supabase
            .from('test_results')
            .insert([{
                student_id: currentUser.id,
                test_id: testId,
                score,
                max_score: maxScore,
                percentage,
                answers,
                time_spent: timeSpent
            }]);

        if (error) throw error;

        showAlert('success', `Test finalizat! Scor: ${score}/${maxScore} (${percentage.toFixed(1)}%)`);
        
        return { success: true, data };
    } catch (error) {
        console.error('Eroare la salvarea rezultatului:', error);
        showAlert('error', 'Eroare la salvarea rezultatului');
        return { success: false, error };
    }
}

// Actualizare progres lecție
async function updateLessonProgress(lessonId, isCompleted, timeSpent) {
    if (!currentUser) return;

    try {
        const { error } = await supabase
            .from('lesson_progress')
            .upsert({
                student_id: currentUser.id,
                lesson_id: lessonId,
                is_completed: isCompleted,
                time_spent: timeSpent,
                completed_at: isCompleted ? new Date().toISOString() : null
            }, {
                onConflict: 'student_id,lesson_id'
            });

        if (error) throw error;

        if (isCompleted) {
            showAlert('success', 'Lecție marcată ca finalizată!');
        }
    } catch (error) {
        console.error('Eroare la actualizarea progresului:', error);
    }
}

// Salvare soluție exercițiu
async function saveExerciseSolution(exerciseId, solution, isCorrect, pointsEarned) {
    if (!currentUser) return;

    try {
        const { error } = await supabase
            .from('exercise_solutions')
            .upsert({
                student_id: currentUser.id,
                exercise_id: exerciseId,
                solution,
                is_correct: isCorrect,
                points_earned: pointsEarned
            }, {
                onConflict: 'student_id,exercise_id'
            });

        if (error) throw error;

        showAlert('success', isCorrect ? 'Răspuns corect!' : 'Răspuns salvat');
    } catch (error) {
        console.error('Eroare la salvarea soluției:', error);
    }
}

// ===== FUNCȚII PENTRU ADMIN/PROFESOR =====

// Verificare acces admin
async function checkAdminAccess() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        window.location.href = '/';
        return false;
    }

    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();

    if (!userData || (userData.role !== 'teacher' && userData.role !== 'admin')) {
        showAlert('error', 'Nu aveți permisiunea de a accesa această pagină');
        window.location.href = '/';
        return false;
    }

    return true;
}

// Încărcare statistici dashboard
async function loadDashboardStats() {
    try {
        // Total elevi
        const { count: totalStudents } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'student');

        // Total teste
        const { count: totalTests } = await supabase
            .from('tests')
            .select('*', { count: 'exact', head: true });

        // Medie generală
        const { data: avgData } = await supabase
            .from('test_results')
            .select('percentage');
        
        const averageScore = avgData?.length > 0 
            ? avgData.reduce((acc, curr) => acc + curr.percentage, 0) / avgData.length 
            : 0;

        // Activi astăzi
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { count: activeToday } = await supabase
            .from('student_statistics')
            .select('*', { count: 'exact', head: true })
            .gte('last_activity', today.toISOString());

        // Actualizare UI
        updateStatCard('totalStudents', totalStudents || 0);
        updateStatCard('totalTests', totalTests || 0);
        updateStatCard('averageScore', `${averageScore.toFixed(1)}%`);
        updateStatCard('activeToday', activeToday || 0);

    } catch (error) {
        console.error('Eroare la încărcarea statisticilor:', error);
    }
}

// Încărcare listă elevi
async function loadStudents(classFilter = '', searchTerm = '') {
    try {
        let query = supabase
            .from('users')
            .select(`
                *,
                student_statistics (*)
            `)
            .eq('role', 'student')
            .order('created_at', { ascending: false });

        if (classFilter) {
            query = query.eq('class_level', classFilter);
        }

        if (searchTerm) {
            query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
        }

        const { data, error } = await query;

        if (error) throw error;

        displayStudentsTable(data);
    } catch (error) {
        console.error('Eroare la încărcarea elevilor:', error);
    }
}

// Încărcare rezultate teste
async function loadTestResults(filters = {}) {
    try {
        let query = supabase
            .from('test_results')
            .select(`
                *,
                student:users!student_id (full_name, email, class_level),
                test:tests!test_id (title, category, class_level)
            `)
            .order('completed_at', { ascending: false });

        // Aplicare filtre
        if (filters.classLevel) {
            query = query.eq('test.class_level', filters.classLevel);
        }

        if (filters.testId) {
            query = query.eq('test_id', filters.testId);
        }

        if (filters.dateFrom) {
            query = query.gte('completed_at', filters.dateFrom);
        }

        if (filters.dateTo) {
            query = query.lte('completed_at', filters.dateTo);
        }

        const { data, error } = await query;

        if (error) throw error;

        displayGradesTable(data);
    } catch (error) {
        console.error('Eroare la încărcarea rezultatelor:', error);
    }
}

// Adăugare lecție nouă
async function addLesson(lessonData) {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        const { data, error } = await supabase
            .from('lessons')
            .insert([{
                ...lessonData,
                created_by: session.user.id
            }]);

        if (error) throw error;

        showAlert('success', 'Lecție adăugată cu succes!');
        closeModal('addLessonModal');
        loadLessons();
        
        return { success: true, data };
    } catch (error) {
        console.error('Eroare la adăugarea lecției:', error);
        showAlert('error', 'Eroare la adăugarea lecției');
        return { success: false, error };
    }
}

// Adăugare test nou
async function addTest(testData) {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        const { data, error } = await supabase
            .from('tests')
            .insert([{
                ...testData,
                created_by: session.user.id
            }]);

        if (error) throw error;

        showAlert('success', 'Test adăugat cu succes!');
        closeModal('addTestModal');
        loadTests();
        
        return { success: true, data };
    } catch (error) {
        console.error('Eroare la adăugarea testului:', error);
        showAlert('error', 'Eroare la adăugarea testului');
        return { success: false, error };
    }
}

// ===== FUNCȚII UTILITARE =====

// Afișare alertă
function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => alertDiv.remove(), 300);
    }, 3000);
}

// Deschidere modal
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
    }
}

// Închidere modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    }
}

// Toggle meniu mobil
function toggleMobileMenu() {
    const navLinks = document.getElementById('navLinks');
    if (navLinks) {
        navLinks.classList.toggle('active');
    }
}

// Formatare dată
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ro-RO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Formatare timp (secunde în format citibil)
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

// Export date în CSV
function exportToCSV(data, filename) {
    const csv = convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Conversie date în CSV
function convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = data.map(row => {
        return headers.map(header => {
            const value = row[header];
            return typeof value === 'string' && value.includes(',') 
                ? `"${value}"` 
                : value;
        }).join(',');
    });
    
    return [csvHeaders, ...csvRows].join('\n');
}

// ===== EVENT LISTENERS =====

// Formular înregistrare
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const fullName = document.getElementById('registerName').value;
    const classLevel = document.getElementById('registerClass')?.value;
    
    const submitBtn = document.getElementById('registerSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Se înregistrează...';
    
    await register(email, password, fullName, classLevel);
    
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Înregistrează-te Gratuit';
});

// Formular conectare
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    const submitBtn = document.getElementById('loginSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Se conectează...';
    
    await login(email, password);
    
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Conectează-te';
});

// Filtre pentru tabel elevi
document.getElementById('classFilter')?.addEventListener('change', (e) => {
    const searchTerm = document.getElementById('studentSearch')?.value || '';
    loadStudents(e.target.value, searchTerm);
});

document.getElementById('studentSearch')?.addEventListener('input', (e) => {
    const classFilter = document.getElementById('classFilter')?.value || '';
    loadStudents(classFilter, e.target.value);
});

// Formular adăugare lecție
document.getElementById('addLessonForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const lessonData = {
        title: document.getElementById('lessonTitle').value,
        description: document.getElementById('lessonDescription').value,
        class_level: parseInt(document.getElementById('lessonClass').value),
        chapter: document.getElementById('lessonChapter').value,
        content_url: document.getElementById('lessonUrl').value,
        is_premium: document.getElementById('lessonPremium').checked
    };
    
    await addLesson(lessonData);
});

// Formular adăugare test
document.getElementById('addTestForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const testData = {
        title: document.getElementById('testTitle').value,
        description: document.getElementById('testDescription').value,
        class_level: parseInt(document.getElementById('testClass').value),
        category: document.getElementById('testCategory').value,
        time_limit: parseInt(document.getElementById('testTimeLimit').value),
        max_score: parseInt(document.getElementById('testMaxScore').value),
        test_url: document.getElementById('testUrl').value,
        is_premium: document.getElementById('testPremium').checked
    };
    
    await addTest(testData);
});

// Listener pentru schimbări de autentificare
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
        currentUser = session.user;
        loadUserDetails();
        updateUIForLoggedInUser();
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        updateUIForGuest();
    }
});

// ===== INIȚIALIZARE =====

// Verificare sesiune la încărcarea paginii
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    
    // Pentru pagina de admin
    if (window.location.pathname.includes('admin')) {
        checkAdminAccess().then(hasAccess => {
            if (hasAccess) {
                loadDashboardStats();
                loadStudents();
                loadTestResults();
            }
        });
    }
});

// Export funcții pentru utilizare globală
window.supabaseAuth = {
    register,
    login,
    logout,
    checkSession,
    currentUser: () => currentUser,
    isTeacher: () => isTeacher,
    saveTestResult,
    updateLessonProgress,
    saveExerciseSolution
};

// Export funcții UI
window.uiHelpers = {
    showAlert,
    openModal,
    closeModal,
    toggleMobileMenu,
    formatDate,
    formatTime
};

// Export funcții admin
window.adminFunctions = {
    loadDashboardStats,
    loadStudents,
    loadTestResults,
    addLesson,
    addTest,
    exportToCSV
};
