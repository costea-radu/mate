// admin.js - Funcționalități pentru panoul de administrare

let studentsData = [];
let testsData = [];
let currentTab = 'students';
let charts = {};

// Verifică dacă utilizatorul este admin
document.addEventListener('DOMContentLoaded', async () => {
    await checkAdminAuth();
    await loadDashboardData();
    initializeCharts();
});

// Verifică dacă utilizatorul este admin
async function checkAdminAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    
    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();
    
    if (!userData || userData.role !== 'admin') {
        alert('Nu ai permisiuni de administrator!');
        window.location.href = 'index.html';
    }
}

// Încarcă datele pentru dashboard
async function loadDashboardData() {
    try {
        await Promise.all([
            loadStatistics(),
            loadStudents(),
            loadTestResults()
        ]);
    } catch (error) {
        console.error('Eroare la încărcarea datelor:', error);
        showNotification('error', 'Eroare la încărcarea datelor');
    }
}

// Încarcă statisticile generale
async function loadStatistics() {
    try {
        // Total elevi
        const { count: totalStudents } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'student');
        
        document.getElementById('totalStudents').textContent = totalStudents || 0;
        
        // Teste completate
        const { count: testsCompleted } = await supabase
            .from('test_results')
            .select('*', { count: 'exact', head: true });
        
        document.getElementById('testsCompleted').textContent = testsCompleted || 0;
        
        // Media generală
        const { data: avgData } = await supabase
            .from('test_results')
            .select('score');
        
        if (avgData && avgData.length > 0) {
            const average = avgData.reduce((sum, item) => sum + item.score, 0) / avgData.length;
            document.getElementById('averageScore').textContent = Math.round(average) + '%';
        } else {
            document.getElementById('averageScore').textContent = '0%';
        }
        
        // Activi astăzi
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { count: activeToday } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'student')
            .gte('last_login', today.toISOString());
        
        document.getElementById('activeToday').textContent = activeToday || 0;
        
    } catch (error) {
        console.error('Eroare la încărcarea statisticilor:', error);
    }
}

// Încarcă lista de elevi
async function loadStudents() {
    try {
        const { data, error } = await supabase
            .from('users')
            .select(`
                *,
                test_results (score),
                lesson_progress (last_accessed)
            `)
            .eq('role', 'student')
            .order('name');
        
        if (error) throw error;
        
        studentsData = data || [];
        displayStudents(studentsData);
        
    } catch (error) {
        console.error('Eroare la încărcarea elevilor:', error);
        document.getElementById('studentsTableBody').innerHTML = 
            '<tr><td colspan="7" class="no-data">Eroare la încărcarea datelor</td></tr>';
    }
}

