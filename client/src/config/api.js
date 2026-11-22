const configuredUrl =
    import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const API_URL = configuredUrl.replace(/\/+$/, '');