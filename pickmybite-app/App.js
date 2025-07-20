import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking, Image,
  Modal, TextInput, FlatList, SafeAreaView, Keyboard, ActivityIndicator
} from 'react-native';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import MapView, { Marker, Heatmap } from 'react-native-maps';
import * as SecureStore from 'expo-secure-store';
import { decode } from 'base-64';

// --- NEW: Backend URL ---
const BACKEND_URL = 'https://mpkdbgbdr5.execute-api.us-east-1.amazonaws.com/live'; // Connected to AWS Lambda

const TOKEN_KEY = 'user_auth_token';

async function saveToken(token) {
    try {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch (error) {
        console.error("Failed to save token", error);
    }
}

async function getToken() {
    try {
        return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (error) {
        console.error("Failed to get token", error);
        return null;
    }
}

async function deleteToken() {
    try {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch (error) {
        console.error("Failed to delete token", error);
    }
}

// --- NEW: API Fetch Wrapper ---
const fetchWithAuth = async (url, options = {}) => {
    const token = await getToken();

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers, // Allow overriding/adding headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BACKEND_URL}${url}`, {
        ...options,
        headers,
    });

    return response;
};

// --- Constants ---
const REGIONS = [
  'afghani_restaurant', 'african_restaurant', 'american_restaurant','brazilian_restaurant', 'chinese_restaurant', 'french_restaurant', 'greek_restaurant','indian_restaurant', 'indonesian_restaurant', 'italian_restaurant', 'japanese_restaurant', 'korean_restaurant', 'lebanese_restaurant', 'mediterranean_restaurant', 'mexican_restaurant', 'middle_eastern_restaurant', 'spanish_restaurant', 'thai_restaurant', 'turkish_restaurant', 'vietnamese_restaurant'
];
const TYPES = [
  'bagel_shop', 'bakery', 'barbecue_restaurant','breakfast_restaurant', 'brunch_restaurant', 'buffet_restaurant', 'cafe', 'confectionery', 'deli', 'dessert_shop', 'diner', 'donut_shop', 'fast_food_restaurant', 'fine_dining_restaurant', 'food_court', 'hamburger_restaurant', 'ice_cream_shop', 'juice_shop', 'pizza_restaurant', 'ramen_restaurant', 'sandwich_shop', 'seafood_restaurant', 'steak_house', 'sushi_restaurant', 'vegan_restaurant', 'vegetarian_restaurant'
];

// Combine maps and create a single map for display
const COMBINED_DISPLAY_MAP = [...REGIONS, ...TYPES].reduce((acc, key) => {
    const display = key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .replace(/\s(Restaurant|Shop|House|Court|Dining|Deli|Cafe|Confectionery)$/, '');
    acc[key] = display;
    return acc;
}, {});

const BUDGETS = ['$', '$$', '$$$', '$$$$'];
// --- End Constants ---

// --- Searchable Modal Component ---
const SearchableModal = ({ visible, onClose, data, onSelect, displayMap }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredData = data.filter(item =>
        displayMap[item]?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <SafeAreaView style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search..."
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                        placeholderTextColor="#999"
                    />
                    <FlatList
                        data={filteredData}
                        keyExtractor={item => item}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.modalItem}
                                onPress={() => {
                                    onSelect(item);
                                    setSearchTerm(''); // Clear search on select
                                    onClose();
                                }}
                            >
                                <Text style={styles.modalItemText}>{displayMap[item]}</Text>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={<Text style={styles.modalEmptyText}>No items found or all selected</Text>}
                        keyboardShouldPersistTaps="handled" // Keep keyboard open while tapping list
                    />
                    <TouchableOpacity style={styles.closeButton} onPress={() => { setSearchTerm(''); onClose(); }}>
                        <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal>
    );
};
// --- End Searchable Modal Component ---

