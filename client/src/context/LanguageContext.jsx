import React, { createContext, useState, useContext, useEffect } from 'react';

const LanguageContext = createContext();

export const useLanguage = () => useContext(LanguageContext);

const translations = {
    en: {
        welcome: 'Welcome',
        jobs: 'Jobs',
        apply: 'Apply Now',
        search: 'Search',
        login: 'Login',
        register: 'Register',
        logout: 'Logout',
        admin: 'Admin',
        analytics: 'Analytics',
        savedJobs: 'Saved Jobs',
        aiRecommendations: 'AI Recommendations',
        messages: 'Messages',
        changePassword: 'Change Password',
        findJob: 'Find your dream job today!',
        latestJobs: 'Latest Jobs',
        noJobs: 'No jobs found.',
        loading: 'Loading jobs...',
        jobTitle: 'Job Title',
        company: 'Company',
        location: 'Location',
        salary: 'Salary',
        type: 'Type',
        fullTime: 'Full-time',
        partTime: 'Part-time',
        remote: 'Remote',
        contract: 'Contract',
        advancedSearch: 'Advanced Search',
        hideAdvanced: 'Hide Advanced Search',
        filter: 'Filter',
        reset: 'Reset',
        minSalary: 'Minimum Salary',
        maxSalary: 'Maximum Salary',
        forgotPassword: 'Forgot Password?',
        resetPassword: 'Reset Password',
        sendResetLink: 'Send Reset Link',
        backToLogin: 'Back to Login',
        applications: 'Applications',
        interviews: 'Interviews',
        jobAlerts: 'Job Alerts',
        notifications: 'Notifications'
    },

    am: {
        welcome: 'እንኳን ደህና መጡ',
        jobs: 'ሥራዎች',
        apply: 'አሁን ያመልክቱ',
        search: 'ፈልግ',
        login: 'ግባ',
        register: 'ተመዝገብ',
        logout: 'ውጣ',
        admin: 'አስተዳዳሪ',
        analytics: 'የመረጃ ትንተና',
        savedJobs: 'የተቀመጡ ሥራዎች',
        aiRecommendations: 'የAI የሥራ ምክረ ሐሳቦች',
        messages: 'መልዕክቶች',
        changePassword: 'የይለፍ ቃል ቀይር',
        findJob: 'የሚፈልጉትን ሥራ ዛሬ ያግኙ!',
        latestJobs: 'የቅርብ ጊዜ ሥራዎች',
        noJobs: 'ምንም ሥራ አልተገኘም።',
        loading: 'ሥራዎች በመጫን ላይ...',
        jobTitle: 'የሥራ መደብ',
        company: 'ድርጅት',
        location: 'አካባቢ',
        salary: 'ደመወዝ',
        type: 'የሥራ ዓይነት',
        fullTime: 'ሙሉ ጊዜ',
        partTime: 'ከፊል ጊዜ',
        remote: 'ከርቀት',
        contract: 'በውል',
        advancedSearch: 'የላቀ ፍለጋ',
        hideAdvanced: 'የላቀ ፍለጋን ደብቅ',
        filter: 'አጣራ',
        reset: 'እንደገና አስጀምር',
        minSalary: 'ዝቅተኛ ደመወዝ',
        maxSalary: 'ከፍተኛ ደመወዝ',
        forgotPassword: 'የይለፍ ቃል ረሱ?',
        resetPassword: 'የይለፍ ቃል መልስ',
        sendResetLink: 'የመመለሻ አገናኝ ላክ',
        backToLogin: 'ወደ መግቢያ ተመለስ',
        applications: 'የሥራ ማመልከቻዎች',
        interviews: 'ቃለ መጠይቆች',
        jobAlerts: 'የሥራ ማሳወቂያዎች',
        notifications: 'ማሳወቂያዎች'
    }
};

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState(() => {
        const savedLanguage = localStorage.getItem('jobportal-language');
        return savedLanguage === 'am' ? 'am' : 'en';
    });

    useEffect(() => {
        localStorage.setItem('jobportal-language', language);
    }, [language]);

    return (
        <LanguageContext.Provider
            value={{
                language,
                setLanguage,
                t: translations[language]
            }}
        >
            {children}
        </LanguageContext.Provider>
    );
};
