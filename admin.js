// Verifică dacă utilizatorul este admin
let allStudents = [];
let allGrades = [];
let allTests = [];

document.addEventListener('DOMContentLoaded', async () => {
    checkAdminAccess();
    await loadAllData();
    initializeCharts();
});

// Verifică accesul admin
function checkAdminAccess() {
    const currentUser = window.supabaseConnection.currentUser();
    
    if (!currentUser || currentUser.role !== 'admin') {
        alert('Nu ai permisiunea de a accesa această pagină!');
        window.location.href = 'index.html';
        return;
    }
    
    document.getElementById('adminName').textContent = currentUser.name;
}

// Încarcă toate datele
async function loadAllData() {
    try {
        await Promise.all([
            loadStudents(),
            loadGrades(),
            loadTests()
        ]);
        
        updateStatistics();
        updateStudentsTable();
        updateGradesTable();
        updateLeaderboard();
        updateCharts();
        
    } catch (error) {
        console.error('Eroare la încărcarea datelor:', error);
        window.supabaseConnection.showAlert('Eroare la încărcarea datelor!', 'error');
    }
}

// Încarcă lista de elevi
async function loadStudents() {
    const { data, error } = await window.supabaseConnection.supabase
        .from('users')
        .select('*')
        .eq('role', 'student')
        .order('created_at', { ascending: false });
    
    if (error) throw error;
    allStudents = data || [];
}

// Încarcă toate notele
async function loadGrades() {
    const { data, error } = await window.supabaseConnection.supabase
        .from('grades')
        .select(`
            *,
            users (name, email, class),
            tests (test_name, category, class)
        `)
        .order('completed_at', { ascending: false });
    
    if (error) throw error;
    allGrades = data || [];
}

// Încarcă toate testele
async function loadTests() {
    const { data, error } = await window.supabaseConnection.supabase
        .from('tests')
        .select('*')
        .order('class', { ascending: true });
    
    if (error) throw error;
    allTests = data || [];
    
    // Populează dropdown-ul de teste
    const testFilter = document.getElementById('testFilter');
    testFilter.innerHTML = '<option value="">Toate</option>';
    allTests.forEach(test => {
        testFilter.innerHTML += `<option value="${test.id}">${test.test_name} (Clasa ${test.class})</option>`;
    });
}

// Actualizează statisticile
function updateStatistics() {
    // Total elevi
    document.getElementById('totalStudents').textContent = allStudents.length;
    
    // Total teste completate
    document.getElementById('totalTests').textContent = allGrades.length;
    
    // Media generală
    const avgGrade = allGrades.length > 0
        ? (allGrades.reduce((sum, g) => sum + parseFloat(g.score), 0) / allGrades.length).toFixed(1)
        : 0;
    document.getElementById('averageGrade').textContent = avgGrade;
    
    // Activitate azi
    const today = new Date().toDateString();
    const todayGrades = allGrades.filter(g => 
        new Date(g.completed_at).toDateString() === today
    );
    document.getElementById('todayActivity').textContent = todayGrades.length;
}