// --- NEW: Auth Screens ---
const AuthScreen = ({ onLogin }) => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState(''); // Only for register
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        if (!username || !password) {
            Alert.alert('Missing Info', 'Please enter both username and password.');
            return;
        }
        setIsLoading(true);
        try {
            const response = await fetch(`${BACKEND_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            if (response.ok && data.token) {
                await saveToken(data.token); // <-- SAVE THE TOKEN!
                onLogin(data.user); // Login with user data
            } else {
                Alert.alert('Login Failed', data.error || 'Invalid credentials.');
            }
        } catch (error) {
            Alert.alert('Error', 'Could not connect to the server.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async () => {
        if (!username || !password) {
            Alert.alert('Missing Info', 'Please enter both username and password.');
            return;
        }
        setIsLoading(true);
        try {
            const response = await fetch(`${BACKEND_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, displayName: displayName || username }),
            });
            const data = await response.json();
            if (response.ok || response.status === 201) {
                Alert.alert('Success!', 'Registration successful. Please log in.', [
                    { text: 'OK', onPress: () => setIsLoginView(true) }
                ]);
            } else {
                Alert.alert('Registration Failed', data.error || 'Could not register.');
            }
        } catch (error) {
            Alert.alert('Error', 'Could not connect to the server.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Welcome to PickMyBite 🍽</Text>
            <Text style={styles.pageTitle}>{isLoginView ? 'Login' : 'Register'}</Text>

            <TextInput
                style={styles.input}
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                placeholderTextColor="#999"
            />
            {!isLoginView && (
                <TextInput
                    style={styles.input}
                    placeholder="Display Name (Optional)"
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholderTextColor="#999"
                />
            )}
            <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholderTextColor="#999"
            />

            <TouchableOpacity
                style={[styles.primaryButton, { width: '85%', marginTop: 20 }]}
                onPress={isLoginView ? handleLogin : handleRegister}
                disabled={isLoading}
            >
                {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                ) : (
                    <Text style={styles.primaryButtonText}>
                        {isLoginView ? 'Login' : 'Register'}
                    </Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.switchButton}
                onPress={() => {
                    setIsLoginView(!isLoginView);
                    setUsername('');
                    setPassword('');
                    setDisplayName('');
                }}
            >
                <Text style={styles.switchButtonText}>
                    {isLoginView
                        ? "Don't have an account? Register"
                        : 'Already have an account? Login'}
                </Text>
            </TouchableOpacity>
        </View>
    );
};
// --- End Auth Screens ---

