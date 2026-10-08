import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import JobCard from './components/JobCard';
import ApplyForm from './components/ApplyForm';
import Register from './components/Register';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import SavedJobs from './components/SavedJobs';
import Recommendations from './components/Recommendations';
import AuthSuccess from './components/AuthSuccess';
import Messages from './components/Messages'; 
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import './App.css';

// 🌟 አዳዲስ Import የተደረጉ
import JobAlerts from './components/JobAlerts';
import Notifications from './components/Notifications';
import Interviews from './components/Interviews';
import ScheduleInterview from './components/ScheduleInterview'; 
import ChangePassword from './components/ChangePassword'; 
import TwoFactorSetup from './components/TwoFactorSetup'; 
import GoogleLogin from './components/GoogleLogin'; 
import EmployerApplications from './components/EmployerApplications';

// API URL
const API_URL = 'http://localhost:5000';

// Reset Password Wrapper Component
function ResetPasswordWrapper() {
    const navigate = useNavigate();
    return <ResetPassword onComplete={() => navigate('/login')} />;
}

// Forgot Password Wrapper Component
function ForgotPasswordWrapper() {
    const navigate = useNavigate();
    return <ForgotPassword onBack={() => navigate('/login')} />;
}

// Main App Content
function AppContent() {
    const { t, setLanguage, language } = useLanguage(); 
    const navigate = useNavigate();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedJob, setSelectedJob] = useState(null);
    const [showApplyForm, setShowApplyForm] = useState(false);
    const [user, setUser] = useState(null);
    const [currentPage, setCurrentPage] = useState('jobs');
    
    const [selectedApplicant, setSelectedApplicant] = useState(null);
    const [employerApplications, setEmployerApplications] = useState([]);

    // Advanced search filters
    const [titleFilter, setTitleFilter] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [minSalary, setMinSalary] = useState('');
    const [maxSalary, setMaxSalary] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);

    // ✅ Check for existing user session and token
    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        
        if (savedUser && token) {
            // Verify token with backend
            fetch(`${API_URL}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(res => {
                if (res.ok) {
                    setUser(JSON.parse(savedUser));
                } else {
                    // Token invalid, clear storage
                    localStorage.removeItem('user');
                    localStorage.removeItem('token');
                    navigate('/login');
                }
            })
            .catch(() => {
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                navigate('/login');
            });
        }
    }, []);

    // URL Sync Effect
    useEffect(() => {
        const path = window.location.pathname;
        const pageMap = {
            '/recommendations': 'recommendations',
            '/saved': 'saved',
            '/admin': 'admin',
            '/analytics': 'analytics',
            '/messages': 'messages',
            '/alerts': 'alerts',
            '/notifications': 'notifications',
            '/interviews': 'interviews',
            '/change-password': 'change-password',
            '/2fa-setup': '2fa-setup',
            '/employer-apps': 'employer-apps'
        };
        
        if (pageMap[path]) {
            setCurrentPage(pageMap[path]);
        }
    }, []);
    // ✅ Push Notification Subscription Effect
useEffect(() => {
    const subscribeToPush = async () => {
        // ተጠቃሚው ካልገባ ምዝገባ አያስፈልግም
        if (!user) return;

        try {
            // 1. Service Worker ዝግጁ መሆኑን ያረጋግጣል
            const registration = await navigator.serviceWorker.ready;

            // 2. ለPush Notification ይመዘግባል
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                // ማሳሰቢያ፡ REACT_APP_VAPID_PUBLIC_KEY በ .env ውስጥ መኖሩን አረጋግጥ
                applicationServerKey: process.env.REACT_APP_VAPID_PUBLIC_KEY 
            });

            console.log("✅ Push Subscription JSON:", JSON.stringify(subscription));

            // 3. እዚህ ጋር Subscription ዳታውን ወደ Backend መላክ ትችላለህ
            // fetch(`${API_URL}/api/notifications/subscribe`, {
            //     method: 'POST',
            //     headers: { 
            //         'Content-Type': 'application/json',
            //         'Authorization': `Bearer ${localStorage.getItem('token')}`
            //     },
            //     body: JSON.stringify({ subscription, userId: user.id })
            // });

        } catch (error) {
            console.error("❌ Push Subscription Error:", error);
        }
    };

    subscribeToPush();
}, [user]); // ተጠቃሚው በገባ ቁጥር (Login ሲያደርግ) ይነሳል

    const fetchJobs = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const url = search ? `${API_URL}/api/jobs?search=${encodeURIComponent(search)}` : `${API_URL}/api/jobs`;
            const res = await fetch(url, {
                headers: { 'Authorization': token ? `Bearer ${token}` : '' }
            });
            const data = await res.json();
            setJobs(data.data || data);
            setLoading(false);
        } catch (err) {
            console.error('❌ Error fetching jobs:', err);
            setLoading(false);
        }
    };

    const fetchEmployerApplications = async () => {
        if (!user || user.role !== 'employer') return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/applications/employer/${user.id}`, {
                headers: { 'Authorization': token ? `Bearer ${token}` : '' }
            });
            const data = await res.json();
            setEmployerApplications(data);
        } catch (err) {
            console.error('❌ Error fetching employer applications:', err);
        }
    };

    useEffect(() => {
        if (currentPage === 'employer-apps') {
            fetchEmployerApplications();
        }
    }, [currentPage]);

    const runAdvancedSearch = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            let url = `${API_URL}/api/jobs/search?`;
            if (titleFilter) url += `title=${encodeURIComponent(titleFilter)}&`;
            if (locationFilter) url += `location=${encodeURIComponent(locationFilter)}&`;
            if (typeFilter) url += `type=${typeFilter}&`;
            if (minSalary) url += `minSalary=${minSalary}&`;
            if (maxSalary) url += `maxSalary=${maxSalary}&`;
            
            const res = await fetch(url, {
                headers: { 'Authorization': token ? `Bearer ${token}` : '' }
            });
            const data = await res.json();
            setJobs(data.data || data);
            setLoading(false);
        } catch (err) {
            console.error('❌ Search error:', err);
            setLoading(false);
        }
    };

    const resetFilters = () => {
        setTitleFilter('');
        setLocationFilter('');
        setTypeFilter('');
        setMinSalary('');
        setMaxSalary('');
        fetchJobs();
    };

    useEffect(() => {
        if (user) {
            fetchJobs();
        }
    }, [user, search]);

    const handleSubmitApplication = async (jobId, formData) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/applications`, {
                method: 'POST',
                headers: { 'Authorization': token ? `Bearer ${token}` : '' },
                body: formData
            });
            if (res.ok) {
                console.log('✅ Application submitted successfully!');
                setShowApplyForm(false);
                setSelectedJob(null);
                return true; 
            } else {
                console.error('❌ Failed to submit application');
                return false;
            }
        } catch (err) {
            console.error('❌ Error submitting application:', err);
            return false;
    }};

    // ✅ Register - stores token
   const handleRegister = async (userData) => {
    try {
        const res = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        const data = await res.json();

        if (res.ok && data.success) {
            const userInfo = data.data.user; 
            const token = data.data.token;

            setUser(userInfo);
            localStorage.setItem('user', JSON.stringify(userInfo));
            localStorage.setItem('token', token);
            navigate('/');
            return true;
        }
        return false;
    } catch (err) {
        console.error('❌ Registration error:', err);
        return false;
    }
};
    // ✅ Login - stores token
const handleLogin = async (credentials) => {
    try {
        const res = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });

        const data = await res.json();

        if (res.ok) {
            // 🌟 አንተ የፃፍከው ምርጥ Logic
            const userInfo = data.data ? data.data.user : data.user;
            const token = data.data ? data.data.token : data.token;

            if (token && userInfo) {
                setUser(userInfo);
                localStorage.setItem('user', JSON.stringify(userInfo));
                localStorage.setItem('token', token);
                navigate('/');
                return true;
            }
        }
        return false;
    } catch (err) {
        console.error('❌ Login error:', err);
        return false;
    }
};

// ✅ Logout - stores token
    const handleLogout = () => {
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setCurrentPage('jobs');
        setJobs([]);
        navigate('/login');
    };

    const styles = {
        container: { minHeight: '100vh', background: '#0a3d0a' },
        hero: { textAlign: 'center', padding: '4rem 2rem', background: 'linear-gradient(135deg, #0a3d0a, #1a6d1a)' },
        title: { fontSize: '3rem', marginBottom: '1rem', color: '#fff' },
        subtitle: { fontSize: '1.2rem', marginBottom: '2rem', color: '#ccc' },
        searchBox: { padding: '0.8rem', width: '300px', borderRadius: '50px', border: 'none', marginRight: '0.5rem' },
        searchBtn: { padding: '0.8rem 1.5rem', background: '#2ecc71', border: 'none', borderRadius: '50px', color: '#fff', cursor: 'pointer' },
        jobsSection: { padding: '2rem 5%' },
        sectionTitle: { fontSize: '2rem', marginBottom: '2rem', textAlign: 'center', color: '#fff' },
        jobsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' },
        loading: { textAlign: 'center', padding: '2rem', color: '#fff' },
        filterBox: { background: 'rgba(30,60,30,0.8)', padding: '1rem', borderRadius: '15px', marginBottom: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.8rem' },
        filterInput: { padding: '0.5rem', borderRadius: '8px', border: 'none', background: '#0a2a0a', color: '#fff' },
        filterSelect: { padding: '0.5rem', borderRadius: '8px', border: 'none', background: '#0a2a0a', color: '#fff' },
        toggleBtn: { background: 'transparent', border: '1px solid #2ecc71', color: '#2ecc71', padding: '0.5rem 1rem', borderRadius: '50px', cursor: 'pointer', marginBottom: '1rem' },
        languageBtn: { background: '#2ecc71', border: 'none', borderRadius: '8px', color: '#fff', padding: '0.3rem 0.8rem', cursor: 'pointer', marginLeft: '0.5rem' }
    };

    // AuthSuccess ገጽ ላይ እያለን ወደ ሎጊን እንዳይወረውረን ይህንን ቼክ እንጨምራለን
const isAuthPath = window.location.pathname === '/auth-success';

if (!user && currentPage !== 'register' && !isAuthPath) {
    return (
        <div style={styles.container}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem' }}>
                <button style={styles.languageBtn} onClick={() => setLanguage(language === 'en' ? 'am' : 'en')}>
                    {language === 'en' ? 'አማርኛ' : 'English'}
                </button>
            </div>
            <Login 
                onLogin={handleLogin} 
                onForgotPassword={() => navigate('/forgot-password')} 
                onSwitch={() => setCurrentPage('register')} 
            />
        </div>
    );
}

    if (currentPage === 'register') {
        return (
            <div style={styles.container}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem' }}>
                    <button style={styles.languageBtn} onClick={() => setLanguage(language === 'en' ? 'am' : 'en')}>
                        {language === 'en' ? 'አማርኛ' : 'English'}
                    </button>
                </div>
                <Register onRegister={handleRegister} onSwitch={() => setCurrentPage('login')} />
            </div>
        );
    }

    const renderContent = () => {
        switch(currentPage) {
            case 'saved':
                return <SavedJobs user={user} />;
            case 'recommendations':
                return <Recommendations user={user} />;
            case 'messages': 
                return <Messages user={user} setCurrentPage={setCurrentPage} />;
            case 'alerts':
                return <JobAlerts user={user} />;
            case 'notifications':
                return <Notifications user={user} />;
            case 'interviews':
                return <Interviews user={user} />;
            case 'change-password':
                return <ChangePassword user={user} />;
            case '2fa-setup':
                return <TwoFactorSetup user={user} />;
            case 'employer-apps':
                return <EmployerApplications user={user} />;
            case 'admin':
                return user?.role === 'admin' ? <AdminDashboard /> : <div style={{color:'white', textAlign:'center', padding:'2rem'}}>Access Denied</div>;
            case 'analytics':
                return user?.role === 'admin' ? <AnalyticsDashboard /> : <div style={{color:'white', textAlign:'center', padding:'2rem'}}>Access Denied</div>;
            default:
                return (
                    <>
                        <div style={styles.hero}>
                            <h1 style={styles.title}>የስራ መድረክ (Job Portal)</h1>
                            <p style={styles.subtitle}>{t.findJob || 'Find your dream job today!'}</p>
                            <div>
                                <input style={styles.searchBox} type="text" placeholder={t.search || 'Search jobs...'} value={search} onChange={(e) => setSearch(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && fetchJobs()} />
                                <button style={styles.searchBtn} onClick={fetchJobs}>{t.search || 'Search'}</button>
                            </div>
                        </div>

                        <div style={{ textAlign: 'center', padding: '0 5%' }}>
                            <button style={styles.toggleBtn} onClick={() => setShowAdvanced(!showAdvanced)}>
                                {showAdvanced ? (t.hideAdvanced || 'Hide Advanced') : (t.advancedSearch || 'Advanced Search')}
                            </button>
                        </div>

                        {showAdvanced && (
                            <div style={{ padding: '0 5%' }}>
                                <div style={styles.filterBox}>
                                    <input style={styles.filterInput} type="text" placeholder={t.jobTitle || 'Job Title'} value={titleFilter} onChange={(e) => setTitleFilter(e.target.value)} />
                                    <input style={styles.filterInput} type="text" placeholder={t.location || 'Location'} value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} />
                                    <select style={styles.filterSelect} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                                        <option value="">{t.type || 'Job Type'}</option>
                                        <option value="full-time">Full Time</option>
                                        <option value="part-time">Part Time</option>
                                        <option value="remote">Remote</option>
                                        <option value="contract">Contract</option>
                                    </select>
                                    <input style={styles.filterInput} type="number" placeholder={t.minSalary || 'Min Salary'} value={minSalary} onChange={(e) => setMinSalary(e.target.value)} />
                                    <input style={styles.filterInput} type="number" placeholder={t.maxSalary || 'Max Salary'} value={maxSalary} onChange={(e) => setMaxSalary(e.target.value)} />
                                    <button style={styles.searchBtn} onClick={runAdvancedSearch}>{t.filter || 'Filter'}</button>
                                    <button style={{...styles.searchBtn, background: '#ef4444'}} onClick={resetFilters}>{t.reset || 'Reset'}</button>
                                </div>
                            </div>
                        )}

                        <div style={styles.jobsSection}>
                            <h2 style={styles.sectionTitle}>{t.latestJobs || 'Latest Jobs'}</h2>
                            {loading ? (
                                <div style={styles.loading}>Loading...</div>
                            ) : jobs.length === 0 ? (
                                <div style={styles.loading}>No jobs found</div>
                            ) : (
                                <div style={styles.jobsGrid}>
                                    {jobs.map(job => (
                                        <JobCard 
                                            key={job.id} 
                                            job={job} 
                                            user={user}
                                            onApply={(job) => { 
                                                setSelectedJob(job); 
                                                setShowApplyForm(true); 
                                            }} 
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                );
        }
    };

    return (
        <div style={styles.container}>
            <Navbar 
                user={user} 
                setUser={setUser} 
                setCurrentPage={setCurrentPage} 
                onLogout={handleLogout} 
                currentPage={currentPage}
            />
            {renderContent()}
            {showApplyForm && selectedJob && (
                <ApplyForm 
                    job={selectedJob} 
                    onClose={() => { 
                        setShowApplyForm(false); 
                        setSelectedJob(null); 
                    }} 
                    onSubmit={handleSubmitApplication} 
                />
            )}
        </div>
    );
}

// Main App Component with Router
function App() {
    return (
        <LanguageProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<AppContent />} />
                    <Route path="/login" element={<AppContent />} />
                    <Route path="/register" element={<AppContent />} />
                    <Route path="/admin" element={<AppContent />} />
                    <Route path="/analytics" element={<AppContent />} />
                    <Route path="/saved" element={<AppContent />} />
                    <Route path="/recommendations" element={<AppContent />} />
                    <Route path="/messages" element={<AppContent />} />
                    <Route path="/alerts" element={<AppContent />} />
                    <Route path="/notifications" element={<AppContent />} />
                    <Route path="/interviews" element={<AppContent />} />
                    <Route path="/change-password" element={<AppContent />} />
                    <Route path="/2fa-setup" element={<AppContent />} />
                    <Route path="/employer-apps" element={<AppContent />} />
                    <Route path="/forgot-password" element={<ForgotPasswordWrapper />} />
                    <Route path="/reset-password" element={<ResetPasswordWrapper />} />
                    <Route path="/auth-success" element={<AuthSuccess />} />
                </Routes>
            </BrowserRouter>
        </LanguageProvider>
    );
}

export default App;