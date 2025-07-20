// PickMyBite Backend - Places API v3 with Nearby Search + Neon PostgreSQL Caching
// Loaded on AWS lambda
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const serverless = require('serverless-http');
require('dotenv').config();

const app = express();
// const PORT = 3001;
const saltRounds = 10;

app.use(express.json());
app.use(cors());

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

function roundCoord(coord, precision = 0.001) {
    return Math.round(coord / precision) * precision;
}

// random number yay ! 
function getRandomIntInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// --- Fisher-Yates Shuffle Function ---
function shuffleArray(array) {
  let currentIndex = array.length, randomIndex;

  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

const priceLevelMap = new Map([
  ['PRICE_LEVEL_INEXPENSIVE','$'],
  ['PRICE_LEVEL_MODERATE', '$$'],
  ['PRICE_LEVEL_EXPENSIVE', '$$$'],
  ['PRICE_LEVEL_VERY_EXPENSIVE', '$$$$']
]);

const TYPES = [
  'afghani_restaurant', 'african_restaurant', 'american_restaurant','brazilian_restaurant', 'chinese_restaurant', 'french_restaurant', 'greek_restaurant','indian_restaurant', 'indonesian_restaurant', 'italian_restaurant', 'japanese_restaurant', 'korean_restaurant', 'lebanese_restaurant', 'mediterranean_restaurant', 'mexican_restaurant', 'middle_eastern_restaurant', 'spanish_restaurant', 'thai_restaurant', 'turkish_restaurant', 'vietnamese_restaurant', 'bagel_shop', 'bakery', 'barbecue_restaurant','breakfast_restaurant', 'brunch_restaurant', 'buffet_restaurant', 'cafe', 'confectionery', 'deli', 'dessert_shop', 'diner', 'donut_shop', 'fast_food_restaurant', 'fine_dining_restaurant', 'food_court', 'hamburger_restaurant', 'ice_cream_shop', 'juice_shop', 'pizza_restaurant', 'ramen_restaurant', 'sandwich_shop', 'seafood_restaurant', 'steak_house', 'sushi_restaurant', 'vegan_restaurant', 'vegetarian_restaurant'
];

const DIVERSE_SETS = [
    ['italian_restaurant', 'chinese_restaurant', 'mexican_restaurant', 'indian_restaurant'],
    ['japanese_restaurant', 'french_restaurant', 'thai_restaurant', 'mediterranean_restaurant'],
    ['american_restaurant', 'vietnamese_restaurant', 'greek_restaurant', 'korean_restaurant']
];

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

    if (token == null) {
        console.log('❌ Auth Error: No token provided.');
        return res.sendStatus(401); // Unauthorized - No token
    }

    jwt.verify(token, JWT_SECRET, (err, userPayload) => {
        if (err) {
            console.log('❌ Auth Error: Invalid token.', err.message);
            return res.sendStatus(403); // Forbidden - Invalid token
        }

        // Token is valid, attach user payload (which contains userId) to the request
        req.user = userPayload;
        console.log(`🔑 Token verified for user ID: ${req.user.userId}`);
        next(); // Proceed to the next middleware or route handler
    });
};

app.get('/hello', (req, res) => {
    res.send("Hello World!");
});

// --- NEW: Registration Route ---
app.post('/register', async (req, res) => {
    const { username, password, displayName } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        console.log(`⏳ Attempting to register user: ${username}`);
        // Check if user already exists
        const existingUser = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) {
            console.log(`❌ Username "${username}" already taken.`);
            return res.status(409).json({ error: 'Username already taken.' });
        }

        // Hash the password
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Insert new user
        const newUserResult = await pool.query(
            'INSERT INTO users (username, password_hash, display_name) VALUES ($1, $2, $3) RETURNING user_id, username, display_name',
            [username, passwordHash, displayName || username]
        );
        const user = newUserResult.rows[0];
        console.log(`✨ New user ${username} registered successfully.`);

        res.status(201).json({
            message: 'Registration successful!',
            user: user
        });

    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ error: 'Registration failed.' });
    }
});


