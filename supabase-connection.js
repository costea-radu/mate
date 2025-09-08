// supabase-connection.js - Versiune corectată pentru probleme RLS
// Configurare Supabase - Înlocuiește cu cheile tale
const SUPABASE_URL = 'https://ireytpwqkymtkersdsba.supabase.co'; // Înlocuiește
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyZXl0cHdxa3ltdGtlcnNkc2JhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMjIwNTQsImV4cCI6MjA3Mjg5ODA1NH0.XLSUZzedVH-QsZt0JxJQfpEDsOyssar3Q4lnajlZa5o'; // Înlocuiește

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
            .eq('id', currentUser.id)
            .single();
        
        if (error) {
            console.error('Eroare la obținerea detaliilor:', error);
            return;
        }
        
        if (data) {
            currentUser = { ...currentUser, ...data };
        }
    } catch (error) {
        console.error('Eroare la obținerea detaliilor utilizatorului:', error);
    }
}

// Înregistrare utilizator nou - VERSIUNE CORECTATĂ
async function register(event) {
    event.preventDefault();
    
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const classLevel = document.getElementById('registerClass')?.value || '';
    
    const submitBtn = document.getElementById('registerSubmitBtn');
    const errorDiv = document.getElementById('registerError');
    const successDiv = document.getElementById('registerSuccess');
    
    // Validare
    if (!name || !email || !password) {
        errorDiv.textContent = 'Toate câmpurile sunt obligatorii!';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (password.length < 6) {
        errorDiv.textContent = 'Parola trebuie să aibă cel puțin 6 caractere!';
        errorDiv.style.display = 'block';
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Se înregistrează...';
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    try {
        // PASUL 1: Înregistrare în Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    name: name,
                    class_level: classLevel
                }
            }
        });
        
        if (authError) {
            console.error('Eroare Auth:', authError);
            
            // Mesaje de eroare personalizate
            if (authError.message.includes('already registered')) {
                throw new Error('Acest email este deja înregistrat!');
            } else if (authError.message.includes('invalid')) {
                throw new Error('Email-ul nu este valid!');
            } else if (authError.message.includes('weak')) {
                throw new Error('Parola este prea slabă!');
            } else {
                throw authError;
            }
        }
        
        if (!authData.user) {
            throw new Error('Nu s-a putut crea utilizatorul. Încearcă din nou.');
        }
        
        console.log('Utilizator Auth creat:', authData.user.id);
        
        // PASUL 2: Adaugă utilizatorul în tabelul users
        // Folosim service key sau facem direct din Auth trigger
        const { error: dbError } = await supabase
            .from('users')
            .insert([
                {
                    id: authData.user.id,
                    email: email,
                    name: name,
                    class_level: classLevel || null,
                    role: 'student'
                }
            ])
            .select()
            .single();
        
        if (dbError) {
            console.error('Eroare DB:', dbError);
            
            // Dacă eroarea este de RLS, încearcă să loghezi utilizatorul
            if (dbError.code === '42501' || dbError.message.includes('row-level security')) {
                console.log('Eroare RLS detectată, încercăm autentificare directă...');
                
                // Încearcă să te autentifici direct
                const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                });
                
                if (!signInError && signInData.user) {
                    // Acum încearcă din nou să inserezi în tabel
                    const { error: retryError } = await supabase
                        .from('users')
                        .upsert([
                            {
                                id: signInData.user.id,
                                email: email,
                                name: name,
                                class_level: classLevel || null,
                                role: 'student'
                            }
                        ])
                        .select()
                        .single();
                    
                    if (!retryError) {
                        console.log('Utilizator adăugat cu succes după reîncercare!');
                    }
                }
            }
        }
        
        successDiv.textContent = 'Înregistrare reușită! Te poți conecta acum.';
        successDiv.style.display = 'block';
        
        // Resetează formularul
        document.getElementById('registerForm').reset();
        
        // Închide modalul și afișează mesaj de succes
        setTimeout(() => {
            closeModal('registerModal');
            showAlert('success', 'Înregistrare reușită! Te poți conecta acum.');
            
            // Deschide automat modalul de login
            openModal('loginModal');
        }, 2000);
        
    } catch (error) {
        console.error('Eroare completă:', error);
        
        let errorMessage = 'Eroare la înregistrare. ';
        
        if (error.message) {
            errorMessage += error.message;
        } else {
            errorMessage += 'Verifică datele și încearcă din nou.';
        }
        
        errorDiv.textContent = errorMessage;
        errorDiv.style.display = 'block';
        
        // Sugestii pentru utilizator
        if (error.message && error.message.includes('row-level security')) {
            errorDiv.innerHTML = `
                ${errorMessage}<br>
                <small style="margin-top: 10px; display: block;">
                    Dacă problema persistă, contactează administratorul site-ului.
                </small>
            `;
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Înregistrează-te';
    }
}

