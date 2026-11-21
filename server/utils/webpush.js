const webpush = require('web-push');
require('dotenv').config();

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

let configured = false;

if (publicKey && privateKey) {

    try {

        webpush.setVapidDetails(
            process.env.VAPID_SUBJECT ||
            'mailto:abebedagne619@gmail.com',

            publicKey,
            privateKey
        );

        configured = true;

        console.log('✅ Web Push configured successfully');

    } catch (error) {

        console.error(
            '❌ Web Push configuration error:',
            error.message
        );
    }

} else {

    console.warn(
        '⚠️ VAPID keys are missing. Browser push is disabled.'
    );
}

// Send browser push notification

async function sendNotification(subscription, payload) {

    if (!configured) {

        throw new Error(
            'Web Push is not configured. Check VAPID keys.'
        );
    }

    return webpush.sendNotification(
        subscription,
        JSON.stringify(payload)
    );
}

// Check Web Push configuration

function isWebPushConfigured() {

    return configured;
}

module.exports = {
    sendNotification,
    isWebPushConfigured
};