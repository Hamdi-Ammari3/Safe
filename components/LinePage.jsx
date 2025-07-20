import {useState,useEffect,useRef} from 'react'
import { StyleSheet,Text,View,Image,TouchableOpacity,Dimensions,Alert,ScrollView,Linking,Modal,ActivityIndicator } from 'react-native'
import * as Location from 'expo-location'
import MapView, { Marker } from 'react-native-maps'
import MapViewDirections from 'react-native-maps-directions'
import haversine from 'haversine'
import { doc,updateDoc,writeBatch } from 'firebase/firestore'
import { DB } from '../firebaseConfig'
import dayjs from '../utils/dayjs'
import { useDriverData } from '../app/stateManagment/DriverContext'
import colors from '../constants/Colors'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import FontAwesome6 from '@expo/vector-icons/FontAwesome6'
import AntDesign from '@expo/vector-icons/AntDesign'
import Ionicons from '@expo/vector-icons/Ionicons'
import logo from '../assets/images/logo.jpg'

const LinePage = ({line}) => {
    const {driverData} = useDriverData()
    const GOOGLE_MAPS_APIKEY = ''
    const mapRef = useRef(null)

    const [startingTheTripLoading,setStartingTheTripLoading] = useState(false)
    const [openStartTripMapModalLoading,setOpenStartTripMapModalLoading] = useState(false)
    const [openStartTripMapModal,setOpenStartTripMapModal] = useState(false)
    const [driverOriginLocation,setDriverOriginLocation] = useState(null)
    const [driverCurrentLocation,setDriverCurrentLocation] = useState(null)
    const [selectedRider, setSelectedRider] = useState(null)
    const [isMarkingRider, setIsMarkingRider] = useState(false)
    const [firstTripRemainingRiders, setFirstTripRemainingRiders] = useState(
        line?.first_phase?.riders?.filter(r => !r.checked_at_home)?.length
    )
    const [secondTripRemainingRiders, setSecondTripRemainingRiders] = useState(
        line?.second_phase?.riders?.filter(r => !r.dropped_off)?.length
    )
    
    const createAlert = (alerMessage) => {
        Alert.alert(alerMessage)
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
  
            locationSubscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    distanceInterval: 100,
                    timeInterval: 10000,
                },
                async (newLocation) => {
                    const { latitude, longitude } = newLocation.coords;
                    const currentLocation = { latitude, longitude };

                    setDriverCurrentLocation(currentLocation)
                    setOpenStartTripMapModalLoading(false)   
                    await saveLocationToFirebase(latitude, longitude)                
                    checkAndUpdateOriginLocation(currentLocation)
                }
            )
        }

        if(openStartTripMapModal) {
            startTracking();
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
        }
    }

    // the initial driver location update
    //let lastOriginUpdateTime = Date.now()
    const lastOriginUpdateTimeRef = useRef(Date.now())

    // Function to check and update the origin location
    const checkAndUpdateOriginLocation = (currentLocation) => {
        if (!currentLocation?.latitude || !currentLocation?.longitude) return;
  
        if (!driverOriginLocation) {
            setDriverOriginLocation(currentLocation);
            return;
        }
  
        const now = Date.now();
        //if (now - lastOriginUpdateTime < 50000) return; // Prevent updates within 50 seconds
        if (now - lastOriginUpdateTimeRef.current < 50000) return;
  
        // Calculate the distance between the current location and the origin
        const distance = haversine(driverOriginLocation, currentLocation, { unit: "meter" });
  
        if (isNaN(distance)) return;
  
        if (distance > 8000) {
            setDriverOriginLocation(currentLocation)
            //lastOriginUpdateTime = now;
            lastOriginUpdateTimeRef.current = now;
        }
    }

    // Get iraqi time and driver daily tracking object
    const getIraqTimeAndTracking = (driverData) => {
        const iraqNow = dayjs().utcOffset(180);
        const yearMonthKey = `${iraqNow.year()}-${String(iraqNow.month() + 1).padStart(2, "0")}`;
        const dayKey = String(iraqNow.date()).padStart(2, "0");
        const iraqRealTime = iraqNow.format("HH:mm");

        // Get existing dailyTracking object
        const existingTracking = driverData[0].dailyTracking || {};
        if (!existingTracking[yearMonthKey]) existingTracking[yearMonthKey] = {};
        if (!existingTracking[yearMonthKey][dayKey]) existingTracking[yearMonthKey][dayKey] = {};
    
        return { yearMonthKey, dayKey, iraqRealTime, existingTracking };
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

    //Start the first phase trip
    const handleStartFirstPhase = async () => {
        if (!line || !line?.first_phase?.riders?.length) {
            return createAlert("بيانات الخط غير مكتملة");
        }

        if(startingTheTripLoading) return
        setStartingTheTripLoading(true)

        try {
            
            setOpenStartTripMapModalLoading(true)

            // Open the trip map modal
            setOpenStartTripMapModal(true)

            const batch = writeBatch(DB)
            const driverDocRef = doc(DB, 'drivers', driverData[0]?.id)

            const { yearMonthKey, dayKey, iraqRealTime, existingTracking } = getIraqTimeAndTracking(driverData)
            
            // Copy and update the line
            const updatedLine = {
                ...line,
                first_phase: {
                    ...line.first_phase,
                    phase_started: true,
                    phase_starting_time: iraqRealTime,
                },
            };

            // Defensive: check if today_lines exists
            const todayLines = existingTracking?.[yearMonthKey]?.[dayKey]?.today_lines;
            if (!todayLines) {
                setStartingTheTripLoading(false)
                return createAlert("لم يتم العثور على بيانات اليوم.")
            }

            // Replace the line in today_lines
            const updatedTodayLines = todayLines.map((li) =>
                li.id === line.id ? updatedLine : li
            )

            // Assemble the full updated tracking object
            const updatedTracking = {
                ...existingTracking,
                [yearMonthKey]: {
                    ...existingTracking[yearMonthKey],
                    [dayKey]: {
                        ...existingTracking[yearMonthKey][dayKey],
                        today_lines: updatedTodayLines,
                    },
                },
            }

            batch.update(driverDocRef, {
                dailyTracking: updatedTracking,
            })

            await batch.commit()

            // Send notifications to riders
            const notifyPromises = line.first_phase.riders
                .filter(rider => rider.notification_token)
                .map(rider =>
                    sendNotification(
                    rider.notification_token,
                    "تنبيه الرحلة",
                    `السائق بدأ رحلة الذهاب لخط ${line.name}، يرجى الاستعداد!`
                )
            )

            await Promise.all(notifyPromises)
        } catch (error) {
            console.log("handleStartFirstPhase error", error);
            createAlert("حدث خطأ أثناء بدء المرحلة الأولى");
            setStartingTheTripLoading(false)
        } finally {
            setOpenStartTripMapModalLoading(false)
            setStartingTheTripLoading(false)
        }
    }

    //Re-start the first phase trip
    const handleContinueFirstPhase = () => {
        setOpenStartTripMapModalLoading(true)
        setOpenStartTripMapModal(true)   
    }

    //Start the second phase trip
    const handleStartSecondPhase = async () => {
        if (!line || !line?.second_phase?.riders?.length) {
            return createAlert("بيانات الخط غير مكتملة");
        }

        if(startingTheTripLoading) return
        setStartingTheTripLoading(true)

        try {
            setOpenStartTripMapModalLoading(true)

            // Open the trip map modal
            setOpenStartTripMapModal(true)

            const batch = writeBatch(DB)
            const driverDocRef = doc(DB, 'drivers', driverData[0]?.id)

            const { yearMonthKey, dayKey, iraqRealTime, existingTracking } = getIraqTimeAndTracking(driverData)
            
            // Copy and update the line
            const updatedLine = {
                ...line,
                second_phase: {
                    ...line.second_phase,
                    phase_started: true,
                    phase_starting_time: iraqRealTime,
                },
            };

            // Defensive: check if today_lines exists
            const todayLines = existingTracking?.[yearMonthKey]?.[dayKey]?.today_lines;
            if (!todayLines) {
                setStartingTheTripLoading(false)
                return createAlert("لم يتم العثور على بيانات اليوم.")
            }

            // Replace the line in today_lines
            const updatedTodayLines = todayLines.map((li) =>
                li.id === line.id ? updatedLine : li
            )

            // Assemble the full updated tracking object
            const updatedTracking = {
                ...existingTracking,
                [yearMonthKey]: {
                    ...existingTracking[yearMonthKey],
                    [dayKey]: {
                        ...existingTracking[yearMonthKey][dayKey],
                        today_lines: updatedTodayLines,
                    },
                },
            }

            batch.update(driverDocRef, {
                dailyTracking: updatedTracking,
            })

            for (const rider of line?.second_phase?.riders) {
                const riderRef = doc(DB, "riders", rider.id);
                batch.update(riderRef, {
                    trip_status: "to home",
                })
            }

            await batch.commit()

            // Send notifications to riders
            const notifyPromises = line.second_phase.riders
                .filter(rider => rider.notification_token)
                .map(rider =>
                    sendNotification(
                    rider.notification_token,
                    "تنبيه الرحلة",
                    `السائق بدأ رحلة العودة لخط ${line.name}، يرجى الاستعداد!`
                )
            )

            await Promise.all(notifyPromises)

            // Open the trip map modal
            setOpenStartTripMapModal(true)
        } catch (error) {
            console.log("handleStartSecondPhase error", error);
            createAlert("حدث خطأ أثناء بدء المرحلة الثانية");
        } finally {
            setOpenStartTripMapModalLoading(false);
        }
    }

    //Re-start the second phase trip
    const handleCompleteSecondPhase = () => {
        setOpenStartTripMapModal(true)
        setOpenStartTripMapModalLoading(true)
    }

    //Close the trip modal map
    const closeStartTheTripHandler = () => {
        setOpenStartTripMapModal(false)
        setSelectedRider(null)
    }

    //Fit trip coords
    const fitMapRidersMarkers = () => {
        if (!mapRef.current || !line || !driverData?.length) return;
        let allCoords = [];
        if (selectedRider) {
            allCoords = [
                {
                    latitude: driverOriginLocation?.latitude,
                    longitude: driverOriginLocation?.longitude
                },
                {
                    latitude: selectedRider?.home_location?.latitude,
                    longitude: selectedRider?.home_location?.longitude
                }
            ]
        } else if (line.first_phase.phase_finished === false) {
            allCoords = [
                {
                    latitude: driverData[0]?.current_location?.latitude,
                    longitude: driverData[0]?.current_location?.longitude
                },
                ...line?.first_phase?.riders.map(r => ({
                    latitude: r?.home_location?.latitude,
                    longitude: r?.home_location?.longitude
                })),
                {
                    latitude: line?.first_phase?.destination_location?.latitude,
                    longitude: line?.first_phase?.destination_location?.longitude
                },
            ]
        } else if(line.first_phase.phase_finished === true) {
            allCoords = [
                {
                    latitude: driverData[0].current_location?.latitude,
                    longitude: driverData[0].current_location?.longitude
                },
                ...line?.second_phase?.riders.map(r => ({
                    latitude: r?.home_location?.latitude,
                    longitude: r?.home_location?.longitude
                })),
            ]
        }
        mapRef.current.fitToCoordinates(allCoords, {
            edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
            animated: true
        });
    }

    //Trip ready to open
    const handleStartTripMapLayout = () => {
        console.log('riders ...')
        fitMapRidersMarkers()
    }

    //De-select rider
    const deselectRider = () => {
        setSelectedRider(null)
    }

    //Picking-up riders
    const pickRider = async (status) => {

        const riderLocation = selectedRider.home_location;
        const distance = haversine(driverCurrentLocation, riderLocation, { unit: "meter" });
        
        if(status === true) {
            if(distance > 200) {
                createAlert('يجب أن تكون على بعد 200 متر أو أقل من منزل الطالب لتتمكن من تأكيد الصعود')
                return;
            }
        }

        if (isMarkingRider) return;
        setIsMarkingRider(true);

        try {
            const batch = writeBatch(DB);
            const driverDocRef = doc(DB, 'drivers', driverData[0]?.id);

            if (!selectedRider || !line) {
                alert('حدث خطأ: لا يوجد طالب أو خط محدد');
                setIsMarkingRider(false);
                return;
            }

            const riderDoc = doc(DB, 'riders', selectedRider.id)
            const { yearMonthKey, dayKey, iraqRealTime, existingTracking } = getIraqTimeAndTracking(driverData)
            let updatedLine = { ...line }

            updatedLine.first_phase.riders = line.first_phase.riders.map((rider) => {
                if (rider.id === selectedRider.id) {
                    return {
                        ...rider,
                        checked_at_home:true,
                        picked_up: status,
                        picked_up_time: iraqRealTime,
                    };
                }
                return rider;
            })

            // send notification to picked up riders
            if (status === true) {
                if(selectedRider.notification_token) {
                    await sendNotification(
                        selectedRider.notification_token, 
                        "رحلة الذهاب بدأت",
                        `${selectedRider.name} في الطريق إلى المدرسة الآن`
                    )
                }
            }

            // Update rider document in riders collection
            batch.update(riderDoc, {
                checked_at_home:true,
                //picked_up: status,
                trip_status: status ? 'to destination' : 'at home',
            })

            setFirstTripRemainingRiders(updatedLine.first_phase.riders.filter(r => !r.checked_at_home).length)  

            // Update the specific line inside dailyTracking
            const updatedTracking = {
                ...existingTracking,
                [yearMonthKey]: {
                    ...existingTracking[yearMonthKey],
                    [dayKey]: {
                        ...existingTracking[yearMonthKey][dayKey],
                        today_lines: existingTracking[yearMonthKey][dayKey].today_lines.map((li) =>
                            li.id === line.id ? updatedLine : li
                        ),
                    },
                },
            }

            batch.update(driverDocRef, {
                dailyTracking: updatedTracking,
            })

            await batch.commit()
                      
        } catch (error) {
            alert('حدث خطأ اثناء تحديث حالة الطالب')
            console.log(error)
            setIsMarkingRider(false)
        } finally{
            setIsMarkingRider(false)
            setSelectedRider(null)
        }
    }

    //Dropping-off riders
    const droppingRiders = async () => {
        if (isMarkingRider) return;
        setIsMarkingRider(true);

        try {
            const batch = writeBatch(DB);
            const driverDocRef = doc(DB, 'drivers', driverData[0]?.id);

            if (!selectedRider || !line) {
                alert('حدث خطأ: لا يوجد طالب أو خط محدد');
                setIsMarkingRider(false);
                return;
            }

            const riderDoc = doc(DB, 'riders', selectedRider.id);
            const { yearMonthKey, dayKey, iraqRealTime, existingTracking } = getIraqTimeAndTracking(driverData);
            let updatedLine = { ...line };

            updatedLine.second_phase.riders = line.second_phase.riders.map((rider) => {
                if (rider.id === selectedRider.id) {
                    return {
                        ...rider,
                        dropped_off: true,
                        dropped_off_time: iraqRealTime,
                    };
                }
                return rider;
            })

            //Update rider document in Firestore
            batch.update(riderDoc, {
                trip_status: 'at home',
            });

            //Send notification (if token exists)
            if (selectedRider.notification_token) {
                await sendNotification(
                    selectedRider.notification_token,
                    "وصل إلى المنزل",
                    `${selectedRider.name} وصل إلى المنزل الان`
                );
            }

            //Update UI state for remaining riders
            const remainingRiders = updatedLine.second_phase.riders.filter(r => !r.dropped_off).length;
            setSecondTripRemainingRiders(remainingRiders);

            //If all riders are dropped off, mark phase_finished
            if (remainingRiders === 0) {
                updatedLine.second_phase.phase_finished = true;
                updatedLine.second_phase.phase_finished_time = iraqRealTime;
            }

            //Update dailyTracking in driver doc
            const updatedTracking = {
                ...existingTracking,
                [yearMonthKey]: {
                    ...existingTracking[yearMonthKey],
                    [dayKey]: {
                        ...existingTracking[yearMonthKey][dayKey],
                        today_lines: existingTracking[yearMonthKey][dayKey].today_lines.map((li) =>
                            li.id === line.id ? updatedLine : li
                        ),
                    },
                },
            };

            batch.update(driverDocRef, {
                dailyTracking: updatedTracking,
            });

            await batch.commit();

        } catch (error) {
            alert('حدث خطأ أثناء تحديث حالة الطالب');
            console.log(error);
        } finally {
            setIsMarkingRider(false);
            setSelectedRider(null);
        }
    }

    //Finish first phase trip
    const finishFirstPhaseTrip = async () => {

        const riderLocation = line?.first_phase?.destination_location;
        const distance = haversine(driverCurrentLocation, riderLocation, { unit: "meter" });

        if (distance > 200) {
            createAlert('يجب أن تكون قريباً من المدرسة بمسافة لا تتجاوز 200 متر لإنهاء الرحلة');
            return;
        }
        if (isMarkingRider || firstTripRemainingRiders > 0) return;
        setIsMarkingRider(true);

        try {
            const batch = writeBatch(DB);
            const driverDocRef = doc(DB, 'drivers', driverData[0]?.id);

            if (!line) {
                alert('حدث خطأ: لا يوجد خط محدد');
                setIsMarkingRider(false);
                return;
            }

            const { yearMonthKey, dayKey, iraqRealTime, existingTracking } = getIraqTimeAndTracking(driverData);
            let updatedLine = { ...line };

            // Mark the phase as finished
            updatedLine.first_phase.phase_finished = true;
            updatedLine.first_phase.phase_finishing_time = iraqRealTime;

            // Update rider documents in riders collection
            updatedLine.first_phase.riders.forEach((rider) => {
                if(rider.picked_up) {
                    const riderDoc = doc(DB, 'riders', rider.id);
                    batch.update(riderDoc, {
                        trip_status: 'at destination',
                    });
                }           
            });

            // Update the specific line inside dailyTracking
            const updatedTracking = {
                ...existingTracking,
                [yearMonthKey]: {
                    ...existingTracking[yearMonthKey],
                    [dayKey]: {
                        ...existingTracking[yearMonthKey][dayKey],
                        today_lines: existingTracking[yearMonthKey][dayKey].today_lines.map((li) =>
                            li.id === line.id ? updatedLine : li
                        ),
                    },
                },
            };

            // Commit changes to the driver document
            batch.update(driverDocRef, {
                dailyTracking: updatedTracking,
            });

            await batch.commit();

        } catch (error) {
            alert('حدث خطأ أثناء إنهاء المرحلة الأولى');
            console.log(error);
        } finally {
            setIsMarkingRider(false)
            setSelectedRider(null)
            setOpenStartTripMapModal(false)
        }
    }

    // Format the rider name to two words only combination
    const formatRiderName = (name = '', familyName = '') => {
        const firstName = name.trim().split(/\s+/)[0] || '';
        const firstFamilyName = familyName.trim().split(/\s+/)[0] || '';
        return `${firstName} ${firstFamilyName}`;
    }

    // Format the destiantion name to two words only combination
    const getFirstTwoWords = (text) => {
        if (!text) return '';
        return text.trim().split(/\s+/).slice(0, 2).join(' ');
    }

    const formatTimeOnly = (timestamp) => {
        if (!timestamp) return '';
        const date = dayjs(timestamp.toDate());
        return date.format('hh:mm A');
    }

    //Render markers
    const renderMarkers = () => {
        if (line.first_phase.phase_finished === false) {
            return (
                <>
                    {line.first_phase.riders.filter(r => !r.checked_at_home).map((r, idx) => (
                        <Marker
                            key={`first-${r.id || idx}`}
                            coordinate={{
                                latitude: r?.home_location?.latitude,
                                longitude: r?.home_location?.longitude
                            }}
                            pinColor="red"
                            onPress={() => setSelectedRider(r)}
                        />
                    ))}
                    <Marker
                        key={`school-${line.id}`}
                        coordinate={{
                            latitude: line.first_phase.destination_location.latitude,
                            longitude: line.first_phase.destination_location.longitude
                        }}
                        pinColor="blue"
                        onPress={() =>
                            setSelectedRider({
                                id: 'school',
                                name: line.first_phase.destination,
                                isSchool: true
                            })
                        }
                    />
                </>
            );
        } else {
            return (
                <>
                    {line.second_phase.riders.filter(r => !r.dropped_off).map((r, idx) => (
                        <Marker
                            key={`second-${r.id || idx}`}
                            coordinate={{
                                latitude: r?.home_location?.latitude,
                                longitude: r?.home_location?.longitude
                            }}
                            pinColor="red"
                            onPress={() => setSelectedRider(r)}
                        />
                    ))}
                </>
            );
        }
    }

    //Call the rider 
    const handleCallRider = (phoneNumber) => {
        if (!phoneNumber) return;
    
        Linking.openURL(`tel:${phoneNumber}`)
        .catch(err => {
            console.log('Failed to make a call:', err);
            Alert.alert('خطأ', 'تعذر إجراء المكالمة');
        });
    }

    // Trips buttons
    const renderTripButton = () => {
        const firstStarted = line?.first_phase?.phase_started;
        const firstFinished = line?.first_phase?.phase_finished;
        const secondStarted = line?.second_phase?.phase_started;
        const secondFinished = line?.second_phase?.phase_finished;

        if (!firstStarted && !firstFinished) {
            return (
                <TouchableOpacity 
                    style={styles.track_trip_button} 
                    onPress={handleStartFirstPhase}
                    disabled={startingTheTripLoading}
                >
                    {startingTheTripLoading ? (
                        <ActivityIndicator size="large" color={colors.WHITE} />
                    ) : (
                        <Text style={styles.track_trip_button_text}>ابدأ رحلة الذهاب</Text>
                    )}
                </TouchableOpacity>
            )
        }

        if (firstStarted && !firstFinished) {
            return (
                <TouchableOpacity style={styles.track_trip_button} onPress={handleContinueFirstPhase}>
                    <Text style={styles.track_trip_button_text}>أكمل رحلة الذهاب</Text>
                </TouchableOpacity>
            )
        }

        if (firstFinished && !secondStarted && !secondFinished) {
            return (
                <TouchableOpacity style={styles.track_trip_button} onPress={handleStartSecondPhase}>
                    <Text style={styles.track_trip_button_text}>ابدأ رحلة العودة</Text>
                </TouchableOpacity>
            )
        }

        if (secondStarted && !secondFinished) {
            return (
                <TouchableOpacity style={styles.track_trip_button} onPress={handleCompleteSecondPhase}>
                    <Text style={styles.track_trip_button_text}>أكمل رحلة العودة</Text>
                </TouchableOpacity>
            )
        }

        return null; // All phases done or invalid state
    }

    // Today journey is finished
    if(line.first_phase.phase_finished === true && line.second_phase.phase_finished === true) {
        return(
            <View style={styles.finished_line_container}>
                <View style={styles.logo}>
                    <Image source={logo} style={styles.logo_image}/>
                </View>
                <Text style={styles.finished_line_text}>لقد انهيت رحلات هذا الخط بنجاح</Text>
            </View>
        )
    }

    return (
        <View style={styles.container}>
            <View style={[styles.line_info_box,{marginBottom:25}]}>
                <View style={styles.line_text_box}>
                    <Text style={styles.line_text_destination_title}>الوجهة</Text>
                    <Text style={styles.line_text_destination}>{line?.first_phase?.destination}</Text>
                </View>
                <View style={styles.line_destination_icon_box}>
                    <MaterialCommunityIcons name="map-marker-check-outline" size={24} color="black" />
                </View>
            </View>
            <View style={styles.line_info_box}>
                <View style={styles.line_text_box}>
                    <Text style={styles.line_text_destination_title}>بداية الدوام</Text>
                    <Text style={styles.line_text_destination}>{formatTimeOnly(line?.start_time)}</Text>
                </View>
                <View style={styles.line_destination_icon_box}>
                    <MaterialIcons name="access-time" size={24} color="black" />
                </View>
            </View>
            <View style={styles.line_info_box}>
                <View style={styles.line_text_box}>
                    <Text style={styles.line_text_destination_title}>انتهاء الدوام</Text>
                    <Text style={styles.line_text_destination}>{formatTimeOnly(line?.end_time)}</Text>
                </View>
                <View style={styles.line_destination_icon_box}>
                    <MaterialIcons name="access-time" size={24} color="black" />
                </View>
            </View>

            <View style={styles.line_info_box}>
                <View style={styles.line_text_box}>
                    <Text style={styles.line_text_destination_title}>عدد الركاب</Text>
                    <Text style={styles.line_text_destination}>{line?.first_phase?.riders?.length}</Text>
                </View>
                <View style={styles.line_destination_icon_box}>
                    <FontAwesome6 name="person" size={24} color="black" />
                </View>
            </View>

            <View style={styles.line_riders_checklist}>
                <View style={styles.line_riders_checklist_title}>
                    <Text style={styles.line_riders_checklist_title_text}>الركاب</Text>
                    <Text style={styles.line_riders_checklist_title_text}>-</Text>
                    <Text style={styles.line_riders_checklist_title_text}>
                        {line?.first_phase?.phase_finished === true ? 'رحلة العودة' : 'رحلة الذهاب'}
                    </Text>
                </View>
                <ScrollView
                    vertical
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.line_riders_checklist_scroll}
                >
                    {(line?.first_phase?.phase_finished === true
                        ? line?.second_phase?.riders
                        : line?.first_phase?.riders
                    )?.map((rider, index) => {
                        const inSecondPhase = line?.first_phase?.phase_finished === true;
                        const isChecked = inSecondPhase ? rider.dropped_off : rider.picked_up;

                        return (
                            <View key={rider.id || index} style={styles.line_riders_checklist_item}>
                                <Text style={styles.line_riders_checklist_item_text}>{rider.name}</Text>
                                <View style={styles.line_riders_checklist_item_buttons}>
                                <TouchableOpacity 
                                    style={styles.line_riders_checklist_item_button}
                                    onPress={() => handleCallRider(rider.phone_number)}
                                >
                                    <Ionicons name="call-outline" size={20} color="white" />
                                </TouchableOpacity>
                                {isChecked && (
                                    <AntDesign name="checkcircle" size={30} color="#328E6E" />
                                )}
                                </View>
                            </View>
                        )
                    })}
                </ScrollView>
            </View>

            <View style={styles.track_trip_box}>
                {renderTripButton()}
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
                                <View style={styles.map_container}>
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
                                                destination={
                                                    selectedRider.isSchool
                                                        ? line.first_phase.destination_location
                                                        : selectedRider.home_location
                                                }
                                                optimizeWaypoints={true}
                                                apikey={GOOGLE_MAPS_APIKEY}
                                                strokeWidth={4}
                                                strokeColor="blue"
                                                onError={(error) => console.log(error)}
                                            />
                                        )}
                                        {renderMarkers()}
                                    </MapView>

                                    {selectedRider ? (
                                        selectedRider.id === 'school' ? (
                                            <View style={styles.rider_info_box}>
                                                <Text style={styles.rider_name}>{getFirstTwoWords(selectedRider.name)}</Text>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.finish_trip_button,
                                                        firstTripRemainingRiders > 0 && styles.finish_trip_disabled
                                                    ]}
                                                    onPress={finishFirstPhaseTrip}
                                                    disabled={firstTripRemainingRiders > 0}
                                                >
                                                    <Text 
                                                        style={[
                                                            styles.finish_trip_button_text,
                                                            firstTripRemainingRiders > 0 && styles.finish_trip_disabled_text
                                                        ]}
                                                    >
                                                        {isMarkingRider ? '...' : 'إنهاء المرحلة الأولى'}
                                                    </Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={deselectRider}>
                                                    <AntDesign name="closecircleo" size={22} color="black" />
                                                </TouchableOpacity>
                                            </View>
                                        ) : (                
                                            <View style={styles.rider_info_box}>
                                                {line.first_phase.phase_finished === false ? (
                                                    <View style={styles.check_students_boxes}>
                                                        <TouchableOpacity
                                                            style={styles.pick_button_accepted} 
                                                            onPress={() => pickRider(true)} 
                                                            disabled={isMarkingRider}
                                                        >
                                                            <Text style={styles.pick_button_text}>{isMarkingRider ? '...' :'صعد'}</Text>
                                                        </TouchableOpacity>
                                                        <Text style={styles.rider_name}>{formatRiderName(selectedRider.name,selectedRider.family_name)}</Text>
                                                        <TouchableOpacity
                                                            style={styles.pick_button_denied} 
                                                            onPress={() => pickRider(false)}
                                                            disabled={isMarkingRider}
                                                        >
                                                            <Text style={styles.pick_button_text}>{isMarkingRider ? '...' :'لم يصعد'}</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                ) : (
                                                    <View style={styles.check_students_boxes}>
                                                        <Text style={styles.rider_name}>{formatRiderName(selectedRider.name,selectedRider.family_name)}</Text>
                                                        <TouchableOpacity
                                                            style={styles.pick_button_accepted} 
                                                            onPress={droppingRiders}
                                                            disabled={isMarkingRider}
                                                        >
                                                            <Text style={styles.pick_button_text}>{isMarkingRider ? '...' :'نزل'}</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                        
                                                <TouchableOpacity onPress={deselectRider}>
                                                    <AntDesign name="closecircleo" size={22} color="black" />
                                                </TouchableOpacity>
                                            </View>
                                        )
                                    ) : (
                                        <View style={styles.rider_info_box}>
                                            {line.first_phase.phase_finished === false ? (
                                                <View style={styles.trip_left_riders}>
                                                    <View style={styles.trip_left_riders_number}>
                                                        <Text style={styles.rider_name}>رحلة الذهاب</Text>
                                                    </View>                           
                                                    <Text style={styles.rider_name}>-</Text>
                                                    <View style={styles.trip_left_riders_number}>
                                                        <Text style={styles.rider_name}>{firstTripRemainingRiders}</Text>
                                                        <Text style={styles.rider_name}>راكب</Text>
                                                    </View>
                                                </View>                        
                                            ) : (
                                                <View style={styles.trip_left_riders}>
                                                    <View style={styles.trip_left_riders_number}>
                                                        <Text style={styles.rider_name}>رحلة العودة</Text>
                                                    </View>                           
                                                    <Text style={styles.rider_name}>-</Text>
                                                    <View style={styles.trip_left_riders_number}>
                                                        <Text style={styles.rider_name}>{secondTripRemainingRiders}</Text>
                                                        <Text style={styles.rider_name}>راكب</Text>
                                                    </View>
                                                </View>
                                            )}                
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    )
}

