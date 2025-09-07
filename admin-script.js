// admin-script.js - Script specific pentru dashboard-ul profesorului

// ===== CONFIGURARE SUPABASE (același ca în scriptul principal) =====
const SUPABASE_URL = 'https://szzhieasoxpknjchgtky.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6emhpZWFzb3hwa25qY2hndGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyMzQyMzksImV4cCI6MjA3MjgxMDIzOX0.27WTpF4X50PbjKHDUiQ48qincH8_PfMtRKAPybUJquE';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== VARIABILE GLOBALE =====
let performanceChart = null;
let studentProgressChart = null;
let currentSection = 'overview';

// ===== FUNCȚII DE NAVIGARE =====
function showSection(sectionName) {
    // Ascunde toate secțiunile
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });

    // Afișează secțiunea selectată
    const selectedSection = document.getElementById(`${sectionName}-section`);
    if (selectedSection) {
        selectedSection.style.display = 'block';
    }

    // Actualizează meniul activ
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
        link.classList.remove('active');
    });
    event.target.closest('a').classList.add('active');

    currentSection = sectionName;

    // Încarcă datele specifice secțiunii
    switch(sectionName) {
        case 'overview':
            loadDashboardStats();
            loadRecentActivity();
            loadPerformanceChart();
            break;
        case 'students':
            loadStudents();
            break;
        case 'grades':
            loadGrades();
            loadTestsForFilter();
            break;
        case 'lessons':
            loadLessons();
            break;
        case 'tests':
            loadTests();
            break;
        case 'progress':
            loadStudentsForProgress();
            break;
        case 'announcements':
            loadAnnouncements();
            break;
    }
}

// ===== FUNCȚII PENTRU OVERVIEW =====
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
        document.getElementById('totalStudents').textContent = totalStudents || 0;
        document.getElementById('totalTests').textContent = totalTests || 0;
        document.getElementById('averageScore').textContent = `${averageScore.toFixed(1)}%`;
        document.getElementById('activeToday').textContent = activeToday || 0;

    } catch (error) {
        console.error('Eroare la încărcarea statisticilor:', error);
    }
}

