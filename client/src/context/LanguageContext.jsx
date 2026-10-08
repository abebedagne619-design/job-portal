import React, { createContext, useState, useContext } from 'react';

const LanguageContext = createContext();

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState('en');
    
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
            minSalary: 'Min Salary',
            maxSalary: 'Max Salary',
            forgotPassword: 'Forgot Password?',
            resetPassword: 'Reset Password',
            sendResetLink: 'Send Reset Link',
            backToLogin: 'Back to Login'
        },
        am: {
            welcome: 'እንኳን ደህና መጣህ',
            jobs: 'ስራዎች',
            apply: 'አመልክት',
            search: 'ፈልግ',
            login: 'ግባ',
            register: 'ተመዝገብ',
            logout: 'ውጣ',
            admin: 'አድሚን',
            analytics: 'ትንተና',
            savedJobs: 'የተቀመጡ',
            aiRecommendations: 'የ AI ምክሮች',
            messages: 'መልዕክቶች',
            changePassword: 'የይለፍ ቃል ቀይር',
            findJob: 'የህልምህን ስራ ዛሬ አግኝ!',
            latestJobs: 'አዳዲስ ስራዎች',
            noJobs: 'ምንም ስራዎች አልተገኙም',
            loading: 'ስራዎችን በማውጣት ላይ...',
            jobTitle: 'የስራ መጠሪያ',
            company: 'ኩባንያ',
            location: 'ቦታ',
            salary: 'ደመወዝ',
            type: 'አይነት',
            fullTime: 'ሙሉ ጊዜ',
            partTime: 'ትርፍ ጊዜ',
            remote: 'ርቆ',
            contract: 'ውል',
            advancedSearch: 'የላቀ ፍለጋ',
            hideAdvanced: 'የላቀ ፍለጋ ደብቅ',
            filter: 'አጣራ',
            reset: 'አጥፋ',
            minSalary: 'ዝቅተኛ ደመወዝ',
            maxSalary: 'ከፍተኛ ደመወዝ',
            forgotPassword: 'የይለፍ ቃል ረሳሁ?',
            resetPassword: 'የይለፍ ቃል ዳግም አስጀምር',
            sendResetLink: 'አገናኝ ላክ',
            backToLogin: 'ወደ መግቢያ ተመለስ'
        }
    };
    
    return (
        <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>
            {children}
        </LanguageContext.Provider>
    );
};