export default LinePage

//get screen height and width
const { width: SCwidth, height: SCheight } = Dimensions.get('window');

const styles = StyleSheet.create({
    container:{
        width: SCwidth,
        height: SCheight - 70,
    },
    line_info_box:{
        width:'100%',
        flexDirection:'row',
        justifyContent:'flex-end',
        marginBottom:15,
    },
    line_text_box:{
        height:60,
        width:SCwidth - 50,
        textAlign:'center',
        justifyContent:'space-between',
        alignItems:'flex-end',
    },
    line_destination_icon_box:{
      height:60,
      width:60,
      justifyContent:'center',
      alignItems:'center',
    },
    line_text_destination_title:{
        lineHeight:30,
        fontFamily: 'Cairo_400Regular',
        fontSize:13,
        color:colors.DARKGRAY
    },
    line_text_destination:{
        lineHeight:30,
        fontFamily: 'Cairo_700Bold',
        fontSize:14,
        textAlign:'center'
    },
    line_riders_checklist:{
        width:SCwidth,
        height:200,
        marginBottom:10,
        justifyContent:'space-between',
        alignItems:'center',
    },
    line_riders_checklist_title:{
        flexDirection:'row-reverse',
        gap:10,
    },
    line_riders_checklist_title_text:{
        lineHeight:30,
        fontFamily: 'Cairo_400Regular',
        fontSize:14,
    },
    line_riders_checklist_scroll:{
        width:SCwidth,
    },
    line_riders_checklist_item:{
        width:SCwidth,
        height:45,
        marginBottom:5,
        flexDirection:'row-reverse',
        justifyContent:'center',
        alignItems:'center',
        gap:10,
        backgroundColor:colors.GRAY
    },
    line_riders_checklist_item_text:{
        width:200,
        lineHeight:45,
        textAlign:'right',
        fontFamily: 'Cairo_400Regular',
        fontSize:14,
        color:colors.BLACK,
    },
    line_riders_checklist_item_buttons:{
        width:80,
        flexDirection:'row-reverse',
        justifyContent: 'center',
        alignItems: 'center',
        gap:10,
    },
    line_riders_checklist_item_button:{
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
        width:150,
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
    map_container: {
        width:SCwidth - 20,
        height:SCheight - 150,
        position: 'relative',
    },
    map: {
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
        justifyContent:'space-between',
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
        width:280,
        height:50,
        borderRadius:15,
        flexDirection:'row-reverse',
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
    pick_button_denied:{
        width:75,
        height:35,
        borderRadius:15,
        alignItems:'center',
        justifyContent:'center',
        backgroundColor:'#d11a2a',
    },
    finish_trip_button:{
        width:160,
        height:35,
        borderRadius:15,
        alignItems:'center',
        justifyContent:'center',
        backgroundColor:colors.BLUE,
    },
    finish_trip_button_text:{
        lineHeight:35,
        verticalAlign:'middle',
        fontFamily: 'Cairo_400Regular',
        color:colors.WHITE
    },
    finish_trip_disabled:{
        backgroundColor:'#CCC',
    },
    finish_trip_disabled_text:{
        color:colors.DARKGRAY
    },
    pick_button_text:{
        lineHeight:35,
        verticalAlign:'middle',
        fontFamily: 'Cairo_400Regular',
        color:colors.WHITE
    },
    trip_left_riders:{
        width:'100%',
        height:50,
        flexDirection:'row-reverse',
        justifyContent:'center',
        alignItems:'center',
        gap:10,
    },
    trip_left_riders_number:{
        width:100,
        height:50,
        borderRadius:15,
        flexDirection:'row-reverse',
        justifyContent:'center',
        alignItems:'center',
        gap:10,
    },
    rider_number:{
        lineHeight:50,
        fontFamily: 'Cairo_700Bold',
        fontSize: 14,
        textAlign:'center',
        color:colors.BLACK
    },
    finished_line_container:{
        height:SCheight,
    },
    logo:{
        height:200,
        marginTop:120,
        alignItems:'center',
        justifyContent:'center',
    },
    logo_image:{
        height:180,
        width:180,
        resizeMode:'contain',
    },
    finished_line_text:{
        width:250,
        height:50,
        borderColor:colors.BLACK,
        borderWidth:1,
        verticalAlign:'middle',
        borderRadius:15,
        textAlign:'center',
        fontFamily: 'Cairo_400Regular',
        fontSize:16,
    },
})
