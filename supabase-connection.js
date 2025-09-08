// supabase-connection.js
// Configurare Supabase - Înlocuiește cu cheile tale din Supabase
const SUPABASE_URL = 'https://your-project.supabase.co'; // Înlocuiește cu URL-ul tău
const SUPABASE_ANON_KEY = 'your-anon-key-here'; // Înlocuiește cu cheia ta anon

// Inițializare client Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variabile globale
let currentUser = null;

// Verifică dacă utilizatorul este autentificat la încărcarea paginii
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    setupEventListeners();
    updateUI();
});

// Verifică autentificarea
async function checkAuth() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            currentUser = session.user;
            await getUserDetails();
        }
    } catch (error) {
        console.error('Eroare la verificarea autentificării:', error);
    }
}

// Obține detaliile utilizatorului din tabelul users
async function getUserDetails() {
    if (!currentUser) return;
    
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', currentUser.email)
            .single();
        
        if (data) {
            currentUser = { ...currentUser, ...data };
        }
    } catch (error) {
        console.error('Eroare la obținerea detaliilor utilizatorului:', error);
    }
}

// Înregistrare utilizator nou
async function register(event) {
    event.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const classLevel = document.getElementById('registerClass')?.value || '';
    
    const submitBtn = document.getElementById('registerSubmitBtn');
    const errorDiv = document.getElementById('registerError');
    const successDiv = document.getElementById('registerSuccess');
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Se înregistrează...';
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    try {
        // Înregistrare în Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
        });
        
        if (authError) throw authError;
        
        // Adaugă utilizatorul în tabelul users
        const { error: dbError } = await supabase
            .from('users')
            .insert([
                {
                    id: authData.user.id,
                    email: email,
                    name: name,
                    class_level: classLevel,
                    role: 'student'
                }
            ]);
        
        if (dbError) throw dbError;
        
        successDiv.textContent = 'Înregistrare reușită! Verifică email-ul pentru confirmare.';
        successDiv.style.display = 'block';
        
        // Resetează formularul
        document.getElementById('registerForm').reset();
        
        // Închide modalul după 2 secunde
        setTimeout(() => {
            closeModal('registerModal');
            showAlert('success', 'Înregistrare reușită! Te poți conecta acum.');
        }, 2000);
        
    } catch (error) {
        errorDiv.textContent = error.message || 'Eroare la înregistrare. Încearcă din nou.';
        errorDiv.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Înregistrează-te Gratuit';
    }
}

// Conectare utilizator
async function login(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    const submitBtn = document.getElementById('loginSubmitBtn');
    const errorDiv = document.getElementById('loginError');
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Se conectează...';
    errorDiv.style.display = 'none';
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });
        
        if (error) throw error;
        
        currentUser = data.user;
        await getUserDetails();
        
        // Actualizează ultima conectare
        await supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', currentUser.id);
        
        closeModal('loginModal');
        updateUI();
        showAlert('success', `Bine ai venit, ${currentUser.name || 'Utilizator'}!`);
        
        // Redirecționează admin-ul către panoul de administrare
        if (currentUser.role === 'admin') {
            window.location.href = 'admin.html';
        }
        
    } catch (error) {
        errorDiv.textContent = error.message || 'Email sau parolă incorectă.';
        errorDiv.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Conectează-te';
    }
}

// Deconectare
async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        currentUser = null;
        updateUI();
        showAlert('info', 'Te-ai deconectat cu succes!');
        
        // Redirecționează către pagina principală
        if (window.location.pathname.includes('admin.html')) {
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Eroare la deconectare:', error);
        showAlert('error', 'Eroare la deconectare. Încearcă din nou.');
    }
}

