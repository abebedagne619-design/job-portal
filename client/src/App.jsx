import React, { useState, useEffect } from 'react';
import {
    BrowserRouter,
    Routes,
    Route,
    useNavigate,
    useLocation
} from 'react-router-dom';

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

import JobAlerts from './components/JobAlerts';
import Notifications from './components/Notifications';
import Interviews from './components/Interviews';
import ScheduleInterview from './components/ScheduleInterview';
import ChangePassword from './components/ChangePassword';
import TwoFactorSetup from './components/TwoFactorSetup';
import GoogleLogin from './components/GoogleLogin';
import EmployerApplications from './components/EmployerApplications';

import './App.css';


// ==========================================
// API URL
// ==========================================

import { API_URL } from './config/api';

// ==========================================
// VAPID KEY CONVERSION FUNCTION
// ==========================================

function urlBase64ToUint8Array(base64String) {
    if (!base64String) {
        throw new Error('VAPID public key is missing.');
    }

    const padding = '='.repeat(
        (4 - base64String.length % 4) % 4
    );

    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);

    return Uint8Array.from(
        [...rawData].map(char => char.charCodeAt(0))
    );
}

// ==========================================
// RESET PASSWORD WRAPPER
// ==========================================

function ResetPasswordWrapper() {
    const navigate = useNavigate();

    return (
        <ResetPassword
            onComplete={() => navigate('/login')}
        />
    );
}

// ==========================================
// FORGOT PASSWORD WRAPPER
// ==========================================

function ForgotPasswordWrapper() {
    const navigate = useNavigate();

    return (
        <ForgotPassword
            onBack={() => navigate('/login')}
        />
    );
}

// ==========================================
// MAIN APP CONTENT
// ==========================================