// --- NEW: Heatmap Screen Component ---
const HeatmapScreen = ({ onBack }) => {
    const [locations, setLocations] = useState([]);
    const [mapRegion, setMapRegion] = useState(null); // To center the map
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            setIsLoading(true);
            try {
                const response = await fetchWithAuth(`/history/get/`);
                const data = await response.json();
                if (response.ok) {
                    setLocations(data);
                    // Center map on the first point or a default
                    if (data.length > 0) {
                        setMapRegion({
                            latitude: data[0].latitude,
                            longitude: data[0].longitude,
                            latitudeDelta: 0.5, // Zoom level
                            longitudeDelta: 0.5,
                        });
                    } else {
                         // Default to a central location or user's current location if available
                         setMapRegion({ latitude: 13.7563, longitude: 100.5018, latitudeDelta: 1, longitudeDelta: 1 }); // Default Bangkok
                    }
                } else {
                    Alert.alert('Error', data.error || 'Could not fetch history.');
                }
            } catch (error) {
                Alert.alert('Error', 'Failed to connect to fetch history.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, []);

    return (
        <SafeAreaView style={styles.fullScreenContainer}>
            <Text style={styles.pageTitle}>Your Foodie Heatmap</Text>
            {isLoading ? (
                <ActivityIndicator size="large" color={PRIMARY_COLOR} style={{flex: 1}}/>
            ) : locations.length === 0 ? (
                 <View style={styles.centeredMessage}>
                    <Text>No visit history yet. Go explore!</Text>
                 </View>
            ) : (
                <MapView
                    style={styles.map}
                    initialRegion={mapRegion} // Use initialRegion or region
                    provider="google" // Ensure you have Google Maps set up if using this
                >
                    <Heatmap
                        points={locations}
                        opacity={0.7}
                        radius={50} // Adjust for desired spread
                        gradient={{
                            colors: ["#00FF00", "#FFFF00", "#FF0000"], // Green -> Yellow -> Red
                            startPoints: [0.1, 0.5, 1.0], // Where colors start
                            colorMapSize: 256
                        }}
                    />
                </MapView>
            )}
            <TouchableOpacity style={[styles.backButton, {alignSelf: 'center', marginBottom: 20}]} onPress={onBack}>
                <Text style={styles.backButtonText}>Back to Home</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true); // For initial token check
  const [step, setStep] = useState(0);
  const [selectedCuisines, setSelectedCuisines] = useState([]);
  const [selectedBudgets, setSelectedBudgets] = useState([]);
  const [distanceKm, setDistanceKm] = useState(3);
  const [restaurant, setRestaurant] = useState([]);
  const [location, setLocation] = useState(null);
  const [minRating, setMinRating] = useState(3.5);
  const [isRegionModalVisible, setRegionModalVisible] = useState(false);
  const [isTypeModalVisible, setTypeModalVisible] = useState(false);

  // --- NEW: Check for token on App Load ---
  useEffect(() => {
      const checkAuthStatus = async () => {
          const token = await getToken();
          if (token) {
              try {
                  // You *could* verify the token with the backend here,
                  // but for now, we'll just parse it (less secure but simpler)
                  // A better way: Make a /profile endpoint to get user data via token.
                  const payload = JSON.parse(decode(token.split('.')[1]));
                  if (payload && payload.userId) {
                      setUser({
                          userId: payload.userId,
                          username: payload.username,
                          displayName: payload.displayName
                      });
                  }
              } catch (e) {
                  console.error("Failed to parse token, logging out.", e);
                  await deleteToken(); // Delete bad token
              }
          }
          setIsLoadingAuth(false);
      };
      checkAuthStatus();
  }, []);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to use this app.');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      const userLocation = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setLocation(userLocation);
    })();
  }, []);

  const handleLogin = (userData) => {
      setUser(userData);
      setStep(0); // Go to the welcome screen after login
  };

  const handleLogout = async () => { // NEW: Logout function
      await deleteToken();
      setUser(null);
      setStep(0);
      setSelectedCuisines([]);
      setSelectedBudgets([]);
      setRestaurant([]);
  };

  const addSelection = (item) => {
    if (!selectedCuisines.includes(item)) {
      setSelectedCuisines([...selectedCuisines, item]);
    }
  };

  const removeSelection = (itemToRemove) => {
    setSelectedCuisines(selectedCuisines.filter(item => item !== itemToRemove));
  };

  const toggleBudgetSelection = (budgetToToggle) => {
      setSelectedBudgets(prev =>
          prev.includes(budgetToToggle)
              ? prev.filter(b => b !== budgetToToggle)
              : [...prev, budgetToToggle]
      );
  };

  const fetchRestaurant = async () => {
    if (!location) {
      Alert.alert('Location unavailable', 'Please enable location services.');
      return;
    }

    try {
      const response = await fetchWithAuth(`/pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences: {
            cuisines: selectedCuisines, // Will be empty if none selected
            budget: selectedBudgets, // Send array
            distance: Math.round(distanceKm * 1000),
            minRating: minRating
          },
          location: location
        }),
      });
      const data = await response.json();
      console.log(data);
      if (response.ok && data.restaurants.length > 0) {
        setRestaurant(data.restaurants);
        setStep(2);
      } else {
         Alert.alert('No match found', data.error || 'Please try adjusting your criteria.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch restaurant. Check backend connection.');
      console.log(error);
    }
  };

  const goBack = () => {
    if (step === 1 || step === 2) {
      setStep(0); // Go back to welcome from Prefs or Results
    } else if (step === 3) {
      setStep(0); // Go back to welcome from Heatmap
    } else {
      handleLogout(); // Logout from Welcome
    }
  };

  // --- NEW: Mark as Visited Function ---
  const markAsVisited = (restaurant) => { // <-- Function definition added
      Alert.alert(
          "Confirm Visit", `Are you sure you want to book ${restaurant.name}?`, // <-- Now 'restaurant' is the argument
          [
              { text: "Cancel", style: "cancel" },
              {
                  text: "Yes, I did!",
                  onPress: async () => {
                      try {
                          const response = await fetchWithAuth(`/history/add`, {
                              method: 'POST',
                              body: JSON.stringify({
                                  restaurantName: restaurant.name,
                                  restaurantTypes: restaurant.types,
                                  latitude: restaurant.location.lat,
                                  longitude: restaurant.location.lng,
                              }),
                          });
                          if (response.ok) {
                              Alert.alert('Delicious!', 'Visit added to your history.');
                          } else {
                              const data = await response.json();
                              Alert.alert('Error', data.error || 'Could not add visit.');
                          }
                      } catch (error) {
                          Alert.alert('Error', 'Failed to connect to save visit.');
                      }
                  },
              },
          ]
      );
  };

  const renderPill = (item, onRemove, displayMap = COMBINED_DISPLAY_MAP) => (
      <View key={item} style={styles.pill}>
          <Text style={styles.pillText}>{displayMap[item] || item}</Text>
          <TouchableOpacity onPress={() => onRemove(item)} style={styles.pillRemove}>
              <Text style={styles.pillRemoveText}>×</Text>
          </TouchableOpacity>
      </View>
  );

  // --- NEW: Show loading during auth check ---
  if (isLoadingAuth) {
      return (
          <View style={styles.container}>
              <ActivityIndicator size="large" color={PRIMARY_COLOR} />
              <Text>Checking your credentials...</Text>
          </View>
      );
  }

  // Render based on login state
  if (!user){
    return <AuthScreen onLogin={handleLogin} />;
  }
  

  // --- Step 0 ---
  if (step === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Hi, {user.displayName || user.username}!</Text>
        <Text style={{fontSize: 18, color: '#444', marginBottom: 30}}>What's next? 🚀</Text>
         <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(1)}>
            <Text style={styles.primaryButtonText}>Pick a Bite 🍽</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryButton]} onPress={() => setStep(3)}>
            <Text style={styles.primaryButtonText}>View My Heatmap 🔥</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={handleLogout}>
            <Text style={styles.backButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- Step 1 ---
  if (step === 1) {
    const selectedRegions = selectedCuisines.filter(c => REGIONS.includes(c));
    const selectedTypes = selectedCuisines.filter(c => TYPES.includes(c));
    const availableRegions = REGIONS.filter(r => !selectedCuisines.includes(r));
    const availableTypes = TYPES.filter(t => !selectedCuisines.includes(t));
    const isFindDisabled = selectedBudgets.length === 0;

    return (
      <SafeAreaView style={{flex: 1, backgroundColor: '#FFFFFF'}}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
            <Text style={styles.pageTitle}>Find a place to eat</Text>

            {/* --- Cuisine/Region Section --- */}
            <Text style={styles.sectionTitle}>Cuisine/Region</Text>
            <View style={styles.pillContainer}>
                {selectedRegions.map(item => renderPill(item, removeSelection))}
                <TouchableOpacity style={styles.addButton} onPress={() => setRegionModalVisible(true)}>
                    <Text style={styles.addButtonText}>+ Add Region</Text>
                </TouchableOpacity>
            </View>

            {/* --- Type of Food Section --- */}
            <Text style={styles.sectionTitle}>Type of Food</Text>
            <View style={styles.pillContainer}>
                {selectedTypes.map(item => renderPill(item, removeSelection))}
                <TouchableOpacity style={styles.addButton} onPress={() => setTypeModalVisible(true)}>
                    <Text style={styles.addButtonText}>+ Add Type</Text>
                </TouchableOpacity>
            </View>
            <Text style={styles.hintText}>
                Leave Cuisines & Types blank, and we'll pick something for you!
            </Text>

            {/* --- Budget Section --- */}
            <Text style={styles.sectionTitle}>Budget</Text>
            <View style={styles.selectionGroup}>
              {BUDGETS.map(budget => (
                <TouchableOpacity
                  key={budget}
                  style={[styles.optionButton, selectedBudgets.includes(budget) && styles.optionButtonSelected]}
                  onPress={() => toggleBudgetSelection(budget)}>
                  <Text style={[styles.optionText, selectedBudgets.includes(budget) && styles.optionTextSelected]}>
                    {budget}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* --- Rating & Distance Sliders --- */}
            <Text style={styles.sectionTitle}>Minimum Rating: {minRating.toFixed(1)} ★</Text>
             <View style={styles.sliderContainer}>
                <Slider
                    style={{ width: '100%', height: 40 }}
                    minimumValue={1} maximumValue={5} step={0.1} value={minRating}
                    onValueChange={setMinRating} minimumTrackTintColor="#E6B0AA"
                    maximumTrackTintColor="#DDDDDD" thumbTintColor="#E6B0AA"
                />
            </View>
            <Text style={styles.sectionTitle}>Maximum Distance: {distanceKm.toFixed(1)} km</Text>
             <View style={styles.sliderContainer}>
                <Slider
                    style={{ width: '100%', height: 40 }}
                    minimumValue={0.5} maximumValue={10} step={0.1} value={distanceKm}
                    onValueChange={setDistanceKm} minimumTrackTintColor="#E6B0AA"
                    maximumTrackTintColor="#DDDDDD" thumbTintColor="#E6B0AA"
                />
            </View>

            {/* --- Find Button --- */}
            <TouchableOpacity
                style={[styles.primaryButton, isFindDisabled && styles.disabledButton]}
                onPress={fetchRestaurant}
                disabled={isFindDisabled}>
                <Text style={styles.primaryButtonText}>Find a Place</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.backButton} onPress={() => setStep(0)}>
                 <Text style={styles.backButtonText}>Back to Home</Text>
            </TouchableOpacity>

            {/* --- Modals --- */}
            <SearchableModal
                visible={isRegionModalVisible}
                onClose={() => setRegionModalVisible(false)}
                data={availableRegions}
                onSelect={addSelection}
                displayMap={COMBINED_DISPLAY_MAP}
            />
            <SearchableModal
                visible={isTypeModalVisible}
                onClose={() => setTypeModalVisible(false)}
                data={availableTypes}
                onSelect={addSelection}
                displayMap={COMBINED_DISPLAY_MAP}
            />

        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- Step 2 ---
  if (step === 2) {
    return (
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.pageTitle}>Here are your options!</Text>

        {restaurant.map((r, index) => (
          <View key={index} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ratingText}>
                  {r.rating} ★ • {r.userRatingCount}+ ratings
                </Text>
                <Text style={styles.restaurantName}>{r.name}</Text>
                <Text style={styles.cuisineType}>
                  {r.types?.find(t => t.endsWith('_restaurant'))?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) ?? ''}
                </Text>
                <View style={styles.buttonRow}>
                  <TouchableOpacity style={styles.infoButton} onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=$${r.location.lat},${r.location.lng}`)}>
                    <Text style={styles.infoButtonText}>Directions</Text>
                  </TouchableOpacity>
                   <TouchableOpacity style={styles.infoButton} onPress={() => Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(r.name)}`)}>
                    <Text style={styles.infoButtonText}>More Info</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                       style={[styles.infoButton]}
                       onPress={() => markAsVisited(r)}>
                       <Text style={[styles.infoButtonText]}>Book</Text>
                   </TouchableOpacity>
                </View>
              </View>

              {r.photos?.length > 0 && (
                <Image
                  source={{ uri: `${BACKEND_URL}/photo?name=${encodeURIComponent(r.photos[0].name)}` }}
                  style={styles.cardImage}
                />
              )}
            </View>
          </View>
        ))}

        
        <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(1)}>
            <Text style={styles.primaryButtonText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={() => setStep(0)}>
            <Text style={styles.backButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }
  // --- NEW: Step 3 (Heatmap) ---
  if (step === 3) {
      return <HeatmapScreen onBack={() => setStep(0)} />;
  }

  return null;
}

// --- STYLES ---
const PRIMARY_COLOR = '#E6B0AA';
const SECONDARY_COLOR = '#F5F5F5';
const TEXT_COLOR = '#333333';
const WHITE_COLOR = '#FFFFFF';
const BORDER_COLOR = '#E0E0E0';

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: WHITE_COLOR, },
  scrollContainer: { flexGrow: 1, alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20, backgroundColor: WHITE_COLOR, },
  pageTitle: { fontSize: 26, fontWeight: 'bold', marginTop: 40, marginBottom: 20, color: TEXT_COLOR, },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginTop: 15, marginBottom: 10, color: TEXT_COLOR, alignSelf: 'flex-start', paddingHorizontal: 5, },
  pillContainer: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', paddingVertical: 5, paddingHorizontal: 5, borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 10, minHeight: 50, alignItems: 'center', },
  pill: { flexDirection: 'row', backgroundColor: PRIMARY_COLOR, borderRadius: 15, paddingVertical: 6, paddingHorizontal: 12, margin: 4, alignItems: 'center', },
  pillText: { color: WHITE_COLOR, marginRight: 8, fontSize: 13, },
  pillRemove: { backgroundColor: 'rgba(255, 255, 255, 0.3)', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center', },
  pillRemoveText: { color: WHITE_COLOR, fontWeight: 'bold', fontSize: 14, lineHeight: 18, },
  addButton: { backgroundColor: '#e8f5e9', borderRadius: 15, paddingVertical: 8, paddingHorizontal: 15, margin: 4, borderWidth: 1, borderColor: '#a5d6a7', },
  addButtonText: { color: '#388e3c', fontSize: 13, fontWeight: '500', },
  hintText: { fontSize: 12, color: '#888', fontStyle: 'italic', width: '100%', textAlign: 'center', marginTop: 5, marginBottom: 15, },
  selectionGroup: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', marginBottom: 10, width: '100%', },
  optionButton: { backgroundColor: SECONDARY_COLOR, paddingVertical: 10, paddingHorizontal: 18, margin: 6, borderRadius: 20, borderWidth: 1, borderColor: BORDER_COLOR, },
  optionButtonSelected: { backgroundColor: PRIMARY_COLOR, borderColor: PRIMARY_COLOR, },
  optionText: { color: TEXT_COLOR, fontSize: 14, },
  optionTextSelected: { color: WHITE_COLOR, fontWeight: 'bold', },
  sliderContainer: { width: '95%', marginBottom: 15, alignItems: 'center', },
  primaryButton: { backgroundColor: PRIMARY_COLOR, paddingVertical: 15, paddingHorizontal: 20, borderRadius: 25, alignItems: 'center', marginTop: 25, width: '80%', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, },
  primaryButtonText: { color: WHITE_COLOR, fontSize: 18, fontWeight: 'bold', },
  disabledButton: { backgroundColor: '#CCCCCC', },
  backButton: { marginTop: 15, padding: 10, },
  input: {
      height: 50,
      borderColor: '#E0E0E0',
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 15,
      marginBottom: 15,
      fontSize: 16,
      width: '85%',
      backgroundColor: '#F5F5F5',
  },
  switchButton: {
      marginTop: 20,
      padding: 10,
  },
  switchButtonText: {
      color: PRIMARY_COLOR,
      fontSize: 15,
      textDecorationLine: 'underline',
  },
  backButtonText: { color: '#A0A0A0', fontSize: 16, },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 40, },
  card: { backgroundColor: '#fff', padding: 20, marginVertical: 10, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 3, width: '100%', },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', },
  cardImage: { width: 90, height: 90, borderRadius: 12, marginLeft: 15, },
  restaurantName: { fontSize: 20, fontWeight: 'bold', marginTop: 5, color: TEXT_COLOR, },
  ratingText: { fontSize: 14, color: '#E67E22', fontWeight: '600', },
  cuisineType: { fontSize: 14, color: '#7f8c8d', marginBottom: 15, fontStyle: 'italic', },
  buttonRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, },
    // Modify infoButton slightly for better spacing if needed
  infoButton: {
      backgroundColor: '#ECF0F1',
      paddingHorizontal: 12, // Adjusted
      paddingVertical: 8,
      borderRadius: 20,
      marginRight: 8, // Adjusted
      borderWidth: 1,
      borderColor: '#BDC3C7',
      marginTop: 5, // Added margin top for stacking
  },
  infoButtonText: { fontWeight: '500', color: '#2C3E50', fontSize: 13, },
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.4)', },
  modalContent: { backgroundColor: WHITE_COLOR, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, height: '60%', shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 10, },
  searchInput: { height: 45, borderColor: BORDER_COLOR, borderWidth: 1, borderRadius: 10, paddingHorizontal: 15, marginBottom: 15, fontSize: 16, },
  modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', },
  modalItemText: { fontSize: 16, color: TEXT_COLOR, },
  modalEmptyText: { textAlign: 'center', marginTop: 20, color: '#888', },
  closeButton: { backgroundColor: '#e0e0e0', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 15, },
  closeButtonText: { color: TEXT_COLOR, fontSize: 16, fontWeight: 'bold', },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  map: {
    flex: 1, // Make map take most of the screen
    width: '100%',
  },
  centeredMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});