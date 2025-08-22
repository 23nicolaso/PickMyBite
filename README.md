<div align="center">

# Pick My Bite 🍽️

</div>

> "What should I eat for dinner?" 🤔
> <br/>
> "I'm too lazy to pick a place." 😩

These were the statements that kickstarted the journey of **Pick My Bite**. In a world with millions of restaurants, decision fatigue is real. That's why I made this app! If you just want an algorithm to pick a restaurant for you, simply tap a button. You can add criteria if you're feeling picky—like a specific cuisine, budget, or distance—and it gives you two perfect options.

It then stores all the restaurants you've been to and visualizes your culinary adventures on a **personal foodie heatmap**! 🔥

---

## ✨ Features

-   🔮 **Smart Random Picks**: Leave the preferences blank, and let the algorithm surprise you with new and diverse cuisines.
-   🎨 **Customized Filtering**: Tailor your search with multiple options:
    -   **Cuisine & Type**: Select from a huge list of regional cuisines and food types, from `afghani` to `vegan` restaurants.
    -   **Budget**: Choose from `$` to `$$$$` to match your wallet.
    -   **Distance**: A sleek slider lets you set a maximum travel radius from 0.5km to 10km.
    -   **Minimum Rating**: Ensure you only get the best by setting a minimum star rating.
-   🤔 **Dual Choices**: Instead of one option, you get two top-tier, shuffled candidates to make the final decision fun and easy.
-   🔐 **Secure User Accounts**: Full registration and login system using JWT for secure, persistent sessions.
-   🔥 **Foodie Heatmap**: Every place you mark as "visited" adds a point to your personal map, creating a beautiful heatmap of your dining history.

---

## 🚀 Getting Started & Installation

The app is built with **Expo**, so you can get it running on your phone in just a few minutes.

### 1. Clone the Repository

```bash
git clone [https://github.com/23nicolaso/PickMyBite.git](https://github.com/23nicolaso/PickMyBite.git)
````

### 2\. Navigate to the App Directory

```bash
cd pickmybite-app
```

### 3\. Install Dependencies

This command installs all the necessary packages for the frontend app.

```bash
npm install
```

### 4\. Run the App\!

This will start the Metro server.

```bash
npx expo start
```

### 5\. View on Your Phone

  - Download the **Expo Go** app from the Apple App Store or Google Play Store.
  - Scan the QR code generated in your terminal with the Expo Go app's camera.

That's it\! The app is now live on your phone. ✨

-----

## 🛠️ How It Works: The Tech Stack

This is a full-stack application, combining a mobile frontend with a powerful, scalable, and serverless backend.

### Frontend (App.js)

Built with $\color{Cyan}{React \ Native \ (Expo)}$, allowing one codebase to rule them all (iOS & Android).

```
 State Management: Core logic is powered by React Hooks (`useState`, `useEffect`) to manage user preferences, API data, and app state (which screen to show).
 Location Services: Uses `expo-location` to get the user's current coordinates to find restaurants nearby.
 Secure Token Storage: User authentication tokens (JWT) are securely stored on the device using `expo-secure-store`. This keeps you logged in safely.
 A custom wrapper function, `fetchWithAuth`, automatically attaches the JWT to every API request, making calls to protected backend routes seamless.
 Mapping: The beautiful heatmap is rendered using `react-native-maps`, plotting visited locations fetched from the backend.
```

### Backend (Index.js)

A serverless $\color{Cyan}{Node.JS, \ Express.JS}$ application deployed on $\color{Apricot}{AWS \ Lambda}$

```
 Serverless Architecture: The entire Express app is wrapped with `serverless-http` and deployed to AWS Lambda. Amazon API Gateway exposes the Lambda function to the web. This is super scalable and cost-effective!
 Database: A serverless `Neon DB` (PostgreSQL) instance stores user credentials, visit history, and the API cache.
 Google Places API: The `/pick` endpoint is the brain. It calls Google's `searchNearby` API to find restaurants based on location and user preferences.
 Smart Caching: To reduce Google API costs and speed up response times, successful API responses are cached in the database. A subsequent request with the same parameters in the same area will hit the cache first.
 The cache key is a combination of rounded latitude/longitude, search radius, and the types of cuisines requested.
---
 IMPORTANT: If you want to host the backend on your own, you MUST create a .env file with your own API keys.
---
 Custom Ranking Algorithm: The backend is more than just a proxy. It ranks results with a special formula:
   1. Deprioritizes restaurants you've already visited (by checking your history).
   2. Prioritizes restaurants that match your selected cuisine preferences.
   3. Shuffles the top 10 candidates to add an element of surprise before picking the final two.
```

-----

## ⚙️ Configuration

To run the backend, you need to set up your own environment variables. Create a `.env` file in the root of the backend project directory and add the following:

```bash
# .env file

# Your Google Cloud Platform API Key with Places API enabled
GOOGLE_API_KEY="AIzaSy..."

# Your connection string from Neon DB
DATABASE_URL="postgresql://user:password@host:port/dbname?sslmode=require"

# A long, random, secret string for signing JWTs
JWT_SECRET="a_very_super_secret_string_that_is_long"
```

-----

## 🗺️ API Endpoints

The backend provides the following RESTful endpoints:

| Method | Endpoint              | Protected | Description                                                                                                    |
| :----- | :-------------------- | :-------: | :------------------------------------------------------------------------------------------------------------- |
| `POST` | `/register`           |    No     | Creates a new user account with a hashed password.                                                         |
| `POST` | `/login`              |    No     | Authenticates a user and returns a JWT access token.                                                       |
| `POST` | `/pick`               | Optional  | The main endpoint. Finds and ranks restaurants. Uses token if provided to check visit history. |
| `POST` | `/history/add`        |    Yes    | Adds a visited restaurant to the user's history.                                                    |
| `GET`  | `/history/get`        |    Yes    | Retrieves a list of coordinates for the user's visited restaurants to display on the heatmap. |
| `GET`  | `/photo`              |    No     | A proxy to fetch restaurant photos from Google's API, hiding the API key from the frontend.     |

-----

<div align="center"\>
I hope you love **Pick My Bite** as much as I loved building it!
<br/\>
Happy eating! 🎉
</div\>
<br/\>
<br/\>

```
```