function AppContent() {

    const { t, setLanguage, language } = useLanguage();

    const navigate = useNavigate();
    const location = useLocation();

    // ==========================================
    // STATES
    // ==========================================

    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);

    const [search, setSearch] = useState('');

    const [selectedJob, setSelectedJob] = useState(null);
    const [showApplyForm, setShowApplyForm] = useState(false);

    const [user, setUser] = useState(null);

    const [currentPage, setCurrentPage] = useState('jobs');

    const [selectedApplicant, setSelectedApplicant] = useState(null);
    const [employerApplications, setEmployerApplications] = useState([]);

    // Session verification state
    const [sessionChecked, setSessionChecked] = useState(false);

    // Push notification states
    const [pushStatus, setPushStatus] = useState('disabled');
    const [pushLoading, setPushLoading] = useState(false);

    // Advanced Search Filters
    const [titleFilter, setTitleFilter] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    const [minSalary, setMinSalary] = useState('');
    const [maxSalary, setMaxSalary] = useState('');

    const [showAdvanced, setShowAdvanced] = useState(false);

    // ==========================================
    // NOTIFICATION UPDATE EVENT
    // ==========================================

    const handleNotificationsUpdated = () => {

        window.dispatchEvent(
            new Event('notifications-updated')
        );

    };

    // ==========================================
    // PRIVATE PAGES
    // ==========================================

    const protectedPages = [
        'recommendations',
        'saved',
        'admin',
        'analytics',
        'messages',
        'alerts',
        'notifications',
        'interviews',
        'change-password',
        '2fa-setup',
        'employer-apps'
    ];

    // ==========================================
    // URL SYNC EFFECT
    // ==========================================

    useEffect(() => {

        const pageMap = {
            '/': 'jobs',
            '/login': 'login',
            '/register': 'register',
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

        const page = pageMap[location.pathname];

        if (page) {
            setCurrentPage(page);
        }

    }, [location.pathname]);

    // ==========================================
    // CHECK EXISTING USER SESSION
    // ==========================================

    useEffect(() => {

        let active = true;

        const checkSession = async () => {

            const savedUser = sessionStorage.getItem('user');
            const token = sessionStorage.getItem('token');

            if (!savedUser || !token) {

                if (savedUser || token) {
                    sessionStorage.removeItem('user');
                    sessionStorage.removeItem('token');
                }

                if (active) {
                    setUser(null);
                    setSessionChecked(true);
                }

                return;
            }

            let parsedUser;

            try {

                parsedUser = JSON.parse(savedUser);

            } catch (error) {

                console.error(
                    'Invalid saved user data:',
                    error
                );

                sessionStorage.removeItem('user');
                sessionStorage.removeItem('token');

                if (active) {
                    setUser(null);
                    setSessionChecked(true);
                }

                return;
            }

            try {

                const res = await fetch(`${API_URL}/api/auth/me`, {
                    method: 'GET',
                    cache: 'no-store',
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                if (!active) return;

                if (res.ok) {

                    const data = await res.json();

                    const verifiedUser =
                        data?.data ||
                        data?.user ||
                        parsedUser;

                    setUser(verifiedUser);

                    sessionStorage.setItem(
                        'user',
                        JSON.stringify(verifiedUser)
                    );

                } else {

                    // Invalid token: clear session.
                    // Do not force the visitor to Login.
                    sessionStorage.removeItem('user');
                    sessionStorage.removeItem('token');

                    setUser(null);

                }

            } catch (error) {

                // Network error:
                // Preserve the saved session information.
                // Do not delete the token because the server
                // may temporarily be unavailable.

                console.error(
                    'Session verification error:',
                    error
                );

                if (active) {
                    setUser(parsedUser);
                }

            } finally {

                if (active) {
                    setSessionChecked(true);
                }

            }

        };

        checkSession();

        return () => {
            active = false;
        };

    }, []);

    // ==========================================
    // REGISTER SERVICE WORKER
    // ==========================================

    useEffect(() => {

        if (!user) {
            setPushStatus('disabled');
            return;
        }

        const registerServiceWorker = async () => {

            if (!('serviceWorker' in navigator)) {

                console.warn(
                    'Service Worker is not supported.'
                );

                setPushStatus('unsupported');

                return;
            }

            if (
                !('PushManager' in window) ||
                !('Notification' in window)
            ) {

                console.warn(
                    'Push notifications are not supported.'
                );

                setPushStatus('unsupported');

                return;
            }

            try {

                const registration =
                    await navigator.serviceWorker.register(
                        '/service-worker.js'
                    );

                console.log(
                    'Service Worker registered:',
                    registration.scope
                );

                await navigator.serviceWorker.ready;

                const existingSubscription =
                    await registration.pushManager.getSubscription();

                if (
                    Notification.permission === 'granted' &&
                    existingSubscription
                ) {
                    setPushStatus('enabled');

                } else if (
                    Notification.permission === 'denied'
                ) {
                    setPushStatus('denied');

                } else {
                    setPushStatus('disabled');
                }

            } catch (error) {

                console.error(
                    'Service Worker Registration Error:',
                    error
                );

                setPushStatus('error');

            }

        };

        registerServiceWorker();

    }, [user]);

    // ==========================================
    // ENABLE BROWSER PUSH NOTIFICATIONS
    // ==========================================

    const handleEnablePush = async () => {

        if (!user) {

            alert('Please login first.');

            navigate('/login');

            return;
        }

        if (
            !('serviceWorker' in navigator) ||
            !('PushManager' in window) ||
            !('Notification' in window)
        ) {

            alert(
                'Your browser does not support Push Notifications.'
            );

            return;
        }

        const vapidKey =
            import.meta.env.VITE_VAPID_PUBLIC_KEY;

        if (!vapidKey) {

            alert(
                'VAPID public key is missing. Check client/.env'
            );

            return;
        }

        setPushLoading(true);

        try {

            // 1. Request browser notification permission.

            let permission = Notification.permission;

            if (permission !== 'granted') {

                permission =
                    await Notification.requestPermission();

            }

            if (permission !== 'granted') {

                setPushStatus(
                    permission === 'denied'
                        ? 'denied'
                        : 'disabled'
                );

                alert(
                    'Notification permission was not granted.'
                );

                return;
            }

            // 2. Register Service Worker.

            const registration =
                await navigator.serviceWorker.register(
                    '/service-worker.js'
                );

            await navigator.serviceWorker.ready;

            // 3. Get existing Push Subscription.

            let subscription =
                await registration.pushManager.getSubscription();

            // 4. Create subscription if it does not exist.

            if (!subscription) {

                subscription =
                    await registration.pushManager.subscribe({

                        userVisibleOnly: true,

                        applicationServerKey:
                            urlBase64ToUint8Array(vapidKey)

                    });

            }

            // 5. Send subscription to backend.

            const token = sessionStorage.getItem('token');

            if (!token) {

                throw new Error(
                    'Authentication token is missing.'
                );

            }

            const response = await fetch(
                `${API_URL}/api/notifications/subscribe`,
                {

                    method: 'POST',

                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },

                    body: JSON.stringify({
                        subscription
                    })

                }
            );

            const data = await response.json();

            if (!response.ok) {

                throw new Error(
                    data.message ||
                    'Failed to save push subscription.'
                );

            }

            console.log(
                'Push subscription saved:',
                data
            );

            setPushStatus('enabled');

            alert(
                'Browser notifications enabled successfully!'
            );

        } catch (error) {

            console.error(
                'Enable Push Notification Error:',
                error
            );

            alert(
                error.message ||
                'Failed to enable notifications.'
            );

            setPushStatus('error');

        } finally {

            setPushLoading(false);

        }

    };

    // ==========================================
    // FETCH JOBS
    // PUBLIC: LOGIN IS NOT REQUIRED
    // ==========================================

    const fetchJobs = async () => {

        setLoading(true);

        try {

            const token = sessionStorage.getItem('token');

            const url = search
                ? `${API_URL}/api/jobs?search=${encodeURIComponent(search)}`
                : `${API_URL}/api/jobs`;

            const headers = {};

            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }

            const res = await fetch(url, {

                method: 'GET',

                headers

            });

            const data = await res.json();

            if (!res.ok) {

                throw new Error(
                    data.message || 'Failed to fetch jobs'
                );

            }

            const jobsData = Array.isArray(data)
                ? data
                : Array.isArray(data.data)
                    ? data.data
                    : [];

            setJobs(jobsData);

        } catch (error) {

            console.error(
                'Error fetching jobs:',
                error
            );

            setJobs([]);

        } finally {

            setLoading(false);

        }

    };

    // ==========================================
    // FETCH EMPLOYER APPLICATIONS
    // ==========================================

    const fetchEmployerApplications = async () => {

        if (!user || user.role !== 'employer') return;

        try {

            const token = sessionStorage.getItem('token');

            const res = await fetch(
                `${API_URL}/api/applications/employer/${user.id}`,
                {
                    method: 'GET',

                    headers: {
                        Authorization: token
                            ? `Bearer ${token}`
                            : ''
                    }
                }
            );

            const data = await res.json();

            if (!res.ok) {

                throw new Error(
                    data.message ||
                    'Failed to fetch employer applications'
                );

            }

            const applicationsData = Array.isArray(data)
                ? data
                : Array.isArray(data.data)
                    ? data.data
                    : [];

            setEmployerApplications(applicationsData);

        } catch (error) {

            console.error(
                'Error fetching employer applications:',
                error
            );

            setEmployerApplications([]);

        }

    };

    // ==========================================
    // EMPLOYER APPLICATIONS EFFECT
    // ==========================================

    useEffect(() => {

        if (
            currentPage === 'employer-apps' &&
            user?.role === 'employer'
        ) {

            fetchEmployerApplications();

        }

    }, [currentPage, user]);

    // ==========================================
    // ADVANCED SEARCH
    // PUBLIC: LOGIN IS NOT REQUIRED
    // ==========================================

    const runAdvancedSearch = async () => {

        setLoading(true);

        try {

            const token = sessionStorage.getItem('token');

            const params = new URLSearchParams();

            if (titleFilter.trim()) {
                params.append(
                    'title',
                    titleFilter.trim()
                );
            }

            if (locationFilter.trim()) {
                params.append(
                    'location',
                    locationFilter.trim()
                );
            }

            if (typeFilter) {
                params.append('type', typeFilter);
            }

            if (minSalary) {
                params.append('minSalary', minSalary);
            }

            if (maxSalary) {
                params.append('maxSalary', maxSalary);
            }

            const headers = {};

            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }

            const res = await fetch(
                `${API_URL}/api/jobs/search?${params.toString()}`,
                {

                    method: 'GET',

                    headers

                }
            );

            const data = await res.json();

            if (!res.ok) {

                throw new Error(
                    data.message || 'Search failed'
                );

            }

            const jobsData = Array.isArray(data)
                ? data
                : Array.isArray(data.data)
                    ? data.data
                    : [];

            setJobs(jobsData);

        } catch (error) {

            console.error(
                'Advanced Search Error:',
                error
            );

            setJobs([]);

        } finally {

            setLoading(false);

        }

    };

    // ==========================================
    // RESET FILTERS
    // ==========================================

    const resetFilters = () => {

        setTitleFilter('');
        setLocationFilter('');
        setTypeFilter('');
        setMinSalary('');
        setMaxSalary('');

        fetchJobs();

    };

    // ==========================================
    // AUTOMATIC JOB FETCH
    // RUNS FOR GUEST AND LOGGED-IN USERS
    // ==========================================

    useEffect(() => {

        fetchJobs();

    }, [search]);

    // ==========================================
    // SUBMIT JOB APPLICATION
    // ==========================================

    const handleSubmitApplication = async (
        jobId,
        formData
    ) => {

        // A visitor must login before applying.

        if (!user) {

            setShowApplyForm(false);
            setSelectedJob(null);

            alert('Please login before applying for a job.');

            navigate('/login');

            return false;

        }

        try {

            const token = sessionStorage.getItem('token');

            // Include jobId if the form has not already added it.

            if (
                formData instanceof FormData &&
                jobId &&
                !formData.has('jobId')
            ) {

                formData.append('jobId', jobId);

            }

            const res = await fetch(
                `${API_URL}/api/applications`,
                {

                    method: 'POST',

                    headers: {
                        Authorization: token
                            ? `Bearer ${token}`
                            : ''
                    },

                    body: formData

                }
            );

            const data = await res.json();

            if (res.ok) {

                console.log(
                    'Application submitted successfully!'
                );

                setShowApplyForm(false);
                setSelectedJob(null);

                return true;

            } else {

                console.error(
                    'Application submission failed:',
                    data.message
                );

                alert(
                    data.message ||
                    'Application submission failed.'
                );

                return false;

            }

        } catch (error) {

            console.error(
                'Application submission error:',
                error
            );

            return false;

        }

    };

    // ==========================================
    // REGISTER FUNCTION
    // ==========================================

    const handleRegister = async (userData) => {

        try {

            const res = await fetch(
                `${API_URL}/api/auth/register`,
                {

                    method: 'POST',

                    headers: {
                        'Content-Type': 'application/json'
                    },

                    body: JSON.stringify(userData)

                }
            );

            const data = await res.json();

            if (!res.ok || !data.success) {

                console.error(
                    'Registration failed:',
                    data.message
                );

                return false;

            }

            const userInfo =
                data?.data?.user ||
                data?.user;

            const token =
                data?.data?.token ||
                data?.token;

            if (!userInfo || !token) {

                console.error(
                    'Registration response is missing user or token.'
                );

                return false;

            }

            setUser(userInfo);

            sessionStorage.setItem(
                'user',
                JSON.stringify(userInfo)
            );

            sessionStorage.setItem(
                'token',
                token
            );

            setCurrentPage('jobs');

            navigate('/');

            return true;

        } catch (error) {

            console.error(
                'Registration Error:',
                error
            );

            return false;

        }

    };

    // ==========================================
    // LOGIN FUNCTION
    // ==========================================

    const handleLogin = async (credentials) => {

        try {

            const res = await fetch(
                `${API_URL}/api/auth/login`,
                {

                    method: 'POST',

                    headers: {
                        'Content-Type': 'application/json'
                    },

                    body: JSON.stringify(credentials)

                }
            );

            const data = await res.json();

            if (!res.ok) {

                console.error(
                    'Login failed:',
                    data.message
                );

                return false;

            }

            const userInfo =
                data?.data?.user ||
                data?.user;

            const token =
                data?.data?.token ||
                data?.token;

            if (!userInfo || !token) {

                console.error(
                    'Login response is missing user or token.'
                );

                return false;

            }

            setUser(userInfo);

            sessionStorage.setItem(
                'user',
                JSON.stringify(userInfo)
            );

            sessionStorage.setItem(
                'token',
                token
            );

            setCurrentPage('jobs');

            navigate('/');

            return true;

        } catch (error) {

            console.error(
                'Login Error:',
                error
            );

            return false;

        }

    };

    // ==========================================
    // LOGOUT FUNCTION
    // ==========================================

    const handleLogout = () => {

        setUser(null);

        sessionStorage.removeItem('user');
        sessionStorage.removeItem('token');

        setCurrentPage('login');

        setJobs([]);

        setSelectedJob(null);
        setShowApplyForm(false);

        setEmployerApplications([]);

        setPushStatus('disabled');

        navigate('/login');

    };

    // ==========================================
    // MAIN STYLES
    // ==========================================

    const styles = {

        container: {
            minHeight: '100vh',
            background: '#0a3d0a'
        },

        hero: {
            textAlign: 'center',
            padding: '4rem 2rem',
            background: 'linear-gradient(135deg, #0a3d0a, #1a6d1a)'
        },

        title: {
            fontSize: '3rem',
            marginBottom: '1rem',
            color: '#fff'
        },

        subtitle: {
            fontSize: '1.2rem',
            marginBottom: '2rem',
            color: '#ccc'
        },

        searchBox: {
            padding: '0.8rem',
            width: '300px',
            borderRadius: '50px',
            border: 'none',
            marginRight: '0.5rem'
        },

        searchBtn: {
            padding: '0.8rem 1.5rem',
            background: '#2ecc71',
            border: 'none',
            borderRadius: '50px',
            color: '#fff',
            cursor: 'pointer'
        },

        jobsSection: {
            padding: '2rem 5%'
        },

        sectionTitle: {
            fontSize: '2rem',
            marginBottom: '2rem',
            textAlign: 'center',
            color: '#fff'
        },

        jobsGrid: {
            display: 'grid',
            gridTemplateColumns:
                'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '2rem'
        },

        loading: {
            textAlign: 'center',
            padding: '2rem',
            color: '#fff'
        },

        filterBox: {
            background: 'rgba(30,60,30,0.8)',
            padding: '1rem',
            borderRadius: '15px',
            marginBottom: '1rem',
            display: 'grid',
            gridTemplateColumns:
                'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '0.8rem'
        },

        filterInput: {
            padding: '0.5rem',
            borderRadius: '8px',
            border: 'none',
            background: '#0a2a0a',
            color: '#fff'
        },

        filterSelect: {
            padding: '0.5rem',
            borderRadius: '8px',
            border: 'none',
            background: '#0a2a0a',
            color: '#fff'
        },

        toggleBtn: {
            background: 'transparent',
            border: '1px solid #2ecc71',
            color: '#2ecc71',
            padding: '0.5rem 1rem',
            borderRadius: '50px',
            cursor: 'pointer',
            marginBottom: '1rem'
        },

        languageBtn: {
            background: '#2ecc71',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            padding: '0.3rem 0.8rem',
            cursor: 'pointer',
            marginLeft: '0.5rem'
        }

    };

    // ==========================================
    // PAGE DETECTION
    // ==========================================

    const isRegisterPage =
        location.pathname === '/register' ||
        currentPage === 'register';

    const isLoginPage =
        location.pathname === '/login' ||
        currentPage === 'login';

    // ==========================================
    // LANGUAGE BUTTON
    // ==========================================

    const LanguageButton = () => (

        <div
            style={{
                display: 'flex',
                justifyContent: 'flex-end',
                padding: '1rem'
            }}
        >

            <button
                style={styles.languageBtn}
                onClick={() =>
                    setLanguage(
                        language === 'en' ? 'am' : 'en'
                    )
                }
            >

                {language === 'en'
                    ? 'አማርኛ'
                    : 'English'}

            </button>

        </div>

    );

    // ==========================================
    // REGISTER PAGE
    // ==========================================

    if (!user && isRegisterPage) {

        return (

            <div style={styles.container}>

                <LanguageButton />

                <Register

                    onRegister={handleRegister}

                    onSwitch={() => {

                        setCurrentPage('login');

                        navigate('/login');

                    }}

                />

            </div>

        );

    }

    // ==========================================
    // LOGIN PAGE
    // ==========================================

    if (!user && isLoginPage) {

        return (

            <div style={styles.container}>

                <LanguageButton />

                <Login

                    onLogin={handleLogin}

                    onForgotPassword={() =>
                        navigate('/forgot-password')
                    }

                    onSwitch={() => {

                        setCurrentPage('register');

                        navigate('/register');

                    }}

                />

            </div>

        );

    }

    if (
        !sessionChecked &&
        protectedPages.includes(currentPage)
    ) {
        return (
            <div style={{
                minHeight: '100vh',
                background: '#0a3d0a',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                color: '#fff',
                fontSize: '20px'
            }}>
                Checking your session...
            </div>
        );
    }

    // ==========================================
    // PROTECTED PAGE ACCESS CONTROL
    // ==========================================

    if (
        sessionChecked &&
        !user &&
        protectedPages.includes(currentPage)
    ) {

        return (

            <div
                style={{
                    minHeight: '100vh',
                    background: '#0a3d0a',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    flexDirection: 'column',
                    padding: '2rem',
                    color: '#fff',
                    textAlign: 'center'
                }}
            >

                <h1>
                    🔒 Login Required
                </h1>

                <p>
                    Please login to access this page.
                </p>

                <button
                    onClick={() => {
                        setCurrentPage('login');
                        navigate('/login');
                    }}
                    style={{
                        background: '#2ecc71',
                        color: '#fff',
                        border: 'none',
                        padding: '12px 25px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        marginTop: '15px'
                    }}
                >
                    Go to Login
                </button>

                <button
                    onClick={() => {
                        setCurrentPage('jobs');
                        navigate('/');
                    }}
                    style={{
                        background: 'transparent',
                        color: '#2ecc71',
                        border: '1px solid #2ecc71',
                        padding: '12px 25px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        marginTop: '10px'
                    }}
                >
                    Back to Homepage
                </button>

            </div>

        );

    }

    // ==========================================
    // RENDER PAGE CONTENT
    // ==========================================

    const renderContent = () => {

        switch (currentPage) {

            // ======================================
            // SAVED JOBS
            // ======================================

            case 'saved':

                return (
                    <SavedJobs user={user} />
                );

            // ======================================
            // RECOMMENDATIONS
            // ======================================

            case 'recommendations':

                return (
                    <Recommendations user={user} />
                );

            // ======================================
            // MESSAGES
            // ======================================

            case 'messages':

                return (
                    <Messages
                        user={user}
                        setCurrentPage={setCurrentPage}
                    />
                );

            // ======================================
            // JOB ALERTS
            // ======================================

            case 'alerts':

                return (
                    <JobAlerts user={user} />
                );

            // ======================================
            // NOTIFICATIONS
            // ======================================

            case 'notifications':

                return (
                    <Notifications
                        user={user}
                        onNotificationsUpdated={handleNotificationsUpdated}
                    />
                );

            // ======================================
            // INTERVIEWS
            // ======================================

            case 'interviews':

                return (
                    <Interviews user={user} />
                );

            // ======================================
            // CHANGE PASSWORD
            // ======================================

            case 'change-password':

                return user ? (
                    <ChangePassword user={user} />
                ) : null;

            // ======================================
            // TWO FACTOR AUTHENTICATION
            // ======================================

            case '2fa-setup':

                return (
                    <TwoFactorSetup user={user} />
                );

            // ======================================
            // EMPLOYER APPLICATIONS
            // ======================================

            case 'employer-apps':

                return user?.role === 'employer' ||
                    user?.role === 'admin'
                    ? (
                        <EmployerApplications
                            user={user}
                        />
                    )
                    : (
                        <div
                            style={{
                                color: 'white',
                                textAlign: 'center',
                                padding: '2rem'
                            }}
                        >
                            Access Denied
                        </div>
                    );

            // ======================================
            // ADMIN DASHBOARD
            // ======================================

            case 'admin':

                return user?.role === 'admin'
                    ? <AdminDashboard user={user} />
                    : (
                        <div
                            style={{
                                color: 'white',
                                textAlign: 'center',
                                padding: '2rem'
                            }}
                        >
                            Access Denied
                        </div>
                    );

            // ======================================
            // ANALYTICS DASHBOARD
            // ======================================

            case 'analytics':

                return user?.role === 'admin'
                    ? <AnalyticsDashboard />
                    : (
                        <div
                            style={{
                                color: 'white',
                                textAlign: 'center',
                                padding: '2rem'
                            }}
                        >
                            Access Denied
                        </div>
                    );

            // ======================================
            // DEFAULT JOBS PAGE
            // PUBLIC HOMEPAGE
            // ======================================

            default:

                return (

                    <>

                        {/* HERO SECTION */}

                        <div style={styles.hero}>

                            <h1 style={styles.title}>
                                የስራ መድረክ (Job Portal)
                            </h1>

                            <p style={styles.subtitle}>
                                {t.findJob ||
                                    'Find your dream job today!'}
                            </p>

                            {/* JOB SEARCH */}

                            <div>

                                <input

                                    style={styles.searchBox}

                                    type="text"

                                    placeholder={
                                        t.search || 'Search jobs...'
                                    }

                                    value={search}

                                    onChange={(e) =>
                                        setSearch(e.target.value)
                                    }

                                    onKeyDown={(e) => {

                                        if (e.key === 'Enter') {
                                            fetchJobs();
                                        }

                                    }}

                                />

                                <button

                                    style={styles.searchBtn}

                                    onClick={fetchJobs}

                                >

                                    {t.search || 'Search'}

                                </button>

                            </div>

                        </div>

                        {/* ADVANCED SEARCH BUTTON */}

                        <div
                            style={{
                                textAlign: 'center',
                                padding: '0 5%'
                            }}
                        >

                            <button

                                style={styles.toggleBtn}

                                onClick={() =>
                                    setShowAdvanced(!showAdvanced)
                                }

                            >

                                {showAdvanced
                                    ? (t.hideAdvanced || 'Hide Advanced')
                                    : (t.advancedSearch || 'Advanced Search')}

                            </button>

                        </div>

                        {/* ADVANCED SEARCH FORM */}

                        {showAdvanced && (

                            <div style={{ padding: '0 5%' }}>

                                <div style={styles.filterBox}>

                                    {/* JOB TITLE */}

                                    <input

                                        style={styles.filterInput}

                                        type="text"

                                        placeholder={
                                            t.jobTitle || 'Job Title'
                                        }

                                        value={titleFilter}

                                        onChange={(e) =>
                                            setTitleFilter(e.target.value)
                                        }

                                    />

                                    {/* LOCATION */}

                                    <input

                                        style={styles.filterInput}

                                        type="text"

                                        placeholder={
                                            t.location || 'Location'
                                        }

                                        value={locationFilter}

                                        onChange={(e) =>
                                            setLocationFilter(e.target.value)
                                        }

                                    />

                                    {/* JOB TYPE */}

                                    <select

                                        style={styles.filterSelect}

                                        value={typeFilter}

                                        onChange={(e) =>
                                            setTypeFilter(e.target.value)
                                        }

                                    >

                                        <option value="">
                                            {t.type || 'Job Type'}
                                        </option>

                                        <option value="full-time">
                                            Full Time
                                        </option>

                                        <option value="part-time">
                                            Part Time
                                        </option>

                                        <option value="remote">
                                            Remote
                                        </option>

                                        <option value="contract">
                                            Contract
                                        </option>

                                    </select>

                                    {/* MINIMUM SALARY */}

                                    <input

                                        style={styles.filterInput}

                                        type="number"

                                        min="0"

                                        placeholder={
                                            t.minSalary || 'Min Salary'
                                        }

                                        value={minSalary}

                                        onChange={(e) =>
                                            setMinSalary(e.target.value)
                                        }

                                    />

                                    {/* MAXIMUM SALARY */}

                                    <input

                                        style={styles.filterInput}

                                        type="number"

                                        min="0"

                                        placeholder={
                                            t.maxSalary || 'Max Salary'
                                        }

                                        value={maxSalary}

                                        onChange={(e) =>
                                            setMaxSalary(e.target.value)
                                        }

                                    />

                                    {/* FILTER BUTTON */}

                                    <button

                                        style={styles.searchBtn}

                                        onClick={runAdvancedSearch}

                                    >

                                        {t.filter || 'Filter'}

                                    </button>

                                    {/* RESET BUTTON */}

                                    <button

                                        style={{
                                            ...styles.searchBtn,
                                            background: '#ef4444'
                                        }}

                                        onClick={resetFilters}

                                    >

                                        {t.reset || 'Reset'}

                                    </button>

                                </div>

                            </div>

                        )}

                        {/* JOBS SECTION */}

                        <div style={styles.jobsSection}>

                            <h2 style={styles.sectionTitle}>
                                {t.latestJobs || 'Latest Jobs'}
                            </h2>

                            {/* LOADING */}

                            {loading ? (

                                <div style={styles.loading}>
                                    Loading...
                                </div>

                            ) : jobs.length === 0 ? (

                                /* NO JOBS FOUND */

                                <div style={styles.loading}>
                                    No jobs found
                                </div>

                            ) : (

                                /* JOB CARDS */

                                <div style={styles.jobsGrid}>

                                    {jobs.map(job => (

                                        <JobCard

                                            key={job.id}

                                            job={job}

                                            user={user}

                                            onApply={(selectedJobData) => {

                                                if (!user) {

                                                    alert(
                                                        'Please login before applying for a job.'
                                                    );

                                                    navigate('/login');

                                                    return;

                                                }

                                                setSelectedJob(
                                                    selectedJobData
                                                );

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

    // ==========================================
    // MAIN RETURN
    // ==========================================

    return (

        <div style={styles.container}>

            {/* NAVBAR */}

            <Navbar

                user={user}

                setUser={setUser}

                setCurrentPage={setCurrentPage}

                onLogout={handleLogout}

                currentPage={currentPage}

            />

            {/* BROWSER PUSH NOTIFICATION BUTTON */}
            {/* ONLY AUTHENTICATED USERS */}

            {user && (

                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        padding: '10px 20px',
                        background: '#0a3d0a'
                    }}
                >

                    {pushStatus === 'enabled' ? (

                        <button
                            disabled
                            style={{
                                background: '#166534',
                                color: '#fff',
                                border: 'none',
                                padding: '10px 18px',
                                borderRadius: '8px',
                                cursor: 'default'
                            }}
                        >
                            ✓ Notifications Enabled
                        </button>

                    ) : (

                        <button

                            onClick={handleEnablePush}

                            disabled={
                                pushLoading ||
                                pushStatus === 'unsupported' ||
                                pushStatus === 'denied'
                            }

                            style={{
                                background: '#2ecc71',
                                color: '#fff',
                                border: 'none',
                                padding: '10px 18px',
                                borderRadius: '8px',
                                cursor: pushLoading ? 'wait' : 'pointer',
                                opacity:
                                    pushLoading ||
                                    pushStatus === 'unsupported' ||
                                    pushStatus === 'denied'
                                        ? 0.6
                                        : 1
                            }}

                        >

                            {pushLoading
                                ? 'Enabling...'
                                : pushStatus === 'denied'
                                    ? 'Notifications Blocked'
                                    : pushStatus === 'unsupported'
                                        ? 'Not Supported'
                                        : '🔔 Enable Notifications'}

                        </button>

                    )}

                </div>

            )}

            {/* PAGE CONTENT */}

            {renderContent()}

            {/* APPLICATION FORM */}

            {showApplyForm && selectedJob && user && (

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

// ==========================================
// MAIN APP COMPONENT WITH ROUTER
// ==========================================

function App() {

    return (

        <LanguageProvider>

            <BrowserRouter>

                <Routes>

                    {/* HOME */}

                    <Route
                        path="/"
                        element={<AppContent />}
                    />

                    {/* LOGIN */}

                    <Route
                        path="/login"
                        element={<AppContent />}
                    />

                    {/* REGISTER */}

                    <Route
                        path="/register"
                        element={<AppContent />}
                    />

                    {/* ADMIN */}

                    <Route
                        path="/admin"
                        element={<AppContent />}
                    />

                    {/* ANALYTICS */}

                    <Route
                        path="/analytics"
                        element={<AppContent />}
                    />

                    {/* SAVED JOBS */}

                    <Route
                        path="/saved"
                        element={<AppContent />}
                    />

                    {/* RECOMMENDATIONS */}

                    <Route
                        path="/recommendations"
                        element={<AppContent />}
                    />

                    {/* MESSAGES */}

                    <Route
                        path="/messages"
                        element={<AppContent />}
                    />

                    {/* ALERTS */}

                    <Route
                        path="/alerts"
                        element={<AppContent />}
                    />

                    {/* NOTIFICATIONS */}

                    <Route
                        path="/notifications"
                        element={<AppContent />}
                    />

                    {/* INTERVIEWS */}

                    <Route
                        path="/interviews"
                        element={<AppContent />}
                    />

                    {/* CHANGE PASSWORD */}

                    <Route
                        path="/change-password"
                        element={<AppContent />}
                    />

                    {/* TWO FACTOR AUTHENTICATION */}

                    <Route
                        path="/2fa-setup"
                        element={<AppContent />}
                    />

                    {/* EMPLOYER APPLICATIONS */}

                    <Route
                        path="/employer-apps"
                        element={<AppContent />}
                    />

                    {/* FORGOT PASSWORD */}

                    <Route
                        path="/forgot-password"
                        element={<ForgotPasswordWrapper />}
                    />

                    {/* RESET PASSWORD */}

                    <Route
                        path="/reset-password"
                        element={<ResetPasswordWrapper />}
                    />

                    {/* GOOGLE AUTH SUCCESS */}

                    <Route
                        path="/auth-success"
                        element={<AuthSuccess />}
                    />

                    {/* UNKNOWN ROUTE */}

                    <Route
                        path="*"
                        element={<AppContent />}
                    />

                </Routes>

            </BrowserRouter>

        </LanguageProvider>

    );

}

export default App;