// Conectare utilizator - VERSIUNE ÎMBUNĂTĂȚITĂ
async function login(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    const submitBtn = document.getElementById('loginSubmitBtn');
    const errorDiv = document.getElementById('loginError');
    
    if (!email || !password) {
        errorDiv.textContent = 'Completează toate câmpurile!';
        errorDiv.style.display = 'block';
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Se conectează...';
    errorDiv.style.display = 'none';
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });
        
        if (error) {
            console.error('Eroare login:', error);
            
            if (error.message.includes('Invalid login')) {
                throw new Error('Email sau parolă incorectă!');
            } else if (error.message.includes('Email not confirmed')) {
                throw new Error('Verifică-ți email-ul pentru confirmare!');
            } else {
                throw error;
            }
        }
        
        currentUser = data.user;
        
        // Verifică dacă utilizatorul există în tabelul users
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', currentUser.id)
            .single();
        
        if (userError || !userData) {
            console.log('Utilizatorul nu există în tabel, îl adăugăm...');
            
            // Adaugă utilizatorul în tabel dacă nu există
            const { error: insertError } = await supabase
                .from('users')
                .upsert([
                    {
                        id: currentUser.id,
                        email: currentUser.email,
                        name: currentUser.user_metadata?.name || email.split('@')[0],
                        class_level: currentUser.user_metadata?.class_level || null,
                        role: 'student',
                        last_login: new Date().toISOString()
                    }
                ]);
            
            if (!insertError) {
                console.log('Utilizator adăugat în tabel cu succes!');
            }
        } else {
            // Actualizează ultima conectare
            await supabase
                .from('users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', currentUser.id);
            
            currentUser = { ...currentUser, ...userData };
        }
        
        closeModal('loginModal');
        updateUI();
        showAlert('success', `Bine ai venit, ${currentUser.name || 'Utilizator'}!`);
        
        // Redirecționează admin-ul către panoul de administrare
        if (currentUser.role === 'admin') {
            setTimeout(() => {
                window.location.href = 'admin.html';
            }, 1000);
        }
        
    } catch (error) {
        console.error('Eroare completă login:', error);
        errorDiv.textContent = error.message || 'Eroare la conectare. Încearcă din nou.';
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
            userInfo.classList.add('show');
            const userName = document.getElementById('userName');
            if (userName) {
                userName.textContent = currentUser.name || currentUser.email || 'Utilizator';
            }
        }
        
        if (heroMessage) {
            heroMessage.textContent = `Bine ai revenit, ${currentUser.name || 'Elev'}! Continuă să înveți!`;
        }
        
        // Deblochează secțiunile care necesită autentificare
        unlockAuthSections();
    } else {
        // Utilizator neconectat
        if (authButtons) authButtons.style.display = 'flex';
        if (userInfo) {
            userInfo.style.display = 'none';
            userInfo.classList.remove('show');
        }
        
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
        // Elimină iconița de lacăt
        const lock = link.querySelector('.auth-lock');
        if (lock) lock.style.display = 'none';
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
            return false;
        };
        // Afișează iconița de lacăt
        const lock = link.querySelector('.auth-lock');
        if (lock) lock.style.display = 'block';
    });
}

// Salvează progresul la lecții
async function saveLesson(lessonUrl, lessonName, classLevel) {
    if (!currentUser) {
        console.log('Utilizator neautentificat, nu se salvează progresul');
        return;
    }
    
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
    if (!currentUser) {
        showAlert('warning', 'Trebuie să fii conectat pentru a salva rezultatul!');
        return false;
    }
    
    try {
        // Verifică dacă există testul în tabelul tests
        let { data: testData } = await supabase
            .from('tests')
            .select('id')
            .eq('id', testId)
            .single();
        
        // Dacă testul nu există, îl creăm
        if (!testData) {
            const { error: testError } = await supabase
                .from('tests')
                .insert({
                    id: testId,
                    test_name: testName,
                    class_level: classLevel,
                    category: 'teste',
                    max_score: 100
                });
            
            if (testError) {
                console.error('Eroare la crearea testului:', testError);
            }
        }
        
        // Salvează rezultatul
        const { error } = await supabase
            .from('test_results')
            .insert({
                user_id: currentUser.id,
                test_id: testId,
                score: score,
                answers: answers,
                completed_at: new Date().toISOString()
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
    // Elimină alertele existente
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
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

// Funcție pentru generare ID unic
function generateUniqueId() {
    return 'test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Exportă funcțiile globale pentru a fi accesibile din HTML
window.openModal = openModal;
window.closeModal = closeModal;
window.logout = logout;
window.toggleMobileMenu = toggleMobileMenu;
window.saveTestResult = saveTestResult;
window.saveLesson = saveLesson;
window.generateUniqueId = generateUniqueId;
window.supabase = supabase;
window.currentUser = currentUser;
