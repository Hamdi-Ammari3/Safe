import {useState,useEffect,useRef} from 'react'
import { Alert,StyleSheet,Text,View,TouchableOpacity,Modal,Dimensions,Image  } from 'react-native'
import Svg, {Circle} from 'react-native-svg'
import haversine from 'haversine'
import MapView, { Marker ,AnimatedRegion } from 'react-native-maps'
import { doc,onSnapshot } from 'firebase/firestore'
import { DB } from '../firebaseConfig'
import colors from '../constants/Colors'
import AntDesign from '@expo/vector-icons/AntDesign'
import tripStartedImage from '../assets/images/track_trip.png'

const TrackTripComponent = ({ rider,text }) => {
    const mapRef = useRef(null)
    const markerRef = useRef(null)

    const [driverOriginLocation,setDriverOriginLocation] = useState(null)
    const [destination, setDestination] = useState(null)
    const [openTrackTripModal,setOpenTackTripModal] = useState(false)
    const [driverCurrentLocation, setDriverCurrentLocation] = useState(null)
    const [driverCurrentLocationLoading, setDriverCurrentLocationLoading] = useState(true)
    const [mapReady, setMapReady] = useState(false)

    const createAlert = (alerMessage) => {
        Alert.alert(alerMessage)
    }

    //Track the trip
    const trackTrip = async () => {
        setOpenTackTripModal(true)
        setDriverCurrentLocationLoading(true)
    }

    //Close track trip modal
    const closeTrackTripModal = () => {
        setOpenTackTripModal(false)
        setDriverCurrentLocationLoading(false)
    }

    //Animated marker
    const animatedDriverLocation = useRef(new AnimatedRegion({
        latitude: 0,
        longitude: 0,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    })).current;

    //Marker icon
    const markerIcon = () => {
        return(
            <Svg height={20} width={20}>
                <Circle
                    cx="10"
                    cy="10"
                    r="10"
                    fill="rgba(57, 136, 251, 0.28)"
                    stroke="transparent"
                />
                <Circle
                    cx="10"
                    cy="10"
                    r="6"
                    fill="rgba(57, 137, 252, 1)"
                    stroke="#fff"
                    strokeWidth="2"
                />
            </Svg>
        )
    }

    // Fetch driver location
    useEffect(() => {
        let unsubscribe;
        if (rider.driver_id && openTrackTripModal) {
            const driverRef = doc(DB, 'drivers', rider.driver_id)
            unsubscribe = onSnapshot(
                driverRef,
                (snapshot) => {
                    if (snapshot.exists()) {
                        const data = snapshot.data();
                        if (data.current_location) {
                            const newLocation = data.current_location

                            setDriverCurrentLocationLoading(false)
                            setDriverCurrentLocation(newLocation)
                            checkAndUpdateOriginLocation(newLocation)
              
                            // Animate driver marker to the new location
                            animatedDriverLocation.timing({
                                latitude: newLocation.latitude,
                                longitude: newLocation.longitude,
                                duration: 1000,
                                useNativeDriver: false,
                            }).start();
                        }
                    } else {
                        createAlert('حدث خطا اثناء تتبع الرحلة')
                        setOpenTackTripModal(false)
                    }
                },
                (error) => {
                    console.log("Error tracking driver:", error);
                    createAlert('حدث خطا اثناء تتبع الرحلة')
                    setOpenTackTripModal(false)
                }
            )
  
            return () => {
                if (unsubscribe) {
                    unsubscribe();
                }
            }
        }
    }, [rider.driver_id, openTrackTripModal])

    // Function to check and update the origin location
    let lastOriginUpdateTime = Date.now();

    const checkAndUpdateOriginLocation = (currentLocation) => {
    
        if (!currentLocation?.latitude || !currentLocation?.longitude) {
            return;
        }
    
        if (!driverOriginLocation) {
            setDriverOriginLocation(currentLocation)
            return;
        }

        const now = Date.now();
        if (now - lastOriginUpdateTime < 30000) return; // Prevent updates within 30 seconds

        // Calculate the distance between the current location and the origin
        const distance = haversine(driverOriginLocation, currentLocation, { unit: "meter" });
  
        if (isNaN(distance)) {
            return;
        }
  
        if (distance > 400) {
            setDriverOriginLocation(currentLocation)
            lastOriginUpdateTime = now;
        }
    }

    // Set destination based on rider trip status
    useEffect(() => {
        if (rider.trip_status === 'to destination') {
            setDestination(rider.destination_location)
            setDriverOriginLocation(driverCurrentLocation)
        } else if (rider.trip_status === 'at home') {
            setDestination(rider.home_location);
            setDriverOriginLocation(driverCurrentLocation)
        } else if (rider.trip_status === 'to home') {
            setDestination(rider.home_location);
            setDriverOriginLocation(driverCurrentLocation)
        }
    }, [rider.trip_status])

    //Map ready to fit coordinates
    const handleMapReady = () => {
        setMapReady(true);
    }

    // fit coordinate function
    const fitCoordinatesForCurrentTrip = () => { 
        if (!mapReady || !mapRef.current || !driverOriginLocation) return;
    
        if (driverOriginLocation && destination) {
            mapRef.current.fitToCoordinates(
                [driverOriginLocation, destination],
                {
                    edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                    animated: true,
                }
            );
        }
    }

    useEffect(() => {
        if (mapReady && driverOriginLocation && destination) {
        fitCoordinatesForCurrentTrip();
        }
    }, [mapReady,destination])


    return (
    <View style={styles.next_trip_box}>
        <View style={styles.illustration_container}>
            <Image source={tripStartedImage} style={styles.illustration}/>
        </View>
        <View style={styles.next_trip_text_box}>
            <Text style={styles.next_trip_text}>{text}</Text>
            <TouchableOpacity style={styles.track_trip_button} onPress={trackTrip}>
              <Text style={styles.track_trip_button_text}>تتبع الرحلة</Text>
            </TouchableOpacity>
            <Modal
              animationType="fade"
              transparent={true} 
              visible={openTrackTripModal} 
              onRequestClose={closeTrackTripModal}
            >
                <View style={styles.modal_container}>
                    <View style={styles.modal_box}>
                        <View style={styles.modal_header}>
                            <TouchableOpacity onPress={closeTrackTripModal}>
                                <AntDesign name="closecircleo" size={24} color="gray" />
                            </TouchableOpacity>
                        </View>
                        <View>
                            {driverCurrentLocationLoading ? (
                                <View style={styles.loading_location}>
                                    <Text style={styles.loading_location_text}>جاري تحديد موقع السائق ...</Text>
                                </View>
                            ) : (
                                <View style={styles.mapContainer}>
                                    <MapView
                                        provider="google"
                                        ref={mapRef}
                                        onMapReady={handleMapReady}                                    
                                        initialRegion={{
                                            latitude: driverCurrentLocation?.latitude || 33.3152,
                                            longitude: driverCurrentLocation?.longitude || 44.3661,
                                            latitudeDelta: 0.05,
                                            longitudeDelta: 0.05,
                                        }}
                                        loadingEnabled={true}
                                        style={styles.map}
                                    >
                                        <Marker.Animated
                                            ref={markerRef}
                                            coordinate={animatedDriverLocation}
                                            title="السائق"
                                        >
                                            <View>
                                                {markerIcon()}
                                            </View>
                                        </Marker.Animated>

                                        <Marker
                                            key={`Destination ${rider?.id}`}
                                            coordinate={destination}
                                            pinColor="red"
                                        />
                                    </MapView>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    </View>
  )
}

export default TrackTripComponent

const { width: SCwidth, height: SCheight } = Dimensions.get('window')

const styles = StyleSheet.create({
  next_trip_box:{
    width:SCwidth,
    height:SCheight - 200,
    borderRadius:15,
    alignItems:'center',
    justifyContent:'center',
  },
  illustration_container:{
    width:200,
    height:200,
    justifyContent:'center',
    alignItems:'center',
  },
  illustration:{
    width:200,
    height:200,
    resizeMode:'contain',
  },
  next_trip_text_box:{
    height:60,
    marginTop:40,
    justifyContent:'space-between',
    alignItems:'center',
  },
  next_trip_text:{
    width:300,
    lineHeight:30,
    verticalAlign:'middle',
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:14,
  },
  track_trip_button:{
    width:130,
    height:40,
    marginTop:20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor:'rgba(190, 154, 78, 0.30)',
    borderColor:colors.BLACK,
    borderWidth:1,
    borderRadius:15
  },
  track_trip_button_text:{
    lineHeight:40,
    fontFamily: 'Cairo_700Bold',
    fontSize:14,
    color:colors.BLACK
  },
  modal_container:{
    flex:1,
    justifyContent:'center',
    alignItems:'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal_box:{
    width:SCwidth - 20,
    height:SCheight - 100,
    backgroundColor:colors.WHITE,
    borderRadius: 15,
    alignItems: 'center',
  },
  modal_header:{
    width:'100%',
    height:40,
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
  },
  loading_location:{
    width:SCwidth - 20,
    height:SCheight - 200,
    justifyContent: 'center',
    alignItems:'center',
  },
  loading_location_text:{
    lineHeight:40,
    fontFamily:'Cairo_400Regular',
  },
  mapContainer:{
    width:SCwidth - 20,
    height:SCheight - 150,
    justifyContent: 'center',
    alignItems:'center',
  },
  map:{
    width:SCwidth - 20,
    height:SCheight - 150,
  },
})