// --- NEW: Login Route ---
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log('Request Body:', req.body); 

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        console.log(`⏳ Attempting to log in user: ${username}`);
        // Find user by username
        const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

        if (userResult.rows.length === 0) {
            console.log(`❌ Login failed: User "${username}" not found.`);
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        const user = userResult.rows[0];

        // Compare provided password with stored hash
        const match = await bcrypt.compare(password, user.password_hash);

        if (match) {
            console.log(`👤 User ${username} logged in successfully. Generating token...`);
            
            // --- JWT GENERATION ---
            const userPayload = {
                userId: user.user_id,
                username: user.username,
                displayName: user.display_name,
            };
            const accessToken = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '1d' }); // Token expires in 1 day
            // --- END JWT GENERATION ---

            res.json({
                message: 'Login successful!',
                user: userPayload, // Send user info back too
                token: accessToken // Send the token!
            });
        } else {
            console.log(`❌ Login failed: Incorrect password for "${username}".`);
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Login failed.' });
    }
});

app.post('/history/add', authenticateToken, async (req, res) => { // Added 'authenticateToken'
    // Get userId from the VERIFIED token payload (req.user), NOT req.body
    const userId = req.user.userId;
    const { restaurantName, restaurantTypes, latitude, longitude } = req.body; // Only need these now

    if (!restaurantName || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Name, latitude, and longitude are required.' });
    }

    try {
        console.log(`⏳ Adding visit for (verified) user ${userId} to "${restaurantName}"`);
        const typesString = Array.isArray(restaurantTypes) ? restaurantTypes.join(',') : '';

        await pool.query(
            'INSERT INTO visit_history (user_id, restaurant_name, restaurant_types, latitude, longitude) VALUES ($1, $2, $3, $4, $5)',
            [userId, restaurantName, typesString, latitude, longitude]
        );

        console.log(`✅ Visit added successfully for user ${userId}.`);
        res.status(201).json({ message: 'Visit recorded successfully!' });

    } catch (error) { 
        console.error('Error adding visit history:', error);
        res.status(500).json({ error: 'Failed to record visit.' });
      }
});

// --- MODIFIED: /history/get (Now uses middleware) ---
// Changed to /history/get (no :userId needed)
app.get('/history/get', authenticateToken, async (req, res) => { // Added 'authenticateToken'
    const userId = req.user.userId; // Get userId from the VERIFIED token

    try {
        console.log(`⏳ Fetching visit history for (verified) user ${userId}`);
        const historyResult = await pool.query(
            'SELECT latitude, longitude FROM visit_history WHERE user_id = $1',
            [userId]
        );
        
        // Convert string decimals back to numbers for the map
        const locations = historyResult.rows.map(row => ({
            latitude: parseFloat(row.latitude),
            longitude: parseFloat(row.longitude),
            weight: 1 // Add a default weight for heatmap (optional)
        }));

        console.log(`✅ Found ${locations.length} visits for user ${userId}.`);
        res.json(locations);

    } catch (error) {
        console.error('Error fetching visit history:', error);
        res.status(500).json({ error: 'Failed to fetch visit history.' });
    }
});

// --- NEW HELPER: Tries to get User ID from Token (doesn't fail if no token) ---
const getUserIdFromToken = (req) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

    if (token == null) {
        console.log('ℹ️ No token provided, proceeding without user history.');
        return null; // No token, no user ID
    }

    try {
        // Verify the token
        const userPayload = jwt.verify(token, JWT_SECRET);
        console.log(`ℹ️ Token verified for user ID: ${userPayload.userId}. Will use history.`);
        return userPayload.userId; // Return user ID from valid token
    } catch (err) {
        console.log('⚠️ Token found but invalid, proceeding without history.', err.message);
        return null; // Invalid token
    }
};

