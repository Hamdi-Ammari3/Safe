import {useState,useEffect,useRef} from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Alert,StyleSheet,Text,View,ActivityIndicator,TouchableOpacity,Modal,ScrollView,Dimensions,Linking } from 'react-native'
import { useRouter,useLocalSearchParams } from 'expo-router'
import { getDoc,onSnapshot,doc,updateDoc } from 'firebase/firestore'
import { DB } from '../../../../../firebaseConfig'
import MapView, { Marker } from 'react-native-maps'
import MapViewDirections from 'react-native-maps-directions'
import * as Location from 'expo-location'
import { useDriverData } from '../../../../stateManagment/DriverContext'
import dayjs from "dayjs"
import colors from '../../../../../constants/Colors'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import FontAwesome5 from '@expo/vector-icons/FontAwesome5'
import AntDesign from '@expo/vector-icons/AntDesign'
import Ionicons from '@expo/vector-icons/Ionicons'

const intercityTripDetails = () => {
    const {driverData} = useDriverData()
    const GOOGLE_MAPS_APIKEY = ''
    const router = useRouter()
    const mapRef = useRef(null)
    const {tripID} = useLocalSearchParams()
    const [tripData, setTripData] = useState(null)
    const [fetchingTripLoading, setFetchingTripLoading] = useState(true)
    const [openStartTripMapModalLoading,setOpenStartTripMapModalLoading] = useState(false)
    const [openStartTripMapModal,setOpenStartTripMapModal] = useState(false)
    const [driverOriginLocation,setDriverOriginLocation] = useState(null)
    const [selectedRider, setSelectedRider] = useState(null)
    const [isMarkingRider, setIsMarkingRider] = useState(false)
    const [takingTheTripLoading,setTakingTheTripLoading] = useState(false)

    const createAlert = (alerMessage) => {
        Alert.alert(alerMessage)
    }

    //Fetch trip data
    useEffect(() => {
        if (!tripID) return;
        const tripRef = doc(DB, 'intercityTrips', tripID);

        const unsubscribe = onSnapshot(tripRef, (tripSnap) => {
            if (tripSnap.exists()) {
                const trip = tripSnap.data();
                setTripData({ id: tripSnap.id, ...trip });
            } else {
                console.log('Trip not found');
            }

            setFetchingTripLoading(false);
        }, (error) => {
            console.log('Error with trip snapshot:', error);
            setFetchingTripLoading(false);
        });

        // Clean up on unmount
        return () => unsubscribe();
    }, [tripID]);

    //Come back to home screen
    const comeBackToHome = () => {
        router.push('/driverDailyTripsMain')  
    }

    //Format start date and time
    const formatTripStartTime = (timestamp) => {
        if (!timestamp) return '';
        const date = dayjs(timestamp?.toDate());
        if (date.isToday()) {
            return `اليوم ${date.format('hh:mm A')}`;
        }
        if (date.isTomorrow()) {
            return `غدا ${date.format('hh:mm A')}`;
        }
        return date.format('dddd D MMMM hh:mm A');
    }

    // format trip amount
    const formatTripAmount = (amount) => {
      return amount?.toLocaleString('ar-IQ', {
        style: 'currency',
        currency: 'IQD',
        minimumFractionDigits: 0,
      })
    }

    // Handle notification sending
    const sendNotification = async (token, title, body) => {
        try {
            const message = {
                to: token,
                sound: 'default',
                title: title,
                body: body 
            };

            await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                Accept: 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
                },
                body: JSON.stringify(message),
            });
      
        } catch (error) {
            console.log("Error sending notification:", error);
        }
    }

    //Take the trip
    const takeTheTrip = async () => {
        if (!tripData?.id || !driverData) {
            return createAlert("بيانات الرحلة أو السائق غير متوفرة.");
        }

        try {
            setTakingTheTripLoading(true)
            const tripRef = doc(DB, "intercityTrips", tripData.id)

            // 1. Update the trip document with driver info
            await updateDoc(tripRef, {
                driver_id: driverData[0].id,
                driver_name: driverData[0].full_name,
                driver_notification: driverData[0].notification_token,
                driver_phone: driverData[0].phone_number,
                car_modal: driverData[0].car_model || null,
                car_plate: driverData[0].car_plate || null,
            })

            // 2. Notify the rider that the trip has been picked
            if(tripData?.riders[0].notification) {
                await sendNotification(
                    tripData?.riders[0].notification,
                    "تم استلام رحلتك",
                    `السائق ${driverData[0].full_name} استلم رحلتك إلى ${tripData.destination_address}`
                )
            }

            createAlert("تم استلام الرحلة بنجاح")
            
        } catch (error) {
            createAlert('. يرجى المحاولة مرة أخرى')
            console.log(error)
        } finally {
            setTakingTheTripLoading(false)
            router.push('/driverDailyTripsMain')
        }
    }

    // Format the rider name to one word only
    const formatRiderName = (name) => {
        if (!name) return '';
        return name.trim().split(/\s+/)[0] || '';
    };

    //Call the rider 
    const handleCallRider = (phoneNumber) => {
        if (!phoneNumber) return;

        Linking.openURL(`tel:${phoneNumber}`)
        .catch(err => {
            console.log('Failed to make a call:', err);
            Alert.alert('خطأ', 'تعذر إجراء المكالمة');
        });
    }

    //Open start the trip modal
    const startTheTrip = async () => {
        if (!tripData?.id || !tripData?.riders) {
            return createAlert("بيانات الرحلة غير مكتملة");
        }

        try {
            setOpenStartTripMapModal(true)
            setOpenStartTripMapModalLoading(true)

            const tripRef = doc(DB, "intercityTrips", tripData.id)

            // 1. Mark the trip as started
            await updateDoc(tripRef, {
                started: true,
            })

            // 2. Send notifications to all riders
            const notificationPromises = tripData.riders
            .filter(rider => rider.notification)
            .map(rider =>
                sendNotification(
                rider.notification,
                "بدأت الرحلة",
                `السائق بدأ رحلتك إلى ${tripData.destination_address}`
                )
            )

            await Promise.all(notificationPromises);

        } catch (error) {
            console.log("Error starting trip:", error);
            createAlert("حدث خطأ أثناء بدء الرحلة");
        } finally {
            setOpenStartTripMapModalLoading(false)
        }
    }

    //complete the already started trip
    const openTripMapModal = () => {
        setOpenStartTripMapModal(true)
        setOpenStartTripMapModalLoading(true)
    }

    //Close start the trip modal
    const closeStartTheTripHandler = () => {
        setOpenStartTripMapModal(false)
        setSelectedRider(null)
    }

    //Fit trip coords (start trip modal)
    const fitMapRidersMarkers = () => {
        if (!mapRef.current || !tripData) return;
        let allCoords = [];
        if (selectedRider) {
            allCoords = [
                {
                    latitude: driverOriginLocation?.latitude,
                    longitude: driverOriginLocation?.longitude
                },
                {
                    latitude: selectedRider?.location?.latitude,
                    longitude: selectedRider?.location?.longitude
                }
            ]
        } else {
            allCoords = [
                {
                    latitude: driverData[0]?.current_location?.latitude,
                    longitude: driverData[0]?.current_location?.longitude
                },
                ...tripData?.riders.map(r => ({
                    latitude: r?.location?.latitude,
                    longitude: r?.location?.longitude
                })),
            ]
        }
        mapRef.current.fitToCoordinates(allCoords, {
            edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
            animated: true
        });
    }

    //Trip ready to open (discovering trip start - end points)
    const handleStartTripMapLayout = () => {
        fitMapRidersMarkers()
    }

    // Fetch the driver's current location
    useEffect(() => {
        let locationSubscription = null
        const startTracking = async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
      
            if (status !== 'granted') {
                createAlert('الرجاء تفعيل الصلاحيات للوصول الى الموقع');
                return;
            }

            locationSubscription  = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    distanceInterval: 100,
                    timeInterval:10000
                },
                async (newLocation) => {
                    const { latitude, longitude } = newLocation.coords;
                    const currentLocation = { latitude, longitude };

                    setOpenStartTripMapModalLoading(false)    
                    await saveLocationToFirebase(latitude, longitude);                                
                    checkAndUpdateOriginLocation(currentLocation);
                }
            )
        }

        if(openStartTripMapModal) {
            startTracking()
        }

        return () => {
            if (locationSubscription) {
                locationSubscription.remove();
                locationSubscription = null;
            }
        }

    }, [openStartTripMapModal])

    //Save new location to firebase
    const saveLocationToFirebase = async (latitude, longitude) => {
        if (!driverData[0]) {
            return
        }
        try {
            const driverDoc = doc(DB, 'drivers', driverData[0]?.id);
            await updateDoc(driverDoc, {
                current_location: {
                    latitude: latitude,
                    longitude: longitude
                },
            });
        } catch (error) {
            Alert.alert('خطا اثناء تحديث الموقع');
            console.log(error)
        }
    }

    // the initial driver location update
    let lastOriginUpdateTime = Date.now();

    // Function to check and update the origin location
    const checkAndUpdateOriginLocation = (currentLocation) => {
        if (!currentLocation?.latitude || !currentLocation?.longitude) {
            return;
        }
  
        if (!driverOriginLocation) {
            setDriverOriginLocation(currentLocation);
            return;
        }
  
        const now = Date.now();
        if (now - lastOriginUpdateTime < 50000) return; // Prevent updates within 50 seconds
  
        // Calculate the distance between the current location and the origin
        const distance = haversine(driverOriginLocation, currentLocation, { unit: "meter" });
  
        if (isNaN(distance)) {
            return;
        }
  
        if (distance > 8000) {
            setDriverOriginLocation(currentLocation)
            lastOriginUpdateTime = now;
        }
    }

    //Pick up the rider
    const sendPickUpRiderRequest = async(tripID,riderID) => {
        try {
            if (isMarkingRider) return
            setIsMarkingRider(true)

            const tripRef = doc(DB, 'intercityTrips', tripID)
            const tripSnap = await getDoc(tripRef)

            if (!tripSnap.exists()) {
                console.log("Trip not found");
                return;
            }
            const tripData = tripSnap.data()
            const updatedRiders = tripData.riders?.map(rider => {
                if (rider.id === riderID) {
                    return {
                    ...rider,
                    picked_check: true,
                    };
                }
                return rider;
            });
            await updateDoc(tripRef, {
                riders: updatedRiders
            });
        } catch (error) {
            console.log("Error updating picked_check:", error)
            createAlert('خطا اثناء تصعيد الراكب')
        } finally{
            setIsMarkingRider(false)
            setSelectedRider(null)
        }
    }

    //Fetching trip data loading
    if (fetchingTripLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.spinner_error_container}>
                    <ActivityIndicator size="large" color={colors.PRIMARY}/>
                </View>
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.title}>
                <Text style={styles.titleText}>تفاصيل الرحلة</Text>
                <TouchableOpacity style={styles.arrowBackFunction} onPress={comeBackToHome}>
                    <FontAwesome5 name="arrow-circle-left" size={24} color="black" />
                </TouchableOpacity>
            </View>
            <View style={styles.main_box}>
                <View style={styles.location_box}>
                    <View style={styles.location_text_box}>
                        <Text style={styles.trip_text_start_point_title}>الانطلاق</Text>
                        <Text style={styles.trip_text_start_point}>{tripData?.start_point}</Text>
                    </View>
                    <View style={styles.location_icon_box}>
                        <MaterialCommunityIcons name="map-marker-account-outline" size={24} color="black" />
                    </View>
                </View>
                <View style={styles.location_box}>
                    <View style={styles.location_text_box}>
                        <Text style={styles.trip_text_start_point_title}>الوصول</Text>
                        <Text style={styles.trip_text_start_point}>{tripData?.destination_address}</Text>
                    </View>
                    <View style={styles.location_icon_box}>
                        <MaterialCommunityIcons name="map-marker-check-outline" size={24} color="black" />
                    </View>
                </View>
                <View style={styles.location_box}>
                    <View style={styles.location_text_box}>
                        <Text style={styles.trip_text_start_point_title}>التوقيت</Text>
                        <Text style={styles.trip_text_start_point}>{formatTripStartTime(tripData?.start_datetime)}</Text>
                    </View>
                    <View style={styles.location_icon_box}>
                        <MaterialIcons name="access-time" size={24} color="black" />
                    </View>
                </View>

                {tripData?.riders?.length > 0 ? (
                    <View style={styles.trip_riders_request_container}>
                        <Text style={styles.trip_riders_request_box_title}>الركاب</Text>
                    
                        <ScrollView 
                            vertical
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.trip_riders_request_box_scroll}
                        >
                            {tripData?.riders?.map((r,index) => (
                                <View style={styles.trip_riders_request_item} key={index}>
                                    <Text style={styles.trip_riders_request_item_name_text}>{formatRiderName(r.name)}</Text>
                                    <Text style={styles.trip_riders_request_item_name_text}>-</Text>
                                    <Text style={styles.trip_riders_request_item_name_text}>{r.seats_booked} مقاعد</Text>
                                    <Text style={styles.trip_riders_request_item_name_text}>-</Text>
                                    <Text style={styles.trip_riders_request_item_name_text}>{formatTripAmount(r.seats_booked_price)}</Text>
                                    <TouchableOpacity 
                                        style={styles.trip_riders_request_item_buttons_item}
                                        onPress={() => handleCallRider(r.phone)}
                                    >
                                        <Ionicons name="call-outline" size={20} color="white" />
                                    </TouchableOpacity>
                                    {r.picked === true && (
                                        <AntDesign name="checkcircle" size={30} color="#328E6E" />
                                    )}
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                ) : (
                    <View style={styles.no_rider_yet}>
                        <Text style={styles.trip_text_start_point_title}>لا يوجد ركاب حاليا</Text>
                    </View>
                    
                )}
                    
                

                {!tripData.driver_id && (
                    <View style={styles.track_trip_box}>
                        <TouchableOpacity style={styles.track_trip_button} onPress={takeTheTrip}>
                            {takingTheTripLoading ? (
                                <ActivityIndicator size="small" color={colors.WHITE}/>
                            ) : (
                                <Text style={styles.track_trip_button_text}>استلام الرحلة</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {tripData.driver_id === driverData[0]?.id && 
                tripData?.riders.filter(r => !r.picked_check).length > 0 && 
                (
                    <>
                        <View style={styles.track_trip_box}>
                            {tripData?.started ? (
                                <TouchableOpacity style={styles.track_trip_button} onPress={openTripMapModal}>
                                    <Text style={styles.track_trip_button_text}>مواصلة الرحلة</Text>                               
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity 
                                    style={styles.track_trip_button} 
                                    onPress={startTheTrip}
                                    disabled={takingTheTripLoading}
                                >
                                    <Text style={styles.track_trip_button_text}>بدا الرحلة</Text>
                                </TouchableOpacity>
                            )}
                            
                        </View>
                        <Modal
                            animationType="fade"
                            transparent={true} 
                            visible={openStartTripMapModal} 
                            onRequestClose={closeStartTheTripHandler}
                        >
                            <View style={styles.modal_container}>
                                <View style={styles.modal_box}>
                                    <View style={styles.modal_header}>
                                        <TouchableOpacity onPress={closeStartTheTripHandler}>
                                            <AntDesign name="closecircleo" size={24} color="gray" />
                                        </TouchableOpacity>
                                    </View>
                                    <View>
                                        {openStartTripMapModalLoading ? (
                                            <View style={styles.loading_location}>
                                                <Text style={styles.loading_location_text}>جاري تحديد موقعك ...</Text>
                                            </View>
                                        ) : (
                                            <View style={styles.mapContainer}>
                                                <MapView
                                                    provider="google"
                                                    ref={mapRef}
                                                    onLayout={handleStartTripMapLayout}
                                                    initialRegion={{
                                                        latitude: driverData[0]?.current_location?.latitude,
                                                        longitude: driverData[0]?.current_location?.longitude,
                                                        latitudeDelta: 0.005,
                                                        longitudeDelta: 0.005,
                                                    }}
                                                    loadingEnabled={true}
                                                    showsUserLocation={true}
                                                    style={styles.map}
                                                >
                                                    {selectedRider && driverOriginLocation && (
                                                        <MapViewDirections
                                                            origin={driverOriginLocation}
                                                            destination={selectedRider.location}
                                                            optimizeWaypoints={true}
                                                            apikey={GOOGLE_MAPS_APIKEY}
                                                            strokeWidth={4}
                                                            strokeColor="blue"
                                                            onError={(error) => console.log(error)}
                                                        />
                                                    )}
                                                    {tripData?.riders.filter(r => !r.picked_check).map((r, idx) => (
                                                        <Marker
                                                            key={`first-${r.id || idx}`}
                                                            coordinate={{
                                                                latitude: r?.location?.latitude,
                                                                longitude: r?.location?.longitude
                                                            }}
                                                            pinColor="red"
                                                            onPress={() => setSelectedRider(r)}
                                                        />
                                                    ))}
                                                </MapView>
                                                {selectedRider && (
                                                    <View style={styles.rider_info_box}>
                                                        <View style={styles.check_students_boxes}>
                                                            <TouchableOpacity 
                                                                style={styles.trip_riders_request_item_buttons_item}
                                                                onPress={() => handleCallRider(selectedRider.phone)}
                                                            >
                                                                <Ionicons name="call-outline" size={20} color="white" />
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={styles.pick_button_accepted} 
                                                                onPress={() => sendPickUpRiderRequest (tripData.id,selectedRider.id)}
                                                                disabled={isMarkingRider}
                                                            >
                                                                <Text style={styles.pick_button_text}>{isMarkingRider ? '...' :'صعد'}</Text>
                                                            </TouchableOpacity>
                                                            <Text style={styles.rider_name}>{formatRiderName(selectedRider.name)}</Text>
                                                        </View>
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </View>
                        </Modal>
                    </>
                )}
            </View>
        </SafeAreaView>
    )
}

export default intercityTripDetails

//get screen height
const { width: SCwidth, height: SCheight } = Dimensions.get('window');

const styles = StyleSheet.create({
    container:{
        flex:1,
        backgroundColor:colors.WHITE,
    },
    title:{
        width:'100%',
        height:100,
        flexDirection:'row-reverse',
        alignItems:'center',
        justifyContent:'center',
        gap:20,
    },
    titleText:{
        lineHeight:40,
        fontFamily:'Cairo_400Regular',
        fontSize:24,
        textAlign:'center',
    },
    arrowBackFunction:{
        height:40,
        alignItems:'center',
        justifyContent:'center',
    },
    main_box:{
        width:'100%',
        alignItems:'center',
        justifyContent:'center',
    },
    location_box:{
        width:'100%',
        flexDirection:'row',
        justifyContent:'flex-end',
        marginBottom:15,
    },
    location_text_box:{
        height:60,
        justifyContent:'space-between',
        alignItems:'flex-end',
    },
    location_icon_box:{
      height:60,
      width:60,
      justifyContent:'center',
      alignItems:'center',
    },
    trip_text_start_point_title:{
        lineHeight:30,
        fontFamily: 'Cairo_400Regular',
        fontSize:13,
        color:colors.DARKGRAY
    },
    trip_text_start_point:{
        lineHeight:30,
        fontFamily: 'Cairo_700Bold',
        fontSize:14,
    },
    no_rider_yet:{
        marginTop:50,
    },
    trip_riders_request_container:{
        width:SCwidth,
        height:280,
        marginBottom:10,
        justifyContent:'space-between',
        alignItems:'center',
    },
    trip_riders_request_box_title:{
        lineHeight:30,
        fontFamily: 'Cairo_400Regular',
        fontSize:14,
    },
    trip_riders_request_box_scroll:{
        width:SCwidth,
    },
    trip_riders_request_item:{
        width:SCwidth,
        height:45,
        marginBottom:5,
        flexDirection:'row-reverse',
        justifyContent:'center',
        alignItems:'center',
        gap:10,
        backgroundColor:colors.GRAY
    },
    trip_riders_request_item_name_text:{
        lineHeight:45,
        fontFamily: 'Cairo_400Regular',
        fontSize:14,
        color:colors.BLACK,
    },
    trip_riders_request_item_buttons_item:{
        width:30,
        height:30,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#295F98',
        borderRadius:20
    },
    track_trip_box:{
        width:'100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    track_trip_button:{
        width:130,
        height:40,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#295F98',
        borderRadius:15
    },
    track_trip_button_text:{
        lineHeight:40,
        fontFamily: 'Cairo_400Regular',
        fontSize:14,
        color:colors.WHITE
    },
    map_trip_button:{
        backgroundColor:'rgba(190, 154, 78, 0.30)',
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
        position: 'relative',
    },
    map:{
        width:SCwidth - 20,
        height:SCheight - 150,
    },
    rider_info_box: {
        position:'absolute',
        top:10,
        left:10,
        right:10,
        height:50,
        paddingHorizontal:10,
        flexDirection:'row-reverse',
        justifyContent:'center',
        alignItems:'center',
        borderRadius:10,
        backgroundColor:colors.WHITE,
        shadowColor:'#000',
        shadowOffset:{width:0,height:2},
        shadowOpacity:0.3,
        shadowRadius:4,
        elevation:5,
    },
    check_students_boxes:{
        width:300,
        height:50,
        borderRadius:15,
        flexDirection:'row',
        justifyContent:'space-between',
        alignItems:'center',
    },
    rider_name:{
        lineHeight:50,
        fontFamily: 'Cairo_400Regular',
        fontSize: 14,
        textAlign:'center',
        color:colors.BLACK
    },
    pick_button_accepted:{
        width:75,
        height:35,
        borderRadius:15,
        alignItems:'center',
        justifyContent:'center',
        backgroundColor:colors.BLUE,
    },
    pick_button_text:{
        lineHeight:35,
        verticalAlign:'middle',
        fontFamily: 'Cairo_400Regular',
        color:colors.WHITE
    },
    spinner_error_container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
})