// Actualizează tabelul de elevi
function updateStudentsTable() {
    const tbody = document.getElementById('studentsTableBody');
    const classFilter = document.getElementById('classFilter').value;
    const searchTerm = document.getElementById('searchStudent').value.toLowerCase();
    
    let filteredStudents = allStudents;
    
    // Aplică filtre
    if (classFilter) {
        filteredStudents = filteredStudents.filter(s => s.class == classFilter);
    }
    
    if (searchTerm) {
        filteredStudents = filteredStudents.filter(s => 
            s.name.toLowerCase().includes(searchTerm) || 
            s.email.toLowerCase().includes(searchTerm)
        );
    }
    
    if (filteredStudents.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-users-slash"></i>
                    <p>Nu s-au găsit elevi</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filteredStudents.map(student => {
        const studentGrades = allGrades.filter(g => g.user_id === student.id);
        const avgScore = studentGrades.length > 0
            ? (studentGrades.reduce((sum, g) => sum + parseFloat(g.score), 0) / studentGrades.length).toFixed(1)
            : '-';
        
        const lastActivity = studentGrades.length > 0
            ? new Date(studentGrades[0].completed_at).toLocaleDateString('ro-RO')
            : 'Nicio activitate';
        
        const avgBadge = avgScore === '-' ? '' : 
            avgScore >= 90 ? 'badge-success' :
            avgScore >= 70 ? 'badge-info' :
            avgScore >= 50 ? 'badge-warning' : 'badge-danger';
        
        return `
            <tr>
                <td><strong>${student.name}</strong></td>
                <td>${student.email}</td>
                <td><span class="badge badge-info">Clasa ${student.class}</span></td>
                <td>${studentGrades.length}</td>
                <td>${avgScore !== '-' ? `<span class="badge ${avgBadge}">${avgScore}</span>` : '-'}</td>
                <td>${lastActivity}</td>
            </tr>
        `;
    }).join('');
}

// Actualizează tabelul de note
function updateGradesTable() {
    const tbody = document.getElementById('gradesTableBody');
    const classFilter = document.getElementById('gradeClassFilter').value;
    const testFilter = document.getElementById('testFilter').value;
    const periodFilter = document.getElementById('periodFilter').value;
    
    let filteredGrades = allGrades;
    
    // Aplică filtre
    if (classFilter) {
        filteredGrades = filteredGrades.filter(g => g.users.class == classFilter);
    }
    
    if (testFilter) {
        filteredGrades = filteredGrades.filter(g => g.test_id === testFilter);
    }
    
    if (periodFilter) {
        const now = new Date();
        const filterDate = new Date();
        
        switch(periodFilter) {
            case 'today':
                filterDate.setHours(0, 0, 0, 0);
                break;
            case 'week':
                filterDate.setDate(now.getDate() - 7);
                break;
            case 'month':
                filterDate.setMonth(now.getMonth() - 1);
                break;
        }
        
        filteredGrades = filteredGrades.filter(g => 
            new Date(g.completed_at) >= filterDate
        );
    }
    
    if (filteredGrades.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-clipboard-list"></i>
                    <p>Nu s-au găsit note</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filteredGrades.map(grade => {
        const scoreBadge = 
            grade.score >= 90 ? 'badge-success' :
            grade.score >= 70 ? 'badge-info' :
            grade.score >= 50 ? 'badge-warning' : 'badge-danger';
        
        const timeSpent = grade.time_spent 
            ? Math.round(grade.time_spent / 60) 
            : '-';
        
        return `
            <tr>
                <td><strong>${grade.users.name}</strong></td>
                <td><span class="badge badge-info">Clasa ${grade.users.class}</span></td>
                <td>${grade.tests.test_name}</td>
                <td><span class="badge ${scoreBadge}">${grade.score.toFixed(1)}</span></td>
                <td>${timeSpent}</td>
                <td>${new Date(grade.completed_at).toLocaleDateString('ro-RO')}</td>
            </tr>
        `;
    }).join('');
}

// Actualizează clasamentul
function updateLeaderboard() {
    const container = document.getElementById('leaderboardContainer');
    const classFilter = document.getElementById('leaderboardClassFilter').value;
    
    // Calculează media pentru fiecare elev
    const studentScores = allStudents.map(student => {
        const studentGrades = allGrades.filter(g => g.user_id === student.id);
        const avgScore = studentGrades.length > 0
            ? studentGrades.reduce((sum, g) => sum + parseFloat(g.score), 0) / studentGrades.length
            : 0;
        
        return {
            ...student,
            testsCompleted: studentGrades.length,
            avgScore: avgScore
        };
    });
    
    // Filtrează și sortează
    let leaderboard = studentScores
        .filter(s => s.testsCompleted > 0)
        .filter(s => !classFilter || s.class == classFilter)
        .sort((a, b) => b.avgScore - a.avgScore);
    
    if (leaderboard.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-trophy"></i>
                <p>Nu există date pentru clasament</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = leaderboard.slice(0, 10).map((student, index) => {
        const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
        const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
        
        return `
            <div class="leaderboard-item">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <span class="rank ${rankClass}">${rankIcon}</span>
                    <div>
                        <strong>${student.name}</strong>
                        <br>
                        <small>Clasa ${student.class} • ${student.testsCompleted} teste</small>
                    </div>
                </div>
                <div style="text-align: right;">
                    <span class="badge badge-success" style="font-size: 1.2rem;">
                        ${student.avgScore.toFixed(1)}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

// Inițializează graficele
function initializeCharts() {
    // Grafic performanță pe clase
    const performanceCtx = document.getElementById('performanceChart').getContext('2d');
    window.performanceChart = new Chart(performanceCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Media pe Clasă',
                data: [],
                backgroundColor: 'rgba(102, 126, 234, 0.6)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Performanța Medie pe Clase'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
    
    // Grafic distribuție elevi
    const distributionCtx = document.getElementById('classDistributionChart').getContext('2d');
    window.distributionChart = new Chart(distributionCtx, {
        type: 'pie',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    'rgba(102, 126, 234, 0.8)',
                    'rgba(118, 75, 162, 0.8)',
                    'rgba(144, 101, 176, 0.8)',
                    'rgba(171, 127, 190, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Distribuția Elevilor pe Clase'
                },
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Actualizează graficele
function updateCharts() {
    // Date pentru graficul de performanță
    const performanceData = [5, 6, 7, 8].map(cls => {
        const classGrades = allGrades.filter(g => g.users.class === cls);
        const avg = classGrades.length > 0
            ? classGrades.reduce((sum, g) => sum + parseFloat(g.score), 0) / classGrades.length
            : 0;
        return avg.toFixed(1);
    });
    
    window.performanceChart.data.labels = ['Clasa 5', 'Clasa 6', 'Clasa 7', 'Clasa 8'];
    window.performanceChart.data.datasets[0].data = performanceData;
    window.performanceChart.update();
    
    // Date pentru graficul de distribuție
    const distributionData = [5, 6, 7, 8].map(cls => 
        allStudents.filter(s => s.class === cls).length
    );
    
    window.distributionChart.data.labels = ['Clasa 5', 'Clasa 6', 'Clasa 7', 'Clasa 8'];
    window.distributionChart.data.datasets[0].data = distributionData;
    window.distributionChart.update();
}

// Funcții pentru panouri
function showPanel(panelName) {
    // Ascunde toate panourile
    document.querySelectorAll('.panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    // Dezactivează toate tab-urile
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Activează panoul selectat
    document.getElementById(panelName).classList.add('active');
    
    // Activează tab-ul corespunzător
    event.target.closest('.tab').classList.add('active');
}

// Funcții pentru filtre
function filterStudents() {
    updateStudentsTable();
}

function filterGrades() {
    updateGradesTable();
}

function filterLeaderboard() {
    updateLeaderboard();
}

// Reîmprospătează datele
async function refreshData() {
    const btn = event.target;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Se actualizează...';
    
    await loadAllData();
    
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizează Date';
    
    window.supabaseConnection.showAlert('Datele au fost actualizate!', 'success');
}

// Deconectare
function logout() {
    if (confirm('Ești sigur că vrei să te deconectezi?')) {
        window.supabaseConnection.logout();
        window.location.href = 'index.html';
    }
}
