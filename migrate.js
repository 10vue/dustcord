require('dotenv').config();
const fs = require('fs');
const { Client } = require('pg');

// Load connection string from environment variables
const connectionString = process.env.DATABASE_URL;

// Create a new client instance
const client = new Client({
    connectionString,
    ssl: {
        rejectUnauthorized: false // Allow self-signed certificates (for local development)
    }
});

// Function to convert milliseconds to seconds
const convertToSeconds = (milliseconds) => {
    return Math.floor(milliseconds / 1000);
};

async function migrateData() {
    try {
        await client.connect();

        // Migrate balances.json
        const balancesData = JSON.parse(fs.readFileSync('data/balances.json'));
        console.log('Balances Data:', balancesData); // Log balances data

        // Insert balances
        for (const userId in balancesData) {
            const balance = balancesData[userId]; // Get balance for the userId
            await client.query(
                'INSERT INTO balances (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance',
                [userId, balance]
            );
        }

        // Migrate dailyCooldowns.json
        const cooldownsData = JSON.parse(fs.readFileSync('data/dailyCooldowns.json'));
        console.log('Cooldowns Data:', cooldownsData); // Log cooldowns data

        // Iterate over cooldownsData object
        for (const userId in cooldownsData) {
            const cooldownTimestamp = cooldownsData[userId]; // Get cooldown timestamp for userId
            const cooldown = convertToSeconds(cooldownTimestamp); // Convert milliseconds to seconds
            
            // Insert or update cooldowns in the database
            await client.query(
                'INSERT INTO daily_cooldowns (user_id, cooldown) VALUES ($1, to_timestamp($2)) ON CONFLICT (user_id) DO UPDATE SET cooldown = EXCLUDED.cooldown',
                [userId, cooldown]
            );
        }

        // Add similar sections for lastCrimeTimes.json, lastSlutTimes.json, and lastRobTimes.json
        // Example for lastCrimeTimes.json:
        const lastCrimeTimesData = JSON.parse(fs.readFileSync('data/lastCrimeTimes.json'));
        console.log('Last Crime Times Data:', lastCrimeTimesData); // Log last crime times data

        for (const userId in lastCrimeTimesData) {
            const lastCrimeTimeTimestamp = lastCrimeTimesData[userId];
            const lastCrimeTime = convertToSeconds(lastCrimeTimeTimestamp); // Convert to seconds
            
            await client.query(
                'INSERT INTO last_crime_times (user_id, last_crime_time) VALUES ($1, to_timestamp($2)) ON CONFLICT (user_id) DO UPDATE SET last_crime_time = EXCLUDED.last_crime_time',
                [userId, lastCrimeTime]
            );
        }

        // Similarly handle lastSlutTimes.json and lastRobTimes.json
        // For example for lastSlutTimes.json:
        const lastSlutTimesData = JSON.parse(fs.readFileSync('data/lastSlutTimes.json'));
        console.log('Last Slut Times Data:', lastSlutTimesData); // Log last slut times data

        for (const userId in lastSlutTimesData) {
            const lastSlutTimeTimestamp = lastSlutTimesData[userId];
            const lastSlutTime = convertToSeconds(lastSlutTimeTimestamp); // Convert to seconds
            
            await client.query(
                'INSERT INTO last_slut_times (user_id, last_slut_time) VALUES ($1, to_timestamp($2)) ON CONFLICT (user_id) DO UPDATE SET last_slut_time = EXCLUDED.last_slut_time',
                [userId, lastSlutTime]
            );
        }

        // For lastRobTimes.json:
        const lastRobTimesData = JSON.parse(fs.readFileSync('data/lastRobTimes.json'));
        console.log('Last Rob Times Data:', lastRobTimesData); // Log last rob times data

        for (const userId in lastRobTimesData) {
            const lastRobTimeTimestamp = lastRobTimesData[userId];
            const lastRobTime = convertToSeconds(lastRobTimeTimestamp); // Convert to seconds
            
            await client.query(
                'INSERT INTO last_rob_times (user_id, last_rob_time) VALUES ($1, to_timestamp($2)) ON CONFLICT (user_id) DO UPDATE SET last_rob_time = EXCLUDED.last_rob_time',
                [userId, lastRobTime]
            );
        }

        console.log('Data migration completed successfully!');

    } catch (error) {
        console.error('Error migrating data:', error);
    } finally {
        await client.end();
    }
}

// Call the migrateData function to start the migration
migrateData();
