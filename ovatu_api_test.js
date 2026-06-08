const BASE_URL = 'https://api.ovatu.com/v2';
const API_TOKEN = 'YOUR_API_TOKEN'; // Replace with actual token

async function getRecentAppointments() {
    // Ovatu API documentation suggests filtering by date.
    // For polling, we use 'created_at' or 'updated_at' filters.
    // Example: last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Most REST APIs use query parameters for filtering
    const url = `${BASE_URL}/appointments?updated_at_since=${encodeURIComponent(since)}`;
    
    console.log(`Fetching appointments updated since: ${since}`);
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching appointments:', error.message);
        return null;
    }
}

// Polling simulation
async function run() {
    const appointments = await getRecentAppointments();
    if (appointments) {
        console.log(`Found ${appointments.data ? appointments.data.length : 0} appointments.`);
        // Process appointments here
        // If used for Zapier, this would be where we trigger the webhook.
    }
}

run();