// Actualizează interfața în funcție de starea autentificării
function updateUI() {
    const authButtons = document.getElementById('authButtons');
    const userInfo = document.getElementById('userInfo');
    const heroMessage = document.getElementById('heroMessage');
    
    if (currentUser) {
        // Utilizator conectat
        if (authButtons) authButtons.style.display = 'none';
        if (userInfo) {
            userInfo.style.display = 'flex';
            document.getElementById('userName').textContent = currentUser.name || currentUser.email;
        }
        
        if (heroMessage) {
            heroMessage.textContent = `Bine ai revenit, ${currentUser.name || 'Elev'}! Continuă să înveți!`;
        }
        
        // Deblochează secțiunile care necesită autentificare
        unlockAuthSections();
    } else {
        // Utilizator neconectat
        if (authButtons) authButtons.style.display = 'flex';
        if (userInfo) userInfo.style.display = 'none';
        
        if (heroMessage) {
            heroMessage.textContent = 'Alătură-te comunității noastre pentru a excela la matematică!';
        }
        
        // Blochează secțiunile care necesită autentificare
        lockAuthSections();
    }
}

// Deblochează secțiunile pentru utilizatorii autentificați
function unlockAuthSections() {
    const authRequiredLinks = document.querySelectorAll('[data-requires-auth="true"]');
    authRequiredLinks.forEach(link => {
        link.classList.remove('locked');
        link.onclick = null;
        // Elimină iconița de lacăt dacă există
        const lock = link.querySelector('.premium-lock');
        if (lock) lock.remove();
    });
}

// Blochează secțiunile pentru utilizatorii neautentificați
function lockAuthSections() {
    const authRequiredLinks = document.querySelectorAll('[data-requires-auth="true"]');
    authRequiredLinks.forEach(link => {
        link.classList.add('locked');
        link.onclick = (e) => {
            e.preventDefault();
            showAlert('warning', 'Trebuie să te conectezi pentru a accesa această secțiune!');
            openModal('loginModal');
        };
        // Adaugă iconița de lacăt
        if (!link.querySelector('.premium-lock')) {
            const lock = document.createElement('i');
            lock.className = 'fas fa-lock premium-lock';
            link.appendChild(lock);
        }
    });
}

// Salvează progresul la lecții
async function saveLesson(lessonUrl, lessonName, classLevel) {
    if (!currentUser) return;
    
    try {
        const { error } = await supabase
            .from('lesson_progress')
            .upsert({
                user_id: currentUser.id,
                lesson_url: lessonUrl,
                lesson_name: lessonName,
                class_level: classLevel,
                last_accessed: new Date().toISOString()
            }, {
                onConflict: 'user_id,lesson_url'
            });
        
        if (error) throw error;
        
        console.log('Progres lecție salvat');
    } catch (error) {
        console.error('Eroare la salvarea progresului:', error);
    }
}

// Salvează rezultatul testului
async function saveTestResult(testId, testName, score, classLevel, answers = null) {
    if (!currentUser) return;
    
    try {
        const { error } = await supabase
            .from('test_results')
            .insert({
                user_id: currentUser.id,
                test_id: testId,
                score: score,
                answers: answers
            });
        
        if (error) throw error;
        
        showAlert('success', `Test completat! Scor: ${score}%`);
        return true;
    } catch (error) {
        console.error('Eroare la salvarea rezultatului:', error);
        showAlert('error', 'Eroare la salvarea rezultatului testului.');
        return false;
    }
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

// Afișează alerte
function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        ${message}
    `;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Toggle meniu mobil
function toggleMobileMenu() {
    const navLinks = document.getElementById('navLinks');
    if (navLinks) {
        navLinks.classList.toggle('active');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Formular înregistrare
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', register);
    }
    
    // Formular conectare
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', login);
    }
    
    // Click în afara modalului pentru a-l închide
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('show');
        }
    }
    
    // Monitorizează click-urile pe link-uri pentru a salva progresul
    document.querySelectorAll('.subsection-btn').forEach(link => {
        link.addEventListener('click', function(e) {
            if (currentUser && !this.classList.contains('locked')) {
                const href = this.getAttribute('href');
                const text = this.textContent.trim();
                const classLevel = this.closest('.section-card')?.querySelector('h3')?.textContent.match(/\d+/)?.[0] || '';
                
                if (href && text) {
                    saveLesson(href, text, classLevel);
                }
            }
        });
    });
}

// Funcție helper pentru formatarea datelor
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

// Exportă funcțiile globale pentru a fi accesibile din HTML
window.openModal = openModal;
window.closeModal = closeModal;
window.logout = logout;
window.toggleMobileMenu = toggleMobileMenu;
window.saveTestResult = saveTestResult;
window.supabase = supabase;