app.post('/pick', async (req, res) => {
  const { preferences, location } = req.body;
  if (!preferences || !location) {
    return res.status(400).json({ error: 'Preferences and location required' });
  }

    const userId = getUserIdFromToken(req);
    let visitedNames = new Set();
    // --- Fetch Visit History (if user ID is available) ---
    let num_visits = 0
    if (userId) {
        num_visits = await pool.query('SELECT get_visit_count($1)', [userId]);

        try {
            console.log(`⏳ Fetching visit history for user ${userId}`);
            const historyResult = await pool.query(
                'SELECT restaurant_name FROM visit_history WHERE user_id = $1',
                [userId]
            );
            visitedNames = new Set(historyResult.rows.map(row => row.restaurant_name));
            console.log(`✅ Found ${visitedNames.size} unique visited places for user ${userId}.`);
        } catch (historyError) {
            console.error('⚠️ Error fetching visit history, proceeding without it:', historyError);
            // Keep visitedNames as an empty set
        }
    }

    const { cuisines, budget, distance, minRating = 3.5} = preferences;
    const radius = Number(distance) || 3000;

    let empty_choice = ['restaurant'];
    console.log(num_visits)
    if (minRating > 4.7 || distance == 500){
        empty_choice = ['restaurant'];
    }
    else if (num_visits > 5 && num_visits < 20) {
        empty_choice = DIVERSE_SETS[getRandomIntInclusive(0,2)]
    }
    else {
        empty_choice = [TYPES[getRandomIntInclusive(0, 23)], TYPES[getRandomIntInclusive(24,46)]]
    }

    const types = cuisines.length > 0 ? cuisines : empty_choice;
    const typesKey = JSON.stringify(types);
    const latRound = roundCoord(location.lat);
    const lngRound = roundCoord(location.lng);

    try {
        const checkCache = await pool.query(
            `SELECT * FROM place_cache
            WHERE lat_round = $1 AND lng_round = $2 AND radius = $3 AND types = $4
            ORDER BY cached_at DESC LIMIT 1`,
            [latRound, lngRound, radius, typesKey]
        );

    let places;

    if (checkCache.rows.length > 0) {
      console.log('✅ Using cached result');
      places = checkCache.rows[0].response;
    } else {
        console.log('⏳ Fetching from Google Places API');
      
        const requestBody = {
            includedTypes: types,
            maxResultCount: 20,
            locationRestriction: {
                circle: {
                center: {
                    latitude: location.lat,
                    longitude: location.lng
                },
                radius: radius
                }
            },
            rankPreference: 'POPULARITY'
        };
        console.log(requestBody)

        const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_API_KEY,
                'X-Goog-FieldMask': 'places.displayName,places.location,places.businessStatus,places.rating,places.userRatingCount,places.websiteUri,places.googleMapsLinks,places.currentOpeningHours,places.formattedAddress,places.priceLevel,places.types,places.photos'
            },
            body: JSON.stringify(requestBody)
        });
        
        const data = await response.json();
        console.log(data);
        places = data.places || [];

        if (places.length > 0){
            // Store in cache if no error, not null
            await pool.query(
                `INSERT INTO place_cache (lat_round, lng_round, radius, types, response)
                VALUES ($1, $2, $3, $4, $5)`,
                [latRound, lngRound, radius, typesKey, JSON.stringify(places)]
            );
            console.log(`💾 Cached ${places.length} results.`);
        } else {
            console.log('🤷 No results from Google, nothing to cache.');
        }
    }

    if (places.length === 0) {
      return res.status(404).json({ error: 'No matching restaurants found nearby' });
    }

    // filter out all places which don't meet price, rating criteria, or are closed.
    const filtered_places = places.filter(
      place => {
        const priceLevel = place.priceLevel || '$$'; 
        const priceMatch = budget.length === 0 || budget.includes(priceLevelMap.get(priceLevel)); 
        const isOperational = place.businessStatus == 'OPERATIONAL';
        const ratingMatch = (place.rating || 0) >= minRating;
        return priceMatch && ratingMatch && isOperational
      }
    );

    // Rank results
    const preferredCuisinesSet = new Set(cuisines); // Use a Set for faster lookups
    const sorted_places = filtered_places.sort((a, b) => {
        const aName = a.displayName?.text || 'Unknown';
        const bName = b.displayName?.text || 'Unknown';

        // 1. Recency (Visited places go last - lower priority)
        const a_visited = visitedNames.has(aName);
        const b_visited = visitedNames.has(bName);
        if (a_visited !== b_visited) {
            return a_visited ? 1 : -1; // If a is visited, it comes after b. If b is visited, it comes after a.
        }

        // 2. Number of Cuisines Matched (More matches go first - higher priority)
        // Only compare if user provided cuisines
        let a_matches = 0;
        let b_matches = 0;
        if (preferredCuisinesSet.size > 0) {
            a_matches = (a.types || []).filter(type => preferredCuisinesSet.has(type)).length;
            b_matches = (b.types || []).filter(type => preferredCuisinesSet.has(type)).length;
        }
        if (a_matches !== b_matches) {
            return b_matches - a_matches; // Descending order (more matches first)
        }

        return 0; // since they are already pre-sorted by popularity
    });
    console.log(`🏆 Sorted places. Top is: ${sorted_places[0]?.displayName?.text || 'N/A'}`);

    // --- Select Top N, Shuffle, then Pick Two ---
    const N = 10; // Define N: How many top results to consider (e.g., 10)
    let top_candidates = sorted_places.slice(0, N); // Get the top N results

    // Only shuffle if we have more than 2 candidates, otherwise, the order is fixed.
    if (top_candidates.length > 2) {
        top_candidates = shuffleArray(top_candidates); // Shuffle *only* the top N
        console.log(`🔀 Shuffled Top ${N}. New top is: ${top_candidates[0]?.displayName?.text || 'N/A'}`);
    } else {
        console.log(`ℹ️ Less than 3 candidates, no shuffling needed.`);
    }

    // Return Top Two (or fewer) from the shuffled top-N list
    const topTwo = top_candidates.slice(0, 2);

    res.json({
      restaurants: topTwo.map(place => ({
        name: place.displayName?.text || 'Unknown',
        address: place.formattedAddress || 'No address provided',
        rating: place.rating || 'N/A',
        userRatingCount: place.userRatingCount || 0,
        location: {
          lat: place.location.latitude,
          lng: place.location.longitude
        },
        types: place.types || [], // Ensure types is always an array
        photos: place.photos || [], // Ensure photos is always an array
        priceLevel: priceLevelMap.get(place.priceLevel) || 'N/A', // Add price level
        directionsLink: place.googleMapsLinks?.directionsUri,
        reviewsLink: place.googleMapsLinks?.reviewsUri,
        photosLink: place.googleMapsLinks?.photosUri,
        phone: place.nationalPhoneNumber || place.internationalPhoneNumber || null
      }))
    });

  } catch (err) {
    console.error('Error in /pick route:', err);
    res.status(500).json({ error: 'Failed to pick a restaurant.' });
  }
});

app.get('/photo', async (req, res) => {
  const photoName = req.query.name;
  const maxHeight = req.query.maxHeight || 400;

  if (!photoName) {
    return res.status(400).json({ error: 'Missing photo name' });
  }

  try {
    const url = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=${maxHeight}&key=${GOOGLE_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(500).json({ error: 'Failed to fetch photo from Google' });
    }

    res.setHeader('Content-Type', response.headers.get('Content-Type'));
    response.body.pipe(res); // stream the image
  } catch (error) {
    console.error('Photo fetch error:', error);
    res.status(500).json({ error: 'Internal server error fetching photo' });
  }
});

module.exports.handler = serverless(app, {
    request: (req, event) => {
      // Manually parse the body from the raw event
      if (event.body) {
        req.body = JSON.parse(event.body.toString());
      }
    }
  });