// Afișează elevii în tabel
function displayStudents(students) {
    const tbody = document.getElementById('studentsTableBody');
    
    if (!students || students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">Nu există elevi înregistrați</td></tr>';
        return;
    }
    
    tbody.innerHTML = students.map(student => {
        const testsCount = student.test_results?.length || 0;
        const average = testsCount > 0 
            ? Math.round(student.test_results.reduce((sum, t) => sum + t.score, 0) / testsCount)
            : 0;
        
        const lastActivity = student.last_login 
            ? new Date(student.last_login).toLocaleDateString('ro-RO')
            : 'Niciodată';
        
        const scoreClass = average >= 80 ? 'score-high' : average >= 60 ? 'score-medium' : 'score-low';
        
        return `
            <tr>
                <td><strong>${student.name}</strong></td>
                <td>${student.email}</td>
                <td>Clasa ${student.class_level || '-'}</td>
                <td>${testsCount}</td>
                <td>
                    ${testsCount > 0 
                        ? `<span class="score-badge ${scoreClass}">${average}%</span>`
                        : '-'
                    }
                </td>
                <td>${lastActivity}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-small btn-view" onclick="viewStudentDetails('${student.id}')">
                            <i class="fas fa-eye"></i> Detalii
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Încarcă rezultatele testelor
async function loadTestResults() {
    try {
        const { data, error } = await supabase
            .from('test_results')
            .select(`
                *,
                users!inner(name, email, class_level),
                tests(test_name)
            `)
            .order('completed_at', { ascending: false })
            .limit(100);
        
        if (error) throw error;
        
        testsData = data || [];
        displayTestResults(testsData);
        
    } catch (error) {
        console.error('Eroare la încărcarea rezultatelor:', error);
        document.getElementById('testsTableBody').innerHTML = 
            '<tr><td colspan="7" class="no-data">Eroare la încărcarea datelor</td></tr>';
    }
}

// Afișează rezultatele testelor
function displayTestResults(results) {
    const tbody = document.getElementById('testsTableBody');
    
    if (!results || results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">Nu există rezultate încă</td></tr>';
        return;
    }
    
    tbody.innerHTML = results.map(result => {
        const scoreClass = result.score >= 80 ? 'score-high' : result.score >= 60 ? 'score-medium' : 'score-low';
        const completedDate = new Date(result.completed_at).toLocaleDateString('ro-RO');
        
        return `
            <tr>
                <td><strong>${result.users.name}</strong></td>
                <td>Clasa ${result.users.class_level || '-'}</td>
                <td>${result.tests?.test_name || 'Test necunoscut'}</td>
                <td><span class="score-badge ${scoreClass}">${result.score}%</span></td>
                <td>${result.completion_time || '-'}</td>
                <td>${completedDate}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-small btn-view" onclick="viewTestDetails('${result.id}')">
                            <i class="fas fa-eye"></i> Vezi
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Schimbă tab-ul activ
function switchTab(tab) {
    currentTab = tab;
    
    // Actualizează butoanele tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    // Ascunde toate tab-urile
    document.getElementById('studentsTab').style.display = 'none';
    document.getElementById('testsTab').style.display = 'none';
    document.getElementById('progressTab').style.display = 'none';
    document.getElementById('analyticsTab').style.display = 'none';
    
    // Afișează tab-ul selectat
    switch(tab) {
        case 'students':
            document.getElementById('studentsTab').style.display = 'block';
            break;
        case 'tests':
            document.getElementById('testsTab').style.display = 'block';
            break;
        case 'progress':
            document.getElementById('progressTab').style.display = 'block';
            updateProgressChart();
            break;
        case 'analytics':
            document.getElementById('analyticsTab').style.display = 'block';
            updateAnalyticsCharts();
            break;
    }
}

// Aplică filtrele
async function applyFilters() {
    const classFilter = document.getElementById('classFilter').value;
    const searchTerm = document.getElementById('searchStudent').value.toLowerCase();
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    
    let filteredStudents = studentsData;
    
    // Filtrare după clasă
    if (classFilter) {
        filteredStudents = filteredStudents.filter(s => s.class_level === classFilter);
    }
    
    // Filtrare după nume/email
    if (searchTerm) {
        filteredStudents = filteredStudents.filter(s => 
            s.name.toLowerCase().includes(searchTerm) || 
            s.email.toLowerCase().includes(searchTerm)
        );
    }
    
    // Filtrare după dată (pentru rezultate teste)
    if (currentTab === 'tests') {
        let filteredTests = testsData;
        
        if (dateFrom) {
            filteredTests = filteredTests.filter(t => 
                new Date(t.completed_at) >= new Date(dateFrom)
            );
        }
        
        if (dateTo) {
            filteredTests = filteredTests.filter(t => 
                new Date(t.completed_at) <= new Date(dateTo + 'T23:59:59')
            );
        }
        
        displayTestResults(filteredTests);
    } else {
        displayStudents(filteredStudents);
    }
}

// Vezi detaliile unui elev
async function viewStudentDetails(studentId) {
    const student = studentsData.find(s => s.id === studentId);
    if (!student) return;
    
    // Obține toate datele elevului
    const { data: testResults } = await supabase
        .from('test_results')
        .select('*, tests(test_name)')
        .eq('user_id', studentId)
        .order('completed_at', { ascending: false });
    
    const { data: lessons } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('user_id', studentId)
        .order('last_accessed', { ascending: false });
    
    // Construiește conținutul modalului
    const modalContent = `
        <div style="margin-top: 20px;">
            <h3 style="color: #667eea; margin-bottom: 15px;">
                <i class="fas fa-user"></i> Informații Generale
            </h3>
            <p><strong>Email:</strong> ${student.email}</p>
            <p><strong>Clasă:</strong> ${student.class_level || 'Nespecificată'}</p>
            <p><strong>Înregistrat:</strong> ${new Date(student.created_at).toLocaleDateString('ro-RO')}</p>
            <p><strong>Ultima activitate:</strong> ${student.last_login ? new Date(student.last_login).toLocaleDateString('ro-RO') : 'Niciodată'}</p>
        </div>
        
        <div style="margin-top: 30px;">
            <h3 style="color: #667eea; margin-bottom: 15px;">
                <i class="fas fa-clipboard-list"></i> Rezultate Teste (${testResults?.length || 0})
            </h3>
            ${testResults && testResults.length > 0 ? `
                <table style="width: 100%; margin-top: 10px;">
                    <thead>
                        <tr style="background: #f8f9ff;">
                            <th style="padding: 10px; text-align: left;">Test</th>
                            <th style="padding: 10px; text-align: left;">Scor</th>
                            <th style="padding: 10px; text-align: left;">Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${testResults.map(r => `
                            <tr>
                                <td style="padding: 8px;">${r.tests?.test_name || 'Test'}</td>
                                <td style="padding: 8px;">
                                    <span class="score-badge ${r.score >= 80 ? 'score-high' : r.score >= 60 ? 'score-medium' : 'score-low'}">
                                        ${r.score}%
                                    </span>
                                </td>
                                <td style="padding: 8px;">${new Date(r.completed_at).toLocaleDateString('ro-RO')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p style="color: #999;">Nu există rezultate încă</p>'}
        </div>
        
        <div style="margin-top: 30px;">
            <h3 style="color: #667eea; margin-bottom: 15px;">
                <i class="fas fa-book"></i> Lecții Accesate (${lessons?.length || 0})
            </h3>
            ${lessons && lessons.length > 0 ? `
                <ul style="list-style: none; padding: 0;">
                    ${lessons.slice(0, 5).map(l => `
                        <li style="padding: 5px 0;">
                            <i class="fas fa-check-circle" style="color: #48bb78;"></i>
                            ${l.lesson_name} - ${new Date(l.last_accessed).toLocaleDateString('ro-RO')}
                        </li>
                    `).join('')}
                </ul>
            ` : '<p style="color: #999;">Nu a accesat lecții încă</p>'}
        </div>
    `;
    
    document.getElementById('modalStudentName').textContent = `Detalii - ${student.name}`;
    document.getElementById('modalContent').innerHTML = modalContent;
    document.getElementById('studentModal').classList.add('show');
}

// Închide modalul
function closeModal() {
    document.getElementById('studentModal').classList.remove('show');
}

// Inițializează graficele
function initializeCharts() {
    // Grafic progres în timp
    const progressCtx = document.getElementById('progressChart')?.getContext('2d');
    if (progressCtx) {
        charts.progress = new Chart(progressCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Media Scorurilor',
                    data: [],
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
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
    }
    
    // Grafic performanță pe clase
    const classCtx = document.getElementById('classChart')?.getContext('2d');
    if (classCtx) {
        charts.class = new Chart(classCtx, {
            type: 'bar',
            data: {
                labels: ['Clasa 5', 'Clasa 6', 'Clasa 7', 'Clasa 8'],
                datasets: [{
                    label: 'Media Scorurilor',
                    data: [],
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(118, 75, 162, 0.8)',
                        'rgba(144, 104, 190, 0.8)',
                        'rgba(170, 133, 218, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }
    
    // Grafic distribuție note
    const gradesCtx = document.getElementById('gradesChart')?.getContext('2d');
    if (gradesCtx) {
        charts.grades = new Chart(gradesCtx, {
            type: 'doughnut',
            data: {
                labels: ['Foarte Bine (80-100)', 'Bine (60-79)', 'Satisfăcător (40-59)', 'Insuficient (0-39)'],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#48bb78',
                        '#4299e1',
                        '#ecc94b',
                        '#f56565'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
}

// Actualizează graficul de progres
async function updateProgressChart() {
    try {
        const { data } = await supabase
            .from('test_results')
            .select('score, completed_at')
            .order('completed_at');
        
        if (data && charts.progress) {
            // Grupează scorurile pe luni
            const monthlyData = {};
            data.forEach(result => {
                const month = new Date(result.completed_at).toLocaleDateString('ro-RO', { month: 'short', year: 'numeric' });
                if (!monthlyData[month]) {
                    monthlyData[month] = { total: 0, count: 0 };
                }
                monthlyData[month].total += result.score;
                monthlyData[month].count++;
            });
            
            const labels = Object.keys(monthlyData);
            const averages = labels.map(month => 
                Math.round(monthlyData[month].total / monthlyData[month].count)
            );
            
            charts.progress.data.labels = labels;
            charts.progress.data.datasets[0].data = averages;
            charts.progress.update();
        }
    } catch (error) {
        console.error('Eroare la actualizarea graficului:', error);
    }
}

// Actualizează graficele de analiză
async function updateAnalyticsCharts() {
    try {
        // Performanță pe clase
        const { data: classData } = await supabase
            .from('class_performance')
            .select('*');
        
        if (classData && charts.class) {
            const classAverages = [5, 6, 7, 8].map(cls => {
                const found = classData.find(c => c.class_level === cls.toString());
                return found ? Math.round(found.average_score) : 0;
            });
            
            charts.class.data.datasets[0].data = classAverages;
            charts.class.update();
        }
        
        // Distribuție note
        const { data: gradesData } = await supabase
            .from('test_results')
            .select('score');
        
        if (gradesData && charts.grades) {
            const distribution = [0, 0, 0, 0]; // [80-100, 60-79, 40-59, 0-39]
            
            gradesData.forEach(result => {
                if (result.score >= 80) distribution[0]++;
                else if (result.score >= 60) distribution[1]++;
                else if (result.score >= 40) distribution[2]++;
                else distribution[3]++;
            });
            
            charts.grades.data.datasets[0].data = distribution;
            charts.grades.update();
        }
    } catch (error) {
        console.error('Eroare la actualizarea graficelor:', error);
    }
}

// Exportă datele în CSV
function exportData() {
    let csv = '';
    
    if (currentTab === 'students') {
        csv = 'Nume,Email,Clasa,Teste Completate,Media,Ultima Activitate\n';
        studentsData.forEach(student => {
            const testsCount = student.test_results?.length || 0;
            const average = testsCount > 0 
                ? Math.round(student.test_results.reduce((sum, t) => sum + t.score, 0) / testsCount)
                : 0;
            const lastActivity = student.last_login 
                ? new Date(student.last_login).toLocaleDateString('ro-RO')
                : 'Niciodată';
            
            csv += `"${student.name}","${student.email}","${student.class_level || '-'}",${testsCount},${average}%,"${lastActivity}"\n`;
        });
    } else if (currentTab === 'tests') {
        csv = 'Elev,Clasa,Test,Scor,Timp,Data\n';
        testsData.forEach(result => {
            csv += `"${result.users.name}","${result.users.class_level || '-'}","${result.tests?.test_name || 'Test'}",${result.score}%,${result.completion_time || '-'},"${new Date(result.completed_at).toLocaleDateString('ro-RO')}"\n`;
        });
    }
    
    // Descarcă fișierul
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `export_${currentTab}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('success', 'Date exportate cu succes!');
}

// Afișează notificări
function showNotification(type, message) {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#48bb78' : '#f56565'};
        color: white;
        border-radius: 10px;
        z-index: 2000;
        animation: slideInRight 0.3s ease;
    `;
    alert.textContent = message;
    
    document.body.appendChild(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 3000);
}

// Exportă funcțiile globale
window.switchTab = switchTab;
window.applyFilters = applyFilters;
window.viewStudentDetails = viewStudentDetails;
window.viewTestDetails = viewTestDetails;
window.closeModal = closeModal;
window.exportData = exportData;
window.logout = logout;