async function loadRecentActivity() {
    try {
        const { data, error } = await supabase
            .from('test_results')
            .select(`
                *,
                student:users!student_id (full_name),
                test:tests!test_id (title)
            `)
            .order('completed_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        const tbody = document.getElementById('recentActivityTable');
        if (!tbody) return;

        if (data && data.length > 0) {
            tbody.innerHTML = data.map(activity => `
                <tr>
                    <td>${activity.student?.full_name || 'Necunoscut'}</td>
                    <td>Test completat</td>
                    <td>${activity.test?.title || 'Test'} - ${activity.percentage.toFixed(1)}%</td>
                    <td>${formatDate(activity.completed_at)}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nu există activitate recentă</td></tr>';
        }
    } catch (error) {
        console.error('Eroare la încărcarea activității recente:', error);
    }
}

async function loadPerformanceChart() {
    try {
        // Obține performanța medie pe clase
        const { data, error } = await supabase
            .from('test_results')
            .select(`
                percentage,
                test:tests!test_id (class_level)
            `);

        if (error) throw error;

        // Grupează rezultatele pe clase
        const performanceByClass = {
            5: [],
            6: [],
            7: [],
            8: []
        };

        data.forEach(result => {
            if (result.test && result.test.class_level) {
                performanceByClass[result.test.class_level].push(result.percentage);
            }
        });

        // Calculează media pentru fiecare clasă
        const averages = Object.keys(performanceByClass).map(classLevel => {
            const scores = performanceByClass[classLevel];
            return scores.length > 0 
                ? scores.reduce((a, b) => a + b, 0) / scores.length 
                : 0;
        });

        // Creează sau actualizează graficul
        const ctx = document.getElementById('performanceChart');
        if (!ctx) return;

        if (performanceChart) {
            performanceChart.destroy();
        }

        performanceChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Clasa 5', 'Clasa 6', 'Clasa 7', 'Clasa 8'],
                datasets: [{
                    label: 'Media Notelor (%)',
                    data: averages,
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(118, 75, 162, 0.8)',
                        'rgba(237, 100, 166, 0.8)',
                        'rgba(255, 215, 0, 0.8)'
                    ],
                    borderColor: [
                        'rgba(102, 126, 234, 1)',
                        'rgba(118, 75, 162, 1)',
                        'rgba(237, 100, 166, 1)',
                        'rgba(255, 215, 0, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.parsed.y.toFixed(1) + '%';
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Eroare la încărcarea graficului de performanță:', error);
    }
}

// ===== FUNCȚII PENTRU ELEVI =====
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

        const tbody = document.getElementById('studentsTable');
        if (!tbody) return;

        if (data && data.length > 0) {
            tbody.innerHTML = data.map(student => `
                <tr>
                    <td>${student.full_name}</td>
                    <td>${student.email}</td>
                    <td>Clasa ${student.class_level || '-'}</td>
                    <td>
                        <span class="badge ${student.is_premium ? 'badge-warning' : 'badge-info'}">
                            ${student.is_premium ? 'Premium' : 'Standard'}
                        </span>
                    </td>
                    <td>${formatDate(student.created_at)}</td>
                    <td>
                        <button class="btn btn-primary" onclick="viewStudentDetails('${student.id}')">
                            <i class="fas fa-eye"></i> Detalii
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nu există elevi înregistrați</td></tr>';
        }
    } catch (error) {
        console.error('Eroare la încărcarea elevilor:', error);
    }
}

async function viewStudentDetails(studentId) {
    try {
        const { data: student } = await supabase
            .from('users')
            .select(`
                *,
                student_statistics (*),
                test_results (
                    *,
                    test:tests!test_id (title)
                )
            `)
            .eq('id', studentId)
            .single();

        if (!student) return;

        const modalContent = document.getElementById('studentModalContent');
        modalContent.innerHTML = `
            <div class="student-details">
                <h3>${student.full_name}</h3>
                <p><strong>Email:</strong> ${student.email}</p>
                <p><strong>Clasa:</strong> ${student.class_level || '-'}</p>
                <p><strong>Status:</strong> ${student.is_premium ? 'Premium' : 'Standard'}</p>
                <p><strong>Înregistrat:</strong> ${formatDate(student.created_at)}</p>
                
                <h4 style="margin-top: 2rem;">Statistici</h4>
                <p><strong>Lecții completate:</strong> ${student.student_statistics?.[0]?.total_lessons_completed || 0}</p>
                <p><strong>Teste date:</strong> ${student.student_statistics?.[0]?.total_tests_taken || 0}</p>
                <p><strong>Media notelor:</strong> ${student.student_statistics?.[0]?.average_test_score?.toFixed(1) || 0}%</p>
                <p><strong>Puncte câștigate:</strong> ${student.student_statistics?.[0]?.total_points_earned || 0}</p>
                
                <h4 style="margin-top: 2rem;">Teste recente</h4>
                ${student.test_results && student.test_results.length > 0 ? `
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Test</th>
                                <th>Scor</th>
                                <th>Data</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${student.test_results.slice(0, 5).map(result => `
                                <tr>
                                    <td>${result.test?.title || 'Test'}</td>
                                    <td>${result.percentage.toFixed(1)}%</td>
                                    <td>${formatDate(result.completed_at)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<p>Nu există teste completate</p>'}
            </div>
        `;

        openModal('studentModal');
    } catch (error) {
        console.error('Eroare la încărcarea detaliilor elevului:', error);
    }
}

// ===== FUNCȚII PENTRU NOTE =====
async function loadGrades() {
    try {
        const classFilter = document.getElementById('gradeClassFilter')?.value;
        const testFilter = document.getElementById('testFilter')?.value;
        const dateFrom = document.getElementById('dateFromFilter')?.value;
        const dateTo = document.getElementById('dateToFilter')?.value;

        let query = supabase
            .from('test_results')
            .select(`
                *,
                student:users!student_id (full_name, class_level),
                test:tests!test_id (title, class_level)
            `)
            .order('completed_at', { ascending: false });

        if (classFilter) {
            query = query.eq('test.class_level', classFilter);
        }

        if (testFilter) {
            query = query.eq('test_id', testFilter);
        }

        if (dateFrom) {
            query = query.gte('completed_at', dateFrom);
        }

        if (dateTo) {
            query = query.lte('completed_at', dateTo);
        }

        const { data, error } = await query;

        if (error) throw error;

        const tbody = document.getElementById('gradesTable');
        if (!tbody) return;

        if (data && data.length > 0) {
            tbody.innerHTML = data.map(result => `
                <tr>
                    <td>${result.student?.full_name || 'Necunoscut'}</td>
                    <td>${result.test?.title || 'Test'}</td>
                    <td>${result.score}/${result.max_score}</td>
                    <td>
                        <span class="badge ${result.percentage >= 70 ? 'badge-success' : result.percentage >= 50 ? 'badge-warning' : 'badge-danger'}">
                            ${result.percentage.toFixed(1)}%
                        </span>
                    </td>
                    <td>${formatTime(result.time_spent || 0)}</td>
                    <td>${formatDate(result.completed_at)}</td>
                    <td>
                        <button class="btn btn-primary" onclick="viewTestDetails('${result.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nu există rezultate</td></tr>';
        }
    } catch (error) {
        console.error('Eroare la încărcarea notelor:', error);
    }
}

async function loadTestsForFilter() {
    try {
        const { data: tests } = await supabase
            .from('tests')
            .select('id, title, class_level')
            .order('title');

        const select = document.getElementById('testFilter');
        if (!select) return;

        select.innerHTML = '<option value="">Toate testele</option>' + 
            tests.map(test => `
                <option value="${test.id}">
                    ${test.title} (Clasa ${test.class_level})
                </option>
            `).join('');
    } catch (error) {
        console.error('Eroare la încărcarea listei de teste:', error);
    }
}

// ===== FUNCȚII PENTRU LECȚII =====
async function loadLessons() {
    try {
        const { data, error } = await supabase
            .from('lessons')
            .select('*')
            .order('class_level, order_index');

        if (error) throw error;

        const tbody = document.getElementById('lessonsTable');
        if (!tbody) return;

        if (data && data.length > 0) {
            tbody.innerHTML = data.map(lesson => `
                <tr>
                    <td>${lesson.title}</td>
                    <td>Clasa ${lesson.class_level}</td>
                    <td>${lesson.chapter || '-'}</td>
                    <td>
                        <span class="badge ${lesson.is_premium ? 'badge-warning' : 'badge-info'}">
                            ${lesson.is_premium ? 'Premium' : 'Gratuit'}
                        </span>
                    </td>
                    <td>${formatDate(lesson.created_at)}</td>
                    <td>
                        <button class="btn btn-primary" onclick="editLesson('${lesson.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-cancel" onclick="deleteLesson('${lesson.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nu există lecții</td></tr>';
        }
    } catch (error) {
        console.error('Eroare la încărcarea lecțiilor:', error);
    }
}

function openAddLessonModal() {
    document.getElementById('addLessonForm').reset();
    openModal('addLessonModal');
}

async function deleteLesson(lessonId) {
    if (!confirm('Sigur doriți să ștergeți această lecție?')) return;

    try {
        const { error } = await supabase
            .from('lessons')
            .delete()
            .eq('id', lessonId);

        if (error) throw error;

        showAlert('success', 'Lecție ștearsă cu succes');
        loadLessons();
    } catch (error) {
        console.error('Eroare la ștergerea lecției:', error);
        showAlert('error', 'Eroare la ștergerea lecției');
    }
}

// ===== FUNCȚII PENTRU TESTE =====
async function loadTests() {
    try {
        const { data, error } = await supabase
            .from('tests')
            .select('*')
            .order('class_level, created_at');

        if (error) throw error;

        const tbody = document.getElementById('testsTable');
        if (!tbody) return;

        if (data && data.length > 0) {
            tbody.innerHTML = data.map(test => `
                <tr>
                    <td>${test.title}</td>
                    <td>Clasa ${test.class_level}</td>
                    <td>${test.category || '-'}</td>
                    <td>${test.time_limit || '-'} min</td>
                    <td>${test.max_score}</td>
                    <td>
                        <span class="badge ${test.is_premium ? 'badge-warning' : 'badge-info'}">
                            ${test.is_premium ? 'Premium' : 'Gratuit'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-primary" onclick="editTest('${test.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-cancel" onclick="deleteTest('${test.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nu există teste</td></tr>';
        }
    } catch (error) {
        console.error('Eroare la încărcarea testelor:', error);
    }
}

function openAddTestModal() {
    document.getElementById('addTestForm').reset();
    openModal('addTestModal');
}

async function deleteTest(testId) {
    if (!confirm('Sigur doriți să ștergeți acest test? Toate rezultatele asociate vor fi șterse.')) return;

    try {
        const { error } = await supabase
            .from('tests')
            .delete()
            .eq('id', testId);

        if (error) throw error;

        showAlert('success', 'Test șters cu succes');
        loadTests();
    } catch (error) {
        console.error('Eroare la ștergerea testului:', error);
        showAlert('error', 'Eroare la ștergerea testului');
    }
}

// ===== FUNCȚII PENTRU PROGRES =====
async function loadStudentsForProgress() {
    try {
        const { data: students } = await supabase
            .from('users')
            .select('id, full_name, class_level')
            .eq('role', 'student')
            .order('full_name');

        const select = document.getElementById('studentProgressFilter');
        if (!select) return;

        select.innerHTML = '<option value="">Alege un elev...</option>' + 
            students.map(student => `
                <option value="${student.id}">
                    ${student.full_name} (Clasa ${student.class_level || '-'})
                </option>
            `).join('');
    } catch (error) {
        console.error('Eroare la încărcarea listei de elevi:', error);
    }
}

document.getElementById('studentProgressFilter')?.addEventListener('change', async (e) => {
    const studentId = e.target.value;
    
    if (!studentId) {
        document.getElementById('studentProgressDetails').style.display = 'none';
        return;
    }

    await loadStudentProgress(studentId);
});

async function loadStudentProgress(studentId) {
    try {
        const { data: stats } = await supabase
            .from('student_statistics')
            .select('*')
            .eq('student_id', studentId)
            .single();

        if (stats) {
            document.getElementById('studentLessonsCompleted').textContent = stats.total_lessons_completed || 0;
            document.getElementById('studentTestsTaken').textContent = stats.total_tests_taken || 0;
            document.getElementById('studentAverageScore').textContent = `${(stats.average_test_score || 0).toFixed(1)}%`;
            document.getElementById('studentTimeSpent').textContent = formatTime(stats.total_time_spent || 0);
        }

        // Încarcă progresul pe teste
        const { data: testResults } = await supabase
            .from('test_results')
            .select(`
                completed_at,
                percentage,
                test:tests!test_id (title)
            `)
            .eq('student_id', studentId)
            .order('completed_at')
            .limit(10);

        if (testResults && testResults.length > 0) {
            const ctx = document.getElementById('studentProgressChart');
            
            if (studentProgressChart) {
                studentProgressChart.destroy();
            }

            studentProgressChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: testResults.map(r => new Date(r.completed_at).toLocaleDateString('ro-RO')),
                    datasets: [{
                        label: 'Scor (%)',
                        data: testResults.map(r => r.percentage),
                        borderColor: 'rgba(102, 126, 234, 1)',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                }
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `${testResults[context.dataIndex].test.title}: ${context.parsed.y.toFixed(1)}%`;
                                }
                            }
                        }
                    }
                }
            });
        }

        document.getElementById('studentProgressDetails').style.display = 'block';
    } catch (error) {
        console.error('Eroare la încărcarea progresului elevului:', error);
    }
}

// ===== FUNCȚII PENTRU ANUNȚURI =====
async function loadAnnouncements() {
    try {
        const { data, error } = await supabase
            .from('announcements')
            .select(`
                *,
                creator:users!created_by (full_name)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const container = document.getElementById('announcementsList');
        if (!container) return;

        if (data && data.length > 0) {
            container.innerHTML = data.map(announcement => `
                <div class="data-section" style="margin-bottom: 1rem;">
                    <h3>${announcement.title}</h3>
                    <p style="color: #666; font-size: 0.9rem;">
                        ${formatDate(announcement.created_at)} | 
                        ${announcement.target_class ? `Clasa ${announcement.target_class}` : 'Toate clasele'}
                    </p>
                    <p>${announcement.content}</p>
                    <button class="btn btn-cancel" onclick="deleteAnnouncement('${announcement.id}')">
                        <i class="fas fa-trash"></i> Șterge
                    </button>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p style="text-align: center;">Nu există anunțuri</p>';
        }
    } catch (error) {
        console.error('Eroare la încărcarea anunțurilor:', error);
    }
}

function openAddAnnouncementModal() {
    document.getElementById('addAnnouncementForm').reset();
    openModal('addAnnouncementModal');
}

async function deleteAnnouncement(announcementId) {
    if (!confirm('Sigur doriți să ștergeți acest anunț?')) return;

    try {
        const { error } = await supabase
            .from('announcements')
            .delete()
            .eq('id', announcementId);

        if (error) throw error;

        showAlert('success', 'Anunț șters cu succes');
        loadAnnouncements();
    } catch (error) {
        console.error('Eroare la ștergerea anunțului:', error);
        showAlert('error', 'Eroare la ștergerea anunțului');
    }
}

// ===== FUNCȚII EXPORT =====
function exportStudents() {
    // Implementare export CSV pentru elevi
    showAlert('info', 'Funcționalitate în dezvoltare');
}

function exportGrades() {
    // Implementare export Excel pentru note
    showAlert('info', 'Funcționalitate în dezvoltare');
}

// ===== FUNCȚII UTILITARE =====
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

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ro-RO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        window.location.href = '/';
    } catch (error) {
        console.error('Eroare la deconectare:', error);
    }
}

// ===== EVENT LISTENERS =====

// Formular adăugare lecție
document.getElementById('addLessonForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        const lessonData = {
            title: document.getElementById('lessonTitle').value,
            description: document.getElementById('lessonDescription').value,
            class_level: parseInt(document.getElementById('lessonClass').value),
            chapter: document.getElementById('lessonChapter').value,
            content_url: document.getElementById('lessonUrl').value,
            is_premium: document.getElementById('lessonPremium').checked,
            created_by: session.user.id
        };
        
        const { error } = await supabase
            .from('lessons')
            .insert([lessonData]);

        if (error) throw error;

        showAlert('success', 'Lecție adăugată cu succes!');
        closeModal('addLessonModal');
        loadLessons();
    } catch (error) {
        console.error('Eroare la adăugarea lecției:', error);
        showAlert('error', 'Eroare la adăugarea lecției');
    }
});

// Formular adăugare test
document.getElementById('addTestForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        const testData = {
            title: document.getElementById('testTitle').value,
            description: document.getElementById('testDescription').value,
            class_level: parseInt(document.getElementById('testClass').value),
            category: document.getElementById('testCategory').value,
            time_limit: parseInt(document.getElementById('testTimeLimit').value),
            max_score: parseInt(document.getElementById('testMaxScore').value),
            test_url: document.getElementById('testUrl').value,
            is_premium: document.getElementById('testPremium').checked,
            created_by: session.user.id
        };
        
        const { error } = await supabase
            .from('tests')
            .insert([testData]);

        if (error) throw error;

        showAlert('success', 'Test adăugat cu succes!');
        closeModal('addTestModal');
        loadTests();
    } catch (error) {
        console.error('Eroare la adăugarea testului:', error);
        showAlert('error', 'Eroare la adăugarea testului');
    }
});

// Formular adăugare anunț
document.getElementById('addAnnouncementForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        const announcementData = {
            title: document.getElementById('announcementTitle').value,
            content: document.getElementById('announcementContent').value,
            target_class: document.getElementById('announcementClass').value || null,
            created_by: session.user.id
        };
        
        const { error } = await supabase
            .from('announcements')
            .insert([announcementData]);

        if (error) throw error;

        showAlert('success', 'Anunț publicat cu succes!');
        closeModal('addAnnouncementModal');
        loadAnnouncements();
    } catch (error) {
        console.error('Eroare la publicarea anunțului:', error);
        showAlert('error', 'Eroare la publicarea anunțului');
    }
});

// Filtre pentru note
document.getElementById('gradeClassFilter')?.addEventListener('change', loadGrades);
document.getElementById('testFilter')?.addEventListener('change', loadGrades);
document.getElementById('dateFromFilter')?.addEventListener('change', loadGrades);
document.getElementById('dateToFilter')?.addEventListener('change', loadGrades);

// Filtre pentru elevi
document.getElementById('classFilter')?.addEventListener('change', (e) => {
    const searchTerm = document.getElementById('studentSearch')?.value || '';
    loadStudents(e.target.value, searchTerm);
});

document.getElementById('studentSearch')?.addEventListener('input', (e) => {
    const classFilter = document.getElementById('classFilter')?.value || '';
    loadStudents(classFilter, e.target.value);
});

// ===== INIȚIALIZARE LA ÎNCĂRCAREA PAGINII =====
document.addEventListener('DOMContentLoaded', async () => {
    // Verificare acces admin
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        window.location.href = '/';
        return;
    }

    const { data: userData } = await supabase
        .from('users')
        .select('role, full_name')
        .eq('id', session.user.id)
        .single();

    if (!userData || (userData.role !== 'teacher' && userData.role !== 'admin')) {
        showAlert('error', 'Nu aveți permisiunea de a accesa această pagină');
        window.location.href = '/';
        return;
    }

    // Setare nume profesor
    const teacherNameEl = document.getElementById('teacherName');
    if (teacherNameEl) {
        teacherNameEl.textContent = userData.full_name;
    }

    // Încărcare date inițiale
    showSection('overview');
});
